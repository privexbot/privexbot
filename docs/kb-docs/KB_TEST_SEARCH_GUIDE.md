# Knowledge Base Test Search Guide

This comprehensive guide covers the Test KB feature in PrivexBot, which allows users to validate their Knowledge Base retrieval before deploying chatbots or chatflows.

---

## Table of Contents

1. [Overview](#overview)
2. [Accessing Test Search](#accessing-test-search)
3. [Search Interface](#search-interface)
4. [Search Strategies](#search-strategies)
5. [Understanding Results](#understanding-results)
6. [Backend Architecture](#backend-architecture)
7. [Search Configuration](#search-configuration)
8. [API Reference](#api-reference)
9. [Best Practices](#best-practices)
10. [Troubleshooting](#troubleshooting)

---

## Overview

### What is Test KB?

Test KB is a built-in feature that allows users to **validate their Knowledge Base** before deploying it with chatbots or chatflows. It provides:

- **Real-time search testing** with actual KB content
- **Configurable search strategies** (Adaptive, Hybrid, Precise, Contextual)
- **Result quality metrics** (scores, confidence levels)
- **AI reasoning** explaining why each result was selected
- **Performance metrics** (processing time)

### Why Test Before Deploying?

| Benefit | Description |
|---------|-------------|
| **Validate Content Quality** | Ensure chunks contain relevant information |
| **Tune Search Strategy** | Find the optimal strategy for your use case |
| **Check Chunk Sizes** | Verify chunks aren't too large or too small |
| **Test Real Queries** | Simulate actual user questions |
| **Avoid Deployment Issues** | Catch problems before users encounter them |

### Prerequisites

- Knowledge Base must be in **"ready"** status
- User must have **read access** to the KB
- At least one document must be **successfully processed**

---

## Accessing Test Search

### Method 1: From KB List

**Location**: `frontend/src/pages/knowledge-bases/index.tsx`

1. Navigate to **Knowledge Bases** page
2. Find your KB in the list
3. Click the **"Test"** button (Activity icon)

```typescript
// Lines 268-276: Test button in card view
<Button
  variant="outline"
  size="sm"
  onClick={() => handleTestKB(kb.id)}
  className="text-blue-600 hover:text-blue-700"
>
  <Activity className="h-4 w-4 mr-1" />
  Test
</Button>
```

### Method 2: From KB Detail Page

**Location**: `frontend/src/pages/knowledge-bases/detail.tsx`

1. Navigate to **Knowledge Base Details**
2. Click the **"Test Search"** tab
3. The test interface appears

```typescript
// Lines 526-531: Tab definition
{
  id: 'test-search',
  label: 'Test Search',
  icon: Search
}
```

### Method 3: Direct URL

Navigate directly to:
```
/knowledge-bases/{kb_id}?tab=test-search
```

---

## Search Interface

### Component Overview

**File**: `frontend/src/components/kb/KBTestSearch.tsx` (431 lines)

The test interface consists of three main sections:

```
┌─────────────────────────────────────────────────────────────────┐
│                    SEARCH CONFIGURATION                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Search Query: [Enter your search query...]    [Search]   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────┐  ┌─────────────────────────────────┐  │
│  │ Search Strategy:    │  │ Results Count (Top K): 5        │  │
│  │ [Adaptive ▼]        │  │ [────────○──────────]           │  │
│  └─────────────────────┘  └─────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    SEARCH RESULTS (5)                            │
│  Strategy: adaptive | 125ms                                      │
│  ─────────────────────────────────────────────────────────────  │
│  │ #1 │ Score: 92.5% │ High Confidence │ documentation │        │
│  │    │ [Page Title]                                    [▼]│    │
│  │    │ Content preview text here...                        │    │
│  │    │ https://docs.example.com/page                       │    │
│  ─────────────────────────────────────────────────────────────  │
│  │ #2 │ Score: 85.3% │ Medium Confidence │ faq │                │
│  ...                                                             │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      SEARCH TIPS                                 │
│  • Adaptive strategy automatically selects best approach        │
│  • Use natural language questions for best results              │
│  • Higher Top K returns more but less relevant results          │
└─────────────────────────────────────────────────────────────────┘
```

### Query Input

- **Text field** for entering search queries
- **Keyboard support**: Press `Enter` to search
- **Validation**: Query must be non-empty
- **Max length**: 1000 characters

```typescript
// Lines 177-184: Query input
<Input
  id="query"
  placeholder="Enter your search query... (e.g., 'How do I reset my password?')"
  value={query}
  onChange={(e) => setQuery(e.target.value)}
  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
  disabled={isSearching || kbStatus !== 'ready'}
/>
```

### Configuration Options

| Option | Default | Range | Description |
|--------|---------|-------|-------------|
| Search Strategy | `adaptive` | 4 options | Algorithm for finding relevant content |
| Top K | `5` | 1-20 | Number of results to return |
| Include Reasoning | `true` | boolean | Show AI explanation for each result |

---

## Search Strategies

### Available Strategies

**Location**: `frontend/src/components/kb/KBTestSearch.tsx:64-69`

```typescript
const SEARCH_STRATEGIES = [
  { value: 'adaptive', label: 'Adaptive (Recommended)', description: 'Automatically selects best strategy' },
  { value: 'hybrid', label: 'Hybrid Search', description: 'Combines semantic + keyword search' },
  { value: 'precise', label: 'Precise', description: 'Exact keyword matching' },
  { value: 'contextual', label: 'Contextual', description: 'Deep semantic understanding' },
];
```

### Strategy Details

#### 1. Adaptive (Recommended)

**Best For**: General use, when unsure which strategy to use

**How It Works**:
- Analyzes query characteristics (question words, keywords)
- Considers KB purpose (chatbot vs chatflow)
- Automatically selects PRECISE, CONTEXTUAL, or HYBRID

**Backend Logic** (`enhanced_search_service.py:141-173`):
```python
def _determine_search_strategy(self, kb, query, context_type):
    # Question words → PRECISE
    question_words = ['what', 'how', 'why', 'when', 'where', 'who']
    has_question_words = any(word in query.lower() for word in question_words)

    if context_type == "chatbot" and has_question_words:
        return SearchStrategy.PRECISE
    elif context_type == "chatflow":
        return SearchStrategy.CONTEXTUAL
    else:
        return SearchStrategy.HYBRID
```

#### 2. Hybrid Search

**Best For**: Balanced search, combining exact matches with semantic understanding

**How It Works**:
- **70% Vector Search**: Semantic similarity using embeddings
- **30% Keyword Search**: Full-text matching
- Results appearing in both get boosted scores

**Backend Logic** (`retrieval_service.py:607-666`):
```python
# Weight configuration
vector_weight = 0.7
keyword_weight = 0.3

# Score fusion
for result in vector_results:
    combined[chunk_id]["score"] = result["score"] * 0.7

for result in keyword_results:
    if chunk_id in combined:
        combined[chunk_id]["score"] += result["score"] * 0.3  # Boost
    else:
        combined[chunk_id]["score"] = result["score"] * 0.3
```

#### 3. Precise

**Best For**: Direct answer lookup, FAQ-style queries

**How It Works**:
- Prioritizes exact matches and high-confidence results
- Boosts FAQ and documentation content types
- Good for chatbot use cases

**Content Type Boosts**:
```python
content_type_weights = {
    "faq": 1.3,           # +30% for FAQ content
    "documentation": 1.1,  # +10% for docs
    "code": 1.2,          # +20% for code
    "article": 1.0,       # neutral
    "mixed": 0.9          # -10% for mixed
}
```

#### 4. Contextual

**Best For**: Broader understanding, related information retrieval

**How It Works**:
- Focuses on semantic understanding over exact matches
- Retrieves related/surrounding context
- Good for chatflow use cases where context matters

**Retrieval Pattern**:
- Fetches more results initially (`top_k * 3`)
- Re-ranks based on context relevance
- Returns most contextually relevant results

### Strategy Comparison

| Strategy | Precision | Recall | Speed | Use Case |
|----------|-----------|--------|-------|----------|
| Adaptive | High | Medium | Fast | General use |
| Hybrid | High | High | Medium | Balanced search |
| Precise | Very High | Low | Fast | Direct Q&A |
| Contextual | Medium | Very High | Medium | Deep exploration |

---

## Understanding Results

### Result Card Structure

Each result displays:

```
┌─────────────────────────────────────────────────────────────────┐
│ #1 │ Score: 92.5% │ High Confidence │ documentation │           │
│────────────────────────────────────────────────────────────────│
│ 📄 Page Title: Installation Guide                               │
│                                                                  │
│ Content preview text showing the relevant chunk that was        │
│ found in the knowledge base. This may be truncated unless       │
│ expanded...                                                      │
│                                                                  │
│ 🔗 https://docs.example.com/installation                        │
│                                                                  │
│ ┌─ AI Reasoning (expanded) ──────────────────────────────────┐  │
│ │ High similarity to query. Content type "documentation"     │  │
│ │ boosted. Strategy "by_heading" indicates well-structured   │  │
│ │ content.                                                    │  │
│ └────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Score Interpretation

**Location**: `KBTestSearch.tsx:141-145`

| Score Range | Color | Meaning |
|-------------|-------|---------|
| **≥ 80%** | Green | Highly relevant, strong match |
| **60-79%** | Yellow | Moderately relevant, partial match |
| **< 60%** | Red | Low relevance, may not be useful |

```typescript
const getScoreColor = (score: number) => {
  if (score >= 0.8) return 'text-green-600 bg-green-50';
  if (score >= 0.6) return 'text-yellow-600 bg-yellow-50';
  return 'text-red-600 bg-red-50';
};
```

### Confidence Levels

**Location**: `KBTestSearch.tsx:147-151`

| Confidence | Badge | Meaning |
|------------|-------|---------|
| **High** (≥80%) | Default | Very likely to be the right answer |
| **Medium** (60-79%) | Secondary | Probably relevant, verify content |
| **Low** (<60%) | Outline | May need different query |

### Confidence Calculation

**Location**: `enhanced_search_service.py:238-268`

Confidence is calculated from multiple factors:

```python
confidence = (
    base_vector_score *          # Semantic similarity
    content_type_weight *        # FAQ: 1.3, docs: 1.1, code: 1.2
    strategy_weight *            # by_heading: 1.2, semantic: 1.1
    alignment_boost *            # Query-content alignment
    strategy_boost               # Strategy-specific boost
)
confidence = min(1.0, confidence)  # Cap at 100%
```

### AI Reasoning

When expanded, each result shows AI-generated reasoning:

**Examples**:
- *"High similarity to query. Content type 'documentation' boosted. Strategy 'by_heading' indicates well-structured content."*
- *"FAQ content detected with question alignment. Direct answer likely."*
- *"Related context found. Lower score due to indirect match."*

**Generated by** (`enhanced_search_service.py:212-218`):
```python
def _generate_reasoning(self, content_type, strategy_used, score, confidence, context_type):
    reasoning_parts = []

    if score > 0.8:
        reasoning_parts.append("High similarity to query")
    elif score > 0.5:
        reasoning_parts.append("Moderate similarity to query")
    else:
        reasoning_parts.append("Low similarity, may be related context")

    if content_type != "mixed":
        reasoning_parts.append(f"Content type '{content_type}' boosted")

    if strategy_used in ["by_heading", "semantic"]:
        reasoning_parts.append(f"Strategy '{strategy_used}' indicates well-structured content")

    return ". ".join(reasoning_parts) + "."
```

### Result Metadata

Each result includes:

| Field | Description | Example |
|-------|-------------|---------|
| `chunk_id` | Unique chunk identifier | `uuid-string` |
| `content` | Chunk text content | "To install..." |
| `score` | Similarity score (0-1) | `0.925` |
| `confidence` | Confidence level (0-1) | `0.87` |
| `document_id` | Parent document ID | `uuid-string` |
| `page_url` | Source URL (if available) | "https://..." |
| `page_title` | Document/page title | "Installation Guide" |
| `content_type` | Content classification | "documentation" |
| `strategy_used` | Chunking strategy used | "by_heading" |
| `reasoning` | AI explanation | "High similarity..." |

---

## Backend Architecture

### API Endpoint

**Endpoint**: `POST /api/v1/enhanced-search/`

**File**: `backend/src/app/api/v1/routes/enhanced_search.py`

### Request Flow

```
Frontend (KBTestSearch)
    │
    ▼
POST /api/v1/enhanced-search/
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│                    enhanced_search_endpoint()                    │
│  ────────────────────────────────────────────────────────────── │
│  1. Validate KB exists and user has access                       │
│  2. Check access control (chatbot/chatflow context)              │
│  3. Map strategy string to SearchStrategy enum                   │
│  4. Call enhanced_search_service.enhanced_search()               │
│  5. Format results for response                                  │
│  6. If error → fallback to basic search                          │
│  7. Return EnhancedSearchResponse                                │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│              enhanced_search_service.enhanced_search()           │
│  ────────────────────────────────────────────────────────────── │
│  1. Generate query embedding                                     │
│  2. Determine search strategy (if adaptive)                      │
│  3. Execute vector search via Qdrant                             │
│  4. Enhance results with metadata analysis                       │
│  5. Calculate confidence scores                                  │
│  6. Generate reasoning for each result                           │
│  7. Rank results adaptively                                      │
│  8. Return top_k results                                         │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│                   qdrant_service.search()                        │
│  ────────────────────────────────────────────────────────────── │
│  1. Query Qdrant collection: kb_{kb_id}                          │
│  2. Use query_embedding for similarity search                    │
│  3. Apply workspace_id filter                                    │
│  4. Return top_k * 3 results (for re-ranking)                    │
│  5. Extract content and metadata from payload                    │
└─────────────────────────────────────────────────────────────────┘
```

### Service Components

#### 1. Enhanced Search Service

**File**: `backend/src/app/services/enhanced_search_service.py`

Handles:
- Strategy determination
- Result enhancement
- Confidence calculation
- Reasoning generation
- Adaptive ranking

#### 2. Retrieval Service

**File**: `backend/src/app/services/retrieval_service.py`

Handles:
- Vector search
- Keyword search
- Hybrid search
- Configuration priority chain
- Annotation boosting

#### 3. Qdrant Service

**File**: `backend/src/app/services/qdrant_service.py`

Handles:
- Vector similarity search
- Text search (for keyword matching)
- Collection management
- Context-aware filtering

### Fallback Mechanism

**Location**: `enhanced_search.py:185-201, 203-227`

If enhanced search fails:

```python
try:
    # Primary: Enhanced search
    enhanced_results = await enhanced_search_service.enhanced_search(...)

except Exception as e:
    # Fallback: Basic Qdrant search
    fallback_results = await enhanced_search_service.search_with_fallback(...)
    return EnhancedSearchResponse(
        results=fallback_results,
        search_strategy_used="fallback_basic",
        fallback_used=True
    )
```

---

## Search Configuration

### KB-Level Configuration

KB retrieval settings are stored in `knowledge_bases.context_settings`:

```python
{
    "retrieval_config": {
        "strategy": "hybrid_search",      # Default strategy
        "top_k": 5,                       # Default results count
        "score_threshold": 0.7,           # Minimum score
        "rerank_enabled": false           # Enable re-ranking
    }
}
```

### Configuration Priority Chain

**Location**: `retrieval_service.py:237-314`

```
1. Caller Override (highest priority)
   └─ Parameters passed directly to search()

2. KB-Level Config
   └─ kb.context_settings.retrieval_config

3. Service Defaults (lowest priority)
   └─ top_k: 5, search_method: "hybrid", threshold: 0.7
```

### Validation Constraints

**Location**: `retrieval_service.py:45-55`

```python
RETRIEVAL_CONFIG_CONSTRAINTS = {
    "top_k": {"min": 1, "max": 100, "type": int},
    "score_threshold": {"min": 0.0, "max": 1.0, "type": float},
    "strategy": {
        "allowed": ["semantic_search", "hybrid_search", "keyword_search", "mmr"],
        "type": str
    },
    "rerank_enabled": {"type": bool}
}
```

---

## API Reference

### Enhanced Search

```http
POST /api/v1/enhanced-search/
Authorization: Bearer {token}
Content-Type: application/json

{
  "kb_id": "123e4567-e89b-12d3-a456-426614174000",
  "query": "How do I install the application?",
  "search_strategy": "adaptive",
  "top_k": 5,
  "include_reasoning": true,
  "requester_type": "api",
  "requester_id": null
}
```

### Request Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `kb_id` | UUID | Required | Knowledge Base ID |
| `query` | string | Required | Search query (1-1000 chars) |
| `search_strategy` | string | "adaptive" | One of: adaptive, hybrid, precise, contextual |
| `top_k` | int | 5 | Results count (1-20) |
| `include_reasoning` | bool | true | Include AI reasoning |
| `requester_type` | string | "api" | One of: chatbot, chatflow, api |
| `requester_id` | UUID | null | ID of requesting bot/flow |

### Response

```json
{
  "results": [
    {
      "chunk_id": "abc123",
      "content": "To install the application, first download...",
      "score": 0.925,
      "confidence": 0.87,
      "document_id": "doc456",
      "page_url": "https://docs.example.com/install",
      "page_title": "Installation Guide",
      "content_type": "documentation",
      "strategy_used": "by_heading",
      "context_type": "precise",
      "reasoning": "High similarity to query. Content type 'documentation' boosted."
    }
  ],
  "search_strategy_used": "adaptive",
  "total_results": 5,
  "processing_time_ms": 125.5,
  "fallback_used": false
}
```

### Health Check

```http
GET /api/v1/enhanced-search/health

Response:
{
  "status": "healthy",
  "service": "enhanced_search_service",
  "features": [
    "adaptive_chunking_analysis",
    "context_aware_search",
    "metadata_filtering",
    "confidence_scoring",
    "backward_compatibility"
  ]
}
```

### Frontend API Client

**Location**: `frontend/src/lib/kb-client.ts:1295-1321`

```typescript
// Usage
const response = await kbClient.search.search({
  kb_id: kbId,
  query: query.trim(),
  search_strategy: strategy,
  top_k: topK,
  include_reasoning: true,
  requester_type: 'api'
});
```

---

## Best Practices

### Query Formulation

| Do | Don't |
|----|-------|
| Use natural language questions | Single keywords only |
| Be specific about what you need | Vague or ambiguous queries |
| Include context when helpful | Assume the system knows context |
| Try different phrasings | Give up after one attempt |

**Good Examples**:
- "How do I reset my password?"
- "What are the system requirements for installation?"
- "How to configure email notifications?"

**Poor Examples**:
- "password" (too vague)
- "help" (no context)
- "error" (not specific)

### Strategy Selection

| Use Case | Recommended Strategy |
|----------|---------------------|
| First-time testing | Adaptive |
| FAQ-style questions | Precise |
| Complex topics | Contextual |
| General search | Hybrid |

### Interpreting Results

1. **Check Score Distribution**:
   - All scores < 60%? → Content may not match query
   - Wide score range? → Good differentiation
   - All scores similar? → Query may be too broad

2. **Review Top Results**:
   - Does #1 actually answer the question?
   - Are results from expected documents?
   - Is content type appropriate?

3. **Adjust and Re-test**:
   - Try different strategies
   - Rephrase query
   - Increase/decrease Top K

### Testing Workflow

```
1. Start with Adaptive strategy
   ↓
2. Check if results are relevant
   ↓
3. If not, try Hybrid for balanced results
   ↓
4. For specific answers, use Precise
   ↓
5. For context/exploration, use Contextual
   ↓
6. Adjust Top K based on result density
   ↓
7. Document successful query patterns
```

---

## Troubleshooting

### Common Issues

#### 1. "KB Not Ready" Warning

**Symptom**: Search disabled, yellow warning shown

**Cause**: KB status is not "ready" (processing, failed, etc.)

**Solution**:
- Check KB status in the list/detail page
- If processing, wait for completion
- If failed, check pipeline logs and retry

#### 2. No Results Returned

**Symptoms**: Empty results, "No Results Found" message

**Causes**:
- Query doesn't match any content
- Score threshold too high
- Chunks not properly indexed

**Solutions**:
- Try different query phrasing
- Use Hybrid strategy for broader matching
- Check if documents were processed successfully
- Verify chunks exist in KB stats

#### 3. Low Score Results Only

**Symptom**: All results have scores < 60%

**Causes**:
- Content doesn't semantically match query
- Wrong embedding model
- Poor chunking strategy

**Solutions**:
- Review the actual content in top results
- Consider re-chunking with different strategy
- Add more relevant content to KB

#### 4. Wrong Content Type Results

**Symptom**: Getting code when expecting documentation

**Causes**:
- Limited content in KB
- Chunking mixed content types together

**Solutions**:
- Use more specific query
- Consider organizing sources by type
- Use Precise strategy for specific content

#### 5. Search Timeout

**Symptom**: Request takes too long or times out

**Causes**:
- Very large KB (many chunks)
- Qdrant overloaded
- Network issues

**Solutions**:
- Reduce Top K value
- Check Qdrant health status
- Contact admin if persistent

### Debug Information

When reporting issues, include:

```
KB ID: {kb_id}
KB Status: {status}
Query: "{query}"
Strategy: {strategy}
Top K: {top_k}
Results Count: {count}
Processing Time: {time_ms}
Fallback Used: {true/false}
```

### Checking KB Health

```http
GET /api/v1/kbs/{kb_id}/stats

Response includes:
- total_documents
- total_chunks
- total_vectors
- qdrant_health
```

---

## Summary

The Test KB feature provides a powerful way to validate Knowledge Base retrieval before deployment:

```
┌─────────────────────────────────────────────────────────────────┐
│                    TEST KB WORKFLOW                              │
│                                                                 │
│  1. Access Test Search                                          │
│     └─ From KB list or detail page                              │
│                                                                 │
│  2. Configure Search                                            │
│     ├─ Enter natural language query                             │
│     ├─ Select strategy (Adaptive recommended)                   │
│     └─ Set Top K (1-20)                                         │
│                                                                 │
│  3. Execute Search                                              │
│     ├─ Frontend calls POST /api/v1/enhanced-search/             │
│     ├─ Backend generates embedding                              │
│     ├─ Qdrant performs vector search                            │
│     ├─ Results enhanced with metadata                           │
│     └─ AI reasoning generated                                   │
│                                                                 │
│  4. Analyze Results                                             │
│     ├─ Check scores and confidence                              │
│     ├─ Expand to see full content                               │
│     ├─ Review AI reasoning                                      │
│     └─ Click source URLs to verify                              │
│                                                                 │
│  5. Iterate                                                     │
│     ├─ Try different strategies                                 │
│     ├─ Rephrase queries                                         │
│     └─ Document what works                                      │
│                                                                 │
│  6. Deploy with Confidence                                      │
│     └─ KB validated, ready for chatbot/chatflow                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Key Takeaways**:

1. **Always test before deploying** - Catch issues early
2. **Start with Adaptive** - Let the system choose the best strategy
3. **Use natural language** - The system understands questions
4. **Check confidence levels** - High confidence = reliable results
5. **Read AI reasoning** - Understand why results were selected
6. **Iterate and refine** - Test multiple query variations
