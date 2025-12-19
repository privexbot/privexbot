# Simplified File Upload Implementation
## Extend Existing KB Pipeline for Document Processing

**Version:** 1.0 (Simplified)
**Last Updated:** 2025-12-15
**Target:** Extend existing web URL flow to support file uploads

---

## Overview

This guide shows how to **extend your existing KB pipeline** to support file uploads with **minimal changes**. We'll reuse everything you already have:

✅ Existing Celery + Redis setup
✅ Existing `process_web_kb_task` pipeline
✅ Existing `kb_draft_service.py`
✅ Existing sentence-transformers (CPU-optimized)
✅ Existing Qdrant integration
✅ Existing multi-tenancy (User → Org → Workspace → KB)

**What's New:**
- ✅ Apache Tika server (Docker container)
- ✅ File upload API endpoint
- ✅ Format detection + routing logic
- ✅ Extend existing pipeline to handle file sources

**Total New Code:** ~500 lines across 3 files

---

## Architecture (Aligned with Existing Pattern)

### Current Web URL Flow (Already Working)

```
1. Create Draft (Redis) → kb_draft_service.create_draft()
2. Add Web Sources → kb_draft_service.add_web_sources()
3. Configure (chunking, embedding) → kb_draft_service.update_*_config()
4. Preview → Frontend shows scraped content
5. Finalize → kb_draft_service.finalize_draft()
   ├─ Create KB in PostgreSQL
   ├─ Queue: process_web_kb_task.apply_async()
   └─ Return pipeline_id
6. Celery Pipeline → process_web_kb_task()
   ├─ Scrape with Crawl4AI
   ├─ Chunk content
   ├─ Generate embeddings (local model)
   ├─ Index to Qdrant
   └─ Update KB status
```

### New File Upload Flow (Same Pattern!)

```
1. Create Draft (Redis) → SAME
2. Add File Sources → kb_draft_service.add_file_sources() ← NEW
3. Configure → SAME
4. Preview → Frontend shows extracted content
5. Finalize → SAME (process_web_kb_task handles both!)
6. Celery Pipeline → process_web_kb_task() ← EXTENDED
   ├─ Route by source type:
   │  ├─ web_url: Existing Crawl4AI flow
   │  └─ file_upload: NEW file processing
   ├─ Chunk content → SAME
   ├─ Generate embeddings → SAME
   ├─ Index to Qdrant → SAME
   └─ Update KB status → SAME
```

**Key Insight:** We're just adding a new source type to the existing pipeline!

---

## Minimal Docker Changes

### Add Apache Tika (Only New Service)

**File:** `backend/docker-compose.dev.yml`

```yaml
# Add this service ONLY
services:
  # ... existing services (postgres, redis, qdrant, backend, celery workers)

  tika-server:
    image: apache/tika:latest-full
    container_name: privexbot-tika
    restart: unless-stopped
    ports:
      - "9998:9998"
    environment:
      # Increase heap for large docs
      JAVA_OPTS: "-Xms1g -Xmx2g"
    networks:
      - backend
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9998/tika"]
      interval: 30s
      timeout: 10s
      retries: 3
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 3G

networks:
  backend:
    # Existing network
```

**That's it for Docker!** Everything else already exists.

---

## Implementation (Extend Existing Code)

### 1. Add Dependencies (Minimal)

**File:** `backend/pyproject.toml`

```toml
[project]
dependencies = [
    # Existing dependencies...

    # NEW: Document processing (minimal set)
    "python-magic>=0.4.27",     # MIME type detection
    "aiohttp>=3.9.0",           # Tika HTTP client
    "pdfplumber>=0.11.0",       # PDF tables (optional)
    "python-docx>=1.1.0",       # DOCX (optional)
    "openpyxl>=3.1.0",          # XLSX (optional)
    "pytesseract>=0.3.10",      # OCR (optional)
]
```

### 2. Create Tika Service (New File)

**File:** `backend/src/app/services/tika_service.py`

```python
"""
Apache Tika Integration - Universal Document Parser
"""
import aiohttp
import logging
from typing import Dict, Any
from app.core.config import settings

logger = logging.getLogger(__name__)


class TikaService:
    """Parse documents using Apache Tika server"""

    def __init__(self):
        self.tika_url = getattr(settings, 'TIKA_URL', 'http://tika-server:9998')
        self.parse_endpoint = f"{self.tika_url}/tika"
        self.meta_endpoint = f"{self.tika_url}/meta"

    async def parse_document(self, file_path: str) -> Dict[str, Any]:
        """
        Parse document with Tika.

        Returns:
            {
                "text": str,
                "metadata": Dict,
                "content_type": str
            }
        """
        try:
            with open(file_path, 'rb') as f:
                file_content = f.read()

            async with aiohttp.ClientSession() as session:
                # Parse text
                async with session.put(
                    self.parse_endpoint,
                    data=file_content,
                    headers={'Accept': 'text/plain'},
                    timeout=aiohttp.ClientTimeout(total=300)
                ) as response:
                    if response.status != 200:
                        raise Exception(f"Tika parse failed: {response.status}")
                    text = await response.text()

                # Extract metadata
                async with session.put(
                    self.meta_endpoint,
                    data=file_content,
                    headers={'Accept': 'application/json'},
                    timeout=aiohttp.ClientTimeout(total=60)
                ) as meta_response:
                    metadata = await meta_response.json() if meta_response.status == 200 else {}

                return {
                    "text": text.strip(),
                    "metadata": metadata,
                    "content_type": metadata.get('Content-Type', 'unknown'),
                    "word_count": len(text.split())
                }

        except Exception as e:
            logger.error(f"Tika parsing error: {e}")
            raise


# Singleton
tika_service = TikaService()
```

### 3. Extend KB Draft Service (Modify Existing)

**File:** `backend/src/app/services/kb_draft_service.py` (add this method)

```python
# Add to existing KBDraftService class

async def add_file_sources(
    self,
    draft_id: str,
    files_data: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Add file sources to draft.

    Args:
        draft_id: Draft KB ID
        files_data: List of {
            "filename": str,
            "content": str (extracted text),
            "format": str,
            "metadata": Dict
        }

    Returns:
        Updated draft data
    """
    draft_data = await self.get_draft(draft_id)
    if not draft_data:
        raise ValueError(f"Draft not found: {draft_id}")

    # Add to sources
    sources = draft_data.get("sources", [])

    for file_data in files_data:
        source = {
            "source_id": str(uuid.uuid4()),
            "type": "file_upload",
            "filename": file_data["filename"],
            "format": file_data["format"],
            "content": file_data["content"],
            "metadata": file_data.get("metadata", {}),
            "added_at": datetime.utcnow().isoformat(),
            # Preview pages for frontend
            "previewPages": [{
                "page_number": 1,
                "content": file_data["content"][:5000],  # First 5000 chars
                "edited_content": None
            }]
        }
        sources.append(source)

    draft_data["sources"] = sources

    # Save to Redis
    await self.save_draft(draft_id, draft_data)

    return draft_data
```

### 4. Add File Upload API Endpoint (Extend Existing Routes)

**File:** `backend/src/app/api/v1/routes/kb_draft.py` (add endpoint)

```python
from fastapi import UploadFile, File
from app.services.tika_service import tika_service
import tempfile
import shutil
from pathlib import Path
import magic

# Add this endpoint to existing router

@router.post("/{draft_id}/sources/file")
async def add_file_source(
    draft_id: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db)
):
    """
    Upload file to KB draft.

    Supported formats: PDF, DOCX, XLSX, PPTX, TXT, MD, CSV, HTML, etc.
    """
    # Validate file size (50MB limit)
    MAX_SIZE = 50 * 1024 * 1024
    if file.size and file.size > MAX_SIZE:
        raise HTTPException(400, "File too large (max 50MB)")

    # Save to temp file
    temp_file = Path(tempfile.gettempdir()) / f"{uuid.uuid4()}{Path(file.filename).suffix}"

    try:
        # Save upload
        with temp_file.open("wb") as f:
            shutil.copyfileobj(file.file, f)

        # Detect MIME type
        mime = magic.Magic(mime=True)
        mime_type = mime.from_file(str(temp_file))

        # Process with Tika
        result = await tika_service.parse_document(str(temp_file))

        # Add to draft
        await kb_draft_service.add_file_sources(draft_id, [{
            "filename": file.filename,
            "content": result["text"],
            "format": Path(file.filename).suffix[1:],
            "metadata": {
                **result["metadata"],
                "mime_type": mime_type,
                "file_size": file.size
            }
        }])

        return {
            "success": True,
            "filename": file.filename,
            "format": Path(file.filename).suffix[1:],
            "preview": result["text"][:500],
            "word_count": result["word_count"]
        }

    finally:
        # Cleanup
        if temp_file.exists():
            temp_file.unlink()
```

### 5. Extend Celery Pipeline (Modify Existing)

**File:** `backend/src/app/tasks/kb_pipeline_tasks.py` (modify existing task)

```python
# In existing process_web_kb_task function, add file handling

@shared_task(bind=True, name="process_web_kb")
def process_web_kb_task(self, kb_id, pipeline_id, sources, config, preview_data=None):
    """
    Process KB sources (web URLs OR files).

    EXISTING LOGIC + NEW FILE HANDLING
    """
    # ... existing initialization code ...

    # Process each source
    for source in sources:
        source_type = source.get("type", "web_url")

        if source_type == "web_url":
            # EXISTING: Crawl4AI scraping logic
            # ... keep all existing web scraping code ...
            pass

        elif source_type == "file_upload":
            # NEW: File processing logic
            filename = source.get("filename")
            content = source.get("content")
            metadata = source.get("metadata", {})

            # Check if user edited content
            preview_pages = source.get("previewPages", [])
            if preview_pages and preview_pages[0].get("edited_content"):
                content = preview_pages[0]["edited_content"]

            # Create document record
            document = Document(
                kb_id=kb_id,
                source_type="file_upload",
                source_url=None,
                title=filename,
                content_full=content,
                metadata={
                    **metadata,
                    "filename": filename,
                    "processed_at": datetime.utcnow().isoformat()
                },
                status="ready"
            )
            db.add(document)
            db.commit()

            documents.append(document)

    # ... rest of existing pipeline code (chunking, embedding, indexing) ...
    # ALL EXISTING CODE REMAINS THE SAME!
```

---

## User Configuration API

### Allow Users to Configure Processing

**File:** `backend/src/app/api/v1/routes/kb_draft.py` (add configuration endpoints)

```python
from pydantic import BaseModel, Field

class ChunkingConfig(BaseModel):
    """User-configurable chunking settings"""
    strategy: str = Field("by_heading", description="by_heading, semantic, adaptive, hybrid, no_chunking")
    chunk_size: int = Field(512, ge=128, le=2048, description="Tokens per chunk")
    chunk_overlap: int = Field(50, ge=0, le=500, description="Overlap tokens")
    preview_enabled: bool = Field(True, description="Show chunk preview before finalization")


class EmbeddingConfig(BaseModel):
    """User-configurable embedding settings"""
    model: str = Field("all-MiniLM-L6-v2", description="Embedding model (CPU-optimized)")
    batch_size: int = Field(32, ge=1, le=64, description="Batch size for embedding generation")
    use_quantization: bool = Field(True, description="Use int8 quantization (4.5x speedup)")


class ProcessingConfig(BaseModel):
    """User-configurable processing options"""
    extract_tables: bool = Field(True, description="Extract tables from PDFs")
    use_ocr: bool = Field(False, description="Apply OCR to scanned documents")
    language: str = Field("eng", description="OCR language (eng, fra, spa, etc.)")


@router.put("/{draft_id}/config/chunking")
async def update_chunking_config(
    draft_id: str,
    config: ChunkingConfig,
    current_user: User = Depends(get_current_user)
):
    """Update chunking configuration"""
    await kb_draft_service.update_chunking_config(draft_id, config.dict())
    return {"success": True, "config": config}


@router.put("/{draft_id}/config/embedding")
async def update_embedding_config(
    draft_id: str,
    config: EmbeddingConfig,
    current_user: User = Depends(get_current_user)
):
    """Update embedding configuration"""
    await kb_draft_service.update_embedding_config(draft_id, config.dict())
    return {"success": True, "config": config}


@router.put("/{draft_id}/config/processing")
async def update_processing_config(
    draft_id: str,
    config: ProcessingConfig,
    current_user: User = Depends(get_current_user)
):
    """Update processing configuration"""
    draft_data = await kb_draft_service.get_draft(draft_id)
    draft_data["processing_config"] = config.dict()
    await kb_draft_service.save_draft(draft_id, draft_data)
    return {"success": True, "config": config}
```

---

## CPU Optimization (Already in Your Codebase)

### Use Existing Local Embedding Model

**File:** `backend/src/app/services/embedding_service_local.py` (already exists)

```python
# Your existing service already uses sentence-transformers locally
# Just ensure it's CPU-optimized:

from sentence_transformers import SentenceTransformer

class LocalEmbeddingService:
    def __init__(self):
        # Use CPU-optimized model (already in your code)
        self.model = SentenceTransformer(
            'sentence-transformers/all-MiniLM-L6-v2',
            device='cpu'  # Force CPU
        )

        # Enable int8 quantization (4.5x speedup)
        if hasattr(self.model, 'to'):
            try:
                from optimum.intel import OVModelForFeatureExtraction
                # Convert to OpenVINO int8
                self.model = OVModelForFeatureExtraction.from_pretrained(
                    'sentence-transformers/all-MiniLM-L6-v2',
                    export=True,
                    quantization="int8"
                )
            except ImportError:
                logger.warning("OpenVINO not available, using standard model")

    def encode(self, texts, batch_size=32):
        """Generate embeddings (CPU-optimized)"""
        return self.model.encode(
            texts,
            batch_size=batch_size,
            show_progress_bar=False,
            convert_to_numpy=True
        )
```

---

## Environment Variables

### Add to Existing `.env`

```bash
# Existing variables...

# NEW: Tika Server
TIKA_URL=http://tika-server:9998

# NEW: File Upload Limits
MAX_FILE_SIZE=52428800  # 50 MB
MAX_TOTAL_SIZE_PER_USER=524288000  # 500 MB

# CPU Optimization (if using OpenVINO)
OMP_NUM_THREADS=4
MKL_NUM_THREADS=4
```

---

## Complete API Flow (With User Configuration)

### 1. Create Draft

```bash
POST /api/v1/kb-drafts/
Authorization: Bearer {token}

{
  "name": "My Knowledge Base",
  "description": "Documentation and PDFs"
}

Response:
{
  "draft_id": "draft_123",
  "name": "My Knowledge Base",
  "status": "draft"
}
```

### 2. Configure Chunking (User Control)

```bash
PUT /api/v1/kb-drafts/draft_123/config/chunking
Authorization: Bearer {token}

{
  "strategy": "by_heading",
  "chunk_size": 512,
  "chunk_overlap": 50,
  "preview_enabled": true
}
```

### 3. Configure Processing (User Control)

```bash
PUT /api/v1/kb-drafts/draft_123/config/processing
Authorization: Bearer {token}

{
  "extract_tables": true,
  "use_ocr": false,
  "language": "eng"
}
```

### 4. Upload Files

```bash
POST /api/v1/kb-drafts/draft_123/sources/file
Authorization: Bearer {token}
Content-Type: multipart/form-data

file: document.pdf

Response:
{
  "success": true,
  "filename": "document.pdf",
  "format": "pdf",
  "preview": "This is the extracted content...",
  "word_count": 5000
}
```

### 5. Preview Chunks (Before Finalization)

```bash
GET /api/v1/kb-drafts/draft_123/preview-chunks
Authorization: Bearer {token}

Response:
{
  "estimated_chunks": 45,
  "chunk_preview": [
    {
      "chunk_index": 0,
      "text": "First chunk preview...",
      "token_count": 512
    },
    {
      "chunk_index": 1,
      "text": "Second chunk preview...",
      "token_count": 498
    }
  ],
  "chunking_config": {
    "strategy": "by_heading",
    "chunk_size": 512,
    "chunk_overlap": 50
  }
}
```

### 6. Edit Content (Optional)

```bash
PUT /api/v1/kb-drafts/draft_123/sources/{source_id}/content
Authorization: Bearer {token}

{
  "edited_content": "User-edited version of the content..."
}
```

### 7. Finalize

```bash
POST /api/v1/kb-drafts/draft_123/finalize
Authorization: Bearer {token}

Response:
{
  "kb_id": "kb_456",
  "pipeline_id": "pipeline_789",
  "status": "processing",
  "estimated_time": "2-5 minutes"
}
```

### 8. Monitor Progress

```bash
GET /api/v1/kb-pipeline/pipeline_789/status
Authorization: Bearer {token}

Response:
{
  "status": "processing",
  "stage": "embedding",
  "progress": 65,
  "stats": {
    "total_documents": 3,
    "chunks_created": 45,
    "chunks_embedded": 29,
    "chunks_indexed": 0
  }
}
```

---

## Multi-Tenancy Enforcement (Existing Pattern)

### All Endpoints Use Existing Dependencies

```python
from app.api.v1.dependencies import (
    get_current_user,
    get_current_workspace,
    get_current_organization
)

@router.post("/{draft_id}/sources/file")
async def add_file_source(
    draft_id: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),  # ✅ Already enforced
    workspace: Workspace = Depends(get_current_workspace),  # ✅ Already enforced
    db: Session = Depends(get_db)
):
    # Verify draft belongs to workspace
    draft_data = await kb_draft_service.get_draft(draft_id)
    if draft_data.get("workspace_id") != str(workspace.id):
        raise HTTPException(403, "Access denied")

    # ... rest of logic
```

---

## Testing

### 1. Test Tika Server

```bash
# Upload test document
curl -X PUT "http://localhost:9998/tika" \
  --data-binary "@test.pdf" \
  -H "Accept: text/plain"

# Should return extracted text
```

### 2. Test File Upload API

```bash
# Create draft
DRAFT_ID=$(curl -X POST "http://localhost:8000/api/v1/kb-drafts/" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test KB"}' | jq -r '.draft_id')

# Upload file
curl -X POST "http://localhost:8000/api/v1/kb-drafts/$DRAFT_ID/sources/file" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@document.pdf"

# Preview chunks
curl "http://localhost:8000/api/v1/kb-drafts/$DRAFT_ID/preview-chunks" \
  -H "Authorization: Bearer $TOKEN"

# Finalize
curl -X POST "http://localhost:8000/api/v1/kb-drafts/$DRAFT_ID/finalize" \
  -H "Authorization: Bearer $TOKEN"
```

---

## Performance Expectations (CPU-Optimized)

### Single Celery Worker (CPU)

| Document Type | Processing Time | Throughput |
|---------------|----------------|------------|
| TXT, MD, CSV | <1 second | 200+/hour |
| DOCX, XLSX | 1-3 seconds | 100-150/hour |
| PDF (100 pages) | 3-5 seconds | 60-100/hour |
| PDF with OCR | 10-30 seconds | 20-40/hour |

### Scaling (Add More Workers)

```bash
# In docker-compose.dev.yml, scale workers:
docker compose up -d --scale celery-worker=3

# 3 workers: 300+ docs/hour
# 5 workers: 500+ docs/hour
```

---

## Summary of Changes

### New Files (3 total)
1. `backend/src/app/services/tika_service.py` (~100 lines)
2. Add 1 service to `docker-compose.dev.yml` (~20 lines)
3. This documentation

### Modified Files (3 total)
1. `backend/src/app/services/kb_draft_service.py` (+1 method, ~50 lines)
2. `backend/src/app/api/v1/routes/kb_draft.py` (+4 endpoints, ~200 lines)
3. `backend/src/app/tasks/kb_pipeline_tasks.py` (+file handling, ~50 lines)

### Total New Code: ~420 lines

### Reused (No Changes Needed)
✅ Existing Celery + Redis setup
✅ Existing `process_web_kb_task` pipeline
✅ Existing embedding service (local model)
✅ Existing Qdrant integration
✅ Existing chunking service
✅ Existing multi-tenancy
✅ Existing draft system

---

## Why This Works

1. **Minimal Changes**: Extends existing code, doesn't replace it
2. **Same Pattern**: File upload follows exact same flow as web URLs
3. **Celery + Redis**: Uses what you already have (no RabbitMQ needed)
4. **CPU-Optimized**: Local embeddings with int8 quantization
5. **User Control**: Configuration APIs give users full control
6. **Multi-Tenant**: Uses existing auth and workspace isolation
7. **Draft-First**: Same preview → edit → finalize workflow
8. **Proven**: Leverages already-working web URL pipeline

---

**Next Steps:**
1. Add Tika container to docker-compose
2. Create `tika_service.py`
3. Extend `kb_draft_service.py` with `add_file_sources()`
4. Add file upload endpoint to `kb_draft.py`
5. Extend `process_web_kb_task()` to handle files
6. Test with sample PDFs

**Estimated Implementation Time:** 4-8 hours

---

**Document Version:** 1.0 (Simplified)
**Status:** Ready to Implement
**Complexity:** Low (extends existing patterns)