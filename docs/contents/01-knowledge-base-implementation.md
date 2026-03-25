# PrivexBot Knowledge Base Implementation

## Overview

PrivexBot's Knowledge Base (KB) system is a comprehensive RAG (Retrieval-Augmented Generation) solution that allows users to create AI chatbots powered by custom knowledge. The system follows a **Draft-First Architecture** where all entities are created in draft mode (Redis) before database persistence, preventing database pollution and enabling instant preview.

## Core Architecture

### Multi-Tenant Hierarchy

```
Organization (Company)
  └── Workspace (Team/Department)
        ├── Knowledge Bases (RAG with multiple sources)
        │     ├── Documents (Source files/pages)
        │     └── Chunks (Text segments for retrieval)
        ├── Chatbots (Simple Q&A bots)
        └── Chatflows (Visual workflow automation)
```

### Three-Phase Creation Flow

**Phase 1: Draft Mode (Redis)**
- All KB configuration stored in Redis with 24-hour TTL
- Users add sources, configure chunking, preview content
- No database writes until finalization

**Phase 2: Finalization (PostgreSQL)**
- Validates draft configuration
- Creates KB and Document records
- Queues Celery background task
- Deletes draft from Redis

**Phase 3: Background Processing (Celery)**
- Scrapes web sources / processes files
- Chunks content using configured strategy
- Generates embeddings
- Indexes vectors in Qdrant

## Database Models

### KnowledgeBase Model

```python
class KnowledgeBase(Base):
    __tablename__ = "knowledge_bases"

    # Identity
    id: UUID (primary key)
    name: String(255) (required)
    description: Text (optional)

    # Multi-tenancy (CRITICAL)
    workspace_id: UUID (FK -> workspaces.id, CASCADE DELETE)

    # Processing Status
    status: String(50) = "pending"
    # Values: pending, processing, ready, ready_with_warnings, failed, deleting

    # Configuration (JSONB)
    config: JSONB (chunking_config, embedding_config, etc.)
    context: String(50) = "both"  # chatbot, chatflow, or both
    context_settings: JSONB (retrieval_config, access control)
    embedding_config: JSONB (embedding model settings)
    vector_store_config: JSONB (Qdrant settings)

    # Statistics
    total_documents: Integer = 0
    total_chunks: Integer = 0
    total_tokens: Integer = 0
    last_indexed_at: DateTime

    # Relationships
    documents: List[Document] (one-to-many, cascade delete)
    members: List[KBMember] (one-to-many, cascade delete)
```

**Key Configuration Structures:**

```python
# config field stores:
{
    "chunking_config": {
        "strategy": "by_heading|semantic|adaptive|hybrid|no_chunking",
        "chunk_size": 1000,
        "chunk_overlap": 200,
        "preserve_code_blocks": true
    },
    "embedding_config": {
        "model": "all-MiniLM-L6-v2",
        "batch_size": 32,
        "normalize_embeddings": true
    },
    "vector_store_config": {
        "provider": "qdrant",
        "distance_metric": "cosine"
    }
}

# context_settings stores:
{
    "retrieval_config": {
        "strategy": "hybrid_search",
        "top_k": 5,
        "score_threshold": 0.7,
        "rerank_enabled": false
    }
}
```

### Document Model

```python
class Document(Base):
    __tablename__ = "documents"

    id: UUID (primary key)
    kb_id: UUID (FK -> knowledge_bases.id, CASCADE DELETE)
    workspace_id: UUID (tenant isolation)

    # Source Information
    name: String(500)
    source_type: String(50)  # file_upload, web_scraping, text_input, etc.
    source_url: String(2048)
    source_metadata: JSONB

    # Content Storage
    content_full: Text  # Full document content
    content_preview: Text

    # Processing Status
    status: String(50) = "pending"
    # Values: pending, processing, embedding, completed, failed

    # Statistics
    word_count: Integer
    character_count: Integer
    chunk_count: Integer

    # Relationships
    chunks: List[Chunk] (one-to-many, cascade delete)
```

### Chunk Model

```python
class Chunk(Base):
    __tablename__ = "chunks"

    id: UUID (primary key)
    document_id: UUID (FK -> documents.id, CASCADE DELETE)
    kb_id: UUID (FK -> knowledge_bases.id)

    # Content
    content: Text (required)
    content_hash: String(64) (SHA256 for deduplication)

    # Position & Context
    position: Integer (order within document)
    page_number: Integer
    chunk_metadata: JSONB (heading, element_type, etc.)

    # Size Metrics
    word_count: Integer
    character_count: Integer
    token_count: Integer

    # Embedding (pgvector)
    embedding: Vector(384)  # Matches embedding model dimensions
    embedding_id: String(255)  # Reference to Qdrant
    embedding_metadata: JSONB

    # Quality & Status
    is_enabled: Boolean = True
    quality_score: Float (0.0-1.0)
```

## Supported Source Types

### 1. File Upload
- **Formats**: PDF, Word (DOCX), Excel (XLSX), CSV, JSON, TXT, Markdown, HTML, and 15+ more
- **Processing**: Apache Tika parses documents on backend
- **Features**: Table extraction, formatting preservation, OCR support

### 2. Web Scraping
- **Methods**: Single page scrape or multi-page crawl
- **Configuration**: Max pages, max depth, include/exclude patterns
- **Engine**: Crawl4AI with Jina fallback

### 3. Direct Text Input
- Users can paste text directly

### 4. Integrations (Future)
- Google Docs/Sheets
- Notion
- Confluence

## Knowledge Base Creation Flow

### Step 1: Create Draft
```bash
POST /api/v1/kb-drafts
{
    "name": "Product Documentation",
    "workspace_id": "uuid"
}
```

### Step 2: Add Sources
```bash
# Web source
POST /api/v1/kb-drafts/{draft_id}/web-sources
{
    "url": "https://docs.example.com",
    "config": {
        "method": "crawl",
        "max_pages": 50,
        "max_depth": 3
    }
}

# File upload
POST /api/v1/kb-drafts/{draft_id}/files
Content-Type: multipart/form-data
```

### Step 3: Review & Approve Content
- Preview extracted pages
- Edit content if needed
- Approve specific pages for inclusion

### Step 4: Configure Chunking
```bash
PUT /api/v1/kb-drafts/{draft_id}
{
    "updates": {
        "config": {
            "chunking_config": {
                "strategy": "semantic",
                "chunk_size": 1000,
                "chunk_overlap": 200
            }
        }
    }
}
```

### Step 5: Finalize
```bash
POST /api/v1/kb-drafts/{draft_id}/finalize
```

This creates the KB in PostgreSQL and queues the processing pipeline.

## Pipeline Processing

The background Celery task (`process_web_kb_task`) executes:

1. **Create Qdrant Collection** - Vector storage for this KB
2. **Process Sources** - Scrape web pages or use parsed file content
3. **Parse Content** - Combine all source content
4. **Chunk Content** - Apply configured chunking strategy
5. **Generate Embeddings** - Batch embedding generation
6. **Index in Qdrant** - Store vectors with metadata
7. **Update Statistics** - KB and document counts

### Progress Tracking

Real-time progress tracked in Redis:
```python
{
    "pipeline_id": "kb_uuid:timestamp",
    "status": "running",
    "current_stage": "Generating embeddings",
    "progress_percentage": 80,
    "stats": {
        "pages_discovered": 47,
        "pages_scraped": 45,
        "chunks_created": 850,
        "embeddings_generated": 850,
        "vectors_indexed": 850
    }
}
```

Frontend polls `/api/v1/kb-pipeline/{pipeline_id}/status` for updates.

## Configuration Priority

When retrieving from a KB, configuration priority is:

1. **Caller Override** (highest) - Explicit parameters in API call
2. **KB-Level Config** - From `context_settings.retrieval_config`
3. **Service Defaults** (lowest) - `top_k=5, threshold=0.5, strategy=hybrid`

## Multi-Tenancy

**CRITICAL**: All KB queries MUST filter by workspace:

```python
# Always filter by workspace
kbs = db.query(KnowledgeBase).filter(
    KnowledgeBase.workspace_id == workspace.id
).all()

# Documents also have workspace_id for direct filtering
docs = db.query(Document).filter(
    Document.workspace_id == workspace.id
).all()
```

## Data Privacy

- **Self-Hosted**: All components (PostgreSQL, Qdrant, Celery) run on Secret VM
- **TEE**: Trusted Execution Environment ensures data isolation
- **Encryption**: Sensitive data (API keys, credentials) encrypted at rest
- **Hard Delete**: Users can permanently delete all KB data at any time

## API Endpoints Summary

### Draft Management
- `POST /api/v1/kb-drafts` - Create draft
- `GET /api/v1/kb-drafts/{id}` - Get draft
- `PATCH /api/v1/kb-drafts/{id}` - Update draft
- `DELETE /api/v1/kb-drafts/{id}` - Delete draft
- `POST /api/v1/kb-drafts/{id}/finalize` - Create KB

### Source Management
- `POST /api/v1/kb-drafts/{id}/web-sources` - Add web source
- `POST /api/v1/kb-drafts/{id}/files` - Upload file
- `DELETE /api/v1/kb-drafts/{id}/sources/{source_id}` - Remove source

### Pipeline
- `GET /api/v1/kb-pipeline/{id}/status` - Get pipeline status

### KB Operations
- `GET /api/v1/knowledge-bases` - List KBs
- `GET /api/v1/knowledge-bases/{id}` - Get KB details
- `DELETE /api/v1/knowledge-bases/{id}` - Delete KB
