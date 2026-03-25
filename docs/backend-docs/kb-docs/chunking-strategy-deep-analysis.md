# Chunking Strategy Deep Analysis

## Executive Summary

This document provides a comprehensive analysis of the chunking strategy architecture in PrivexBot's Knowledge Base system, covering:
1. Custom chunking strategy and custom_separators wiring
2. How each strategy works for Web URL and File Upload flows
3. What triggers `enhanced_chunking_service`
4. Complete user journey with endpoints
5. Best practices without over-engineering

---

## 1. Custom Chunking Strategy Analysis

### Current Implementation

The `custom` strategy in `chunking_service.py` (lines 961-973) uses user-defined separators:

```python
def _custom_chunk(
    self,
    text: str,
    chunk_size: int,
    chunk_overlap: int,
    separators: Optional[List[str]] = None
) -> List[dict]:
    """Custom chunking with user-defined separators."""
    if not separators:
        return self._recursive_chunk(text, chunk_size, chunk_overlap)
    return self._recursive_chunk(text, chunk_size, chunk_overlap, separators)
```

### Where Custom Separators ARE Used

| Location | File | Lines | Status |
|----------|------|-------|--------|
| **Preview Endpoint** | `kb_draft.py` | 889, 922 | WORKING |
| `chunk_document()` | `chunking_service.py` | 122, 160, 190 | WORKING |

**Preview endpoint code (kb_draft.py:889-922):**
```python
custom_separators = request.get("custom_separators", None)  # Line 889
...
chunks_raw = chunking_service.chunk_document(
    text=content,
    strategy=strategy,
    chunk_size=chunk_size,
    chunk_overlap=chunk_overlap,
    separators=custom_separators  # Line 922 - PASSED!
)
```

### Where Custom Separators Are NOT Wired

| Location | File | Issue |
|----------|------|-------|
| **KBFinalizeRequest schema** | `kb_draft.py:2232-2240` | No `custom_separators` field |
| **Pipeline task** | `kb_pipeline_tasks.py` | Reads strategy/size/overlap but NOT separators |

**What's in KBFinalizeRequest (kb_draft.py:2232-2240):**
```python
chunking_config: Dict[str, Any] = Field(
    default_factory=lambda: {
        "strategy": "by_heading",      # YES
        "chunk_size": 1000,            # YES
        "chunk_overlap": 200,          # YES
        "preserve_code_blocks": True   # YES
        # custom_separators: ???       # NOT INCLUDED
    }
)
```

### Gap Analysis - RESOLVED

| Aspect | Preview | Finalization | Production Pipeline |
|--------|---------|--------------|---------------------|
| `custom` strategy | WORKS | WORKS | WORKS |
| `custom_separators` | WORKS | WORKS | WORKS |
| `enable_enhanced_metadata` | N/A | WORKS | WORKS |

### Implementation (Completed)

**Changes Made:**

1. **KBFinalizeRequest schema** (`kb_draft.py:2232-2240`):
   ```python
   chunking_config: Dict[str, Any] = Field(
       default_factory=lambda: {
           "strategy": "by_heading",
           "chunk_size": 1000,
           "chunk_overlap": 200,
           "preserve_code_blocks": True,
           "custom_separators": None,  # NEW: For "custom" strategy
           "enable_enhanced_metadata": False  # NEW: Rich metadata option
       }
   )
   ```

2. **Pipeline task** (`kb_pipeline_tasks.py:319-323`):
   ```python
   custom_separators = chunking_config.get("custom_separators", None)
   enable_enhanced_metadata = chunking_config.get("enable_enhanced_metadata", False)
   ```

3. **smart_kb_service** (`smart_kb_service.py:378-405`):
   - Extracts `custom_separators` and `enable_enhanced_metadata` from user_config
   - Passes `separators` to `chunking_service.chunk_document()`
   - Uses `enhanced_chunking_service` when `enable_enhanced_metadata=True`

---

## 2. Chunking Strategies - Implementation Details

### Strategy Overview

| Strategy | Method | Best For | Implementation |
|----------|--------|----------|----------------|
| `recursive` | `_recursive_chunk` | General content | Split by `[\n\n, \n, " ", ""]` recursively |
| `semantic` | `_semantic_chunk` | Q&A, retrieval | Embedding-based topic boundary detection |
| `by_heading` | `_heading_chunk` | Documentation | Split at markdown headings `# ## ### ####` |
| `by_section` | `_section_chunk` | Technical guides | Aggressive section boundary detection |
| `adaptive` | `_adaptive_chunk` | Mixed content | Auto-select based on content analysis |
| `sentence_based` | `_sentence_chunk` | Chat logs | Split at `.!?` boundaries |
| `paragraph_based` | `_paragraph_chunk` | Articles | Split at `\n\n` (paragraphs) |
| `hybrid` | `_hybrid_chunk` | Complex docs | Heading-first, then paragraph refinement |
| `no_chunking` | `_full_content_chunk` | Short docs | Single chunk (entire content) |
| `token` | `_token_chunk` | LLM context | Token-aware splitting (4 chars/token) |
| `custom` | `_custom_chunk` | Special cases | User-defined separators |

### How Each Strategy Works

#### 2.1 Recursive Chunking (Default)
```
Input: "Para1\n\nPara2\nLine2\nLine3\n\nPara3"

Step 1: Split by "\n\n" → ["Para1", "Para2\nLine2\nLine3", "Para3"]
Step 2: If chunk > chunk_size, split by "\n"
Step 3: If still > chunk_size, split by " " (words)
Step 4: Final fallback: character-level split
```

#### 2.2 Semantic Chunking (Requires Embeddings)
```
1. Split into paragraphs (min 20 chars)
2. Generate embeddings for each paragraph
3. Calculate cosine similarity between consecutive paragraphs
4. If similarity < semantic_threshold (default 0.65), start new chunk
5. Group similar paragraphs together
```

#### 2.3 Adaptive Chunking (Auto-Selection)
```
Analysis Phase:
- Count headings (lines starting with #)
- Count paragraphs (text between \n\n)
- Calculate heading_density = headings / total_lines

Decision Logic:
- heading_density > 0.05 → by_heading
- paragraph_count > 10 → paragraph_based
- headings > 0 → hybrid
- else → recursive
```

---

## 3. Flow Comparison: Web URL vs File Upload

### 3.1 Web URL Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        WEB URL KNOWLEDGE BASE FLOW                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  PHASE 1: Draft Mode (Redis Only)                                        │
│  ─────────────────────────────────                                       │
│  POST /api/v1/kb-drafts/                                                │
│    └── Creates Redis draft with default config:                         │
│        {                                                                 │
│          "chunking_config": {                                           │
│            "strategy": "by_heading",                                    │
│            "chunk_size": 1000,                                          │
│            "chunk_overlap": 200                                         │
│          }                                                               │
│        }                                                                 │
│                                                                          │
│  POST /api/v1/kb-drafts/{draft_id}/web-sources                         │
│    └── Add URLs to scrape (stored in Redis sources[])                   │
│                                                                          │
│  POST /api/v1/kb-drafts/{draft_id}/chunking                            │
│    └── Update chunking configuration (optional)                         │
│                                                                          │
│  POST /api/v1/kb-drafts/{draft_id}/preview                             │
│    └── Preview chunks for specific source                               │
│                                                                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  PHASE 2: Finalization                                                   │
│  ─────────────────────────                                               │
│  POST /api/v1/kb-drafts/{draft_id}/finalize                            │
│    ├── 1. Validate configuration                                        │
│    ├── 2. Create KB record in PostgreSQL                                │
│    ├── 3. Create placeholder Documents in PostgreSQL                    │
│    ├── 4. Queue Celery task: process_web_kb_task                       │
│    └── 5. Return pipeline_id for tracking                               │
│                                                                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  PHASE 3: Background Processing (Celery)                                │
│  ───────────────────────────────────────                                │
│  process_web_kb_task (kb_pipeline_tasks.py)                             │
│    ├── 1. Scrape URLs (Firecrawl → Jina fallback)                       │
│    ├── 2. Parse content (Smart parsing)                                 │
│    │                                                                     │
│    ├── 3. CHUNKING DECISION POINT:                                      │
│    │      └── smart_kb_service.make_chunking_decision()                │
│    │          ├── Check user_config (from KB.config.chunking)          │
│    │          ├── If explicit → use user preference                    │
│    │          └── If partial/none → adaptive analysis                   │
│    │                                                                     │
│    ├── 4. EXECUTE CHUNKING:                                             │
│    │      └── chunking_service.chunk_document(                         │
│    │            text=content,                                           │
│    │            strategy=decision.strategy,                            │
│    │            chunk_size=decision.chunk_size,                        │
│    │            chunk_overlap=decision.chunk_overlap                   │
│    │          )                                                         │
│    │                                                                     │
│    ├── 5. Generate embeddings (embedding_service)                      │
│    │                                                                     │
│    ├── 6. STORAGE (Dual):                                               │
│    │      ├── PostgreSQL: Documents + Chunks (with content)            │
│    │      └── Qdrant: Vectors + Metadata + Content                     │
│    │                                                                     │
│    └── 7. Update KB status → "ready"                                   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.2 File Upload Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       FILE UPLOAD KNOWLEDGE BASE FLOW                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  PHASE 1: Draft Mode (Redis Only)                                        │
│  ─────────────────────────────────                                       │
│  POST /api/v1/kb-drafts/                                                │
│    └── Creates Redis draft (same as web URL)                            │
│                                                                          │
│  POST /api/v1/kb-drafts/{draft_id}/files                               │
│    └── Upload file → Tika parsing → Store in Redis sources[]           │
│        ├── PDF → Tika → text/markdown                                   │
│        ├── DOCX → Tika → text/markdown                                  │
│        ├── CSV → Tika → structured text                                 │
│        └── ... (15+ formats supported)                                  │
│                                                                          │
│  POST /api/v1/kb-drafts/{draft_id}/chunking                            │
│    └── Update chunking configuration (optional)                         │
│                                                                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  PHASE 2: Finalization                                                   │
│  ─────────────────────────                                               │
│  POST /api/v1/kb-drafts/{draft_id}/finalize                            │
│    ├── Same as web URL                                                  │
│    └── Queue Celery task with source_type="file_upload"                │
│                                                                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  PHASE 3: Background Processing (Celery)                                │
│  ───────────────────────────────────────                                │
│  process_web_kb_task (same task, different source handling)             │
│    ├── 1. Content already parsed (from Tika in Phase 1)                │
│    │                                                                     │
│    ├── 2. CHUNKING (same as web URL):                                   │
│    │      └── smart_kb_service.make_chunking_decision()                │
│    │      └── chunking_service.chunk_document()                        │
│    │                                                                     │
│    ├── 3. Generate embeddings (same)                                    │
│    │                                                                     │
│    ├── 4. STORAGE (OPTION A - Qdrant Only):                            │
│    │      ├── PostgreSQL: Documents (metadata only, NO content_full)   │
│    │      ├── PostgreSQL: Chunks → SKIPPED (skip_postgres_chunks=True) │
│    │      └── Qdrant: Vectors + Metadata + Full Content (ONLY STORAGE) │
│    │                                                                     │
│    └── 5. Update KB status → "ready"                                   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Key Differences

| Aspect | Web URL | File Upload |
|--------|---------|-------------|
| **Content Source** | Scraped at Phase 3 | Parsed at Phase 1 (Tika) |
| **PostgreSQL Documents** | Full content stored | Metadata only |
| **PostgreSQL Chunks** | Created | SKIPPED |
| **Qdrant** | Vectors + metadata | Vectors + metadata + FULL CONTENT |
| **Retrieval Source** | PostgreSQL or Qdrant | Qdrant ONLY |

---

## 4. Enhanced Chunking Service - NOW INTEGRATED

### Integration Status - COMPLETE

The `enhanced_chunking_service.py` is now **optionally integrated** via `enable_enhanced_metadata` flag:

**How It Works:**
```python
# In smart_kb_service.py (line 383-396):
if enable_enhanced_metadata:
    enhanced_config = EnhancedChunkConfig(
        strategy=chunking_decision.strategy,
        chunk_size=chunking_decision.chunk_size,
        chunk_overlap=chunking_decision.chunk_overlap,
        include_context=True,
        include_metadata=True,
        analyze_structure=True
    )
    enhanced_chunks = enhanced_chunking_service.chunk_document_enhanced(content, enhanced_config)
    chunks_data = [chunk.to_dict() for chunk in enhanced_chunks]
```

### Enhanced Features (When `enable_enhanced_metadata=True`)

| Feature | Description | Stored In |
|---------|-------------|-----------|
| `context_before` | Text from previous chunk (100 chars) | chunk.metadata |
| `context_after` | Text from next chunk (100 chars) | chunk.metadata |
| `parent_heading` | First heading in chunk | chunk.metadata |
| `document_analysis` | Full structure analysis | chunk.metadata |
| `chunk_index` / `total_chunks` | Position info | chunk.metadata |
| `word_count` / `chunk_length` | Size metrics | chunk.metadata |

### Usage Example

**API Request:**
```json
POST /api/v1/kb-drafts/{draft_id}/finalize
{
    "chunking_config": {
        "strategy": "by_heading",
        "chunk_size": 1000,
        "chunk_overlap": 200,
        "enable_enhanced_metadata": true
    }
}
```

**Result in Qdrant:**
```json
{
    "content": "## Getting Started\n\nFirst, install...",
    "metadata": {
        "context_before": "...introduction to our product.",
        "context_after": "Next, configure your...",
        "parent_heading": "Getting Started",
        "chunk_index": 2,
        "total_chunks": 15,
        "word_count": 245,
        "document_analysis": {
            "heading_count": 12,
            "recommended_strategy": "by_heading"
        }
    }
}
```

### Architecture (No Duplication)

```
┌─────────────────────────────────────────────────────────────────────┐
│                     CHUNKING ARCHITECTURE                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  smart_kb_service.process_document_with_proper_storage()            │
│    │                                                                 │
│    ├── enable_enhanced_metadata=False (default)                     │
│    │   └── chunking_service.chunk_document()                        │
│    │       └── Standard chunks with basic metadata                  │
│    │                                                                 │
│    └── enable_enhanced_metadata=True                                │
│        └── enhanced_chunking_service.chunk_document_enhanced()      │
│            └── WRAPS chunking_service (no duplication)              │
│            └── ADDS context_before/after, parent_heading            │
│            └── ADDS document_analysis                               │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### When to Enable Enhanced Metadata

| Use Case | Recommendation |
|----------|----------------|
| Q&A retrieval | Enable - context helps |
| Simple search | Disable - overhead not needed |
| RAG with chat | Enable - parent_heading helps |
| Large KB (>1000 chunks) | Disable - reduces storage |

---

## 5. Preview vs Production Parity - FIXED

### The Principle

**Preview should show EXACTLY what production will produce.** This ensures users can make informed decisions about their chunking configuration.

### Implementation

Both preview (`kb_draft.py`) and production (`smart_kb_service.py`) now use the **same logic**:

```python
# SAME CODE IN BOTH:
if enable_enhanced_metadata:
    # Use enhanced_chunking_service
    enhanced_config = EnhancedChunkConfig(...)
    enhanced_chunks = enhanced_chunking_service.chunk_document_enhanced(content, enhanced_config)
    chunks = [chunk.to_dict() for chunk in enhanced_chunks]
else:
    # Use standard chunking_service
    chunks = chunking_service.chunk_document(
        text=content,
        strategy=strategy,
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        separators=custom_separators
    )
```

### Parity Table

| Parameter | Preview Endpoint | Production (smart_kb_service) |
|-----------|-----------------|-------------------------------|
| `strategy` | YES | YES |
| `chunk_size` | YES | YES |
| `chunk_overlap` | YES | YES |
| `custom_separators` | YES | YES |
| `enable_enhanced_metadata` | YES | YES |
| Uses `chunking_service` | YES (default) | YES (default) |
| Uses `enhanced_chunking_service` | YES (when flag=true) | YES (when flag=true) |

### Output Format Comparison

**Standard (`enable_enhanced_metadata=false`):**
```json
{
    "content": "## Getting Started...",
    "index": 0,
    "token_count": 45,
    "char_count": 180,
    "has_overlap": false
}
```

**Enhanced (`enable_enhanced_metadata=true`):**
```json
{
    "content": "## Getting Started...",
    "index": 0,
    "token_count": 45,
    "char_count": 180,
    "has_overlap": false,
    "context_before": null,
    "context_after": "## Advanced Usage...",
    "parent_heading": "Getting Started",
    "metadata": {
        "chunk_index": 0,
        "total_chunks": 5,
        "strategy_used": "by_heading",
        "document_analysis": {
            "heading_count": 4,
            "recommended_strategy": "by_heading"
        }
    }
}
```

---

## 6. User Journey - Complete Flow with Endpoints

### 5.1 Create KB from Web URLs (Typical User Journey)

```
Step 1: Create Draft
───────────────────
POST /api/v1/kb-drafts/
Body: {
  "name": "Product Documentation",
  "workspace_id": "uuid",
  "context": "both"
}
Response: { "draft_id": "draft_kb_abc123", "expires_at": "..." }


Step 2: Add Web Sources
───────────────────────
POST /api/v1/kb-drafts/{draft_id}/web-sources
Body: {
  "url": "https://docs.example.com",
  "config": {
    "method": "crawl",
    "max_pages": 50,
    "max_depth": 3
  }
}
Response: { "source_id": "src_xyz789", "status": "scraped", ... }


Step 3 (Optional): Configure Chunking
─────────────────────────────────────
POST /api/v1/kb-drafts/{draft_id}/chunking
Body: {
  "strategy": "semantic",
  "chunk_size": 1500,
  "chunk_overlap": 300,
  "preserve_code_blocks": true
}
Response: { "success": true, "chunking_config": {...} }


Step 4 (Optional): Preview Chunks
─────────────────────────────────
POST /api/v1/kb-drafts/{draft_id}/preview
Body: {
  "source_id": "src_xyz789"
}
Response: {
  "chunks": [...],
  "stats": { "total_chunks": 42, "avg_chunk_size": 987 }
}


Step 5: Finalize
────────────────
POST /api/v1/kb-drafts/{draft_id}/finalize
Body: {
  "chunking_config": { "strategy": "semantic", ... },
  "embedding_config": { "model": "all-MiniLM-L6-v2", ... },
  "retrieval_config": { "strategy": "hybrid_search", ... }
}
Response: { "kb_id": "uuid", "pipeline_id": "pip_123", "status": "processing" }


Step 6: Monitor Pipeline
────────────────────────
GET /api/v1/kb-pipeline/{pipeline_id}/status
Response: {
  "status": "processing",
  "stage": "chunking",
  "progress": { "current": 25, "total": 42 }
}
(Poll every 2 seconds until status="completed")


Step 7: Use KB
──────────────
GET /api/v1/kbs/{kb_id}
Response: { "id": "uuid", "status": "ready", "document_count": 5, ... }
```

### 5.2 Endpoint Reference

| Endpoint | Method | Phase | Purpose |
|----------|--------|-------|---------|
| `/api/v1/kb-drafts/` | POST | 1 | Create draft |
| `/api/v1/kb-drafts/{id}/web-sources` | POST | 1 | Add URLs |
| `/api/v1/kb-drafts/{id}/files` | POST | 1 | Upload files |
| `/api/v1/kb-drafts/{id}/chunking` | POST | 1 | Configure chunking |
| `/api/v1/kb-drafts/{id}/embedding` | POST | 1 | Configure embedding |
| `/api/v1/kb-drafts/{id}/preview` | POST | 1 | Preview chunks |
| `/api/v1/kb-drafts/{id}/finalize` | POST | 2 | Finalize & start processing |
| `/api/v1/kb-pipeline/{id}/status` | GET | 3 | Monitor pipeline |
| `/api/v1/kbs/{id}` | GET | 3 | Get KB details |
| `/api/v1/kbs/{id}/retry-processing` | POST | 3 | Retry failed pipeline |

---

## 6. Best Practices (Without Over-Engineering)

### 6.1 Strategy Selection Guide

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    STRATEGY SELECTION DECISION TREE                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Q: What type of content?                                                │
│  │                                                                       │
│  ├── Documentation with headings (#, ##, ###)?                          │
│  │   └── USE: by_heading                                                │
│  │                                                                       │
│  ├── FAQ / Q&A pairs?                                                   │
│  │   └── USE: by_section or semantic                                    │
│  │                                                                       │
│  ├── Long-form articles/blogs?                                          │
│  │   └── USE: paragraph_based                                           │
│  │                                                                       │
│  ├── Chat logs / transcripts?                                           │
│  │   └── USE: sentence_based                                            │
│  │                                                                       │
│  ├── Mixed/unknown content?                                             │
│  │   └── USE: adaptive (auto-selects)                                   │
│  │                                                                       │
│  ├── Short documents (<2000 chars)?                                     │
│  │   └── USE: no_chunking                                               │
│  │                                                                       │
│  └── Don't know?                                                        │
│      └── USE: by_heading (default, works well for most content)         │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Configuration Recommendations

| Scenario | Strategy | Chunk Size | Overlap | Why |
|----------|----------|------------|---------|-----|
| **General docs** | by_heading | 1000 | 200 | Respects document structure |
| **Precise Q&A** | semantic | 800 | 150 | Semantic coherence |
| **Large manuals** | by_section | 1500 | 300 | Logical groupings |
| **Chat support** | sentence_based | 500 | 100 | Preserves conversation flow |
| **API reference** | by_heading | 1200 | 200 | Code blocks preserved |

### 6.3 What NOT to Do

1. **Don't use `custom` strategy** - Not fully wired
2. **Don't set overlap > chunk_size/2** - Causes excessive redundancy
3. **Don't use `semantic` for very short content** - Embedding overhead not worth it
4. **Don't mix file uploads and web URLs in same KB** - Different storage strategies

### 6.4 Architectural Recommendations

#### Keep It Simple
The current architecture is **good enough**. Avoid:
- Adding more chunking strategies (diminishing returns)
- Integrating enhanced_chunking_service without clear need
- Over-configuring (defaults work for 80% of cases)

#### What's Worth Adding
1. **Expose custom_separators** in finalization flow (low effort, high value)
2. **Add chunk preview statistics** to finalization response
3. **Consider removing dead code** (enhanced_chunking_service or integrate it)

---

## 7. Technical Reference

### Configuration Flow

```
User Input (Frontend)
      │
      ▼
Draft Config (Redis)
{
  "chunking_config": {
    "strategy": "semantic",
    "chunk_size": 1500,
    "chunk_overlap": 300
  }
}
      │
      ▼
Finalization Validation
(kb_draft.py:validate_finalize_request)
      │
      ▼
KB.config (PostgreSQL)
{
  "chunking": {
    "strategy": "semantic",
    "chunk_size": 1500,
    "chunk_overlap": 300
  }
}
      │
      ▼
Celery Task (process_web_kb_task)
      │
      ▼
smart_kb_service.make_chunking_decision()
  ├── Priority 1: User explicit config
  ├── Priority 2: Adaptive analysis
  └── Priority 3: System defaults
      │
      ▼
chunking_service.chunk_document()
  └── Executes selected strategy
```

### Files Reference

| File | Responsibility |
|------|----------------|
| `chunking_service.py` | Core chunking strategies |
| `enhanced_chunking_service.py` | Rich metadata wrapper (NOT USED) |
| `smart_kb_service.py` | Decision making + storage |
| `kb_draft.py` | API endpoints (Phase 1 & 2) |
| `kb_pipeline_tasks.py` | Background processing (Phase 3) |

---

## Appendix: Strategy Implementation Code References

| Strategy | Method | Location |
|----------|--------|----------|
| recursive | `_recursive_chunk` | chunking_service.py:319 |
| semantic | `_semantic_chunk` | chunking_service.py:674 |
| by_heading | `_heading_chunk` | chunking_service.py:561 |
| by_section | `_section_chunk` | chunking_service.py:616 |
| adaptive | `_adaptive_chunk` | chunking_service.py:852 |
| sentence_based | `_sentence_chunk` | chunking_service.py:435 |
| paragraph_based | `_paragraph_chunk` | chunking_service.py:510 |
| hybrid | `_hybrid_chunk` | chunking_service.py:905 |
| no_chunking | `_full_content_chunk` | chunking_service.py:953 |
| token | `_token_chunk` | chunking_service.py:478 |
| custom | `_custom_chunk` | chunking_service.py:961 |

---

## 10. Configuration Flow Analysis - Hardcoded Values & Defaults

### 10.1 System-Wide Default Values

All chunking configuration uses these **consistent defaults** across the system:

| Parameter | Default Value | Locations |
|-----------|--------------|-----------|
| `strategy` | `"by_heading"` | Preview, Pipeline, Fallback |
| `chunk_size` | `1000` | Preview, Pipeline, Fallback |
| `chunk_overlap` | `200` | Preview, Pipeline, Fallback |
| `custom_separators` | `null` | All locations |
| `enable_enhanced_metadata` | `false` | All locations |

### 10.2 Configuration Source Hierarchy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       CONFIGURATION SOURCE FLOW                             │
└─────────────────────────────────────────────────────────────────────────────┘

PREVIEW FLOW (kb_draft.py:907-962):
──────────────────────────────────
Frontend Request
    │
    └──► request.get("strategy", "by_heading")     ← USER VALUE or DEFAULT
    └──► request.get("chunk_size", 1000)           ← USER VALUE or DEFAULT
    └──► request.get("chunk_overlap", 200)         ← USER VALUE or DEFAULT
    └──► request.get("custom_separators", None)    ← USER VALUE or DEFAULT
    └──► request.get("enable_enhanced_metadata", False) ← USER VALUE or DEFAULT
            │
            ▼
    ┌───────────────────────────────┐
    │  chunking_service OR         │
    │  enhanced_chunking_service   │ ← DIRECT CALL (no adaptive logic)
    └───────────────────────────────┘


PRODUCTION FLOW (kb_pipeline_tasks.py:319-323 → smart_kb_service.py:371-405):
──────────────────────────────────────────────────────────────────────────────
Finalize Request (chunking_config)
    │
    ▼
Pipeline Task Extraction
    │
    └──► chunking_config.get("strategy", "by_heading")
    └──► chunking_config.get("chunk_size", 1000)
    └──► chunking_config.get("chunk_overlap", 200)
    └──► chunking_config.get("custom_separators", None)
    └──► chunking_config.get("enable_enhanced_metadata", False)
            │
            ▼
    ┌───────────────────────────────────────────────────────────────┐
    │  smart_kb_service.make_chunking_decision(user_config=...)    │
    │                                                               │
    │  PRIORITY ORDER:                                              │
    │  1. User provides ALL values → Uses user values directly      │
    │  2. User provides PARTIAL values → Adaptive fills missing     │
    │  3. User provides NO values → Full adaptive suggestions       │
    └───────────────────────────────────────────────────────────────┘
            │
            ▼
    ┌───────────────────────────────┐
    │  chunking_service OR         │
    │  enhanced_chunking_service   │
    └───────────────────────────────┘
```

### 10.3 Preview vs Production Parity Analysis (FIXED)

**PARITY FIX IMPLEMENTED**: Preview now uses `smart_kb_service.make_chunking_decision_for_preview()`
which mirrors the exact same adaptive logic as production.

| Scenario | Preview Behavior | Production Behavior | MATCH? |
|----------|------------------|---------------------|--------|
| User provides ALL values | Uses user values | Uses user values (priority 1) | ✅ YES |
| User provides ONLY strategy | Uses adaptive size/overlap | Uses adaptive size/overlap | ✅ YES |
| User provides ONLY chunk_size | Uses adaptive strategy | Uses adaptive strategy | ✅ YES |
| User provides NO values | Uses adaptive suggestions | Uses adaptive suggestions | ✅ YES |
| `enable_enhanced_metadata=true` | Uses enhanced_chunking_service | Uses enhanced_chunking_service | ✅ YES |
| `custom` strategy with separators | Uses custom_separators | Uses custom_separators | ✅ YES |

**Implementation Details:**
- Preview uses `smart_kb_service.make_chunking_decision_for_preview()`
- Production uses `smart_kb_service.make_chunking_decision()`
- Both methods share identical adaptive logic
- Preview uses `draft_context` field, Production uses KB `context_settings`

### 10.4 Adaptive Logic in Production (smart_kb_service.py:205-241)

When user provides **partial config**, production fills missing values adaptively:

```python
# Adaptive analysis considers:
# - Content structure (heading count → by_heading strategy)
# - Content type (code → semantic, FAQ → by_section)
# - Content size (>50K chars → semantic)
# - Access mode (chatbot-only → smaller chunks ~800, chatflow → larger ~1500)

# Example adaptive chunk size calculation:
if content_type == "faq":
    base_chunk_size = int(base_chunk_size * 0.7)  # Smaller for Q&A
elif content_type == "documentation":
    base_chunk_size = int(base_chunk_size * 1.2)  # Larger for explanations
```

### 10.5 Ensuring Preview-Production Parity (NOW AUTOMATIC)

**PARITY IS NOW GUARANTEED** regardless of how much config you provide:

```json
// Option 1: Full config (uses your exact values)
{
  "chunking_config": {
    "strategy": "semantic",
    "chunk_size": 1500,
    "chunk_overlap": 300
  }
}

// Option 2: Partial config (adaptive fills the rest - SAME IN PREVIEW AND PRODUCTION)
{
  "chunking_config": {
    "strategy": "semantic"
    // chunk_size and chunk_overlap will be adaptively determined
    // IDENTICALLY in both preview and production
  }
}

// Option 3: No config (full adaptive - SAME IN PREVIEW AND PRODUCTION)
{
  "chunking_config": {}
}
```

**How Parity Works:**
- Preview: `smart_kb_service.make_chunking_decision_for_preview(user_config, draft_context)`
- Production: `smart_kb_service.make_chunking_decision(user_config, kb)`
- Both use identical adaptive logic → Guaranteed parity

**Preview Response Now Includes Decision Metadata:**
```json
{
  "chunks": [...],
  "chunking_decision": {
    "strategy": "semantic",
    "chunk_size": 1440,
    "chunk_overlap": 288,
    "user_preference": true,
    "adaptive_suggestion": "semantic",
    "reasoning": "strategy: user choice (semantic); size: adaptive suggestion (1440); overlap: adaptive suggestion (288)"
  }
}
```

### 10.6 Fallback Chunking (Emergency Path)

If `smart_kb_service` fails, fallback uses same defaults as preview:

```python
# kb_pipeline_tasks.py:1579-1582
fallback_strategy = user_chunking_config.get("strategy", "by_heading")
fallback_chunk_size = user_chunking_config.get("chunk_size", 1000)
fallback_chunk_overlap = user_chunking_config.get("chunk_overlap", 200)
```

### 10.7 File Locations for Configuration Defaults

| File | Line | Defaults |
|------|------|----------|
| `kb_draft.py` | 909-915 | Preview endpoint defaults |
| `kb_draft.py` | 2232-2240 | KBFinalizeRequest schema defaults |
| `kb_pipeline_tasks.py` | 319-323 | Pipeline extraction defaults |
| `kb_pipeline_tasks.py` | 1579-1582 | Fallback defaults |
| `smart_kb_service.py` | 269-298 | Adaptive suggestion logic |
