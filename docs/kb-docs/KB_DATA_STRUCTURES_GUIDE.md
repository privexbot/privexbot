# Knowledge Base Data Structures Guide

This comprehensive guide covers the complete data architecture of PrivexBot Knowledge Bases, including documents, chunks, embeddings, vector points, and metadata structures. It provides detailed analysis of both **Web URL** and **File Upload** flows and how different chunking strategies influence the data structures.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Storage Strategy Decision](#storage-strategy-decision)
3. [Document Model](#document-model)
4. [Chunk Model](#chunk-model)
5. [Embedding Structure](#embedding-structure)
6. [Qdrant Vector Points](#qdrant-vector-points)
7. [Web URL Flow - Complete Data Journey](#web-url-flow---complete-data-journey)
8. [File Upload Flow - Complete Data Journey](#file-upload-flow---complete-data-journey)
9. [Chunking Strategy Impact on Data Structures](#chunking-strategy-impact-on-data-structures)
10. [Metadata Reference](#metadata-reference)
11. [Best Practices](#best-practices)

---

## Architecture Overview

### Dual Storage Architecture

PrivexBot uses a **dual storage architecture** with different strategies for different source types:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         KNOWLEDGE BASE DATA FLOW                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────┐                        ┌─────────────┐                     │
│  │  WEB URLs   │                        │FILE UPLOADS │                     │
│  └──────┬──────┘                        └──────┬──────┘                     │
│         │                                      │                             │
│         ▼                                      ▼                             │
│  ┌─────────────────────┐              ┌─────────────────────┐               │
│  │ Crawl4AI Scraping   │              │ Tika OCR Parsing    │               │
│  └──────────┬──────────┘              └──────────┬──────────┘               │
│             │                                    │                           │
│             ▼                                    ▼                           │
│  ┌──────────────────────────────────────────────────────────────────┐       │
│  │                    CHUNKING SERVICE                               │       │
│  │  (Strategy: recursive, by_heading, semantic, adaptive, etc.)      │       │
│  └──────────────────────────────────────────────────────────────────┘       │
│             │                                    │                           │
│             ▼                                    ▼                           │
│  ┌──────────────────────────────────────────────────────────────────┐       │
│  │                    EMBEDDING SERVICE                              │       │
│  │  (Model: all-MiniLM-L6-v2, 384 dimensions)                       │       │
│  └──────────────────────────────────────────────────────────────────┘       │
│             │                                    │                           │
│             ▼                                    ▼                           │
│  ┌─────────────────────┐              ┌─────────────────────┐               │
│  │   HYBRID STORAGE    │              │  QDRANT-ONLY STORAGE│               │
│  │                     │              │                     │               │
│  │ PostgreSQL:         │              │ PostgreSQL:         │               │
│  │  • Document record  │              │  • Document record  │               │
│  │  • content_full ✓   │              │  • content_full ✗   │               │
│  │  • Chunk records ✓  │              │  • Chunk records ✗  │               │
│  │                     │              │                     │               │
│  │ Qdrant:             │              │ Qdrant:             │               │
│  │  • Vectors          │              │  • Vectors          │               │
│  │  • Metadata         │              │  • Full content     │               │
│  │  • Content copy     │              │  • Metadata         │               │
│  └─────────────────────┘              └─────────────────────┘               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Files

| Component | File Path | Purpose |
|-----------|-----------|---------|
| Document Model | `backend/src/app/models/document.py` | PostgreSQL document storage |
| Chunk Model | `backend/src/app/models/chunk.py` | PostgreSQL chunk storage |
| Qdrant Service | `backend/src/app/services/qdrant_service.py` | Vector storage operations |
| Embedding Service | `backend/src/app/services/embedding_service_local.py` | Vector generation |
| Chunking Service | `backend/src/app/services/chunking_service.py` | Text chunking |
| Pipeline Tasks | `backend/src/app/tasks/kb_pipeline_tasks.py` | Processing orchestration |

---

## Storage Strategy Decision

### Decision Logic

The storage strategy is determined at the start of processing:

```python
# Check ALL sources in the KB
all_file_uploads = all(s.get("type") == "file_upload" for s in sources)

if all_file_uploads:
    storage_strategy = "qdrant_only"      # Option A
    skip_postgres_chunks = True
else:
    storage_strategy = "hybrid"           # Default
    skip_postgres_chunks = False
```

### Storage Strategy Comparison

| Aspect | Web URLs (Hybrid) | File Uploads (Qdrant-Only) |
|--------|-------------------|---------------------------|
| **PostgreSQL Documents** | Full content stored | Metadata only |
| **PostgreSQL Chunks** | Created and stored | NOT created |
| **Qdrant Vectors** | Stored with metadata | Stored with full content |
| **Content Redundancy** | Content in both stores | Content only in Qdrant |
| **Storage Efficiency** | Higher disk usage | Lower disk usage |
| **Retrieval Speed** | PostgreSQL for quick access | Qdrant payload access |
| **KB Stats** | `storage_type: "hybrid"` | `storage_type: "qdrant_only"` |

### Why Different Strategies?

**Web URLs (Hybrid Storage):**
- Content may change, need PostgreSQL for updates
- Quick chunk access for editing/preview
- Full-text search via PostgreSQL

**File Uploads (Qdrant-Only):**
- Content is immutable (files don't change)
- Save PostgreSQL storage space
- Content already parsed, no need for double storage

---

## Document Model

### Core Fields

```python
class Document(Base):
    __tablename__ = "documents"

    # Primary Keys & Relationships
    id: UUID                          # Auto-generated UUID
    kb_id: UUID                       # Foreign key to knowledge_bases
    workspace_id: UUID                # Multi-tenancy isolation

    # Identification
    name: String(500)                 # Document title/filename
    source_type: String(50)           # "file_upload" | "web_scraping" | "text_input"
    source_url: String(2048)          # Original URL or file:///path
    file_path: String(1024)           # Path for uploaded files

    # Content Storage (CRITICAL DIFFERENCE)
    content_full: Text                # Full content (NULL for file uploads)
    content_preview: Text             # First 500 chars (NULL for file uploads)

    # Status & Lifecycle
    status: String(50)                # "pending" | "processing" | "completed" | "failed"
    is_enabled: Boolean               # Soft disable flag
    is_archived: Boolean              # Archive flag
    processing_progress: Integer      # 0-100 percentage
    error_message: Text               # Error details if failed

    # Statistics
    word_count: Integer
    character_count: Integer
    page_count: Integer
    chunk_count: Integer

    # Metadata (JSONB)
    source_metadata: JSONB            # Source-specific info
    processing_metadata: JSONB        # Processing results
    chunking_config: JSONB            # Per-document chunking override
    custom_metadata: JSONB            # User-defined metadata

    # Audit
    created_by: UUID
    created_at: DateTime
    updated_at: DateTime
```

### Document Storage by Source Type

#### Web URL Document

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "kb_id": "660e8400-e29b-41d4-a716-446655440111",
  "workspace_id": "770e8400-e29b-41d4-a716-446655440222",
  "name": "API Documentation - Page 1",
  "source_type": "web_scraping",
  "source_url": "https://docs.example.com/api",
  "file_path": null,

  "content_full": "# API Documentation\n\nThis is the full content of the scraped page...",
  "content_preview": "# API Documentation\n\nThis is the full content...",

  "status": "completed",
  "word_count": 1500,
  "character_count": 8500,
  "page_count": 1,
  "chunk_count": 12,

  "source_metadata": {
    "crawled_at": "2024-12-19T10:30:00Z",
    "crawl_depth": 1,
    "page_url": "https://docs.example.com/api",
    "page_title": "API Documentation",
    "content_source": "user_approved",
    "approved_sources": ["source_12345"]
  },

  "processing_metadata": {
    "processed_at": "2024-12-19T10:32:00Z",
    "chunks_created": 12,
    "embeddings_generated": 12,
    "storage_strategy": "dual_storage",
    "chunk_storage_location": "postgresql_and_qdrant",
    "postgres_chunks_created": 12,
    "qdrant_chunks_created": 12
  }
}
```

#### File Upload Document

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "kb_id": "660e8400-e29b-41d4-a716-446655440111",
  "workspace_id": "770e8400-e29b-41d4-a716-446655440222",
  "name": "Product Manual.pdf",
  "source_type": "file_upload",
  "source_url": "file:///Product Manual.pdf",
  "file_path": "/uploads/kb_660e8400/Product Manual.pdf",

  "content_full": null,
  "content_preview": null,

  "status": "completed",
  "word_count": 2500,
  "character_count": 14000,
  "page_count": 15,
  "chunk_count": 18,

  "source_metadata": {
    "original_filename": "Product Manual.pdf",
    "file_size": 2048000,
    "mime_type": "application/pdf",
    "file_hash": "sha256:abc123...",
    "page_count": 15,
    "parsed_at": "2024-12-19T10:25:00Z"
  },

  "processing_metadata": {
    "processed_at": "2024-12-19T10:32:00Z",
    "chunks_created": 18,
    "embeddings_generated": 18,
    "storage_strategy": "qdrant_only",
    "chunk_storage_location": "qdrant_only",
    "postgres_chunks_created": 0,
    "qdrant_chunks_created": 18
  }
}
```

### Key Differences

| Field | Web URL | File Upload |
|-------|---------|-------------|
| `source_type` | `"web_scraping"` | `"file_upload"` |
| `source_url` | `"https://..."` | `"file:///filename"` |
| `content_full` | Full scraped content | `null` |
| `content_preview` | First 500 chars | `null` |
| `source_metadata.page_url` | HTTP URL | N/A |
| `source_metadata.original_filename` | N/A | Original filename |
| `processing_metadata.chunk_storage_location` | `"postgresql_and_qdrant"` | `"qdrant_only"` |
| `processing_metadata.postgres_chunks_created` | Actual count | `0` |

---

## Chunk Model

### Core Fields

```python
class Chunk(Base):
    __tablename__ = "chunks"

    # Primary Keys & Relationships
    id: UUID                          # Auto-generated UUID
    document_id: UUID                 # Foreign key to documents
    kb_id: UUID                       # Foreign key to knowledge_bases

    # Content
    content: Text                     # Chunk text content
    content_hash: String(64)          # SHA256 for deduplication

    # Positioning
    position: Integer                 # Order within document (0-indexed)
    chunk_index: Integer              # Global chunk number
    page_number: Integer              # For multi-page documents

    # Statistics
    word_count: Integer
    character_count: Integer
    token_count: Integer

    # Embedding (PostgreSQL pgvector)
    embedding: Vector(384)            # 384-dimensional vector
    embedding_id: String(255)         # External reference
    embedding_metadata: JSONB         # Generation details

    # Metadata
    chunk_metadata: JSONB             # Rich contextual metadata
    keywords: ARRAY(String)           # Extracted keywords
    quality_score: Float              # 0-1 quality ranking

    # Status
    is_enabled: Boolean
    is_edited: Boolean

    # Audit
    created_at: DateTime
    updated_at: DateTime
```

### Chunk Creation by Storage Strategy

#### Web URL Chunks (PostgreSQL + Qdrant)

**PostgreSQL Record:**
```json
{
  "id": "880e8400-e29b-41d4-a716-446655440000",
  "document_id": "550e8400-e29b-41d4-a716-446655440000",
  "kb_id": "660e8400-e29b-41d4-a716-446655440111",

  "content": "## Authentication\n\nTo authenticate with the API, you need to...",
  "content_hash": "sha256:def456...",

  "position": 3,
  "chunk_index": 3,
  "page_number": 1,

  "word_count": 180,
  "character_count": 1050,
  "token_count": 262,

  "embedding": [0.0234, -0.0567, 0.0891, ...],

  "chunk_metadata": {
    "strategy": "by_heading",
    "chunk_size": 1000,
    "chunk_overlap": 200,
    "parent_heading": "## Authentication",
    "heading_level": 2,
    "section_title": "Authentication",
    "context_before": "...previous chunk ending...",
    "context_after": "...next chunk beginning...",
    "word_count": 180,
    "character_count": 1050,
    "token_count": 262,
    "user_preference": true,
    "workspace_id": "770e8400-e29b-41d4-a716-446655440222",
    "created_at": "2024-12-19T10:32:00Z",
    "enhanced_metadata_enabled": true
  },

  "keywords": ["authentication", "api", "token", "bearer"],
  "quality_score": 0.92
}
```

#### File Upload Chunks (Qdrant Only)

**No PostgreSQL Record Created!**

File upload chunks are stored **ONLY** in Qdrant. The chunk content and metadata exist solely in the Qdrant vector payload.

### Chunk Metadata Structure

```json
{
  "strategy": "by_heading",
  "chunk_size": 1000,
  "chunk_overlap": 200,
  "user_preference": true,
  "adaptive_suggestion": "by_heading",
  "reasoning": "User configured: strategy=by_heading, chunk_size=1000",

  "parent_heading": "## Authentication",
  "heading_level": 2,
  "section_title": "Authentication",

  "context_before": "...last 100 chars of previous chunk...",
  "context_after": "...first 100 chars of next chunk...",

  "word_count": 180,
  "character_count": 1050,
  "token_count": 262,

  "element_type": "text",
  "content_type": "documentation",
  "language": "en",
  "contains_code": false,

  "workspace_id": "770e8400-e29b-41d4-a716-446655440222",
  "created_at": "2024-12-19T10:32:00Z",
  "enhanced_metadata_enabled": true,

  "document_analysis": {
    "heading_count": 12,
    "heading_density": 0.06,
    "paragraph_count": 45,
    "recommended_strategy": "by_heading"
  }
}
```

---

## Embedding Structure

### Embedding Models

| Model | Dimensions | Max Tokens | Speed | Quality | Size |
|-------|------------|------------|-------|---------|------|
| **all-MiniLM-L6-v2** (Default) | 384 | 256 | Fast | Good | 90MB |
| all-MiniLM-L12-v2 | 384 | 256 | Medium | Better | 120MB |
| all-mpnet-base-v2 | 768 | 384 | Slow | Best | 420MB |
| paraphrase-multilingual-MiniLM-L12-v2 | 384 | 128 | Medium | Good | 470MB |

### Embedding Generation Process

```
Chunks (List[str])
        │
        ▼
┌─────────────────────────────────────────┐
│  MultiModelEmbeddingService             │
│  ─────────────────────────────────────  │
│  1. Load model (cached after first use) │
│  2. Batch texts (default: 32 per batch) │
│  3. Generate embeddings                 │
│  4. Normalize vectors (for cosine sim)  │
│  5. Return List[List[float]]            │
└─────────────────────────────────────────┘
        │
        ▼
Embeddings (List[384-dim vectors])
```

### Embedding Storage

#### PostgreSQL (Web URLs Only)

```python
# In Chunk model
embedding = Column(Vector(384), nullable=True)

# Stored as pgvector type
# Enables: vector similarity search via PostgreSQL
```

#### Qdrant (Both Source Types)

```python
# PointStruct for Qdrant
point = models.PointStruct(
    id=chunk_id,                    # UUID as string
    vector=[0.0234, -0.0567, ...],  # 384-dim float array
    payload={                        # All metadata + content
        "content": "chunk text...",
        "document_id": "uuid",
        ...
    }
)
```

### Embedding Metadata

```json
{
  "model": "all-MiniLM-L6-v2",
  "provider": "sentence_transformers",
  "dimensions": 384,
  "generated_at": "2024-12-19T10:32:00Z",
  "generation_time_ms": 45,
  "batch_id": "batch_001",
  "normalized": true
}
```

---

## Qdrant Vector Points

### Point Structure

```python
PointStruct(
    id="880e8400-e29b-41d4-a716-446655440000",  # Chunk UUID
    vector=[0.0234, -0.0567, 0.0891, ...],      # 384 floats
    payload={...}                                # Rich metadata
)
```

### Collection Configuration

```python
# Collection naming: kb_{kb_id}
collection_name = f"kb_{str(kb_id).replace('-', '_')}"
# Example: kb_660e8400_e29b_41d4_a716_446655440111

# Vector configuration
vectors_config = models.VectorParams(
    size=384,                              # Dimensions
    distance=models.Distance.COSINE        # Similarity metric
)

# HNSW index parameters
hnsw_config = models.HnswConfigDiff(
    m=16,                                  # Connections per node
    ef_construct=100                       # Construction accuracy
)
```

### Payload Structure - Web URL

```json
{
  "content": "## Authentication\n\nTo authenticate with the API...",

  "document_id": "550e8400-e29b-41d4-a716-446655440000",
  "document_name": "API Documentation - Page 1",
  "kb_id": "660e8400-e29b-41d4-a716-446655440111",
  "workspace_id": "770e8400-e29b-41d4-a716-446655440222",

  "kb_context": "chatbot",

  "source_type": "web_scraping",
  "source_url": "https://docs.example.com/api",
  "page_url": "https://docs.example.com/api#authentication",
  "page_title": "API Documentation",

  "chunk_index": 3,
  "word_count": 180,
  "character_count": 1050,
  "token_count": 262,

  "chunking_strategy": "by_heading",
  "chunk_size": 1000,
  "chunk_overlap": 200,
  "content_type": "documentation",
  "user_configured": true,

  "embedding_model": "all-MiniLM-L6-v2",
  "storage_location": "qdrant_and_postgres",
  "indexed_at": "2024-12-19T10:32:00Z",

  "context_before": "...previous chunk ending...",
  "context_after": "...next chunk beginning...",
  "parent_heading": "## Authentication",
  "section_title": "Authentication",
  "enhanced_metadata_enabled": true
}
```

### Payload Structure - File Upload

```json
{
  "content": "Chapter 3: Product Features\n\nOur product offers...",

  "document_id": "550e8400-e29b-41d4-a716-446655440001",
  "document_name": "Product Manual.pdf",
  "kb_id": "660e8400-e29b-41d4-a716-446655440111",
  "workspace_id": "770e8400-e29b-41d4-a716-446655440222",

  "kb_context": "chatbot",

  "source_type": "file_upload",
  "original_filename": "Product Manual.pdf",
  "page_url": "file:///Product Manual.pdf",
  "page_title": "Product Manual.pdf",

  "chunk_index": 5,
  "word_count": 220,
  "character_count": 1280,
  "token_count": 320,

  "chunking_strategy": "by_heading",
  "chunk_size": 1000,
  "chunk_overlap": 200,
  "content_type": "documentation",
  "user_configured": true,

  "embedding_model": "all-MiniLM-L6-v2",
  "storage_location": "qdrant_only",
  "indexed_at": "2024-12-19T10:32:00Z",

  "context_before": "...previous chunk ending...",
  "context_after": "...next chunk beginning...",
  "parent_heading": "Chapter 3: Product Features",
  "section_title": "Product Features",
  "enhanced_metadata_enabled": true
}
```

### Key Payload Differences

| Field | Web URL | File Upload |
|-------|---------|-------------|
| `source_type` | `"web_scraping"` | `"file_upload"` |
| `source_url` | HTTP URL | N/A |
| `original_filename` | N/A | Original filename |
| `page_url` | HTTP URL with anchor | `"file:///filename"` |
| `storage_location` | `"qdrant_and_postgres"` | `"qdrant_only"` |

---

## Web URL Flow - Complete Data Journey

### Phase 1: Draft Creation (Redis)

```
User adds URL
      │
      ▼
┌─────────────────────────────────────────┐
│ Draft Service (kb_draft_service.py)     │
│ ───────────────────────────────────────│
│ 1. Create draft in Redis                │
│ 2. Scrape URL with Crawl4AI             │
│ 3. Store preview_pages in draft         │
│ 4. User approves/edits content          │
└─────────────────────────────────────────┘
      │
      ▼
Redis Draft Structure:
{
  "id": "draft_123",
  "sources": [{
    "id": "source_456",
    "type": "web_scraping",
    "urls": ["https://docs.example.com/api"],
    "scraped_pages": [{
      "url": "https://docs.example.com/api",
      "title": "API Docs",
      "content": "Scraped content...",
      "edited_content": "User-edited content...",
      "is_edited": true
    }]
  }],
  "chunking_config": {...},
  "embedding_config": {...}
}
```

### Phase 2: Finalization (Draft → PostgreSQL)

```
User clicks "Finalize"
      │
      ▼
┌─────────────────────────────────────────┐
│ Finalize Endpoint (kb_draft.py)         │
│ ───────────────────────────────────────│
│ 1. Create KB record in PostgreSQL       │
│ 2. Create placeholder Documents         │
│ 3. Queue Celery task                    │
│ 4. Return pipeline_id for tracking      │
└─────────────────────────────────────────┘
      │
      ▼
PostgreSQL KB:
{
  "id": "kb_789",
  "status": "processing",
  "total_documents": 0,
  "total_chunks": 0
}
```

### Phase 3: Pipeline Processing (Celery Task)

```
Celery Task: process_web_kb_task
      │
      ▼
┌─────────────────────────────────────────────────────────────────┐
│ Step 1: Content Extraction                                       │
│ ─────────────────────────────────────────────────────────────── │
│ • Use approved/edited content if available                       │
│ • Fall back to scraped content                                   │
│ • Apply content normalization                                    │
└─────────────────────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────────────┐
│ Step 2: Document Creation                                        │
│ ─────────────────────────────────────────────────────────────── │
│ • Update placeholder document                                    │
│ • SET content_full = approved_content ✓                          │
│ • SET content_preview = first 500 chars ✓                        │
│ • SET source_type = "web_scraping"                              │
└─────────────────────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────────────┐
│ Step 3: Chunking                                                 │
│ ─────────────────────────────────────────────────────────────── │
│ • Apply configured strategy (by_heading, semantic, etc.)         │
│ • Generate chunk metadata                                        │
│ • Preserve code blocks if enabled                                │
└─────────────────────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────────────┐
│ Step 4: Embedding Generation                                     │
│ ─────────────────────────────────────────────────────────────── │
│ • Batch process all chunks                                       │
│ • Generate 384-dim vectors                                       │
│ • Normalize for cosine similarity                                │
└─────────────────────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────────────┐
│ Step 5: Dual Storage (HYBRID)                                    │
│ ─────────────────────────────────────────────────────────────── │
│                                                                  │
│ PostgreSQL:                          Qdrant:                     │
│ ┌──────────────────────┐            ┌──────────────────────┐    │
│ │ chunks table         │            │ kb_{kb_id} collection│    │
│ │ • content            │            │ • vector (384-dim)   │    │
│ │ • embedding          │            │ • content (payload)  │    │
│ │ • chunk_metadata     │            │ • full metadata      │    │
│ │ • position           │            │                      │    │
│ └──────────────────────┘            └──────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
      │
      ▼
Final KB State:
{
  "status": "ready",
  "total_documents": 1,
  "total_chunks": 12,
  "total_vectors": 12,
  "stats": {
    "storage_type": "hybrid",
    "postgres_chunks_created": 12,
    "qdrant_chunks_created": 12
  }
}
```

### Web URL Data Summary

| Stage | PostgreSQL | Qdrant | Redis |
|-------|------------|--------|-------|
| Draft | - | - | Full draft with sources |
| Finalize | KB record, placeholder docs | - | Draft cleared |
| Processing | Documents updated, chunks created | Vectors + metadata | Pipeline status |
| Complete | Full content, all chunks | Full vectors | Cleared |

---

## File Upload Flow - Complete Data Journey

### Phase 1: Draft Creation (Redis + Tika)

```
User uploads file
      │
      ▼
┌─────────────────────────────────────────┐
│ Draft Service (kb_draft_service.py)     │
│ ───────────────────────────────────────│
│ 1. Parse file with Tika (OCR if needed) │
│ 2. Extract content and metadata         │
│ 3. Store in Redis draft                 │
│ 4. User reviews/edits content           │
└─────────────────────────────────────────┘
      │
      ▼
Redis Draft Structure:
{
  "id": "draft_123",
  "sources": [{
    "id": "source_456",
    "type": "file_upload",
    "filename": "Product Manual.pdf",
    "parsed_content": "Tika-extracted text...",
    "file_metadata": {
      "original_filename": "Product Manual.pdf",
      "file_size": 2048000,
      "mime_type": "application/pdf",
      "page_count": 15
    },
    "preview_pages": [{
      "content": "Page content...",
      "edited_content": "User-edited content...",
      "is_edited": true
    }]
  }],
  "chunking_config": {...},
  "embedding_config": {...}
}
```

### Phase 2: Finalization (Draft → PostgreSQL)

```
User clicks "Finalize"
      │
      ▼
┌─────────────────────────────────────────┐
│ Finalize Endpoint (kb_draft.py)         │
│ ───────────────────────────────────────│
│ 1. Create KB record in PostgreSQL       │
│ 2. Create placeholder Documents         │
│    (metadata only, no content_full)     │
│ 3. Queue Celery task                    │
│ 4. Return pipeline_id for tracking      │
└─────────────────────────────────────────┘
      │
      ▼
PostgreSQL KB:
{
  "id": "kb_789",
  "status": "processing",
  "total_documents": 0,
  "total_chunks": 0
}
```

### Phase 3: Pipeline Processing (Celery Task)

```
Celery Task: process_web_kb_task
      │
      ▼
┌─────────────────────────────────────────────────────────────────┐
│ Step 1: Source Type Detection                                    │
│ ─────────────────────────────────────────────────────────────── │
│ • Check: source.get("type") == "file_upload"                    │
│ • Set: all_file_uploads = True                                   │
│ • Set: skip_postgres_chunks = True                               │
└─────────────────────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────────────┐
│ Step 2: Document Creation (METADATA ONLY)                        │
│ ─────────────────────────────────────────────────────────────── │
│ • Update placeholder document                                    │
│ • SET content_full = NULL ✗                                      │
│ • SET content_preview = NULL ✗                                   │
│ • SET source_type = "file_upload"                               │
└─────────────────────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────────────┐
│ Step 3: Chunking                                                 │
│ ─────────────────────────────────────────────────────────────── │
│ • Apply configured strategy                                      │
│ • Generate chunk metadata                                        │
│ • Content from parsed_content (Tika output)                     │
└─────────────────────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────────────┐
│ Step 4: Embedding Generation                                     │
│ ─────────────────────────────────────────────────────────────── │
│ • Batch process all chunks                                       │
│ • Generate 384-dim vectors                                       │
│ • Normalize for cosine similarity                                │
└─────────────────────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────────────┐
│ Step 5: Qdrant-Only Storage (OPTION A)                          │
│ ─────────────────────────────────────────────────────────────── │
│                                                                  │
│ PostgreSQL:                          Qdrant:                     │
│ ┌──────────────────────┐            ┌──────────────────────┐    │
│ │ chunks table         │            │ kb_{kb_id} collection│    │
│ │ • NO RECORDS ✗       │            │ • vector (384-dim)   │    │
│ │                      │            │ • FULL content       │    │
│ │                      │            │ • full metadata      │    │
│ └──────────────────────┘            └──────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
      │
      ▼
Final KB State:
{
  "status": "ready",
  "total_documents": 1,
  "total_chunks": 18,
  "total_vectors": 18,
  "stats": {
    "storage_type": "qdrant_only",
    "postgres_chunks_created": 0,
    "qdrant_chunks_created": 18
  }
}
```

### File Upload Data Summary

| Stage | PostgreSQL | Qdrant | Redis |
|-------|------------|--------|-------|
| Draft | - | - | Full draft with parsed content |
| Finalize | KB record, placeholder docs | - | Draft cleared |
| Processing | Documents updated (metadata only) | Vectors + FULL content | Pipeline status |
| Complete | Metadata only, NO chunks | Full vectors + content | Cleared |

---

## Chunking Strategy Impact on Data Structures

### Strategy Comparison Table

| Strategy | Chunks Created | Metadata Added | Best For |
|----------|---------------|----------------|----------|
| **no_chunking** | 1 (entire doc) | `strategy_used` only | Short docs (<2000 chars) |
| **recursive** | 10-20 | Basic metadata | General content |
| **by_heading** | 8-12 | `parent_heading`, `heading_level` | Documentation |
| **semantic** | 6-10 | `semantic_threshold`, similarity scores | Q&A, retrieval |
| **adaptive** | 8-15 | `adaptive_suggestion`, document_analysis | Unknown content |
| **paragraph_based** | 12-18 | `paragraph_count` | Well-structured text |
| **hybrid** | 8-12 | Combined heading + paragraph | Complex docs |

### No Chunking Strategy

Creates exactly **1 chunk** from the entire document.

```json
{
  "chunk_metadata": {
    "strategy": "no_chunking",
    "chunk_size": 15000,
    "chunk_overlap": 0,
    "word_count": 3500,
    "character_count": 15000
  }
}
```

**Impact:**
- 1 document → 1 chunk → 1 embedding → 1 Qdrant point
- Entire document context preserved
- May exceed token limits for large docs

### By Heading Strategy

Splits at markdown heading boundaries.

```json
{
  "chunk_metadata": {
    "strategy": "by_heading",
    "parent_heading": "## Authentication",
    "heading_level": 2,
    "section_title": "Authentication",
    "context_before": "...end of previous section...",
    "context_after": "...start of next section..."
  }
}
```

**Impact:**
- Natural section boundaries
- Headings preserved in chunks
- Good for documentation retrieval

### Semantic Strategy

Groups paragraphs by topic similarity.

```json
{
  "chunk_metadata": {
    "strategy": "semantic",
    "semantic_threshold": 0.65,
    "grouped_paragraphs": 3,
    "similarity_to_next": 0.42
  }
}
```

**Impact:**
- Fewer, more coherent chunks
- Topics stay together
- Better for Q&A retrieval

### Adaptive Strategy

Auto-selects based on content analysis.

```json
{
  "chunk_metadata": {
    "strategy": "adaptive",
    "adaptive_suggestion": "by_heading",
    "reasoning": "High heading density (6.00%)",
    "document_analysis": {
      "heading_count": 12,
      "heading_density": 0.06,
      "paragraph_count": 45,
      "recommended_strategy": "by_heading"
    }
  }
}
```

**Impact:**
- Optimal strategy per document
- Rich analysis metadata
- Best for mixed content KBs

### Chunk Count by Strategy (15,000 char document)

```
no_chunking:     █ 1 chunk
semantic:        ██████ 6-10 chunks
by_heading:      ████████ 8-12 chunks
adaptive:        ████████████ 8-15 chunks
paragraph_based: ████████████████ 12-18 chunks
recursive:       ████████████████████ 15-20 chunks
```

---

## Metadata Reference

### Document Metadata Fields

#### source_metadata (JSONB)

| Field | Web URL | File Upload | Description |
|-------|---------|-------------|-------------|
| `page_url` | HTTP URL | N/A | Source page URL |
| `page_title` | Page title | N/A | Extracted title |
| `crawled_at` | ISO timestamp | N/A | When scraped |
| `crawl_depth` | Integer | N/A | Crawl depth level |
| `original_filename` | N/A | Filename | Original file name |
| `file_size` | N/A | Bytes | File size |
| `mime_type` | N/A | MIME string | File MIME type |
| `file_hash` | N/A | SHA256 | Deduplication hash |
| `page_count` | N/A | Integer | Pages in document |
| `content_source` | "user_approved" | "file_upload" | Content origin |
| `approved_sources` | Source IDs | N/A | Approved source list |

#### processing_metadata (JSONB)

| Field | Description |
|-------|-------------|
| `processed_at` | ISO timestamp of processing |
| `chunks_created` | Number of chunks created |
| `embeddings_generated` | Number of embeddings |
| `storage_strategy` | "dual_storage" or "qdrant_only" |
| `chunk_storage_location` | "postgresql_and_qdrant" or "qdrant_only" |
| `postgres_chunks_created` | PostgreSQL chunk count |
| `qdrant_chunks_created` | Qdrant chunk count |
| `processing_duration_ms` | Processing time |

### Chunk Metadata Fields

#### chunk_metadata (JSONB)

| Field | Description | Strategy-Specific |
|-------|-------------|-------------------|
| `strategy` | Chunking strategy used | All |
| `chunk_size` | Size parameter | All |
| `chunk_overlap` | Overlap parameter | All |
| `word_count` | Words in chunk | All |
| `character_count` | Characters in chunk | All |
| `token_count` | Estimated tokens | All |
| `user_preference` | User configured? | All |
| `adaptive_suggestion` | What adaptive recommended | All |
| `reasoning` | Decision explanation | All |
| `parent_heading` | Section heading | by_heading, adaptive |
| `heading_level` | Heading level (1-6) | by_heading |
| `section_title` | Clean section title | by_heading |
| `semantic_threshold` | Similarity threshold | semantic |
| `grouped_paragraphs` | Paragraphs combined | semantic |
| `similarity_to_next` | Score to next chunk | semantic |
| `document_analysis` | Full analysis object | adaptive |
| `context_before` | Previous chunk ending | Enhanced |
| `context_after` | Next chunk beginning | Enhanced |
| `enhanced_metadata_enabled` | Enhanced mode flag | Enhanced |

### Qdrant Payload Fields

| Field | Description | Filterable |
|-------|-------------|------------|
| `content` | Chunk text | No (text search) |
| `document_id` | Parent document UUID | Yes |
| `document_name` | Document name | No |
| `kb_id` | Knowledge base UUID | Yes |
| `workspace_id` | Workspace UUID | Yes |
| `kb_context` | "chatbot"/"chatflow"/"both" | Yes |
| `source_type` | "web_scraping"/"file_upload" | Yes |
| `chunk_index` | Position in document | Yes |
| `word_count` | Words in chunk | Yes |
| `chunking_strategy` | Strategy used | Yes |
| `storage_location` | Storage type | Yes |
| `indexed_at` | Index timestamp | No |

---

## Best Practices

### Web URL KBs

1. **Use hybrid search** - Leverages both PostgreSQL and Qdrant
2. **Enable enhanced metadata** - For context preservation
3. **Choose by_heading** for documentation
4. **Review content before finalizing** - Edit scraped content if needed

### File Upload KBs

1. **Ensure quality scans** - 300 DPI minimum for OCR
2. **Use adaptive strategy** - Let system analyze content
3. **Monitor Qdrant health** - Only storage for content
4. **Check processing logs** - Verify OCR accuracy

### Mixed Source KBs

1. **All sources use hybrid storage** - One web URL forces hybrid mode
2. **Consistent chunking** - Same strategy for all sources
3. **Consider separate KBs** - For different content types

### Chunking Strategy Selection

| Content Type | Recommended Strategy | Chunk Size |
|--------------|---------------------|------------|
| API Documentation | by_heading | 1000 |
| FAQ/Q&A | no_chunking or semantic | 800 |
| Legal Documents | paragraph_based | 1500 |
| Technical Guides | adaptive | 1000 |
| Mixed Content | hybrid | 1000 |
| Short Documents | no_chunking | - |

### Performance Optimization

1. **Limit chunk count** - Target 10-20 chunks per document
2. **Use appropriate overlap** - 10-20% of chunk size
3. **Enable enhanced metadata** only when needed
4. **Monitor storage usage** - Qdrant-only saves space

---

## Related Documentation

- [KB Creation Guide](./KB_CREATION_GUIDE.md) - Complete KB creation workflow
- [KB File Upload Guide](./KB_FILE_UPLOAD_GUIDE.md) - File upload processing
- [KB Chunking Strategies Guide](./KB_CHUNKING_STRATEGIES_GUIDE.md) - Chunking configuration
- [KB Retrieval Config Guide](./KB_RETRIEVAL_CONFIG_GUIDE.md) - Search configuration
- [KB Multimodal Config Guide](./KB_MULTIMODAL_CONFIG_GUIDE.md) - OCR and multimodal

---

*Last Updated: December 2024*
*PrivexBot Knowledge Base System v1.0*
