# Knowledge Base Architecture Deep Dive

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [Architecture Overview](#architecture-overview)
3. [Core Concepts & Definitions](#core-concepts--definitions)
4. [KB Creation Flow (URL Sources)](#kb-creation-flow-url-sources)
5. [Document Addition Flow](#document-addition-flow)
6. [Chunking Strategies & Configuration](#chunking-strategies--configuration)
7. [Vector Store Architecture (Qdrant)](#vector-store-architecture-qdrant)
8. [Data Flow Patterns](#data-flow-patterns)
9. [Current Implementation Analysis](#current-implementation-analysis)
10. [Recommendations & Configuration Options](#recommendations--configuration-options)

---

## Executive Summary

PrivexBot's Knowledge Base system implements a **3-phase draft-first architecture** for creating and managing RAG-powered knowledge bases. The system supports multiple source types (web URLs, file uploads, text input), multiple chunking strategies, and uses a self-hosted Qdrant vector database for privacy-focused embedding storage.

### Key Architectural Principles
- **Draft-First**: All KB creation starts in Redis (draft mode) before database commits
- **Background Processing**: Heavy operations (scraping, chunking, embedding) run in Celery tasks
- **One Collection Per KB**: Each Knowledge Base gets its own Qdrant collection
- **Additive Document Model**: New documents are added to existing KBs without reprocessing existing documents
- **Configurable Chunking**: Different chunking strategies per KB with inheritance to document level

---

## Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   FRONTEND      │    │    BACKEND      │    │  VECTOR STORE   │
│                 │    │                 │    │                 │
│ KB Creation     │───▶│ Draft Service   │    │ Qdrant          │
│ Wizard          │    │ (Redis)         │    │ Collections     │
│                 │    │                 │    │                 │
│ Document        │───▶│ KB Pipeline     │───▶│ kb_{kb_id}      │
│ Management      │    │ Tasks (Celery)  │    │                 │
│                 │    │                 │    │ Embedding       │
│ Chunking        │───▶│ Chunking        │───▶│ Vectors +       │
│ Config          │    │ Service         │    │ Metadata        │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Zustand Store   │    │ PostgreSQL      │    │ Search &        │
│ (React State)   │    │                 │    │ Retrieval       │
│                 │    │ - KnowledgeBases│    │                 │
│ - Draft State   │    │ - Documents     │    │ Cosine          │
│ - Pipeline      │    │ - Chunks        │    │ Similarity      │
│   Progress      │    │ - Metadata      │    │ + Metadata      │
│ - Configuration │    │                 │    │ Filtering       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

---

## Core Concepts & Definitions

### 1. Knowledge Base (KB)
- **Definition**: A collection of processed documents with shared configuration
- **Database Table**: `knowledge_bases`
- **Qdrant Collection**: `kb_{kb_id}` (e.g., `kb_123e4567-e89b-12d3-a456-426614174000`)
- **Configuration**: Chunking strategy, embedding model, processing quality

### 2. Sources vs Documents
- **Source**: Input material specified during KB creation (URLs, files, text)
- **Document**: Database record created from processed sources
- **Relationship**: 1 Source → 1+ Documents (URL crawls can create multiple documents)

### 3. Chunks
- **Definition**: Text segments created from documents for embedding
- **Database Table**: `chunks`
- **Vector Store**: Each chunk becomes one vector in Qdrant
- **Metadata**: Preserves document context, position, and processing info

### 4. Collections in Qdrant
- **Structure**: One collection per Knowledge Base
- **Naming**: `kb_{kb_id}`
- **Content**: Embedding vectors + metadata for all chunks in that KB
- **Isolation**: Complete data separation between different KBs

### 5. Processing Quality (Indexing Method)
- **High Quality**: Smaller batches (16), high-res parsing, thorough analysis
- **Balanced**: Medium batches (32), auto strategy, moderate analysis
- **Fast**: Large batches (64), fast parsing, basic analysis

---

## KB Creation Flow (URL Sources)

### Phase 1: Draft Mode (Frontend → Redis)
**Location**: Frontend KB Creation Wizard → `kb_draft_service.py`

```typescript
// Frontend Flow
1. User starts KB creation wizard
2. Enters basic info (name, description)
3. Adds web URLs with crawl config
4. Configures chunking strategy
5. Configures embedding model
6. All saved to Redis draft (24hr TTL)

// No database writes yet!
```

**Backend Draft Storage**:
```python
# Redis Key: draft:kb:{draft_id}
{
  "data": {
    "name": "My Knowledge Base",
    "description": "...",
    "sources": [
      {
        "id": "source_uuid",
        "type": "web_scraping",
        "url": "https://docs.example.com",
        "config": {
          "method": "crawl",
          "max_pages": 50,
          "max_depth": 3
        }
      }
    ],
    "chunking_config": {
      "strategy": "recursive",
      "chunk_size": 1000,
      "chunk_overlap": 200
    },
    "model_config": {
      "embedding_model": "text-embedding-ada-002",
      "indexing_method": "balanced"
    }
  }
}
```

### Phase 2: Finalization (Draft → Database)
**Location**: `kb_draft_service.finalize_draft()`

```python
# When user clicks "Create KB"
1. Validate draft configuration
2. Create KnowledgeBase record in PostgreSQL
3. Create placeholder Document records for each source
4. Queue Celery background task
5. Return pipeline_id for progress tracking
```

**Database Records Created**:
```sql
-- knowledge_bases table
INSERT INTO knowledge_bases (
  id, name, description, config, status, workspace_id
) VALUES (
  uuid, 'My Knowledge Base', '...', chunking_config, 'processing', workspace_id
);

-- documents table (one per source URL)
INSERT INTO documents (
  id, kb_id, name, source_type, source_url, status, chunk_count
) VALUES (
  uuid, kb_id, 'Documentation', 'web_scraping', 'https://docs.example.com', 'pending', 0
);
```

### Phase 3: Background Processing (Celery Task)
**Location**: `tasks/kb_pipeline_tasks.py`

```python
@shared_task
def process_web_kb_task(kb_id, pipeline_id, sources, config):
    """
    Complete web KB processing pipeline

    FLOW:
    1. Scrape/Crawl URLs → Raw content
    2. Parse content → Clean text
    3. Chunk text → Text segments
    4. Generate embeddings → Vectors
    5. Index in Qdrant → Store vectors + metadata
    6. Update database → Set status to 'completed'
    """

    for source in sources:
        # STEP 1: Scrape/Crawl
        pages = crawl4ai_service.crawl_website(
            url=source["url"],
            config=source["config"]
        )

        # STEP 2: Create Documents
        for page in pages:
            document = create_document_from_page(page, kb_id)

            # STEP 3: Chunk Content
            chunks = chunking_service.chunk_document(
                text=page.content,
                strategy=kb_config["chunking_strategy"],
                chunk_size=kb_config["chunk_size"],
                chunk_overlap=kb_config["chunk_overlap"]
            )

            # STEP 4: Generate Embeddings
            embeddings = embedding_service.create_embeddings([
                chunk["content"] for chunk in chunks
            ])

            # STEP 5: Store in Qdrant
            collection_name = f"kb_{kb_id}"
            qdrant_service.create_collection(collection_name)

            qdrant_chunks = []
            for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
                qdrant_chunks.append(QdrantChunk(
                    id=f"{document.id}_{i}",
                    embedding=embedding,
                    content=chunk["content"],
                    metadata={
                        "document_id": str(document.id),
                        "kb_id": str(kb_id),
                        "chunk_index": i,
                        "source_url": page.url,
                        "title": page.title
                    }
                ))

            qdrant_service.upsert_chunks(collection_name, qdrant_chunks)

            # STEP 6: Save Chunks to PostgreSQL
            for chunk_data in chunks:
                chunk = Chunk(
                    id=uuid4(),
                    document_id=document.id,
                    kb_id=kb_id,
                    content=chunk_data["content"],
                    metadata=chunk_data,
                    embedding_vector=None  # Not stored in PG
                )
                db.add(chunk)

            # Update document status
            document.status = "completed"
            document.chunk_count = len(chunks)

    # Update KB status
    kb.status = "completed"
    db.commit()
```

---

## Document Addition Flow

### Text Document Addition
**Endpoint**: `POST /api/v1/kbs/{kb_id}/documents`
**Location**: `routes/kb.py` → `tasks/document_processing_tasks.py`

```python
# FLOW: Text Input → Document → Chunks → Vectors
@router.post("/kbs/{kb_id}/documents")
async def create_document(kb_id: str, request: CreateDocumentRequest):
    """
    Add text document to existing KB

    IMPORTANT: This does NOT reprocess existing documents
    Only processes the new document and adds to existing collection
    """

    # 1. Validate KB exists
    kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == kb_id).first()

    # 2. Create Document record (status="processing", chunk_count=0)
    document = Document(
        kb_id=kb_id,
        name=request.name,
        source_type="text_input",
        content_full=request.content,
        status="processing",
        chunk_count=0  # Updated later by background task
    )
    db.add(document)
    db.commit()

    # 3. Queue background processing task
    process_document_task.apply_async(
        kwargs={
            "document_id": str(document.id),
            "content": request.content,
            "kb_config": kb.config or {}
        },
        queue="default"
    )

    # 4. Return immediately (processing happens in background)
    return DocumentDetailResponse(...)
```

**Background Processing**:
```python
@shared_task
def process_document_task(document_id: str, content: str, kb_config: dict):
    """
    Process single document: Chunk → Embed → Add to existing Qdrant collection
    """

    # 1. Get document and KB
    document = db.query(Document).filter(Document.id == document_id).first()
    kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == document.kb_id).first()

    # 2. Extract chunking configuration (inherits from KB)
    chunking_config = kb_config.get("chunking_config", {})
    strategy = chunking_config.get("strategy", "recursive")
    chunk_size = chunking_config.get("chunk_size", 1000)
    chunk_overlap = chunking_config.get("chunk_overlap", 200)

    # 3. Chunk the content
    chunks = chunking_service.chunk_document(
        text=content,
        strategy=strategy,
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap
    )

    # 4. Generate embeddings
    embeddings = embedding_service.create_embeddings([
        chunk["content"] for chunk in chunks
    ])

    # 5. Add to EXISTING Qdrant collection
    collection_name = f"kb_{kb.id}"
    # Collection already exists from KB creation!

    qdrant_chunks = []
    for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
        qdrant_chunks.append(QdrantChunk(
            id=f"{document.id}_{i}",
            embedding=embedding,
            content=chunk["content"],
            metadata={
                "document_id": str(document.id),
                "kb_id": str(kb.id),
                "chunk_index": i,
                "source_type": "text_input",
                "document_name": document.name
            }
        ))

    # APPEND to existing collection (no reprocessing!)
    qdrant_service.upsert_chunks(collection_name, qdrant_chunks)

    # 6. Save chunks to PostgreSQL
    for chunk_data in chunks:
        chunk = Chunk(
            id=uuid4(),
            document_id=document.id,
            kb_id=kb.id,
            content=chunk_data["content"],
            metadata=chunk_data
        )
        db.add(chunk)

    # 7. Update document status
    document.status = "completed"
    document.chunk_count = len(chunks)
    db.commit()
```

### File Upload Flow
**Endpoint**: `POST /api/v1/kbs/{kb_id}/documents/upload`
**Location**: `routes/kb.py`

```python
@router.post("/kbs/{kb_id}/documents/upload")
async def upload_document(kb_id: str, file: UploadFile):
    """
    Upload file and process into KB

    SUPPORTS: .txt, .md, .csv, .json files
    FLOW: File → Parse → Document → Background Processing
    """

    # 1. Validate file type and size
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(400, "Unsupported file format")

    if file.size > MAX_FILE_SIZE:
        raise HTTPException(413, "File too large")

    # 2. Parse file content
    content = await parse_uploaded_file(file)

    # 3. Create document record
    document = Document(
        kb_id=kb_id,
        name=file.filename,
        source_type="file_upload",
        content_full=content,
        size_bytes=file.size,
        status="processing",
        chunk_count=0
    )

    # 4. Queue same background task as text input
    process_document_task.apply_async(
        kwargs={
            "document_id": str(document.id),
            "content": content,
            "kb_config": kb.config or {}
        }
    )

    return DocumentDetailResponse(...)


async def parse_uploaded_file(file: UploadFile) -> str:
    """Parse different file types into text content"""

    content_bytes = await file.read()

    if file.content_type == "text/plain":
        return content_bytes.decode("utf-8")

    elif file.content_type == "text/markdown":
        return content_bytes.decode("utf-8")

    elif file.content_type == "application/json":
        data = json.loads(content_bytes.decode("utf-8"))
        return json.dumps(data, indent=2)

    elif file.content_type == "text/csv":
        return content_bytes.decode("utf-8")

    else:
        raise ValueError(f"Unsupported file type: {file.content_type}")
```

---

## Chunking Strategies & Configuration

### Strategy Implementation
**Location**: `services/chunking_service.py`

```python
class ChunkingService:
    def chunk_document(self, text: str, strategy: str, chunk_size: int, chunk_overlap: int):
        """
        Supports multiple chunking strategies:

        - recursive: Split on hierarchical separators (\n\n → \n → . → space)
        - sentence: Split on sentence boundaries
        - token: Token-aware splitting (respects word boundaries)
        - no_chunking: Return entire document as single chunk
        - by_heading: Split on markdown/HTML headings
        - semantic: Embedding-based semantic splitting
        - adaptive: Choose strategy based on content analysis
        - hybrid: Combine multiple strategies
        """

        if strategy == "recursive":
            separators = ["\n\n", "\n", ". ", " "]
            return self._recursive_chunk(text, chunk_size, chunk_overlap, separators)

        elif strategy == "no_chunking":
            # Return entire document as single chunk
            return [{
                "content": text,
                "index": 0,
                "start_pos": 0,
                "end_pos": len(text),
                "token_count": len(text) // 4  # Rough estimate
            }]

        # ... other strategies

    def _recursive_chunk(self, text: str, chunk_size: int, overlap: int, separators: List[str]):
        """
        Recursive text splitting with overlap preservation

        ALGORITHM:
        1. Try first separator (\n\n)
        2. If chunks too large, try next separator (\n)
        3. Continue until target chunk size achieved
        4. Add overlap between consecutive chunks
        """
        chunks = []
        current_pos = 0

        while current_pos < len(text):
            # Find optimal split point
            end_pos = min(current_pos + chunk_size, len(text))

            # Try to split on separator near target size
            chunk_text = text[current_pos:end_pos]

            # Apply overlap if not first chunk
            if current_pos > 0:
                overlap_start = max(0, current_pos - overlap)
                overlap_text = text[overlap_start:current_pos]
                chunk_text = overlap_text + chunk_text

            chunks.append({
                "content": chunk_text,
                "index": len(chunks),
                "start_pos": current_pos,
                "end_pos": end_pos,
                "token_count": len(chunk_text.split())
            })

            current_pos = end_pos

        return chunks
```

### Configuration Inheritance
```
KB Level Config (Default)
    ↓
Document Level Config (Inherits from KB)
    ↓
Source Level Config (Inherits from Document)
```

**Example Configuration Flow**:
```python
# KB Creation - Set default chunking
kb_config = {
    "chunking_config": {
        "strategy": "recursive",
        "chunk_size": 1000,
        "chunk_overlap": 200
    }
}

# Document Addition - Inherits KB config
# Unless explicitly overridden:
document_config = kb.config.get("chunking_config", DEFAULT_CONFIG)

# Can be customized per document:
custom_document_config = {
    "strategy": "by_heading",  # Override for this document
    "chunk_size": 1500,        # Larger chunks for this content
    "chunk_overlap": 300       # More overlap for context
}
```

---

## Vector Store Architecture (Qdrant)

### Collection Structure
**Location**: `services/qdrant_service.py`

```python
class QdrantService:
    def create_collection(self, kb_id: str) -> str:
        """
        Create Qdrant collection for KB

        NAMING: kb_{kb_id}
        EXAMPLE: kb_123e4567-e89b-12d3-a456-426614174000

        CONFIGURATION:
        - Distance Metric: Cosine similarity
        - Vector Size: 1536 (OpenAI text-embedding-ada-002)
        - Index Type: HNSW for fast search
        """

        collection_name = f"kb_{kb_id}"

        self.client.recreate_collection(
            collection_name=collection_name,
            vectors_config=models.VectorParams(
                size=1536,  # OpenAI embedding dimension
                distance=models.Distance.COSINE
            ),
            hnsw_config=models.HnswConfig(
                m=16,      # Number of bi-directional links
                ef_construct=200  # Size of dynamic candidate list
            )
        )

        return collection_name

    def upsert_chunks(self, collection_name: str, chunks: List[QdrantChunk]):
        """
        Add/update chunks in collection

        IMPORTANT: This is ADDITIVE - new chunks are added alongside existing ones
        No deletion/reprocessing of existing chunks
        """

        points = []
        for chunk in chunks:
            points.append(models.PointStruct(
                id=chunk.id,  # Format: {document_id}_{chunk_index}
                vector=chunk.embedding,
                payload={
                    "content": chunk.content,
                    "document_id": chunk.metadata.get("document_id"),
                    "kb_id": chunk.metadata.get("kb_id"),
                    "chunk_index": chunk.metadata.get("chunk_index"),
                    "source_type": chunk.metadata.get("source_type"),
                    "document_name": chunk.metadata.get("document_name"),
                    "source_url": chunk.metadata.get("source_url"),
                    # ... other metadata
                }
            ))

        # BATCH UPSERT - efficient for multiple chunks
        self.client.upsert(
            collection_name=collection_name,
            points=points
        )
```

### Search & Retrieval
```python
def search_similar_chunks(
    self,
    collection_name: str,
    query_vector: List[float],
    limit: int = 10,
    filter_conditions: Optional[Dict] = None
) -> List[SearchResult]:
    """
    Semantic search within KB collection

    FEATURES:
    - Cosine similarity matching
    - Metadata filtering (by document, source type, etc.)
    - Relevance scoring (0-1 range)
    """

    search_filter = None
    if filter_conditions:
        search_filter = models.Filter(
            must=[
                models.FieldCondition(
                    key=key,
                    match=models.MatchValue(value=value)
                )
                for key, value in filter_conditions.items()
            ]
        )

    search_results = self.client.search(
        collection_name=collection_name,
        query_vector=query_vector,
        limit=limit,
        query_filter=search_filter,
        with_payload=True,
        with_vectors=False  # Don't return vectors (large)
    )

    return [
        SearchResult(
            id=hit.id,
            score=hit.score,
            content=hit.payload["content"],
            metadata=hit.payload
        )
        for hit in search_results
    ]
```

### Collection Management
```
KB Lifecycle:
1. Create KB → Create collection kb_{kb_id}
2. Add documents → Append chunks to existing collection
3. Update document → Remove old chunks, add new chunks
4. Delete document → Remove chunks by document_id filter
5. Delete KB → Drop entire collection
```

**Multi-Document Collections**:
```
Collection: kb_123e4567-e89b-12d3-a456-426614174000
├── Document 1 (Web scraping)
│   ├── Chunk: doc1_0 (vector + metadata)
│   ├── Chunk: doc1_1 (vector + metadata)
│   └── Chunk: doc1_2 (vector + metadata)
├── Document 2 (File upload)
│   ├── Chunk: doc2_0 (vector + metadata)
│   └── Chunk: doc2_1 (vector + metadata)
└── Document 3 (Text input)
    ├── Chunk: doc3_0 (vector + metadata)
    ├── Chunk: doc3_1 (vector + metadata)
    ├── Chunk: doc3_2 (vector + metadata)
    └── Chunk: doc3_3 (vector + metadata)

SEARCH RESULT: Ranked by similarity across ALL documents in KB
```

---

## Data Flow Patterns

### 1. KB Creation with URLs (Complete Flow)
```
Frontend Wizard
    ↓ (Draft API)
Redis Draft Storage
    ↓ (Finalize API)
PostgreSQL Records (KB + Documents)
    ↓ (Celery Task)
Web Scraping (Crawl4AI)
    ↓
Content Parsing
    ↓
Chunking Service (Strategy-based)
    ↓
Embedding Generation (OpenAI API)
    ↓
Vector Storage (Qdrant Collection)
    ↓
Status Updates (Redis → Frontend polling)
```

### 2. Document Addition (Text/File)
```
Frontend Document Form
    ↓ (Create Document API)
PostgreSQL Document Record (status="processing")
    ↓ (Celery Task)
Content Chunking (Inherits KB config)
    ↓
Embedding Generation
    ↓
Append to Existing Qdrant Collection
    ↓
Update Document Status (status="completed", chunk_count=N)
    ↓
Frontend Polling (Auto-refresh)
```

### 3. Retrieval & Search
```
User Query
    ↓
Embedding Generation (Same model as indexing)
    ↓
Qdrant Search (Cosine similarity)
    ↓
Metadata Filtering (Optional)
    ↓
Ranked Results (Score-based)
    ↓
Context Assembly for LLM
```

---

## Current Implementation Analysis

### Strengths
1. **Draft-First Architecture**: Prevents database pollution, enables previewing
2. **Scalable Processing**: Celery background tasks handle heavy operations
3. **Privacy-Focused**: Self-hosted Qdrant, no external vector storage
4. **Flexible Chunking**: Multiple strategies with per-KB configuration
5. **Additive Model**: New documents don't reprocess existing content

### Current Limitations
1. **Chunking UI**: No per-document chunking configuration in frontend
2. **Limited File Types**: Only .txt, .md, .csv, .json supported
3. **Basic Parsing**: No advanced document structure analysis
4. **Single Collection**: All documents in KB share same chunking strategy

### Architecture Gaps
1. **Document-Level Configuration**: Backend supports it, frontend doesn't expose it
2. **Chunk Preview**: Users can't preview chunks before processing
3. **Reprocessing**: No UI for reprocessing with different chunking strategy
4. **Collection Analytics**: No insights into chunk distribution, sizes, etc.

---

## Recommendations & Configuration Options

### 1. Enable Per-Document Chunking Configuration

**Frontend Enhancement**:
```typescript
// Add to document creation forms
interface DocumentChunkingConfig {
  useKBDefault: boolean;
  customConfig?: {
    strategy: ChunkingStrategy;
    chunk_size: number;
    chunk_overlap: number;
  };
}

// Document upload/text forms should include:
<ChunkingConfigSection
  defaultConfig={kb.chunking_config}
  onChange={setDocumentChunkingConfig}
/>
```

**Backend Implementation** (Already exists):
```python
# In process_document_task
def extract_chunking_config(kb_config: dict, document_config: Optional[dict]):
    """
    Merge KB and document-level chunking configuration
    Document config overrides KB defaults
    """

    kb_chunking = kb_config.get("chunking_config", DEFAULT_CONFIG)

    if document_config and not document_config.get("use_kb_default", True):
        # Use document-specific configuration
        doc_chunking = document_config.get("chunking_config", {})
        return {**kb_chunking, **doc_chunking}

    return kb_chunking
```

### 2. Chunk Preview Before Processing

**Implementation Strategy**:
```typescript
// Frontend: Add preview step to document forms
const previewChunks = async (content: string, config: ChunkingConfig) => {
  const response = await kbClient.preview.previewChunks({
    content,
    strategy: config.strategy,
    chunk_size: config.chunk_size,
    chunk_overlap: config.chunk_overlap
  });

  return response.chunks; // Show first 3-5 chunks with stats
};
```

```python
# Backend: Add preview endpoint
@router.post("/preview/chunks")
async def preview_chunks(request: ChunkPreviewRequest):
    """Preview chunking without creating document"""

    chunks = chunking_service.chunk_document(
        text=request.content,
        strategy=request.strategy,
        chunk_size=request.chunk_size,
        chunk_overlap=request.chunk_overlap
    )

    return ChunkPreviewResponse(
        total_chunks=len(chunks),
        avg_chunk_size=sum(len(c["content"]) for c in chunks) / len(chunks),
        preview_chunks=chunks[:5],  # First 5 chunks
        estimated_tokens=sum(c["token_count"] for c in chunks)
    )
```

### 3. Enhanced File Type Support

**Priority Extensions**:
```python
EXTENDED_FILE_SUPPORT = {
    "application/pdf": parse_pdf,           # PyMuPDF
    "application/msword": parse_docx,       # python-docx
    "text/html": parse_html,                # BeautifulSoup
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": parse_docx,
    "text/rtf": parse_rtf,                  # striprtf
}

async def parse_uploaded_file(file: UploadFile) -> str:
    parser = EXTENDED_FILE_SUPPORT.get(file.content_type)
    if parser:
        return await parser(file)
    else:
        return await fallback_text_extraction(file)
```

### 4. Chunking Strategy Recommendations

**Content-Based Strategy Selection**:
```python
def recommend_chunking_strategy(content: str, content_type: str) -> dict:
    """
    Analyze content and recommend optimal chunking strategy
    """

    if content_type == "text/markdown":
        # Look for heading structure
        if re.search(r'^#+\s', content, re.MULTILINE):
            return {
                "strategy": "by_heading",
                "reason": "Markdown structure detected",
                "chunk_size": 1500  # Larger chunks for structured content
            }

    elif content_type == "application/json":
        return {
            "strategy": "no_chunking",
            "reason": "Structured data - preserve as single unit"
        }

    elif len(content) < 500:
        return {
            "strategy": "no_chunking",
            "reason": "Short content - no chunking needed"
        }

    else:
        return {
            "strategy": "recursive",
            "reason": "General text content",
            "chunk_size": 1000,
            "chunk_overlap": 200
        }
```

### 5. Collection Analytics Dashboard

**Recommended Features**:
- Chunk size distribution
- Document contribution to total chunks
- Processing quality metrics
- Search performance analytics
- Collection storage stats

This comprehensive architecture enables flexible, scalable knowledge base management while maintaining privacy and performance through self-hosted infrastructure.