# PrivexBot Qdrant Vector Database Integration

## Overview

PrivexBot uses **Qdrant** as its primary vector database for storing and searching embeddings. Qdrant is self-hosted on Secret VM, ensuring all vector data remains within the Trusted Execution Environment.

## Why Qdrant?

1. **Self-Hosted**: Complete control over data
2. **High Performance**: Optimized for similarity search
3. **HNSW Index**: Fast approximate nearest neighbor search
4. **Metadata Filtering**: Filter by document, KB, or custom fields
5. **Payload Storage**: Store content alongside vectors

## Architecture

### One Collection Per Knowledge Base

```python
# Collection naming convention
collection_name = f"kb_{kb_id.replace('-', '_')}"
# Example: kb_123e4567_e89b_12d3_a456_426614174000
```

Each KB gets isolated vector storage:
- Prevents cross-contamination
- Enables KB-level deletion
- Simplifies access control

## Collection Configuration

### Creation Parameters

```python
qdrant_service.create_kb_collection(
    kb_id=kb_id,
    vector_size=384,              # Matches embedding model (all-MiniLM-L6-v2)
    distance_metric="Cosine",     # Cosine | Dot | Euclid
    hnsw_m=16,                    # HNSW connections per node
    ef_construct=100              # Construction accuracy
)
```

### HNSW Index Configuration

| Parameter | Default | Description |
|-----------|---------|-------------|
| `m` | 16 | Connections per node (higher = better recall, more memory) |
| `ef_construct` | 100 | Construction accuracy (higher = better index, slower build) |
| `ef` | 128 | Search accuracy (set at query time) |

### Distance Metrics

| Metric | Formula | Use Case |
|--------|---------|----------|
| **Cosine** | 1 - cos(a,b) | Normalized embeddings (default) |
| **Dot** | a·b | When magnitude matters |
| **Euclid** | ||a-b|| | Spatial similarity |

## Vector Storage Structure

### Point Structure

Each chunk is stored as a Qdrant "point":

```python
{
    "id": "chunk_uuid",
    "vector": [0.1, 0.2, ..., 0.384],  # 384-dimensional
    "payload": {
        # Content
        "content": "The actual chunk text...",

        # Relationships
        "document_id": "uuid",
        "document_name": "FAQ.pdf",
        "kb_id": "uuid",

        # Context
        "page_number": 5,
        "chunk_index": 12,
        "kb_context": "chatbot",  # chatbot | chatflow | both

        # Metadata
        "heading": "Installation",
        "source_url": "https://docs.example.com",
        "annotations": {
            "importance": "high",
            "category": "tutorial"
        }
    }
}
```

### Payload Fields

| Field | Type | Description |
|-------|------|-------------|
| `content` | string | Full chunk text |
| `document_id` | string | Parent document UUID |
| `document_name` | string | Document title |
| `kb_id` | string | Knowledge base UUID |
| `page_number` | int | Source page (if applicable) |
| `chunk_index` | int | Position in document |
| `kb_context` | string | Access context filter |
| `annotations` | object | User annotations |

## Indexing Operations

### Batch Upsert

```python
async def upsert_chunks(
    kb_id: UUID,
    chunks: List[QdrantChunk],
    batch_size: int = 100
) -> int:
    """
    Insert or update chunks in Qdrant.
    Throughput: 500-1000 vectors/second
    """

    collection_name = f"kb_{kb_id.replace('-', '_')}"

    points = []
    for chunk in chunks:
        point = {
            "id": chunk.id,
            "vector": chunk.embedding,
            "payload": {
                "content": chunk.content,
                **chunk.metadata
            }
        }
        points.append(point)

    # Batch upsert for efficiency
    for i in range(0, len(points), batch_size):
        batch = points[i:i + batch_size]
        qdrant_client.upsert(
            collection_name=collection_name,
            points=batch,
            wait=True  # Wait for indexing
        )

    return len(points)
```

### Pipeline Integration

During KB processing:

```python
# Generate embeddings
embeddings = await embedding_service.generate_embeddings(chunk_texts)

# Prepare Qdrant chunks
qdrant_chunks = []
for idx, (chunk_text, embedding) in enumerate(zip(chunk_texts, embeddings)):
    qdrant_chunks.append(QdrantChunk(
        id=f"chunk_{document_id}_{idx}",
        embedding=embedding,
        content=chunk_text,
        metadata={
            "document_id": str(document_id),
            "kb_id": str(kb_id),
            "chunk_index": idx
        }
    ))

# Index in Qdrant
await qdrant_service.upsert_chunks(kb_id, qdrant_chunks, batch_size=100)
```

## Search Operations

### Basic Vector Search

```python
async def search(
    kb_id: UUID,
    query_embedding: List[float],
    top_k: int = 5,
    score_threshold: Optional[float] = None,
    filters: Optional[Dict] = None
) -> List[SearchResult]:
    """
    Search for similar chunks.
    Latency: 10-50ms for <100k vectors
    """

    collection_name = f"kb_{kb_id.replace('-', '_')}"

    # Build filter if provided
    qdrant_filter = _build_filter(filters) if filters else None

    # Query Qdrant
    results = qdrant_client.query_points(
        collection_name=collection_name,
        query=query_embedding,
        limit=top_k,
        score_threshold=score_threshold,
        query_filter=qdrant_filter,
        with_payload=True,
        with_vectors=False  # Don't return vectors (save bandwidth)
    ).points

    # Convert to SearchResult
    return [
        SearchResult(
            id=str(hit.id),
            score=hit.score,
            content=hit.payload.get("content", ""),
            metadata={k: v for k, v in hit.payload.items() if k != "content"}
        )
        for hit in results
    ]
```

### Context-Aware Search

Filter by chatbot/chatflow context:

```python
async def search_with_context(
    kb_id: UUID,
    query_embedding: List[float],
    context: str,  # "chatbot" | "chatflow" | "both"
    top_k: int = 5
) -> List[SearchResult]:
    """
    Search with context filtering.

    Context filtering:
    - "chatbot": Returns chunks with kb_context = "chatbot" OR "both"
    - "chatflow": Returns chunks with kb_context = "chatflow" OR "both"
    - "both": Returns all chunks
    """

    filters = None
    if context in ["chatbot", "chatflow"]:
        filters = {
            "kb_context": {"$in": [context, "both"]}
        }

    return await search(kb_id, query_embedding, top_k, filters=filters)
```

### Hybrid Text-Vector Search

Combines vector similarity with text matching:

```python
async def hybrid_search(
    kb_id: UUID,
    query_text: str,
    query_embedding: List[float],
    top_k: int = 5,
    vector_weight: float = 0.7,
    text_weight: float = 0.3
) -> List[SearchResult]:
    """
    Hybrid search: Vector (70%) + Text (30%)
    """

    # Get vector results
    vector_results = await search(kb_id, query_embedding, top_k)

    # Get text results (Qdrant full-text search)
    text_results = await text_search(kb_id, query_text, top_k)

    # Combine with weighted scores
    combined = {}

    for r in vector_results:
        combined[r.id] = r
        combined[r.id].score = r.score * vector_weight

    for r in text_results:
        if r.id in combined:
            combined[r.id].score += r.score * text_weight
        else:
            combined[r.id] = r
            combined[r.id].score = r.score * text_weight

    # Sort by combined score
    return sorted(combined.values(), key=lambda x: x.score, reverse=True)[:top_k]
```

## Metadata Filtering

### Filter Syntax

```python
# Equality
filters = {"document_id": {"$eq": "uuid"}}

# Range
filters = {"page_number": {"$gte": 1, "$lte": 10}}

# Contains (text)
filters = {"content": {"$contains": "installation"}}

# In list
filters = {"kb_context": {"$in": ["chatbot", "both"]}}
```

### Filter Building

```python
def _build_filter(filters: Dict) -> models.Filter:
    must_conditions = []

    for field, condition in filters.items():
        if isinstance(condition, dict):
            for operator, value in condition.items():
                if operator == "$eq":
                    must_conditions.append(
                        models.FieldCondition(
                            key=field,
                            match=models.MatchValue(value=value)
                        )
                    )
                elif operator == "$gte":
                    must_conditions.append(
                        models.FieldCondition(
                            key=field,
                            range=models.Range(gte=value)
                        )
                    )
                # ... more operators

    return models.Filter(must=must_conditions)
```

## Collection Management

### Get Statistics

```python
async def get_collection_stats(kb_id: UUID) -> Dict:
    collection_name = f"kb_{kb_id.replace('-', '_')}"
    info = qdrant_client.get_collection(collection_name)

    return {
        "vectors_count": info.points_count,
        "segments_count": info.segments_count,
        "status": info.status,
        "config": info.config
    }
```

### Delete Collection

```python
async def delete_kb_collection(kb_id: UUID) -> bool:
    collection_name = f"kb_{kb_id.replace('-', '_')}"
    qdrant_client.delete_collection(collection_name)
    return True
```

## Performance Characteristics

### Search Performance

| Vectors | Latency | Memory |
|---------|---------|--------|
| 10k | ~5ms | ~500MB |
| 100k | ~15ms | ~4GB |
| 1M | ~50ms | ~40GB |

### Indexing Performance

| Operation | Throughput |
|-----------|------------|
| Batch upsert | 500-1000 vectors/sec |
| Single upsert | ~100 vectors/sec |
| Delete | ~1000/sec |

### Recommended Batch Sizes

| Dimensions | Batch Size |
|------------|------------|
| 384 | 100-200 |
| 768 | 50-100 |
| 1536 | 25-50 |

## Configuration Best Practices

### For Small KBs (<10k vectors)

```python
{
    "vector_size": 384,
    "distance": "Cosine",
    "hnsw_m": 16,
    "ef_construct": 100,
    "indexing_threshold": 10000  # Index after 10k vectors
}
```

### For Large KBs (>100k vectors)

```python
{
    "vector_size": 384,
    "distance": "Cosine",
    "hnsw_m": 32,         # More connections for better recall
    "ef_construct": 200,  # Higher construction accuracy
    "indexing_threshold": 5000
}
```

## Error Handling

```python
try:
    results = await qdrant_service.search(...)
except QdrantException as e:
    if "not found" in str(e):
        # Collection doesn't exist
        raise KBNotFoundError(f"KB {kb_id} not indexed")
    elif "timeout" in str(e):
        # Search timeout
        raise SearchTimeoutError("Search took too long")
    else:
        raise SearchError(f"Qdrant error: {e}")
```

## Dual Storage Architecture

PrivexBot stores embeddings in both Qdrant and PostgreSQL:

### Qdrant (Primary)
- Fast similarity search
- Metadata filtering
- Production queries

### PostgreSQL (pgvector)
- Backup storage
- Analytics queries
- Non-vector operations

```python
# Chunk model with pgvector
class Chunk(Base):
    embedding = Column(Vector(384))  # pgvector column
    embedding_id = Column(String)    # Reference to Qdrant
```

## Summary

PrivexBot's Qdrant integration provides:

1. **Isolated Collections**: One per KB for data isolation
2. **HNSW Indexing**: Fast approximate nearest neighbor search
3. **Payload Storage**: Content stored with vectors
4. **Metadata Filtering**: Filter by document, context, etc.
5. **Hybrid Search**: Vector + text combination
6. **High Performance**: 10-50ms latency for most queries
7. **Self-Hosted**: Runs on Secret VM with TEE protection
