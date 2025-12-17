# File Upload Implementation - Pure Metadata-Only Storage

**Date**: 2025-12-15
**Status**: ✅ CORRECTED - Production Ready
**Architecture**: Pure metadata-only (NO content in PostgreSQL)

---

## ⚠️ CRITICAL ARCHITECTURE CLARIFICATIONS

### Key Insights from Deep Analysis

**1. Chunks ARE the Content** (No Duplication)
- ❌ WRONG: Store "full content" AND "chunks" separately
- ✅ RIGHT: Chunks ARE the content
  - No chunking: 1 chunk = entire document
  - Regular chunking: 15 chunks = document split up
  - No separate "full content" exists in Qdrant

**2. File Upload Storage** (Metadata Only)
- PostgreSQL: Metadata ONLY (no content, no chunks)
- Qdrant: ALL content (chunks + vectors)
- Purpose: Privacy, avoid duplication

**3. Web URL Storage** (Archive + Retrieval)
- PostgreSQL: Full content + chunks (archive/backup)
- Qdrant: Chunks + vectors (retrieval)
- Purpose: Re-processing without re-scraping

**4. Context Filtering is CRITICAL**
- KB has context: "chatbot", "chatflow", or "both"
- Store `kb_context` in Qdrant payload
- Filter during retrieval based on caller type
- Chatbots need different configs than chatflows

---

## Storage Architecture

### Complete Comparison

| Aspect | Web URLs | File Uploads |
|--------|----------|--------------|
| **Document.content_full** | ✅ Full scraped content | ❌ NULL |
| **Document.source_metadata** | Web metadata | ✅ **File metadata ONLY** |
| **PostgreSQL Chunk records** | ✅ **All chunks** | ❌ **ZERO chunks** |
| **Qdrant Vectors** | ✅ 384-dim embeddings | ✅ 384-dim embeddings |
| **Qdrant Payload** | ✅ **Full chunk text + metadata** | ✅ **Full chunk text + metadata** |
| **Content retrieval** | **Qdrant (recommended)** or PostgreSQL | **Qdrant ONLY** |

**Key Point**: Both web URLs and file uploads store **full chunk text** in Qdrant payload (this is best practice for vector stores)

### Storage Flow Diagrams

**Web URL Flow** (Existing - UNCHANGED):
```
Scrape web page
    ↓
Store full content in Document.content_full  ← PostgreSQL
    ↓
Chunk content
    ↓
Create Chunk records in PostgreSQL  ← PostgreSQL
    ↓
Generate embeddings
    ↓
Store vectors in Qdrant  ← Qdrant
```

**File Upload Flow** (NEW - Metadata Only):
```
Parse file with Tika
    ↓
Extract text + metadata
    ↓
Store ONLY metadata in Document.source_metadata  ← PostgreSQL (metadata ONLY)
    ↓
Chunk content (IN MEMORY - not saved to PostgreSQL)
    ↓
NO Chunk records created  ← PostgreSQL stays EMPTY
    ↓
Generate embeddings
    ↓
Store chunks + vectors in Qdrant ONLY  ← Qdrant (chunks + vectors)
```

---

## Interactive Chunk Preview

### User Requirement

"Users must preview full content during chunk preview and it must respond to chunk configs so users can understand how their data will get processed."

### Preview Architecture

```
┌─────────────────────────────────────────────────────┐
│ 1. User uploads file                                │
│    ↓                                                 │
│ 2. Parse with Tika → Extract text                   │
│    ↓                                                 │
│ 3. Store extracted text in Redis draft (temporary)  │
│    ↓                                                 │
│ 4. User configures chunking:                        │
│    - strategy: by_heading / semantic / no_chunking / custome │
│    - chunk_size: 500-2000                           │
│    - chunk_overlap: 0-500                           │
│                                                     │
│    ↓                                                 │
│ 5. User clicks "Preview Chunks"                     │
│    ↓                                                 │
│ 6. Backend chunks ON-THE-FLY (not saved)            │
│    ↓                                                 │
│ 7. Return chunks + metrics                          │
│    ↓                                                 │
│ 8. Frontend displays:                               │
│    - Full chunk content                             │
│    - Overlap regions highlighted                    │
│    - Token counts                                   │
│    - Quality estimates                              │
│    ↓                                                 │
│ 9. User can change config and re-preview            │
│    (repeat steps 4-8 as many times as needed)       │
│    ↓                                                 │
│ 10. When satisfied → Finalize                       │
│     ↓                                                │
│ 11. Pipeline processes with chosen config           │
│     ↓                                                │
│ 12. Store in Qdrant ONLY (metadata in PostgreSQL)   │
└─────────────────────────────────────────────────────┘
```

### Preview Response Format

```json
{
  "chunks": [
    {
      "content": "Full chunk text here...",
      "index": 0,
      "char_count": 850,
      "token_count": 180,
      "has_overlap": false,
      "overlap_content": null
    },
    {
      "content": "Next chunk with overlap...",
      "index": 1,
      "char_count": 920,
      "token_count": 195,
      "has_overlap": true,
      "overlap_content": "...overlapping text from previous chunk..."
    }
  ],
  "metrics": {
    "total_chunks": 15,
    "avg_chunk_size": 875,
    "min_chunk_size": 650,
    "max_chunk_size": 1100,
    "total_tokens": 2900,
    "overlap_percentage": 20,
    "estimated_search_quality": "high",
    "retrieval_speed": "fast"
  },
  "full_content_length": 12500
}
```

---

## Implementation Summary

### What Gets Stored Where

**For File Uploads**:

**PostgreSQL Document Table**:
```python
{
    "id": "uuid",
    "name": "report.pdf",
    "source_type": "file_upload",  # ← Differentiate from web_scraping
    "source_url": None,
    "content_full": None,  # ← NO CONTENT
    "content_preview": "First 500 chars...",
    "chunk_count": 15,  # ← Reference count only
    "source_metadata": {  # ← ONLY metadata stored
        "original_filename": "report.pdf",
        "file_size_bytes": 2048576,
        "mime_type": "application/pdf",
        "file_hash_sha256": "abc123...",
        "page_count": 45,
        "upload_date": "2025-12-15T10:30:00Z",
        "processing_method": "tika",
        "storage_strategy": "metadata_only_pure"
    },
    "status": "completed"
}
```

**PostgreSQL Chunk Table**:
```sql
-- EMPTY FOR FILE UPLOADS
SELECT COUNT(*) FROM chunks
WHERE document_id = 'file-upload-document-id';
-- Result: 0
```

**Qdrant Vector Store**:

**CRITICAL: Collection Structure**
- ✅ ONE collection per KB: `kb_{kb_id}`
- ✅ Each chunk = ONE point in that collection
- ❌ NOT one collection per chunk

**Example: 10 chunks → 10 points in ONE collection**

```python
# Collection name: kb_550e8400-e29b-41d4-a716-446655440000
# Contains 10 points (if 10 chunks generated):

# Point 1 (Chunk 1)
{
    "id": "chunk-550e8400-001",
    "vector": [0.123, 0.456, ...],  # 384-dim embedding

    "payload": {
        # Content
        "content": "Chunk 1 text here...",  # ← The actual chunk

        # Document identification
        "document_id": "doc-uuid",
        "document_name": "report.pdf",
        "kb_id": "kb-uuid",

        # Source information
        "source_type": "file_upload",
        "source_url": None,
        "original_filename": "Q4_Report.pdf",

        # Context & access
        "kb_context": "both",  # ← "chatbot", "chatflow", or "both"
        "workspace_id": "workspace-uuid",

        # Chunk metadata
        "chunk_index": 0,
        "page_number": 1,
        "char_count": 850,
        "token_count": 180,
        "heading": "Executive Summary",

        # Chunking info
        "chunking_strategy": "by_heading",
        "chunk_size": 1000,
        "chunk_overlap": 200,

        # Timestamps
        "indexed_at": "2025-12-15T10:30:00Z",

        # System
        "storage_location": "qdrant_only",
        "embedding_model": "all-MiniLM-L6-v2"
    }
}

# Points 2-10 follow same structure
# All in SAME collection: kb_550e8400-e29b-41d4-a716-446655440000
```

**For no_chunking**: 1 point in collection
**For regular chunking**: N points in collection (N = number of chunks)

### Code Changes Required

**1. Draft Service** (`kb_draft_service.py`):
```python
async def add_file_source_to_draft(
    self,
    draft_id: str,
    file_path: str,
    original_filename: str
) -> str:
    """Store extracted text in Redis for preview."""

    # Parse with Tika
    parse_result = await tika_service.parse_document(file_path)

    source = {
        "id": str(uuid4()),
        "type": "file_upload",
        "extracted_text": parse_result["text"],  # ← For preview
        "metadata": {
            "original_filename": original_filename,
            "file_size_bytes": len(file_content),
            "mime_type": parse_result["file_info"]["mime_type"],
            "storage_strategy": "metadata_only_pure"
            # ... other metadata
        }
    }

    # Add to Redis draft
    draft_service.update_draft(draft_id, {"sources": [source]})
```

**2. Preview Endpoint** (`kb_draft.py`):
```python
@router.post("/{draft_id}/preview-chunks-live")
async def preview_chunks_live(draft_id: str, request: Dict):
    """Chunk on-the-fly with user config."""

    # Get extracted text from Redis draft
    source = get_source_from_draft(draft_id, request["source_id"])
    extracted_text = source["extracted_text"]

    # Chunk with user config (not saved)
    chunks = chunking_service.chunk_document(
        text=extracted_text,
        strategy=request["chunking_config"]["strategy"],
        chunk_size=request["chunking_config"]["chunk_size"],
        chunk_overlap=request["chunking_config"]["chunk_overlap"]
    )

    # Return chunks + metrics
    return {
        "chunks": chunks,
        "metrics": calculate_metrics(chunks)
    }
```

**3. Pipeline Task** (`kb_pipeline_tasks.py`):
```python
if source_type == "file_upload":
    # STEP 1: Create document with METADATA ONLY
    document = Document(
        source_type="file_upload",
        source_metadata={...},  # Metadata only
        content_full=None,      # NO content
        chunk_count=0           # NO chunks in PostgreSQL
    )
    db.add(document)
    db.commit()

    # STEP 2: Chunk content (IN MEMORY)
    chunks = chunking_service.chunk_document(extracted_text, ...)

    # STEP 3: Store ONLY in Qdrant (NOT in PostgreSQL Chunk table)
    for chunk in chunks:
        embedding = embedding_service.generate_embedding(chunk["content"])

        # ⚠️ CRITICAL: Only Qdrant, NO PostgreSQL Chunk record
        await qdrant_service.add_chunk_to_kb(
            kb_id=kb_id,
            chunk=QdrantChunk(
                id=str(uuid4()),
                content=chunk["content"],  # Full chunk text
                embedding=embedding,
                metadata={
                    "document_id": str(document.id),
                    "document_name": document.name,
                    "source_type": "file_upload",
                    "chunk_index": idx,
                    "kb_id": str(kb_id),
                    "kb_context": kb.context,  # ← CRITICAL: Store context for filtering
                    "storage_location": "qdrant_only"
                }
            )
        )

    # STEP 4: Update document (chunk_count is reference only)
    document.status = "completed"
    document.chunk_count = len(chunks)
    db.commit()

elif source_type == "web_scraping":
    # Existing behavior - stores in BOTH PostgreSQL and Qdrant
    pass
```

---

## Retrieval Implications

### Querying Content

**For Web URLs**:
```python
# Can query PostgreSQL Chunk table
chunks = db.query(Chunk).filter(
    Chunk.document_id == document_id
).all()

# OR query Qdrant
results = await qdrant_service.search(...)
```

**For File Uploads**:
```python
# MUST query Qdrant ONLY
# PostgreSQL Chunk table is EMPTY

# Check source type first
document = db.query(Document).filter(Document.id == document_id).first()

if document.source_type == "file_upload":
    # Query Qdrant
    results = await qdrant_service.search_by_document(
        kb_id=kb_id,
        document_id=document_id
    )
    # results contain full chunk content
else:
    # Query PostgreSQL
    chunks = db.query(Chunk).filter(...)
```

### Search Service Update

Need to update retrieval service to handle both:

```python
async def retrieve_chunks(kb_id: UUID, query: str, document_id: Optional[UUID] = None):
    """Retrieve chunks - handles both web URLs and file uploads."""

    if document_id:
        # Check document source type
        document = db.query(Document).filter(Document.id == document_id).first()

        if document.source_type == "file_upload":
            # File upload: Query Qdrant ONLY
            results = await qdrant_service.search_by_document(
                kb_id=kb_id,
                document_id=document_id,
                query=query
            )
            return results

        else:
            # Web URL: Query PostgreSQL
            chunks = db.query(Chunk).filter(
                Chunk.document_id == document_id
            ).all()
            return chunks

    else:
        # Search across all documents in KB
        # Use Qdrant for unified search (works for both types)
        results = await qdrant_service.search_kb(
            kb_id=kb_id,
            query=query,
            top_k=10
        )
        return results
```

---

## Testing Verification

### Test 1: Verify Metadata-Only Storage

```sql
-- After finalization, check PostgreSQL Document
SELECT
    id,
    name,
    source_type,
    content_full IS NULL as no_content_full,
    chunk_count,
    source_metadata->>'storage_strategy' as strategy
FROM documents
WHERE source_type = 'file_upload';

-- Expected result:
-- no_content_full = true (NULL)
-- chunk_count = 15 (reference only, no actual chunk records)
-- strategy = 'metadata_only_pure'
```

### Test 2: Verify NO Chunk Records

```sql
-- Check PostgreSQL Chunk table (should be EMPTY for file uploads)
SELECT COUNT(*) as chunk_records_count
FROM chunks
WHERE document_id IN (
    SELECT id FROM documents WHERE source_type = 'file_upload'
);

-- Expected result: 0 (ZERO chunk records for file uploads)
```

### Test 3: Verify Qdrant Storage

```python
# Check that chunks ARE in Qdrant
from app.services.qdrant_service import qdrant_service

# Search by document
results = await qdrant_service.search_by_document(
    kb_id=kb_id,
    document_id=file_upload_document_id
)

# Verify results
assert len(results) > 0, "Should have chunks in Qdrant"

for result in results:
    assert "content" in result.payload, "Should have chunk content"
    assert result.payload["storage_location"] == "qdrant_only"
    assert result.payload["source_type"] == "file_upload"

print(f"✅ Found {len(results)} chunks in Qdrant")
print(f"✅ Chunk content length: {len(results[0].payload['content'])} chars")
```

### Test 4: Preview Functionality

```bash
# Upload file
curl -X POST "/api/v1/kb-drafts/{draft_id}/sources/file" \
  -F "file=@test.pdf"

# Preview with config 1
curl -X POST "/api/v1/kb-drafts/{draft_id}/preview-chunks-live" \
  -d '{
    "source_id": "{source_id}",
    "chunking_config": {
      "strategy": "by_heading",
      "chunk_size": 1000,
      "chunk_overlap": 200
    }
  }'

# Expected: ~10-15 chunks

# Preview with config 2 (different settings)
curl -X POST "/api/v1/kb-drafts/{draft_id}/preview-chunks-live" \
  -d '{
    "source_id": "{source_id}",
    "chunking_config": {
      "strategy": "no_chunking"
    }
  }'

# Expected: 1 chunk with full content

# Preview with config 3 (smaller chunks)
curl -X POST "/api/v1/kb-drafts/{draft_id}/preview-chunks-live" \
  -d '{
    "source_id": "{source_id}",
    "chunking_config": {
      "strategy": "by_heading",
      "chunk_size": 500,
      "chunk_overlap": 100
    }
  }'

# Expected: ~25-30 chunks (smaller size = more chunks)
```

---

## Key Takeaways

### ✅ Correct Architecture

1. **File Uploads = Pure Metadata Storage**
   - PostgreSQL: Metadata ONLY (zero content)
   - Qdrant: ALL content (chunks + vectors)

2. **Interactive Preview**
   - Chunk on-the-fly with user config
   - No database writes during preview
   - Users can experiment freely

3. **Backward Compatible**
   - Web URLs: Existing behavior unchanged
   - Mixed KBs: Both types work independently

### ❌ Common Mistakes to Avoid

1. ❌ Don't create Chunk records for file uploads
2. ❌ Don't store content_full for file uploads
3. ❌ Don't query PostgreSQL Chunk table for file uploads
4. ❌ Don't save preview chunks to database

### ✅ What to Do

1. ✅ Store only metadata in Document.source_metadata
2. ✅ Store all chunks in Qdrant with full content
3. ✅ Query Qdrant for file upload content retrieval
4. ✅ Preview chunks on-the-fly without saving

---

## Retrieval Configuration

### What is Retrieval Config?

User-configurable settings for HOW to search and rank results from Qdrant.

**Complete Retrieval Config Structure**:
```python
retrieval_config = {
    # Search Strategy
    "strategy": "hybrid_search",  # Options: semantic_search, keyword_search, hybrid_search

    # Result Limits
    "top_k": 5,  # Number of results to return (1-20)
    "score_threshold": 0.7,  # Minimum similarity score (0.0-1.0)

    # Context Filtering (CRITICAL - chatbot vs chatflow)
    "context_filter": "chatbot",  # "chatbot", "chatflow", or "both"

    # Metadata Filtering
    "metadata_filters": {
        "source_type": "file_upload",  # Filter by source type
        "document_id": "uuid",  # Filter by specific document
        "page_number": [1, 2, 3]  # Filter by page numbers
    },

    # Advanced Options
    "rerank_enabled": false,  # Re-rank with cross-encoder (slower but better)
    "distance_metric": "cosine",  # cosine, euclidean, dot_product
    "max_distance": 0.5  # Maximum vector distance
}
```

### How Retrieval Works with Metadata Filters

**Example 1: Search Only File Uploads**
```python
results = await qdrant_service.search(
    collection_name=f"kb_{kb_id}",
    query_vector=query_embedding,
    limit=5,
    query_filter={
        "must": [
            {"key": "source_type", "match": {"value": "file_upload"}}
        ]
    }
)
```

**Example 2: Search Specific Document**
```python
results = await qdrant_service.search(
    collection_name=f"kb_{kb_id}",
    query_vector=query_embedding,
    limit=5,
    query_filter={
        "must": [
            {"key": "document_id", "match": {"value": str(doc_id)}}
        ]
    }
)
```

**Example 3: Search Specific Pages Only**
```python
results = await qdrant_service.search(
    collection_name=f"kb_{kb_id}",
    query_vector=query_embedding,
    limit=5,
    query_filter={
        "must": [
            {"key": "page_number", "range": {"gte": 1, "lte": 10}}
        ]
    }
)
```

### Context-Aware Retrieval (Chatbot vs Chatflow)

**Different retrieval configs for different use cases**:

**Chatbot Config** (Precise, Quick Answers):
```python
chatbot_config = {
    "strategy": "semantic_search",
    "top_k": 3,  # Fewer results
    "score_threshold": 0.75,  # Higher threshold
    "context_filter": "chatbot",  # Only chatbot KBs
    "metadata_filters": {}
}

# Typical chatbot query
results = await retrieve_chunks(
    kb_id=kb_id,
    query="How do I reset my password?",
    context="chatbot",
    retrieval_config=chatbot_config
)

# Returns: 3 precise chunks with direct answers
```

**Chatflow Config** (Comprehensive Information):
```python
chatflow_config = {
    "strategy": "hybrid_search",
    "top_k": 15,  # More results
    "score_threshold": 0.60,  # Lower threshold (wider net)
    "context_filter": "chatflow",  # Only chatflow KBs
    "metadata_filters": {}
}

# Typical chatflow query
results = await retrieve_chunks(
    kb_id=kb_id,
    query="Fetch all authentication documentation",
    context="chatflow",
    retrieval_config=chatflow_config
)

# Returns: 15 comprehensive chunks for workflow processing
```

### Unified Retrieval Service

**Both web URLs and file uploads use same retrieval logic**:
```python
async def retrieve_chunks(
    kb_id: UUID,
    query: str,
    context: str,  # "chatbot", "chatflow", or "both"
    retrieval_config: Optional[Dict] = None
) -> List[Dict]:
    """
    Unified retrieval for ALL source types with context filtering.

    Args:
        kb_id: Knowledge base ID
        query: Search query
        context: Caller context ("chatbot", "chatflow", or "both")
        retrieval_config: Optional overrides

    Works because Qdrant contains full content for both web URLs and file uploads.
    """

    # Get KB default config
    kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == kb_id).first()
    default_config = kb.config.get("retrieval", {})

    # Use context-specific defaults
    if context == "chatbot":
        defaults = {
            "top_k": 3,
            "score_threshold": 0.75,
            "context_filter": "chatbot"
        }
    elif context == "chatflow":
        defaults = {
            "top_k": 15,
            "score_threshold": 0.60,
            "context_filter": "chatflow"
        }
    else:  # "both"
        defaults = {
            "top_k": 5,
            "score_threshold": 0.70,
            "context_filter": "both"
        }

    # Merge: defaults < KB config < query overrides
    config = {**defaults, **default_config, **(retrieval_config or {})}

    # Embed query
    query_embedding = embedding_service.generate_embedding(query)

    # Build filters
    filters = []

    # CRITICAL: Context filter
    context_filter = config.get("context_filter")
    if context_filter:
        # Match KBs with specified context or "both"
        filters.append({
            "key": "kb_context",
            "match": {"any": [context_filter, "both"]}
        })

    # Additional metadata filters
    metadata_filters = config.get("metadata_filters", {})

    if metadata_filters.get("source_type"):
        filters.append({
            "key": "source_type",
            "match": {"value": metadata_filters["source_type"]}
        })

    if metadata_filters.get("document_id"):
        filters.append({
            "key": "document_id",
            "match": {"value": str(metadata_filters["document_id"])}
        })

    if metadata_filters.get("page_number"):
        page_nums = metadata_filters["page_number"]
        if isinstance(page_nums, list):
            filters.append({
                "key": "page_number",
                "match": {"any": page_nums}
            })

    # Search Qdrant (ONE query for all source types)
    results = await qdrant_service.search(
        collection_name=f"kb_{kb_id}",
        query_vector=query_embedding,
        limit=config["top_k"],
        score_threshold=config["score_threshold"],
        query_filter={"must": filters} if filters else None
    )

    # Results already contain full chunk text in payload
    return [
        {
            "content": r.payload["content"],  # Chunk text ready
            "score": r.score,
            "document_name": r.payload["document_name"],
            "document_id": r.payload["document_id"],
            "page_number": r.payload.get("page_number"),
            "source_type": r.payload["source_type"],
            "kb_context": r.payload["kb_context"],
            "chunk_index": r.payload["chunk_index"]
        }
        for r in results
    ]
```

### Retrieval Config Storage

**KB-Level Config** (applies to all searches in this KB):
```python
# In KnowledgeBase model
class KnowledgeBase(Base):
    # ...
    config = Column(JSONB, default={})  # Includes retrieval_config

# Example KB config:
kb.config = {
    "chunking": {...},
    "embedding": {...},
    "retrieval": {  # ← Retrieval config
        "strategy": "hybrid_search",
        "top_k": 5,
        "score_threshold": 0.7,
        "metadata_filters": {}  # Default no filters
    }
}
```

**Query-Time Override** (per search):
```python
# User can override KB defaults per query
results = await retrieve_chunks(
    kb_id=kb_id,
    query="How to reset password?",
    retrieval_config={
        "top_k": 10,  # Override KB default
        "metadata_filters": {
            "source_type": "file_upload",  # Add filter
            "page_number": [1, 2, 3]  # Only first 3 pages
        }
    }
)
```

---

## Chatbot vs Chatflow Requirements

### What Each Needs to Answer Queries Accurately

**Chatbot Requirements** (Simple Q&A):
```
Use Case: Direct customer queries
Example: "How do I reset my password?"

Optimal Configuration:
  Chunking:
    - strategy: "by_heading" or "semantic"
    - chunk_size: 500-800 (small, focused)
    - chunk_overlap: 100-150 (minimal)

  Retrieval:
    - top_k: 3-5 (few, precise results)
    - score_threshold: 0.75+ (high relevance)
    - context_filter: "chatbot"
    - response_time: <500ms

Response Pattern:
  Short, direct answers:
  "To reset your password:
   1. Go to Settings
   2. Click Security
   3. Select Reset Password"
```

**Chatflow Requirements** (Complex Workflows):
```
Use Case: Multi-step automation, data extraction
Example: "Fetch all authentication methods and generate comparison"

Optimal Configuration:
  Chunking:
    - strategy: "by_heading" or "adaptive"
    - chunk_size: 1200-2000 (larger, more context)
    - chunk_overlap: 200-300 (more overlap)

  Retrieval:
    - top_k: 10-20 (many results)
    - score_threshold: 0.60+ (lower, wider net)
    - context_filter: "chatflow"
    - response_time: <2s (acceptable)

Response Pattern:
  Comprehensive information for processing:
  - Multiple chunks aggregated
  - Extract structured data
  - Multi-step reasoning
  - Generate detailed output
```

**Comparison Table**:

| Aspect | Chatbot | Chatflow | Why Different? |
|--------|---------|----------|----------------|
| **Chunk Size** | 500-800 | 1200-2000 | Chatbots need concise, chatflows need context |
| **Chunk Overlap** | 100-150 | 200-300 | More overlap = more continuity for complex tasks |
| **Top K** | 3-5 | 10-20 | Chatbots precise, chatflows comprehensive |
| **Score Threshold** | 0.75+ | 0.60+ | Chatbots strict, chatflows exploratory |
| **Response Time** | <500ms | <2s | User expects instant chat, workflows can be slower |
| **Answer Style** | Direct | Detailed | User interface vs backend processing |

---

## Implementation Checklist

### Infrastructure
- [ ] Add Tika server to Docker Compose
- [ ] Start Tika and verify health
- [ ] Add Python dependencies (aiohttp, python-magic)

### Services
- [ ] Create `tika_service.py` (~200 lines)
- [ ] Extend `kb_draft_service.py` with `add_file_source_to_draft()` (~60 lines)

### API Endpoints
- [ ] Add file upload endpoint to `kb_draft.py` (~80 lines)
- [ ] Enhance preview endpoint with on-the-fly chunking (~150 lines)

### Pipeline & Retrieval
- [ ] Extend pipeline task with metadata-only logic (~100 lines)
- [ ] Update Qdrant service to store full content in payload
- [ ] Create/update unified retrieval service with metadata filters
- [ ] Add retrieval_config support to KB config

### Testing - Storage Verification
- [ ] Test metadata-only storage (verify NO chunk records in PostgreSQL)
- [ ] Test Qdrant storage (verify chunks with full content ARE there)
- [ ] Test Qdrant payload contains full chunk text

### Testing - Functionality
- [ ] Test file upload (PDF, DOCX, TXT)
- [ ] Test preview with multiple configs (by_heading, no_chunking, etc.)
- [ ] Test finalization and pipeline processing
- [ ] Test retrieval with metadata filters (source_type, document_id, page_number)
- [ ] Test backward compatibility (web URLs unchanged)
- [ ] Test mixed KB (web URLs + file uploads)

---

**Status**: ✅ CORRECTED
**Ready**: Immediate Implementation
**Complexity**: Low-Medium (~590 lines)
**Risk**: Low (backward compatible)
**Timeline**: 8-10 hours

