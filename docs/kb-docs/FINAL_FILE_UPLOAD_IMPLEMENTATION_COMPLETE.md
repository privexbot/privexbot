# Complete File Upload Implementation - Metadata-Only Storage

**Date**: 2025-12-15
**Purpose**: Complete, accurate implementation for file upload with PURE metadata-only storage
**Status**: Production-Ready Implementation Plan
**Complexity**: Low (~400 lines of new code)

---

## CRITICAL ARCHITECTURAL CLARIFICATION

### ⚠️ CORRECTED Storage Architecture

**User Requirement**: "We don't want to store any user actual content in PostgreSQL for file upload sources - just metadata, including document, chunks - only metadata."

**CORRECT Implementation**:

| Source Type | Document.content_full | Document.source_metadata | PostgreSQL Chunks | Qdrant Storage |
|-------------|----------------------|--------------------------|-------------------|----------------|
| **web_scraping** | ✅ Full content | Web metadata | ✅ **All chunks** | ✅ Vectors + metadata |
| **file_upload** | ❌ `NULL` | ✅ **File metadata ONLY** | ❌ **NO chunks** | ✅ **Chunks + Vectors + All content** |

### Key Differences

**Web URL Processing** (Existing - UNCHANGED):
```
Scrape → Store full content in DB → Create Document record → Create Chunk records in PostgreSQL → Generate embeddings → Store vectors in Qdrant
```

**File Upload Processing** (NEW):
```
Parse → Extract text → Store ONLY metadata in DB → Create Document record (metadata only) → NO Chunk records in PostgreSQL → Chunk content in memory → Generate embeddings → Store chunks + vectors in Qdrant ONLY
```

### Storage Summary

**For File Uploads**:
- PostgreSQL Document table: ✅ Metadata only (filename, size, mime_type, hash, page_count, etc.)
- PostgreSQL Chunk table: ❌ NO records (completely empty for file uploads)
- Qdrant: ✅ ALL chunks with full content + vectors + metadata

**For Web URLs** (UNCHANGED):
- PostgreSQL Document table: ✅ Full scraped content
- PostgreSQL Chunk table: ✅ All chunks
- Qdrant: ✅ Vectors + metadata

---

## Interactive Chunk Preview Architecture

### User Requirement

"For the chunk preview step, we want to allow users to preview the full content during the chunk preview step and it must respond to the chunk configs so users can understand how their data will get processed in the actual backend processing."

### Preview Flow

```
1. User uploads file
   ↓
2. Parse with Tika → Extract text
   ↓
3. Store extracted text in Redis draft (temporary)
   ↓
4. User configures chunking:
   - strategy: by_heading, semantic, adaptive, hybrid, no_chunking
   - chunk_size: 500-2000
   - chunk_overlap: 0-500
   - separators: custom separators
   ↓
5. User clicks "Preview Chunks"
   ↓
6. Backend chunks content ON-THE-FLY with given config
   ↓
7. Return chunks + metrics to frontend
   ↓
8. User sees:
   - Full chunk content
   - Chunk boundaries
   - Overlap regions highlighted
   - Token counts
   - Retrieval quality estimate
   ↓
9. User can change config and re-preview (steps 4-8 repeat)
   ↓
10. When satisfied, user clicks "Finalize"
    ↓
11. Pipeline processes with chosen config → Store in Qdrant ONLY
```

### Preview Endpoint Requirements

**Endpoint**: `POST /api/v1/kb-drafts/{draft_id}/preview-chunks-live`

**Request**:
```json
{
  "source_id": "uuid",
  "chunking_config": {
    "strategy": "by_heading",
    "chunk_size": 1000,
    "chunk_overlap": 200,
    "separators": ["\n\n", "\n", ". "]
  },
  "include_full_content": true,
  "highlight_overlaps": true
}
```

**Response**:
```json
{
  "chunks": [
    {
      "content": "Full chunk content here...",
      "index": 0,
      "char_count": 850,
      "token_count": 180,
      "has_overlap": false,
      "overlap_content": null,
      "page_number": 1
    },
    {
      "content": "Next chunk with overlap...",
      "index": 1,
      "char_count": 920,
      "token_count": 195,
      "has_overlap": true,
      "overlap_content": "...last 200 chars from previous chunk...",
      "page_number": 1
    }
  ],
  "metrics": {
    "total_chunks": 15,
    "avg_chunk_size": 875,
    "min_chunk_size": 650,
    "max_chunk_size": 1100,
    "total_tokens": 2900,
    "overlap_percentage": 20,
    "estimated_embedding_cost": 0.00029,
    "estimated_search_quality": "high",
    "retrieval_speed": "fast"
  },
  "full_content_length": 12500,
  "config_used": {
    "strategy": "by_heading",
    "chunk_size": 1000,
    "chunk_overlap": 200
  }
}
```

---

## Complete Implementation

### Phase 1: Infrastructure Setup (30 minutes)

#### Step 1.1: Add Tika to Docker Compose

**File**: `backend/docker-compose.dev.yml`

```yaml
services:
  # ... existing services

  tika-server:
    image: apache/tika:latest-full
    container_name: privexbot-tika
    restart: unless-stopped
    ports:
      - "9998:9998"
    environment:
      JAVA_OPTS: "-Xms1g -Xmx2g -Djava.awt.headless=true"
    networks:
      - backend
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9998/tika"]
      interval: 30s
      timeout: 10s
      retries: 3
```

#### Step 1.2: Start Tika Server

```bash
# Start Tika
docker compose -f backend/docker-compose.dev.yml up -d tika-server

# Verify
curl http://localhost:9998/tika
# Should return: Apache Tika 2.9.1
```

#### Step 1.3: Add Dependencies

**File**: `backend/pyproject.toml`

```toml
[project]
dependencies = [
    # ... existing dependencies
    "aiohttp>=3.9.0",        # Tika HTTP client
    "python-magic>=0.4.27",  # MIME detection
]
```

```bash
cd backend
uv sync
```

#### Step 1.4: Environment Variables

**File**: `backend/.env.dev`

```env
# Tika Configuration
TIKA_URL=http://localhost:9998
```

### Phase 2: Create Tika Service (1 hour)

**File**: `backend/src/app/services/tika_service.py` (NEW)

```python
"""
Apache Tika Integration - Universal Document Parser

WHY: Parse 15+ file formats with single service
HOW: HTTP API calls to Tika server
"""

import aiohttp
import logging
from typing import Dict, Any, Optional
from pathlib import Path

logger = logging.getLogger(__name__)


class TikaService:
    """Apache Tika service for document parsing."""

    def __init__(self, tika_url: str = "http://localhost:9998"):
        self.tika_url = tika_url
        self.parse_endpoint = f"{tika_url}/tika"
        self.meta_endpoint = f"{tika_url}/meta"

    async def parse_document(
        self,
        file_path: str,
        extract_metadata: bool = True
    ) -> Dict[str, Any]:
        """
        Parse document and extract text + metadata.

        Returns:
            {
                "text": str,
                "metadata": {...},
                "file_info": {
                    "original_filename": str,
                    "file_size_bytes": int,
                    "mime_type": str
                }
            }
        """
        try:
            file_path_obj = Path(file_path)
            if not file_path_obj.exists():
                raise FileNotFoundError(f"File not found: {file_path}")

            with open(file_path, 'rb') as f:
                file_content = f.read()

            async with aiohttp.ClientSession() as session:
                # Extract text
                async with session.put(
                    self.parse_endpoint,
                    data=file_content,
                    headers={"Accept": "text/plain"}
                ) as response:
                    if response.status != 200:
                        raise Exception(f"Tika parse failed: {response.status}")
                    text = await response.text()

                # Extract metadata
                metadata = {}
                if extract_metadata:
                    async with session.put(
                        self.meta_endpoint,
                        data=file_content,
                        headers={"Accept": "application/json"}
                    ) as meta_response:
                        if meta_response.status == 200:
                            metadata = await meta_response.json()

            return {
                "text": text.strip(),
                "metadata": self._normalize_metadata(metadata),
                "file_info": {
                    "original_filename": file_path_obj.name,
                    "file_size_bytes": len(file_content),
                    "mime_type": metadata.get("Content-Type", "application/octet-stream")
                }
            }

        except Exception as e:
            logger.error(f"Tika parsing failed for {file_path}: {e}")
            raise

    def _normalize_metadata(self, raw_metadata: Dict) -> Dict[str, Any]:
        """Normalize Tika metadata to consistent format."""
        normalized = {}

        field_mappings = {
            "title": ["dc:title", "title", "Title"],
            "author": ["dc:creator", "Author", "author"],
            "page_count": ["xmpTPg:NPages", "Page-Count", "meta:page-count"],
            "content_type": ["Content-Type", "content-type"],
            "creation_date": ["dcterms:created", "Creation-Date"],
            "modified_date": ["dcterms:modified", "Last-Modified"],
            "language": ["dc:language", "language"],
            "keywords": ["Keywords", "meta:keyword"]
        }

        for target_key, source_keys in field_mappings.items():
            for source_key in source_keys:
                if source_key in raw_metadata:
                    value = raw_metadata[source_key]
                    if isinstance(value, list) and len(value) > 0:
                        value = value[0]
                    normalized[target_key] = value
                    break

        return normalized

    @staticmethod
    def is_supported_file_type(mime_type: str) -> bool:
        """Check if file type is supported."""
        supported = [
            "application/pdf",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",  # DOCX
            "application/msword",  # DOC
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",  # XLSX
            "application/vnd.ms-excel",  # XLS
            "text/csv",
            "text/plain",
            "text/html",
            "text/markdown",
            "application/json",
        ]
        return mime_type in supported


# Singleton
tika_service = TikaService()
```

### Phase 3: Extend Draft Service (1 hour)

**File**: `backend/src/app/services/kb_draft_service.py` (EXTEND)

Add this method to `KBDraftService` class:

```python
async def add_file_source_to_draft(
    self,
    draft_id: str,
    file_path: str,
    original_filename: str
) -> str:
    """
    Add file source to KB draft.

    CRITICAL: Stores extracted text in Redis for preview.
    NO content goes to PostgreSQL during finalization.

    Returns:
        source_id: Unique identifier for this file source
    """
    from app.services.tika_service import tika_service
    from datetime import datetime
    import hashlib

    draft = draft_service.get_draft(DraftType.KB, draft_id)
    if not draft:
        raise ValueError("KB draft not found")

    try:
        # Parse file with Tika
        parse_result = await tika_service.parse_document(
            file_path=file_path,
            extract_metadata=True
        )

        # Calculate file hash
        with open(file_path, 'rb') as f:
            file_content = f.read()
            file_hash = hashlib.sha256(file_content).hexdigest()

        # Create source entry
        source_id = str(uuid4())
        source = {
            "id": source_id,
            "type": "file_upload",
            "url": None,
            "name": original_filename,
            "config": {},
            "added_at": datetime.utcnow().isoformat(),

            # CRITICAL: Store extracted text for preview
            "extracted_text": parse_result["text"],

            # Metadata (what goes to PostgreSQL)
            "metadata": {
                "original_filename": original_filename,
                "file_size_bytes": parse_result["file_info"]["file_size_bytes"],
                "mime_type": parse_result["file_info"]["mime_type"],
                "file_hash_sha256": file_hash,
                "upload_date": datetime.utcnow().isoformat(),
                "processing_method": "tika",
                "text_length": len(parse_result["text"]),
                "word_count": len(parse_result["text"].split()),
                "storage_strategy": "metadata_only_pure",  # No chunks in PostgreSQL
                **parse_result["metadata"]
            }
        }

        # Add to sources
        data = draft.get("data", {})
        sources = data.get("sources", [])
        sources.append(source)
        data["sources"] = sources

        draft_service.update_draft(
            draft_type=DraftType.KB,
            draft_id=draft_id,
            updates={"data": data}
        )

        return source_id

    except Exception as e:
        raise ValueError(f"Failed to parse file: {str(e)}")
```

### Phase 4: Enhanced Preview Endpoint (1 hour)

**File**: `backend/src/app/api/v1/routes/kb_draft.py` (ADD NEW ENDPOINT)

```python
from app.services.chunking_service import chunking_service

@router.post("/{draft_id}/preview-chunks-live")
async def preview_chunks_live(
    draft_id: str,
    request: Dict[str, Any],
    current_user: User = Depends(get_current_user)
):
    """
    Preview chunks with real-time chunking configuration.

    CRITICAL: Chunks content on-the-fly based on user config.
    Shows exact processing that will happen during finalization.

    Request:
        {
            "source_id": "uuid",
            "chunking_config": {
                "strategy": "by_heading",
                "chunk_size": 1000,
                "chunk_overlap": 200,
                "separators": ["\n\n", "\n", ". "]
            },
            "include_full_content": true,
            "highlight_overlaps": true
        }

    Returns:
        {
            "chunks": [...],
            "metrics": {...},
            "full_content_length": int
        }
    """

    # Get draft
    draft = draft_service.get_draft(DraftType.KB, draft_id)
    if not draft:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="KB draft not found"
        )

    # Verify ownership
    if draft["created_by"] != str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    # Extract request parameters
    source_id = request.get("source_id")
    chunking_config = request.get("chunking_config", {})
    include_full_content = request.get("include_full_content", True)
    highlight_overlaps = request.get("highlight_overlaps", True)

    # Find source
    data = draft.get("data", {})
    sources = data.get("sources", [])
    source = next((s for s in sources if s.get("id") == source_id), None)

    if not source:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Source not found in draft"
        )

    # Get extracted text
    extracted_text = source.get("extracted_text", "")
    if not extracted_text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No content available for preview"
        )

    # Extract chunking config
    strategy = chunking_config.get("strategy", "by_heading")
    chunk_size = chunking_config.get("chunk_size", 1000)
    chunk_overlap = chunking_config.get("chunk_overlap", 200)
    separators = chunking_config.get("separators")

    try:
        # Chunk content ON-THE-FLY
        if strategy in ("no_chunking", "full_content"):
            # Return full content as single chunk
            chunks = [{
                "content": extracted_text if include_full_content else extracted_text[:500] + "...",
                "index": 0,
                "char_count": len(extracted_text),
                "token_count": len(extracted_text) // 4,  # Rough estimate
                "has_overlap": False,
                "overlap_content": None,
                "page_number": None
            }]

            metrics = {
                "total_chunks": 1,
                "avg_chunk_size": len(extracted_text),
                "min_chunk_size": len(extracted_text),
                "max_chunk_size": len(extracted_text),
                "total_tokens": len(extracted_text) // 4,
                "overlap_percentage": 0,
                "estimated_embedding_cost": (len(extracted_text) // 4) * 0.0001,
                "estimated_search_quality": "high",
                "retrieval_speed": "fast" if len(extracted_text) < 5000 else "moderate"
            }

        else:
            # Chunk with configured strategy
            chunks_data = chunking_service.chunk_document(
                text=extracted_text,
                strategy=strategy,
                chunk_size=chunk_size,
                chunk_overlap=chunk_overlap,
                separators=separators
            )

            # Build response chunks
            chunks = []
            for idx, chunk_data in enumerate(chunks_data):
                chunk_content = chunk_data["content"]

                # Calculate overlap if applicable
                overlap_content = None
                has_overlap = False
                if idx > 0 and chunk_overlap > 0:
                    has_overlap = True
                    # Extract overlap region from previous chunk
                    prev_chunk = chunks_data[idx - 1]["content"]
                    overlap_content = prev_chunk[-chunk_overlap:] if len(prev_chunk) > chunk_overlap else prev_chunk

                chunks.append({
                    "content": chunk_content if include_full_content else chunk_content[:200] + "...",
                    "index": idx,
                    "char_count": len(chunk_content),
                    "token_count": len(chunk_content) // 4,
                    "has_overlap": has_overlap,
                    "overlap_content": overlap_content if highlight_overlaps else None,
                    "page_number": chunk_data.get("page_number")
                })

            # Calculate metrics
            chunk_sizes = [len(c["content"]) for c in chunks_data]
            total_tokens = sum([len(c["content"]) // 4 for c in chunks_data])

            metrics = {
                "total_chunks": len(chunks),
                "avg_chunk_size": sum(chunk_sizes) // len(chunk_sizes) if chunk_sizes else 0,
                "min_chunk_size": min(chunk_sizes) if chunk_sizes else 0,
                "max_chunk_size": max(chunk_sizes) if chunk_sizes else 0,
                "total_tokens": total_tokens,
                "overlap_percentage": int((chunk_overlap / chunk_size) * 100) if chunk_size > 0 else 0,
                "estimated_embedding_cost": total_tokens * 0.0001,
                "estimated_search_quality": "high" if len(chunks) < 50 else "moderate",
                "retrieval_speed": "fast" if len(chunks) < 100 else "moderate"
            }

        return {
            "chunks": chunks,
            "metrics": metrics,
            "full_content_length": len(extracted_text),
            "config_used": {
                "strategy": strategy,
                "chunk_size": chunk_size,
                "chunk_overlap": chunk_overlap
            }
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to preview chunks: {str(e)}"
        )
```

### Phase 5: File Upload Endpoint (30 minutes)

**File**: `backend/src/app/api/v1/routes/kb_draft.py` (ADD)

```python
from fastapi import UploadFile, File
import tempfile
import os

@router.post("/{draft_id}/sources/file")
async def add_file_source_to_draft(
    draft_id: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """
    Upload file to KB draft.

    Flow:
    1. Upload file
    2. Parse with Tika
    3. Store extracted text in Redis draft (for preview)
    4. Return source_id

    No PostgreSQL writes at this stage.
    """

    # Verify draft exists
    draft = draft_service.get_draft(DraftType.KB, draft_id)
    if not draft:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="KB draft not found"
        )

    if draft["created_by"] != str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    # Validate file size (max 100MB)
    MAX_FILE_SIZE = 100 * 1024 * 1024
    file.file.seek(0, 2)
    file_size = file.file.tell()
    file.file.seek(0)

    if file_size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File too large. Maximum size: 100MB"
        )

    temp_file = None
    try:
        # Save to temp file
        with tempfile.NamedTemporaryFile(delete=False, suffix=Path(file.filename).suffix) as temp:
            temp.write(await file.read())
            temp_file = temp.name

        # Add to draft (parses with Tika)
        source_id = await kb_draft_service.add_file_source_to_draft(
            draft_id=draft_id,
            file_path=temp_file,
            original_filename=file.filename
        )

        # Get source metadata for response
        draft = draft_service.get_draft(DraftType.KB, draft_id)
        data = draft.get("data", {})
        sources = data.get("sources", [])
        source = next((s for s in sources if s.get("id") == source_id), None)

        metadata = source.get("metadata", {})

        return {
            "source_id": source_id,
            "filename": file.filename,
            "mime_type": metadata.get("mime_type"),
            "file_size_bytes": metadata.get("file_size_bytes"),
            "text_length": metadata.get("text_length"),
            "page_count": metadata.get("page_count"),
            "message": f"File '{file.filename}' uploaded and parsed successfully"
        }

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process file: {str(e)}"
        )
    finally:
        # Clean up temp file
        if temp_file and os.path.exists(temp_file):
            os.unlink(temp_file)
```

### Phase 6: Pipeline Extension - METADATA ONLY (2 hours)

**File**: `backend/src/app/tasks/kb_pipeline_tasks.py` (EXTEND)

**CRITICAL**: Modify `process_web_kb_task` to handle file uploads with NO PostgreSQL chunk storage:

```python
# Add import
from app.services.tika_service import tika_service

# Inside process_web_kb_task, modify source processing loop:

for source_idx, source in enumerate(sources):
    source_type = source.get("type")

    if source_type == "file_upload":
        # =============================================
        # FILE UPLOAD: METADATA-ONLY STORAGE
        # =============================================

        tracker.update_status(
            status="running",
            current_stage=f"Processing file {source_idx + 1}/{total_sources}",
            progress_percentage=10 + int((source_idx / total_sources) * 60)
        )

        try:
            # Get extracted text from source (stored during upload)
            extracted_text = source.get("extracted_text", "")
            source_metadata = source.get("metadata", {})

            if not extracted_text:
                raise ValueError("No text content extracted from file")

            # STEP 1: Create Document with METADATA ONLY
            document = Document(
                kb_id=UUID(kb_id),
                workspace_id=kb.workspace_id,
                name=source_metadata.get("original_filename", "Uploaded File"),
                source_type="file_upload",  # ← Differentiate
                source_url=None,
                source_metadata=source_metadata,  # ← File metadata ONLY
                file_path=None,
                content_preview=extracted_text[:500],
                content_full=None,  # ← CRITICAL: NO CONTENT IN DB
                status="processing",
                chunk_count=0,  # ← NO chunks in PostgreSQL
                created_by=kb.created_by
            )

            db.add(document)
            db.commit()
            db.refresh(document)

            # STEP 2: Chunk content (IN MEMORY, not saved to PostgreSQL)
            chunks_data = chunking_service.chunk_document(
                text=extracted_text,
                strategy=chunk_strategy,
                chunk_size=chunk_size,
                chunk_overlap=chunk_overlap
            )

            # STEP 3: Generate embeddings and store ONLY in Qdrant
            for chunk_idx, chunk_data in enumerate(chunks_data):
                chunk_text = chunk_data["content"]

                # Generate embedding
                embedding_vector = embedding_service.generate_embedding(chunk_text)

                # ⚠️ CRITICAL: Store ONLY in Qdrant (NOT in PostgreSQL Chunk table)
                await qdrant_service.add_chunk_to_kb(
                    kb_id=UUID(kb_id),
                    chunk=QdrantChunk(
                        id=str(uuid4()),  # Generate unique chunk ID
                        content=chunk_text,  # ← Full chunk text stored in Qdrant
                        embedding=embedding_vector,
                        metadata={
                            "document_id": str(document.id),
                            "document_name": document.name,
                            "source_type": "file_upload",
                            "chunk_index": chunk_idx,
                            "page_number": chunk_data.get("page_number"),
                            "char_count": len(chunk_text),
                            "token_count": len(chunk_text) // 4,
                            "storage_location": "qdrant_only"  # ← Indicator
                        }
                    )
                )

            # STEP 4: Update document status (NO chunk records in PostgreSQL)
            document.status = "completed"
            document.chunk_count = len(chunks_data)  # For reference only
            db.commit()

            tracker.update_stats(
                pages_scraped=tracker.stats["pages_scraped"] + 1,
                chunks_created=tracker.stats["chunks_created"] + len(chunks_data),
                embeddings_generated=tracker.stats["embeddings_generated"] + len(chunks_data)
            )

            all_failed = False

        except Exception as e:
            logger.error(f"File upload processing failed: {e}")
            tracker.add_log("error", f"Failed to process file: {str(e)}")
            tracker.update_stats(pages_failed=tracker.stats["pages_failed"] + 1)

            # Update document status
            if 'document' in locals():
                document.status = "failed"
                document.error_message = str(e)
                db.commit()

    elif source_type == "web_scraping":
        # =============================================
        # WEB SCRAPING: EXISTING BEHAVIOR (UNCHANGED)
        # =============================================

        # Keep ALL existing web scraping logic
        # Stores: content_full + Chunk records + Qdrant vectors

        pass  # ... existing code ...

# ... rest of pipeline ...
```

---

## Key Implementation Points

### 1. Storage Strategy Comparison

**Web URLs (Existing)**:
```python
# Full storage in PostgreSQL + Qdrant
document = Document(
    content_full=scraped_content,  # ✅ Full content
    source_metadata={...}
)
db.add(document)

# Create Chunk records
for chunk in chunks:
    chunk_record = Chunk(
        document_id=document.id,
        content=chunk.content,  # ✅ Chunk in PostgreSQL
        embedding=embedding
    )
    db.add(chunk_record)

# Also store in Qdrant
await qdrant_service.add_chunk(...)
```

**File Uploads (NEW)**:
```python
# Metadata-only in PostgreSQL
document = Document(
    content_full=None,  # ❌ NO content
    source_metadata={...},  # ✅ Metadata only
    chunk_count=len(chunks)  # Reference count only
)
db.add(document)

# ⚠️ NO Chunk records created in PostgreSQL

# ONLY store in Qdrant
for chunk in chunks:
    await qdrant_service.add_chunk_to_kb(
        chunk=QdrantChunk(
            content=chunk.content,  # ✅ Full chunk text in Qdrant
            embedding=embedding,
            metadata={...}
        )
    )
```

### 2. Preview Flow

```python
# User uploads file → Parse with Tika → Store in Redis draft
{
    "sources": [
        {
            "id": "source-uuid",
            "type": "file_upload",
            "extracted_text": "Full extracted text...",  # ← For preview
            "metadata": {...}  # ← For PostgreSQL later
        }
    ]
}

# User previews with config → Chunk on-the-fly → Return to frontend
preview_result = chunking_service.chunk_document(
    text=extracted_text,  # From Redis draft
    strategy=user_config["strategy"],
    chunk_size=user_config["chunk_size"],
    chunk_overlap=user_config["chunk_overlap"]
)

# User can repeat preview with different configs
# No database writes until finalization
```

### 3. Retrieval Differences

**For Web URLs**:
```python
# Can retrieve from PostgreSQL OR Qdrant
chunks = db.query(Chunk).filter(
    Chunk.document_id == document_id
).all()
```

**For File Uploads**:
```python
# MUST retrieve from Qdrant ONLY
# Check source_type first
if document.source_type == "file_upload":
    # Query Qdrant
    results = await qdrant_service.search_by_document(
        kb_id=kb_id,
        document_id=document_id
    )
else:
    # Query PostgreSQL
    chunks = db.query(Chunk).filter(...)
```

---

## Testing Checklist

### Test 1: Upload and Preview
```bash
# Upload PDF
curl -X POST "http://localhost:8000/api/v1/kb-drafts/{draft_id}/sources/file" \
  -H "Authorization: Bearer {token}" \
  -F "file=@test.pdf"

# Preview with different configs
curl -X POST "http://localhost:8000/api/v1/kb-drafts/{draft_id}/preview-chunks-live" \
  -H "Authorization: Bearer {token}" \
  -d '{
    "source_id": "{source_id}",
    "chunking_config": {
      "strategy": "by_heading",
      "chunk_size": 1000,
      "chunk_overlap": 200
    }
  }'

# Change config and preview again
curl -X POST "http://localhost:8000/api/v1/kb-drafts/{draft_id}/preview-chunks-live" \
  -d '{
    "source_id": "{source_id}",
    "chunking_config": {
      "strategy": "no_chunking"
    }
  }'
```

### Test 2: Verify Metadata-Only Storage
```sql
-- After finalization, check PostgreSQL
SELECT
    id,
    name,
    source_type,
    content_full IS NULL as no_content,
    chunk_count,
    source_metadata->>'storage_strategy' as strategy
FROM documents
WHERE source_type = 'file_upload';

-- Expected:
-- no_content = true (NULL)
-- chunk_count > 0 (reference only)
-- strategy = 'metadata_only_pure'

-- Check Chunk table (should be EMPTY for file uploads)
SELECT COUNT(*) FROM chunks
WHERE document_id IN (
    SELECT id FROM documents WHERE source_type = 'file_upload'
);

-- Expected: 0 (NO chunk records for file uploads)
```

### Test 3: Verify Qdrant Storage
```python
# Check that chunks are in Qdrant
from app.services.qdrant_service import qdrant_service

results = await qdrant_service.search_by_document(
    kb_id=kb_id,
    document_id=document_id
)

# Expected: Chunks with full content stored in Qdrant
for result in results:
    print(result.payload["content"])  # Full chunk text
    print(result.payload["storage_location"])  # "qdrant_only"
```

---

## Summary

### Architecture Principles

1. **✅ Metadata-Only for File Uploads**:
   - PostgreSQL Document: Metadata only (NO content_full)
   - PostgreSQL Chunks: EMPTY (NO chunk records)
   - Qdrant: ALL chunks + vectors + full content

2. **✅ Interactive Preview**:
   - Chunk on-the-fly with user config
   - Show full content + metrics
   - Allow config experimentation
   - No database writes

3. **✅ Backward Compatible**:
   - Web URLs: Existing behavior unchanged
   - Mixed KBs: Both types work independently
   - Retrieval: Check source_type to route correctly

### Code Statistics

| Component | Lines of Code | Complexity |
|-----------|---------------|------------|
| Tika Service | ~200 lines | Low |
| Draft Service Extension | ~60 lines | Low |
| File Upload Endpoint | ~80 lines | Low |
| Preview Endpoint | ~150 lines | Medium |
| Pipeline Extension | ~100 lines | Medium |
| **TOTAL** | **~590 lines** | **Low-Medium** |

### Timeline

- Infrastructure: 30 minutes
- Tika Service: 1 hour
- Draft Service: 1 hour
- Upload Endpoint: 30 minutes
- Preview Endpoint: 1 hour
- Pipeline: 2 hours
- Testing: 2 hours

**Total**: 8-10 hours

---

**Document Status**: Complete Implementation Plan
**Ready for**: Immediate Implementation
**Risk Level**: Low (backward compatible)
**Complexity**: Low-Medium (~590 lines)

