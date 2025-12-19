# Backend Deep Research: File Upload Architecture & Database Schema Analysis

**Date**: 2025-12-15
**Purpose**: Deep analysis of backend codebase to implement file upload feature with metadata-only storage in PostgreSQL
**Status**: Research Complete - Implementation Ready

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Database Schema Analysis](#database-schema-analysis)
3. [API Endpoint Consistency Review](#api-endpoint-consistency-review)
4. [Current Data Flow Architecture](#current-data-flow-architecture)
5. [File Upload Requirements](#file-upload-requirements)
6. [Schema Change Decision](#schema-change-decision)
7. [Backward Compatibility Analysis](#backward-compatibility-analysis)
8. [Implementation Recommendations](#implementation-recommendations)
9. [Preview Functionality Design](#preview-functionality-design)
10. [Complete Implementation Checklist](#complete-implementation-checklist)

---

## Executive Summary

### Critical Findings

1. **✅ NO SCHEMA CHANGES NEEDED**: Current database schema already supports metadata-only storage for file uploads
2. **✅ API ENDPOINTS ARE CORRECT**: The create draft endpoint already requires `name`, `description`, `context` - documentation was inconsistent
3. **✅ ARCHITECTURE DECISION**: Use conditional logic based on `source_type` to differentiate storage behavior
4. **✅ BACKWARD COMPATIBLE**: File upload implementation will not break existing web URL flow

### Key Decision: Metadata-Only Storage for File Uploads

**For File Uploads (source_type="file_upload")**:
- ✅ Store ONLY metadata in PostgreSQL `Document.source_metadata` (JSONB)
- ✅ Set `Document.content_full = None` (no content in DB)
- ✅ Content goes directly: Parse → Chunk → Embed → Qdrant
- ✅ No content duplication in PostgreSQL

**For Web URLs (source_type="web_scraping")** - UNCHANGED:
- ✅ Store full content in PostgreSQL `Document.content_full` (Text)
- ✅ Also store in: Chunks → Embeddings → Qdrant
- ✅ Existing behavior preserved

### Architecture Overview

```
FILE UPLOAD FLOW (New):
User uploads file → Tika parses → Extract text → Store ONLY metadata in DB → Chunk → Embed → Qdrant

WEB URL FLOW (Existing):
User adds URL → Crawl4AI scrapes → Store full content in DB → Chunk → Embed → Qdrant
```

---

## Database Schema Analysis

### 1. Document Model (`models/document.py`)

**Current Schema**:
```python
class Document(Base):
    __tablename__ = "documents"

    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Multi-tenancy
    kb_id = Column(UUID(as_uuid=True), ForeignKey("knowledge_bases.id", ondelete="CASCADE"), nullable=False, index=True)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)

    # Basic info
    name = Column(String(500), nullable=False)

    # Source information - CRITICAL FOR FILE UPLOAD
    source_type = Column(String(50), nullable=False, index=True)
    # Types: file_upload, text_input, web_scraping, google_docs, notion, confluence, api

    source_url = Column(String(2048), nullable=True)
    source_metadata = Column(JSONB, nullable=False, default=dict)  # ← PERFECT FOR FILE METADATA

    # Storage - CRITICAL FIELD
    file_path = Column(String(1024), nullable=True)
    content_preview = Column(Text, nullable=True)
    content_full = Column(Text, nullable=True)  # ← NULLABLE - Key to metadata-only storage

    # Processing status
    status = Column(String(50), nullable=False, default="pending", index=True)
    # pending, processing, embedding, completed, failed, disabled, archived

    # Content statistics
    word_count = Column(Integer, nullable=False, default=0)
    character_count = Column(Integer, nullable=False, default=0)
    page_count = Column(Integer, nullable=True)
    chunk_count = Column(Integer, nullable=False, default=0)

    # User metadata (custom fields for filtering)
    custom_metadata = Column(JSONB, nullable=False, default=dict)

    # Chunking configuration (document-level override)
    chunking_config = Column(JSONB, nullable=True)

    # Annotations (help AI understand document better)
    annotations = Column(JSONB, nullable=True)

    # Relationships
    knowledge_base = relationship("KnowledgeBase", back_populates="documents")
    workspace = relationship("Workspace")
    creator = relationship("User")
    chunks = relationship("Chunk", back_populates="document", cascade="all, delete-orphan")
```

### 2. Key Fields for File Upload

| Field | Purpose | File Upload Usage | Web URL Usage |
|-------|---------|-------------------|---------------|
| `source_type` | Differentiate source | `"file_upload"` | `"web_scraping"` |
| `source_metadata` | Store source-specific metadata | **File metadata** (filename, size, mime_type, hash) | Web scraping metadata (crawled_at, depth) |
| `content_full` | Store full document content | **`None`** (metadata-only) | Full scraped markdown content |
| `file_path` | Path to stored file | Temporary upload path (if needed) | `None` |
| `content_preview` | Preview text | First 500 chars of extracted text | First 500 chars of scraped text |

### 3. File Upload Metadata Structure

**Proposed `source_metadata` for File Uploads**:
```json
{
  "original_filename": "Q4_Report.pdf",
  "file_size_bytes": 2048576,
  "mime_type": "application/pdf",
  "file_hash_sha256": "abc123...def456",
  "upload_date": "2025-12-15T10:30:00Z",
  "processing_method": "tika",
  "tika_version": "2.9.1",
  "page_count": 45,
  "extraction_time_ms": 3450,
  "storage_strategy": "metadata_only",
  "content_stored_in": "qdrant_vectors_only"
}
```

### 4. Chunk Model (`models/chunk.py`)

**Current Schema** - UNCHANGED:
```python
class Chunk(Base):
    __tablename__ = "chunks"

    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Parent document
    document_id = Column(UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    kb_id = Column(UUID(as_uuid=True), ForeignKey("knowledge_bases.id", ondelete="CASCADE"), nullable=False, index=True)

    # Content - ALWAYS STORED IN POSTGRESQL
    content = Column(Text, nullable=False)
    content_hash = Column(String(64), index=True)  # SHA256 hash for deduplication

    # Position and context
    position = Column(Integer, nullable=False, index=True)
    chunk_index = Column(Integer, nullable=False)
    page_number = Column(Integer, nullable=True)

    # Chunk metadata
    chunk_metadata = Column(JSONB, nullable=False, default=dict)

    # Embedding (pgvector)
    embedding = Column(Vector(384), nullable=True)  # All-MiniLM-L6-v2
    embedding_id = Column(String(255), nullable=True)  # Reference to Qdrant

    # Relationships
    document = relationship("Document", back_populates="chunks")
    knowledge_base = relationship("KnowledgeBase")
```

**NOTE**: Chunks are ALWAYS stored in PostgreSQL for both web URLs and file uploads. The difference is:
- **File uploads**: Only chunks stored in PostgreSQL, NOT full document content
- **Web URLs**: Both full content AND chunks stored in PostgreSQL

### 5. KnowledgeBase Model (`models/knowledge_base.py`)

**Current Schema** - UNCHANGED:
```python
class KnowledgeBase(Base):
    __tablename__ = "knowledge_bases"

    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Basic info
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)

    # Multi-tenancy
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)

    # Processing status
    status = Column(String(50), nullable=False, default="pending", index=True)
    # pending, processing, ready, ready_with_warnings, failed

    # Configuration
    config = Column(JSONB, nullable=False, default=dict)
    # Example: {
    #     "chunking": {"strategy": "by_heading", "chunk_size": 1000, "chunk_overlap": 200},
    #     "embedding": {"model": "all-MiniLM-L6-v2", "device": "cpu"},
    #     "scraping": {"max_pages": 50, "max_depth": 3}
    # }

    # Context-based access control
    context = Column(String(50), nullable=False, default="both", index=True)
    # chatbot, chatflow, both

    # Relationships
    workspace = relationship("Workspace", back_populates="knowledge_bases")
    creator = relationship("User")
    documents = relationship("Document", back_populates="knowledge_base", cascade="all, delete-orphan")
```

---

## API Endpoint Consistency Review

### CREATE DRAFT ENDPOINT - ✅ ALREADY CORRECT

**File**: `api/v1/routes/kb_draft.py`

**Request Model**:
```python
class CreateKBDraftRequest(BaseModel):
    """Request model for creating KB draft"""
    name: str = Field(..., min_length=1, max_length=255, description="KB name")
    description: Optional[str] = Field(None, description="KB description")
    workspace_id: UUID = Field(..., description="Workspace ID")
    context: str = Field(default="both", description="Context: chatbot, chatflow, or both")
```

**Endpoint**:
```python
@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_kb_draft(
    request: CreateKBDraftRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Validate workspace exists
    workspace = db.query(Workspace).filter(
        Workspace.id == request.workspace_id
    ).first()

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
            "chunking_config": {...},
            "embedding_config": {...}
        }
    )
```

**✅ VERDICT**: API endpoint is CORRECT - no changes needed. My previous documentation was inconsistent.

**Required Fields**:
- ✅ `name` - Required (KB name)
- ✅ `description` - Optional (KB description)
- ✅ `workspace_id` - Required (workspace ID)
- ✅ `context` - Required with default `"both"` (chatbot, chatflow, or both)

---

## Current Data Flow Architecture

### Web URL Flow (Existing - UNCHANGED)

```
PHASE 1: Draft Creation (Redis)
User → Create Draft → Add Web URLs → Configure Chunking → Preview → Validate

PHASE 2: Finalization (PostgreSQL)
Finalize Draft → Create KB record → Create Document placeholders → Queue Celery task

PHASE 3: Background Processing (Celery)
Scrape web pages (Crawl4AI)
    ↓
Parse markdown content
    ↓
Store full content in Document.content_full ← FULL CONTENT IN POSTGRESQL
    ↓
Chunk content (chunking_service)
    ↓
Store chunks in Chunk table ← CHUNKS IN POSTGRESQL
    ↓
Generate embeddings (embedding_service)
    ↓
Store embeddings in Qdrant ← VECTORS IN QDRANT
    ↓
Update KB status to "ready"
```

**Key Points**:
- ✅ Full scraped content stored in `Document.content_full`
- ✅ Chunks stored in `Chunk` table
- ✅ Embeddings stored in Qdrant
- ✅ Triple storage: Full content + Chunks + Vectors

### File Upload Flow (NEW - To Implement)

```
PHASE 1: Draft Creation (Redis)
User → Create Draft → Upload Files → Configure Chunking → Preview → Validate

PHASE 2: Finalization (PostgreSQL)
Finalize Draft → Create KB record → Create Document placeholders → Queue Celery task

PHASE 3: Background Processing (Celery)
Parse uploaded files (Apache Tika)
    ↓
Extract text content
    ↓
Store ONLY metadata in Document.source_metadata ← METADATA ONLY IN POSTGRESQL
    ↓
Set Document.content_full = None ← NO CONTENT IN POSTGRESQL
    ↓
Chunk content (chunking_service)
    ↓
Store chunks in Chunk table ← CHUNKS IN POSTGRESQL
    ↓
Generate embeddings (embedding_service)
    ↓
Store embeddings in Qdrant ← VECTORS IN QDRANT
    ↓
Update KB status to "ready"
```

**Key Points**:
- ❌ NO full content stored in `Document.content_full`
- ✅ ONLY metadata stored in `Document.source_metadata`
- ✅ Chunks stored in `Chunk` table
- ✅ Embeddings stored in Qdrant
- ✅ Dual storage: Chunks + Vectors (NO full content duplication)

---

## File Upload Requirements

### User Flow Requirement

```
1. Create Draft (Redis) → SAME AS WEB URL
   - Endpoint: POST /api/v1/kb-drafts/
   - Fields: name, description, workspace_id, context

2. Add File Sources → NEW ENDPOINT NEEDED
   - Endpoint: POST /api/v1/kb-drafts/{draft_id}/sources/file
   - Method: Upload file via multipart/form-data
   - Parse file with Tika immediately
   - Store extracted text + metadata in Redis draft

3. Configure Chunking → SAME AS WEB URL
   - Endpoint: POST /api/v1/kb-drafts/{draft_id}/chunking
   - Same chunking strategies apply

4. Preview Chunks → ENHANCED
   - Endpoint: POST /api/v1/kb-drafts/{draft_id}/preview-chunks-live
   - Allow preview with ALL chunking strategies including no_chunking
   - Show how chunk_size, chunk_overlap, separators affect content

5. Finalize Draft → EXTEND EXISTING
   - Endpoint: POST /api/v1/kb-drafts/{draft_id}/finalize
   - Create KB + Document records
   - Queue Celery task: process_web_kb_task (EXTEND to handle files)

6. Celery Pipeline → EXTEND EXISTING
   - Task: process_web_kb_task (rename to process_kb_task?)
   - Route by source_type:
     - web_scraping: Existing Crawl4AI flow
     - file_upload: NEW Tika flow
   - Different storage logic based on source_type
```

### Critical Requirements from User

1. **Metadata-Only Storage**: File uploads store ONLY metadata in PostgreSQL, NOT actual content
2. **Preview with All Strategies**: Users must preview content with all chunk strategies (including no_chunking)
3. **Chunk Configuration Effects**: Users must see how chunk_size, chunk_overlap, separators affect their content
4. **Backward Compatibility**: Must not break existing web URL flow
5. **Consistent API Patterns**: Follow same draft → configure → preview → finalize pattern

---

## Schema Change Decision

### Option 1: No Schema Changes (RECOMMENDED) ✅

**Approach**: Use existing schema with conditional logic based on `source_type`

**How It Works**:
- Use `Document.source_type = "file_upload"` to differentiate
- For file uploads: Set `Document.content_full = None`
- Store file metadata in `Document.source_metadata` (JSONB already exists)
- Chunks and embeddings stored same as web URLs

**Pros**:
- ✅ No database migration needed
- ✅ Backward compatible with existing data
- ✅ Simple conditional logic in pipeline
- ✅ `source_metadata` JSONB already designed for this
- ✅ `content_full` is already nullable
- ✅ Immediate implementation

**Cons**:
- ⚠️ Requires clear documentation for developers
- ⚠️ Need to handle `content_full = None` in queries

**Implementation**:
```python
# In Celery pipeline task (process_web_kb_task)

if source.get("type") == "file_upload":
    # File upload flow - metadata only
    document = Document(
        kb_id=UUID(kb_id),
        workspace_id=kb.workspace_id,
        name=file_metadata["original_filename"],
        source_type="file_upload",  # ← Differentiate
        source_url=None,
        source_metadata={  # ← File metadata
            "original_filename": "report.pdf",
            "file_size_bytes": 2048576,
            "mime_type": "application/pdf",
            "file_hash_sha256": "abc123...",
            "upload_date": "2025-12-15T10:30:00Z",
            "processing_method": "tika",
            "page_count": 45,
            "storage_strategy": "metadata_only"
        },
        file_path=temp_file_path,
        content_preview=extracted_text[:500],
        content_full=None,  # ← NO CONTENT IN DB
        status="pending"
    )

elif source.get("type") == "web_scraping":
    # Web URL flow - existing behavior
    document = Document(
        kb_id=UUID(kb_id),
        workspace_id=kb.workspace_id,
        name=page_title,
        source_type="web_scraping",  # ← Differentiate
        source_url=page_url,
        source_metadata={  # ← Web scraping metadata
            "crawled_at": "2025-12-15T10:30:00Z",
            "crawl_depth": 2,
            "parent_url": base_url
        },
        file_path=None,
        content_preview=scraped_content[:500],
        content_full=scraped_content,  # ← FULL CONTENT IN DB
        status="pending"
    )
```

**Verdict**: **RECOMMENDED APPROACH** ✅

### Option 2: Add `store_content_in_db` Boolean Flag

**Approach**: Add new column to explicitly track storage strategy

**Schema Change**:
```python
class Document(Base):
    # ... existing fields ...

    store_content_in_db = Column(Boolean, nullable=False, default=True)
    # True: Store content_full (web URLs)
    # False: Metadata only (file uploads)
```

**Pros**:
- ✅ Explicit and self-documenting
- ✅ Easy to query which documents have content
- ✅ Future-proof for other storage strategies

**Cons**:
- ❌ Requires Alembic migration
- ❌ More fields to maintain
- ❌ Delayed implementation

**Verdict**: **NOT RECOMMENDED** - Unnecessary complexity

### Option 3: Separate FileDocument Model

**Approach**: Create separate model for file uploads

**Schema Change**:
```python
class FileDocument(Base):
    __tablename__ = "file_documents"

    id = Column(UUID, primary_key=True)
    document_id = Column(UUID, ForeignKey("documents.id"))
    original_filename = Column(String(500))
    file_size_bytes = Column(Integer)
    mime_type = Column(String(100))
    # ... file-specific fields
```

**Pros**:
- ✅ Clean separation of concerns
- ✅ File-specific validation

**Cons**:
- ❌ Requires migration and new model
- ❌ More complex queries (JOINs)
- ❌ Duplicate fields between models

**Verdict**: **NOT RECOMMENDED** - Over-engineering

---

## Backward Compatibility Analysis

### Impact on Existing Web URL Flow

**Query**: Will file upload implementation break existing web URL processing?

**Answer**: ✅ **NO - Fully Backward Compatible**

**Reasoning**:
1. **Conditional Logic**: Pipeline uses `source_type` to route processing
2. **Existing Behavior Preserved**: Web scraping path unchanged
3. **Schema Already Supports Both**: `content_full` nullable, `source_metadata` JSONB flexible
4. **No Breaking Changes**: Existing KB records unaffected

### Example: Pipeline Routing

```python
@shared_task(bind=True, name="process_kb")
def process_kb_task(self, kb_id, pipeline_id, sources, config):
    """Process KB with routing by source type"""

    for source in sources:
        source_type = source.get("type")

        if source_type == "file_upload":
            # NEW: File upload processing
            extracted_text = parse_file_with_tika(file_path)
            document = create_document_metadata_only(extracted_text, file_metadata)
            chunks = chunk_content(extracted_text)
            embeddings = generate_embeddings(chunks)
            index_in_qdrant(embeddings)

        elif source_type == "web_scraping":
            # EXISTING: Web scraping processing (UNCHANGED)
            scraped_pages = crawl_website(url)
            document = create_document_with_full_content(scraped_pages)
            chunks = chunk_content(document.content_full)
            embeddings = generate_embeddings(chunks)
            index_in_qdrant(embeddings)

        elif source_type == "google_docs":
            # FUTURE: Google Docs integration
            pass
```

### Testing Backward Compatibility

**Test Cases**:
1. ✅ Create new KB with web URLs → Should work as before
2. ✅ Create new KB with file uploads → Should use metadata-only storage
3. ✅ Mixed KB (web + files) → Both flows should work independently
4. ✅ Query existing KBs → Should return results correctly
5. ✅ Retrieve chunks from existing KBs → Should work as before

---

## Implementation Recommendations

### Recommended Approach

**Use Option 1 (No Schema Changes)** with clear conditional logic:

1. **NO DATABASE MIGRATION NEEDED**
2. **Extend Existing Services**:
   - Add `add_file_source_to_draft()` to `kb_draft_service.py`
   - Extend `process_web_kb_task` to handle file uploads
3. **Create New Services**:
   - `tika_service.py` - Apache Tika integration (~100 lines)
4. **Add New Endpoint**:
   - `POST /api/v1/kb-drafts/{draft_id}/sources/file` - File upload (~100 lines)
5. **Conditional Storage Logic**:
   - In pipeline: Check `source_type` → Route to appropriate handler
   - File uploads: `content_full = None`, metadata in `source_metadata`
   - Web URLs: `content_full = <content>`, metadata in `source_metadata`

### Code Organization

```
backend/src/app/
├── services/
│   ├── kb_draft_service.py (EXTEND)
│   │   └── add_file_source_to_draft() ← NEW METHOD
│   ├── tika_service.py (NEW)
│   │   ├── parse_file()
│   │   ├── extract_metadata()
│   │   └── validate_file_type()
│   └── ... (existing services)
│
├── api/v1/routes/
│   └── kb_draft.py (EXTEND)
│       └── POST /{draft_id}/sources/file ← NEW ENDPOINT
│
├── tasks/
│   └── kb_pipeline_tasks.py (EXTEND)
│       └── process_web_kb_task() ← ADD FILE HANDLING
│
└── models/
    └── document.py (NO CHANGES)
```

### Storage Decision Matrix

| Source Type | `content_full` | `source_metadata` | `Chunks` | `Qdrant` |
|-------------|----------------|-------------------|----------|----------|
| `web_scraping` | ✅ Full content | Web metadata | ✅ Chunks | ✅ Vectors |
| `file_upload` | ❌ `None` | **File metadata** | ✅ Chunks | ✅ Vectors |
| `google_docs` | ✅ Full content | Google metadata | ✅ Chunks | ✅ Vectors |
| `notion` | ✅ Full content | Notion metadata | ✅ Chunks | ✅ Vectors |

**Pattern**: Only `file_upload` uses metadata-only storage to avoid duplication.

---

## Preview Functionality Design

### User Requirement

> "Users should be able to preview full their full content with all the chunk strategies including no_chunk strategy, and they should be able to see how the chunk overlap, chunk size, separators etc affect their content chunks"

### Preview Endpoint Enhancement

**Existing Endpoint**: `POST /api/v1/kb-drafts/{draft_id}/preview-chunks-live`

**Enhancement Needed**:
1. ✅ Support ALL chunking strategies:
   - `by_heading` - Chunk by document headings
   - `semantic` - Semantic similarity chunking
   - `adaptive` - Adaptive chunking based on content
   - `hybrid` - Hybrid approach
   - `no_chunking` / `full_content` - Return full document as single chunk

2. ✅ Show configuration effects:
   - **Chunk Size**: How content is split based on size
   - **Chunk Overlap**: How chunks overlap to preserve context
   - **Separators**: Custom separators for chunking

3. ✅ Return metrics:
   - Total chunks created
   - Average chunk size
   - Min/max chunk size
   - Overlap percentage
   - Retrieval speed estimate
   - Context quality score

### Preview Response Format

```json
{
  "chunks": [
    {
      "content": "Chunk content here...",
      "index": 0,
      "token_count": 150,
      "char_count": 650,
      "has_overlap": false,
      "overlap_content": null
    },
    {
      "content": "Next chunk content...",
      "index": 1,
      "token_count": 140,
      "char_count": 600,
      "has_overlap": true,
      "overlap_content": "...overlapping text from previous chunk..."
    }
  ],
  "metrics": {
    "total_chunks": 15,
    "avg_chunk_size": 625,
    "min_chunk_size": 450,
    "max_chunk_size": 800,
    "total_tokens": 2100,
    "overlap_percentage": 20,
    "estimated_cost": 0.00021,
    "retrieval_speed": "fast",
    "context_quality": "high"
  }
}
```

### No Chunking Strategy Handling

```python
# In preview endpoint
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
        "estimated_cost": (len(content) // 4) * 0.0001,
        "retrieval_speed": "fast" if len(content) < 2000 else "moderate",
        "context_quality": "high"  # Full context always high
    }
```

---

## Complete Implementation Checklist

### Phase 1: Infrastructure Setup (1 hour)

- [ ] Add Apache Tika to `docker-compose.dev.yml`
  ```yaml
  tika-server:
    image: apache/tika:latest-full
    ports:
      - "9998:9998"
    environment:
      - TIKA_CONFIG=/tika-config.xml
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9998/tika"]
      interval: 30s
      timeout: 10s
      retries: 3
  ```

- [ ] Start Tika server: `docker compose -f docker-compose.dev.yml up -d tika-server`
- [ ] Verify Tika: `curl http://localhost:9998/tika`
- [ ] Add dependencies to `pyproject.toml`:
  ```toml
  dependencies = [
    # ... existing dependencies
    "aiohttp>=3.9.0",  # For async Tika requests
    "python-magic>=0.4.27"  # For MIME type detection
  ]
  ```
- [ ] Install: `uv sync`

### Phase 2: Service Implementation (2-3 hours)

- [ ] Create `tika_service.py` (~100 lines)
  - `parse_file(file_path: str) -> Dict[str, Any]`
  - `extract_text(file_path: str) -> str`
  - `extract_metadata(file_path: str) -> Dict`
  - `validate_file_type(mime_type: str) -> bool`

- [ ] Extend `kb_draft_service.py` (~50 lines)
  - Add `add_file_source_to_draft(draft_id, file_data, file_metadata)`
  - Validate file types (PDF, DOCX, TXT, CSV, etc.)
  - Store file metadata in Redis draft

### Phase 3: API Endpoint (1 hour)

- [ ] Add file upload endpoint to `kb_draft.py` (~100 lines)
  ```python
  @router.post("/{draft_id}/sources/file")
  async def add_file_source(
      draft_id: str,
      file: UploadFile = File(...),
      current_user: User = Depends(get_current_user),
      workspace: Workspace = Depends(get_current_workspace),
  ):
      # 1. Save temp file
      # 2. Parse with Tika
      # 3. Extract text + metadata
      # 4. Add to draft sources
      # 5. Return source_id
  ```

### Phase 4: Pipeline Extension (2-3 hours)

- [ ] Extend `process_web_kb_task` in `kb_pipeline_tasks.py` (~50 lines)
  ```python
  # Add routing logic
  if source.get("type") == "file_upload":
      # File upload processing
      extracted_text = tika_service.extract_text(file_path)
      file_metadata = tika_service.extract_metadata(file_path)

      # Create document with metadata only
      document = Document(
          kb_id=UUID(kb_id),
          workspace_id=kb.workspace_id,
          name=file_metadata["original_filename"],
          source_type="file_upload",
          source_url=None,
          source_metadata=file_metadata,
          file_path=None,  # Delete temp file after processing
          content_preview=extracted_text[:500],
          content_full=None,  # ← METADATA ONLY
          status="pending"
      )

      # Chunk → Embed → Index (same as web URLs)
      chunks = chunk_content(extracted_text)
      embeddings = generate_embeddings(chunks)
      index_in_qdrant(embeddings)

  elif source.get("type") == "web_scraping":
      # Existing web scraping flow (UNCHANGED)
      pass
  ```

### Phase 5: Preview Enhancement (1-2 hours)

- [ ] Enhance `POST /{draft_id}/preview-chunks-live` endpoint
  - Support `no_chunking` / `full_content` strategy
  - Show metrics for all strategies
  - Display overlap effects
  - Return retrieval speed estimates

### Phase 6: Testing (1-2 hours)

- [ ] Unit Tests:
  - Test `tika_service.parse_file()`
  - Test `kb_draft_service.add_file_source_to_draft()`
  - Test file upload endpoint
  - Test pipeline routing logic

- [ ] Integration Tests:
  - Upload PDF → Parse → Preview → Finalize → Process
  - Upload DOCX → Parse → Preview → Finalize → Process
  - Upload TXT → Parse → Preview → Finalize → Process
  - Mixed KB (web URLs + files) → Both should work
  - Verify `content_full = None` for file uploads
  - Verify chunks created correctly
  - Verify embeddings in Qdrant

- [ ] Backward Compatibility Tests:
  - Create KB with only web URLs → Should work as before
  - Query existing KBs → Should return correct results
  - Retrieve chunks from existing KBs → Should work

### Phase 7: Documentation Update (30 minutes)

- [ ] Update `FINAL_IMPLEMENTATION_SUMMARY.md` with accurate endpoint specs
- [ ] Fix endpoint inconsistencies in documentation
- [ ] Add file upload flow diagrams
- [ ] Document metadata-only storage decision
- [ ] Add troubleshooting guide

---

## Summary

### Key Decisions Made

1. **✅ NO DATABASE MIGRATION REQUIRED**
   - Use existing `Document.content_full` (nullable)
   - Use existing `Document.source_metadata` (JSONB)
   - Use existing `Document.source_type` for routing

2. **✅ METADATA-ONLY STORAGE FOR FILE UPLOADS**
   - Set `content_full = None` for file uploads
   - Store file metadata in `source_metadata`
   - Content goes directly to: Chunks → Embeddings → Qdrant

3. **✅ BACKWARD COMPATIBLE**
   - Web URL flow unchanged
   - Conditional logic based on `source_type`
   - Existing KBs unaffected

4. **✅ CONSISTENT API PATTERNS**
   - Follow same draft → configure → preview → finalize flow
   - Extend existing services, don't create redundant ones

5. **✅ ENHANCED PREVIEW FUNCTIONALITY**
   - Support ALL chunk strategies including no_chunking
   - Show effects of chunk_size, chunk_overlap, separators
   - Return comprehensive metrics

### Implementation Complexity

| Component | Lines of Code | Complexity |
|-----------|---------------|------------|
| Tika Service | ~100 lines | Low |
| Draft Service Extension | ~50 lines | Low |
| API Endpoint | ~100 lines | Low |
| Pipeline Extension | ~50 lines | Medium |
| Preview Enhancement | ~50 lines | Low |
| **TOTAL** | **~350 lines** | **Low-Medium** |

### Estimated Timeline

- **Infrastructure Setup**: 1 hour
- **Service Implementation**: 2-3 hours
- **API Endpoint**: 1 hour
- **Pipeline Extension**: 2-3 hours
- **Preview Enhancement**: 1-2 hours
- **Testing**: 1-2 hours
- **Documentation**: 30 minutes

**Total**: 8-12 hours

---

## Next Steps

1. **Review this document** with the team for approval
2. **Create implementation branch**: `feature/file-upload-metadata-only`
3. **Follow the checklist** above step-by-step
4. **Test backward compatibility** at each step
5. **Update documentation** with accurate API specs
6. **Deploy to staging** for QA testing
7. **Production deployment** after approval

---

**Document Version**: 1.0
**Last Updated**: 2025-12-15
**Status**: Research Complete - Ready for Implementation
**Review Required**: Yes - Team approval needed before implementation
