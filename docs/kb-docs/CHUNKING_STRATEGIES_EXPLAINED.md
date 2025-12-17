# Chunking Strategies - Deep Dive

## Overview

This document explains how chunking configuration flows through the PrivexBot Knowledge Base system, what each strategy does, and how it determines what gets stored.

---

## 1. Configuration Flow: Where → How → What

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          CONFIGURATION SOURCES                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. Frontend (User Selection)                                               │
│     └─→ kb-drafts/{id}/chunking endpoint                                    │
│         └─→ {"strategy": "recursive", "chunk_size": 300, "chunk_overlap": 75}│
│                                                                             │
│  2. Finalize Request                                                        │
│     └─→ {"chunking_config": {...}} in request body                          │
│                                                                             │
│  3. KB Config (Database)                                                    │
│     └─→ kb.config.chunking = {...}                                          │
│                                                                             │
│  PRIORITY: user_config > kb.config > adaptive_analysis > defaults           │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│               SMART_KB_SERVICE.make_chunking_decision()                     │
│               File: smart_kb_service.py:133-240                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Returns: ChunkingDecision(                                                 │
│      strategy="recursive",                                                  │
│      chunk_size=300,                                                        │
│      chunk_overlap=75,                                                      │
│      user_preference=True,                                                  │
│      adaptive_suggestion="N/A",                                             │
│      reasoning="User explicitly configured..."                              │
│  )                                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│               CHUNKING_SERVICE.chunk_document()                             │
│               File: chunking_service.py:34-101                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Dispatches to strategy implementation:                                     │
│    • "recursive"      → _recursive_chunk()                                  │
│    • "no_chunking"    → _full_content_chunk()                               │
│    • "semantic"       → _semantic_chunk()                                   │
│    • "by_heading"     → _heading_chunk()                                    │
│    • "adaptive"       → _adaptive_chunk()                                   │
│    • "hybrid"         → _hybrid_chunk()                                     │
│    • etc.                                                                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. NO_CHUNKING Strategy

### What Happens

When `strategy = "no_chunking"` or `strategy = "full_content"`:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         NO_CHUNKING PROCESSING                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  DETECTION (kb_pipeline_tasks.py:369):                                      │
│  should_combine_all_sources = chunk_strategy in ("no_chunking", "full_content")
│                                                                             │
│  IF should_combine_all_sources = TRUE:                                      │
│                                                                             │
│  1. COLLECT: All pages from all sources                                     │
│     for source in sources:                                                  │
│         scrape_pages(source)                                                │
│         all_scraped_pages.extend(pages)                                     │
│                                                                             │
│  2. COMBINE: Merge all content into ONE string                              │
│     combined_content = []                                                   │
│     for page in all_scraped_pages:                                          │
│         combined_content.append(page.content)                               │
│     final_combined_content = "\n\n".join(combined_content)                  │
│                                                                             │
│  3. CREATE: ONE combined document                                           │
│     combined_doc = Document(                                                │
│         name="Combined KB (N sources, M pages)",                            │
│         content_full=final_combined_content,                                │
│         ...                                                                 │
│     )                                                                       │
│                                                                             │
│  4. CHUNK: _full_content_chunk() returns SINGLE chunk                       │
│     def _full_content_chunk(text):                                          │
│         return [{                                                           │
│             "content": text.strip(),  # ENTIRE document                     │
│             "index": 0,               # Only ONE chunk                      │
│             "word_count": N,                                                │
│             "character_count": M                                            │
│         }]                                                                  │
│                                                                             │
│  5. EMBED: Generate ONE embedding for entire content                        │
│     embeddings = embedding_service.generate_embeddings([chunk.content])     │
│     # Result: [one_384_dim_vector]                                          │
│                                                                             │
│  6. STORE: One document, one chunk, one vector                              │
│     PostgreSQL:                                                             │
│       • documents: 1 record (full content)                                  │
│       • chunks: 1 record (full content, no embedding)                       │
│     Qdrant:                                                                 │
│       • 1 vector with full content in payload                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### When to Use

- Small documents that fit in embedding context
- When you want exact document retrieval (not partial matches)
- FAQ/Q&A where each document is a complete answer

### Trade-offs

| Pros | Cons |
|------|------|
| Preserves complete document context | Poor for long documents (embedding quality degrades >512 tokens) |
| Simpler retrieval (1 doc = 1 result) | All-or-nothing retrieval (can't find specific sections) |

---

## 3. RECURSIVE Strategy (Default)

### Algorithm

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         RECURSIVE CHUNKING                                  │
│                    File: chunking_service.py:104-217                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  SEPARATORS (tried in order):                                               │
│  ["\n\n", "\n", " ", ""]   # paragraphs → lines → words → chars             │
│                                                                             │
│  ALGORITHM:                                                                 │
│  1. Split text by first separator ("\n\n" = paragraphs)                     │
│  2. For each split:                                                         │
│     • If fits in chunk_size → add to current chunk                          │
│     • If split > chunk_size → recursively chunk with next separator         │
│     • If current_chunk full → save and start new with overlap               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Example

**Input Document (800 chars):**
```markdown
# Introduction

This is paragraph one about the system architecture...

# Features

Feature one does X. Feature two does Y...

# Conclusion

In summary, the system provides...
```

**Output (chunk_size=300, overlap=75):**

| Chunk | Content | Size |
|-------|---------|------|
| 0 | `# Introduction\nThis is paragraph one about the system architecture...` | 300 chars |
| 1 | `...architecture.\n# Features\nFeature one does X. Feature two does Y...` | 300 chars (75 char overlap) |
| 2 | `...does Y.\n# Conclusion\nIn summary, the system provides...` | 200 chars (75 char overlap) |

---

## 4. SEMANTIC Strategy

### How It Works

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SEMANTIC CHUNKING                                   │
│                    File: chunking_service.py:457-595                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  WHY: Group semantically related content together                           │
│  HOW: Use embedding similarity to detect topic changes                      │
│                                                                             │
│  ALGORITHM:                                                                 │
│  1. Split into paragraphs                                                   │
│  2. Generate embeddings for EACH paragraph                                  │
│  3. Calculate cosine similarity between consecutive paragraphs              │
│  4. When similarity < 0.65 → topic boundary detected                        │
│  5. Group similar paragraphs into chunks                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Visualization

```
Paragraphs:     [P1]  [P2]  [P3]  [P4]  [P5]  [P6]  [P7]
Embeddings:     [E1]  [E2]  [E3]  [E4]  [E5]  [E6]  [E7]
                  │     │     │     │     │     │
Similarity:      0.82  0.91  0.45  0.88  0.72  0.55
                  ↓     ↓     ↓     ↓     ↓     ↓
Topic Break?     NO    NO   YES!   NO    NO   YES!

Result:         ├─ Chunk 1 ─┤├─ Chunk 2 ─┤├─ Chunk 3 ─┤
                [P1, P2, P3] [P4, P5, P6]  [P7]
```

### When to Use

- Unstructured content without clear headings
- Q&A content where topics shift
- Mixed documents (articles, blog posts)

### Trade-offs

| Pros | Cons |
|------|------|
| Produces semantically coherent chunks | Slower (requires embedding generation for each paragraph) |
| Better retrieval quality for complex documents | More compute-intensive |

---

## 5. ADAPTIVE Strategy

### Decision Tree

```
                   ┌─────────────────────┐
                   │ Analyze Document    │
                   │ Structure           │
                   └──────────┬──────────┘
                              │
           ┌──────────────────┼──────────────────┐
           │                  │                  │
           ▼                  ▼                  ▼
  ┌────────────────┐ ┌────────────────┐ ┌────────────────┐
  │ Heading        │ │ Paragraph      │ │ Some Headings? │
  │ Density > 5%?  │ │ Count > 10?    │ │                │
  └───────┬────────┘ └───────┬────────┘ └───────┬────────┘
          │                  │                  │
          ▼                  ▼                  ▼
  ┌────────────────┐ ┌────────────────┐ ┌────────────────┐
  │ by_heading     │ │ paragraph_based│ │ hybrid         │
  │ strategy       │ │ strategy       │ │ strategy       │
  └────────────────┘ └────────────────┘ └────────────────┘
                                              │
                                              │ else
                                              ▼
                                     ┌────────────────┐
                                     │ recursive      │
                                     │ (fallback)     │
                                     └────────────────┘
```

### Analysis Metrics

```python
total_lines = len(text.split("\n"))
heading_count = lines starting with "#"
heading_density = heading_count / total_lines
paragraph_count = len(text.split("\n\n"))
```

---

## 6. BY_HEADING Strategy

### Algorithm

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         BY_HEADING CHUNKING                                 │
│                    File: chunking_service.py:344-396                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  WHY: Maintain logical document structure                                   │
│  HOW: Split at markdown heading boundaries (# ## ### etc.)                  │
│  OPTIMIZED FOR: Documentation (GitBook, GitHub docs, Notion)                │
│                                                                             │
│  ALGORITHM:                                                                 │
│  for line in document:                                                      │
│      if is_markdown_heading(line) AND current_chunk > 100 chars:            │
│          save_chunk(current_chunk)                                          │
│          start_new_chunk(line)                                              │
│      else:                                                                  │
│          current_chunk += line                                              │
│          if len(current_chunk) > chunk_size:                                │
│              save_chunk(current_chunk)                                      │
│              start_new_chunk()                                              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Example

**Input:**
```markdown
# Getting Started
Welcome to the guide...
Setup instructions...

## Installation
Run npm install...
Configure settings...

### Prerequisites
You need Node.js...
```

**Output:**

| Chunk | Content |
|-------|---------|
| 0 | `# Getting Started\nWelcome to the guide...\nSetup instructions...` |
| 1 | `## Installation\nRun npm install...\nConfigure settings...` |
| 2 | `### Prerequisites\nYou need Node.js...` |

---

## 7. Storage Architecture

### Web Scraping (Hybrid Storage)

```
PostgreSQL documents:
  • id, kb_id, workspace_id
  • name, source_type="web_scraping", source_url
  • content_full ← FULL CONTENT STORED
  • content_preview, word_count, character_count
  • chunk_count, status, source_metadata

PostgreSQL chunks:
  • id, document_id, kb_id
  • content ← CHUNK TEXT STORED
  • chunk_index, position
  • word_count, character_count
  • chunk_metadata (strategy, reasoning, etc.)
  • NO embedding (stored only in Qdrant)

Qdrant vectors:
  • id (UUID matching chunk.id)
  • vector [384 dimensions] ← EMBEDDING
  • payload:
      - content ← CHUNK TEXT (for retrieval display)
      - document_id, kb_id, workspace_id
      - chunk_index, word_count, character_count
      - chunking_strategy, embedding_model
      - source_type, source_url, kb_context
      - storage_location="qdrant_and_postgres"
```

### File Upload (Option A - Qdrant Only)

```
PostgreSQL documents:
  • id, kb_id, workspace_id
  • name, source_type="file_upload", source_url
  • content_full = NULL ← NO CONTENT (metadata only)
  • content_preview, word_count, character_count
  • chunk_count, status, source_metadata

PostgreSQL chunks: NONE (skip_postgres_chunks=True)

Qdrant vectors:
  • id (UUID)
  • vector [384 dimensions] ← EMBEDDING
  • payload:
      - content ← CHUNK TEXT (ONLY place content is stored)
      - document_id, kb_id, workspace_id
      - chunk_index, word_count, character_count
      - chunking_strategy, embedding_model
      - source_type="file_upload", original_filename
      - storage_location="qdrant_only"
```

---

## 8. Strategy Comparison

| Strategy | Split Logic | Best For | Chunks From 1000 chars |
|----------|-------------|----------|------------------------|
| **no_chunking** | No split - entire document as one chunk | Small docs, FAQs | 1 chunk |
| **recursive** | Paragraphs → lines → words → chars | General purpose | ~3-4 chunks |
| **semantic** | Embedding similarity boundaries | Unstructured content | Variable (topic-based) |
| **by_heading** | Markdown heading boundaries | Documentation | Variable (heading-based) |
| **adaptive** | Auto-selects based on structure | Unknown content types | Depends on selection |
| **hybrid** | Heading-first, then paragraph refinement | Long docs with some structure | Variable |
| **sentence_based** | Sentence boundaries | Conversations, Q&A | ~5-8 chunks |
| **paragraph_based** | Double newline boundaries | Articles, blogs | ~2-5 chunks |

---

## 9. Key Takeaways

The chunking strategy determines:

1. **How many chunks** are created from a document
2. **Where content boundaries** fall (semantic vs structural)
3. **Retrieval granularity** (whole doc vs specific sections)
4. **Embedding quality** (smaller chunks = more focused embeddings)

### Recommendations

| Content Type | Recommended Strategy |
|--------------|---------------------|
| Documentation with headings | `by_heading` or `adaptive` |
| FAQs / Q&A | `no_chunking` or `sentence_based` |
| Blog posts / Articles | `paragraph_based` or `recursive` |
| Mixed / Unknown | `adaptive` |
| Long technical docs | `semantic` or `hybrid` |
