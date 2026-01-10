# PrivexBot Chunking Strategies Implementation

## Overview

Chunking is the process of splitting documents into smaller, meaningful segments for embedding and retrieval. PrivexBot implements **11 different chunking strategies** to handle diverse document types, from technical documentation to conversational content.

## Why Chunking Matters

1. **Embedding Quality**: Smaller, focused chunks produce better embeddings
2. **Retrieval Precision**: Returns specific, relevant content (not entire documents)
3. **Context Windows**: Fits within LLM token limits
4. **Cost Efficiency**: Reduces tokens processed per query

## Available Strategies

### 1. Recursive (Default Fallback)

Splits text by progressively finer separators until chunks fit within size limits.

**Separator Order**: `["\n\n", "\n", " ", ""]`

```python
# Algorithm:
# 1. Try primary separator (double newline)
# 2. If chunk > chunk_size, try next separator
# 3. Continue until all chunks fit
# 4. Last resort: character-level split
```

**Best For**: General content, unknown document types, fallback

### 2. Semantic (Topic Boundaries)

Uses embedding similarity to detect topic changes and split at natural boundaries.

```python
# Configuration
semantic_threshold: 0.65  # Lower = more splits, Higher = fewer splits

# Algorithm:
# 1. Split text into paragraphs (min 20 chars)
# 2. Generate embeddings for each paragraph
# 3. Calculate cosine similarity between consecutive paragraphs
# 4. When similarity < threshold = topic boundary
# 5. Group similar paragraphs into chunks
```

**Best For**: Q&A content, articles, unstructured text

### 3. By Heading (Markdown Structure)

Splits at markdown heading boundaries (`#`, `##`, `###`, etc.).

```python
# Detects headings:
line.strip().startswith("#")

# Creates new chunk when:
# 1. Heading detected AND
# 2. Current chunk has content AND
# 3. Respects chunk_size limits
```

**Best For**: Documentation, technical guides, structured content

### 4. By Section (Logical Grouping)

Groups content into logical sections based on structural cues.

```python
# Section boundaries detected:
# 1. Markdown headings (#)
# 2. Very short lines (<10 chars)
# 3. ALL CAPS headings
```

**Best For**: Long technical guides, formal documents

### 5. Paragraph-Based

Preserves paragraph boundaries, splits on double newlines.

```python
# Split on: "\n\n"
# Oversized paragraphs → recursively use sentence chunking
```

**Best For**: Blogs, articles, editorial content

### 6. Sentence-Based

Splits at sentence boundaries using punctuation.

```python
# Regex: r'[.!?]+\s+'
# Groups sentences into chunks until chunk_size reached
```

**Best For**: Chat logs, conversational content, transcripts

### 7. Token-Based (LLM Context Aware)

Splits by estimated token count for LLM context windows.

```python
# Token estimation: ~4 characters per token
chunk_size_chars = chunk_size_tokens * 4

# Example: 1000 tokens = ~4000 characters
```

**Best For**: Fitting into specific LLM context windows

### 8. Adaptive (Auto-Select)

Analyzes document structure and automatically selects best strategy.

```python
def determine_strategy(text):
    heading_density = heading_count / total_lines
    paragraph_count = len(text.split("\n\n"))

    if heading_density > 0.05:  # >5% headings
        return "by_heading"
    elif paragraph_count > 10:
        return "paragraph_based"
    elif heading_count > 0:
        return "hybrid"
    else:
        return "recursive"  # fallback
```

**Best For**: Unknown document types, automated processing

### 9. Hybrid (Combined Strategies)

Combines heading-based and paragraph-based for complex documents.

```python
# Step 1: Primary chunking by headings (allow 1.5x chunk_size)
# Step 2: Refine oversized chunks with paragraph splitting
# Step 3: Re-index all chunks
```

**Best For**: Complex documents with mixed structure

### 10. No Chunking / Full Content

Returns entire document as single chunk.

```python
# No splitting - one chunk per document
# Use when: Small documents, FAQs, short content
```

**Best For**: Small documents (<1KB), FAQ entries

### 11. Custom (User-Defined Separators)

Uses user-specified separator patterns.

```python
custom_separators = ["---", "===", "***"]
# Splits text at each separator occurrence
```

**Best For**: Domain-specific content with known delimiters

## Configuration Parameters

### Core Parameters

| Parameter | Type | Default | Range | Description |
|-----------|------|---------|-------|-------------|
| `strategy` | string | adaptive | - | Chunking strategy to use |
| `chunk_size` | int | 1000 | 100-10000 | Target chunk size (characters) |
| `chunk_overlap` | int | 200 | 0-2000 | Overlap between chunks |

### Advanced Parameters

| Parameter | Type | Default | Range | Description |
|-----------|------|---------|-------|-------------|
| `semantic_threshold` | float | 0.65 | 0.0-1.0 | Topic change sensitivity |
| `preserve_code_blocks` | bool | true | - | Keep code blocks intact |
| `min_chunk_size` | int | 50 | 10-500 | Minimum chunk size |
| `max_chunk_size_multiplier` | float | 1.5 | 1.0-3.0 | Max size multiplier |
| `chars_per_token` | int | 4 | 2-10 | Token estimation ratio |

## Chunk Overlap

Overlap ensures context continuity between chunks:

```
Original: "The quick brown fox jumps over the lazy dog..."

With chunk_size=30, chunk_overlap=10:

Chunk 1: "The quick brown fox jumps over" (30 chars)
Chunk 2: "umps over the lazy dog..." (starts with last 10 chars)
          ^^^^^^^^^^ (overlap)
```

### Why Overlap Matters

1. **Context Preservation**: Important concepts may span chunk boundaries
2. **Better Retrieval**: Partial matches still work
3. **Coherent Answers**: LLM gets complete context

## Code Block Protection

PrivexBot protects code blocks from being split:

```python
# Phase 1: Protection
def _protect_code_blocks(text, chunk_size):
    # Find code blocks (```)
    # Replace with placeholders if small enough
    # Let large code blocks be own chunks

# Phase 2: Chunking
# ... normal chunking on processed text ...

# Phase 3: Restoration
def _restore_code_blocks(chunks, code_block_map):
    # Replace placeholders with original code
    # Recalculate metadata
```

## Chunk Metadata

Each chunk includes rich metadata:

```python
{
    "content": "chunk text...",
    "index": 0,                    # Chunk position
    "start_pos": 0,                # Character offset start
    "end_pos": 1250,               # Character offset end
    "token_count": 312,            # Estimated tokens
    "metadata": {
        "word_count": 187,
        "chunk_length": 1250,
        "character_count": 1250,
        "heading": "Installation",  # Parent heading (if detected)
        "heading_level": 2,
        "element_type": "text",
        "has_code_block": false
    }
}
```

## Chunking in the Pipeline

### Step 1: Extract Configuration
```python
chunking_config = kb.config.get("chunking_config", {})
strategy = chunking_config.get("strategy", "adaptive")
chunk_size = chunking_config.get("chunk_size", 1000)
chunk_overlap = chunking_config.get("chunk_overlap", 200)
```

### Step 2: Apply Strategy
```python
chunks = chunking_service.chunk_document(
    text=document_content,
    strategy=strategy,
    chunk_size=chunk_size,
    chunk_overlap=chunk_overlap,
    preserve_code_blocks=True
)
```

### Step 3: Store Chunks
```python
for chunk_data in chunks:
    chunk = Chunk(
        document_id=document.id,
        content=chunk_data["content"],
        position=chunk_data["index"],
        chunk_metadata=chunk_data["metadata"],
        word_count=chunk_data["metadata"]["word_count"],
        character_count=chunk_data["metadata"]["character_count"]
    )
    db.add(chunk)
```

## Choosing the Right Strategy

### Decision Guide

| Document Type | Recommended Strategy | Why |
|--------------|---------------------|-----|
| API Documentation | `by_heading` | Clear structure with headers |
| Blog Posts | `paragraph_based` | Natural paragraph boundaries |
| Chat Transcripts | `sentence_based` | Conversational nature |
| FAQs | `no_chunking` | Each Q&A is self-contained |
| Technical Manuals | `hybrid` | Mixed structure |
| Unknown Content | `adaptive` | Auto-selects best approach |
| Multi-language | `semantic` | Language-agnostic topics |

### Preset Configurations

PrivexBot offers presets for common use cases:

```typescript
presets = {
  "precise": {
    strategy: "semantic",
    chunk_size: 256,
    chunk_overlap: 50
  },
  "balanced": {
    strategy: "by_heading",
    chunk_size: 512,
    chunk_overlap: 100
  },
  "contextual": {
    strategy: "hybrid",
    chunk_size: 1024,
    chunk_overlap: 200
  }
}
```

## Quality Estimation

The system provides quality scoring based on configuration:

```python
def get_quality_score(config):
    score = 70  # Base score

    # Strategy bonuses
    if config.strategy == "semantic":
        score += 20
    elif config.strategy == "hybrid":
        score += 25
    elif config.strategy == "by_heading":
        score += 15
    elif config.strategy == "adaptive":
        score += 18

    # Size optimization (256-1024 is optimal)
    if 256 <= config.chunk_size <= 1024:
        score += 10

    # Overlap ratio (10-30% is optimal)
    overlap_ratio = config.chunk_overlap / config.chunk_size
    if 0.10 <= overlap_ratio <= 0.30:
        score += 10

    return min(100, score)
```

## Special Handling

### File Uploads vs Web Scraping

```python
# File uploads: Content already parsed by Tika
if source.type == "file_upload":
    content = source.parsed_content  # From Tika

# Web sources: May need scraping or use approved content
elif source.type == "web_scraping":
    if source.approved_pages:
        content = source.approved_pages  # User-approved
    else:
        content = crawl4ai.scrape(source.url)  # Fresh scrape
```

### No-Chunking Strategy Special Case

When `no_chunking` is selected:
- All sources combined into single document
- Single embedding for entire content
- Returns `draftSources.length` as chunk count (1 chunk per source)

## Summary

PrivexBot's chunking system provides:

1. **11 Strategies** for different document types
2. **Configurable** chunk sizes and overlaps
3. **Smart Defaults** with adaptive auto-selection
4. **Code Protection** keeps code blocks intact
5. **Rich Metadata** for better retrieval
6. **Quality Scoring** guides configuration
7. **Preset Configurations** for common use cases
