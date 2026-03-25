# Vector Store Architecture - Best Practices for PrivexBot

**Date**: 2025-12-15
**Purpose**: Clarify vector database architecture, terminology, and best practices
**Status**: Technical Deep Dive

---

## Terminology Clarification

### What Are These Things?

**1. Embedding (Numerical Representation)**:
```python
# Example: Converting text to numbers
text = "How do I reset my password?"

# After embedding model processes it:
embedding = [0.123, -0.456, 0.789, ..., 0.234]  # 384 numbers for all-MiniLM-L6-v2
#            ↑ This is a 384-dimensional vector
```

**2. Vector = Embedding**:
- Same thing, different names
- A list of numbers representing semantic meaning of text
- Model used: `all-MiniLM-L6-v2` → produces 384-dimensional vectors

**3. Vector Store (Database)**:
- Special database optimized for storing and searching vectors
- Examples: Qdrant, Pinecone, Weaviate, Milvus, FAISS
- NOT a regular database (PostgreSQL stores rows, Vector Store stores vectors)

**4. Qdrant (The Specific Vector Database)**:
- PrivexBot uses Qdrant as the vector store
- Stores vectors + associated data (payload)
- Enables similarity search (find similar vectors fast)

**5. Collection (Namespace in Qdrant)**:
- Like a "table" in PostgreSQL
- Each KB gets its own collection: `kb_{kb_id}`
- Isolates data between different knowledge bases

**6. Chunk vs Vector**:
```
Chunk (Text):
"To reset your password, go to Settings > Security > Reset Password"
   ↓ (embedding model)
Vector (Numbers):
[0.123, -0.456, 0.789, ..., 0.234]  ← 384 numbers
```

**7. Payload (Data Stored WITH Vector)**:
```python
# In Qdrant, each vector has a payload (associated data)
{
    "id": "chunk-uuid-123",
    "vector": [0.123, -0.456, ...],  # The embedding
    "payload": {  # ← Additional data stored with vector
        "content": "To reset your password...",  # Full chunk text
        "document_id": "doc-uuid",
        "source_type": "file_upload",
        "page_number": 5,
        "metadata": {...}
    }
}
```

---

## What Gets Stored in Qdrant? (Best Practices)

### Industry Best Practices

**Option 1: Vector + Reference Only** (Minimal Storage)
```python
# Qdrant stores ONLY:
{
    "vector": [0.123, ...],
    "payload": {
        "chunk_id": "uuid-ref-to-postgresql",  # Reference
        "document_id": "doc-uuid",
        "score": 0.95
    }
}

# Then fetch content from PostgreSQL:
chunk = db.query(Chunk).filter(Chunk.id == chunk_id).first()
content = chunk.content
```

**Pros**:
- ✅ Single source of truth (PostgreSQL)
- ✅ Cheaper vector storage
- ✅ Easy to update content without re-embedding

**Cons**:
- ❌ Two queries (Qdrant → PostgreSQL)
- ❌ Slower retrieval (JOIN operation)
- ❌ More complex code

---

**Option 2: Vector + Full Content** (Self-Contained Storage) ✅ **RECOMMENDED for PrivexBot**
```python
# Qdrant stores EVERYTHING:
{
    "vector": [0.123, ...],
    "payload": {
        "content": "Full chunk text here...",  # ← Actual text
        "chunk_id": "uuid",
        "document_id": "doc-uuid",
        "document_name": "report.pdf",
        "source_type": "file_upload",
        "page_number": 5,
        "char_count": 850,
        "token_count": 180,
        "metadata": {...}
    }
}

# Retrieval is ONE query:
results = await qdrant_service.search(query, top_k=5)
# results already contain full chunk text!
```

**Pros**:
- ✅ Single query (fast retrieval)
- ✅ Simple architecture (no JOINs)
- ✅ Qdrant designed for this (payloads are optimized)
- ✅ No PostgreSQL dependency for retrieval

**Cons**:
- ⚠️ Data duplication (if also in PostgreSQL)
- ⚠️ Higher vector storage costs (minimal for your scale)
- ⚠️ Updates require re-embedding

---

### PrivexBot Best Practice Decision

**RECOMMENDATION**: Use **Option 2** (Vector + Full Content in Qdrant)

**Why**:
1. **Fast Retrieval**: One query to Qdrant, no PostgreSQL JOIN
2. **Simple Code**: Fewer moving parts, less complexity
3. **Scale Appropriate**: Your scale (100-500 docs/hour) = cheap storage
4. **Qdrant Optimized**: Qdrant is DESIGNED to store payloads with vectors
5. **Existing Pattern**: Your code already does this for web URLs

**When to Use Option 1**:
- Massive scale (millions of documents)
- Frequent content updates
- Cost-sensitive (high vector storage costs)

**Your Scale**: Option 2 is perfect ✅

---

## PrivexBot Architecture - What Gets Stored Where

### For Web URLs (Existing)

**PostgreSQL Document Table**:
```python
{
    "id": "doc-uuid",
    "name": "Privacy Policy",
    "source_type": "web_scraping",
    "source_url": "https://example.com/privacy",
    "content_full": "Full scraped page content...",  # ← Full backup
    "chunk_count": 15
}
```

**PostgreSQL Chunk Table**:
```python
{
    "id": "chunk-uuid-1",
    "document_id": "doc-uuid",
    "content": "Privacy Policy - Section 1: We collect...",  # ← Chunk text
    "position": 0,
    "embedding": None  # Or pgvector if enabled
}
# ... 14 more chunk records
```

**Qdrant Collection** (`kb_{kb_id}`):
```python
{
    "id": "chunk-uuid-1",  # Same as PostgreSQL Chunk.id
    "vector": [0.123, -0.456, ...],  # 384-dim embedding
    "payload": {
        "content": "Privacy Policy - Section 1: We collect...",  # ← FULL text
        "document_id": "doc-uuid",
        "document_name": "Privacy Policy",
        "source_type": "web_scraping",
        "source_url": "https://example.com/privacy",
        "chunk_index": 0,
        "page_number": 1,
        "char_count": 850
    }
}
# ... 14 more vectors
```

**Retrieval Options**:
```python
# Option A: Query Qdrant (FAST - recommended)
results = await qdrant_service.search(kb_id, query="data collection", top_k=5)
# Results already contain full chunk text in payload

# Option B: Query PostgreSQL (SLOWER - not recommended)
chunks = db.query(Chunk).filter(Chunk.document_id == doc_id).all()
```

---

### For File Uploads (NEW - Metadata Only)

**PostgreSQL Document Table**:
```python
{
    "id": "doc-uuid",
    "name": "report.pdf",
    "source_type": "file_upload",
    "source_url": None,
    "content_full": None,  # ← NO CONTENT
    "chunk_count": 15,  # Reference only
    "source_metadata": {  # ← ONLY metadata
        "original_filename": "Q4_Report.pdf",
        "file_size_bytes": 2048576,
        "mime_type": "application/pdf",
        "file_hash_sha256": "abc123...",
        "page_count": 45,
        "storage_strategy": "qdrant_only"
    }
}
```

**PostgreSQL Chunk Table**:
```sql
-- EMPTY for file uploads
SELECT COUNT(*) FROM chunks WHERE document_id = 'file-upload-doc-uuid';
-- Result: 0
```

**Qdrant Collection** (`kb_{kb_id}`):
```python
{
    "id": "generated-chunk-uuid-1",  # NOT in PostgreSQL
    "vector": [0.123, -0.456, ...],  # 384-dim embedding
    "payload": {
        "content": "Q4 Financial Report - Executive Summary...",  # ← FULL chunk text
        "document_id": "doc-uuid",
        "document_name": "report.pdf",
        "source_type": "file_upload",
        "original_filename": "Q4_Report.pdf",
        "chunk_index": 0,
        "page_number": 1,
        "char_count": 850,
        "token_count": 180,
        "storage_location": "qdrant_only"
    }
}
# ... 14 more vectors (ALL content stored here)
```

**Retrieval** (MUST use Qdrant):
```python
# ONLY option for file uploads:
results = await qdrant_service.search(kb_id, query="Q4 revenue", top_k=5)
# Results contain full chunk text in payload
```

---

## Chunking Strategy Impact on Storage

### Strategy 1: Regular Chunking (by_heading, semantic, etc.)

**User Config**:
```json
{
  "strategy": "by_heading",
  "chunk_size": 1000,
  "chunk_overlap": 200
}
```

**Result**: Multiple chunks (e.g., 15 chunks)

**Qdrant Storage**:
```python
# 15 separate vectors stored
{
    "id": "chunk-0",
    "vector": [0.123, ...],
    "payload": {"content": "Chunk 0 text...", ...}
},
{
    "id": "chunk-1",
    "vector": [0.456, ...],
    "payload": {"content": "Chunk 1 text...", ...}
},
# ... 13 more
```

---

### Strategy 2: No Chunking (full_content)

**User Config**:
```json
{
  "strategy": "no_chunking"
}
```

**Result**: ONE large chunk (entire document)

**Qdrant Storage**:
```python
# Only 1 vector stored (entire document as one chunk)
{
    "id": "chunk-0",
    "vector": [0.789, ...],  # Embedding of ENTIRE document
    "payload": {
        "content": "ENTIRE document text here... (12,500 characters)",
        "chunk_index": 0,
        "char_count": 12500,
        "is_full_document": true
    }
}
```

**Limitation**: Embedding models have max token limits:
- `all-MiniLM-L6-v2`: Max 512 tokens (~2000 characters)
- If document > 512 tokens, it gets truncated before embedding
- For large documents, chunking is REQUIRED

---

## Retrieval Configuration

### What is Retrieval Config?

Configuration for HOW to search and rank results.

**Complete Retrieval Config**:
```python
retrieval_config = {
    # Search Strategy
    "strategy": "hybrid_search",  # semantic_search, keyword_search, hybrid_search

    # Result Limits
    "top_k": 5,  # Number of results to return
    "score_threshold": 0.7,  # Minimum similarity score (0.0-1.0)

    # Distance Metrics
    "max_distance": 0.5,  # Maximum vector distance
    "distance_metric": "cosine",  # cosine, euclidean, dot_product

    # Metadata Filtering
    "metadata_filters": {
        "source_type": "file_upload",  # Only file uploads
        "page_number": [1, 2, 3],  # Only pages 1-3
        "document_id": "specific-doc-uuid"  # Specific document
    },

    # Reranking
    "rerank_enabled": false,  # Re-rank results with cross-encoder
    "rerank_model": "cross-encoder/ms-marco-MiniLM-L-6-v2",

    # Performance
    "search_params": {
        "hnsw_ef": 128,  # Qdrant HNSW parameter
        "exact": false   # Use approximate search (faster)
    }
}
```

### How Retrieval Works

**Step 1: Embed Query**
```python
query = "How do I reset my password?"
query_embedding = embedding_service.generate_embedding(query)
# Result: [0.234, -0.567, 0.891, ...]
```

**Step 2: Search Qdrant**
```python
results = await qdrant_service.search(
    collection_name=f"kb_{kb_id}",
    query_vector=query_embedding,
    limit=retrieval_config["top_k"],
    score_threshold=retrieval_config["score_threshold"],
    query_filter={  # ← Metadata filtering
        "must": [
            {"key": "source_type", "match": {"value": "file_upload"}}
        ]
    }
)
```

**Step 3: Return Results**
```python
# Results already contain full chunk text
[
    {
        "id": "chunk-uuid-1",
        "score": 0.92,  # Similarity score
        "payload": {
            "content": "To reset your password, go to Settings...",  # ← Ready to use
            "document_name": "User Guide.pdf",
            "page_number": 12
        }
    },
    # ... more results
]
```

---

## Complete Data Flow

### Web URL Flow (Both Flows)

```
1. Scrape web page
   ↓
2. Store in PostgreSQL:
   - Document.content_full = "Full page text"
   - Create 15 Chunk records with chunk text
   ↓
3. Generate embeddings for each chunk
   ↓
4. Store in Qdrant:
   - 15 vectors
   - Each payload contains FULL chunk text
   ↓
5. Retrieval:
   Query Qdrant → Get results with full text → Return to user
```

### File Upload Flow (Metadata Only)

```
1. Parse file with Tika
   ↓
2. Store in PostgreSQL:
   - Document.source_metadata = {filename, size, mime_type, ...}
   - Document.content_full = None
   - NO Chunk records created
   ↓
3. Chunk content (IN MEMORY only)
   ↓
4. Generate embeddings for each chunk
   ↓
5. Store in Qdrant:
   - 15 vectors
   - Each payload contains FULL chunk text
   ↓
6. Retrieval:
   Query Qdrant → Get results with full text → Return to user
```

---

## Best Practice Recommendations for PrivexBot

### ✅ What to Do

**1. Store in Qdrant**:
```python
await qdrant_service.add_chunk(
    collection_name=f"kb_{kb_id}",
    vector=embedding,
    payload={
        "content": chunk_text,  # ← FULL chunk text
        "document_id": str(document.id),
        "document_name": document.name,
        "source_type": document.source_type,
        "chunk_index": idx,
        "page_number": page_num,
        "char_count": len(chunk_text),
        "token_count": len(chunk_text) // 4,
        # Metadata for filtering:
        "created_at": datetime.utcnow().isoformat(),
        "workspace_id": str(workspace_id)
    }
)
```

**2. Use Metadata Filters for Retrieval**:
```python
# Search only file uploads
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

# Search specific document
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

# Search specific pages
results = await qdrant_service.search(
    collection_name=f"kb_{kb_id}",
    query_vector=query_embedding,
    limit=5,
    query_filter={
        "must": [
            {"key": "page_number", "range": {"gte": 1, "lte": 5}}
        ]
    }
)
```

**3. Retrieval Service Pattern**:
```python
async def retrieve_chunks(
    kb_id: UUID,
    query: str,
    retrieval_config: Dict[str, Any]
) -> List[Dict]:
    """
    Unified retrieval for both web URLs and file uploads.

    Works because Qdrant contains full content for BOTH types.
    """

    # Embed query
    query_embedding = embedding_service.generate_embedding(query)

    # Build metadata filters
    filters = []
    if retrieval_config.get("source_type"):
        filters.append({
            "key": "source_type",
            "match": {"value": retrieval_config["source_type"]}
        })

    if retrieval_config.get("document_id"):
        filters.append({
            "key": "document_id",
            "match": {"value": str(retrieval_config["document_id"])}
        })

    # Search Qdrant
    results = await qdrant_service.search(
        collection_name=f"kb_{kb_id}",
        query_vector=query_embedding,
        limit=retrieval_config.get("top_k", 5),
        score_threshold=retrieval_config.get("score_threshold", 0.7),
        query_filter={"must": filters} if filters else None
    )

    # Results already contain full chunk text in payload
    return [
        {
            "content": r.payload["content"],  # Full text ready
            "score": r.score,
            "document_name": r.payload["document_name"],
            "page_number": r.payload.get("page_number"),
            "source_type": r.payload["source_type"]
        }
        for r in results
    ]
```

### ❌ What NOT to Do

1. ❌ Don't store ONLY chunk IDs in Qdrant (adds complexity)
2. ❌ Don't query PostgreSQL Chunk table for retrieval (slower)
3. ❌ Don't duplicate embeddings in PostgreSQL (Qdrant is source of truth)
4. ❌ Don't use different retrieval logic for web vs file (unified in Qdrant)

---

## Summary

### Architecture Decision

**For Both Web URLs and File Uploads**:

| Component | What Gets Stored |
|-----------|------------------|
| **Qdrant** | ✅ Vectors (embeddings) + FULL chunk text + Metadata |
| **PostgreSQL (web URLs)** | ✅ Full content + Chunks (backup/reference) |
| **PostgreSQL (file uploads)** | ✅ Metadata ONLY (no content) |

### Why This Works

1. **Fast Retrieval**: Single query to Qdrant (no JOINs)
2. **Simple Code**: One retrieval path for both source types
3. **Metadata Filtering**: Use Qdrant filters for precise results
4. **Scale Appropriate**: Perfect for 100-500 docs/hour
5. **No Over-Engineering**: Uses Qdrant as designed

### Key Concepts

- **Vector = Embedding**: Same thing (list of numbers)
- **Qdrant Payload**: Can store full text WITH vector (optimized for this)
- **Collection**: One per KB for data isolation
- **Retrieval Config**: Controls search strategy, filters, scoring
- **No Chunking**: Still creates ONE vector (entire document)

---

**Status**: Architecture Clarified
**Best Practice**: Store full content in Qdrant payload
**Reason**: Fast, simple, appropriate for scale
**Complexity**: Low (no over-engineering)

