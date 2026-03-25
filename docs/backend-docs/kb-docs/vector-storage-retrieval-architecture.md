# Vector Storage & Retrieval Architecture

> **Last Updated**: December 18, 2024
> **Status**: Production Ready
> **Scope**: Qdrant vector storage, document addition, and chatbot/chatflow retrieval

---

## Table of Contents

1. [Overview](#overview)
2. [Qdrant Collection Architecture](#qdrant-collection-architecture)
3. [Vector Storage Flow](#vector-storage-flow)
4. [Retrieval Flow](#retrieval-flow)
5. [How New Documents Sync with Existing](#how-new-documents-sync-with-existing)
6. [Chatbot/Chatflow Integration](#chatbotchatflow-integration)
7. [Vector Metadata Structure](#vector-metadata-structure)
8. [Why This Architecture is Recommended](#why-this-architecture-is-recommended)
9. [Performance Considerations](#performance-considerations)
10. [Common Questions](#common-questions)

---

## Overview

PrivexBot uses **Qdrant** as its vector database for semantic search capabilities. Each Knowledge Base (KB) has a dedicated Qdrant collection where all document chunks are stored as vectors.

### Key Principles

| Principle | Implementation |
|-----------|---------------|
| **One Collection per KB** | `kb_{kb_id}` naming convention |
| **Additive Storage** | New vectors are ADDED to existing collection |
| **Immediate Searchability** | Vectors are indexed synchronously |
| **Unified Search** | All vectors (old + new) searched together |
| **No Manual Sync** | Qdrant handles index maintenance |

---

## Qdrant Collection Architecture

### Collection Naming

```python
# From qdrant_service.py - Line 115-117
def _get_collection_name(self, kb_id: UUID) -> str:
    """Get collection name for a knowledge base"""
    return f"kb_{str(kb_id).replace('-', '_')}"

# Example: kb_e73eb7b7_7272_4cd9_8de0_96f846ebb1ba
```

### Collection Structure

```
┌─────────────────────────────────────────────────────────────────┐
│                    Qdrant Instance                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Collection: kb_e73eb7b7_7272_4cd9_8de0_96f846ebb1ba     │   │
│  │                                                         │   │
│  │  Initial documents (A, B):                              │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐       │   │
│  │  │Vector 1 │ │Vector 2 │ │Vector 3 │ │Vector 4 │       │   │
│  │  │doc_id:A │ │doc_id:A │ │doc_id:B │ │doc_id:B │       │   │
│  │  │chunk:0  │ │chunk:1  │ │chunk:0  │ │chunk:1  │       │   │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘       │   │
│  │                                                         │   │
│  │  After adding new document C:                          │   │
│  │  ┌─────────┐ ┌─────────┐                               │   │
│  │  │Vector 5 │ │Vector 6 │  ← NEW vectors ADDED          │   │
│  │  │doc_id:C │ │doc_id:C │    to SAME collection         │   │
│  │  │chunk:0  │ │chunk:1  │    (not replacing)            │   │
│  │  └─────────┘ └─────────┘                               │   │
│  │                                                         │   │
│  │  Total: 6 vectors, all searchable together             │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Collection: kb_another_kb_uuid                          │   │
│  │  (Completely separate - different KB)                   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Collection Configuration

```python
# From qdrant_service.py - Line 119-178
async def create_kb_collection(
    self,
    kb_id: UUID,
    vector_size: int = 384,        # Embedding dimension
    distance_metric: str = "Cosine", # Similarity metric
    hnsw_m: int = 16,              # HNSW connections per node
    ef_construct: int = 100        # Construction accuracy
) -> bool:

    self.client.create_collection(
        collection_name=collection_name,
        vectors_config=models.VectorParams(
            size=vector_size,
            distance=getattr(models.Distance, distance_metric.upper())
        ),
        hnsw_config=models.HnswConfigDiff(
            m=hnsw_m,
            ef_construct=ef_construct,
        ),
        optimizers_config=models.OptimizersConfigDiff(
            indexing_threshold=10000,  # Start HNSW indexing after 10k vectors
        )
    )
```

---

## Vector Storage Flow

### Adding New Documents

When a new document is added to an existing KB, the following happens:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           DOCUMENT ADDITION FLOW                         │
└─────────────────────────────────────────────────────────────────────────┘

  User Uploads File / Adds Text
         │
         ▼
  ┌──────────────────┐
  │ 1. Parse Content │
  │    - Tika (PDF, Word, etc.)
  │    - Simple (txt, md, json, csv)
  └──────────────────┘
         │
         ▼
  ┌──────────────────┐
  │ 2. Chunk Content │
  │    - Strategy: recursive, semantic, etc.
  │    - Size: 1000 chars (configurable)
  │    - Overlap: 200 chars (configurable)
  └──────────────────┘
         │
         ▼
  ┌──────────────────┐
  │ 3. Generate      │
  │    Embeddings    │
  │    - Model: all-MiniLM-L6-v2 (384 dims)
  │    - Batch processing
  └──────────────────┘
         │
         ▼
  ┌──────────────────┐
  │ 4. Upsert to     │ ──► Vectors ADDED to existing collection
  │    Qdrant        │     (not replacing, not creating new collection)
  │    wait=True     │     Immediately indexed and searchable
  └──────────────────┘
```

### Upsert Implementation

```python
# From qdrant_service.py - Line 208-270
async def upsert_chunks(
    self,
    kb_id: UUID,
    chunks: List[QdrantChunk],
    batch_size: int = 100
) -> int:
    """
    UPSERT = INSERT new vectors, UPDATE if ID exists

    CRITICAL: New vectors are ADDED to the existing collection.
    No "sync" or "merge" needed - they're immediately searchable.
    """

    collection_name = self._get_collection_name(kb_id)

    # Prepare points for Qdrant
    points = []
    for chunk in chunks:
        payload = {
            "content": chunk.content,
            **chunk.metadata  # Spread metadata into payload
        }

        point = models.PointStruct(
            id=chunk.id,           # Unique chunk UUID
            vector=chunk.embedding, # 384-dim vector
            payload=payload        # Searchable metadata
        )
        points.append(point)

    # Batch upsert with immediate indexing
    for i in range(0, len(points), batch_size):
        batch = points[i:i + batch_size]

        self.client.upsert(
            collection_name=collection_name,
            points=batch,
            wait=True  # CRITICAL: Wait for indexing (immediately searchable)
        )

    return total_upserted
```

### Why `wait=True` is Critical

```python
self.client.upsert(
    collection_name=collection_name,
    points=batch,
    wait=True  # Wait for indexing
)
```

| Setting | Behavior | Use Case |
|---------|----------|----------|
| `wait=True` | Synchronous - returns after indexing complete | Production (consistency) |
| `wait=False` | Asynchronous - returns immediately | Bulk imports (speed) |

We use `wait=True` to ensure:
1. Vectors are indexed before task completion
2. Immediate searchability after document addition
3. Consistent behavior for users

---

## Retrieval Flow

### Search Implementation

```python
# From qdrant_service.py - Line 272-334
async def search(
    self,
    kb_id: UUID,
    query_embedding: List[float],
    top_k: int = 5,
    score_threshold: Optional[float] = None,
    filters: Optional[Dict[str, Any]] = None
) -> List[SearchResult]:
    """
    Search for similar chunks in a knowledge base.

    CRITICAL: Searches the ENTIRE collection - all vectors
    (old and new) are searched together.
    """

    collection_name = self._get_collection_name(kb_id)

    # Search using Qdrant's HNSW index
    search_results = self.client.query_points(
        collection_name=collection_name,
        query=query_embedding,
        limit=top_k,
        score_threshold=score_threshold,
        query_filter=qdrant_filter,
        with_payload=True,
        with_vectors=False  # Don't return vectors (save bandwidth)
    ).points

    # Convert to SearchResult objects
    results = []
    for hit in search_results:
        results.append(SearchResult(
            id=str(hit.id),
            score=hit.score,  # Similarity score (0-1 for cosine)
            content=hit.payload.get("content", ""),
            metadata={k: v for k, v in hit.payload.items() if k != "content"}
        ))

    return results
```

### Context-Aware Search

```python
# From qdrant_service.py - Line 336-450
async def search_with_context(
    self,
    kb_id: UUID,
    query_embedding: List[float],
    context: str,  # "chatbot", "chatflow", or "both"
    top_k: int = 5,
    score_threshold: Optional[float] = None
) -> List[SearchResult]:
    """
    Search with context filtering for chatbot/chatflow.

    Context Filtering:
    - "chatbot": Returns chunks with kb_context = "chatbot" or "both"
    - "chatflow": Returns chunks with kb_context = "chatflow" or "both"
    - "both": Returns all chunks (no filtering)
    """

    # Build context filter
    if context in ["chatbot", "chatflow"]:
        must_conditions.append({
            "key": "kb_context",
            "match": {"any": [context, "both"]}
        })
```

---

## How New Documents Sync with Existing

### The Short Answer: They Don't Need To "Sync"

**Qdrant is a vector database, not a traditional relational database.**

When you add new vectors:
1. They are inserted into the collection
2. HNSW index is updated automatically
3. New vectors join the existing search graph
4. Next search query includes them automatically

### Visual Explanation

```
BEFORE: KB has documents A and B (4 vectors total)
┌─────────────────────────────────────────┐
│  Qdrant Collection: kb_xxx              │
│                                         │
│  [Vec1:A] ──── [Vec2:A]                │
│      │            │                     │
│      └──── [Vec3:B] ────[Vec4:B]       │
│                                         │
│  HNSW Graph: 4 nodes connected          │
└─────────────────────────────────────────┘

AFTER: User adds document C (2 new vectors)
┌─────────────────────────────────────────┐
│  Qdrant Collection: kb_xxx              │
│                                         │
│  [Vec1:A] ──── [Vec2:A]                │
│      │            │                     │
│      └──── [Vec3:B] ────[Vec4:B]       │
│                │                        │
│           [Vec5:C] ────[Vec6:C]  ← NEW │
│                                         │
│  HNSW Graph: 6 nodes, auto-connected    │
└─────────────────────────────────────────┘

SEARCH: "What is the refund policy?"
┌─────────────────────────────────────────┐
│  Query vector compared to ALL 6 vectors │
│                                         │
│  Results (by similarity):               │
│  1. Vec5:C (0.92) ← New doc might win! │
│  2. Vec3:B (0.85)                       │
│  3. Vec1:A (0.78)                       │
│  ...                                    │
└─────────────────────────────────────────┘
```

### Why No Manual Sync is Needed

| Aspect | How Qdrant Handles It |
|--------|----------------------|
| **Index Updates** | HNSW graph auto-updates on insert |
| **Vector Connections** | New vectors connect to nearest neighbors |
| **Search Scope** | Always searches entire collection |
| **Consistency** | `wait=True` ensures immediate visibility |

---

## Chatbot/Chatflow Integration

### How Chatbot Retrieves Context

```python
# From chatbot_service.py

class ChatbotService:
    def __init__(self):
        self.retrieval_service = retrieval_service

    async def process_message(self, db, chatbot, message, session):
        # 1. Check if chatbot has knowledge bases
        if chatbot.knowledge_base_ids:
            # 2. Retrieve relevant context from ALL linked KBs
            retrieval_result = await self._retrieve_context(
                db=db,
                kb_ids=chatbot.knowledge_base_ids,
                query=message,
                override_settings=chatbot.retrieval_config
            )
            context = retrieval_result["context"]
            sources = retrieval_result["sources"]

        # 3. Build prompt with context
        # 4. Call LLM
        # 5. Return response with sources

    async def _retrieve_context(self, db, kb_ids, query, override_settings):
        # For each KB, search Qdrant
        results = await self.retrieval_service.search(
            db=db,
            kb_id=kb_id,
            query=query,
            top_k=caller_top_k,
            search_method=caller_search_method,
            threshold=caller_threshold
        )
        return results
```

### Retrieval Service Flow

```python
# From retrieval_service.py

class RetrievalService:
    async def search(self, db, kb_id, query, top_k, search_method, threshold):
        # 1. Generate query embedding
        query_embedding = await self.embedding_service.generate_embeddings([query])

        # 2. Search Qdrant (ALL vectors in collection)
        vector_results = await self.qdrant_service.search(
            kb_id=kb_id,
            query_embedding=query_embedding[0],
            top_k=top_k,
            score_threshold=threshold
        )

        # 3. Optionally enrich with PostgreSQL data
        # 4. Return formatted results
        return {
            "context": combined_context,
            "sources": source_documents
        }
```

### Complete Message Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     CHATBOT MESSAGE FLOW                                 │
└─────────────────────────────────────────────────────────────────────────┘

  User: "What is the refund policy?"
         │
         ▼
  ┌──────────────────┐
  │ ChatbotService   │
  │ process_message()│
  └──────────────────┘
         │
         ▼
  ┌──────────────────┐
  │ RetrievalService │
  │ search()         │
  └──────────────────┘
         │
         ▼
  ┌──────────────────┐
  │ EmbeddingService │
  │ Generate query   │
  │ embedding        │
  └──────────────────┘
         │
         ▼
  ┌──────────────────────────────────────────────┐
  │           QdrantService.search()              │
  │                                              │
  │  Collection: kb_xxx                          │
  │                                              │
  │  Searches ALL vectors:                       │
  │  • Original documents (A, B)                 │
  │  • Newly added documents (C, D, E)           │
  │  • File uploads                              │
  │  • Text documents                            │
  │                                              │
  │  HNSW Index traversal:                       │
  │  Query → Nearest neighbors → Top K results   │
  │                                              │
  │  Returns: Most similar chunks regardless     │
  │           of when they were added            │
  └──────────────────────────────────────────────┘
         │
         ▼
  ┌──────────────────┐
  │ Build Context    │
  │ from top chunks  │
  └──────────────────┘
         │
         ▼
  ┌──────────────────┐
  │ InferenceService │
  │ LLM call with    │
  │ context          │
  └──────────────────┘
         │
         ▼
  Response: "Our refund policy allows returns within 30 days..."
```

---

## Vector Metadata Structure

### Payload Schema

Each vector in Qdrant stores rich metadata:

```json
{
    "id": "chunk-uuid-string",
    "vector": [0.123, -0.456, 0.789, ...],  // 384 dimensions
    "payload": {
        // Content
        "content": "The actual chunk text that will be returned...",

        // Identifiers
        "document_id": "doc-uuid",
        "kb_id": "kb-uuid",
        "workspace_id": "workspace-uuid",

        // Context filtering
        "kb_context": "both",  // "chatbot", "chatflow", or "both"

        // Position
        "chunk_index": 0,

        // Source info
        "document_name": "Refund Policy.pdf",
        "source_type": "file_upload",  // or "web_scraping", "manual"
        "source_url": "file:///Refund Policy.pdf",

        // Statistics
        "word_count": 150,
        "character_count": 850,
        "token_count": 180
    }
}
```

### Metadata Use Cases

| Field | Use Case |
|-------|----------|
| `document_id` | Delete all chunks for a document |
| `kb_id` | Verify chunk belongs to KB |
| `workspace_id` | Multi-tenant isolation |
| `kb_context` | Filter for chatbot vs chatflow |
| `source_type` | Track origin (file vs web) |
| `chunk_index` | Order chunks for context building |

### Filtering Examples

```python
# Search only file upload chunks
filters = {
    "source_type": {"$eq": "file_upload"}
}

# Search specific document
filters = {
    "document_id": {"$eq": "doc-uuid"}
}

# Search chatbot-relevant chunks only
# (Handled by search_with_context)
context_filter = {
    "kb_context": {"$in": ["chatbot", "both"]}
}
```

---

## Why This Architecture is Recommended

### Industry Standard Validation

| Aspect | PrivexBot Implementation | Industry Best Practice |
|--------|-------------------------|----------------------|
| **One collection per KB** | ✅ `kb_{kb_id}` | ✅ Isolation & management |
| **Upsert for additions** | ✅ Adds to existing | ✅ Standard approach |
| **Immediate indexing** | ✅ `wait=True` | ✅ Consistency |
| **HNSW index** | ✅ Configurable M, ef | ✅ Best ANN algorithm |
| **Metadata filtering** | ✅ Rich payload | ✅ Enables scoped search |
| **No manual sync** | ✅ Automatic | ✅ Vector DB handles it |

### Benefits of This Architecture

1. **Simplicity**: No complex sync logic needed
2. **Consistency**: Vectors immediately available after insert
3. **Scalability**: HNSW handles millions of vectors efficiently
4. **Flexibility**: Metadata enables advanced filtering
5. **Isolation**: Each KB is a separate collection

### Alternatives Considered

| Alternative | Why Not Used |
|-------------|--------------|
| **One global collection** | No KB isolation, harder to delete |
| **Collection per document** | Too many collections, can't search across docs |
| **External sync service** | Unnecessary complexity |
| **Batch indexing only** | Poor user experience (delayed search) |

---

## Performance Considerations

### HNSW Index Parameters

```python
hnsw_config=models.HnswConfigDiff(
    m=16,           # Connections per node (higher = better recall, more memory)
    ef_construct=100 # Construction accuracy
)
```

| Parameter | Default | Trade-off |
|-----------|---------|-----------|
| `m` | 16 | Higher = better recall, more memory |
| `ef_construct` | 100 | Higher = better index, slower build |
| `ef_search` | 128 | Higher = better recall, slower search |

### Collection Size Guidelines

| Vectors | Expected Performance |
|---------|---------------------|
| < 10,000 | < 10ms search |
| 10,000 - 100,000 | 10-50ms search |
| 100,000 - 1,000,000 | 50-200ms search |
| > 1,000,000 | Consider sharding |

### Memory Estimation

```
Memory ≈ vectors × dimensions × 4 bytes × 1.5 (overhead)

Example: 100,000 vectors × 384 dims × 4 × 1.5 = ~230 MB
```

---

## Common Questions

### Q: Do I need to manually sync new documents?

**No.** Qdrant handles this automatically. When you upsert vectors:
1. They're added to the collection
2. HNSW index updates
3. Next search includes them

### Q: Will the chatbot see newly added documents?

**Yes, immediately.** Because we use `wait=True`, vectors are indexed before the upsert returns. The next search query will include them.

### Q: What happens if I add a document while a search is running?

The search will complete with the vectors that existed when it started. The new vectors will be included in subsequent searches. This is standard database behavior.

### Q: Can I search only new documents?

**Yes**, using metadata filtering:
```python
filters = {
    "document_id": {"$eq": "new-doc-uuid"}
}
```

Or by timestamp if you add `created_at` to metadata.

### Q: How do I delete a document's vectors?

```python
# Delete by document_id filter
await qdrant_service.delete_by_filter(
    kb_id=kb_id,
    filters={"document_id": {"$eq": doc_id}}
)
```

### Q: What if I need to update a document?

1. Delete old vectors (by document_id)
2. Re-chunk the new content
3. Generate new embeddings
4. Upsert new vectors

This is handled by `reprocess_document_task`.

---

## Summary

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        KEY TAKEAWAYS                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. ONE COLLECTION PER KB                                               │
│     └─ All documents in kb_{kb_id} collection                          │
│                                                                         │
│  2. ADDITIVE STORAGE                                                    │
│     └─ New vectors ADDED to existing (not replacing)                   │
│                                                                         │
│  3. IMMEDIATE SEARCHABILITY                                             │
│     └─ wait=True ensures indexed before return                         │
│                                                                         │
│  4. UNIFIED SEARCH                                                      │
│     └─ Chatbot/chatflow searches ALL vectors together                  │
│                                                                         │
│  5. NO MANUAL SYNC                                                      │
│     └─ Qdrant HNSW index auto-updates                                  │
│                                                                         │
│  6. METADATA ENABLES FILTERING                                          │
│     └─ document_id, source_type, kb_context, etc.                      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

This architecture is **correct, recommended, and follows industry best practices** for RAG systems.
