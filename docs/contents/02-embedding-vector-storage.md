# PrivexBot Embedding & Vector Storage Implementation

## Overview

PrivexBot uses a self-hosted embedding system powered by **sentence-transformers** for generating text embeddings, combined with **Qdrant** vector database for storage and similarity search. This privacy-first approach ensures no data leaves the Secret VM environment.

## Embedding Models

### Supported Models

PrivexBot supports four embedding models via the sentence-transformers library:

| Model | Dimensions | Speed | Quality | Size | Best For |
|-------|-----------|-------|---------|------|----------|
| `all-MiniLM-L6-v2` (Default) | 384 | Fast | Good | 90MB | General use, balanced |
| `all-MiniLM-L12-v2` | 384 | Medium | Better | 120MB | Higher accuracy needs |
| `all-mpnet-base-v2` | 768 | Slow | Best | 420MB | Maximum quality |
| `paraphrase-multilingual-MiniLM-L12-v2` | 384 | Medium | Good | 470MB | 50+ languages |

### Default Configuration

```python
DEFAULT_MODEL = "all-MiniLM-L6-v2"

EmbeddingConfig = {
    "model_name": "all-MiniLM-L6-v2",
    "device": "cpu",           # or "cuda" for GPU
    "batch_size": 32,          # Texts per batch
    "normalize_embeddings": True,  # For cosine similarity
    "num_threads": 4           # CPU threads
}
```

## How Embeddings Are Generated

### Generation Process

```python
# Embedding Service generates vectors from text
embeddings = embedding_service.generate_embeddings(
    texts=["chunk 1 content", "chunk 2 content", ...],
    model_name="all-MiniLM-L6-v2",
    batch_size=32
)

# Returns: List[List[float]] - e.g., [[0.1, 0.2, ..., 0.384], ...]
```

### Batch Processing

The service processes texts in batches for efficiency:

```python
# ~100 chunks/second on 4-core CPU
for batch in batches(texts, batch_size=32):
    embeddings = model.encode(
        batch,
        batch_size=32,
        show_progress_bar=False,
        convert_to_numpy=True,
        normalize_embeddings=True  # Normalized for cosine similarity
    )
```

### Model Caching

Models are loaded once and cached in memory:

```python
class MultiModelEmbeddingService:
    def __init__(self):
        self._model_cache: Dict[str, SentenceTransformer] = {}

    def _ensure_model_loaded(self, model_name: str):
        if model_name not in self._model_cache:
            model = SentenceTransformer(model_name, device="cpu")
            model.eval()
            self._model_cache[model_name] = model
        return self._model_cache[model_name]
```

## Smart Embedding Strategy

PrivexBot uses intelligent embedding strategies based on document size:

### Strategy Selection

```python
def determine_embedding_strategy(content: str, bot_type: str) -> str:
    content_size = len(content)

    if bot_type == "chatbot":
        small_threshold = 1500
        medium_threshold = 15000
    else:  # chatflow
        small_threshold = 2500
        medium_threshold = 25000

    if content_size < small_threshold:
        return "single_only"      # Document-level only
    elif content_size < medium_threshold:
        return "hierarchical"     # Document + chunk levels
    else:
        return "chunks_only"      # Chunk-level only
```

### Three Strategies

1. **Single/Document-Only** (small content <1.5KB):
   - One embedding for entire document
   - Best for: FAQs, short documents

2. **Hierarchical** (medium content 1.5-15KB):
   - Document-level embedding (full context)
   - Chunk-level embeddings (precise retrieval)
   - Best of both worlds

3. **Chunks-Only** (large content >15KB):
   - Only chunk embeddings
   - Prevents overwhelming single embedding
   - Best for: Manuals, large documents

## Vector Storage with Qdrant

### Collection Architecture

Each Knowledge Base gets its own Qdrant collection:

```python
# Collection naming pattern
collection_name = f"kb_{kb_id.replace('-', '_')}"
# Example: kb_123e4567_e89b_12d3_a456_426614174000
```

### Collection Creation

```python
qdrant_service.create_kb_collection(
    kb_id=kb_id,
    vector_size=384,              # Matches embedding model
    distance_metric="Cosine",     # Cosine, Dot, or Euclid
    hnsw_m=16,                    # HNSW connections per node
    ef_construct=100              # Construction accuracy
)
```

### Vector Storage Structure

Each chunk is stored as a Qdrant point:

```python
point = {
    "id": "chunk_uuid",
    "vector": [0.1, 0.2, ..., 0.384],  # 384-dim embedding
    "payload": {
        "content": "The actual chunk text...",
        "document_id": "uuid",
        "document_name": "FAQ.pdf",
        "kb_id": "uuid",
        "page_number": 5,
        "chunk_index": 12,
        "kb_context": "chatbot",  # For filtering
        "annotations": {...}       # User annotations
    }
}
```

### Batch Upsertion

Chunks are indexed in batches for efficiency:

```python
await qdrant_service.upsert_chunks(
    kb_id=kb_id,
    chunks=qdrant_chunks,  # List of QdrantChunk objects
    batch_size=100
)

# Throughput: 500-1000 vectors/second
```

## Embedding Storage Locations

PrivexBot stores embeddings in two locations:

### 1. PostgreSQL (pgvector)

```sql
-- Chunk table with pgvector column
CREATE TABLE chunks (
    id UUID PRIMARY KEY,
    content TEXT NOT NULL,
    embedding VECTOR(384),  -- pgvector extension
    embedding_metadata JSONB
);
```

Used for:
- Backup/recovery
- Analytics
- Non-vector operations

### 2. Qdrant (Primary)

Primary storage for similarity search:
- Fast vector similarity search (10-50ms for <100k vectors)
- Metadata filtering
- Payload storage with content

## Query Embedding Flow

When a user sends a message:

```python
# 1. Get KB's configured embedding model
embedding_model = kb.embedding_config.get("model", "all-MiniLM-L6-v2")

# 2. Generate query embedding with SAME model as indexing
query_embedding = await embedding_service.generate_embedding(
    text=user_query,
    model_name=embedding_model  # CRITICAL: Must match indexing model
)

# 3. Search Qdrant with query vector
results = await qdrant_service.search(
    kb_id=kb_id,
    query_embedding=query_embedding,
    top_k=5,
    score_threshold=0.7
)
```

### Critical: Model Consistency

The same embedding model MUST be used for both indexing and querying. Mixing models produces meaningless similarity scores.

## Performance Characteristics

### Embedding Generation
- **Speed**: ~100 chunks/second on 4-core CPU
- **Batch Size**: 32 texts (configurable)
- **Memory**: ~100-400MB per loaded model

### Qdrant Search
- **Latency**: 10-50ms for <100k vectors
- **Memory**: ~4GB for 100k vectors (384 dims)
- **Index**: HNSW with M=16, ef_construct=100

### Similarity Scoring
- **Metric**: Cosine similarity (normalized embeddings)
- **Score Range**: 0-1
- **Typical Good Match**: 0.7+ for sentence-transformers

## Embedding Metadata

Each chunk stores embedding metadata:

```python
embedding_metadata = {
    "model": "all-MiniLM-L6-v2",
    "provider": "sentence-transformers",
    "dimensions": 384,
    "generated_at": "2025-01-15T10:30:00Z",
    "generation_time_ms": 245,
    "batch_id": "batch_123"
}
```

## Configuration Validation

The system validates embedding configuration:

```python
constraints = {
    "model_name": {
        "type": str,
        "allowed": ["all-MiniLM-L6-v2", "all-MiniLM-L12-v2",
                    "all-mpnet-base-v2", "paraphrase-multilingual-MiniLM-L12-v2"]
    },
    "device": {"allowed": ["cpu", "cuda"]},
    "batch_size": {"min": 1, "max": 256},
    "normalize_embeddings": {"type": bool},
    "num_threads": {"min": 1, "max": 32}
}
```

## Privacy Guarantees

1. **Self-Hosted**: All embedding generation happens locally on Secret VM
2. **No External APIs**: Unlike OpenAI embeddings, no data leaves the system
3. **TEE Protection**: Processing happens in Trusted Execution Environment
4. **Model Privacy**: sentence-transformers models run entirely offline

## Summary Table

| Aspect | Details |
|--------|---------|
| **Library** | sentence-transformers (self-hosted) |
| **Default Model** | all-MiniLM-L6-v2 |
| **Default Dimensions** | 384 |
| **Max Dimensions** | 768 (all-mpnet-base-v2) |
| **Distance Metric** | Cosine similarity |
| **Batch Processing** | 32 texts per batch |
| **Performance** | ~100 chunks/sec on 4-core CPU |
| **Vector DB** | Qdrant (self-hosted) |
| **Vector Index** | HNSW (M=16, ef_construct=100) |
| **Storage** | PostgreSQL (pgvector) + Qdrant |
| **Device Support** | CPU (default), CUDA |
| **Privacy** | All-local, no external API calls |
