# Chunking & Metadata Implementation Architecture

> **Last Updated**: December 18, 2024
> **Status**: Implementation Verified
> **Scope**: Actual implementation of chunking services and metadata application

---

## Table of Contents

1. [Overview](#overview)
2. [Chunking Service Architecture](#chunking-service-architecture)
3. [Metadata Application by KB Type](#metadata-application-by-kb-type)
4. [Enhanced Metadata Feature](#enhanced-metadata-feature)
5. [Processing Flow Diagrams](#processing-flow-diagrams)
6. [Configuration Reference](#configuration-reference)
7. [Best Practices](#best-practices)

---

## Overview

### What's Actually Implemented

The KB system uses a **three-tier chunking architecture**:

| Service | Purpose | Used When |
|---------|---------|-----------|
| `chunking_service` | Base chunking strategies | Default (most cases) |
| `enhanced_chunking_service` | Rich metadata + context | When `enable_enhanced_metadata=true` |
| `smart_kb_service` | Processing orchestration | Initial KB creation |

**Key Finding**: Enhanced chunking is **NOT enabled by default**. It requires explicit configuration via `enable_enhanced_metadata: true` in the chunking config.

---

## Chunking Service Architecture

### Base Chunking Service (`chunking_service.py`)

**Location**: `src/app/services/chunking_service.py`

**Available Strategies**:
```python
strategies = [
    "recursive",        # Default - split by separators recursively
    "semantic",         # Split by topic boundaries using embeddings
    "by_heading",       # Split at markdown headings
    "by_section",       # Group into logical sections
    "adaptive",         # Auto-select based on content analysis
    "sentence_based",   # Split at sentences
    "paragraph_based",  # Split at paragraphs
    "hybrid",           # Combines heading + paragraph + recursive
    "no_chunking",      # Keep as single chunk
    "full_content",     # Alias for no_chunking
    "token",            # Split by token count
    "custom"            # User-defined separators
]
```

**Output Format** (what gets returned):
```python
{
    "content": "Chunk text...",
    "index": 0,
    "start_pos": 0,
    "end_pos": 1000,
    "token_count": 250,  # Estimated: len(content) // 4
    "metadata": {
        "word_count": 180,
        "chunk_length": 1000,
        "character_count": 1000
    }
}
```

### Enhanced Chunking Service (`enhanced_chunking_service.py`)

**Location**: `src/app/services/enhanced_chunking_service.py`

**Wraps**: `chunking_service` (delegates actual chunking)
**Adds**: Rich metadata, context preservation, document analysis

**Additional Metadata When Enabled**:
```python
{
    # Standard metadata from chunking_service
    "content": "...",
    "index": 0,
    "token_count": 250,

    # ENHANCED metadata (only when enable_enhanced_metadata=true)
    "metadata": {
        "chunk_index": 0,
        "total_chunks": 15,
        "chunk_length": 1000,
        "word_count": 180,
        "strategy_used": "by_heading",
        "context_before": "...last 100 chars of previous chunk...",
        "context_after": "...first 100 chars of next chunk...",
        "parent_heading": "## Section Title",
        "section_title": "Section Title",
        "document_analysis": {
            "total_chars": 15000,
            "total_lines": 200,
            "heading_count": 12,
            "heading_density": 0.06,
            "paragraph_count": 45,
            "avg_paragraph_length": 333.3,
            "code_block_count": 5,
            "list_item_count": 20,
            "recommended_strategy": "by_heading",
            "reasoning": "High heading density (6.00%)"
        }
    }
}
```

---

## Metadata Application by KB Type

### Web URL KB (Web Scraping)

**Storage**: PostgreSQL + Qdrant (dual storage)

#### PostgreSQL Chunk Metadata
```python
chunk_metadata = {
    # Core chunking info
    "token_count": 250,
    "strategy": "by_heading",
    "chunk_size": 1000,
    "chunk_overlap": 200,

    # Decision info
    "user_preference": True,        # If user explicitly set config
    "adaptive_suggestion": "semantic",  # What adaptive analysis suggested
    "reasoning": "User explicitly configured: strategy=by_heading...",

    # Context info
    "workspace_id": "uuid-string",
    "created_at": "2024-12-18T10:30:00",

    # Statistics
    "word_count": 180,
    "character_count": 1000,

    # IF enable_enhanced_metadata=true:
    "context_before": "...last 100 chars...",
    "context_after": "...first 100 chars...",
    "parent_heading": "## API Reference",
    "section_title": "API Reference",
    "document_analysis": {...},
    "enhanced_metadata_enabled": True
}
```

#### Qdrant Vector Metadata
```python
qdrant_metadata = {
    # Core identifiers
    "document_id": "uuid-string",
    "document_name": "API Documentation",
    "kb_id": "uuid-string",
    "workspace_id": "uuid-string",

    # Context filtering (CRITICAL for bot access)
    "kb_context": "chatbot",  # "chatbot", "chatflow", or "both"

    # Source information
    "source_type": "web_scraping",
    "source_url": "https://example.com/docs",
    "original_filename": None,

    # Chunk metadata
    "chunk_index": 0,
    "word_count": 180,
    "character_count": 1000,
    "token_count": 250,

    # Chunking configuration (for debugging)
    "chunking_strategy": "by_heading",
    "chunk_size": 1000,
    "chunk_overlap": 200,
    "content_type": "documentation",  # adaptive suggestion
    "user_configured": True,

    # System metadata
    "embedding_model": "all-MiniLM-L6-v2",
    "storage_location": "qdrant_and_postgres",
    "indexed_at": "2024-12-18T10:30:00",

    # IF enable_enhanced_metadata=true:
    "context_before": "...",
    "context_after": "...",
    "parent_heading": "## API Reference",
    "section_title": "API Reference",
    "enhanced_metadata_enabled": True
}
```

### File Upload KB

**Storage**: Qdrant ONLY (no PostgreSQL chunks)

#### Qdrant Vector Metadata (Primary Storage)
```python
qdrant_metadata = {
    # Core identifiers
    "document_id": "uuid-string",
    "document_name": "Company Policy.pdf",
    "kb_id": "uuid-string",
    "workspace_id": "uuid-string",

    # Context filtering
    "kb_context": "both",

    # Source information
    "source_type": "file_upload",
    "source_url": "file:///Company Policy.pdf",
    "original_filename": "Company Policy.pdf",

    # Chunk metadata
    "chunk_index": 0,
    "word_count": 180,
    "character_count": 1000,
    "token_count": 250,

    # Chunking configuration
    "chunking_strategy": "recursive",
    "chunk_size": 1000,
    "chunk_overlap": 200,
    "content_type": "general",
    "user_configured": True,

    # System metadata
    "embedding_model": "all-MiniLM-L6-v2",
    "storage_location": "qdrant_only",  # KEY DIFFERENCE
    "indexed_at": "2024-12-18T10:30:00",

    # IF enable_enhanced_metadata=true:
    "context_before": "...",
    "context_after": "...",
    "parent_heading": "Introduction",
    "section_title": "Introduction",
    "enhanced_metadata_enabled": True
}
```

#### PostgreSQL Document Metadata (Metadata Only, No Chunks)
```python
# Document record (NOT chunks)
document.processing_metadata = {
    "processed_at": "2024-12-18T10:30:00",
    "chunks_created": 15,
    "embeddings_generated": 15,
    "storage_strategy": "qdrant_only",
    "chunk_storage_location": "qdrant_only",
    "postgres_chunks_created": 0,
    "qdrant_chunks_created": 15,
    "enhanced_metadata_enabled": False,  # or True if enabled
    "chunking_strategy": "recursive",
    "chunk_size": 1000,
    "chunk_overlap": 200
}
```

---

## Enhanced Metadata Feature

### How to Enable

Enhanced metadata is **disabled by default**. Enable via:

#### Draft Configuration
```json
{
    "chunking": {
        "strategy": "by_heading",
        "chunk_size": 1000,
        "chunk_overlap": 200,
        "enable_enhanced_metadata": true  // KEY: Enable rich metadata
    }
}
```

#### What Enhanced Metadata Provides

| Field | Description | Use Case |
|-------|-------------|----------|
| `context_before` | Last 100 chars of previous chunk | Better retrieval context |
| `context_after` | First 100 chars of next chunk | Better retrieval context |
| `parent_heading` | Nearest markdown heading | Section identification |
| `section_title` | Cleaned heading text | Display in results |
| `document_analysis` | Structure metrics | Strategy optimization |

### When to Enable Enhanced Metadata

**Recommended For**:
- Documentation sites with clear structure
- Q&A systems needing context awareness
- Complex retrieval requiring section filtering

**Not Recommended For**:
- Simple FAQ-style content
- Very large document sets (increases storage)
- Real-time applications (slight overhead)

---

## Processing Flow Diagrams

### Initial KB Creation (Finalize Flow)

```
KB Draft Finalize
        ↓
process_web_kb_task (Celery)
        ↓
Determine source_type (web_scraping or file_upload)
        ↓
Extract chunking_config from KB
        ↓
enable_enhanced_metadata = chunking_config.get("enable_enhanced_metadata", False)
        ↓
┌─────────────────────────────────┐
│ smart_kb_service.process_document_with_proper_storage()
│                                 │
│  ↓ make_chunking_decision()     │
│    - Check user preferences     │
│    - Fall back to adaptive      │
│                                 │
│  ↓ if enable_enhanced_metadata: │
│      enhanced_chunking_service  │
│    else:                        │
│      chunking_service           │
│                                 │
│  ↓ Generate embeddings          │
│                                 │
│  ↓ Create metadata based on:    │
│    - source_type                │
│    - enable_enhanced_metadata   │
└─────────────────────────────────┘
        ↓
Storage based on source_type:
  - web_scraping → PostgreSQL + Qdrant
  - file_upload → Qdrant only
```

### Adding Document to Existing KB

```
POST /api/v1/kbs/{kb_id}/documents/upload
        ↓
Detect KB Type (check existing documents)
        ↓
┌─────────────────────┬────────────────────────┐
│ Web URL KB          │ File Upload KB         │
├─────────────────────┼────────────────────────┤
│ process_file_upload │ process_file_upload    │
│ _document_task      │ _document_task         │
│                     │                        │
│ skip_postgres=False │ skip_postgres=True     │
│ Uses chunking_service (NOT enhanced by default)│
└─────────────────────┴────────────────────────┘
        ↓
Inherits KB chunking_config
        ↓
storage based on skip_postgres_chunks parameter
```

### Reindexing Flow

```
reindex_kb_task(kb_id, new_config)
        ↓
Get all documents for KB
        ↓
Delete all chunks from PostgreSQL
        ↓
Delete Qdrant collection
        ↓
Recreate collection with new config
        ↓
For each document:
    ├── source_type == "file_upload"?
    │       ↓ YES
    │   SKIP (no content in PostgreSQL to reindex)
    │       ↓
    └── NO: Read from document.content_full
            ↓
        Chunk using new config
            ↓
        Generate embeddings
            ↓
        Store in PostgreSQL + Qdrant
```

**CRITICAL**: File upload documents cannot be reindexed because their content is not stored in PostgreSQL.

---

## Configuration Reference

### KB Config Structure

```python
kb.config = {
    "chunking": {
        "strategy": "by_heading",           # Chunking strategy
        "chunk_size": 1000,                 # Target chunk size (chars)
        "chunk_overlap": 200,               # Overlap between chunks
        "custom_separators": None,          # For "custom" strategy
        "enable_enhanced_metadata": False   # Rich metadata
    },
    "embedding": {
        "model": "all-MiniLM-L6-v2",        # Embedding model
        "batch_size": 100                   # Batch processing size
    },
    "vector_store": {
        "distance_metric": "cosine",        # Distance metric
        "hnsw_m": 16,                       # HNSW index parameter
        "batch_size": 100                   # Qdrant batch size
    }
}
```

### ChunkingConfig (chunking_service.py)

```python
@dataclass
class ChunkingConfig:
    # Semantic chunking
    semantic_threshold: float = 0.65       # Topic change threshold (0.0-1.0)
    semantic_min_paragraph_length: int = 20

    # Adaptive chunking
    adaptive_heading_density_threshold: float = 0.05  # >5% triggers by_heading
    adaptive_paragraph_count_threshold: int = 10      # >10 triggers paragraph_based

    # Size constraints
    default_chunk_size: int = 1000
    default_chunk_overlap: int = 200
    min_chunk_size: int = 50
    max_chunk_size_multiplier: float = 1.5

    # Token estimation
    chars_per_token: int = 4
```

### Validation Rules

```python
constraints = {
    "strategy": {
        "type": str,
        "allowed": ["recursive", "semantic", "by_heading", ...]
    },
    "chunk_size": {"type": int, "min": 100, "max": 10000},
    "chunk_overlap": {"type": int, "min": 0, "max": 2000},
    "semantic_threshold": {"type": float, "min": 0.0, "max": 1.0}
}
# Cross-validation: chunk_overlap must be < chunk_size
```

---

## Best Practices

### 1. Strategy Selection

| Content Type | Recommended Strategy | Reasoning |
|--------------|---------------------|-----------|
| Documentation | `by_heading` | Preserves structure |
| Articles/Blogs | `paragraph_based` | Natural breaks |
| Q&A Content | `semantic` | Groups related content |
| Mixed/Unknown | `adaptive` | Auto-detects best |
| Short Documents | `no_chunking` | Single chunk |
| API References | `by_section` | Logical groupings |

### 2. Enhanced Metadata Usage

```python
# Enable for documentation KBs with retrieval needs
chunking_config = {
    "strategy": "by_heading",
    "chunk_size": 1000,
    "chunk_overlap": 200,
    "enable_enhanced_metadata": True  # Adds context fields
}

# Disable for simple use cases
chunking_config = {
    "strategy": "recursive",
    "chunk_size": 1000,
    "chunk_overlap": 200
    # enable_enhanced_metadata defaults to False
}
```

### 3. File Upload Considerations

For File Upload KBs, plan configuration **before creation**:
- Cannot reindex (no source content in PostgreSQL)
- Must recreate KB to change chunking config
- Consider using `recursive` for general documents
- Use `by_heading` for structured PDFs

### 4. Metadata Utilization in Retrieval

```python
# Filter by context in Qdrant search
filters = {
    "kb_context": {"$in": ["chatbot", "both"]},
    "source_type": "file_upload"
}

# Use enhanced metadata for context display
if chunk.metadata.get("enhanced_metadata_enabled"):
    context = f"{chunk.metadata['context_before']} ... {chunk.content} ... {chunk.metadata['context_after']}"
    heading = chunk.metadata.get("parent_heading", "")
```

---

## Summary

| Aspect | Web URL KB | File Upload KB |
|--------|------------|----------------|
| **Chunk Storage** | PostgreSQL + Qdrant | Qdrant only |
| **Content Storage** | `document.content_full` | None (metadata only) |
| **Reindexable** | Yes | No |
| **Enhanced Metadata** | If enabled | If enabled |
| **Default Strategy** | `by_heading` | `recursive` |

**Key Takeaway**: Enhanced chunking metadata is available for BOTH KB types when explicitly enabled via `enable_enhanced_metadata: true`. The configuration is **inherited from KB config** when adding new documents, ensuring consistency.

---

## Config Inheritance for New Documents

When adding documents to an existing KB (via upload or text creation):

```
User defines KB config during finalization
    ↓
KB stores config in kb.config (including chunking_config)
    ↓
POST /kbs/{kb_id}/documents/upload or POST /kbs/{kb_id}/documents
    ↓
Task receives kb.config.get("chunking_config", {})
    ↓
Task extracts:
  - strategy
  - chunk_size
  - chunk_overlap
  - enable_enhanced_metadata  ← CRITICAL: Now inherited!
    ↓
If enable_enhanced_metadata=true:
    Use enhanced_chunking_service (with rich metadata)
Else:
    Use chunking_service (standard)
```

### Tasks That Inherit KB Config

| Task | Purpose | Inherits Enhanced Metadata |
|------|---------|---------------------------|
| `process_document_task` | Text documents to Web URL KB | ✅ Yes |
| `process_file_upload_document_task` | File uploads to either KB type | ✅ Yes |
| `process_web_kb_task` | Initial KB creation | ✅ Yes (via smart_kb_service) |

---

---

## Code Block Preservation Feature

### How It Works

When `preserve_code_blocks=true` (default), the chunking service:

1. **Pre-processing**: Scans for fenced code blocks (``` ... ```)
2. **Protection**: Replaces code blocks with placeholders
3. **Chunking**: Performs normal chunking on placeholder text
4. **Restoration**: Restores original code blocks in final chunks

### Algorithm

```
Original Text                    Processed Text
┌─────────────────────┐         ┌─────────────────────┐
│ Some text           │         │ Some text           │
│ ```python           │   →     │ __CODE_BLOCK_abc__  │
│ def hello():        │         │                     │
│     print("hi")     │         │ More text           │
│ ```                 │         │                     │
│ More text           │         └─────────────────────┘
└─────────────────────┘                  ↓
                                    Chunking
                                         ↓
                                ┌─────────────────────┐
                                │ Chunk 1:            │
                                │ Some text           │
                                │ ```python           │  ← Restored!
                                │ def hello():        │
                                │     print("hi")     │
                                │ ```                 │
                                │ More text           │
                                └─────────────────────┘
```

### Size Handling

| Code Block Size | Behavior |
|----------------|----------|
| ≤ 1.5x chunk_size | Protected, kept intact |
| > 1.5x chunk_size | Not protected, becomes own chunk |

### Configuration

```json
{
  "chunking": {
    "strategy": "recursive",
    "chunk_size": 1000,
    "chunk_overlap": 200,
    "preserve_code_blocks": true  // Default: true
  }
}
```

### Metadata Added

When a chunk contains a code block:
```python
chunk["metadata"]["has_code_block"] = True
```

---

## Changelog

| Date | Change |
|------|--------|
| 2024-12-18 | Initial documentation of actual implementation |
| 2024-12-18 | Verified enhanced metadata feature availability |
| 2024-12-18 | Documented metadata structure for both KB types |
| 2024-12-18 | **FIXED**: Document processing tasks now inherit `enable_enhanced_metadata` from KB config |
| 2024-12-18 | **FIXED**: Added enhanced_chunking_service usage in `process_document_task` and `process_file_upload_document_task` |
| 2024-12-18 | **IMPLEMENTED**: `preserve_code_blocks` feature now fully functional |
| 2024-12-18 | **WIRED**: `preserve_code_blocks` passed through entire pipeline (frontend → KB config → tasks → chunking_service) |
