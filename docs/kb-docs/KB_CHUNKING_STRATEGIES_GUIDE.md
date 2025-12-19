# Knowledge Base Chunking Strategies Guide

This comprehensive guide covers all chunking strategies available in PrivexBot, their algorithms, configuration options, and best use cases for optimal Knowledge Base retrieval.

---

## Table of Contents

1. [Overview](#overview)
2. [Why Chunking Matters](#why-chunking-matters)
3. [Available Strategies](#available-strategies)
4. [Strategy Deep Dives](#strategy-deep-dives)
5. [Configuration Options](#configuration-options)
6. [Adaptive Strategy Selection](#adaptive-strategy-selection)
7. [Enhanced Metadata](#enhanced-metadata)
8. [Best Practices by Content Type](#best-practices-by-content-type)
9. [Frontend Configuration](#frontend-configuration)
10. [Troubleshooting](#troubleshooting)

---

## Overview

### What is Chunking?

Chunking is the process of splitting documents into smaller, semantically meaningful pieces (chunks) that can be:
- **Embedded** as vectors for similarity search
- **Retrieved** when users query the Knowledge Base
- **Provided** as context to AI models

### The Chunking Pipeline

```
Document Content
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CHUNKING SERVICE                              │
│  ────────────────────────────────────────────────────────────── │
│  1. Protect code blocks (UUID placeholders)                      │
│  2. Apply strategy (recursive, semantic, by_heading, etc.)       │
│  3. Apply size constraints (chunk_size, overlap)                 │
│  4. Restore code blocks                                          │
│  5. Calculate metadata (word_count, token_count, etc.)           │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
Chunks with Metadata
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│                    EMBEDDING SERVICE                             │
│  Generate 384-dimensional vectors for each chunk                 │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│                    QDRANT VECTOR STORE                           │
│  Store vectors + chunk content + metadata                        │
└─────────────────────────────────────────────────────────────────┘
```

### Key Files

| Component | File Path |
|-----------|-----------|
| Chunking Service | `backend/src/app/services/chunking_service.py` |
| Enhanced Chunking | `backend/src/app/services/enhanced_chunking_service.py` |
| Smart KB Service | `backend/src/app/services/smart_kb_service.py` |
| Frontend Config | `frontend/src/components/kb/KBChunkingSettings.tsx` |
| Frontend Preview | `frontend/src/components/kb/KBChunkingPreview.tsx` |

---

## Why Chunking Matters

### Impact on Retrieval Quality

| Chunk Size | Precision | Context | Speed | Best For |
|------------|-----------|---------|-------|----------|
| **Small** (200-500) | High | Low | Fast | FAQ, direct answers |
| **Medium** (500-1000) | Balanced | Balanced | Moderate | General use |
| **Large** (1000-2000) | Low | High | Slower | Complex explanations |

### The Chunking Dilemma

```
Too Small                    Optimal                     Too Large
─────────────────────────────────────────────────────────────────────
• Lost context              • Good context              • Irrelevant content
• Multiple hits needed      • Precise retrieval         • Wasted tokens
• Higher search accuracy    • Balanced trade-off        • Lower accuracy
• More embeddings           • Efficient processing      • Fewer embeddings
```

### Strategy Impact on Results

Different strategies create different chunk boundaries:

```
Original Document:
┌─────────────────────────────────────────────────────────────────┐
│ # Installation Guide                                             │
│                                                                  │
│ This guide explains how to install the application.             │
│                                                                  │
│ ## Prerequisites                                                 │
│                                                                  │
│ Before you begin, ensure you have:                              │
│ - Node.js 18+                                                   │
│ - npm or yarn                                                   │
│                                                                  │
│ ## Step 1: Download                                             │
│                                                                  │
│ Download the latest release from GitHub...                      │
└─────────────────────────────────────────────────────────────────┘

Recursive (3 chunks):          By Heading (3 chunks):
┌──────────────────────┐       ┌──────────────────────┐
│ # Installation Guide │       │ # Installation Guide │
│ This guide...        │       │ This guide...        │
├──────────────────────┤       ├──────────────────────┤
│ ## Prerequisites     │       │ ## Prerequisites     │
│ Before you begin...  │       │ Before... Node.js... │
├──────────────────────┤       ├──────────────────────┤
│ - npm or yarn        │       │ ## Step 1: Download  │
│ ## Step 1: Download  │       │ Download the latest..│
│ Download the latest..│       └──────────────────────┘
└──────────────────────┘
```

---

## Available Strategies

### Strategy Comparison Table

| Strategy | Algorithm | Best For | Pros | Cons |
|----------|-----------|----------|------|------|
| **recursive** | Hierarchical separators | General content | Versatile, reliable | May split mid-thought |
| **by_heading** | Split at `# ## ###` | Documentation | Preserves sections | Needs headings |
| **semantic** | Embedding similarity | Q&A, unstructured | Smart boundaries | Slower, needs embeddings |
| **paragraph_based** | Split at `\n\n` | Articles, blogs | Respects paragraphs | Variable chunk sizes |
| **sentence_based** | Split at `.!?` | Chat logs | Fine-grained | May lose context |
| **adaptive** | Auto-select | Unknown content | Intelligent choice | Less predictable |
| **hybrid** | Heading + paragraph | Complex docs | Multi-stage | More processing |
| **no_chunking** | No split | Small docs (<2000 chars) | Complete context | Large chunks |
| **token** | Token count | LLM limits | Precise tokens | Requires estimation |
| **custom** | User separators | Special formats | Flexible | Manual config |

### Recommended Strategy by Content Type

| Content Type | Primary Strategy | Fallback | Chunk Size | Overlap |
|--------------|------------------|----------|------------|---------|
| API Documentation | `by_heading` | `recursive` | 1000 | 200 |
| FAQ Pages | `semantic` | `by_section` | 500-800 | 100 |
| Blog Posts | `paragraph_based` | `recursive` | 800 | 150 |
| Code Repositories | `by_section` | `semantic` | 1500 | 300 |
| User Guides | `by_heading` | `paragraph_based` | 1000 | 200 |
| Research Papers | `semantic` | `by_heading` | 1200 | 250 |
| Product Specs | `recursive` | `by_heading` | 600 | 100 |
| Chat Transcripts | `sentence_based` | `recursive` | 400 | 50 |

---

## Strategy Deep Dives

### 1. Recursive Strategy (Default)

**Location**: `chunking_service.py:410-523`

**Algorithm**:
```
1. Define separator hierarchy: ["\n\n", "\n", " ", ""]
2. Split text by first separator
3. For each piece:
   - If fits in chunk_size → add to current chunk
   - If exceeds chunk_size → recursively split with next separator
4. Apply overlap when starting new chunks
```

**Implementation**:
```python
def _recursive_chunk(self, text, chunk_size, chunk_overlap, separators=None):
    if separators is None:
        separators = ["\n\n", "\n", " ", ""]

    current_separator = separators[0]
    remaining_separators = separators[1:] if len(separators) > 1 else [""]

    splits = text.split(current_separator)

    for split in splits:
        if len(current_chunk) + len(split) <= chunk_size:
            current_chunk += current_separator + split
        elif len(split) > chunk_size:
            # Recursively chunk with next separator
            sub_chunks = self._recursive_chunk(split, chunk_size, chunk_overlap, remaining_separators)
            chunks.extend(sub_chunks)
        else:
            # Start new chunk with overlap
            chunks.append(current_chunk)
            current_chunk = get_overlap(current_chunk) + split
```

**When to Use**:
- General-purpose content
- Mixed content types
- When unsure which strategy to use
- As fallback for other strategies

**Configuration**:
```typescript
{
  strategy: "recursive",
  chunk_size: 1000,      // Characters per chunk
  chunk_overlap: 200,    // Overlap for context continuity
  preserve_code_blocks: true
}
```

---

### 2. By Heading Strategy

**Location**: `chunking_service.py:652-704`

**Algorithm**:
```
1. Split text into lines
2. For each line:
   - If line is heading (# ## ### #### ##### ######):
     - Save current chunk if > 100 chars
     - Start new chunk with heading
   - Else add to current chunk
3. Also split if chunk exceeds chunk_size
```

**Heading Detection**:
```python
is_heading = (
    line.strip().startswith("#") and
    line.strip().split()[0] in ["#", "##", "###", "####", "#####", "######"]
)
```

**When to Use**:
- Markdown documentation
- Technical guides with clear sections
- Content with heading density > 5%
- API references

**Best Practices**:
- Ensure consistent heading hierarchy
- Use descriptive headings
- Don't skip heading levels (# → ### is bad)

**Configuration**:
```typescript
{
  strategy: "by_heading",
  chunk_size: 1000,
  chunk_overlap: 200,
  preserve_code_blocks: true
}
```

---

### 3. Semantic Strategy

**Location**: `chunking_service.py:765-915`

**Algorithm**:
```
1. Split text into paragraphs (min 20 chars each)
2. Generate embeddings for each paragraph
3. Calculate cosine similarity between consecutive paragraphs
4. Create chunk boundary when:
   - Similarity < semantic_threshold (default 0.65)
   - OR chunk would exceed max_chunk_size * 1.5
5. Apply overlap between chunks
```

**Similarity Calculation**:
```python
def _cosine_similarity(self, vec1, vec2):
    vec1_norm = np.linalg.norm(vec1)
    vec2_norm = np.linalg.norm(vec2)

    if vec1_norm == 0 or vec2_norm == 0:
        return 0.0

    return float(np.dot(vec1, vec2) / (vec1_norm * vec2_norm))
```

**Threshold Interpretation**:
| Threshold | Meaning | Result |
|-----------|---------|--------|
| 0.3 | Very different topics | Many small chunks |
| 0.5 | Moderate topic change | Balanced chunking |
| 0.65 (default) | Clear topic shift | Natural boundaries |
| 0.8 | Very similar topics | Fewer, larger chunks |
| 0.9 | Only split if unrelated | Minimal splitting |

**When to Use**:
- FAQ and Q&A content
- Unstructured text without headings
- Content with topic transitions
- When retrieval precision matters most

**Configuration**:
```typescript
{
  strategy: "semantic",
  chunk_size: 1000,
  chunk_overlap: 200,
  semantic_threshold: 0.65,  // Lower = more splits
  preserve_code_blocks: true
}
```

**Trade-offs**:
- **Pro**: Intelligent, topic-aware boundaries
- **Con**: Requires embedding generation (slower)
- **Fallback**: If embeddings fail, uses paragraph_based

---

### 4. Paragraph-Based Strategy

**Location**: `chunking_service.py:601-649`

**Algorithm**:
```
1. Split text by double newlines (\n\n)
2. Group paragraphs until chunk_size reached
3. For oversized paragraphs (> chunk_size):
   - Apply sentence-based chunking recursively
4. Include overlap from previous paragraph
```

**When to Use**:
- Blog posts and articles
- Well-formatted text with clear paragraphs
- Content without markdown headings
- Narrative content

**Configuration**:
```typescript
{
  strategy: "paragraph_based",
  chunk_size: 800,
  chunk_overlap: 150,
  preserve_code_blocks: true
}
```

---

### 5. Sentence-Based Strategy

**Location**: `chunking_service.py:526-566`

**Algorithm**:
```
1. Split text by sentence delimiters: [.!?] followed by whitespace
2. Group sentences until chunk_size reached
3. Start new chunk with overlap from previous sentences
```

**Regex Pattern**:
```python
sentences = re.split(r'[.!?]+\s+', text)
```

**When to Use**:
- Chat logs and transcripts
- Conversational content
- When fine-grained search is needed
- Short-form content

**Trade-offs**:
- **Pro**: Precise splitting at natural boundaries
- **Con**: May lose broader context
- **Con**: Variable chunk sizes

**Configuration**:
```typescript
{
  strategy: "sentence_based",
  chunk_size: 400,
  chunk_overlap: 50,
  preserve_code_blocks: true
}
```

---

### 6. Adaptive Strategy

**Location**: `chunking_service.py:943-993`

**Algorithm**:
```
1. Analyze document structure:
   - Count headings, paragraphs, lines
   - Calculate heading_density = headings / lines
   - Count paragraph breaks

2. Decision tree:
   IF heading_density > 5% → use by_heading
   ELIF paragraph_count > 10 → use paragraph_based
   ELIF heading_count > 0 → use hybrid
   ELSE → use recursive
```

**Thresholds** (from `ChunkingConfig`):
```python
adaptive_heading_density_threshold: float = 0.05   # 5%
adaptive_paragraph_count_threshold: int = 10
```

**When to Use**:
- Unknown content types
- Mixed content sources
- When you want automatic optimization
- During initial KB creation

**Configuration**:
```typescript
{
  strategy: "adaptive",
  chunk_size: 1000,
  chunk_overlap: 200,
  preserve_code_blocks: true
}
```

---

### 7. Hybrid Strategy

**Location**: `chunking_service.py:996-1041`

**Algorithm** (Multi-stage):
```
Stage 1: Primary chunking by headings
         - Allow larger chunks (chunk_size * 1.5)

Stage 2: Refine oversized chunks
         - Apply paragraph-based splitting

Stage 3: Re-index all chunks
```

**Implementation**:
```python
def _hybrid_chunk(self, text, chunk_size, chunk_overlap):
    max_multiplier = 1.5

    # Stage 1: Heading-based (allow larger)
    primary_chunks = self._heading_chunk(
        text,
        int(chunk_size * max_multiplier),
        chunk_overlap
    )

    # Stage 2: Refine oversized
    refined_chunks = []
    for chunk in primary_chunks:
        if len(chunk["content"]) > chunk_size * max_multiplier:
            sub_chunks = self._paragraph_chunk(chunk["content"], chunk_size, chunk_overlap)
            refined_chunks.extend(sub_chunks)
        else:
            refined_chunks.append(chunk)

    return refined_chunks
```

**When to Use**:
- Complex documents with mixed structure
- Technical documentation with code blocks
- When single strategy is insufficient
- Documents with inconsistent formatting

**Configuration**:
```typescript
{
  strategy: "hybrid",
  chunk_size: 1024,
  chunk_overlap: 200,
  preserve_code_blocks: true
}
```

---

### 8. No Chunking Strategy

**Location**: `chunking_service.py:1044-1050`

**Algorithm**:
```
Return entire document as single chunk
```

**Implementation**:
```python
def _full_content_chunk(self, text: str) -> List[dict]:
    if not text.strip():
        return []
    return [self._create_chunk_metadata(text.strip(), 0)]
```

**When to Use**:
- Small documents (< 2000 characters)
- FAQ entries where complete context is essential
- Single-topic pages
- When you want to preserve full document

**Trade-offs**:
- **Pro**: Complete context preserved
- **Con**: Large chunks may reduce search precision
- **Con**: May exceed LLM context limits

**Configuration**:
```typescript
{
  strategy: "no_chunking"
  // chunk_size and chunk_overlap are ignored
}
```

---

### 9. Token-Based Strategy

**Location**: `chunking_service.py:569-598`

**Algorithm**:
```
1. Convert token count to character count
   - chars_per_token = 4 (configurable)
   - chunk_size_chars = chunk_size * 4

2. Delegate to recursive chunking with adjusted sizes
```

**When to Use**:
- When working with specific LLM context limits
- When token count matters more than character count
- For precise context window management

**Configuration**:
```typescript
{
  strategy: "token",
  chunk_size: 256,       // In TOKENS, not characters
  chunk_overlap: 50,     // In TOKENS
  preserve_code_blocks: true
}
```

**Token Estimation**:
```python
# Default: 4 characters ≈ 1 token
# Adjustable via chars_per_token config
estimated_tokens = len(content) // 4
```

---

### 10. Custom Strategy

**Location**: `chunking_service.py:1052-1064`

**Algorithm**:
```
1. Use user-provided separators instead of defaults
2. Apply recursive chunking with custom separators
```

**When to Use**:
- Special document formats
- Known delimiter patterns (e.g., `---`, `===`)
- Domain-specific content
- When standard strategies don't fit

**Configuration**:
```typescript
{
  strategy: "custom",
  chunk_size: 1000,
  chunk_overlap: 200,
  custom_separators: ["---", "===", "***"],  // Required!
  preserve_code_blocks: true
}
```

---

## Configuration Options

### Core Parameters

| Parameter | Type | Default | Range | Description |
|-----------|------|---------|-------|-------------|
| `strategy` | string | "recursive" | See strategies | Chunking algorithm |
| `chunk_size` | int | 1000 | 100-10000 | Target chunk size (chars) |
| `chunk_overlap` | int | 200 | 0-2000 | Overlap between chunks |
| `preserve_code_blocks` | bool | true | - | Protect code from splitting |
| `semantic_threshold` | float | 0.65 | 0.0-1.0 | For semantic strategy |
| `custom_separators` | string[] | - | - | For custom strategy |
| `enable_enhanced_metadata` | bool | false | - | Add context fields |

### Chunk Size Guidelines

```
┌─────────────────────────────────────────────────────────────────┐
│                    CHUNK SIZE SPECTRUM                           │
│                                                                  │
│  200      500      800     1000     1500     2000     4000      │
│   ├────────┼────────┼────────┼────────┼────────┼────────┤       │
│   │        │        │        │        │        │        │       │
│   ▼        ▼        ▼        ▼        ▼        ▼        ▼       │
│  Very    Small   Medium  Standard  Large   Very    Maximum      │
│  Small                                      Large               │
│                                                                  │
│  FAQ    Chat    Blog   General   Complex  Full    Complete      │
│  Q&A    Logs   Posts   Content   Docs    Context  Documents     │
└─────────────────────────────────────────────────────────────────┘
```

### Overlap Guidelines

| Overlap % | Characters | Use Case |
|-----------|------------|----------|
| 0% | 0 | Distinct sections, no context needed |
| 10% | 100 | Minimal context preservation |
| 20% (default) | 200 | Balanced context continuity |
| 30% | 300 | High context preservation |
| 50% | 500 | Maximum context (may cause duplication) |

**Formula**: `overlap_ratio = chunk_overlap / chunk_size`

---

## Adaptive Strategy Selection

### Smart KB Service Decision Flow

**Location**: `smart_kb_service.py:134-226`

```
┌─────────────────────────────────────────────────────────────────┐
│                    CHUNKING DECISION FLOW                        │
│                                                                  │
│  ┌─────────────┐                                                │
│  │ User Config │ ←── Highest Priority                           │
│  └──────┬──────┘                                                │
│         │                                                        │
│         ▼                                                        │
│  ┌─────────────────────────────────────────┐                    │
│  │ Has user specified ALL THREE?           │                    │
│  │ (strategy + chunk_size + chunk_overlap) │                    │
│  └──────┬─────────────────────┬────────────┘                    │
│         │ YES                 │ NO                               │
│         ▼                     ▼                                  │
│  ┌──────────────┐    ┌───────────────────┐                      │
│  │ Use user     │    │ Analyze content   │                      │
│  │ preferences  │    │ for suggestions   │                      │
│  └──────────────┘    └────────┬──────────┘                      │
│                               │                                  │
│                               ▼                                  │
│                      ┌─────────────────────────┐                │
│                      │ Merge user + adaptive   │                │
│                      │ (user values override)  │                │
│                      └─────────────────────────┘                │
└─────────────────────────────────────────────────────────────────┘
```

### Content Analysis Factors

**Structure Score** (0-1):
```python
def _analyze_structure(self, content: str) -> float:
    lines = content.split('\n')
    total_lines = len(lines)

    headings = sum(1 for line in lines if line.strip().startswith('#'))
    lists = sum(1 for line in lines if line.strip().startswith(('- ', '* ', '1. ')))

    # Headings: 10x weight, Lists: 5x weight
    structure_score = min(1.0, (headings / total_lines * 10) + (lists / total_lines * 5))
    return structure_score
```

**Content Type Detection**:
```python
def _detect_content_type(self, content: str, title: str) -> str:
    content_lower = content.lower()

    if any(ind in content_lower for ind in ['question', 'answer', 'faq', 'how to']):
        return "faq"
    elif any(ind in content_lower for ind in ['function', 'class', 'def ', '```']):
        return "code"
    elif any(ind in content_lower for ind in ['install', 'configure', 'setup', 'guide']):
        return "documentation"
    elif len(content.split('\n\n')) > 5:
        return "article"
    else:
        return "mixed"
```

### Context-Aware Sizing

**Location**: `smart_kb_service.py:417-432`

```python
# Get access control info - determines KB's intended use
access_info = self.analyze_kb_access_control(kb)

if access_info.accessible_by_chatbots and not access_info.accessible_by_chatflows:
    # Chatbot-only: smaller chunks for precise answers
    base_chunk_size = 800
elif access_info.accessible_by_chatflows and not access_info.accessible_by_chatbots:
    # Chatflow-only: larger chunks for context
    base_chunk_size = 1500
else:
    # Both or unspecified: balanced approach
    base_chunk_size = 1200
```

---

## Enhanced Metadata

### What is Enhanced Metadata?

When `enable_enhanced_metadata: true`, chunks include additional context fields:

| Field | Description | Use Case |
|-------|-------------|----------|
| `context_before` | Last 100 chars of previous chunk | Maintain continuity |
| `context_after` | First 100 chars of next chunk | Preview upcoming content |
| `parent_heading` | Section heading (if any) | Hierarchical context |
| `section_title` | Logical section name | Navigation |
| `chunk_index` | Position in document | Ordering |
| `total_chunks` | Total chunks in document | Context |

### Enhanced Chunk Structure

```python
@dataclass
class DocumentChunk:
    content: str                          # The chunk text
    index: int                            # Position (0-based)
    metadata: Dict[str, Any]              # Standard metadata

    # Enhanced fields (optional)
    context_before: Optional[str] = None  # Previous chunk snippet
    context_after: Optional[str] = None   # Next chunk snippet
    parent_heading: Optional[str] = None  # Section heading
    section_title: Optional[str] = None   # Section name
```

### Context Generation

**Location**: `enhanced_chunking_service.py:413-445`

```python
def _get_context_before(self, chunks, index, max_chars=100):
    if index <= 0:
        return None

    prev_content = chunks[index - 1].get("content", "")
    if len(prev_content) <= max_chars:
        return prev_content

    return "..." + prev_content[-max_chars:]

def _get_context_after(self, chunks, index, max_chars=100):
    if index >= len(chunks) - 1:
        return None

    next_content = chunks[index + 1].get("content", "")
    if len(next_content) <= max_chars:
        return next_content

    return next_content[:max_chars] + "..."
```

### When to Enable Enhanced Metadata

| Scenario | Enable? | Reason |
|----------|---------|--------|
| Complex documentation | Yes | Better context in search results |
| Simple FAQ | No | Overhead not worth it |
| Multi-section documents | Yes | Preserve section context |
| Short documents | No | Not enough content to benefit |
| High-precision retrieval | Yes | Additional ranking signals |

---

## Best Practices by Content Type

### 1. API Documentation

```typescript
{
  strategy: "by_heading",
  chunk_size: 1000,
  chunk_overlap: 200,
  preserve_code_blocks: true,
  enable_enhanced_metadata: true
}
```

**Why**: API docs have clear heading structure (endpoints, methods, parameters).

### 2. FAQ Pages

```typescript
{
  strategy: "semantic",
  chunk_size: 600,
  chunk_overlap: 100,
  semantic_threshold: 0.6,
  preserve_code_blocks: true
}
```

**Why**: Each Q&A pair should be its own chunk. Semantic chunking detects topic boundaries.

### 3. Blog Posts / Articles

```typescript
{
  strategy: "paragraph_based",
  chunk_size: 800,
  chunk_overlap: 150,
  preserve_code_blocks: true
}
```

**Why**: Blogs have clear paragraphs. Paragraph-based preserves narrative flow.

### 4. Code Repositories

```typescript
{
  strategy: "by_section",
  chunk_size: 1500,
  chunk_overlap: 300,
  preserve_code_blocks: true,
  enable_enhanced_metadata: true
}
```

**Why**: Code needs larger chunks for context. Code blocks must stay intact.

### 5. User Guides / Tutorials

```typescript
{
  strategy: "by_heading",
  chunk_size: 1000,
  chunk_overlap: 200,
  preserve_code_blocks: true
}
```

**Why**: Step-by-step guides have clear sections. Heading-based preserves steps.

### 6. Chat Logs / Transcripts

```typescript
{
  strategy: "sentence_based",
  chunk_size: 400,
  chunk_overlap: 50,
  preserve_code_blocks: false
}
```

**Why**: Conversations are short exchanges. Sentence-based captures turns.

### 7. Research Papers

```typescript
{
  strategy: "semantic",
  chunk_size: 1200,
  chunk_overlap: 250,
  semantic_threshold: 0.65,
  enable_enhanced_metadata: true
}
```

**Why**: Papers have complex topic transitions. Semantic chunking respects them.

### 8. Product Specifications

```typescript
{
  strategy: "recursive",
  chunk_size: 600,
  chunk_overlap: 100,
  preserve_code_blocks: true
}
```

**Why**: Specs have mixed structure. Recursive handles variety well.

---

## Frontend Configuration

### KBChunkingSettings Component

**Location**: `frontend/src/components/kb/KBChunkingSettings.tsx`

Available options in the UI:

#### Strategy Selector

```typescript
const CHUNKING_STRATEGIES = [
  { value: 'recursive', label: 'Recursive', description: 'Default - splits text recursively on separators', recommended: true },
  { value: 'adaptive', label: 'Adaptive', description: 'Auto-selects strategy based on content structure' },
  { value: 'by_heading', label: 'By Heading', description: 'Splits on markdown headings (# ## ###)' },
  { value: 'paragraph_based', label: 'By Paragraph', description: 'Splits on paragraph breaks' },
  { value: 'sentence_based', label: 'By Sentence', description: 'Splits on sentence boundaries' },
  { value: 'semantic', label: 'Semantic', description: 'Intelligent splits based on topic changes' },
  { value: 'hybrid', label: 'Hybrid', description: 'Combines multiple strategies for best results' },
  { value: 'no_chunking', label: 'No Chunking', description: 'Keep documents whole (small docs only)' },
];
```

#### Chunk Size Slider

- **Range**: 200 - 4000 characters
- **Step**: 100 characters
- **Default**: 1000

#### Chunk Overlap Slider

- **Range**: 0 - min(500, chunk_size / 2)
- **Step**: 25 characters
- **Default**: 200

#### Semantic Threshold Slider (Semantic strategy only)

- **Range**: 0.3 - 0.9
- **Step**: 0.05
- **Default**: 0.65

#### Toggle Options

- **Preserve Code Blocks**: Default ON
- **Enhanced Metadata**: Default OFF

### Presets (KBChunkingConfig)

```typescript
const CHUNKING_PRESETS = [
  {
    id: 'precise',
    name: 'Precise',
    description: 'Smaller chunks for accurate search',
    config: { strategy: 'semantic', chunk_size: 256, chunk_overlap: 50 }
  },
  {
    id: 'balanced',
    name: 'Balanced',
    description: 'Good balance of precision and context',
    config: { strategy: 'by_heading', chunk_size: 512, chunk_overlap: 100 }
  },
  {
    id: 'contextual',
    name: 'Contextual',
    description: 'Larger chunks for more context',
    config: { strategy: 'hybrid', chunk_size: 1024, chunk_overlap: 200 }
  }
];
```

---

## Code Block Preservation

### How It Works

**Location**: `chunking_service.py:210-284`

```
Original:                          Protected:                     Restored:
┌────────────────────┐            ┌────────────────────┐         ┌────────────────────┐
│ Some text          │            │ Some text          │         │ Some text          │
│ ```python          │            │ __CODE_BLOCK_abc__ │         │ ```python          │
│ def hello():       │  ────────► │                    │ ──────► │ def hello():       │
│     print("hi")    │  Protect   │ More text          │ Restore │     print("hi")    │
│ ```                │            │                    │         │ ```                │
│ More text          │            │                    │         │ More text          │
└────────────────────┘            └────────────────────┘         └────────────────────┘
```

### Protection Algorithm

```python
def _protect_code_blocks(self, text, chunk_size):
    code_block_pattern = re.compile(r'```[\s\S]*?```', re.MULTILINE)
    code_block_map = {}

    def replace_code_block(match):
        code_block = match.group(0)
        block_id = f"__CODE_BLOCK_{uuid.uuid4().hex[:8]}__"

        if len(code_block) <= chunk_size * 1.5:
            # Small enough to protect
            code_block_map[block_id] = code_block
            return f"\n{block_id}\n"
        else:
            # Too large - will become its own chunk
            return f"\n\n{code_block}\n\n"

    processed_text = code_block_pattern.sub(replace_code_block, text)
    return processed_text, code_block_map
```

### Size Threshold

- **Protected**: Code blocks ≤ 1.5x chunk_size
- **Standalone**: Code blocks > 1.5x chunk_size (become own chunk)

---

## Troubleshooting

### Common Issues

#### 1. Chunks Too Small

**Symptom**: Many tiny chunks, lost context

**Causes**:
- chunk_size too small
- Wrong strategy for content
- Too many separators

**Solutions**:
- Increase chunk_size (try 1000-1500)
- Use paragraph_based instead of sentence_based
- Try hybrid strategy

#### 2. Chunks Too Large

**Symptom**: Few chunks, irrelevant content in results

**Causes**:
- chunk_size too large
- no_chunking on large documents
- Missing structure for by_heading

**Solutions**:
- Decrease chunk_size (try 600-800)
- Use actual chunking strategy
- Add headings to content or use recursive

#### 3. Code Blocks Split

**Symptom**: Code examples broken across chunks

**Causes**:
- preserve_code_blocks disabled
- Code block > 1.5x chunk_size
- Using sentence_based on code

**Solutions**:
- Enable preserve_code_blocks
- Increase chunk_size
- Use by_heading or recursive

#### 4. No Topic Boundaries

**Symptom**: Chunks split mid-thought

**Causes**:
- semantic_threshold too high
- Wrong strategy for content
- Content lacks structure

**Solutions**:
- Lower semantic_threshold (try 0.5)
- Use semantic strategy
- Use adaptive to auto-detect

#### 5. Too Many Embeddings

**Symptom**: Slow processing, high costs

**Causes**:
- chunk_size too small
- Many small documents
- sentence_based on large docs

**Solutions**:
- Increase chunk_size
- Use no_chunking for tiny docs
- Use paragraph_based or by_heading

### Debug Information

When reporting chunking issues, include:

```
Strategy: {strategy}
Chunk Size: {chunk_size}
Chunk Overlap: {chunk_overlap}
Preserve Code Blocks: {true/false}
Enhanced Metadata: {true/false}
Semantic Threshold: {threshold}

Document Stats:
- Total Characters: {chars}
- Heading Count: {count}
- Paragraph Count: {count}
- Code Block Count: {count}

Result:
- Total Chunks: {count}
- Average Chunk Size: {avg_chars}
- Min/Max Chunk Size: {min}/{max}
```

---

## Summary

### Quick Reference Table

| Strategy | Best For | Chunk Size | Key Config |
|----------|----------|------------|------------|
| **recursive** | General | 1000 | Default separators |
| **by_heading** | Documentation | 1000 | Needs headings |
| **semantic** | FAQ, Q&A | 600-800 | semantic_threshold |
| **paragraph_based** | Articles | 800 | Clear paragraphs |
| **sentence_based** | Chat logs | 400 | Short content |
| **adaptive** | Unknown | 1000 | Auto-detect |
| **hybrid** | Complex docs | 1024 | Multi-stage |
| **no_chunking** | Small docs | N/A | < 2000 chars |

### Decision Flowchart

```
Start
  │
  ▼
Is document < 2000 chars?
  │ YES ────────────────────────────────► no_chunking
  │ NO
  ▼
Does content have clear headings (> 5%)?
  │ YES ────────────────────────────────► by_heading
  │ NO
  ▼
Is content FAQ or Q&A format?
  │ YES ────────────────────────────────► semantic
  │ NO
  ▼
Is content well-paragraphed articles?
  │ YES ────────────────────────────────► paragraph_based
  │ NO
  ▼
Is content chat/conversation?
  │ YES ────────────────────────────────► sentence_based
  │ NO
  ▼
Is structure unknown or mixed?
  │ YES ────────────────────────────────► adaptive
  │ NO
  ▼
Default ──────────────────────────────────► recursive
```

### Key Takeaways

1. **Start with adaptive** if unsure - it analyzes content automatically
2. **Use by_heading** for documentation with clear structure
3. **Use semantic** when topic boundaries matter
4. **Always enable preserve_code_blocks** for technical content
5. **Match chunk_size to use case**: smaller for chatbots, larger for chatflows
6. **Use overlap** (10-20%) for context continuity
7. **Preview chunks** before finalizing to validate configuration
