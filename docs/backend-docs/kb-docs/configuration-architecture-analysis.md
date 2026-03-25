# KB Configuration Architecture Analysis

## Overview

This document analyzes how the new configurable chunking and embedding architecture integrates with the Knowledge Base creation flows for both **Web URL** and **File Upload** sources.

---

## 1. Configuration Flow Architecture

### 1.1 Configuration Hierarchy

```
┌─────────────────────────────────────────────────────────────────────┐
│                    CONFIGURATION PRIORITY ORDER                      │
├─────────────────────────────────────────────────────────────────────┤
│  1. Caller Override (API request params)          [HIGHEST]          │
│  2. KB Config (context_settings.retrieval_config)                   │
│  3. Draft Config (chunking_config, embedding_config)                │
│  4. Service Defaults (ChunkingConfig, EmbeddingConfig)              │
│  5. Hardcoded Defaults                            [LOWEST]          │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.2 Configuration Components

| Component | Schema | Service | Storage |
|-----------|--------|---------|---------|
| **Chunking** | `ChunkingConfigSchema` | `ChunkingService` | `kb.config.chunking_config` |
| **Embedding** | `EmbeddingConfigSchema` | `LocalEmbeddingService` | `kb.embedding_config` |
| **Retrieval** | `RetrievalConfigSchema` | `RetrievalService` | `kb.context_settings.retrieval_config` |

---

## 2. Web URL Source Flow

### 2.1 Complete Flow Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                        WEB URL KB CREATION FLOW                       │
└──────────────────────────────────────────────────────────────────────┘

PHASE 1: DRAFT MODE (Redis)
═══════════════════════════
                                           ┌─────────────────────────┐
User adds URLs ──► kb_draft.py             │ Redis Draft Structure   │
                  POST /kb-drafts/{id}/    │                         │
                  add-web-sources          │ {                       │
                         │                 │   "name": "...",        │
                         ▼                 │   "sources": [...],     │
              kb_draft_service.py          │   "chunking_config": {  │
              add_web_source_to_draft()    │     "strategy": "...",  │
                         │                 │     "chunk_size": 1000, │
                         │                 │     "semantic_threshold"│
                         │                 │   },                    │
                         ▼                 │   "embedding_config": { │
              Firecrawl scrapes URLs       │     "model_name": "..." │
              Preview stored in Redis      │   }                     │
                                           │ }                       │
                                           └─────────────────────────┘

PHASE 2: FINALIZATION
═══════════════════════
                                           ┌─────────────────────────┐
User clicks Deploy ──► kb_draft.py         │ PostgreSQL              │
                       POST /kb-drafts/    │                         │
                       {id}/finalize       │ knowledge_bases:        │
                              │            │   - id, name            │
                              ▼            │   - config (JSONB) ◄────┼── Contains chunking_config
              kb_draft_service.py          │   - context_settings    │
              finalize_kb_draft()          │   - embedding_config    │
                     │                     │   - status: "processing"│
                     ├──► Create KB record │                         │
                     ├──► Create Documents │ documents:              │
                     └──► Queue Celery     │   - id, kb_id, name     │
                          Task             │   - content_full (NULL  │
                              │            │     for web URLs)       │
                              │            └─────────────────────────┘
                              ▼
PHASE 3: BACKGROUND PROCESSING (Celery)
════════════════════════════════════════
              ┌─────────────────────────────────────────────────────┐
              │              process_web_kb_task                     │
              │                                                      │
              │  1. Extract config from task params                  │
              │     chunking_config = config.get("chunking_config")  │
              │     embedding_config = config.get("embedding_config")│
              │                                                      │
              │  2. For each source URL:                             │
              │     ┌──────────────────────────────────────────┐    │
              │     │ smart_kb_service.process_document_with_  │    │
              │     │ proper_storage(                          │    │
              │     │   document=doc,                          │    │
              │     │   content=scraped_content,               │    │
              │     │   kb=kb,                                 │    │
              │     │   user_config=chunking_config  ◄─────────┼────┼─ Config passed!
              │     │ )                                        │    │
              │     └──────────────────────────────────────────┘    │
              │                        │                             │
              │                        ▼                             │
              │     ┌──────────────────────────────────────────┐    │
              │     │ smart_kb_service.make_chunking_decision  │    │
              │     │                                          │    │
              │     │ Priority:                                │    │
              │     │   1. user_config.strategy ◄──────────────┼────┼─ USER CONFIG
              │     │   2. kb.config.chunking.strategy         │    │
              │     │   3. Adaptive analysis                   │    │
              │     │   4. Defaults                            │    │
              │     └──────────────────────────────────────────┘    │
              │                        │                             │
              │                        ▼                             │
              │     ┌──────────────────────────────────────────┐    │
              │     │ chunking_service.chunk_document(         │    │
              │     │   text=content,                          │    │
              │     │   strategy=decision.strategy,  ◄─────────┼────┼─ FROM CONFIG
              │     │   chunk_size=decision.chunk_size,        │    │
              │     │   chunk_overlap=decision.chunk_overlap,  │    │
              │     │   config={                               │    │
              │     │     "semantic_threshold": 0.65  ◄────────┼────┼─ NEW! Configurable
              │     │   }                                      │    │
              │     │ )                                        │    │
              │     └──────────────────────────────────────────┘    │
              │                        │                             │
              │                        ▼                             │
              │     ┌──────────────────────────────────────────┐    │
              │     │ embedding_service.generate_embeddings(   │    │
              │     │   chunk_texts                            │    │
              │     │ )                                        │    │
              │     │                                          │    │
              │     │ NOTE: Currently uses global instance     │    │
              │     │ Model: all-MiniLM-L6-v2 (default)        │    │
              │     │ Config via EMBEDDING_MODEL env var       │    │
              │     └──────────────────────────────────────────┘    │
              │                        │                             │
              │                        ▼                             │
              │     ┌──────────────────────────────────────────┐    │
              │     │ qdrant_service.upsert_chunks(            │    │
              │     │   kb_id=kb.id,                           │    │
              │     │   chunks=qdrant_chunks                   │    │
              │     │ )                                        │    │
              │     │                                          │    │
              │     │ STORAGE: Hybrid (PostgreSQL + Qdrant)    │    │
              │     │   - PostgreSQL: chunks table (optional)  │    │
              │     │   - Qdrant: vectors + metadata           │    │
              │     └──────────────────────────────────────────┘    │
              └─────────────────────────────────────────────────────┘
```

### 2.2 Web URL Configuration Alignment

| Configuration Parameter | Where Set | How Used | Status |
|------------------------|-----------|----------|--------|
| `chunking_config.strategy` | Draft UI | `smart_kb_service.make_chunking_decision()` | ✅ Working |
| `chunking_config.chunk_size` | Draft UI | `chunking_service.chunk_document()` | ✅ Working |
| `chunking_config.chunk_overlap` | Draft UI | `chunking_service.chunk_document()` | ✅ Working |
| `chunking_config.semantic_threshold` | Draft UI | `chunking_service._semantic_chunk()` | ✅ **NEW** |
| `embedding_config.model_name` | Draft UI | `LocalEmbeddingService` init | ⚠️ Partial* |
| `retrieval_config.top_k` | KB Settings | `retrieval_service.search()` | ✅ Working |
| `retrieval_config.strategy` | KB Settings | `retrieval_service.search()` | ✅ Working |

*Embedding model is set at service initialization. Per-KB model selection requires service refactoring.

---

## 3. File Upload Source Flow

### 3.1 Complete Flow Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                      FILE UPLOAD KB CREATION FLOW                     │
└──────────────────────────────────────────────────────────────────────┘

PHASE 1: DRAFT MODE (Redis)
═══════════════════════════
                                           ┌─────────────────────────┐
User uploads files ──► kb_draft.py         │ TIKA DOCKER CONTAINER   │
                       POST /kb-drafts/    │                         │
                       {id}/add-files      │ Parses file formats:    │
                              │            │   - PDF, DOCX, TXT      │
                              ▼            │   - CSV, JSON, XML      │
              kb_draft_service.py          │   - XLSX, PPTX, etc.    │
              add_file_source_to_draft()   │                         │
                     │                     │ Returns:                │
                     ├──► tika_service     │   - Extracted text      │
                     │    .parse_file()    │   - Metadata            │
                     │                     │   - Page count          │
                     │                     └─────────────────────────┘
                     │
                     ▼                     ┌─────────────────────────┐
              Store in Redis Draft         │ Redis Draft Structure   │
                                           │                         │
                                           │ sources: [{             │
                                           │   "type": "file_upload",│
                                           │   "filename": "...",    │
                                           │   "content": "...",     │
                                           │   "parsed_content":     │
                                           │     { tika_result }     │
                                           │ }]                      │
                                           │                         │
                                           │ chunking_config: {      │
                                           │   "strategy": "...",    │
                                           │   "semantic_threshold": │
                                           │     0.65                │
                                           │ }                       │
                                           └─────────────────────────┘

PHASE 2: FINALIZATION
═══════════════════════
              Same as Web URL flow...
              KB record created with config

PHASE 3: BACKGROUND PROCESSING (Celery)
════════════════════════════════════════
              ┌─────────────────────────────────────────────────────┐
              │              process_web_kb_task                     │
              │                                                      │
              │  FILE UPLOAD DETECTION:                              │
              │  ───────────────────────                             │
              │  if source.get("type") == "file_upload":             │
              │      # Already parsed by Tika in draft phase         │
              │      content = source.get("parsed_content")          │
              │                                                      │
              │  OPTION A STORAGE (File Uploads):                    │
              │  ════════════════════════════════                    │
              │  all_file_uploads = all(s.type == "file_upload")     │
              │                                                      │
              │  if all_file_uploads:                                │
              │      skip_postgres_chunks = True  ◄─────────────────┼─ QDRANT-ONLY
              │      document.content_full = None                    │
              │                                                      │
              │  Processing flow same as Web URL, but:               │
              │                                                      │
              │     ┌──────────────────────────────────────────┐    │
              │     │ smart_kb_service.process_document_with_  │    │
              │     │ proper_storage(                          │    │
              │     │   document=doc,                          │    │
              │     │   content=parsed_tika_content,           │    │
              │     │   kb=kb,                                 │    │
              │     │   user_config=chunking_config, ◄─────────┼────┼─ Config passed!
              │     │   skip_postgres_chunks=True   ◄──────────┼────┼─ OPTION A!
              │     │ )                                        │    │
              │     └──────────────────────────────────────────┘    │
              │                        │                             │
              │                        ▼                             │
              │     ┌──────────────────────────────────────────┐    │
              │     │ STORAGE DIFFERENCE:                      │    │
              │     │                                          │    │
              │     │ Web URL:                                 │    │
              │     │   PostgreSQL: document.content_full ✓    │    │
              │     │   PostgreSQL: chunks table (optional)    │    │
              │     │   Qdrant: vectors + metadata             │    │
              │     │                                          │    │
              │     │ File Upload (Option A):                  │    │
              │     │   PostgreSQL: document.content_full = ✗  │    │
              │     │   PostgreSQL: chunks table = SKIP        │    │
              │     │   Qdrant: vectors + FULL metadata ◄──────┼────┼─ Contains content!
              │     └──────────────────────────────────────────┘    │
              └─────────────────────────────────────────────────────┘
```

### 3.2 File Upload Configuration Alignment

| Configuration Parameter | Where Set | How Used | Status |
|------------------------|-----------|----------|--------|
| `chunking_config.strategy` | Draft UI | `smart_kb_service.make_chunking_decision()` | ✅ Working |
| `chunking_config.chunk_size` | Draft UI | `chunking_service.chunk_document()` | ✅ Working |
| `chunking_config.chunk_overlap` | Draft UI | `chunking_service.chunk_document()` | ✅ Working |
| `chunking_config.semantic_threshold` | Draft UI | `chunking_service._semantic_chunk()` | ✅ **NEW** |
| `embedding_config.model_name` | Draft UI | `LocalEmbeddingService` init | ⚠️ Partial* |
| `skip_postgres_chunks` | Auto-detected | `smart_kb_service` | ✅ Automatic |

---

## 4. Key Differences: Web URL vs File Upload

| Aspect | Web URL | File Upload |
|--------|---------|-------------|
| **Content Extraction** | Firecrawl (at draft time) | Tika (at draft time) |
| **PostgreSQL content_full** | Stored | NULL (Option A) |
| **PostgreSQL chunks table** | Optional | Skipped (Option A) |
| **Qdrant storage** | Vectors + metadata | Vectors + FULL content in metadata |
| **Retrieval source** | Can use PostgreSQL or Qdrant | Qdrant only |
| **Chunking config** | ✅ Fully honored | ✅ Fully honored |
| **Embedding config** | ✅ Uses global service | ✅ Uses global service |

---

## 5. Configuration Integration Points

### 5.1 Where New Configurations Are Applied

```python
# chunking_service.py - NEW configurable parameters
class ChunkingConfig:
    semantic_threshold: float = 0.65      # ✅ Used in _semantic_chunk()
    semantic_min_paragraph_length: int    # ✅ Used in _semantic_chunk()
    adaptive_heading_density_threshold    # ✅ Used in _adaptive_chunk()
    adaptive_paragraph_count_threshold    # ✅ Used in _adaptive_chunk()
    max_chunk_size_multiplier            # ✅ Used in _hybrid_chunk()

# smart_kb_service.py - Uses chunking_config
def make_chunking_decision(user_config):
    user_strategy = user_config.get("strategy")     # ✅ Honored
    user_chunk_size = user_config.get("chunk_size") # ✅ Honored
    user_chunk_overlap = user_config.get("chunk_overlap") # ✅ Honored

# embedding_service_local.py - Model selection
SUPPORTED_MODELS = {
    "all-MiniLM-L6-v2": {...},      # Default
    "all-MiniLM-L12-v2": {...},     # Better quality
    "all-mpnet-base-v2": {...},     # Best quality
    "paraphrase-multilingual-...": {...}  # Multilingual
}
DEFAULT_MODEL = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")
```

### 5.2 Configuration Validation Points

```
┌─────────────────────────────────────────────────────────────────────┐
│                    VALIDATION CHAIN                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. API Layer (Pydantic Schemas)                                    │
│     └── schemas/config.py                                           │
│         ├── ChunkingConfigSchema.validate()                         │
│         ├── EmbeddingConfigSchema.validate()                        │
│         └── RetrievalConfigSchema.validate()                        │
│                           │                                          │
│                           ▼                                          │
│  2. Service Layer (Runtime Validation)                              │
│     └── ChunkingService.validate_chunking_config()                  │
│     └── LocalEmbeddingService.validate_embedding_config()           │
│     └── RetrievalService.validate_retrieval_config()                │
│                           │                                          │
│                           ▼                                          │
│  3. Processing Layer (Defaults Applied)                             │
│     └── ChunkingConfig.from_dict() with defaults                    │
│     └── EmbeddingConfig with defaults                               │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 6. Gap Analysis

### 6.1 What's Working Well

| Feature | Status | Notes |
|---------|--------|-------|
| Chunking strategy selection | ✅ | User-selected strategy honored |
| Chunk size/overlap | ✅ | Configurable per KB |
| Semantic threshold | ✅ **NEW** | Configurable (was hardcoded 0.65) |
| Adaptive thresholds | ✅ **NEW** | Configurable heading/paragraph thresholds |
| Validation | ✅ **NEW** | Pydantic + runtime validation |
| Backward compatibility | ✅ | All defaults match previous behavior |

### 6.2 Current Limitations

| Limitation | Impact | Recommendation |
|------------|--------|----------------|
| Embedding model is global | Can't use different models per KB | Future: Model registry with lazy loading |
| No per-KB embedding config | Config stored but not used at runtime | Future: Refactor embedding service |
| Semantic chunking needs embeddings | Falls back if model not ready | Expected behavior |

### 6.3 Recommended Improvements

1. **Per-KB Embedding Model Selection**
   ```python
   # Future enhancement in smart_kb_service.py
   async def process_document_with_proper_storage(
       self, document, content, kb, user_config, skip_postgres_chunks
   ):
       # Get KB-specific embedding config
       embedding_config = kb.embedding_config or {}
       model_name = embedding_config.get("model_name", DEFAULT_MODEL)

       # Use model registry for lazy loading
       embedder = embedding_registry.get_or_create(model_name)
       embeddings = await embedder.generate_embeddings(chunk_texts)
   ```

2. **Enhanced Semantic Chunking Config Propagation**
   ```python
   # In smart_kb_service.make_chunking_decision()
   # Add semantic_threshold to decision
   return ChunkingDecision(
       strategy=final_strategy,
       chunk_size=final_chunk_size,
       chunk_overlap=final_chunk_overlap,
       semantic_threshold=user_config.get("semantic_threshold", 0.65)  # NEW
   )
   ```

---

## 7. Testing Recommendations

### 7.1 Configuration Flow Tests

```python
# Test 1: Web URL with custom semantic_threshold
async def test_web_url_semantic_threshold():
    # Create draft with semantic_threshold = 0.8
    # Finalize and process
    # Verify chunks reflect higher threshold (fewer splits)

# Test 2: File upload with custom chunk_size
async def test_file_upload_chunk_size():
    # Upload file with chunk_size = 500
    # Verify chunks are ~500 chars (not default 1000)

# Test 3: Configuration validation
def test_invalid_config_sanitized():
    # Pass invalid config (chunk_size = 50)
    # Verify it's corrected to minimum (100)

# Test 4: Backward compatibility
def test_default_config_unchanged():
    # Process without any config
    # Verify defaults match previous behavior
```

---

## 8. Summary

The new configurable architecture **aligns well** with both Web URL and File Upload flows:

1. **Configuration flows correctly** from Draft → Finalize → Background Task → Services
2. **Both source types** use the same configuration pipeline
3. **New parameters** (semantic_threshold, etc.) are available but optional
4. **Backward compatible** - existing code works without changes
5. **Validation** at multiple layers prevents invalid configurations

**Key files modified:**
- `chunking_service.py` - Added ChunkingConfig dataclass
- `embedding_service_local.py` - Added SUPPORTED_MODELS and validation
- `enhanced_chunking_service.py` - Real implementation (not pseudocode)
- `schemas/config.py` - Pydantic validation schemas

**Configuration storage:**
- Draft: Redis (`chunking_config`, `embedding_config`)
- KB: PostgreSQL JSONB (`config`, `embedding_config`, `context_settings`)
- Runtime: Service instances with merged configs
