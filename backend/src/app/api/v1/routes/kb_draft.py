"""
KB Draft Routes - Web URL Knowledge Base creation (3-Phase Flow).

PHASE 1: Draft Mode (Redis Only)
- User configures KB without database writes
- Add URLs, configure chunking/embedding
- Fast, non-committal configuration

PHASE 2: Finalization (Create DB Records)
- Create KB + Document placeholders in PostgreSQL
- Queue Celery background task
- Return pipeline_id for progress tracking

PHASE 3: Background Processing (Celery Task)
- Scrape → Parse → Chunk → Embed → Index
- Real-time progress updates to Redis
- Update KB status on completion

This file implements PHASE 1 & 2 (API endpoints).
PHASE 3 is implemented in Celery tasks.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Body, Query, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from uuid import UUID
from pydantic import BaseModel, Field, validator, model_validator
from datetime import datetime
from io import BytesIO

from app.db.session import get_db
from app.api.v1.dependencies import get_current_user
from app.models.user import User
from app.models.workspace import Workspace
from app.services.draft_service import draft_service, DraftType
from app.services.kb_draft_service import kb_draft_service

router = APIRouter(prefix="/kb-drafts", tags=["kb_drafts"])


# ========================================
# REQUEST/RESPONSE MODELS
# ========================================

class CreateKBDraftRequest(BaseModel):
    """Request model for creating KB draft"""
    name: str = Field(..., min_length=1, max_length=255, description="KB name")
    description: Optional[str] = Field(None, description="KB description")
    workspace_id: UUID = Field(..., description="Workspace ID")
    context: str = Field(default="both", description="Context: chatbot, chatflow, or both")


class AddWebSourceRequest(BaseModel):
    """
    Unified request model for adding web URLs to KB draft.

    Supports both single URL and bulk operations with comprehensive configuration options.
    All advanced options are optional - use what you need.
    """
    # Single URL or multiple URLs (unified approach)
    url: Optional[str] = Field(None, description="Single web URL to scrape/crawl")
    urls: Optional[List[str]] = Field(None, min_items=1, max_items=50, description="Multiple web URLs for bulk operation")

    # Unified configuration (all options available)
    config: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Comprehensive crawl configuration - all options available"
    )

    # Per-URL configurations (for bulk operations)
    per_url_configs: Optional[Dict[str, Dict[str, Any]]] = Field(
        default=None,
        description="URL-specific configurations that override the main config"
    )

    @model_validator(mode='after')
    def validate_url_input(self):
        url = self.url
        urls = self.urls

        if not url and not urls:
            raise ValueError("Either 'url' or 'urls' must be provided")
        if url and urls:
            raise ValueError("Provide either 'url' OR 'urls', not both")
        return self

    class Config:
        json_schema_extra = {
            "examples": [
                {
                    "title": "Single URL - Basic",
                    "summary": "Add single URL with basic configuration",
                    "value": {
                        "url": "https://docs.example.com/introduction",
                        "config": {
                            "method": "crawl",
                            "max_pages": 50,
                            "max_depth": 3,
                            "stealth_mode": True
                        }
                    }
                },
                {
                    "title": "Single URL - Advanced",
                    "summary": "Add single URL with comprehensive configuration",
                    "value": {
                        "url": "https://docs.example.com/introduction",
                        "config": {
                            # Core crawling options
                            "method": "crawl",
                            "max_pages": 50,
                            "max_depth": 3,

                            # URL filtering
                            "include_patterns": ["/docs/**", "/guides/**", "/api/**"],
                            "exclude_patterns": ["/admin/**", "/auth/**", "*.pdf"],
                            "allowed_domains": ["docs.example.com", "guides.example.com"],
                            "follow_redirects": True,

                            # Content filtering
                            "content_types": ["text/html", "text/markdown", "text/plain"],
                            "min_content_length": 100,
                            "max_content_length": 1000000,
                            "skip_duplicates": True,

                            # Performance & behavior
                            "stealth_mode": True,
                            "wait_time": 1000,
                            "timeout": 30000,
                            "retries": 3,
                            "concurrent_requests": 5,

                            # Advanced options
                            "extract_metadata": True,
                            "preserve_formatting": True,
                            "include_images": False,
                            "include_tables": True,
                            "remove_nav_elements": True,
                            "remove_footer_elements": True,

                            # JavaScript handling
                            "enable_javascript": False,
                            "wait_for_selector": None,
                            "custom_headers": {},

                            # Output format
                            "output_format": "markdown",
                            "include_raw_html": False
                        }
                    }
                },
                {
                    "title": "Bulk URLs - Shared Config",
                    "summary": "Add multiple URLs with shared configuration",
                    "value": {
                        "urls": [
                            "https://docs.example.com/introduction",
                            "https://docs.example.com/api",
                            "https://docs.example.com/guides"
                        ],
                        "config": {
                            "method": "crawl",
                            "max_pages": 20,
                            "max_depth": 2,
                            "stealth_mode": True,
                            "include_patterns": ["/docs/**", "/api/**", "/guides/**"]
                        }
                    }
                },
                {
                    "title": "Bulk URLs - Per-URL Config",
                    "summary": "Add multiple URLs with individual configurations",
                    "value": {
                        "urls": [
                            "https://docs.example.com/introduction",
                            "https://api.example.com/reference"
                        ],
                        "config": {
                            "method": "crawl",
                            "stealth_mode": True
                        },
                        "per_url_configs": {
                            "https://docs.example.com/introduction": {
                                "max_pages": 50,
                                "include_patterns": ["/docs/**"]
                            },
                            "https://api.example.com/reference": {
                                "max_pages": 10,
                                "method": "scrape",
                                "include_patterns": ["/api/**"]
                            }
                        }
                    }
                }
            ]
        }


class UpdateChunkingConfigRequest(BaseModel):
    """Request model for chunking configuration"""
    strategy: str = Field(default="by_heading", description="Chunking strategy")
    chunk_size: int = Field(default=1000, ge=100, le=5000, description="Chunk size")
    chunk_overlap: int = Field(default=200, ge=0, le=1000, description="Chunk overlap")
    preserve_code_blocks: bool = Field(default=True, description="Preserve code blocks")


class UpdateEmbeddingConfigRequest(BaseModel):
    """Request model for embedding configuration"""
    model: str = Field(default="all-MiniLM-L6-v2", description="Embedding model")
    device: str = Field(default="cpu", description="Device (cpu or cuda)")
    batch_size: int = Field(default=32, ge=1, le=128, description="Batch size")
    normalize_embeddings: bool = Field(default=True, description="Normalize embeddings")


class UpdateVectorStoreConfigRequest(BaseModel):
    """Request model for vector store configuration"""
    provider: str = Field(
        default="qdrant",
        description="Vector store provider",
        pattern="^(qdrant|faiss|weaviate|milvus|pinecone|redis|chroma|elasticsearch)$"
    )
    connection_config: Dict[str, Any] = Field(
        default_factory=dict,
        description="Provider-specific connection configuration"
    )
    metadata_config: Dict[str, Any] = Field(
        default_factory=lambda: {
            "store_full_content": True,
            "indexed_fields": ["document_id", "page_number", "content_type"],
            "filterable_fields": ["document_id", "created_at", "workspace_id"]
        },
        description="Metadata storage and indexing configuration"
    )
    performance_config: Dict[str, Any] = Field(
        default_factory=lambda: {
            "cache_enabled": True,
            "cache_ttl": 3600,
            "batch_upsert": True,
            "batch_size": 100
        },
        description="Performance optimization settings"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "provider": "qdrant",
                "connection_config": {
                    "url": "http://localhost:6333",
                    "api_key": None,
                    "collection_name": "kb_{kb_id}",
                    "timeout": 30
                },
                "metadata_config": {
                    "store_full_content": True,
                    "indexed_fields": ["document_id", "page_number", "content_type"],
                    "filterable_fields": ["document_id", "created_at", "workspace_id"]
                },
                "performance_config": {
                    "cache_enabled": True,
                    "cache_ttl": 3600,
                    "batch_upsert": True,
                    "batch_size": 100
                }
            }
        }




# ========================================
# PHASE 1: DRAFT MODE ENDPOINTS (Redis Only)
# ========================================

@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_kb_draft(
    request: CreateKBDraftRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create new KB draft in Redis (Phase 1).

    PHASE: 1 (Draft Mode - Redis Only)
    DURATION: <50ms
    DATABASE: No writes to PostgreSQL

    Returns:
        {
            "draft_id": str,
            "workspace_id": str,
            "expires_at": str,
            "message": str
        }
    """

    # Validate workspace exists
    workspace = db.query(Workspace).filter(
        Workspace.id == request.workspace_id
    ).first()

    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found"
        )

    # TODO: Add workspace membership check via RBAC service

    # Create draft in Redis
    draft_id = draft_service.create_draft(
        draft_type=DraftType.KB,
        workspace_id=request.workspace_id,
        created_by=current_user.id,
        initial_data={
            "name": request.name,
            "description": request.description,
            "context": request.context,
            "sources": [],
            "chunking_config": {
                "strategy": "by_heading",
                "chunk_size": 1000,
                "chunk_overlap": 200,
                "preserve_code_blocks": True
            },
            "embedding_config": {
                "model": "all-MiniLM-L6-v2",
                "device": "cpu",
                "batch_size": 32,
                "normalize_embeddings": True
            }
        }
    )

    draft = draft_service.get_draft(DraftType.KB, draft_id)

    return {
        "draft_id": draft_id,
        "workspace_id": str(request.workspace_id),
        "expires_at": draft["expires_at"],
        "message": "KB draft created successfully (stored in Redis, no database writes)"
    }


@router.get("/{draft_id}")
async def get_kb_draft(
    draft_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Get KB draft from Redis.

    PHASE: 1 (Draft Mode - Redis Only)
    DURATION: <10ms

    Returns:
        Full draft data from Redis
    """

    draft = draft_service.get_draft(DraftType.KB, draft_id)

    if not draft:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="KB draft not found or expired"
        )

    # Verify user owns this draft
    if draft["created_by"] != str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    return draft


@router.post("/{draft_id}/sources/web")
async def add_web_source_to_draft(
    draft_id: str,
    request: AddWebSourceRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Add web URL(s) to KB draft - Unified endpoint supporting both single and bulk operations.

    PHASE: 1 (Draft Mode - Redis Only)
    DURATION: <50ms for single URL, <200ms for up to 50 URLs
    DATABASE: No writes to PostgreSQL

    UNIFIED FUNCTIONALITY:
    - Single URL: Provide 'url' field with optional 'config'
    - Bulk URLs: Provide 'urls' field with shared 'config' and optional 'per_url_configs'
    - All 25+ configuration options available for any operation
    - Advanced crawl configuration, URL filtering, performance tuning
    - JavaScript handling, content filtering, output format control

    Returns (Single URL):
        {
            "source_id": str,
            "message": str
        }

    Returns (Bulk URLs):
        {
            "sources_added": int,
            "source_ids": List[str],
            "duplicates_skipped": int,
            "invalid_urls": List[dict],
            "message": str
        }
    """

    # Verify draft exists and user owns it
    draft = draft_service.get_draft(DraftType.KB, draft_id)

    if not draft:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="KB draft not found or expired"
        )

    if draft["created_by"] != str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    try:
        # Handle single URL operation
        if request.url:
            source_id = kb_draft_service.add_web_source_to_draft(
                draft_id=draft_id,
                url=request.url,
                config=request.config
            )

            return {
                "source_id": source_id,
                "message": "Web source added to draft (not saved to database yet)"
            }

        # Handle bulk URLs operation
        elif request.urls:
            # Convert unified request format to bulk format expected by service
            sources = []
            for url in request.urls:
                source_config = request.config.copy() if request.config else {}
                # Apply per-URL config overrides if provided
                if request.per_url_configs and url in request.per_url_configs:
                    source_config.update(request.per_url_configs[url])

                sources.append({
                    "url": url,
                    "config": source_config
                })

            results = kb_draft_service.add_bulk_web_sources_to_draft(
                draft_id=draft_id,
                sources=sources,
                shared_config=request.config
            )

            return {
                "sources_added": results["sources_added"],
                "source_ids": results["source_ids"],
                "duplicates_skipped": results["duplicates_skipped"],
                "invalid_urls": results["invalid_urls"],
                "message": f"Added {results['sources_added']} web sources to draft"
            }

        else:
            # This should not happen due to model validation, but just in case
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Either 'url' or 'urls' must be provided"
            )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/{draft_id}/sources/file")
async def add_file_source_to_draft(
    draft_id: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """
    Add file upload to KB draft with Tika parsing.

    PHASE: 1 (Draft Mode - Redis Only)
    DURATION: 1-5 seconds (depends on file size and complexity)
    DATABASE: No writes to PostgreSQL

    SUPPORTED FORMATS:
    - Documents: PDF, DOCX, DOC, ODT, RTF
    - Spreadsheets: XLSX, XLS, ODS, CSV
    - Presentations: PPTX, PPT, ODP
    - Text: TXT, MD, JSON, XML, HTML
    - Images: PNG, JPG (with OCR if enabled)

    ARCHITECTURE:
    - Parse file with Apache Tika (Docker service)
    - Extract text content and metadata
    - Store in Redis draft (24hr TTL)
    - Content goes ONLY to Qdrant (not PostgreSQL)
    - PostgreSQL stores ONLY metadata

    Args:
        draft_id: KB draft ID
        file: Uploaded file (multipart/form-data)

    Returns:
        {
            "source_id": str,
            "filename": str,
            "file_size": int,
            "mime_type": str,
            "page_count": int,
            "char_count": int,
            "word_count": int,
            "parsing_time_ms": int,
            "message": str
        }

    Raises:
        400: Invalid file or parsing failed
        403: Access denied
        404: Draft not found
        413: File too large (>50MB)
    """

    # Verify draft exists and user owns it
    draft = draft_service.get_draft(DraftType.KB, draft_id)

    if not draft:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="KB draft not found or expired"
        )

    if draft["created_by"] != str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    # Validate file
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Filename is required"
        )

    # Read file content
    file_content = await file.read()
    file_size = len(file_content)

    # Check file size (50MB limit)
    max_size = 50 * 1024 * 1024  # 50MB
    if file_size > max_size:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large: {file_size / 1024 / 1024:.1f} MB (max: 50 MB)"
        )

    # Check if file is empty
    if file_size == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File is empty"
        )

    try:
        # Parse file with Tika
        file_stream = BytesIO(file_content)

        result = await kb_draft_service.add_file_source_to_draft(
            draft_id=draft_id,
            file_stream=file_stream,
            filename=file.filename,
            file_size=file_size,
            mime_type=file.content_type or "application/octet-stream",
            raw_bytes=file_content,
        )

        return {
            **result,
            "message": "File parsed and added to draft (not saved to database yet)"
        }

    except ConnectionError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Tika service unavailable. Please ensure Tika Docker container is running."
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

    except RuntimeError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"File parsing failed: {str(e)}"
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error: {str(e)}"
        )


@router.post("/{draft_id}/sources/files/bulk")
async def add_bulk_file_sources_to_draft(
    draft_id: str,
    files: List[UploadFile] = File(...),
    current_user: User = Depends(get_current_user)
):
    """
    Add multiple file uploads to KB draft in batch.

    PHASE: 1 (Draft Mode - Redis Only)
    DURATION: 2-15 seconds (depends on file count and sizes)
    DATABASE: No writes to PostgreSQL

    Args:
        draft_id: KB draft ID
        files: List of uploaded files (multipart/form-data)

    Returns:
        {
            "sources_added": int,
            "source_ids": List[str],
            "total_chars": int,
            "total_pages": int,
            "failed_files": List[dict],
            "message": str
        }

    Raises:
        400: Invalid files or parsing failed
        403: Access denied
        404: Draft not found
        413: Files too large
    """

    # Verify draft exists and user owns it
    draft = draft_service.get_draft(DraftType.KB, draft_id)

    if not draft:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="KB draft not found or expired"
        )

    if draft["created_by"] != str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    # Validate files
    if not files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one file is required"
        )

    if len(files) > 20:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Maximum 20 files allowed in bulk upload"
        )

    # Prepare file streams
    file_tuples = []
    max_size = 50 * 1024 * 1024  # 50MB per file

    for file in files:
        file_content = await file.read()
        file_size = len(file_content)

        if file_size > max_size:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File {file.filename} too large: {file_size / 1024 / 1024:.1f} MB (max: 50 MB)"
            )

        if file_size == 0:
            continue  # Skip empty files

        file_stream = BytesIO(file_content)
        file_tuples.append((
            file_stream,
            file.filename,
            file_size,
            file.content_type or "application/octet-stream"
        ))

    if not file_tuples:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No valid files to process"
        )

    try:
        # Parse all files
        result = await kb_draft_service.add_bulk_file_sources_to_draft(
            draft_id=draft_id,
            files=file_tuples
        )

        return {
            **result,
            "message": f"Parsed and added {result['sources_added']} files to draft"
        }

    except ConnectionError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Tika service unavailable. Please ensure Tika Docker container is running."
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error: {str(e)}"
        )


@router.delete("/{draft_id}")
async def delete_draft(
    draft_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Delete KB draft from Redis.

    PHASE: 1 (Draft Mode - Redis Only)
    DURATION: <10ms

    Permanently removes the draft and all its data.
    """
    try:
        # Get draft to verify it exists and user owns it
        draft = draft_service.get_draft(DraftType.KB, draft_id)
        if not draft:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="KB draft not found or expired"
            )

        if draft["created_by"] != str(current_user.id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )

        # Delete the draft
        draft_service.delete_draft(DraftType.KB, draft_id)

        return {
            "success": True,
            "message": "Draft deleted successfully",
            "draft_id": draft_id
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete draft: {str(e)}"
        )


@router.delete("/{draft_id}/sources/{source_id}")
async def remove_source_from_draft(
    draft_id: str,
    source_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Remove source from KB draft.

    PHASE: 1 (Draft Mode - Redis Only)
    DURATION: <50ms

    Returns:
        {
            "message": str
        }
    """

    # Verify draft exists and user owns it
    draft = draft_service.get_draft(DraftType.KB, draft_id)

    if not draft:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="KB draft not found or expired"
        )

    if draft["created_by"] != str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    # Remove source
    try:
        removed = kb_draft_service.remove_source_from_draft(
            draft_id=draft_id,
            source_id=source_id
        )

        if removed:
            return {"message": "Source removed from draft"}
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Source not found in draft"
            )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/{draft_id}/preview-chunks-live")
async def preview_chunks_live(
    draft_id: str,
    request: dict,
    current_user: User = Depends(get_current_user)
):
    """
    Live preview of chunking for approved content.

    WHY: Users need to see exactly how their content will be chunked
    HOW: Apply chunking strategy to specific source content

    PREVIEW PARITY: This endpoint uses the SAME chunking logic as production
    (smart_kb_service) to ensure preview shows EXACTLY what will be stored.

    Request:
    {
        "source_id": "uuid",
        "content": "approved content text",
        "strategy": "by_heading",
        "chunk_size": 1000,
        "chunk_overlap": 200,
        "custom_separators": ["\\n\\n", ".", "!"],  // Optional: for custom strategy
        "enable_enhanced_metadata": false,  // NEW: Enable rich metadata (context, headings)
        "include_metrics": true
    }

    Returns (standard):
    {
        "chunks": [{"content": "...", "index": 0, ...}],
        "metrics": {...}
    }

    Returns (enhanced, when enable_enhanced_metadata=true):
    {
        "chunks": [{
            "content": "...",
            "index": 0,
            "context_before": "...",  // Text from previous chunk
            "context_after": "...",   // Text from next chunk
            "parent_heading": "...",  // Heading containing this chunk
            "metadata": {
                "document_analysis": {...},  // Full structure analysis
                "strategy_used": "by_heading",
                "chunk_index": 0,
                "total_chunks": 5
            }
        }],
        "metrics": {...}
    }
    """
    from app.services.chunking_service import chunking_service
    from app.services.enhanced_chunking_service import enhanced_chunking_service, EnhancedChunkConfig
    from app.services.smart_kb_service import smart_kb_service

    # Validate draft exists
    draft = draft_service.get_draft(DraftType.KB, draft_id)
    if not draft:
        raise HTTPException(
            status_code=404,
            detail="KB draft not found"
        )

    # Extract parameters from request
    content = request.get("content", "")
    custom_separators = request.get("custom_separators", None)  # For custom strategy
    include_metrics = request.get("include_metrics", False)
    max_chunks = request.get("max_chunks", None)  # Allow frontend to control chunk limit
    enable_enhanced_metadata = request.get("enable_enhanced_metadata", False)

    # CONTENT SIZE VALIDATION: Prevent timeout on large content
    # 500KB limit prevents Traefik timeouts on CPU-intensive chunking operations
    MAX_PREVIEW_CONTENT_SIZE = 500_000  # 500KB limit
    if len(content) > MAX_PREVIEW_CONTENT_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Content too large for preview ({len(content):,} chars). Maximum: {MAX_PREVIEW_CONTENT_SIZE:,} chars. Consider using fewer sources or smaller pages."
        )

    # CRITICAL: Normalize content to match pipeline processing
    # This ensures preview chunk count matches what gets stored in database
    import re

    def normalize_content(text: str) -> str:
        """Normalize content by removing excessive whitespace and blank lines."""
        if not text:
            return ""
        # Strip leading/trailing whitespace
        text = text.strip()
        # Replace 3+ consecutive newlines with 2
        text = re.sub(r'\n{3,}', '\n\n', text)
        return text

    content = normalize_content(content)

    # Get draft context for adaptive logic ("chatbots", "chatflows", or "both")
    draft_context = draft.get("context", "both")
    source_title = request.get("title", draft.get("name", "Untitled"))

    # Build user config from request (only include values explicitly provided)
    user_config = {}
    if "strategy" in request:
        user_config["strategy"] = request["strategy"]
    if "chunk_size" in request:
        user_config["chunk_size"] = request["chunk_size"]
    if "chunk_overlap" in request:
        user_config["chunk_overlap"] = request["chunk_overlap"]

    # PREVIEW PARITY FIX: Use smart_kb_service.make_chunking_decision_for_preview()
    # This ensures preview uses the SAME adaptive logic as production
    chunking_decision = smart_kb_service.make_chunking_decision_for_preview(
        content=content,
        title=source_title,
        user_config=user_config,
        draft_context=draft_context
    )

    # Extract final values from decision (these match what production will use)
    strategy = chunking_decision.strategy
    chunk_size = chunking_decision.chunk_size
    chunk_overlap = chunking_decision.chunk_overlap

    print(f"[PREVIEW PARITY] Using: strategy={strategy}, size={chunk_size}, overlap={chunk_overlap}")
    print(f"[PREVIEW PARITY] Reasoning: {chunking_decision.reasoning}")

    # Special handling for "no_chunking" strategies
    if strategy in ("full_content", "no_chunking"):
        # Return content as single chunk
        chunks = [{
            "content": content,
            "index": 0,
            "token_count": len(content) // 4,  # Rough estimate
            "char_count": len(content),
            "has_overlap": False
        }]

        metrics = {
            "total_chunks": 1,
            "avg_chunk_size": len(content),
            "min_chunk_size": len(content),
            "max_chunk_size": len(content),
            "total_tokens": len(content) // 4,
            "overlap_percentage": 0,
            "estimated_cost": (len(content) // 4) * 0.0001,  # Rough cost estimate
            "retrieval_speed": "fast" if len(content) < 2000 else "moderate",
            "context_quality": "high"  # Full context always high
        }
    else:
        # Use chunking with values from smart_kb_service decision (PARITY WITH PRODUCTION)
        if enable_enhanced_metadata:
            # Use enhanced_chunking_service (same as production when flag=true)
            enhanced_config = EnhancedChunkConfig(
                strategy=strategy,
                chunk_size=chunk_size,
                chunk_overlap=chunk_overlap,
                include_context=True,
                include_metadata=True,
                analyze_structure=True
            )
            enhanced_chunks = enhanced_chunking_service.chunk_document_enhanced(content, enhanced_config)
            chunks_raw = [chunk.to_dict() for chunk in enhanced_chunks]
        else:
            # Use standard chunking_service (same as production when flag=false)
            chunks_raw = chunking_service.chunk_document(
                text=content,
                strategy=strategy,
                chunk_size=chunk_size,
                chunk_overlap=chunk_overlap,
                separators=custom_separators  # Pass custom separators for custom strategy
            )

        # Format chunks for frontend
        chunks = []
        for i, chunk in enumerate(chunks_raw):
            has_overlap = i > 0 and chunk_overlap > 0
            overlap_content = None

            if has_overlap and i > 0:
                # Extract overlap portion from previous chunk
                prev_chunk = chunks_raw[i-1]["content"]
                overlap_start = max(0, len(prev_chunk) - chunk_overlap)
                overlap_content = prev_chunk[overlap_start:][:50] + "..."  # Show first 50 chars

            # Build chunk output - include enhanced metadata when available
            chunk_output = {
                "content": chunk["content"],
                "index": i,
                "token_count": chunk.get("token_count", len(chunk["content"]) // 4),
                "char_count": len(chunk["content"]),
                "has_overlap": has_overlap,
                "overlap_content": overlap_content
            }

            # Include enhanced metadata if available (production parity)
            if enable_enhanced_metadata and "metadata" in chunk:
                chunk_output["metadata"] = chunk["metadata"]
                # Also expose key fields at top level for easy frontend access
                if chunk["metadata"].get("context_before"):
                    chunk_output["context_before"] = chunk["metadata"]["context_before"]
                if chunk["metadata"].get("context_after"):
                    chunk_output["context_after"] = chunk["metadata"]["context_after"]
                if chunk["metadata"].get("parent_heading"):
                    chunk_output["parent_heading"] = chunk["metadata"]["parent_heading"]

            chunks.append(chunk_output)

        # Calculate metrics
        if include_metrics and chunks:
            chunk_sizes = [c["char_count"] for c in chunks]
            total_tokens = sum(c["token_count"] for c in chunks)

            # Calculate overlap percentage
            total_content_len = len(content)
            total_chunk_len = sum(chunk_sizes)
            overlap_pct = ((total_chunk_len - total_content_len) / total_content_len * 100) if total_content_len > 0 else 0

            # Determine retrieval speed based on chunk count
            if len(chunks) < 10:
                retrieval_speed = "fast"
            elif len(chunks) < 50:
                retrieval_speed = "moderate"
            else:
                retrieval_speed = "slow"

            # Determine context quality based on chunk size
            avg_size = sum(chunk_sizes) / len(chunk_sizes)
            if avg_size < 300:
                context_quality = "low"
            elif avg_size < 800:
                context_quality = "medium"
            else:
                context_quality = "high"

            metrics = {
                "total_chunks": len(chunks),
                "avg_chunk_size": avg_size,
                "min_chunk_size": min(chunk_sizes),
                "max_chunk_size": max(chunk_sizes),
                "total_tokens": total_tokens,
                "overlap_percentage": max(0, min(100, overlap_pct)),
                "estimated_cost": total_tokens * 0.0001,  # Rough embedding cost estimate
                "retrieval_speed": retrieval_speed,
                "context_quality": context_quality
            }
        else:
            metrics = {}

    # Smart performance optimization: Default to 20 chunks, allow expansion on request
    if max_chunks is None:
        # Default to 20 chunks for performance, but users can request more
        chunk_limit = min(20, len(chunks))
    else:
        # User explicitly requested a specific limit (e.g., "Show All")
        chunk_limit = max_chunks

    preview_chunks = chunks[:chunk_limit]

    return {
        "chunks": preview_chunks,
        "metrics": metrics,
        "total_chunks": len(chunks),
        "preview_limited": len(chunks) > chunk_limit,
        "chunks_shown": len(preview_chunks),
        # NEW: Include chunking decision metadata for transparency
        "chunking_decision": {
            "strategy": chunking_decision.strategy,
            "chunk_size": chunking_decision.chunk_size,
            "chunk_overlap": chunking_decision.chunk_overlap,
            "user_preference": chunking_decision.user_preference,
            "adaptive_suggestion": chunking_decision.adaptive_suggestion,
            "reasoning": chunking_decision.reasoning
        }
    }


@router.post("/{draft_id}/chunking")
async def update_chunking_config(
    draft_id: str,
    request: UpdateChunkingConfigRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Update chunking configuration for KB draft.

    PHASE: 1 (Draft Mode - Redis Only)
    DURATION: <50ms

    Returns:
        {
            "message": str
        }
    """

    # Verify draft exists and user owns it
    draft = draft_service.get_draft(DraftType.KB, draft_id)

    if not draft:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="KB draft not found or expired"
        )

    if draft["created_by"] != str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    # DEBUG: Log what we received from frontend

    # Update chunking config
    try:
        config_dict = request.dict()

        kb_draft_service.update_chunking_config(
            draft_id=draft_id,
            chunking_config=config_dict
        )

        return {"message": "Chunking configuration updated"}

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/{draft_id}/embedding")
async def update_embedding_config(
    draft_id: str,
    request: UpdateEmbeddingConfigRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Update embedding configuration for KB draft.

    PHASE: 1 (Draft Mode - Redis Only)
    DURATION: <50ms

    NOTE: Always uses local sentence-transformers for privacy.

    Returns:
        {
            "message": str
        }
    """

    # Verify draft exists and user owns it
    draft = draft_service.get_draft(DraftType.KB, draft_id)

    if not draft:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="KB draft not found or expired"
        )

    if draft["created_by"] != str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    # Update embedding config
    try:
        kb_draft_service.update_embedding_config(
            draft_id=draft_id,
            embedding_config=request.dict()
        )

        return {"message": "Embedding configuration updated"}

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/{draft_id}/vector-store")
async def update_vector_store_config(
    draft_id: str,
    request: UpdateVectorStoreConfigRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Update vector store configuration for KB draft.

    PHASE: 1 (Draft Mode - Redis Only)
    DURATION: <50ms

    Allows users to choose their preferred vector store provider:
    - qdrant: Self-hosted, excellent filtering (default)
    - faiss: Local file-based, free, good for small datasets
    - weaviate: Cloud/self-hosted, good for hybrid search
    - milvus: Production-scale, cloud/self-hosted
    - pinecone: Managed cloud, expensive but easy
    - redis: In-memory with RediSearch
    - chroma: Simple development-friendly
    - elasticsearch: Full-text + vector search

    Returns:
        {
            "message": str,
            "provider": str,
            "validation": dict
        }
    """

    # Verify draft exists and user owns it
    draft = draft_service.get_draft(DraftType.KB, draft_id)

    if not draft:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="KB draft not found or expired"
        )

    if draft["created_by"] != str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    # Validate provider and connection config
    try:
        # Basic validation
        provider = request.provider

        # Provider-specific validation
        validation_result = _validate_vector_store_config(provider, request.connection_config)

        if not validation_result["is_valid"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid vector store configuration: {validation_result['errors']}"
            )

        # Update vector store config in draft
        vector_store_config = {
            "provider": provider,
            "connection": request.connection_config,
            "metadata_config": request.metadata_config,
            "performance": request.performance_config
        }

        # Get current draft and update
        draft["vector_store_config"] = vector_store_config
        draft["updated_at"] = datetime.utcnow().isoformat()

        # Save back to Redis
        import json
        redis_key = f"draft:kb:{draft_id}"
        draft_service.redis_client.setex(
            redis_key,
            draft_service.default_ttl,
            json.dumps(draft, default=str)
        )

        return {
            "message": f"Vector store configuration updated to {provider}",
            "provider": provider,
            "validation": validation_result
        }

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )



@router.get("/{draft_id}/validate")
async def validate_kb_draft(
    draft_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Validate KB draft before finalization.

    PHASE: 1 (Draft Mode - Redis Only)
    DURATION: <50ms

    Returns:
        {
            "is_valid": bool,
            "errors": List[str],
            "warnings": List[str],
            "estimated_duration": int,
            "total_sources": int,
            "estimated_pages": int
        }
    """

    # Verify draft exists and user owns it
    draft = draft_service.get_draft(DraftType.KB, draft_id)

    if not draft:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="KB draft not found or expired"
        )

    if draft["created_by"] != str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    # Validate draft
    try:
        validation = kb_draft_service.validate_draft(draft_id)
        return validation

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


# ========================================
# CHUNKING PREVIEW ENDPOINT (Non-blocking)
# ========================================

class ChunkingPreviewRequest(BaseModel):
    """Request model for chunking preview"""
    url: str = Field(..., description="Web URL to preview")
    strategy: str = Field(default="by_heading", description="Chunking strategy")
    chunk_size: int = Field(default=1000, ge=100, le=5000)
    chunk_overlap: int = Field(default=200, ge=0, le=1000)
    max_preview_chunks: int = Field(default=10, ge=1, le=20, description="Max chunks to show in preview")


@router.post("/preview")
async def preview_chunking(
    request: ChunkingPreviewRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Preview chunking strategy for a URL without creating KB.

    WHY: Give users clear picture of how content will be chunked
    HOW: Non-blocking preview using dedicated preview service

    PHASE: Pre-Draft (Exploratory)
    DURATION: 2-10 seconds (fetches URL content)
    NON-BLOCKING: Does not interfere with main pipeline

    OPTIMIZED FOR: GitBook, GitHub Docs, Notion, documentation sites

    Returns:
        {
            "url": str,
            "title": str,
            "strategy": str,
            "config": {...},
            "preview_chunks": [...]  # First N chunks with previews,
            "total_chunks_estimated": int,
            "document_stats": {...},
            "strategy_recommendation": str,
            "optimized_for": str  # gitbook, github, notion, etc.
        }
    """

    from app.services.preview_service import preview_service

    try:
        preview_data = await preview_service.preview_chunking_for_url(
            url=request.url,
            strategy=request.strategy,
            chunk_size=request.chunk_size,
            chunk_overlap=request.chunk_overlap,
            max_preview_chunks=request.max_preview_chunks
        )

        if "error" in preview_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=preview_data.get("message", "Preview generation failed")
            )

        return preview_data

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Preview generation failed: {str(e)}"
        )


class DraftPreviewRequest(BaseModel):
    """Request model for draft-based realistic preview"""
    strategy: Optional[str] = Field(None, description="Chunking strategy (overrides draft config if provided)")
    chunk_size: Optional[int] = Field(None, ge=100, le=5000, description="Chunk size (overrides draft config)")
    chunk_overlap: Optional[int] = Field(None, ge=0, le=1000, description="Chunk overlap (overrides draft config)")
    max_preview_pages: int = Field(default=100, ge=1, description="Max pages to crawl for preview")


@router.post("/{draft_id}/preview")
async def preview_draft_chunking(
    draft_id: str,
    request: DraftPreviewRequest = DraftPreviewRequest(),
    current_user: User = Depends(get_current_user)
):
    """
    Generate realistic multi-page preview using draft's crawl configuration.

    WHY: Users want to see realistic preview before finalizing KB
    HOW: Use draft's URLs and crawl config to crawl multiple pages

    TYPE: Draft Preview (Realistic Multi-Page)
    DURATION: 10-30 seconds (crawls multiple pages)
    NON-BLOCKING: Does not interfere with main pipeline

    USE CASE:
    - Draft created with URLs and crawl config
    - Want to see how multiple pages will be chunked
    - Before finalizing the KB
    - Need realistic representation

    Returns:
        {
            "draft_id": str,
            "pages_previewed": int,
            "total_chunks": int,
            "strategy": str,
            "config": {...},
            "pages": [
                {
                    "url": str,
                    "title": str,
                    "chunks": int,
                    "preview_chunks": [...]
                }
            ],
            "estimated_total_chunks": int,
            "crawl_config": {...},
            "note": str
        }
    """

    from app.services.preview_service import preview_service

    # Verify draft exists and user owns it
    draft = draft_service.get_draft(DraftType.KB, draft_id)

    if not draft:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="KB draft not found or expired"
        )

    if draft["created_by"] != str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    try:
        preview_data = await preview_service.preview_chunking_for_draft(
            draft_id=draft_id,
            strategy=request.strategy,
            chunk_size=request.chunk_size,
            chunk_overlap=request.chunk_overlap,
            max_preview_pages=request.max_preview_pages
        )

        if "error" in preview_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=preview_data.get("message", "Preview generation failed")
            )

        # Store preview data back to draft for inspection endpoints
        # Get the current draft and manually add preview_data
        draft = draft_service.get_draft(DraftType.KB, draft_id)
        if draft:
            draft["preview_data"] = {
                "pages": preview_data.get("pages", []),
                "generated_at": datetime.utcnow().isoformat(),
                "config": preview_data.get("config", {}),
                "stats": {
                    "pages_previewed": preview_data.get("pages_previewed", 0),
                    "total_chunks": preview_data.get("total_chunks", 0),
                    "strategy": preview_data.get("strategy", "")
                }
            }
            # Update timestamps and save directly to Redis
            draft["updated_at"] = datetime.utcnow().isoformat()

            import json
            redis_key = f"draft:kb:{draft_id}"
            draft_service.redis_client.setex(
                redis_key,
                draft_service.default_ttl,
                json.dumps(draft)
            )

        return preview_data

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Preview generation failed: {str(e)}"
        )


@router.put("/{draft_id}/preview-data")
async def update_draft_preview_data(
    draft_id: str,
    preview_data: Dict[str, Any] = Body(...),
    current_user: User = Depends(get_current_user)
):
    """
    Update draft preview data with edited content.

    WHY: Save frontend edits back to backend draft for finalization
    HOW: Update preview_data in Redis draft

    PHASE: 1 (Draft Mode - Redis Only)

    Args:
        draft_id: KB draft ID
        preview_data: Updated preview data (including edited pages)

    Returns:
        Success confirmation
    """
    try:
        # Get draft to verify it exists and user has access
        draft = draft_service.get_draft(DraftType.KB, draft_id)
        if not draft:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="KB draft not found"
            )

        # DEBUG: Log what we're receiving and storing
        pages_count = len(preview_data.get("pages", []))
        approved_count = len([p for p in preview_data.get("pages", []) if p.get("is_approved", False)])
        print(f"🔄 UPDATE_PREVIEW_DATA: draft={draft_id}, pages={pages_count}, approved={approved_count}")

        # Update preview_data in draft
        draft_service.update_draft(
            draft_type=DraftType.KB,
            draft_id=draft_id,
            updates={"preview_data": preview_data}
        )

        # CRITICAL FIX: Distribute pages from global preview_data to source-specific metadata
        # WHY: Approval endpoint expects pages in source.metadata.previewPages, not global preview_data.pages
        updated_draft = draft_service.get_draft(DraftType.KB, draft_id)
        sources = updated_draft.get("data", {}).get("sources", [])
        pages = preview_data.get("pages", [])

        # DEBUG: Log distribution prerequisites
        print(f"🔍 DISTRIBUTION_CHECK: sources_count={len(sources)}, pages_count={len(pages)}")
        if sources:
            for i, source in enumerate(sources):
                print(f"  Source {i}: id={source.get('id')}, type={source.get('type')}")
        if pages:
            for i, page in enumerate(pages[:2]):  # Show first 2 pages
                print(f"  Page {i}: source_id={page.get('source_id')}, title={page.get('title', 'No title')[:50]}")

        if sources and pages:
            print(f"📥 DISTRIBUTING PAGES: {len(pages)} pages to {len(sources)} sources")

            # Group pages by source_id
            pages_by_source = {}
            for page in pages:
                source_id = page.get("source_id")
                if source_id:
                    if source_id not in pages_by_source:
                        pages_by_source[source_id] = []
                    pages_by_source[source_id].append(page)

            # Update each source's metadata with its pages
            sources_updated = False
            for i, source in enumerate(sources):
                source_id = source.get("id")
                if source_id in pages_by_source:
                    source_pages = pages_by_source[source_id]

                    # Ensure metadata exists
                    if "metadata" not in source:
                        source["metadata"] = {}

                    # Store pages in source metadata for approval endpoint
                    source["metadata"]["previewPages"] = source_pages
                    source["metadata"]["pageCount"] = len(source_pages)
                    source["metadata"]["lastUpdatedAt"] = datetime.utcnow().isoformat()

                    sources[i] = source
                    sources_updated = True
                    print(f"  ✅ Source {source_id}: distributed {len(source_pages)} pages")

            # Save updated sources back to draft
            if sources_updated:
                draft_data = updated_draft.get("data", {})
                draft_data["sources"] = sources
                draft_service.update_draft(
                    draft_type=DraftType.KB,
                    draft_id=draft_id,
                    updates={"data": draft_data}
                )
                print(f"💾 SOURCES UPDATED: Pages now available for approval in source metadata")

        # DEBUG: Verify what was actually stored
        updated_draft = draft_service.get_draft(DraftType.KB, draft_id)
        stored_pages = updated_draft.get("preview_data", {}).get("pages", [])
        stored_approved = len([p for p in stored_pages if p.get("is_approved", False)])
        print(f"✅ STORED_VERIFICATION: draft={draft_id}, stored_pages={len(stored_pages)}, stored_approved={stored_approved}")

        return {
            "success": True,
            "message": "Preview data updated successfully",
            "draft_id": draft_id
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update preview data: {str(e)}"
        )


class ApproveContentRequest(BaseModel):
    """Request model for approving scraped content (legacy)"""
    page_indices: List[int] = Field(..., description="Page indices to approve and add to sources")
    source_name: Optional[str] = Field(None, description="Custom name for the approved source")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional metadata for the source")


class SourceApprovalRequest(BaseModel):
    """Request model for source-centric approval (modern approach)"""
    source_approvals: List[Dict[str, Any]] = Field(
        ...,
        description="List of source approval data with page indices and content updates"
    )


class PageUpdate(BaseModel):
    """Single page content update"""
    page_index: int = Field(..., description="Index of page within source")
    edited_content: Optional[str] = Field(None, description="User-edited content")
    is_edited: bool = Field(default=False, description="Whether page has been edited")


class SourceApproval(BaseModel):
    """Approval data for a single source"""
    source_id: str = Field(..., description="Source ID to approve")
    approved_page_indices: List[int] = Field(..., description="Page indices to approve within this source")
    page_updates: List[PageUpdate] = Field(default_factory=list, description="Content updates for pages")


@router.post("/{draft_id}/approve-content")
async def approve_and_add_to_sources(
    draft_id: str,
    request: ApproveContentRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Move approved pages from preview_data to sources.

    WHY: User approval step before chunking configuration
    HOW: Copy approved pages (edited + unedited) to sources array with final content

    PHASE: 1C (Content Approval)

    FLOW:
    1. Get approved pages from preview_data
    2. Create new source with approved content
    3. Add to draft sources array
    4. Keep original preview_data for reference

    Args:
        draft_id: KB draft ID
        request: Pages to approve and source metadata

    Returns:
        New source details and approval summary
    """
    try:
        # Get draft to verify it exists and user has access
        draft = draft_service.get_draft(DraftType.KB, draft_id)
        if not draft:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="KB draft not found"
            )

        # Get preview pages
        preview_data = draft.get("preview_data", {})
        pages = preview_data.get("pages", [])

        if not pages:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No preview pages found. Run preview first."
            )

        # Validate page indices
        invalid_indices = [idx for idx in request.page_indices if idx < 0 or idx >= len(pages)]
        if invalid_indices:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid page indices: {invalid_indices}. Valid range: 0-{len(pages)-1}"
            )

        # Collect approved pages with their final content (edited or original)
        approved_pages = []
        total_content_size = 0
        edited_count = 0

        for idx in request.page_indices:
            page = pages[idx]
            final_content = page.get("edited_content") or page.get("content", "")

            approved_page = {
                "index": idx,
                "url": page.get("url", ""),
                "title": page.get("title", f"Page {idx + 1}"),
                "content": final_content,
                "original_content": page.get("content", ""),
                "is_edited": page.get("is_edited", False),
                "word_count": len(final_content.split()),
                "char_count": len(final_content),
                "approved_at": datetime.utcnow().isoformat(),
                "approved_by": str(current_user.id)
            }

            approved_pages.append(approved_page)
            total_content_size += len(final_content)
            if page.get("is_edited"):
                edited_count += 1

        # Create new source with approved content
        source_id = str(uuid4())
        source_name = request.source_name or f"Approved Content ({len(approved_pages)} pages)"

        approved_source = {
            "id": source_id,
            "type": "approved_content",
            "name": source_name,
            "status": "approved",
            "approved_pages": approved_pages,
            "metadata": {
                **request.metadata,
                "total_pages": len(approved_pages),
                "total_content_size": total_content_size,
                "edited_pages": edited_count,
                "original_url": pages[0].get("url", "") if pages else "",
                "approval_source": "content_review"
            },
            "added_at": datetime.utcnow().isoformat(),
            "added_by": str(current_user.id)
        }

        # Add approved source to draft sources
        data = draft.get("data", {})
        sources = data.get("sources", [])
        sources.append(approved_source)
        data["sources"] = sources

        # Update draft
        draft_service.update_draft(
            draft_type=DraftType.KB,
            draft_id=draft_id,
            updates={"data": data}
        )

        return {
            "success": True,
            "message": f"Successfully approved and added {len(approved_pages)} pages to sources",
            "source_id": source_id,
            "source_name": source_name,
            "summary": {
                "total_pages_approved": len(approved_pages),
                "edited_pages": edited_count,
                "unedited_pages": len(approved_pages) - edited_count,
                "total_content_size": total_content_size,
                "average_page_size": total_content_size // len(approved_pages) if approved_pages else 0
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to approve content: {str(e)}"
        )


@router.post("/{draft_id}/approve-sources")
async def approve_sources_with_edits(
    draft_id: str,
    source_approvals: List[Dict[str, Any]] = Body(..., description="Source approval data"),
    current_user: User = Depends(get_current_user)
):
    """
    Modern source-centric approval endpoint.

    WHY: Preserves source structure and user edits within their original context
    HOW: Updates each source's metadata with approved pages and edits

    PHASE: 1C (Content Approval)

    BENEFITS:
    - Preserves source-specific edits
    - Maintains user intent (which edit belongs to which source)
    - Scalable for multiple sources
    - Clean data flow

    Args:
        draft_id: KB draft ID
        source_approvals: List of source approval data with edits

    Returns:
        Summary of approved sources and pages
    """
    try:
        # DEBUG: Log what frontend is sending
        print(f"🔄 APPROVE_SOURCES_REQUEST: draft={draft_id}, sources_count={len(source_approvals)}")
        for i, approval in enumerate(source_approvals):
            source_id = approval.get("source_id", "unknown")
            page_indices = approval.get("approved_page_indices", [])
            page_updates = approval.get("page_updates", [])
            print(f"  Source {i}: id={source_id}, approving_pages={page_indices}, updates_count={len(page_updates)}")

        if not source_approvals:
            print("⚠️ WARNING: source_approvals is empty - no sources to approve")

        # Get draft data
        draft = draft_service.get_draft(DraftType.KB, draft_id)
        if not draft:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Draft not found"
            )

        data = draft.get("data", {})
        sources = data.get("sources", [])

        # DEBUG: Log sources in draft
        print(f"📦 DRAFT SOURCES: {len(sources)} sources in draft")
        for i, s in enumerate(sources):
            src_id = s.get("id", "no-id")
            src_type = s.get("type", "unknown")
            has_preview_pages = len(s.get("preview_pages", [])) > 0
            has_metadata_preview = len(s.get("metadata", {}).get("previewPages", [])) > 0
            print(f"  Source {i}: id={src_id}, type={src_type}, has_preview_pages={has_preview_pages}, has_metadata_preview={has_metadata_preview}")

        if not sources:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No sources found in draft"
            )

        # Process each source approval
        total_approved_pages = 0
        total_edited_pages = 0
        updated_sources = []

        for approval_data in source_approvals:
            source_id = approval_data.get("source_id")
            approved_page_indices = approval_data.get("approved_page_indices", [])
            page_updates = approval_data.get("page_updates", [])

            print(f"\n🔍 PROCESSING: source_id={source_id}, page_indices={approved_page_indices}")

            # Find the source
            source_index = next((i for i, s in enumerate(sources) if s.get("id") == source_id), None)
            if source_index is None:
                print(f"  ❌ Source NOT FOUND in draft. Looking for id={source_id}")
                print(f"  📋 Available source ids: {[s.get('id') for s in sources]}")
                continue  # Skip if source not found

            print(f"  ✅ Found source at index {source_index}")

            source = sources[source_index]

            # Get source preview pages - handle both storage locations
            # Web sources: metadata.previewPages
            # File sources: preview_pages (direct on source object)
            source_metadata = source.get("metadata", {})
            preview_pages = source_metadata.get("previewPages", [])

            # CRITICAL FIX: For file uploads, preview_pages is stored directly on source
            if not preview_pages:
                preview_pages = source.get("preview_pages", [])
                print(f"  📁 Using direct preview_pages for file source: {len(preview_pages)} pages found")

            if not preview_pages:
                print(f"  ⚠️ No preview pages found for source {source_id}")
                continue  # Skip if no preview pages

            # Update pages with edits and approval status
            print(f"  📄 Processing {len(approved_page_indices)} page indices: {approved_page_indices}")
            print(f"  📋 Preview pages available: {len(preview_pages)}")

            for page_idx in approved_page_indices:
                print(f"    🔎 Checking page index {page_idx}...")
                if page_idx < len(preview_pages):
                    page = preview_pages[page_idx]

                    # SMART DUPLICATE PREVENTION: Trust frontend edit detection
                    page_is_approved = page.get("is_approved", False)
                    has_page_updates = any(pu.get("page_index") == page_idx for pu in page_updates)

                    print(f"    📊 Page {page_idx}: is_approved={page_is_approved}, has_updates={has_page_updates}")

                    # Logic: If frontend is sending updates for this page, allow re-approval
                    if page_is_approved and has_page_updates:
                        # Clear approval status to allow re-approval
                        print(f"    🔄 Re-approving page {page_idx} (has updates)")
                        page["is_approved"] = False
                        page["approved_at"] = None
                        page["approved_by"] = None
                    elif page_is_approved:
                        print(f"    ⏭️ SKIPPING page {page_idx} - already approved, no updates")
                        continue  # Skip this page entirely

                    # Apply edits if provided
                    page_update = next((pu for pu in page_updates if pu.get("page_index") == page_idx), None)
                    if page_update:
                        if page_update.get("edited_content"):
                            page["edited_content"] = page_update["edited_content"]
                            page["original_content"] = page.get("content", "")
                            page["is_edited"] = True
                            total_edited_pages += 1
                        else:
                            page["is_edited"] = False

                    # Mark as approved (only if not already approved)
                    page["is_approved"] = True
                    page["approved_at"] = datetime.utcnow().isoformat()
                    page["approved_by"] = str(current_user.id)

                    total_approved_pages += 1

            # Update source metadata
            source_metadata["hasApprovedPages"] = True
            source_metadata["approvedPageCount"] = len([p for p in preview_pages if p.get("is_approved")])
            source_metadata["lastApprovalAt"] = datetime.utcnow().isoformat()

            source["metadata"] = source_metadata
            sources[source_index] = source
            updated_sources.append({
                "source_id": source_id,
                "source_name": source.get("url", f"Source {source_index + 1}"),
                "approved_pages": len([p for p in preview_pages if p.get("is_approved")]),
                "total_pages": len(preview_pages)
            })

        # Check if any pages were actually approved (not all duplicates)
        if total_approved_pages == 0:
            return {
                "success": False,
                "message": "No pages were approved - all selected pages were already approved previously",
                "summary": {
                    "total_sources_updated": 0,
                    "total_pages_approved": 0,
                    "total_edited_pages": 0,
                    "sources": [],
                    "duplicate_prevention_triggered": True
                }
            }

        # Update draft with modified sources
        data["sources"] = sources
        draft_service.update_draft(
            draft_type=DraftType.KB,
            draft_id=draft_id,
            updates={"data": data}
        )

        return {
            "success": True,
            "message": f"Successfully approved {total_approved_pages} pages from {len(updated_sources)} sources",
            "summary": {
                "total_sources_updated": len(updated_sources),
                "total_pages_approved": total_approved_pages,
                "total_edited_pages": total_edited_pages,
                "sources": updated_sources
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to approve sources: {str(e)}"
        )


class ChunkingConfigRequest(BaseModel):
    """Request model for chunking configuration with live preview"""
    strategy: str = Field(default="by_heading", description="Chunking strategy")
    chunk_size: int = Field(default=1000, ge=100, le=5000, description="Chunk size")
    chunk_overlap: int = Field(default=200, ge=0, le=1000, description="Chunk overlap")
    preserve_code_blocks: bool = Field(default=True, description="Preserve code blocks")
    source_id: Optional[str] = Field(None, description="Specific source to preview (None = all approved sources)")
    max_chunks_preview: int = Field(default=10, ge=1, le=50, description="Max chunks to show in preview")


@router.post("/{draft_id}/chunking-preview")
async def preview_chunking_on_approved_content(
    draft_id: str,
    request: ChunkingConfigRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Show chunking preview using approved content from sources.

    WHY: User needs to see how their final approved content will be chunked
    HOW: Apply chunking strategy to approved content from sources, return preview

    PHASE: 1D (Chunking Configuration)

    FLOW:
    1. Get approved sources from draft
    2. Apply chunking strategy to approved content
    3. Return chunk preview with statistics
    4. Save chunking config to draft

    Args:
        draft_id: KB draft ID
        request: Chunking configuration and preview settings

    Returns:
        Chunk preview with statistics and configuration
    """
    try:
        # Import chunking service here to avoid circular imports
        from app.services.chunking_service import chunking_service

        # Get draft to verify it exists and user has access
        draft = draft_service.get_draft(DraftType.KB, draft_id)
        if not draft:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="KB draft not found"
            )

        # Get approved sources
        data = draft.get("data", {})
        sources = data.get("sources", [])

        # Filter for approved sources only
        approved_sources = [s for s in sources if s.get("status") == "approved" and s.get("type") == "approved_content"]

        if not approved_sources:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No approved content sources found. Please approve content first."
            )

        # Filter by specific source if requested
        if request.source_id:
            approved_sources = [s for s in approved_sources if s.get("id") == request.source_id]
            if not approved_sources:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Approved source {request.source_id} not found"
                )

        # Prepare content for chunking
        all_content = []
        total_pages = 0

        for source in approved_sources:
            approved_pages = source.get("approved_pages", [])
            for page in approved_pages:
                content = page.get("content", "")
                if content.strip():
                    all_content.append({
                        "content": content,
                        "metadata": {
                            "source_id": source.get("id"),
                            "source_name": source.get("name"),
                            "page_title": page.get("title"),
                            "page_url": page.get("url"),
                            "page_index": page.get("index"),
                            "is_edited": page.get("is_edited", False),
                            "word_count": page.get("word_count", len(content.split())),
                            "char_count": page.get("char_count", len(content))
                        }
                    })
                    total_pages += 1

        if not all_content:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No content found in approved sources"
            )

        # Apply chunking strategy
        chunk_config = {
            "strategy": request.strategy,
            "chunk_size": request.chunk_size,
            "chunk_overlap": request.chunk_overlap,
            "preserve_code_blocks": request.preserve_code_blocks
        }

        all_chunks = []
        total_content_size = 0

        for content_item in all_content:
            content = content_item["content"]
            metadata = content_item["metadata"]
            total_content_size += len(content)

            # Apply chunking
            chunks = chunking_service.chunk_content(
                content=content,
                strategy=request.strategy,
                chunk_size=request.chunk_size,
                chunk_overlap=request.chunk_overlap,
                preserve_code_blocks=request.preserve_code_blocks
            )

            # Add metadata to each chunk
            for i, chunk in enumerate(chunks):
                chunk_with_metadata = {
                    "chunk_index": len(all_chunks) + i,
                    "content": chunk,
                    "size": len(chunk),
                    "word_count": len(chunk.split()),
                    "source_metadata": metadata,
                    "chunk_position_in_page": i,
                    "total_chunks_in_page": len(chunks)
                }
                all_chunks.append(chunk_with_metadata)

        # Limit chunks for preview
        preview_chunks = all_chunks[:request.max_chunks_preview]

        # Calculate statistics
        avg_chunk_size = sum(chunk["size"] for chunk in all_chunks) // len(all_chunks) if all_chunks else 0
        size_distribution = {
            "small": len([c for c in all_chunks if c["size"] < request.chunk_size * 0.7]),
            "medium": len([c for c in all_chunks if request.chunk_size * 0.7 <= c["size"] <= request.chunk_size * 1.3]),
            "large": len([c for c in all_chunks if c["size"] > request.chunk_size * 1.3])
        }

        # Save chunking config to draft
        data["chunking_config"] = chunk_config
        draft_service.update_draft(
            draft_type=DraftType.KB,
            draft_id=draft_id,
            updates={"data": data}
        )

        return {
            "success": True,
            "message": "Chunking preview generated successfully",
            "config": chunk_config,
            "preview_chunks": preview_chunks,
            "statistics": {
                "total_sources": len(approved_sources),
                "total_pages": total_pages,
                "total_content_size": total_content_size,
                "total_chunks": len(all_chunks),
                "preview_chunks_shown": len(preview_chunks),
                "average_chunk_size": avg_chunk_size,
                "size_distribution": size_distribution,
                "chunks_per_page": len(all_chunks) / total_pages if total_pages > 0 else 0
            },
            "source_breakdown": [
                {
                    "source_id": source.get("id"),
                    "source_name": source.get("name"),
                    "pages": len(source.get("approved_pages", [])),
                    "total_content_size": source.get("metadata", {}).get("total_content_size", 0)
                }
                for source in approved_sources
            ]
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate chunking preview: {str(e)}"
        )


class ModelConfigRequest(BaseModel):
    """Request model for embedding model and vector store configuration"""
    embedding_config: Dict[str, Any] = Field(
        default_factory=lambda: {
            "model": "all-MiniLM-L6-v2",
            "device": "cpu",
            "batch_size": 32,
            "normalize_embeddings": True
        },
        description="Embedding model configuration"
    )
    vector_store_config: Dict[str, Any] = Field(
        default_factory=lambda: {
            "provider": "qdrant",
            "collection_name_prefix": "kb",
            "distance_metric": "cosine",
            "enable_hybrid_search": False
        },
        description="Vector store configuration"
    )
    retrieval_config: Dict[str, Any] = Field(
        default_factory=lambda: {
            "strategy": "semantic_search",
            "top_k": 5,
            "score_threshold": 0.7,
            "rerank_enabled": False
        },
        description="Retrieval configuration"
    )
    metadata_config: Dict[str, Any] = Field(
        default_factory=lambda: {
            "store_full_content": True,
            "indexed_fields": ["document_id", "page_number", "content_type"],
            "filterable_fields": ["document_id", "created_at", "workspace_id"],
            "include_source_tracking": True
        },
        description="Metadata storage configuration"
    )


def _validate_and_fix_finalize_config(request: "KBFinalizeRequest") -> Dict[str, Any]:
    """
    Validate and fix finalize configuration to prevent invalid combinations.

    FIXES:
    1. no_chunking strategy: Override chunk_size/overlap with proper values
    2. Validate indexing_method is valid
    3. Ensure configurations make sense together

    Args:
        request: User's finalize request

    Returns:
        Dict with validated and corrected configuration

    Raises:
        HTTPException: If configuration is invalid
    """

    # Get the chunking config
    chunking_config = request.chunking_config.copy()
    strategy = chunking_config.get("strategy", "by_heading")

    # CRITICAL FIX: Handle no_chunking strategy properly
    if strategy in ("no_chunking", "full_content"):
        print(f"🔧 [VALIDATION] Detected no_chunking strategy: {strategy}")
        print(f"🔧 [VALIDATION] Original config: chunk_size={chunking_config.get('chunk_size')}, overlap={chunking_config.get('chunk_overlap')}")

        # For no_chunking, set meaningful defaults that indicate full content processing
        # These values are for display purposes - actual processing uses full content
        chunking_config["chunk_size"] = None  # Will be displayed as "Full Document"
        chunking_config["chunk_overlap"] = None  # Not applicable for single chunk
        chunking_config["strategy_display"] = "Full Document (No Chunking)"

        print(f"✅ [VALIDATION] Fixed no_chunking config: chunk_size=None (full doc), overlap=None")

    else:
        # Validate chunk_size and chunk_overlap for other strategies
        chunk_size = chunking_config.get("chunk_size", 1000)
        chunk_overlap = chunking_config.get("chunk_overlap", 200)

        if chunk_size <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="chunk_size must be greater than 0"
            )

        if chunk_overlap < 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="chunk_overlap must be 0 or greater"
            )

        if chunk_overlap >= chunk_size:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"chunk_overlap ({chunk_overlap}) must be less than chunk_size ({chunk_size})"
            )

    # Validate indexing_method (already validated by Pydantic, but double-check)
    indexing_method = request.indexing_method
    if indexing_method not in ["high_quality", "balanced", "fast"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid indexing_method: {indexing_method}. Must be one of: high_quality, balanced, fast"
        )

    # Build validated config
    validated_config = request.dict()
    validated_config["chunking_config"] = chunking_config

    print(f"✅ [VALIDATION] Final validated config: strategy={strategy}, indexing_method={indexing_method}")

    return validated_config


class KBFinalizeRequest(BaseModel):
    """Request model for KB finalization with all configurations"""
    chunking_config: Dict[str, Any] = Field(
        default_factory=lambda: {
            "strategy": "by_heading",
            "chunk_size": 1000,
            "chunk_overlap": 200,
            "preserve_code_blocks": True,
            "custom_separators": None,  # Optional: For "custom" strategy, e.g., ["\\n## ", "\\n### "]
            "enable_enhanced_metadata": False  # Optional: Add context_before/after, parent_heading
        },
        description="Chunking configuration including optional custom_separators and enhanced metadata"
    )
    indexing_method: str = Field(
        default="high_quality",
        description="Processing quality vs speed trade-off",
        pattern="^(high_quality|balanced|fast)$"
    )
    embedding_config: Dict[str, Any] = Field(
        default_factory=lambda: {
            "model": "all-MiniLM-L6-v2",
            "device": "cpu",
            "batch_size": 32,
            "normalize_embeddings": True
        },
        description="Embedding model configuration"
    )
    vector_store_config: Dict[str, Any] = Field(
        default_factory=lambda: {
            "provider": "qdrant",
            "collection_name_prefix": "kb",
            "distance_metric": "cosine"
        },
        description="Vector store configuration"
    )
    retrieval_config: Dict[str, Any] = Field(
        default_factory=lambda: {
            "strategy": "semantic_search",
            "top_k": 5,
            "score_threshold": 0.7,
            "rerank_enabled": False
        },
        description="Retrieval configuration"
    )
    priority: str = Field(default="normal", description="Processing priority")
    metadata_config: Dict[str, Any] = Field(
        default_factory=lambda: {
            "store_full_content": True,
            "indexed_fields": ["document_id", "page_number", "content_type"],
            "filterable_fields": ["document_id", "created_at", "workspace_id"],
            "include_source_tracking": True
        },
        description="Metadata storage and indexing configuration"
    )


@router.post("/{draft_id}/model-config")
async def configure_models_and_retrieval(
    draft_id: str,
    request: ModelConfigRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Configure embedding model, vector store, and retrieval settings.

    WHY: User needs to select embedding model, vector store, and retrieval options
    HOW: Save all model and retrieval configurations to draft for finalization

    PHASE: 1E (Model & Vector Store Configuration)

    FLOW:
    1. Validate configuration options
    2. Save embedding config to draft
    3. Save vector store config to draft
    4. Save retrieval config to draft
    5. Save metadata config to draft
    6. Return confirmation with configuration summary

    Args:
        draft_id: KB draft ID
        request: Complete model and retrieval configuration

    Returns:
        Configuration summary and validation results
    """
    try:
        # Get draft to verify it exists and user has access
        draft = draft_service.get_draft(DraftType.KB, draft_id)
        if not draft:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="KB draft not found"
            )

        # Validate embedding model options (must match SUPPORTED_MODELS in embedding_service_local.py)
        supported_embedding_models = [
            "all-MiniLM-L6-v2",           # Default - fast, good quality
            "all-MiniLM-L12-v2",          # Medium speed, better quality
            "all-mpnet-base-v2",          # Slow, best quality
            "paraphrase-multilingual-MiniLM-L12-v2",  # Multilingual support
        ]

        embedding_model = request.embedding_config.get("model")
        if embedding_model not in supported_embedding_models:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported embedding model: {embedding_model}. Supported models: {supported_embedding_models}"
            )

        # Validate vector store options
        supported_vector_stores = ["qdrant", "faiss", "weaviate", "milvus", "pinecone", "redis", "chroma", "elasticsearch"]

        vector_provider = request.vector_store_config.get("provider")
        if vector_provider not in supported_vector_stores:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported vector store: {vector_provider}. Supported providers: {supported_vector_stores}"
            )

        # Validate retrieval strategy
        supported_strategies = ["semantic_search", "hybrid_search", "keyword_search", "mmr", "similarity_score_threshold"]

        retrieval_strategy = request.retrieval_config.get("strategy")
        if retrieval_strategy not in supported_strategies:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported retrieval strategy: {retrieval_strategy}. Supported strategies: {supported_strategies}"
            )

        # Calculate estimated configuration metrics
        data = draft.get("data", {})
        sources = data.get("sources", [])
        approved_sources = [s for s in sources if s.get("status") == "approved"]

        total_pages = sum(len(source.get("approved_pages", [])) for source in approved_sources)
        total_content_size = sum(source.get("metadata", {}).get("total_content_size", 0) for source in approved_sources)

        # Estimate embedding dimensions based on model (must match SUPPORTED_MODELS)
        embedding_dimensions = {
            "all-MiniLM-L6-v2": 384,
            "all-MiniLM-L12-v2": 384,
            "all-mpnet-base-v2": 768,
            "paraphrase-multilingual-MiniLM-L12-v2": 384,
        }

        estimated_dimensions = embedding_dimensions.get(embedding_model, 384)
        chunking_config = data.get("chunking_config", {})
        estimated_chunks = total_content_size // chunking_config.get("chunk_size", 1000) if total_content_size > 0 else 0
        estimated_vector_storage_mb = (estimated_chunks * estimated_dimensions * 4) / (1024 * 1024)  # 4 bytes per float32

        # Save configurations to draft
        data["embedding_config"] = request.embedding_config
        data["vector_store_config"] = request.vector_store_config
        data["retrieval_config"] = request.retrieval_config
        data["metadata_config"] = request.metadata_config

        # Update draft
        draft_service.update_draft(
            draft_type=DraftType.KB,
            draft_id=draft_id,
            updates={"data": data}
        )

        return {
            "success": True,
            "message": "Model and retrieval configuration saved successfully",
            "configuration": {
                "embedding": request.embedding_config,
                "vector_store": request.vector_store_config,
                "retrieval": request.retrieval_config,
                "metadata": request.metadata_config
            },
            "estimates": {
                "total_approved_pages": total_pages,
                "total_content_size": total_content_size,
                "estimated_chunks": estimated_chunks,
                "embedding_dimensions": estimated_dimensions,
                "estimated_vector_storage_mb": round(estimated_vector_storage_mb, 2),
                "estimated_processing_time_minutes": max(1, int(estimated_chunks * 0.1))  # ~0.1 min per chunk
            },
            "compatibility": {
                "embedding_model_available": True,  # Would check actual availability
                "vector_store_available": True,     # Would check actual availability
                "gpu_acceleration": request.embedding_config.get("device") == "cuda"
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to configure models: {str(e)}"
        )


# ========================================
# DRAFT INSPECTION ENDPOINTS (View stored pages/chunks)
# ========================================

@router.get("/{draft_id}/pages")
async def get_draft_pages(
    draft_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    List all scraped pages stored in the draft (from preview) with FULL content.

    WHY: Allow users to inspect what pages were crawled during preview with complete content
    HOW: Retrieve pages data from draft in Redis including full scraped content

    PHASE: 1 (Draft Mode - Redis Only)
    DURATION: <50ms

    IMPORTANT: Returns FULL scraped content for each page, not truncated previews.
    Frontend can use this content directly without additional API calls.

    Returns:
        {
            "draft_id": str,
            "total_pages": int,
            "pages": [
                {
                    "index": int,
                    "url": str,
                    "title": str,
                    "content": str,  # FULL scraped content (complete webpage)
                    "content_preview": str,  # Optional 200-char preview
                    "word_count": int,
                    "character_count": int,
                    "chunks": int,
                    "scraped_at": str
                }
            ]
        }
    """

    # Verify draft exists and user owns it
    draft = draft_service.get_draft(DraftType.KB, draft_id)

    if not draft:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="KB draft not found or expired"
        )

    if draft["created_by"] != str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    # Get pages from draft preview data
    preview_data = draft.get("preview_data", {})
    pages = preview_data.get("pages", [])

    if not pages:
        return {
            "draft_id": draft_id,
            "total_pages": 0,
            "pages": [],
            "message": "No preview data found. Run preview first using POST /{draft_id}/preview"
        }

    # Format pages with FULL content (not truncated preview)
    formatted_pages = []
    for idx, page_data in enumerate(pages):
        full_content = page_data.get("content", "")
        formatted_pages.append({
            "index": idx,
            "url": page_data.get("url", ""),
            "title": page_data.get("title", ""),
            "content": full_content,  # FULL content, not truncated
            "content_preview": full_content[:200] + "..." if len(full_content) > 200 else full_content,  # Optional short preview
            "word_count": len(full_content.split()),
            "character_count": len(full_content),
            "chunks": page_data.get("chunks", 0),
            "scraped_at": preview_data.get("generated_at", "")
        })

    return {
        "draft_id": draft_id,
        "total_pages": len(formatted_pages),
        "pages": formatted_pages
    }


@router.get("/{draft_id}/pages/{page_index}")
async def get_draft_page(
    draft_id: str,
    page_index: int,
    current_user: User = Depends(get_current_user)
):
    """
    Get full content of a specific scraped page from draft.

    WHY: Allow users to see complete page content before finalization
    HOW: Retrieve specific page from draft preview data

    PHASE: 1 (Draft Mode - Redis Only)
    DURATION: <50ms

    Returns:
        {
            "page_index": int,
            "url": str,
            "title": str,
            "content": str (full markdown content),
            "content_type": str,
            "metadata": {...},
            "word_count": int,
            "character_count": int,
            "links": [...]
        }
    """

    # Verify draft exists and user owns it
    draft = draft_service.get_draft(DraftType.KB, draft_id)

    if not draft:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="KB draft not found or expired"
        )

    if draft["created_by"] != str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    # Get pages from draft preview data
    preview_data = draft.get("preview_data", {})
    pages = preview_data.get("pages", [])

    if not pages:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No preview data found. Run preview first using POST /{draft_id}/preview"
        )

    if page_index < 0 or page_index >= len(pages):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Page index {page_index} not found (total pages: {len(pages)})"
        )

    page_data = pages[page_index]
    content = page_data.get("content", "")

    return {
        "page_index": page_index,
        "url": page_data.get("url", ""),
        "title": page_data.get("title", ""),
        "content": content,
        "content_type": "text/markdown",
        "metadata": {
            "description": page_data.get("description", ""),
            "scraped_at": preview_data.get("generated_at", ""),
            "chunks": page_data.get("chunks", 0)
        },
        "word_count": len(content.split()),
        "character_count": len(content),
        "chunks_count": len(page_data.get("preview_chunks", []))
    }


@router.get("/{draft_id}/chunks")
async def get_draft_chunks(
    draft_id: str,
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    page_index: Optional[int] = Query(None, description="Filter chunks from specific page"),
    current_user: User = Depends(get_current_user)
):
    """
    List chunks from draft preview with pagination and filtering.

    WHY: Allow users to inspect chunks before finalization
    HOW: Retrieve chunks from draft preview data with pagination

    PHASE: 1 (Draft Mode - Redis Only)
    DURATION: <100ms

    Query Parameters:
        - page: Page number (default: 1)
        - limit: Items per page (default: 20, max: 100)
        - page_index: Filter chunks from specific scraped page

    Returns:
        {
            "draft_id": str,
            "total_chunks": int,
            "page": int,
            "limit": int,
            "total_pages": int,
            "chunks": [
                {
                    "index": int,
                    "content": str,
                    "word_count": int,
                    "character_count": int,
                    "source_page": {
                        "index": int,
                        "url": str,
                        "title": str
                    }
                }
            ]
        }
    """

    # Verify draft exists and user owns it
    draft = draft_service.get_draft(DraftType.KB, draft_id)

    if not draft:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="KB draft not found or expired"
        )

    if draft["created_by"] != str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    # Get preview data from draft
    preview_data = draft.get("preview_data", {})
    pages = preview_data.get("pages", [])

    if not pages:
        return {
            "draft_id": draft_id,
            "total_chunks": 0,
            "page": page,
            "limit": limit,
            "total_pages": 0,
            "chunks": [],
            "message": "No preview data found. Run preview first using POST /{draft_id}/preview"
        }

    # Collect all chunks from all pages
    all_chunks = []
    for page_idx, page_data in enumerate(pages):
        # Filter by page_index if specified
        if page_index is not None and page_idx != page_index:
            continue

        page_chunks = page_data.get("preview_chunks", [])
        for chunk_idx, chunk in enumerate(page_chunks):
            all_chunks.append({
                "global_index": len(all_chunks),
                "page_index": page_idx,
                "chunk_index": chunk_idx,
                "content": chunk.get("content", ""),
                "word_count": chunk.get("word_count", 0),
                "character_count": chunk.get("character_count", 0),
                "source_page": {
                    "index": page_idx,
                    "url": page_data.get("url", ""),
                    "title": page_data.get("title", "")
                }
            })

    # Apply pagination
    total_chunks = len(all_chunks)
    total_pages = (total_chunks + limit - 1) // limit if total_chunks > 0 else 0

    start_idx = (page - 1) * limit
    end_idx = start_idx + limit
    paginated_chunks = all_chunks[start_idx:end_idx]

    return {
        "draft_id": draft_id,
        "total_chunks": total_chunks,
        "page": page,
        "limit": limit,
        "total_pages": total_pages,
        "chunks": paginated_chunks,
        "filter_applied": {
            "page_index": page_index
        }
    }


# ========================================
# PHASE 2: FINALIZATION (Create DB Records)
# ========================================

@router.post("/{draft_id}/finalize")
async def finalize_kb_draft(
    draft_id: str,
    request: KBFinalizeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Finalize KB draft: Create DB records and queue background processing.

    PHASE: 2 (Finalization - Create DB Records)
    DURATION: <100ms (synchronous)
    DATABASE: Creates KB + Document records in PostgreSQL

    CRITICAL FLOW:
    1. Validate draft
    2. Create KB record (status="processing")
    3. Create Document placeholders
    4. Create pipeline tracking in Redis
    5. Queue Celery background task (Phase 3)
    6. Delete draft from Redis
    7. Return kb_id and pipeline_id

    IMPORTANT: This is SYNCHRONOUS (<100ms).
    Heavy processing happens in background Celery task (Phase 3).

    Returns:
        {
            "kb_id": str,
            "pipeline_id": str,
            "status": "processing",
            "message": str,
            "tracking_url": str,
            "estimated_completion_minutes": int
        }
    """

    # Verify draft exists and user owns it
    draft = draft_service.get_draft(DraftType.KB, draft_id)

    if not draft:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="KB draft not found or expired"
        )

    if draft["created_by"] != str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    # Validate and fix configurations before finalization
    validated_config = _validate_and_fix_finalize_config(request)

    # Finalize draft (creates DB records and queues task)
    try:
        result = await kb_draft_service.finalize_draft(
            db=db,
            draft_id=draft_id,
            config_override=validated_config
        )

        return result

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        # Log error
        print(f"Error finalizing KB draft: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to finalize KB draft"
        )

