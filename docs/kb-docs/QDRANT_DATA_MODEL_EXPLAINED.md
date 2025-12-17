# Qdrant Data Model - Complete Explanation

**Date**: 2025-12-15
**Purpose**: Crystal-clear explanation of Qdrant collections, points, and payloads
**Status**: Definitive Technical Reference

---

## Critical Question Answered

### Q: "If chunking generates 10 chunks, do we create 10 collections in Qdrant?"

**Answer**: ❌ NO! We create **ONE collection per Knowledge Base**, and store all chunks as **points** within that collection.

---

## Qdrant Hierarchy (Database Structure)

```
Qdrant Instance
    ↓
Collection (like a "table" in PostgreSQL)
    ↓
Points (like "rows" in PostgreSQL)
    ↓
Each Point contains:
    - id (unique identifier)
    - vector (384-dimensional embedding)
    - payload (JSON data with chunk content + metadata)
```

### Example

```
Knowledge Base: "Product Documentation" (kb_uuid_123)
    ↓
Qdrant Collection: "kb_kb_uuid_123" ← ONE collection for entire KB
    ↓
Contains 10 Points (chunks):
    - Point 1: id=chunk-1, vector=[...], payload={content: "Chunk 1...", ...}
    - Point 2: id=chunk-2, vector=[...], payload={content: "Chunk 2...", ...}
    - Point 3: id=chunk-3, vector=[...], payload={content: "Chunk 3...", ...}
    ...
    - Point 10: id=chunk-10, vector=[...], payload={content: "Chunk 10...", ...}
```

**Key Insight**:
- ✅ ONE collection = ONE Knowledge Base
- ✅ 10 chunks = 10 points in that ONE collection
- ❌ NOT 10 collections

---

## Complete Qdrant Data Model

### Collection Structure

**Collection Name**: `kb_{kb_id}`

**Example**: If KB ID is `550e8400-e29b-41d4-a716-446655440000`, collection name is:
```
kb_550e8400-e29b-41d4-a716-446655440000
```

**Collection Config**:
```python
{
    "collection_name": "kb_550e8400-e29b-41d4-a716-446655440000",
    "vector_size": 384,  # all-MiniLM-L6-v2 embedding dimension
    "distance_metric": "Cosine",  # Similarity metric
    "on_disk_payload": False  # Keep payload in memory for fast access
}
```

### Point Structure (Each Chunk)

**A Point is ONE chunk with its embedding and metadata.**

**Complete Point Schema**:
```python
{
    # Unique identifier
    "id": "chunk-uuid-or-sequential-id",  # e.g., "chunk-550e8400-001"

    # Vector (embedding)
    "vector": [0.123, -0.456, 0.789, ..., 0.234],  # 384 numbers

    # Payload (all data associated with this chunk)
    "payload": {
        # ============================================
        # CONTENT (The actual chunk text)
        # ============================================
        "content": "This is the actual chunk text content...",  # The chunk

        # ============================================
        # DOCUMENT IDENTIFICATION
        # ============================================
        "document_id": "550e8400-e29b-41d4-a716-446655440001",
        "document_name": "User Guide.pdf",
        "kb_id": "550e8400-e29b-41d4-a716-446655440000",

        # ============================================
        # SOURCE INFORMATION
        # ============================================
        "source_type": "file_upload",  # file_upload, web_scraping, google_docs, notion
        "source_url": None,  # For web_scraping, the URL; None for file uploads
        "original_filename": "User_Guide_v2.pdf",  # For file uploads

        # ============================================
        # CONTEXT & ACCESS CONTROL
        # ============================================
        "kb_context": "both",  # "chatbot", "chatflow", or "both"
        "workspace_id": "550e8400-e29b-41d4-a716-446655440002",

        # ============================================
        # CHUNK METADATA
        # ============================================
        "chunk_index": 0,  # Position in document (0-based)
        "page_number": 5,  # Which page this chunk is from (if applicable)
        "heading": "Section 2.3: Password Reset",  # If using by_heading strategy
        "char_count": 850,
        "token_count": 180,
        "word_count": 145,

        # ============================================
        # CHUNKING INFORMATION
        # ============================================
        "chunking_strategy": "by_heading",  # by_heading, semantic, no_chunking, etc.
        "chunk_size": 1000,
        "chunk_overlap": 200,
        "has_overlap": true,  # Does this chunk have overlap with previous?
        "is_full_document": false,  # True if no_chunking was used

        # ============================================
        # TIMESTAMPS
        # ============================================
        "indexed_at": "2025-12-15T10:30:00Z",
        "created_at": "2025-12-15T10:25:00Z",

        # ============================================
        # CUSTOM METADATA (Optional - user-defined)
        # ============================================
        "category": "authentication",  # User can add custom fields
        "tags": ["password", "security", "reset"],
        "priority": "high",
        "language": "en",

        # ============================================
        # SYSTEM METADATA
        # ============================================
        "storage_location": "qdrant_only",  # For file uploads
        "embedding_model": "all-MiniLM-L6-v2",
        "embedding_model_version": "v1"
    }
}
```

### Real Example (10 Chunks from One Document)

**Scenario**: User uploads "User_Guide.pdf" (12,500 chars) → generates 10 chunks

**Qdrant Storage**:
```python
# Collection: kb_550e8400-e29b-41d4-a716-446655440000
# Contains 10 points:

# Point 1
{
    "id": "chunk-550e8400-001",
    "vector": [0.123, -0.456, ...],  # 384 dims
    "payload": {
        "content": "User Guide - Introduction\n\nWelcome to our platform...",
        "document_id": "doc-uuid-001",
        "document_name": "User_Guide.pdf",
        "kb_id": "kb-uuid-123",
        "source_type": "file_upload",
        "kb_context": "both",
        "chunk_index": 0,
        "page_number": 1,
        "char_count": 850,
        "chunking_strategy": "by_heading"
    }
}

# Point 2
{
    "id": "chunk-550e8400-002",
    "vector": [0.234, -0.567, ...],  # 384 dims
    "payload": {
        "content": "Getting Started\n\nTo begin using the platform...",
        "document_id": "doc-uuid-001",
        "document_name": "User_Guide.pdf",
        "kb_id": "kb-uuid-123",
        "source_type": "file_upload",
        "kb_context": "both",
        "chunk_index": 1,
        "page_number": 2,
        "char_count": 920,
        "chunking_strategy": "by_heading"
    }
}

# ... Points 3-9 ...

# Point 10
{
    "id": "chunk-550e8400-010",
    "vector": [0.789, -0.123, ...],  # 384 dims
    "payload": {
        "content": "Troubleshooting\n\nIf you encounter issues...",
        "document_id": "doc-uuid-001",
        "document_name": "User_Guide.pdf",
        "kb_id": "kb-uuid-123",
        "source_type": "file_upload",
        "kb_context": "both",
        "chunk_index": 9,
        "page_number": 15,
        "char_count": 780,
        "chunking_strategy": "by_heading"
    }
}

# All 10 points are in the SAME collection
```

---

## Multiple Documents in Same KB

**Scenario**: KB has 3 documents (2 file uploads, 1 web URL)

```
Collection: kb_550e8400-e29b-41d4-a716-446655440000
    ↓
Document 1 (file_upload): "User_Guide.pdf" → 10 chunks → 10 points
Document 2 (file_upload): "API_Docs.pdf" → 15 chunks → 15 points
Document 3 (web_scraping): "https://example.com/faq" → 8 chunks → 8 points
    ↓
Total: 33 points in ONE collection
```

**How to Query Specific Document**:
```python
# Get all chunks from Document 2 only
results = await qdrant_service.search(
    collection_name="kb_550e8400-e29b-41d4-a716-446655440000",
    query_vector=query_embedding,
    limit=100,  # Get all
    query_filter={
        "must": [
            {"key": "document_id", "match": {"value": "doc-uuid-002"}}
        ]
    }
)

# Result: 15 chunks from API_Docs.pdf only
```

---

## Source Type Configuration

### Question: "Can we configure the model per source type?"

**Answer**: YES! You can configure different processing settings per source type.

### Configuration Hierarchy

```
Global Defaults (system-wide)
    ↓
Organization-Level Config (optional)
    ↓
Workspace-Level Config (optional)
    ↓
KB-Level Config (applies to all sources in KB)
    ↓
Source-Type-Specific Config (NEW - what you're asking about)
    ↓
Document-Level Config (per-document override)
```

### Source Type Configuration Model

**Store in KnowledgeBase.config**:
```python
kb.config = {
    # Default config (applies to all sources if no source-specific config)
    "default": {
        "chunking": {
            "strategy": "by_heading",
            "chunk_size": 1000,
            "chunk_overlap": 200
        },
        "embedding": {
            "model": "all-MiniLM-L6-v2",
            "device": "cpu"
        },
        "retrieval": {
            "top_k": 5,
            "score_threshold": 0.7
        }
    },

    # Source-type-specific configs (overrides default)
    "source_types": {
        "file_upload": {
            "chunking": {
                "strategy": "by_heading",
                "chunk_size": 1200,  # Larger chunks for files
                "chunk_overlap": 300
            },
            "retrieval": {
                "top_k": 10,
                "score_threshold": 0.65  # Lower threshold for files
            }
        },

        "web_scraping": {
            "chunking": {
                "strategy": "semantic",
                "chunk_size": 800,  # Smaller chunks for web
                "chunk_overlap": 150
            },
            "retrieval": {
                "top_k": 5,
                "score_threshold": 0.75  # Higher threshold for web
            }
        },

        "google_docs": {
            "chunking": {
                "strategy": "by_heading",
                "chunk_size": 1500,
                "chunk_overlap": 250
            },
            "retrieval": {
                "top_k": 8,
                "score_threshold": 0.70
            }
        }
    },

    # Context-specific configs (chatbot vs chatflow)
    "contexts": {
        "chatbot": {
            "retrieval": {
                "top_k": 3,
                "score_threshold": 0.75
            }
        },
        "chatflow": {
            "retrieval": {
                "top_k": 15,
                "score_threshold": 0.60
            }
        }
    }
}
```

### How Configuration Resolution Works

**Priority Order** (highest to lowest):
1. Document-level config (per-document override)
2. Source-type-specific config (from `config.source_types[source_type]`)
3. Context-specific config (from `config.contexts[context]`)
4. KB default config (from `config.default`)
5. System defaults (hardcoded)

**Example Resolution**:
```python
def resolve_config(kb, document, context):
    """Resolve final config with proper priority."""

    # Start with system defaults
    config = SYSTEM_DEFAULTS.copy()

    # Apply KB default config
    if "default" in kb.config:
        config.update(kb.config["default"])

    # Apply source-type-specific config
    if document.source_type in kb.config.get("source_types", {}):
        source_config = kb.config["source_types"][document.source_type]
        config = deep_merge(config, source_config)

    # Apply context-specific config
    if context in kb.config.get("contexts", {}):
        context_config = kb.config["contexts"][context]
        config = deep_merge(config, context_config)

    # Apply document-level overrides (if any)
    if document.processing_config:
        config = deep_merge(config, document.processing_config)

    return config
```

### Implementation Example

**Pipeline Task with Source-Type-Aware Config**:
```python
# In kb_pipeline_tasks.py

@shared_task
def process_kb_task(kb_id, pipeline_id, sources, config):
    """Process KB with source-type-aware configuration."""

    kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == kb_id).first()

    for source in sources:
        source_type = source.get("type")  # file_upload, web_scraping, etc.

        # Resolve config for this specific source type
        resolved_config = resolve_config_for_source(
            kb_config=kb.config,
            source_type=source_type,
            base_config=config
        )

        # Use resolved config for processing
        chunking_config = resolved_config["chunking"]
        embedding_config = resolved_config["embedding"]

        # Process based on source type
        if source_type == "file_upload":
            # Use file_upload specific config
            chunks = chunk_document(
                text=extracted_text,
                strategy=chunking_config["strategy"],
                chunk_size=chunking_config["chunk_size"],
                chunk_overlap=chunking_config["chunk_overlap"]
            )

        elif source_type == "web_scraping":
            # Use web_scraping specific config
            chunks = chunk_document(
                text=scraped_text,
                strategy=chunking_config["strategy"],
                chunk_size=chunking_config["chunk_size"],
                chunk_overlap=chunking_config["chunk_overlap"]
            )

        # Store in Qdrant with source_type in payload
        for chunk in chunks:
            await qdrant_service.add_point(
                collection_name=f"kb_{kb_id}",
                point={
                    "id": str(uuid4()),
                    "vector": embedding,
                    "payload": {
                        "content": chunk["content"],
                        "source_type": source_type,  # ← Stored for filtering
                        "chunking_strategy": chunking_config["strategy"],
                        "chunk_size": chunking_config["chunk_size"],
                        # ... other metadata
                    }
                }
            )
```

### Why Source-Type-Specific Config?

**Different sources have different characteristics**:

**File Uploads (PDFs, DOCX)**:
```
Characteristics:
  - Structured content (headings, sections)
  - Often longer, technical
  - High information density

Optimal Config:
  - Larger chunks (1200-2000 chars)
  - by_heading or adaptive strategy
  - Higher overlap (300) for continuity
  - Lower score threshold (0.65) for exploration
```

**Web Scraping**:
```
Characteristics:
  - Mixed quality (navigation, ads, content)
  - Often shorter, fragmented
  - Lower information density

Optimal Config:
  - Smaller chunks (600-1000 chars)
  - semantic or hybrid strategy
  - Lower overlap (150) to reduce noise
  - Higher score threshold (0.75) for precision
```

**Google Docs / Notion**:
```
Characteristics:
  - Well-structured, collaborative
  - Medium length, organized
  - High quality content

Optimal Config:
  - Medium chunks (1000-1500 chars)
  - by_heading strategy
  - Medium overlap (200-250)
  - Medium threshold (0.70)
```

### Retrieval with Source Type Filtering

```python
# Search only file uploads with their optimized config
results = await qdrant_service.search(
    collection_name=f"kb_{kb_id}",
    query_vector=query_embedding,
    limit=10,  # File upload config: top_k=10
    score_threshold=0.65,  # File upload config
    query_filter={
        "must": [
            {"key": "source_type", "match": {"value": "file_upload"}},
            {"key": "kb_context", "match": {"any": ["chatbot", "both"]}}
        ]
    }
)

# Search only web content with their optimized config
results = await qdrant_service.search(
    collection_name=f"kb_{kb_id}",
    query_vector=query_embedding,
    limit=5,  # Web scraping config: top_k=5
    score_threshold=0.75,  # Web scraping config
    query_filter={
        "must": [
            {"key": "source_type", "match": {"value": "web_scraping"}},
            {"key": "kb_context", "match": {"any": ["chatbot", "both"]}}
        ]
    }
)
```

---

## Collection Lifecycle

### Creation

```python
# When KB is finalized
await qdrant_service.create_collection(
    collection_name=f"kb_{kb_id}",
    vector_size=384,  # all-MiniLM-L6-v2
    distance="Cosine"
)
```

### Population

```python
# For each chunk from all sources
await qdrant_service.upsert_points(
    collection_name=f"kb_{kb_id}",
    points=[
        {
            "id": chunk_id,
            "vector": embedding,
            "payload": {
                "content": chunk_text,
                "document_id": doc_id,
                "source_type": source_type,
                "kb_context": kb.context,
                # ... all metadata
            }
        }
        # ... more chunks
    ]
)
```

### Querying

```python
# Search with filters
results = await qdrant_service.search(
    collection_name=f"kb_{kb_id}",
    query_vector=query_embedding,
    limit=10,
    query_filter={
        "must": [
            {"key": "kb_context", "match": {"any": ["chatbot", "both"]}},
            {"key": "source_type", "match": {"value": "file_upload"}}
        ]
    }
)
```

### Deletion

```python
# Delete entire KB
await qdrant_service.delete_collection(
    collection_name=f"kb_{kb_id}"
)

# Delete specific document
await qdrant_service.delete_points(
    collection_name=f"kb_{kb_id}",
    points_selector={
        "filter": {
            "must": [
                {"key": "document_id", "match": {"value": doc_id}}
            ]
        }
    }
)
```

---

## Summary

### Qdrant Structure

1. **One Collection per KB** (not per chunk, not per document)
2. **Multiple Points per Collection** (each point = one chunk)
3. **Rich Payload per Point** (content + metadata)
4. **Filter by Metadata** (source_type, kb_context, document_id, etc.)

### Configuration Flexibility

1. **Source-Type-Specific Config** ✅ Possible
2. **Stored in KB.config** (source_types section)
3. **Priority Resolution** (document → source-type → context → default)
4. **Different Processing per Source** (chunking, retrieval settings)

### Best Practices

1. **One collection per KB** (efficient, scalable)
2. **Store source_type in payload** (enables filtering)
3. **Use source-specific configs** (optimize per source characteristics)
4. **Filter during retrieval** (precise, fast results)

---

**Status**: Complete Technical Reference
**Clarity**: Crystal clear data model
**Implementation**: Ready for immediate use

