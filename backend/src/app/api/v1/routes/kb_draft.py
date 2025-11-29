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

from fastapi import APIRouter, Depends, HTTPException, status, Body, Query
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from uuid import UUID
from pydantic import BaseModel, Field, validator, model_validator
from datetime import datetime

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

    # Update chunking config
    try:
        kb_draft_service.update_chunking_config(
            draft_id=draft_id,
            chunking_config=request.dict()
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

        # Update preview_data in draft
        draft["preview_data"] = preview_data
        draft_service.save_draft(DraftType.KB, draft_id, draft)

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

    # Finalize draft (creates DB records and queues task)
    try:
        result = await kb_draft_service.finalize_draft(
            db=db,
            draft_id=draft_id
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

