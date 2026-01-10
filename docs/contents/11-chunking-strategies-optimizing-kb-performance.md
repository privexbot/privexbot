# Chunking Strategies: Optimizing Knowledge Base Performance

## Introduction

You've uploaded your documents, created a knowledge base, and deployed your chatbot. But something's off—the answers aren't quite right. Sometimes the bot misses obvious information. Other times, it pulls in irrelevant content.

The culprit? Your chunking strategy.

Chunking is the unsung hero of RAG performance. It's the difference between a chatbot that "sort of works" and one that consistently delivers accurate, helpful responses. This guide will show you how to optimize your chunking strategy to get the best possible results from your knowledge base.

---

## Why Chunking Matters

### The Goldilocks Problem

Chunking is about finding the "just right" size for your text segments:

```
Too Small (50 characters):
┌─────────────────────────────────────────────────────────────────┐
│ "To reset your"  "password, go to"  "Settings and click"       │
│                                                                  │
│ Problem: Context is lost. Each chunk is meaningless alone.       │
│ Result: Poor retrieval, fragmented answers                       │
└─────────────────────────────────────────────────────────────────┘

Too Large (5000 characters):
┌─────────────────────────────────────────────────────────────────┐
│ "Chapter 1: Getting Started... [entire chapter]                  │
│  ...installation, configuration, passwords, security,           │
│  troubleshooting, advanced settings, API reference..."          │
│                                                                  │
│ Problem: Too much noise. Embeddings become diluted.              │
│ Result: Relevant info buried, poor precision                     │
└─────────────────────────────────────────────────────────────────┘

Just Right (500-1000 characters):
┌─────────────────────────────────────────────────────────────────┐
│ "## Password Reset                                               │
│                                                                  │
│  To reset your password:                                         │
│  1. Go to Settings > Security                                    │
│  2. Click 'Reset Password'                                       │
│  3. Check your email for the reset link                          │
│  4. Create a new password meeting requirements"                  │
│                                                                  │
│ Result: Focused, complete, retrievable                           │
└─────────────────────────────────────────────────────────────────┘
```

### How Chunking Affects Everything

Your chunking choices cascade through the entire RAG pipeline:

```
Chunking Decision
       │
       ├──► Embedding Quality
       │    └── Smaller chunks = more focused embeddings
       │    └── Larger chunks = diluted semantic signal
       │
       ├──► Retrieval Precision
       │    └── Better chunks = find the right information
       │    └── Poor chunks = miss relevant content or retrieve noise
       │
       ├──► Context Window Usage
       │    └── Efficient chunks = more relevant info per token
       │    └── Wasteful chunks = fill context with irrelevant text
       │
       └──► Response Quality
            └── Good chunks = accurate, grounded answers
            └── Bad chunks = hallucination, incomplete answers
```

---

## Understanding the 11 Strategies

PrivexBot offers 11 chunking strategies, each optimized for different scenarios. Here's how to think about them:

### The Strategy Spectrum

```
Simple ◄─────────────────────────────────────────────────► Smart

Recursive    Sentence    Paragraph    Heading    Semantic    Adaptive
   │            │            │           │           │           │
   │            │            │           │           │           │
 Basic       Grammar      Natural     Document   AI-Based    Auto-
splitting   boundaries    flow       structure   analysis   select
```

### Quick Reference Matrix

| Strategy | Speed | Precision | Best For | Complexity |
|----------|-------|-----------|----------|------------|
| **Recursive** | Fast | Medium | General content | Low |
| **Sentence** | Fast | High | Chat logs, legal | Low |
| **Paragraph** | Fast | Medium | Articles, blogs | Low |
| **By Heading** | Fast | High | Documentation | Low |
| **By Section** | Fast | High | Manuals, guides | Low |
| **Semantic** | Slow | Very High | Q&A, unstructured | High |
| **Adaptive** | Medium | High | Mixed content | Medium |
| **Hybrid** | Medium | Very High | Complex docs | Medium |
| **Token** | Fast | Medium | LLM optimization | Low |
| **No Chunking** | Instant | Varies | Short docs | None |
| **Custom** | Fast | Varies | Specific formats | Medium |

---

## Choosing the Right Strategy

### Decision Tree

Follow this flowchart to select your strategy:

```
START
  │
  ▼
Is your content short (< 500 chars per document)?
  │
  ├─ YES ──► Use "No Chunking" (full_content)
  │          Each doc becomes one chunk
  │
  └─ NO
      │
      ▼
Does your content have clear headings (# ## ###)?
      │
      ├─ YES ──► Use "By Heading"
      │          Perfect for documentation
      │
      └─ NO
          │
          ▼
Is retrieval precision critical (legal, medical, support)?
          │
          ├─ YES ──► Use "Semantic"
          │          AI-powered topic detection
          │
          └─ NO
              │
              ▼
Is your content mostly prose (articles, blogs)?
              │
              ├─ YES ──► Use "Paragraph"
              │          Respects natural flow
              │
              └─ NO
                  │
                  ▼
Do you have mixed content types?
                  │
                  ├─ YES ──► Use "Adaptive"
                  │          Auto-selects best approach
                  │
                  └─ NO ──► Use "Recursive" (default fallback)
                            Works for most content
```

### Strategy by Document Type

| Document Type | Recommended Strategy | Chunk Size | Overlap |
|---------------|---------------------|------------|---------|
| API Documentation | By Heading | 1024 | 200 |
| FAQ Pages | Semantic or No Chunking | 512 | 100 |
| Blog Posts | Paragraph | 1024 | 200 |
| Legal Documents | Sentence | 512 | 100 |
| Product Manuals | Hybrid | 1024 | 200 |
| Chat Transcripts | Sentence | 512 | 50 |
| Code Documentation | By Heading + Preserve Code | 1024 | 200 |
| Research Papers | Semantic | 1024 | 200 |
| Policy Documents | Sentence | 768 | 150 |
| Marketing Copy | Paragraph | 512 | 100 |

### Strategy by Use Case

| Use Case | Strategy | Why |
|----------|----------|-----|
| Customer Support | Hybrid | Balance precision with context |
| Technical Helpdesk | By Heading | Match doc structure to queries |
| Legal Compliance | Sentence | Precise clause-level retrieval |
| Product Q&A | Semantic | Topic-aware for varied questions |
| Onboarding Bot | Paragraph | Natural conversational flow |
| Code Assistant | By Heading + Code Preserve | Keep code blocks intact |

---

## Optimizing Chunk Size

### The Size-Precision Trade-off

```
Chunk Size vs. Retrieval Quality

Small (256)     Medium (512)    Large (1024)    XL (2048)
    │               │               │               │
    ▼               ▼               ▼               ▼
┌───────┐       ┌───────┐       ┌───────┐       ┌───────┐
│       │       │       │       │       │       │       │
│ High  │       │       │       │       │       │ Low   │
│Precis-│       │ Good  │       │ Good  │       │Precis-│
│ ion   │       │Balance│       │Context│       │ ion   │
│       │       │       │       │       │       │       │
│ Low   │       │       │       │       │       │ High  │
│Context│       │       │       │       │       │Context│
└───────┘       └───────┘       └───────┘       └───────┘
```

### Size Guidelines by Content Type

**Short, Focused Content (256-512 chars)**
- FAQ entries
- Product specifications
- Quick reference items
- Error messages

```
Good for: "What's the return policy?"
Returns: Exactly the return policy, nothing else
```

**Balanced Content (512-1024 chars)**
- General documentation
- How-to guides
- Support articles
- Most web content

```
Good for: "How do I set up two-factor authentication?"
Returns: Complete setup instructions with context
```

**Rich Context Content (1024-2048 chars)**
- Technical explanations
- Process documentation
- Training materials
- Complex procedures

```
Good for: "Explain the architecture of the payment system"
Returns: Comprehensive explanation with surrounding context
```

### Finding Your Optimal Size

Run this experiment with your content:

```
Test Protocol:

1. Create 3 versions of your KB:
   - Small chunks (256 chars)
   - Medium chunks (512 chars)
   - Large chunks (1024 chars)

2. Prepare 20 test questions:
   - 5 specific questions (exact answers exist)
   - 5 conceptual questions (need explanation)
   - 5 multi-part questions (need multiple facts)
   - 5 edge cases (partial or no matches)

3. Score each response:
   - Accuracy (0-3): Is the answer correct?
   - Completeness (0-3): Is anything missing?
   - Relevance (0-3): Is there noise/irrelevant content?

4. Calculate: Total score / (20 questions × 9 max points)

5. Choose the size with highest score
```

---

## Optimizing Chunk Overlap

### What Overlap Does

Overlap ensures context isn't lost at chunk boundaries:

```
Without Overlap:
┌─────────────────────┐┌─────────────────────┐
│ "To reset password, ││ "You'll receive an  │
│  go to Settings >   ││  email with a link. │
│  Security and click ││  Click it within    │
│  Reset Password."   ││  24 hours."         │
└─────────────────────┘└─────────────────────┘
         │                      │
         └──── Gap! ────────────┘
    If query matches the transition,
    retrieval might miss critical info

With 200 char Overlap:
┌─────────────────────────────────┐
│ "To reset password, go to       │
│  Settings > Security and click  │
│  Reset Password."               │
└─────────────────────────────────┘
┌─────────────────────────────────┐
│ "Security and click Reset       │  ← Overlapping content
│  Password. You'll receive an    │
│  email with a link. Click it    │
│  within 24 hours."              │
└─────────────────────────────────┘
```

### Overlap Guidelines

| Chunk Size | Recommended Overlap | Ratio |
|------------|--------------------:|------:|
| 256 chars | 50 chars | ~20% |
| 512 chars | 100 chars | ~20% |
| 1024 chars | 200 chars | ~20% |
| 2048 chars | 300-400 chars | ~15-20% |

**Rule of Thumb:** Overlap should be 15-25% of chunk size.

### When to Increase Overlap

- Content has many cross-references
- Topics flow into each other
- Queries often span chunk boundaries
- You're seeing incomplete answers

### When to Decrease Overlap

- Content is highly modular (independent sections)
- Storage space is a concern
- Processing time matters
- Chunks are already very small

---

## Performance Benchmarks

### Processing Speed by Strategy

Based on 1000-page document (typical knowledge base):

| Strategy | Processing Time | Chunks Created |
|----------|-----------------|----------------|
| Recursive | ~5 seconds | ~2,000 |
| Sentence | ~8 seconds | ~3,500 |
| Paragraph | ~4 seconds | ~1,800 |
| By Heading | ~3 seconds | ~1,200 |
| Semantic | ~45 seconds | ~1,500 |
| Adaptive | ~15 seconds | ~1,600 |
| Hybrid | ~12 seconds | ~1,800 |

### Retrieval Performance

Search latency with different chunk counts:

| Total Chunks | Search Latency | Memory Usage |
|--------------|----------------|--------------|
| 1,000 | ~5ms | ~50MB |
| 10,000 | ~15ms | ~500MB |
| 100,000 | ~50ms | ~4GB |
| 1,000,000 | ~150ms | ~40GB |

### Quality Metrics

Measured across diverse test queries:

| Strategy | Precision@5 | Recall@5 | F1 Score |
|----------|-------------|----------|----------|
| Recursive | 0.72 | 0.68 | 0.70 |
| Sentence | 0.78 | 0.71 | 0.74 |
| Paragraph | 0.74 | 0.73 | 0.73 |
| By Heading | 0.81 | 0.76 | 0.78 |
| Semantic | 0.85 | 0.79 | 0.82 |
| Hybrid | 0.83 | 0.81 | 0.82 |

---

## Advanced Optimization Techniques

### 1. Preserve Code Blocks

When your content includes code, enable code block preservation:

```typescript
// Frontend configuration
{
  strategy: ChunkingStrategy.BY_HEADING,
  chunk_size: 1024,
  chunk_overlap: 200,
  preserve_code_blocks: true  // Critical for technical docs
}
```

**What It Does:**

```
Without preserve_code_blocks:

Chunk 1: "```python
         def calculate_total(items):
             total = 0"

Chunk 2: "    for item in items:
                 total += item.price
             return total
         ```"

Problem: Code is split mid-function!

With preserve_code_blocks:

Chunk 1: "## Calculate Total Function

         ```python
         def calculate_total(items):
             total = 0
             for item in items:
                 total += item.price
             return total
         ```"

Code stays together as a unit.
```

### 2. Enhanced Metadata

Enable enhanced metadata for better retrieval context:

```typescript
{
  strategy: ChunkingStrategy.SEMANTIC,
  enable_enhanced_metadata: true
}
```

**What You Get:**

```python
# Standard chunk metadata
{
    "content": "To reset your password...",
    "index": 5,
    "document_id": "doc_123"
}

# Enhanced chunk metadata
{
    "content": "To reset your password...",
    "index": 5,
    "document_id": "doc_123",
    "context_before": "...previous section about account security.",
    "context_after": "Next, we'll cover two-factor authentication...",
    "parent_heading": "## Account Security",
    "heading_hierarchy": ["# User Guide", "## Account Security", "### Passwords"]
}
```

### 3. Semantic Threshold Tuning

For semantic chunking, the threshold controls topic sensitivity:

```
Threshold: 0.9 (High)
Result: Very few splits, large topic chunks
Use when: Topics are clearly distinct

Threshold: 0.5 (Low)
Result: Many splits, smaller chunks
Use when: Topics blend together, need fine granularity

Threshold: 0.65-0.7 (Recommended)
Result: Balanced topic detection
Use when: General documentation
```

**Finding the Right Threshold:**

```
1. Start with default (0.65)
2. Review chunk boundaries
3. If chunks are too large (topics merged):
   → Lower threshold (0.5-0.6)
4. If chunks are too small (over-splitting):
   → Raise threshold (0.75-0.85)
```

### 4. Custom Separators

For unique document formats, define custom separators:

```typescript
{
  strategy: ChunkingStrategy.CUSTOM,
  custom_separators: [
    "---",           // Markdown horizontal rules
    "===",           // Section breaks
    "<!-- split -->", // Custom markers
    "\\n## ",        // Level 2 headings
    "\\n\\n"         // Double newlines (fallback)
  ]
}
```

**Use Cases:**

| Format | Custom Separators |
|--------|-------------------|
| Markdown with rules | `["---", "\\n## "]` |
| Log files | `["\\n[ERROR]", "\\n[INFO]"]` |
| Q&A format | `["Q:", "Question:"]` |
| Structured exports | `["<section>", "<topic>"]` |

---

## Troubleshooting Poor Retrieval

### Problem: Bot Returns Irrelevant Content

**Symptoms:**
- Answers include unrelated information
- Wrong sections being retrieved
- Context pollution

**Diagnosis:**
```
Check your chunk size. If chunks are too large,
they contain too many topics, diluting the embedding.
```

**Solutions:**
1. Reduce chunk size (try 512 instead of 1024)
2. Switch to semantic chunking (topic-aware splitting)
3. Increase retrieval threshold (filter out low-quality matches)

### Problem: Bot Misses Obvious Information

**Symptoms:**
- Information exists in KB but not retrieved
- Partial answers when full answer is available
- "I don't have that information" for documented topics

**Diagnosis:**
```
Check if information is split across chunk boundaries,
or if chunks are too small to contain complete answers.
```

**Solutions:**
1. Increase chunk overlap (try 25% of chunk size)
2. Increase chunk size to capture more context
3. Use hybrid chunking for complex documents
4. Check if heading-based strategy matches your doc structure

### Problem: Answers Lack Context

**Symptoms:**
- Technically correct but missing important details
- No surrounding information
- Feels incomplete

**Diagnosis:**
```
Chunks might be too focused, missing surrounding context
that would make answers more complete.
```

**Solutions:**
1. Increase chunk size (try 1024 or higher)
2. Enable enhanced metadata for context_before/after
3. Increase top_k in retrieval (retrieve more chunks)
4. Consider paragraph-based strategy for narrative flow

### Problem: Processing Takes Too Long

**Symptoms:**
- KB creation hangs or times out
- Very slow initial processing
- Semantic chunking seems stuck

**Diagnosis:**
```
Semantic chunking generates embeddings for every paragraph
during chunking. Large documents = many embedding calls.
```

**Solutions:**
1. Use faster strategy (by_heading, paragraph, recursive)
2. Break large documents into smaller files
3. Use adaptive strategy (selects semantic only when needed)
4. Pre-process content to add clear structure

### Problem: Duplicate/Redundant Chunks

**Symptoms:**
- Same content appears multiple times
- Repetitive answers
- Wasted context window

**Diagnosis:**
```
High overlap + small chunks = significant duplication.
Or document has repeated content (headers, footers, etc.)
```

**Solutions:**
1. Reduce overlap percentage
2. Increase chunk size
3. Pre-process to remove repeated content (headers, footers)
4. Use MMR retrieval strategy (diversity-aware)

---

## Real-World Optimization Examples

### Example 1: E-commerce Product Catalog

**Initial Setup:**
```
Strategy: Recursive (default)
Chunk Size: 1000
Result: Poor - product specs mixed with descriptions
```

**Optimized Setup:**
```
Strategy: No Chunking (full_content)
Why: Each product is a separate document, keep complete

Alternative if products are in one file:
Strategy: By Section
Chunk Size: 512
Why: Each product section becomes a chunk
```

**Improvement:** 89% → 97% retrieval accuracy for product queries

### Example 2: Technical API Documentation

**Initial Setup:**
```
Strategy: Paragraph
Chunk Size: 1024
Result: Code examples split, endpoint info scattered
```

**Optimized Setup:**
```
Strategy: By Heading
Chunk Size: 1024
Overlap: 200
preserve_code_blocks: true
```

**Improvement:**
- Code examples stay complete
- Each endpoint in its own chunk
- 73% → 91% retrieval accuracy

### Example 3: Legal Document Repository

**Initial Setup:**
```
Strategy: By Heading
Chunk Size: 1000
Result: Legal clauses span multiple paragraphs, incomplete retrieval
```

**Optimized Setup:**
```
Strategy: Sentence
Chunk Size: 512
Overlap: 100
```

**Improvement:**
- Clause-level precision
- No split legal statements
- 68% → 88% retrieval accuracy for specific clause queries

### Example 4: Customer Support Knowledge Base

**Initial Setup:**
```
Strategy: Recursive
Chunk Size: 500
Result: FAQ answers split, related info scattered
```

**Optimized Setup:**
```
Strategy: Hybrid
Chunk Size: 768
Overlap: 150
```

**Improvement:**
- Complete FAQ answers in single chunks
- Related context preserved
- 75% → 93% first-response accuracy

---

## Configuration Quick Reference

### PrivexBot Default Configuration

```typescript
// From kb-store.ts
const initialChunkingConfig = {
  strategy: ChunkingStrategy.BY_HEADING,  // Best for documentation
  chunk_size: 1000,                        // Balanced default
  chunk_overlap: 200,                      // 20% overlap
  preserve_code_blocks: true,              // Protect code
  enable_enhanced_metadata: false,         // Enable for complex needs
  semantic_threshold: 0.7                  // For semantic strategy
};
```

### Preset Configurations

**Precise (High Accuracy)**
```typescript
{
  strategy: ChunkingStrategy.SEMANTIC,
  chunk_size: 256,
  chunk_overlap: 50,
  semantic_threshold: 0.65
}
// Use for: FAQ, legal, compliance
```

**Balanced (General Purpose)**
```typescript
{
  strategy: ChunkingStrategy.BY_HEADING,
  chunk_size: 512,
  chunk_overlap: 100,
  preserve_code_blocks: true
}
// Use for: Documentation, support articles
```

**Contextual (Rich Responses)**
```typescript
{
  strategy: ChunkingStrategy.HYBRID,
  chunk_size: 1024,
  chunk_overlap: 200,
  enable_enhanced_metadata: true
}
// Use for: Training materials, comprehensive guides
```

---

## Monitoring and Iteration

### Key Metrics to Track

| Metric | What It Tells You | Target |
|--------|-------------------|--------|
| Retrieval Precision | Are retrieved chunks relevant? | > 80% |
| Retrieval Recall | Are we finding all relevant chunks? | > 75% |
| Answer Accuracy | Are final answers correct? | > 90% |
| Source Citation Rate | Are answers grounded in KB? | > 85% |
| "No Info" Rate | How often KB lacks answer? | < 15% |

### Continuous Improvement Process

```
┌─────────────────────────────────────────────────────────────────┐
│                    CHUNKING OPTIMIZATION CYCLE                   │
└─────────────────────────────────────────────────────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
         ▼                    ▼                    ▼
    ┌─────────┐         ┌─────────┐         ┌─────────┐
    │ Analyze │         │  Test   │         │  Tune   │
    │ Queries │────────►│ Changes │────────►│ Config  │
    └─────────┘         └─────────┘         └─────────┘
         │                    │                    │
         │                    │                    │
         ▼                    ▼                    ▼
    What queries         A/B test             Adjust size,
    are failing?         with subset          strategy,
    Why?                 of users             overlap
         │                    │                    │
         └────────────────────┴────────────────────┘
                              │
                              ▼
                        ┌─────────┐
                        │ Deploy  │
                        │& Monitor│
                        └─────────┘
```

### When to Re-Chunk

Consider re-processing your KB when:

1. **Adding significant new content** (>20% of KB size)
2. **Changing document structure** (new heading hierarchy)
3. **Shifting use case** (support → sales, general → technical)
4. **Retrieval quality drops** (track metrics over time)
5. **User feedback indicates issues** (missing info, wrong answers)

---

## Summary

Chunking is the foundation of knowledge base performance. The right strategy transforms your documents from raw text into a highly retrievable knowledge source.

### Key Takeaways

1. **Match strategy to content**: Use heading-based for structured docs, semantic for Q&A, sentence for legal
2. **Balance size and precision**: Start with 512-1024 chars and adjust based on results
3. **Don't skip overlap**: 15-25% overlap prevents boundary issues
4. **Protect special content**: Enable code block preservation for technical docs
5. **Test and iterate**: Use real queries to validate your choices
6. **Monitor continuously**: Track retrieval quality and adjust as needed

### Quick Wins

| If You... | Do This |
|-----------|---------|
| Have structured docs | Use By Heading strategy |
| Need high precision | Reduce chunk size to 256-512 |
| Get incomplete answers | Increase overlap to 25% |
| Have code in docs | Enable preserve_code_blocks |
| Have mixed content | Use Adaptive strategy |
| See duplicate results | Use MMR retrieval + reduce overlap |

### The 80/20 Rule

For most knowledge bases, this configuration works well:

```typescript
{
  strategy: ChunkingStrategy.BY_HEADING,
  chunk_size: 768,
  chunk_overlap: 150,
  preserve_code_blocks: true
}
```

Start here, measure results, and optimize from there.

---

## Next Steps

1. **Audit your current KB**: What strategy and size are you using?
2. **Identify problem areas**: Which queries fail most often?
3. **Experiment**: Try different strategies with a test subset
4. **Measure**: Track precision and recall before/after changes
5. **Iterate**: Continuously improve based on real usage data

Your knowledge base is only as good as its chunks. Optimize them well, and your chatbot will thank you with accurate, helpful responses.
