# PrivexBot Chunking Strategies Deep Dive

## Overview

Chunking is the process of splitting documents into smaller segments optimized for:
- **Embedding quality**: Smaller texts produce more focused embeddings
- **Retrieval precision**: Find the most relevant pieces of information
- **LLM context windows**: Fit multiple relevant chunks into the AI's context

PrivexBot implements **11 distinct chunking strategies**, each designed for specific document types and use cases. This guide explains how each strategy works, when to use it, and how chatbots leverage these chunks for accurate responses.

## The 11 Chunking Strategies

### Strategy Overview

| Strategy | Description | Best For | Default Size |
|----------|-------------|----------|--------------|
| **Recursive** | Hierarchical splitting on separators | General content | 1000 chars |
| **Sentence-Based** | Split at sentence boundaries | Precise retrieval, chat logs | 1000 chars |
| **Paragraph-Based** | Split at paragraph breaks | Articles, blog posts | 1000 chars |
| **By Heading** | Split at markdown headings | Documentation, structured docs | 1000 chars |
| **By Section** | Group into logical sections | Technical guides, manuals | 1000 chars |
| **Semantic** | Split at topic boundaries using AI | Q&A, unstructured content | 1000 chars |
| **Adaptive** | Auto-select based on content | Mixed content types | 1000 chars |
| **Hybrid** | Combines multiple strategies | Complex documents | 1000 chars |
| **Token** | Split by token count | LLM context optimization | 1000 chars |
| **No Chunking** | Keep as single chunk | Short documents | N/A |
| **Custom** | User-defined separators | Specific formats | 1000 chars |

---

## 1. Recursive Chunking

### What It Does

Recursive chunking is the **default general-purpose strategy**. It hierarchically splits text using a cascade of separators, trying larger boundaries first and falling back to smaller ones.

### How It Works

```python
# Separator cascade (in order of preference)
separators = ["\n\n", "\n", " ", ""]

# Algorithm:
# 1. Try to split on double newlines (paragraphs)
# 2. If chunks still too large, split on single newlines (lines)
# 3. If still too large, split on spaces (words)
# 4. Last resort: character-level splitting
```

**Real Implementation** (from `chunking_service.py:410-523`):
```python
def _recursive_chunk(self, text, chunk_size, chunk_overlap, separators=None):
    if separators is None:
        separators = ["\n\n", "\n", " ", ""]

    # Use first valid separator
    current_separator = valid_separators[0]
    remaining_separators = valid_separators[1:] + [""]

    splits = text.split(current_separator)

    for split in splits:
        # If split fits in current chunk, add it
        if len(current_chunk) + len(split) <= chunk_size:
            current_chunk += separator + split

        # If split itself is larger than chunk size, recurse
        elif len(split) > chunk_size:
            sub_chunks = self._recursive_chunk(split, chunk_size, chunk_overlap, remaining_separators)
            chunks.extend(sub_chunks)

        # Start new chunk with overlap
        else:
            chunks.append(current_chunk)
            # Include overlap from previous chunk for context
            overlap_start = max(0, len(current_chunk) - chunk_overlap)
            current_chunk = current_chunk[overlap_start:] + separator + split
```

### When to Use

- **General purpose** content with no specific structure
- When you don't know the document type in advance
- For documents with mixed formatting

### Best Document Types

- Plain text files
- General web pages
- User-generated content
- Mixed content types

### Configuration

```typescript
// Frontend configuration
{
  strategy: ChunkingStrategy.RECURSIVE,
  chunk_size: 1000,
  chunk_overlap: 200
}
```

---

## 2. Sentence-Based Chunking

### What It Does

Splits text at sentence boundaries, then groups sentences together until the chunk size is reached. Preserves complete sentences for better semantic integrity.

### How It Works

**Real Implementation** (from `chunking_service.py:526-566`):
```python
def _sentence_chunk(self, text, chunk_size, chunk_overlap):
    # Split on sentence-ending punctuation
    sentences = re.split(r'[.!?]+\s+', text)

    chunks = []
    current_chunk = ""

    for sentence in sentences:
        if len(current_chunk) + len(sentence) <= chunk_size:
            current_chunk += sentence + ". "
        else:
            # Save current chunk and start new one
            chunks.append(current_chunk.strip())
            current_chunk = sentence + ". "

    return chunks
```

### When to Use

- **Precise retrieval** where sentence-level accuracy matters
- Chat logs and conversation transcripts
- Legal documents where sentence integrity is crucial
- FAQ content where each Q&A is a sentence

### Best Document Types

- Chat transcripts
- Legal documents
- FAQ pages
- Customer support tickets
- Product reviews

### Configuration

```typescript
{
  strategy: ChunkingStrategy.BY_SENTENCE, // Maps to "sentence_based"
  chunk_size: 1000,
  chunk_overlap: 100
}
```

---

## 3. Paragraph-Based Chunking

### What It Does

Splits text at paragraph boundaries (double newlines), grouping paragraphs until the chunk size is reached. Ideal for naturally-structured prose.

### How It Works

**Real Implementation** (from `chunking_service.py:601-649`):
```python
def _paragraph_chunk(self, text, chunk_size, chunk_overlap):
    # Split on double newlines
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]

    for paragraph in paragraphs:
        if len(current_chunk) + len(paragraph) + 2 <= chunk_size:
            current_chunk += paragraph + "\n\n"
        else:
            # Handle oversized paragraphs with sentence chunking fallback
            if len(paragraph) > chunk_size:
                sub_chunks = self._sentence_chunk(paragraph, chunk_size, chunk_overlap)
                chunks.extend(sub_chunks)
            else:
                chunks.append(current_chunk)
                current_chunk = paragraph + "\n\n"
```

### When to Use

- **Natural text flow** is important
- Blog posts and articles
- Documents with clear paragraph structure
- Essays and reports

### Best Document Types

- Blog posts
- News articles
- Essays
- Marketing copy
- Newsletter content

### Configuration

```typescript
{
  strategy: ChunkingStrategy.BY_PARAGRAPH, // Maps to "paragraph_based"
  chunk_size: 1000,
  chunk_overlap: 200
}
```

---

## 4. By Heading Chunking

### What It Does

Splits documents at markdown heading boundaries (`#`, `##`, `###`, etc.), preserving the logical structure of documentation.

### How It Works

**Real Implementation** (from `chunking_service.py:652-704`):
```python
def _heading_chunk(self, text, chunk_size, chunk_overlap):
    lines = text.split("\n")

    for line in lines:
        # Detect markdown headings
        is_heading = line.strip().startswith("#") and line.strip().split()[0] in ["#", "##", "###", "####", "#####", "######"]

        if is_heading and current_chunk and len(current_chunk) > 100:
            # Save current chunk and start new one at heading
            chunks.append(current_chunk)
            current_chunk = line + "\n"  # New section starts with heading
        else:
            current_chunk += line + "\n"

            # Check if chunk is getting too large
            if len(current_chunk) > chunk_size:
                chunks.append(current_chunk)
                current_chunk = ""
```

### When to Use

- **Structured documentation** with markdown headings
- Technical documentation
- GitBook, GitHub docs, Notion exports
- Any content with clear heading hierarchy

### Best Document Types

- Technical documentation
- API documentation
- README files
- Knowledge base articles
- Wiki pages
- User manuals

### Configuration

```typescript
{
  strategy: ChunkingStrategy.BY_HEADING,
  chunk_size: 1024,
  chunk_overlap: 200
}
```

**This is the default strategy** in PrivexBot because most knowledge bases contain structured documentation.

---

## 5. By Section Chunking

### What It Does

Groups content into logical sections, similar to heading-based but more aggressive at detecting section boundaries (including all-caps headings and blank space patterns).

### How It Works

**Real Implementation** (from `chunking_service.py:707-762`):
```python
def _section_chunk(self, text, chunk_size, chunk_overlap):
    paragraphs = text.split("\n\n")

    for paragraph in paragraphs:
        # Detect section boundaries
        is_section_boundary = (
            paragraph.strip().startswith("#") or
            len(paragraph.strip()) < 10 or     # Short text (titles)
            paragraph.strip().isupper()         # ALL CAPS headings
        )

        if is_section_boundary and current_section and len(current_section) > 200:
            chunks.append(current_section)
            current_section = paragraph + "\n\n"
        else:
            current_section += paragraph + "\n\n"

            # Split if section gets too large (1.5x chunk_size)
            if len(current_section) > chunk_size * 1.5:
                chunks.append(current_section)
                current_section = ""
```

### When to Use

- **Long-form documentation** with natural sections
- Technical guides and manuals
- Documents without markdown headings but with visual sections

### Best Document Types

- Technical manuals
- User guides
- Installation guides
- Process documentation
- Training materials

### Configuration

```typescript
{
  strategy: "by_section", // Direct string value
  chunk_size: 1000,
  chunk_overlap: 200
}
```

---

## 6. Semantic Chunking

### What It Does

Uses **AI embeddings** to detect topic boundaries. It generates embeddings for each paragraph, calculates similarity between consecutive paragraphs, and splits when similarity drops below a threshold (indicating a topic change).

### How It Works

**Real Implementation** (from `chunking_service.py:765-915`):
```python
def _semantic_chunk(self, text, chunk_size, chunk_overlap, config):
    from app.services.embedding_service_local import embedding_service
    import numpy as np

    # Split into paragraphs
    paragraphs = [p.strip() for p in text.split("\n\n")
                  if len(p.strip()) > config.semantic_min_paragraph_length]

    # Generate embeddings for each paragraph
    embeddings = await embedding_service.generate_embeddings(paragraphs)

    # Calculate similarity between consecutive paragraphs
    similarities = []
    for i in range(len(embeddings) - 1):
        similarity = self._cosine_similarity(embeddings[i], embeddings[i + 1])
        similarities.append(similarity)

    # Split at topic boundaries (low similarity)
    for i in range(len(similarities)):
        should_break = False

        # Topic change detected (low similarity)
        if similarities[i] < config.semantic_threshold:
            should_break = True

        # Chunk too large
        elif current_chunk_size > chunk_size * config.max_chunk_size_multiplier:
            should_break = True

        if should_break:
            chunks.append(current_chunk_paras)
            current_chunk_paras = [next_paragraph]
```

### Configurable Parameters

```python
# ChunkingConfig parameters for semantic chunking
semantic_threshold: float = 0.65  # Topic change threshold (0.0-1.0, lower = more splits)
semantic_min_paragraph_length: int = 20  # Min chars for paragraph
max_chunk_size_multiplier: float = 1.5  # Overflow handling
```

### When to Use

- **Q&A content** where topic boundaries matter
- Unstructured content without headings
- Documents where logical topics vary in length
- When retrieval precision is critical

### Best Document Types

- FAQ pages
- Unstructured Q&A content
- Interview transcripts
- Research papers
- Conference talks/transcripts

### Configuration

```typescript
{
  strategy: ChunkingStrategy.SEMANTIC,
  chunk_size: 1000,
  chunk_overlap: 200,
  semantic_threshold: 0.65  // 0.0-1.0, lower = more splits
}
```

---

## 7. Adaptive Chunking

### What It Does

**Analyzes document structure** and automatically selects the best chunking strategy. It's the "smart" option that examines content characteristics before processing.

### How It Works

**Real Implementation** (from `chunking_service.py:943-993`):
```python
def _adaptive_chunk(self, text, chunk_size, chunk_overlap, config):
    # Analyze document structure
    total_lines = len(text.split("\n"))
    heading_count = len([line for line in text.split("\n") if line.strip().startswith("#")])
    paragraph_count = len([p for p in text.split("\n\n") if p.strip()])

    heading_density = heading_count / total_lines if total_lines > 0 else 0

    # Decision logic with configurable thresholds
    heading_threshold = config.adaptive_heading_density_threshold  # Default 0.05 (5%)
    paragraph_threshold = config.adaptive_paragraph_count_threshold  # Default 10

    # Select strategy based on content
    if heading_density > heading_threshold:
        print(f"[AdaptiveChunking] Using by_heading strategy (density: {heading_density:.3f})")
        return self._heading_chunk(text, chunk_size, chunk_overlap)

    elif paragraph_count > paragraph_threshold:
        print(f"[AdaptiveChunking] Using paragraph_based strategy (paragraphs: {paragraph_count})")
        return self._paragraph_chunk(text, chunk_size, chunk_overlap)

    elif heading_count > 0:
        print(f"[AdaptiveChunking] Using hybrid strategy (headings: {heading_count})")
        return self._hybrid_chunk(text, chunk_size, chunk_overlap, config)

    else:
        print(f"[AdaptiveChunking] Using recursive strategy (fallback)")
        return self._recursive_chunk(text, chunk_size, chunk_overlap, None)
```

### Configurable Parameters

```python
adaptive_heading_density_threshold: float = 0.05  # >5% headings → by_heading
adaptive_paragraph_count_threshold: int = 10      # >10 paragraphs → paragraph_based
```

### When to Use

- **Mixed content types** in a single KB
- When you're not sure which strategy to use
- For KBs with diverse source types (web + files + text)
- Batch processing of varied documents

### Best Document Types

- Mixed knowledge bases
- User-uploaded content (unknown format)
- Multi-source KBs
- General-purpose chatbots

### Configuration

```typescript
{
  strategy: ChunkingStrategy.ADAPTIVE,
  chunk_size: 1000,
  chunk_overlap: 200
}
```

---

## 8. Hybrid Chunking

### What It Does

Combines multiple strategies in a two-pass approach:
1. **Primary pass**: Heading-based chunking with larger allowed size
2. **Refinement pass**: Paragraph-based splitting for oversized chunks

### How It Works

**Real Implementation** (from `chunking_service.py:996-1041`):
```python
def _hybrid_chunk(self, text, chunk_size, chunk_overlap, config):
    max_multiplier = config.max_chunk_size_multiplier  # Default 1.5

    # Step 1: Primary chunking by headings (allow larger initial chunks)
    primary_chunks = self._heading_chunk(text, int(chunk_size * max_multiplier), chunk_overlap)

    # Step 2: Refine oversized chunks
    refined_chunks = []
    for chunk in primary_chunks:
        if len(chunk["content"]) > chunk_size * max_multiplier:
            # Apply paragraph-based splitting
            sub_chunks = self._paragraph_chunk(chunk["content"], chunk_size, chunk_overlap)
            refined_chunks.extend(sub_chunks)
        else:
            refined_chunks.append(chunk)

    # Step 3: Re-index chunks
    for i, chunk in enumerate(refined_chunks):
        chunk["index"] = i

    return refined_chunks
```

### When to Use

- **Complex documents** with both structure and prose
- Technical documentation with long explanatory sections
- When heading-based alone produces chunks that are too large
- For best overall retrieval quality

### Best Document Types

- Technical documentation with explanations
- API docs with examples
- User manuals with procedures
- Product documentation
- Complex web pages

### Configuration

```typescript
{
  strategy: ChunkingStrategy.HYBRID,
  chunk_size: 1024,
  chunk_overlap: 200
}
```

---

## 9. Token-Based Chunking

### What It Does

Chunks based on **token count** rather than character count. Uses an approximate conversion (4 characters ≈ 1 token) to respect LLM context window limits.

### How It Works

**Real Implementation** (from `chunking_service.py:569-598`):
```python
def _token_chunk(self, text, chunk_size, chunk_overlap, config):
    # Use configurable chars per token (default ~4)
    char_per_token = config.chars_per_token

    # Convert token limits to character limits
    chunk_size_chars = chunk_size * char_per_token
    chunk_overlap_chars = chunk_overlap * char_per_token

    # Use recursive chunking with token-adjusted sizes
    return self._recursive_chunk(text, chunk_size_chars, chunk_overlap_chars)
```

### When to Use

- **LLM context window optimization** is critical
- When you need precise token control
- For chunking with specific embedding model token limits
- When integrating with token-based billing

### Best Document Types

- Any content where token count matters
- Content for specific LLM integrations
- When optimizing for API costs

### Configuration

```typescript
{
  strategy: "token",
  chunk_size: 256,  // Token count, not characters
  chunk_overlap: 50
}
```

---

## 10. No Chunking (Full Content)

### What It Does

Keeps the entire document as a **single chunk**. No splitting occurs - the entire document content is stored as one unit.

### How It Works

**Real Implementation** (from `chunking_service.py:1044-1050`):
```python
def _full_content_chunk(self, text):
    if not text.strip():
        return []
    return [self._create_chunk_metadata(text.strip(), 0)]
```

### When to Use

- **Short documents** that fit in a single embedding
- When you need the **full context** always available
- Product descriptions
- FAQ entries where each Q&A is a single document

### Best Document Types

- FAQ entries (individual Q&A pairs)
- Short product descriptions
- Brief policy documents
- Tweet-like content
- Configuration files

### Configuration

```typescript
{
  strategy: ChunkingStrategy.NO_CHUNKING, // or "full_content"
  // chunk_size and chunk_overlap are ignored
}
```

**Note**: The frontend correctly calculates that `NO_CHUNKING` produces `1 chunk per source`:
```typescript
if (chunkingConfig.strategy === ChunkingStrategy.NO_CHUNKING) {
  return draftSources.length;  // One chunk per source
}
```

---

## 11. Custom Chunking

### What It Does

Allows you to specify **custom separators** for splitting. Uses the recursive algorithm but with your own separator list.

### How It Works

**Real Implementation** (from `chunking_service.py:1052-1064`):
```python
def _custom_chunk(self, text, chunk_size, chunk_overlap, separators=None):
    if not separators:
        # Fall back to recursive if no separators provided
        return self._recursive_chunk(text, chunk_size, chunk_overlap)

    # Use recursive chunking with custom separators
    return self._recursive_chunk(text, chunk_size, chunk_overlap, separators)
```

### When to Use

- **Specific formats** with unique separators
- Custom delimiters (e.g., `---`, `===`, `<!-- split -->`)
- Proprietary document formats
- When you know exactly how your content should be split

### Best Document Types

- Custom log formats
- Structured data exports
- Documents with specific markers
- Any format with known separators

### Configuration

```typescript
{
  strategy: ChunkingStrategy.CUSTOM,
  chunk_size: 1000,
  chunk_overlap: 200,
  custom_separators: ["\\n\\n", "---", "===", "<!-- split -->", "### "]
}
```

---

## Default Configuration and Presets

### System Defaults

From `chunking_service.py:34-87`:

```python
@dataclass
class ChunkingConfig:
    # Core defaults
    default_chunk_size: int = 1000
    default_chunk_overlap: int = 200
    min_chunk_size: int = 50  # Chunks smaller are merged

    # Semantic chunking
    semantic_threshold: float = 0.65
    semantic_min_paragraph_length: int = 20

    # Adaptive chunking thresholds
    adaptive_heading_density_threshold: float = 0.05  # 5%
    adaptive_paragraph_count_threshold: int = 10

    # Overflow handling
    max_chunk_size_multiplier: float = 1.5
    chars_per_token: int = 4
```

### Frontend Default (KB Store)

From `kb-store.ts:249-264`:

```typescript
const initialChunkingConfig: ChunkingConfig = {
  strategy: ChunkingStrategy.BY_HEADING,  // Default strategy
  chunk_size: 1000,
  chunk_overlap: 200,
  preserve_code_blocks: true,
  enable_enhanced_metadata: false,
  semantic_threshold: 0.7,
  min_chunk_size: 50,
  max_chunk_size: 2048
};
```

### Frontend Presets

From `KBChunkingConfig.tsx:32-78`:

| Preset | Strategy | Chunk Size | Overlap | Use Case |
|--------|----------|------------|---------|----------|
| **Precise** | Semantic | 256 | 50 | High precision, detailed answers |
| **Balanced** | By Heading | 512 | 100 | Good balance for most use cases |
| **Contextual** | Hybrid | 1024 | 200 | Rich context, comprehensive answers |

---

## How Users Configure Chunking

### Direct Configuration (Advanced Users)

Users can directly configure chunking in the KB creation flow:

1. **Strategy Selection**: Radio buttons with 9 visible strategies
2. **Chunk Size**: Slider (100-4000 characters)
3. **Chunk Overlap**: Slider (0-500 characters)
4. **Strategy-Specific Options**:
   - Semantic: Similarity threshold slider (0.1-1.0)
   - Custom: Textarea for custom separators

### Indirect Configuration (Presets)

Most users select a preset and the system configures everything:

```typescript
// When user selects "Balanced" preset:
const preset = {
  strategy: ChunkingStrategy.BY_HEADING,
  chunk_size: 512,
  chunk_overlap: 100
};
updateChunkingConfig(preset);
```

### Processing Options

Users can enable additional processing options:

1. **Preserve Code Blocks** (default: true)
   - Protects code blocks from being split during chunking
   - Implementation uses placeholder replacement before chunking, then restoration

2. **Enhanced Metadata** (default: false)
   - Adds `context_before`, `context_after`, `parent_heading` to chunks
   - Improves retrieval quality but increases processing time

---

## How Chatbots Use Chunks

### The RAG Pipeline

When a user asks a question, the chatbot:

1. **Generates Query Embedding**: User's question → 384-dimensional vector
2. **Searches Vector Store**: Find similar chunks in Qdrant
3. **Retrieves Top Chunks**: Based on search strategy and settings
4. **Builds Context**: Combine relevant chunks into prompt
5. **Generates Response**: Send to Secret AI with context

### Search Strategies

From `retrieval_service.py`:

| Strategy | Description | Weight |
|----------|-------------|--------|
| **Semantic** | Pure vector similarity | 100% vector |
| **Keyword** | Full-text search | 100% keyword |
| **Hybrid** | Vector + Keyword | 70% vector, 30% keyword |
| **MMR** | Diversity-aware | Balances relevance & diversity |
| **Threshold** | Quality-focused | Only high-confidence matches |

### How Chunk Size Affects Retrieval

```
User Question: "How do I install the app?"

Smaller chunks (256 chars):
  → More precise matches
  → May miss surrounding context
  → Returns more chunks to cover topic
  → Example: "To install, run npm install"

Larger chunks (1024 chars):
  → More context in each chunk
  → May include irrelevant content
  → Fewer chunks needed
  → Example: "## Installation\n\nTo install, run npm install...[full section]"
```

### Configuration Priority for Retrieval

```
1. Caller Override (API parameters)     ← Highest priority
2. KB-Level Config (retrieval_config)
3. Service Defaults (top_k=5, hybrid)   ← Lowest priority
```

### Annotation Boosting

Chunks with annotations get score boosts:

```python
# From retrieval_service.py:727-753
if annotations:
    result["score"] *= 1.2  # Base boost

    if importance == "high":
        result["score"] *= 1.25  # Additional boost
    elif importance == "critical":
        result["score"] *= 1.5
```

---

## Strategy Selection Guide

### By Document Type

| Document Type | Recommended Strategy | Why |
|---------------|---------------------|-----|
| API Documentation | By Heading | Preserves endpoint structure |
| FAQ | Semantic or No Chunking | Topic-aware or per-entry |
| Blog Posts | Paragraph-Based | Natural prose flow |
| Technical Manuals | Hybrid | Structure + detail balance |
| Chat Logs | Sentence-Based | Preserve message integrity |
| Legal Documents | Sentence-Based | Clause-level precision |
| Mixed Content | Adaptive | Auto-selects best approach |
| Short Descriptions | No Chunking | Keep full context |
| Code Documentation | By Heading + Preserve Code | Protect code blocks |

### By Use Case

| Use Case | Strategy | Settings |
|----------|----------|----------|
| Precise Q&A | Semantic | chunk_size: 256, threshold: 0.7 |
| General Support | By Heading | chunk_size: 512, overlap: 100 |
| Comprehensive Answers | Hybrid | chunk_size: 1024, overlap: 200 |
| Legal/Compliance | Sentence-Based | chunk_size: 512, threshold: 0.8 |
| Product Catalog | No Chunking | per-product documents |
| Unknown Content | Adaptive | default settings |

---

## Code Block Protection

### How It Works

Code blocks are protected from being split mid-block:

**From `chunking_service.py:210-284`**:

```python
def _protect_code_blocks(self, text, chunk_size):
    code_block_pattern = re.compile(r'```[\s\S]*?```', re.MULTILINE)
    code_block_map = {}

    def replace_code_block(match):
        code_block = match.group(0)
        block_id = f"__CODE_BLOCK_{uuid}__"

        # If small enough, protect it
        if len(code_block) <= chunk_size * 1.5:
            code_block_map[block_id] = code_block
            return f"\n{block_id}\n"  # Single-line placeholder
        else:
            # Large blocks become their own chunks
            return f"\n\n{code_block}\n\n"

    return processed_text, code_block_map

def _restore_code_blocks(self, chunks, code_block_map):
    for chunk in chunks:
        for block_id, code_block in code_block_map.items():
            chunk["content"] = chunk["content"].replace(block_id, code_block)
```

---

## Chunk Metadata Structure

Each chunk includes metadata for retrieval:

```python
{
    "content": "The actual chunk text...",
    "index": 0,
    "start_pos": 0,
    "end_pos": 1000,
    "token_count": 250,  # Estimated: len(content) // 4
    "metadata": {
        "word_count": 180,
        "chunk_length": 1000,
        "character_count": 1000,
        "has_code_block": True  # If code blocks present
    }
}
```

---

## Performance Considerations

### Chunk Size vs Performance

| Chunk Size | Embedding Time | Search Time | Storage | Retrieval Quality |
|------------|----------------|-------------|---------|-------------------|
| 256 chars | Very fast | Fast | More vectors | High precision |
| 512 chars | Fast | Fast | Moderate | Good balance |
| 1024 chars | Moderate | Moderate | Fewer vectors | More context |
| 2048 chars | Slower | Slower | Minimal | Maximum context |

### Typical Processing Times

| Operation | Latency |
|-----------|---------|
| Embedding (100 chunks) | ~1 second |
| Vector search (100k vectors) | 15-50ms |
| Chunk generation (1000 chars) | ~1ms |

---

## Summary

PrivexBot's 11 chunking strategies provide flexibility for any document type:

1. **Recursive**: Default general-purpose
2. **Sentence-Based**: Precise sentence boundaries
3. **Paragraph-Based**: Natural text flow
4. **By Heading**: Structured documentation
5. **By Section**: Logical groupings
6. **Semantic**: AI-powered topic detection
7. **Adaptive**: Auto-selects best strategy
8. **Hybrid**: Multi-pass refinement
9. **Token**: LLM context optimization
10. **No Chunking**: Small documents
11. **Custom**: User-defined separators

The **default strategy is By Heading** with 1000 character chunks and 200 character overlap, which works well for most structured documentation. For precise retrieval, use smaller chunks (256-512) with Semantic strategy. For comprehensive context, use larger chunks (1024+) with Hybrid strategy.
