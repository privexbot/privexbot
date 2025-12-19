# Wire retrieval_config to Retrieval Service

## Task Overview

**Status**: ✅ **IMPLEMENTED**

**What**: Connect the KB-level `retrieval_config` settings to the actual retrieval service so that search operations use the KB's configured parameters instead of hardcoded defaults.

**Why**: Previously, there was a configuration gap:
- Users configure `retrieval_config` during KB creation (via `/kb-drafts/{id}/model-config`)
- This config is stored in `kb.context_settings.retrieval_config`
- BUT the retrieval service ignored these settings and used hardcoded defaults

**Result (Before)**: KB-level search settings had no effect. All KBs searched the same way regardless of configuration.

**Result (After)**: KB-level search settings are now applied. Each KB can have different search behavior based on its `retrieval_config`.

---

## The Configuration Gap

### What Users Configure (Frontend)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     MODEL & RETRIEVAL CONFIGURATION                         │
│                     kb_draft.py:2134-2140                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  retrieval_config: {                                                        │
│      "strategy": "semantic_search" | "hybrid_search" | "keyword_search",    │
│      "top_k": 5,                   ← Number of chunks to retrieve           │
│      "score_threshold": 0.7,       ← Minimum similarity score               │
│      "rerank_enabled": false,      ← Enable reranking                       │
│      "metadata_filters": {}        ← Filter by metadata                     │
│  }                                                                          │
│                                                                             │
│  ↓ STORED IN                                                                │
│                                                                             │
│  kb.context_settings = {                                                    │
│      "access_mode": "all",                                                  │
│      "retrieval_config": { ... }   ← STORED BUT NEVER USED                  │
│  }                                                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### What Retrieval Service Currently Uses

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         RETRIEVAL SERVICE                                   │
│                   retrieval_service.py:47-58                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  async def search(                                                          │
│      self,                                                                  │
│      db: Session,                                                           │
│      kb_id: UUID,                                                           │
│      query: str,                                                            │
│      top_k: int = 5,              ← HARDCODED DEFAULT                       │
│      search_method: str = "hybrid", ← HARDCODED DEFAULT                     │
│      threshold: float = 0.7,       ← HARDCODED DEFAULT                      │
│      apply_annotation_boost: bool = True,                                   │
│      context_filter: str = None                                             │
│  )                                                                          │
│                                                                             │
│  The service DOES load the KB:                                              │
│      kb = db.query(KnowledgeBase).get(kb_id)                               │
│                                                                             │
│  BUT it only uses kb.config for embedding model:                            │
│      model = kb.config.get("embedding_model", "text-embedding-ada-002")     │
│                                                                             │
│  IT NEVER reads kb.context_settings.retrieval_config!                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Callers Currently Pass Their Own Values

**1. Chatbot Service (chatbot_service.py:213-217)**
```python
# Gets from chatbot's override config, NOT KB's retrieval_config
retrieval_settings = kb_config.get("override_retrieval", {})
top_k = retrieval_settings.get("top_k", 5)                    # Default 5
search_method = retrieval_settings.get("search_method", "hybrid")  # Default hybrid
threshold = retrieval_settings.get("similarity_threshold", 0.7)    # Default 0.7
```

**2. KB Node - Chatflows (kb_node.py:87-89)**
```python
# Gets from node config, NOT KB's retrieval_config
top_k=self.config.get("top_k", 5),
search_method=self.config.get("search_method", "hybrid"),
threshold=self.config.get("threshold", 0.7)
```

---

## The Solution

### Configuration Priority Chain

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    RETRIEVAL CONFIG PRIORITY                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  HIGHEST PRIORITY                                                           │
│     │                                                                       │
│     ▼                                                                       │
│  ┌────────────────────────────────────────────────┐                        │
│  │ 1. Caller Override (explicit parameter)        │                        │
│  │    e.g., chatbot.config.override_retrieval     │                        │
│  │    or node.config in chatflow                  │                        │
│  └────────────────────────────────────────────────┘                        │
│     │                                                                       │
│     ▼                                                                       │
│  ┌────────────────────────────────────────────────┐                        │
│  │ 2. KB-Level Config (retrieval_config)          │   ← NEW: Wire this!    │
│  │    kb.context_settings.retrieval_config        │                        │
│  └────────────────────────────────────────────────┘                        │
│     │                                                                       │
│     ▼                                                                       │
│  ┌────────────────────────────────────────────────┐                        │
│  │ 3. Service Defaults (hardcoded)                │                        │
│  │    top_k=5, threshold=0.7, method="hybrid"     │                        │
│  └────────────────────────────────────────────────┘                        │
│     │                                                                       │
│     ▼                                                                       │
│  LOWEST PRIORITY                                                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Plan

### Option A: Retrieval Service Reads KB Config (Recommended)

Modify `retrieval_service.search()` to read KB's `context_settings.retrieval_config` and use as defaults:

```python
# retrieval_service.py

async def search(
    self,
    db: Session,
    kb_id: UUID,
    query: str,
    top_k: int = None,              # None = use KB config
    search_method: str = None,      # None = use KB config
    threshold: float = None,        # None = use KB config
    apply_annotation_boost: bool = True,
    context_filter: str = None
) -> List[dict]:

    # Get KB
    kb = db.query(KnowledgeBase).get(kb_id)
    if not kb:
        raise ValueError("Knowledge base not found")

    # NEW: Get KB-level retrieval config
    kb_retrieval_config = kb.context_settings.get("retrieval_config", {}) if kb.context_settings else {}

    # Apply priority chain: caller > kb_config > service_default
    effective_top_k = top_k or kb_retrieval_config.get("top_k", 5)
    effective_threshold = threshold or kb_retrieval_config.get("score_threshold", 0.7)
    effective_search_method = search_method or self._map_strategy_to_method(
        kb_retrieval_config.get("strategy", "hybrid_search")
    )

    # ... rest of search logic using effective_* values
```

**Strategy Mapping** (frontend uses different naming):
```python
def _map_strategy_to_method(self, strategy: str) -> str:
    """Map frontend strategy names to internal search methods"""
    mapping = {
        "semantic_search": "vector",
        "hybrid_search": "hybrid",
        "keyword_search": "keyword",
        "mmr": "vector",  # MMR uses vector with diversity
        "similarity_score_threshold": "vector"
    }
    return mapping.get(strategy, "hybrid")
```

### Option B: SmartKBService Middleware

Use existing `SmartKBService.get_access_control_info()` which already extracts `retrieval_config`:

```python
# In chatbot_service.py or kb_node.py

from app.services.smart_kb_service import smart_kb_service

# Get KB with access control and retrieval config
access_info = smart_kb_service.get_access_control_info(kb)
kb_retrieval_config = access_info.retrieval_config

# Pass to retrieval service
results = await retrieval_service.search(
    db=db,
    kb_id=kb_id,
    query=query,
    top_k=kb_retrieval_config.get("top_k", 5),
    search_method=_map_strategy_to_method(kb_retrieval_config.get("strategy")),
    threshold=kb_retrieval_config.get("score_threshold", 0.7)
)
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `retrieval_service.py` | Read `kb.context_settings.retrieval_config`, apply priority chain |
| `chatbot_service.py` | Uncomment retrieval_service calls, pass None for KB-controlled params |
| `kb_node.py` | Optionally load KB config if node config doesn't override |
| `smart_kb_service.py` | Already extracts retrieval_config (no changes needed) |

---

## Configuration Schema Alignment

**Current Frontend Schema** (kb_draft.py):
```python
retrieval_config: {
    "strategy": "semantic_search" | "hybrid_search" | "keyword_search",
    "top_k": 5,
    "score_threshold": 0.7,
    "rerank_enabled": false,
    "metadata_filters": {}
}
```

**Current Backend Expectations** (retrieval_service.py):
```python
top_k: int
search_method: "vector" | "keyword" | "hybrid"
threshold: float
```

**Mapping Required**:
- `strategy` → `search_method` (with mapping)
- `score_threshold` → `threshold`
- `top_k` → `top_k` (same)
- `rerank_enabled` → NEW (not yet supported)
- `metadata_filters` → NEW (not yet supported)

---

## Test Cases

1. **KB Config Applied**: Create KB with `top_k=3`, verify retrieval returns max 3 results
2. **Caller Override**: Create KB with `top_k=3`, call with `top_k=10`, verify 10 results
3. **Strategy Mapping**: Test each strategy maps to correct search method
4. **Default Fallback**: KB with no retrieval_config uses service defaults
5. **Threshold Applied**: KB with `score_threshold=0.9` filters more results

---

## Benefits After Wiring

1. **Per-KB Configuration**: Each KB can have different search behavior
2. **User Control**: Users' frontend settings actually take effect
3. **Chatbot Override**: Chatbots can still override for specific use cases
4. **Future Features**: Reranking and metadata filters can be added later

---

## Summary

**Before Implementation**:
```
User configures → Stored in DB → IGNORED → Hardcoded defaults used
```

**After Implementation (✅ DONE)**:
```
User configures → Stored in DB → LOADED by retrieval service → Applied to search
                              ↑
                              └── Unless caller explicitly overrides
```

---

## Implementation Complete

### Files Modified

| File | Changes |
|------|---------|
| `retrieval_service.py` | Added `_get_effective_config()`, `_map_strategy_to_method()`, reads `kb.context_settings.retrieval_config` |
| `chatbot_service.py` | Added `retrieval_service` import, uncommented search calls, passes `None` for KB-controlled params |
| `kb_node.py` | Uses `None` defaults to let KB config take effect when node config not specified |
| `kb_draft_service.py` | Wires `data["retrieval_config"]` into `context_settings` during finalization |

### Key Changes

1. **retrieval_service.py**:
   - Parameters now accept `Optional` (None = use KB config)
   - Added `_get_effective_config()` for priority chain logic
   - Added `_map_strategy_to_method()` for frontend/backend naming translation
   - Logs config resolution for debugging

2. **chatbot_service.py**:
   - Imported and uses `retrieval_service`
   - Passes chatbot override values if specified, `None` otherwise
   - Error handling for KB retrieval failures

3. **kb_node.py**:
   - Passes `None` for unspecified node config values
   - Lets KB config take effect when node doesn't override

4. **kb_draft_service.py**:
   - Merges `data["retrieval_config"]` into `final_context_settings`
   - Ensures retrieval_config is available at `kb.context_settings.retrieval_config`

### Configuration Priority Chain (Implemented)

```
1. Caller Override (explicit parameter)     ← Highest priority
   ↓
2. KB Config (kb.context_settings.retrieval_config)
   ↓
3. Service Defaults (top_k=5, threshold=0.7, method=hybrid)  ← Lowest priority
```

### Strategy Name Mapping (Implemented)

| Frontend Strategy | Internal Method |
|-------------------|-----------------|
| `semantic_search` | `vector` |
| `hybrid_search` | `hybrid` |
| `keyword_search` | `keyword` |
| `mmr` | `vector` |
| `similarity_score_threshold` | `vector` |

### Additional Improvements (Session 2)

**1. Config Validation (`validate_retrieval_config()`)**:
```python
RETRIEVAL_CONFIG_CONSTRAINTS = {
    "top_k": {"min": 1, "max": 100, "type": int},
    "score_threshold": {"min": 0.0, "max": 1.0, "type": float},
    "strategy": {"allowed": ["semantic_search", "hybrid_search", "keyword_search", "mmr"], "type": str}
}
```
- Type checking (wrong types are skipped)
- Range validation (clamped to min/max)
- Allowed values validation (invalid values skipped)

**2. Option A Storage Support (Qdrant-only)**:
- `_is_qdrant_only_storage()` helper to detect storage type
- `text_search()` method in Qdrant for keyword search fallback
- `hybrid_text_vector_search()` for combined search in Qdrant
- All search methods now work with Option A (file uploads)

**3. Bug Fixes**:
- Fixed `chunk.metadata` → `chunk.chunk_metadata` for PostgreSQL fallback
- Fixed import from pseudocode `embedding_service` → `embedding_service_local`
- Fixed `generate_embedding()` call to not pass unused `model` parameter
- Removed unused `vector_store_service` import

### Test Results (Verified)

```
TEST SUMMARY
  option_a_retrieval: ✅ PASS
  config_application: ✅ PASS
  validation: ✅ PASS

Config Resolution Log:
  top_k: 3 (from caller)
  search_method: vector (from kb_config)
  threshold: 0.1 (from caller)

Retrieved 1 result with storage=qdrant_only
```
