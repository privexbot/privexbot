# Knowledge Base Retrieval Configuration Guide

This comprehensive guide covers all retrieval configuration options in PrivexBot, their impact on search quality, and best practices for different use cases.

---

## Table of Contents

1. [Overview](#overview)
2. [Configuration Architecture](#configuration-architecture)
3. [Retrieval Strategies](#retrieval-strategies)
4. [Configuration Parameters](#configuration-parameters)
5. [Enhanced Search Features](#enhanced-search-features)
6. [Confidence Scoring](#confidence-scoring)
7. [Best Practices by Use Case](#best-practices-by-use-case)
8. [Frontend Configuration](#frontend-configuration)
9. [Performance Tuning](#performance-tuning)
10. [Troubleshooting](#troubleshooting)

---

## Overview

### What is Retrieval Configuration?

Retrieval configuration controls how your Knowledge Base searches and returns relevant content when users ask questions. It determines:

- **Which search algorithm** to use (semantic, keyword, hybrid)
- **How many results** to return (top_k)
- **Minimum quality threshold** for results (score_threshold)
- **Post-processing options** like reranking

### The Retrieval Pipeline

```
User Query
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│                    EMBEDDING SERVICE                             │
│  Convert query to 384-dimensional vector                         │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│                    RETRIEVAL SERVICE                             │
│  ────────────────────────────────────────────────────────────── │
│  1. Apply search strategy (vector, keyword, hybrid)              │
│  2. Filter by score threshold                                    │
│  3. Apply annotation boosting                                    │
│  4. Limit to top_k results                                       │
│  5. Fetch metadata from storage                                  │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ENHANCED SEARCH (Optional)                    │
│  ────────────────────────────────────────────────────────────── │
│  • Calculate confidence scores                                   │
│  • Adaptive ranking by strategy                                  │
│  • Generate reasoning explanations                               │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
Retrieved Chunks with Scores
```

### Key Files

| Component | File Path |
|-----------|-----------|
| Retrieval Service | `backend/src/app/services/retrieval_service.py` |
| Enhanced Search Service | `backend/src/app/services/enhanced_search_service.py` |
| Qdrant Service | `backend/src/app/services/qdrant_service.py` |
| Config Schema | `backend/src/app/schemas/config.py` |
| Frontend Config UI | `frontend/src/pages/knowledge-bases/create.tsx` |
| Test Search Component | `frontend/src/components/kb/KBTestSearch.tsx` |

---

## Configuration Architecture

### Three-Level Priority System

PrivexBot uses a hierarchical configuration system where more specific settings override general defaults:

```
┌─────────────────────────────────────────────────────────────────┐
│  LEVEL 1: Caller Override (Highest Priority)                    │
│  • Parameters passed directly to search API                      │
│  • Overrides everything below                                    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  LEVEL 2: KB-Level Config                                        │
│  • Stored in kb.context_settings.retrieval_config                │
│  • Set during KB creation (Step 6: Retrieval)                    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  LEVEL 3: Service Defaults (Lowest Priority)                     │
│  • top_k: 5                                                      │
│  • strategy: hybrid                                              │
│  • score_threshold: 0.7                                          │
└─────────────────────────────────────────────────────────────────┘
```

### Configuration Storage

KB retrieval config is stored in the `context_settings` JSON field:

```json
{
  "access_mode": "all",
  "retrieval_config": {
    "strategy": "hybrid_search",
    "top_k": 10,
    "score_threshold": 0.7,
    "rerank_enabled": false,
    "include_metadata": true
  },
  "allowed_chatbots": [],
  "allowed_chatflows": []
}
```

---

## Retrieval Strategies

### Available Strategies

PrivexBot supports 5 core retrieval strategies plus 4 enhanced search strategies:

#### Core Strategies (KB Configuration)

| Strategy | Algorithm | Best For | Speed |
|----------|-----------|----------|-------|
| `semantic_search` | Pure vector similarity | Conceptual queries, "related to" questions | Fast |
| `keyword_search` | Full-text search | Exact terms, names, codes | Fastest |
| `hybrid_search` | 70% vector + 30% keyword | General use (Recommended) | Moderate |
| `mmr` | Maximal Marginal Relevance | Diverse results, avoiding redundancy | Slower |
| `similarity_score_threshold` | Vector with hard cutoff | High-precision requirements | Fast |

#### Enhanced Search Strategies (Test KB & API)

| Strategy | Behavior | Best For |
|----------|----------|----------|
| `adaptive` | Auto-selects based on query/KB | Default, works for any scenario |
| `hybrid` | Combined semantic + keyword | General balanced retrieval |
| `precise` | Prioritizes FAQ, direct answers | Chatbots, customer support |
| `contextual` | Broader context gathering | Chatflows, multi-step reasoning |

### Strategy Deep Dives

#### Semantic Search (`semantic_search`)

Uses vector similarity to find conceptually related content, even without matching keywords.

**How It Works:**
```
Query: "How do I reset my password?"
                    │
                    ▼
        Convert to 384-dim vector
                    │
                    ▼
        Cosine similarity search in Qdrant
                    │
                    ▼
        Results: "Forgot Password Guide" (0.89)
                 "Account Recovery Steps" (0.85)
                 "Login Troubleshooting" (0.78)
```

**When to Use:**
- Users ask questions in natural language
- Content uses different terminology than users
- Conceptual understanding matters more than exact matches

**When to Avoid:**
- Looking for specific product codes or IDs
- Need exact phrase matching
- Content is highly technical with precise terminology

#### Keyword Search (`keyword_search`)

PostgreSQL full-text search (or Qdrant text search for Qdrant-only storage).

**How It Works:**
```
Query: "API key authentication"
                    │
                    ▼
        Tokenize and stem query words
                    │
                    ▼
        Full-text search with ranking
                    │
                    ▼
        Results: All chunks containing "API", "key", "authentication"
```

**Characteristics:**
- Returns fixed score of 0.8 for all matches (no relevance ranking)
- Faster than vector search
- Best for exact term lookup

**When to Use:**
- Searching for specific terms, codes, or names
- Content is highly structured with consistent terminology
- Performance is critical

#### Hybrid Search (`hybrid_search`) - RECOMMENDED

Combines vector and keyword search with weighted score fusion.

**Algorithm:**
```python
# Score calculation
final_score = (vector_score * 0.7) + (keyword_score * 0.3)

# Boost for appearing in both
if result_in_both_searches:
    final_score *= 1.1  # 10% boost
```

**How It Works:**
```
Query: "reset password API"
           │
           ├──────────────┬──────────────┐
           ▼              ▼              ▼
      Vector Search   Keyword Search   Combine
           │              │              │
           ▼              ▼              ▼
      Semantic       Exact matches   Weighted
      matches        for "API"       fusion
           │              │              │
           └──────────────┴──────────────┘
                          │
                          ▼
                Final Ranked Results
```

**When to Use:**
- General-purpose Knowledge Bases
- Mixed content types
- Unknown query patterns
- **DEFAULT CHOICE for most use cases**

#### MMR (Maximal Marginal Relevance)

Balances relevance with diversity to avoid redundant results.

**How It Works:**
1. Get top candidates by vector similarity
2. For each subsequent result:
   - Penalize if too similar to already-selected results
   - Select result that maximizes relevance while minimizing redundancy

**When to Use:**
- Content has many similar/overlapping chunks
- Need diverse perspectives on a topic
- Avoid returning near-duplicate information

#### Similarity Score Threshold

Vector search with a hard score cutoff.

**Behavior:**
- Performs vector search
- Drops ALL results below threshold (not configurable per-query)
- Returns only high-confidence matches

**When to Use:**
- High-precision requirements (medical, legal)
- Prefer returning nothing over low-quality results
- Quality over quantity

---

## Configuration Parameters

### Top K (top_k)

**Definition:** Maximum number of chunks to return.

**Range:** 1-100 (UI limits: Create page 1-50, Test Search 1-20)

**Default:** 10 (create page), 5 (service default)

**Impact on Results:**

| Top K | Pros | Cons | Best For |
|-------|------|------|----------|
| **1-3** | Most relevant only | May miss context | Simple Q&A bots |
| **5-10** | Good balance | Moderate token usage | General chatbots |
| **10-20** | Rich context | Higher latency, cost | Complex analysis |
| **20+** | Comprehensive | Noise, high cost | Research, aggregation |

**Recommendations:**
- **Chatbots:** 5-10 results
- **Chatflows:** 10-15 results (multiple processing steps)
- **API integrations:** Start with 5, adjust based on needs

### Score Threshold (score_threshold)

**Definition:** Minimum similarity score (0-1) for a result to be included.

**Default:** 0.7

**Impact on Results:**

| Threshold | Filter Behavior | Best For |
|-----------|-----------------|----------|
| **0.5-0.6** | Permissive, more results | Exploratory search, broad context |
| **0.7** | Balanced (Default) | General use |
| **0.8-0.85** | Strict, fewer results | High-precision requirements |
| **0.9+** | Very strict | Only exact/near-exact matches |

**Visual Impact:**
```
Threshold 0.5: ████████████████████ (20 results)
Threshold 0.7: ████████████ (12 results)
Threshold 0.8: ████████ (8 results)
Threshold 0.9: ███ (3 results)
```

**Recommendations:**
- **FAQ/Support:** 0.7-0.8 (need reliable answers)
- **Research/Analysis:** 0.5-0.6 (want broader context)
- **Legal/Medical:** 0.85+ (precision critical)

### Rerank Enabled (rerank_enabled)

**Definition:** Flag to enable post-retrieval reranking.

**Default:** false

**Current Status:** Recognized but not actively implemented. Future feature for cross-encoder reranking.

**Planned Behavior:**
1. Retrieve initial candidates
2. Score each with cross-encoder model
3. Re-order by cross-encoder scores

### Include Metadata (include_metadata)

**Definition:** Whether to return chunk metadata with results.

**Default:** true

**Metadata Included:**
```json
{
  "chunk_id": "uuid",
  "document_id": "uuid",
  "document_name": "FAQ.pdf",
  "page": 12,
  "content_type": "faq",
  "strategy_used": "by_heading",
  "annotations": {...},
  "page_url": "https://..."
}
```

---

## Enhanced Search Features

### Overview

The Enhanced Search Service adds intelligent features on top of basic retrieval:

```
Basic Retrieval (retrieval_service)
         │
         ▼
Enhanced Features (enhanced_search_service)
  • Confidence scoring
  • Adaptive strategy selection
  • Content type weighting
  • Human-readable reasoning
```

### Search Strategy Selection

When using `adaptive` strategy, the system automatically selects:

```
Query Analysis
      │
      ├─ Has question words (what, how, why)?
      │       └─> PRECISE (for chatbots)
      │
      ├─ KB Purpose = CHATBOT?
      │       └─> PRECISE
      │
      ├─ KB Purpose = CHATFLOW?
      │       └─> CONTEXTUAL
      │
      └─ Otherwise
              └─> HYBRID
```

### Requester Type Impact

| Requester Type | Preferred Strategy | Behavior |
|----------------|-------------------|----------|
| `chatbot` | PRECISE | Prioritizes direct answers, FAQ content |
| `chatflow` | CONTEXTUAL | Broader context, documentation |
| `api` | HYBRID | Balanced approach |

---

## Confidence Scoring

### Multi-Factor Algorithm

Enhanced search calculates confidence scores using multiple factors:

```
confidence = min(1.0,
    base_score
    × content_type_weight
    × strategy_weight
    × query_alignment_boost
    × strategy_boost
)
```

### Content Type Weights

| Content Type | Weight | Effect |
|--------------|--------|--------|
| FAQ | 1.3x | 30% boost |
| Code | 1.2x | 20% boost |
| Documentation | 1.1x | 10% boost |
| Article | 1.0x | Neutral |
| Mixed | 0.9x | 10% penalty |

### Chunking Strategy Weights

| Strategy | Weight | Reason |
|----------|--------|--------|
| by_heading | 1.2x | Well-structured content |
| semantic | 1.1x | Related content grouped |
| by_section | 1.0x | Standard sectioning |
| adaptive | 1.0x | Neutral |
| recursive | 0.9x | Basic chunking |

### Query Alignment Detection

The system detects when query intent matches content type:

| Query Indicators | Content Match | Boost |
|------------------|---------------|-------|
| how, what, why, can i, ? | FAQ | 1.2x |
| install, configure, setup, guide | Documentation | 1.2x |
| function, method, class, example | Code | 1.2x |

### Confidence Thresholds

| Score | Label | Meaning |
|-------|-------|---------|
| > 0.8 | High | Strong match, reliable answer |
| 0.6-0.8 | Medium | Good match, likely relevant |
| < 0.6 | Low | Potential match, verify carefully |

### Example Confidence Calculation

**Query:** "How do I install the SDK?"
**Content Type:** Documentation
**Chunking Strategy:** by_heading
**Base Score:** 0.82

```
Calculation:
  Base: 0.82
  × Content (documentation): 1.1
  × Strategy (by_heading): 1.2
  × Alignment (install in docs): 1.2
  × Strategy boost: 1.0
  = 1.30 → capped at 1.0

Result: Confidence = 1.0 (HIGH)
```

---

## Best Practices by Use Case

### Customer Support Chatbot

**Scenario:** FAQ-heavy, need direct answers

```json
{
  "strategy": "hybrid_search",
  "top_k": 5,
  "score_threshold": 0.75,
  "rerank_enabled": false
}
```

**Why:**
- Lower top_k = focused answers
- Higher threshold = only confident matches
- Hybrid catches both semantic and keyword queries

**Enhanced Search:** Use `precise` strategy for test searches.

### Technical Documentation Bot

**Scenario:** API docs, installation guides, code examples

```json
{
  "strategy": "hybrid_search",
  "top_k": 10,
  "score_threshold": 0.7,
  "rerank_enabled": false
}
```

**Why:**
- More results for technical depth
- Standard threshold for balance
- Hybrid handles both conceptual and exact queries

**Enhanced Search:** Use `contextual` for broader understanding.

### Legal/Compliance KB

**Scenario:** Precision critical, prefer no answer over wrong answer

```json
{
  "strategy": "semantic_search",
  "top_k": 3,
  "score_threshold": 0.85,
  "rerank_enabled": false
}
```

**Why:**
- Pure semantic for conceptual matching
- Very low top_k = only best matches
- High threshold = strict quality gate

### Research/Analysis KB

**Scenario:** Need comprehensive context, exploring topics

```json
{
  "strategy": "hybrid_search",
  "top_k": 20,
  "score_threshold": 0.55,
  "rerank_enabled": false
}
```

**Why:**
- High top_k for comprehensive coverage
- Low threshold to capture related content
- MMR could also work well here for diversity

### Multi-Language KB

**Scenario:** Content in multiple languages

```json
{
  "strategy": "semantic_search",
  "top_k": 10,
  "score_threshold": 0.65,
  "rerank_enabled": false
}
```

**Why:**
- Semantic search handles cross-lingual similarity
- Lower threshold for language variations
- Keyword search may miss translations

### Product Catalog KB

**Scenario:** Product names, SKUs, specifications

```json
{
  "strategy": "hybrid_search",
  "top_k": 8,
  "score_threshold": 0.7,
  "rerank_enabled": false
}
```

**Why:**
- Hybrid catches both "laptop" and "MacBook Pro M3"
- Moderate top_k for product comparisons
- Standard threshold works well

---

## Frontend Configuration

### KB Creation (Step 6: Retrieval)

Located in the 7-step KB creation wizard:

```
Step 1: Basic Info
Step 2: Source Selection
Step 3: Configure Sources
Step 4: Content Review
Step 5: Chunking
Step 6: Retrieval ← Configure here
Step 7: Review & Finalize
```

**UI Elements:**

1. **Search Strategy Dropdown**
   - Semantic Search
   - Keyword Search
   - Hybrid Search (Recommended)
   - MMR
   - Threshold-based

2. **Max Results (Top-K) Input**
   - Range: 1-50
   - Default: 10
   - Help text: "Recommended: 5-15 chunks"

3. **Score Threshold Input**
   - Range: 0.0-1.0
   - Step: 0.1
   - Default: 0.7
   - Help text: "Recommended: 0.6-0.8"

### Test Search Component

Test your retrieval config before deploying:

**Features:**
- Strategy selector (adaptive, hybrid, precise, contextual)
- Top K slider (1-20)
- Live search execution
- Score visualization with color coding:
  - Green: >= 80%
  - Yellow: 60-79%
  - Red: < 60%
- Confidence badges (High/Medium/Low)
- Processing time display
- Expandable result details with AI reasoning

### KB Detail Page

View current configuration:
- Displays strategy, top_k, score_threshold
- Read-only after creation
- Shows fallback defaults if not configured

---

## Performance Tuning

### Search Latency Factors

| Factor | Impact | Optimization |
|--------|--------|--------------|
| **Chunk Count** | Higher = slower | Use appropriate chunking |
| **Top K** | Higher = slower | Start low, increase as needed |
| **Strategy** | Hybrid slower than single | Use semantic for speed |
| **Score Threshold** | Lower = more results | Balance quality vs speed |

### Expected Latencies

| Scenario | Expected Latency |
|----------|-----------------|
| < 1,000 chunks, top_k=5 | 20-50ms |
| 1,000-10,000 chunks, top_k=10 | 50-150ms |
| > 10,000 chunks, top_k=20 | 150-500ms |

### Optimization Strategies

1. **Reduce Chunk Count**
   - Use larger chunk sizes for general content
   - Use by_heading for structured docs
   - Combine related small documents

2. **Lower Top K**
   - Start with 5, increase if results insufficient
   - Chatbots rarely need > 10

3. **Raise Score Threshold**
   - Higher threshold = fewer results to process
   - Start at 0.7, adjust based on quality

4. **Use Semantic for Speed**
   - Pure vector search is faster than hybrid
   - Good for well-embedded content

### Storage Mode Impact

| Storage Mode | Keyword Search | Vector Search |
|--------------|----------------|---------------|
| Hybrid (PostgreSQL + Qdrant) | PostgreSQL full-text (fast) | Qdrant vectors |
| Qdrant-Only | Qdrant text search (slower) | Qdrant vectors |

---

## Troubleshooting

### No Results Returned

**Symptoms:** Empty results for valid queries

**Possible Causes & Solutions:**

1. **Score threshold too high**
   - Lower threshold from 0.8 to 0.6
   - Test with 0.5 to see all matches

2. **Wrong embedding model**
   - Query must use same model as indexed content
   - Check KB embedding_config matches

3. **KB not ready**
   - Verify KB status is "ready"
   - Check pipeline completed successfully

4. **Content not indexed**
   - Verify documents were processed
   - Check total_vectors in KB stats

### Low-Quality Results

**Symptoms:** Results don't match query intent

**Possible Causes & Solutions:**

1. **Chunking too small**
   - Increase chunk_size to 1000+
   - Use by_heading for structured content

2. **Wrong strategy**
   - Try hybrid_search for mixed content
   - Use semantic_search for conceptual queries

3. **Threshold too low**
   - Raise threshold to 0.75+
   - Filter out noise

### Slow Search Performance

**Symptoms:** Searches take > 1 second

**Possible Causes & Solutions:**

1. **Too many chunks**
   - Increase chunk_size
   - Use no_chunking for small docs

2. **Top K too high**
   - Reduce from 20+ to 5-10

3. **Qdrant-only keyword search**
   - Qdrant text search is slower
   - Consider hybrid storage for keyword-heavy use

### Inconsistent Results

**Symptoms:** Same query returns different results

**Possible Causes & Solutions:**

1. **Embedding model mismatch**
   - Ensure consistent model across indexing and querying

2. **Recently updated content**
   - Wait for reindexing to complete

3. **Annotation boosting variations**
   - Boosted chunks may rank differently
   - Check annotation settings

### Strategy Not Working as Expected

**Symptoms:** Strategy behavior doesn't match documentation

**Debug Steps:**

1. Check `search_strategy_used` in response
2. Verify KB purpose matches strategy
3. Use `include_reasoning: true` to see decisions
4. Check if fallback was used (`fallback_used: true`)

---

## Quick Reference

### Default Configuration

```json
{
  "strategy": "hybrid_search",
  "top_k": 10,
  "score_threshold": 0.7,
  "rerank_enabled": false,
  "include_metadata": true
}
```

### Strategy Selection Guide

| Your Needs | Recommended Strategy |
|------------|---------------------|
| General purpose | `hybrid_search` |
| Natural language queries | `semantic_search` |
| Exact term lookup | `keyword_search` |
| Avoid redundancy | `mmr` |
| High precision only | `similarity_score_threshold` |
| Let system decide | `adaptive` (enhanced search) |

### Parameter Quick Guide

| Parameter | Range | Default | Recommendation |
|-----------|-------|---------|----------------|
| `top_k` | 1-100 | 10 | 5-15 for most cases |
| `score_threshold` | 0.0-1.0 | 0.7 | 0.6-0.8 balanced |
| `strategy` | 5 options | hybrid_search | Start with hybrid |
| `rerank_enabled` | bool | false | Keep false (not implemented) |

---

## Related Documentation

- [KB Creation Guide](./KB_CREATION_GUIDE.md) - Complete KB creation workflow
- [KB File Upload Guide](./KB_FILE_UPLOAD_GUIDE.md) - File upload processing
- [KB Chunking Strategies Guide](./KB_CHUNKING_STRATEGIES_GUIDE.md) - Chunking configuration
- [KB Test Search Guide](./KB_TEST_SEARCH_GUIDE.md) - Testing your KB

---

*Last Updated: December 2024*
*PrivexBot Knowledge Base System v1.0*
