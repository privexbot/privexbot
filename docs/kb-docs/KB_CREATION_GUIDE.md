# PrivexBot Knowledge Base Creation Guide

## Complete Step-by-Step Documentation

**Version:** 1.0
**Last Updated:** December 2024
**Scope:** Web URL Flow (Single & Bulk Mode)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture Overview](#2-architecture-overview)
3. [Step 1: Basic Information](#3-step-1-basic-information)
4. [Step 2: Content Review](#4-step-2-content-review)
5. [Step 3: Content Approval](#5-step-3-content-approval)
6. [Step 4: Chunking Configuration](#6-step-4-chunking-configuration)
7. [Step 5: Model & Vector Store](#7-step-5-model--vector-store)
8. [Step 6: Retrieval Configuration](#8-step-6-retrieval-configuration)
9. [Step 7: Finalization](#9-step-7-finalization)
10. [Pipeline Processing](#10-pipeline-processing)
11. [Data Storage Patterns](#11-data-storage-patterns)
12. [Chunking Strategies Deep Dive](#12-chunking-strategies-deep-dive)
13. [Troubleshooting](#13-troubleshooting)

---

## 1. Overview

### What is a Knowledge Base?

A Knowledge Base (KB) in PrivexBot is a structured collection of information that powers AI chatbots and chatflows with domain-specific knowledge. It enables Retrieval-Augmented Generation (RAG), where the AI retrieves relevant context from your KB before generating responses.

### Key Features

- **Multi-Source Support**: Web URLs, file uploads (PDF, DOCX, CSV), and cloud integrations
- **Content Approval**: Review and edit scraped content before processing
- **Flexible Chunking**: Multiple strategies to split content optimally
- **Vector Search**: Semantic search using embeddings for accurate retrieval
- **Draft-First Architecture**: All changes saved to Redis before final database commit

### Creation Flow Summary

```
┌─────────────┐     ┌─────────────────┐     ┌──────────────────┐
│ Basic Info  │ ──▶ │ Content Review  │ ──▶ │ Content Approval │
│ (Name,      │     │ (Add Sources)   │     │ (Edit & Approve) │
│  Context)   │     │                 │     │                  │
└─────────────┘     └─────────────────┘     └──────────────────┘
                                                     │
                                                     ▼
┌─────────────┐     ┌─────────────────┐     ┌──────────────────┐
│  Finalize   │ ◀── │   Retrieval     │ ◀── │    Chunking      │
│ (Create KB) │     │   (Search)      │     │  (Split Config)  │
└─────────────┘     └─────────────────┘     └──────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│                    PIPELINE PROCESSING                       │
│  Scrape → Parse → Chunk → Embed → Index → Ready!            │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Architecture Overview

### Three-Phase Architecture

PrivexBot uses a **Draft-First Architecture** with three distinct phases:

#### Phase 1: Draft Creation (Redis)
- All initial data stored in Redis with 24-hour TTL
- No database pollution from abandoned drafts
- Instant preview and validation
- Easy to abandon without cleanup

#### Phase 2: Finalization (PostgreSQL)
- Creates KB record in database
- Creates Document placeholder records
- Queues background processing task
- Deletes draft from Redis

#### Phase 3: Pipeline Processing (Celery + Qdrant)
- Background task processes all sources
- Generates chunks based on configuration
- Creates embeddings using AI model
- Indexes vectors in Qdrant
- Updates KB status to "ready"

### Technology Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| Frontend | React + TypeScript | User interface |
| State Management | Zustand | Draft & form state |
| Backend API | FastAPI (Python) | REST endpoints |
| Draft Storage | Redis | Temporary draft data |
| Database | PostgreSQL | Persistent KB/Document/Chunk records |
| Vector Database | Qdrant | Semantic search vectors |
| Background Tasks | Celery | Async processing pipeline |
| Web Scraping | Crawl4AI | Content extraction |
| File Parsing | Apache Tika | PDF, DOCX, etc. |
| Embeddings | sentence-transformers | Vector generation |

---

## 3. Step 1: Basic Information

### Purpose
Configure the fundamental settings for your Knowledge Base.

### User Interface

```
┌────────────────────────────────────────────────────────────┐
│                    Basic Information                        │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  Name *                                                    │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ My Product Documentation                              │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
│  Description                                               │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ Comprehensive documentation for our product API      │ │
│  │ including guides, tutorials, and reference docs.     │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
│  Context                                                   │
│  ○ Chatbot Only    ○ Chatflow Only    ● Both              │
│                                                            │
│                                    [Continue →]            │
└────────────────────────────────────────────────────────────┘
```

### Fields

| Field | Required | Validation | Description |
|-------|----------|------------|-------------|
| Name | Yes | 3-100 characters | Unique identifier for your KB |
| Description | No | Max 500 chars | Brief description of KB contents |
| Context | Yes | Enum selection | Where this KB will be used |

### Context Options

| Option | Description | Use Case |
|--------|-------------|----------|
| **Chatbot Only** | KB available only to simple chatbots | Single-purpose customer support |
| **Chatflow Only** | KB available only to visual workflows | Complex multi-step automation |
| **Both** | KB available to all bot types | Flexible, general-purpose KB |

### What Happens (Frontend)

```typescript
// State update in kb-store.ts
setFormData({
  name: "My Product Documentation",
  description: "Comprehensive documentation...",
  context: "both"
});
```

### What Happens (Backend)

At this stage, no backend call is made. Data is stored locally in Zustand state until the user adds sources (which triggers draft creation).

---

## 4. Step 2: Content Review

### Purpose
Add knowledge sources to your KB. This step supports multiple source types and configurations.

### Source Types Available

| Source Type | Status | Description |
|-------------|--------|-------------|
| **Website** | Available | Crawl and scrape web pages |
| **Files** | Available | Upload PDF, Word, Text, CSV files |
| **Integrations** | Coming Soon | Connect Google Docs, Notion, etc. |

### Web Source Configuration

#### Single URL Mode

Add one URL at a time with individual configuration.

```
┌────────────────────────────────────────────────────────────┐
│                    Add Web Source                          │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  URL *                                                     │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ https://docs.example.com/getting-started             │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
│  Crawl Method                                              │
│  ○ Single Page    ● Crawl Site                            │
│                                                            │
│  ┌─ Crawl Settings ──────────────────────────────────────┐│
│  │ Max Pages: [50]     Max Depth: [3]                    ││
│  │ ☑ Stealth Mode      ☐ Include Subdomains              ││
│  │                                                        ││
│  │ Include Patterns: /docs/*, /api/*                     ││
│  │ Exclude Patterns: /blog/*, /changelog/*               ││
│  └────────────────────────────────────────────────────────┘│
│                                                            │
│                          [Cancel]  [Add Source]            │
└────────────────────────────────────────────────────────────┘
```

#### Bulk URL Mode

Add multiple URLs at once with shared or per-URL configurations.

```
┌────────────────────────────────────────────────────────────┐
│                   Add Multiple URLs                         │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  URLs (one per line) *                                     │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ https://docs.example.com/guide-1                     │ │
│  │ https://docs.example.com/guide-2                     │ │
│  │ https://docs.example.com/api-reference               │ │
│  │ https://blog.example.com/tutorial                    │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
│  Shared Configuration                                      │
│  Method: [Single Page ▼]   Stealth: [Yes ▼]               │
│                                                            │
│  ☐ Use per-URL configurations                             │
│                                                            │
│                          [Cancel]  [Add 4 Sources]         │
└────────────────────────────────────────────────────────────┘
```

### Crawl Configuration Options

| Option | Default | Description |
|--------|---------|-------------|
| **method** | "single" | "single" = one page, "crawl" = follow links |
| **max_pages** | 50 | Maximum pages to crawl (crawl mode) |
| **max_depth** | 3 | How many link levels deep to crawl |
| **stealth_mode** | true | Avoid bot detection (slower but more reliable) |
| **include_patterns** | [] | URL patterns to include (glob format) |
| **exclude_patterns** | [] | URL patterns to exclude |

### What Happens (Frontend)

```typescript
// Single URL
await addWebSource(
  "https://docs.example.com",
  {
    method: "crawl",
    max_pages: 50,
    max_depth: 3,
    stealth_mode: true
  }
);

// Bulk URLs
await addWebSource(
  [
    "https://docs.example.com/guide-1",
    "https://docs.example.com/guide-2"
  ],
  { method: "single", stealth_mode: true },  // Shared config
  {  // Per-URL overrides (optional)
    "https://docs.example.com/guide-1": { max_pages: 10 }
  }
);
```

### What Happens (Backend)

#### 1. Draft Creation (First Source Only)

If no draft exists, one is created:

```python
# POST /api/v1/kb-drafts
{
  "name": "My Product Documentation",
  "description": "...",
  "workspace_id": "uuid",
  "context": "both"
}

# Response
{
  "draft_id": "draft_abc123",
  "workspace_id": "uuid",
  "expires_at": "2024-12-20T10:00:00Z",  # 24 hours
  "message": "Draft created successfully"
}
```

#### 2. Add Web Source

```python
# POST /api/v1/kb-drafts/{draft_id}/sources/web

# Single URL Request
{
  "url": "https://docs.example.com",
  "config": {
    "method": "crawl",
    "max_pages": 50,
    "max_depth": 3,
    "stealth_mode": true
  }
}

# Bulk URLs Request
{
  "urls": ["https://url1.com", "https://url2.com"],
  "config": { "method": "single" },
  "per_url_configs": {
    "https://url1.com": { "max_pages": 10 }
  }
}

# Response
{
  "source_id": "src_xyz789",  # Single
  # OR
  "source_ids": ["src_1", "src_2"]  # Bulk
}
```

#### 3. Redis Storage

```json
{
  "draft_id": "draft_abc123",
  "workspace_id": "uuid",
  "data": {
    "name": "My Product Documentation",
    "sources": [
      {
        "id": "src_xyz789",
        "type": "web_scraping",
        "url": "https://docs.example.com",
        "config": {
          "method": "crawl",
          "max_pages": 50
        },
        "status": "pending"
      }
    ]
  },
  "expires_at": "2024-12-20T10:00:00Z"
}
```

### Source List Display

After adding sources, they appear in a list:

```
┌────────────────────────────────────────────────────────────┐
│                    Knowledge Sources                        │
│                      3 sources                              │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  🌐 https://docs.example.com                               │
│     Method: Crawl | Max: 50 pages | Status: Ready          │
│                                           [Preview] [✕]    │
│  ─────────────────────────────────────────────────────────│
│  🌐 https://blog.example.com/tutorial                      │
│     Method: Single | Status: Ready                         │
│                                           [Preview] [✕]    │
│  ─────────────────────────────────────────────────────────│
│  📄 product-manual.pdf                                     │
│     Size: 2.4 MB | Pages: 45 | Status: Parsed              │
│                                           [Preview] [✕]    │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

## 5. Step 3: Content Approval

### Purpose
Review, edit, and approve extracted content before it's processed. This ensures only high-quality, relevant content enters your KB.

### Why Content Approval Matters

1. **Quality Control**: Remove boilerplate, ads, navigation elements
2. **Accuracy**: Fix OCR errors or extraction mistakes
3. **Relevance**: Select only the pages you actually need
4. **Cost Efficiency**: Don't process unnecessary content

### User Interface

```
┌────────────────────────────────────────────────────────────┐
│                   Content Approval                          │
│           Review and approve extracted content              │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ☑ Select All (12 pages)                     [Bulk Edit]   │
│                                                            │
│  ┌─ Page 1 of 12 ───────────────────────────────────────┐ │
│  │ ☑ https://docs.example.com/getting-started           │ │
│  │   Title: Getting Started Guide                        │ │
│  │   Words: 1,234 | Characters: 7,891                   │ │
│  │   ┌────────────────────────────────────────────────┐ │ │
│  │   │ # Getting Started                               │ │ │
│  │   │                                                 │ │ │
│  │   │ Welcome to our product! This guide will help   │ │ │
│  │   │ you set up your first project in minutes.      │ │ │
│  │   │                                                 │ │ │
│  │   │ ## Prerequisites                                │ │ │
│  │   │ - Node.js 18+                                   │ │ │
│  │   │ - npm or yarn                                   │ │ │
│  │   │ ...                                             │ │ │
│  │   └────────────────────────────────────────────────┘ │ │
│  │                              [Edit] [Preview Full]   │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
│  ┌─ Page 2 of 12 ───────────────────────────────────────┐ │
│  │ ☐ https://docs.example.com/changelog                 │ │
│  │   Title: Changelog (Excluded - not relevant)         │ │
│  │   Words: 5,432 | Characters: 32,100                  │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
│  Summary: 10 of 12 pages selected | ~15,000 words          │
│                                                            │
│                    [← Back]  [Continue to Chunking →]      │
└────────────────────────────────────────────────────────────┘
```

### Editing Content

When you click "Edit" on a page:

```
┌────────────────────────────────────────────────────────────┐
│                    Edit Page Content                        │
│           https://docs.example.com/getting-started          │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ # Getting Started                                    │ │
│  │                                                      │ │
│  │ Welcome to our product! This guide will help you    │ │
│  │ set up your first project in minutes.               │ │
│  │                                                      │ │
│  │ ## Prerequisites                                     │ │
│  │                                                      │ │
│  │ Before you begin, make sure you have:               │ │
│  │ - Node.js version 18 or higher                      │ │
│  │ - npm or yarn package manager                       │ │
│  │ - A text editor (VS Code recommended)               │ │
│  │                                                      │ │
│  │ ## Installation                                      │ │
│  │                                                      │ │
│  │ ```bash                                              │ │
│  │ npm install @example/sdk                            │ │
│  │ ```                                                  │ │
│  │                                                      │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
│  Word Count: 1,234 → 1,256 (+22)                          │
│  ☑ Mark as edited (preserves original for comparison)     │
│                                                            │
│                          [Cancel]  [Save Changes]          │
└────────────────────────────────────────────────────────────┘
```

### What Happens (Frontend)

```typescript
// User selects pages and makes edits
const selectedPages = [0, 1, 3, 4, 5, 6, 7, 8, 9, 11];  // Indices
const editedPages = {
  0: {
    page_index: 0,
    edited_content: "# Getting Started\n\nUpdated content...",
    is_edited: true
  }
};

// Approve content
await approveContent(selectedPages, allPages);
```

### What Happens (Backend)

```python
# POST /api/v1/kb-drafts/{draft_id}/sources/approve

# Request (grouped by source_id)
[
  {
    "source_id": "src_xyz789",
    "approved_page_indices": [0, 1, 3, 4, 5],
    "page_updates": [
      {
        "page_index": 0,
        "edited_content": "# Getting Started\n\nUpdated content...",
        "is_edited": true
      }
    ]
  },
  {
    "source_id": "src_abc123",
    "approved_page_indices": [0, 1, 2],
    "page_updates": []
  }
]

# Response
{
  "success": true,
  "summary": {
    "total_pages_approved": 8,
    "total_edited_pages": 1,
    "sources_updated": 2
  }
}
```

### Redis Storage After Approval

```json
{
  "draft_id": "draft_abc123",
  "data": {
    "sources": [
      {
        "id": "src_xyz789",
        "type": "web_scraping",
        "url": "https://docs.example.com",
        "status": "approved",
        "metadata": {
          "approved_sources": [
            {
              "url": "https://docs.example.com/getting-started",
              "title": "Getting Started Guide",
              "content": "# Getting Started\n\nUpdated content...",
              "is_edited": true,
              "page_index": 0
            },
            {
              "url": "https://docs.example.com/installation",
              "title": "Installation",
              "content": "Original scraped content...",
              "is_edited": false,
              "page_index": 1
            }
          ]
        }
      }
    ]
  }
}
```

### Content Priority During Processing

When the pipeline processes content, it uses this priority order:

1. **edited_content** - User's edited version (highest priority)
2. **approved_sources** - From approval step
3. **preview_pages** - Original scraped content
4. **Live scraping** - Re-scrape if nothing else available (last resort)

---

## 6. Step 4: Chunking Configuration

### Purpose
Configure how your content will be split into searchable chunks. The right chunking strategy significantly impacts retrieval quality.

### Why Chunking Matters

- **Too Large**: Chunks contain irrelevant information, diluting search results
- **Too Small**: Chunks lack context, producing fragmented answers
- **Wrong Strategy**: Structure-aware content split incorrectly loses meaning

### User Interface

```
┌────────────────────────────────────────────────────────────┐
│                  Chunking Configuration                     │
│         Configure how content is split into chunks          │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  Chunking Strategy                                         │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ ▼ By Heading (Recommended)                           │ │
│  │   ├─ Recursive (Default)                             │ │
│  │   ├─ Adaptive (Auto-select)                          │ │
│  │   ├─ By Heading ✓                                    │ │
│  │   ├─ By Paragraph                                    │ │
│  │   ├─ By Sentence                                     │ │
│  │   ├─ Semantic                                        │ │
│  │   ├─ Hybrid                                          │ │
│  │   └─ No Chunking                                     │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
│  ℹ️ Splits content at markdown headings (#, ##, ###).      │
│     Best for documentation with clear structure.           │
│                                                            │
│  ┌─ Size Configuration ─────────────────────────────────┐ │
│  │                                                       │ │
│  │  Chunk Size (characters)                              │ │
│  │  ├────────────────●──────────────────┤  1000         │ │
│  │  200                                           4000   │ │
│  │                                                       │ │
│  │  Chunk Overlap (characters)                           │ │
│  │  ├──────●────────────────────────────┤  200          │ │
│  │  0                                              500   │ │
│  │                                                       │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                            │
│  ┌─ Advanced Options ───────────────────────────────────┐ │
│  │                                                       │ │
│  │  ☑ Preserve Code Blocks                              │ │
│  │    Keep code blocks intact instead of splitting      │ │
│  │                                                       │ │
│  │  ☑ Enable Enhanced Metadata                          │ │
│  │    Include context_before, context_after, headings   │ │
│  │                                                       │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                            │
│  ┌─ Estimated Results ──────────────────────────────────┐ │
│  │  📊 ~45 chunks from 15,000 characters                │ │
│  │  📦 ~1.5 KB vector storage                           │ │
│  │  ⏱️ ~30 seconds processing time                       │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                            │
│                    [← Back]  [Continue to Model →]         │
└────────────────────────────────────────────────────────────┘
```

### Chunking Strategies Explained

| Strategy | Best For | How It Works |
|----------|----------|--------------|
| **Recursive** | General content | Splits on separators (paragraphs → sentences → words) recursively |
| **By Heading** | Documentation | Splits at markdown headers (#, ##, ###) preserving structure |
| **By Paragraph** | Articles/blogs | Splits on double newlines (paragraph breaks) |
| **By Sentence** | Chat logs | Splits on sentence boundaries (., !, ?) |
| **Semantic** | Diverse topics | Uses embeddings to detect topic changes |
| **Adaptive** | Mixed content | Auto-selects strategy based on content analysis |
| **Hybrid** | Complex docs | Combines heading-aware + recursive for best results |
| **No Chunking** | Small docs | Keeps entire document as single chunk |

### Configuration Parameters

| Parameter | Default | Range | Description |
|-----------|---------|-------|-------------|
| **chunk_size** | 1000 | 100-4000 | Target chunk size in characters |
| **chunk_overlap** | 200 | 0-500 | Overlap between consecutive chunks |
| **preserve_code_blocks** | true | bool | Keep code blocks intact |
| **enable_enhanced_metadata** | true | bool | Add context metadata to chunks |
| **semantic_threshold** | 0.65 | 0.3-0.9 | Topic change sensitivity (semantic only) |

### What Happens (Frontend)

```typescript
// Update chunking configuration
await updateChunkingConfig({
  strategy: "by_heading",
  chunk_size: 1000,
  chunk_overlap: 200,
  preserve_code_blocks: true,
  enable_enhanced_metadata: true
});
```

### What Happens (Backend)

```python
# PUT /api/v1/kb-drafts/{draft_id}/config/chunking

{
  "chunking_config": {
    "strategy": "by_heading",
    "chunk_size": 1000,
    "chunk_overlap": 200,
    "preserve_code_blocks": true,
    "enable_enhanced_metadata": true
  }
}

# Stored in Redis draft
{
  "data": {
    "chunking_config": {
      "strategy": "by_heading",
      "chunk_size": 1000,
      "chunk_overlap": 200,
      "preserve_code_blocks": true,
      "enable_enhanced_metadata": true
    }
  }
}
```

---

## 7. Step 5: Model & Vector Store

### Purpose
Configure the AI embedding model and vector database settings that power semantic search.

### User Interface

```
┌────────────────────────────────────────────────────────────┐
│                  Model & Vector Store                       │
│            Configure AI and storage settings                │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ┌─ Embedding Model ────────────────────────────────────┐ │
│  │                                                       │ │
│  │  Model                                                │ │
│  │  ┌────────────────────────────────────────────────┐  │ │
│  │  │ ▼ all-MiniLM-L6-v2 (Recommended)               │  │ │
│  │  └────────────────────────────────────────────────┘  │ │
│  │  384 dimensions | Fast | Good quality                │ │
│  │                                                       │ │
│  │  Device: CPU        Batch Size: 32                   │ │
│  │  ☑ Normalize Embeddings                              │ │
│  │                                                       │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                            │
│  ┌─ Vector Store ───────────────────────────────────────┐ │
│  │                                                       │ │
│  │  Provider: Qdrant (Default)                          │ │
│  │                                                       │ │
│  │  Distance Metric                                      │ │
│  │  ● Cosine    ○ Euclidean    ○ Dot Product            │ │
│  │                                                       │ │
│  │  Index Settings (HNSW)                               │ │
│  │  M: [16]    EF Construct: [100]                      │ │
│  │                                                       │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                            │
│  ┌─ Storage Estimates ──────────────────────────────────┐ │
│  │  Chunks: ~45                                         │ │
│  │  Vector Storage: 1.50 KB                             │ │
│  │  Metadata Storage: 0.15 KB                           │ │
│  │  Total: 1.65 KB                                      │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                            │
│                    [← Back]  [Continue to Retrieval →]     │
└────────────────────────────────────────────────────────────┘
```

### Embedding Models

| Model | Dimensions | Speed | Quality | Use Case |
|-------|------------|-------|---------|----------|
| **all-MiniLM-L6-v2** | 384 | Fast | Good | General purpose (default) |
| **all-MiniLM-L12-v2** | 384 | Medium | Better | Higher quality needs |
| **all-mpnet-base-v2** | 768 | Slow | Best | Maximum accuracy |

### Vector Store Configuration

| Setting | Default | Options | Description |
|---------|---------|---------|-------------|
| **provider** | Qdrant | Qdrant | Vector database provider |
| **distance_metric** | Cosine | Cosine, Euclidean, Dot | How similarity is measured |
| **hnsw_m** | 16 | 8-64 | HNSW graph connectivity |
| **hnsw_ef_construct** | 100 | 50-500 | Index build quality |

### What Happens (Backend)

```python
# PUT /api/v1/kb-drafts/{draft_id}/config/models

{
  "embedding_config": {
    "model": "all-MiniLM-L6-v2",
    "device": "cpu",
    "batch_size": 32,
    "normalize_embeddings": true
  },
  "vector_store_config": {
    "provider": "qdrant",
    "distance_metric": "cosine",
    "index_type": "hnsw",
    "hnsw_config": {
      "m": 16,
      "ef_construct": 100
    }
  }
}
```

---

## 8. Step 6: Retrieval Configuration

### Purpose
Configure how the AI searches your KB when answering questions.

### User Interface

```
┌────────────────────────────────────────────────────────────┐
│                  Retrieval Configuration                    │
│              Configure search strategy                      │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  Search Strategy                                           │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ ▼ Hybrid Search (Recommended)                        │ │
│  │   ├─ Semantic Search                                 │ │
│  │   ├─ Keyword Search                                  │ │
│  │   ├─ Hybrid Search ✓                                 │ │
│  │   ├─ MMR (Maximal Marginal Relevance)               │ │
│  │   └─ Similarity Threshold                            │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
│  ℹ️ Combines semantic understanding with keyword matching   │
│     for best results across different query types.         │
│                                                            │
│  ┌─ Search Parameters ──────────────────────────────────┐ │
│  │                                                       │ │
│  │  Top K Results                                        │ │
│  │  ├────────────────●──────────────────┤  10           │ │
│  │  1                                              50    │ │
│  │                                                       │ │
│  │  Score Threshold                                      │ │
│  │  ├──────────────●────────────────────┤  0.70         │ │
│  │  0.0                                            1.0   │ │
│  │                                                       │ │
│  │  ☐ Enable Reranking (Coming Soon)                    │ │
│  │                                                       │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                            │
│                    [← Back]  [Continue to Finalize →]      │
└────────────────────────────────────────────────────────────┘
```

### Search Strategies

| Strategy | Description | Best For |
|----------|-------------|----------|
| **semantic_search** | Pure vector similarity search | Natural language queries |
| **keyword_search** | Traditional keyword matching | Exact term searches |
| **hybrid_search** | Combines semantic + keyword | General purpose (recommended) |
| **mmr** | Maximal Marginal Relevance | Diverse results, avoid redundancy |
| **similarity_score_threshold** | Filter by minimum score | High-precision needs |

### Configuration Parameters

| Parameter | Default | Range | Description |
|-----------|---------|-------|-------------|
| **strategy** | hybrid_search | See above | Search algorithm |
| **top_k** | 10 | 1-50 | Number of results to return |
| **score_threshold** | 0.7 | 0.0-1.0 | Minimum relevance score |
| **rerank_enabled** | false | bool | Re-rank results (future) |

### What Happens (Backend)

```python
# PUT /api/v1/kb-drafts/{draft_id}/config/models

{
  "retrieval_config": {
    "strategy": "hybrid_search",  # MUST use exact name!
    "top_k": 10,
    "score_threshold": 0.7,
    "rerank_enabled": false
  }
}
```

> **Important**: Use exact strategy names (`hybrid_search`, not `hybrid`). The backend validates against specific values.

---

## 9. Step 7: Finalization

### Purpose
Review all configurations and create the Knowledge Base.

### User Interface

```
┌────────────────────────────────────────────────────────────┐
│                      Finalize KB                            │
│              Review and create your Knowledge Base          │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ┌─ Summary ────────────────────────────────────────────┐ │
│  │                                                       │ │
│  │  📚 My Product Documentation                          │ │
│  │  Comprehensive documentation for our product API      │ │
│  │                                                       │ │
│  │  Context: Chatbot & Chatflow                         │ │
│  │  Sources: 3 web URLs, 1 file                         │ │
│  │  Approved Pages: 10 of 12                            │ │
│  │  Estimated Chunks: ~45                               │ │
│  │                                                       │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                            │
│  ┌─ Configuration ──────────────────────────────────────┐ │
│  │                                                       │ │
│  │  Chunking        │ By Heading, 1000 chars, 200 overlap│ │
│  │  Embedding       │ all-MiniLM-L6-v2 (384 dim)        │ │
│  │  Vector Store    │ Qdrant, Cosine distance           │ │
│  │  Retrieval       │ Hybrid Search, Top 10, 0.7 thresh │ │
│  │                                                       │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                            │
│  ┌─ Processing Estimate ────────────────────────────────┐ │
│  │                                                       │ │
│  │  ⏱️ Estimated Time: 2-5 minutes                        │ │
│  │  📊 You'll be redirected to track progress            │ │
│  │                                                       │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                            │
│  ☑ I understand this will start background processing     │
│                                                            │
│                    [← Back]  [🚀 Create Knowledge Base]    │
└────────────────────────────────────────────────────────────┘
```

### What Happens (Frontend)

```typescript
// Finalize draft
const result = await finalizeDraft();
// Returns: { kbId: "uuid", pipelineId: "uuid" }

// Redirect to processing page
navigate(`/knowledge-bases/${result.kbId}/processing?pipeline=${result.pipelineId}`);
```

### What Happens (Backend)

#### 1. Finalization Request

```python
# POST /api/v1/kb-drafts/{draft_id}/finalize

{
  "chunking_config": {
    "strategy": "by_heading",
    "chunk_size": 1000,
    "chunk_overlap": 200,
    "preserve_code_blocks": true,
    "enable_enhanced_metadata": true
  },
  "embedding_config": {
    "model": "all-MiniLM-L6-v2",
    "device": "cpu",
    "batch_size": 32,
    "normalize_embeddings": true
  },
  "vector_store_config": {
    "provider": "qdrant",
    "distance_metric": "cosine"
  },
  "retrieval_config": {
    "strategy": "hybrid_search",
    "top_k": 10,
    "score_threshold": 0.7,
    "rerank_enabled": false
  },
  "indexing_method": "balanced",
  "priority": "normal"
}
```

#### 2. Backend Processing Steps

```python
def finalize_draft(db, draft_id, config_override):
    # Step 1: Validate draft
    draft_data = get_draft_from_redis(draft_id)
    validate_draft(draft_data)

    # Step 2: Create KnowledgeBase record
    kb = KnowledgeBase(
        workspace_id=draft_data["workspace_id"],
        name=draft_data["data"]["name"],
        description=draft_data["data"]["description"],
        context=draft_data["data"]["context"],
        status="processing",
        config={
            "chunking_config": config_override["chunking_config"],
            "sources": draft_data["data"]["sources"]
        },
        embedding_config=config_override["embedding_config"],
        vector_store_config=config_override["vector_store_config"],
        context_settings={
            "retrieval_config": config_override["retrieval_config"]
        }
    )
    db.add(kb)
    db.flush()

    # Step 3: Create Document placeholders
    chunk_strategy = config_override["chunking_config"]["strategy"]

    if chunk_strategy in ("no_chunking", "full_content"):
        # Single combined document for all sources
        doc = Document(
            kb_id=kb.id,
            name=f"{kb.name} (Combined)",
            source_type="web_scraping_combined",
            source_metadata={
                "approved_sources": collect_all_approved_sources(draft_data),
                "chunking_strategy": chunk_strategy
            },
            status="pending"
        )
        db.add(doc)
    else:
        # Individual documents per source
        for source in draft_data["data"]["sources"]:
            doc = Document(
                kb_id=kb.id,
                name=source["url"],
                source_type=source["type"],
                source_metadata={
                    "approved_sources": source["metadata"]["approved_sources"],
                    "source_id": source["id"]
                },
                status="pending"
            )
            db.add(doc)

    db.commit()

    # Step 4: Create pipeline tracking
    pipeline_id = create_pipeline_tracking(kb.id, draft_data)

    # Step 5: Queue Celery task
    task = process_web_kb_task.apply_async(
        kwargs={
            "kb_id": str(kb.id),
            "pipeline_id": pipeline_id,
            "sources": draft_data["data"]["sources"],
            "config": config_override
        },
        queue="high_priority"
    )

    # Step 6: Delete draft from Redis
    delete_draft(draft_id)

    # Step 7: Return result
    return {
        "kb_id": str(kb.id),
        "pipeline_id": pipeline_id,
        "celery_task_id": task.id,
        "status": "processing"
    }
```

#### 3. Database Records Created

```sql
-- KnowledgeBase
INSERT INTO knowledge_bases (id, workspace_id, name, status, config, ...)
VALUES ('kb-uuid', 'ws-uuid', 'My Product Documentation', 'processing', '{...}', ...);

-- Document(s)
INSERT INTO documents (id, kb_id, name, source_type, source_metadata, status)
VALUES ('doc-uuid', 'kb-uuid', 'Combined Document', 'web_scraping_combined', '{...}', 'pending');
```

---

## 10. Pipeline Processing

### Purpose
Background processing that transforms your content into a searchable knowledge base.

### Pipeline Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                         PIPELINE PROCESSING                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌───────────┐    ┌───────────┐    ┌───────────┐    ┌───────────┐ │
│  │ 1. INIT   │───▶│ 2. SCRAPE │───▶│ 3. CHUNK  │───▶│ 4. EMBED  │ │
│  │           │    │           │    │           │    │           │ │
│  │ Create    │    │ Extract   │    │ Split     │    │ Generate  │ │
│  │ Qdrant    │    │ Content   │    │ Content   │    │ Vectors   │ │
│  │ Collection│    │           │    │           │    │           │ │
│  └───────────┘    └───────────┘    └───────────┘    └───────────┘ │
│                                                            │       │
│                                                            ▼       │
│  ┌───────────┐    ┌───────────┐    ┌───────────┐    ┌───────────┐ │
│  │ 8. DONE   │◀───│ 7. UPDATE │◀───│ 6. SAVE   │◀───│ 5. INDEX  │ │
│  │           │    │           │    │           │    │           │ │
│  │ KB Ready! │    │ Update KB │    │ Save to   │    │ Upsert to │ │
│  │           │    │ Status    │    │ PostgreSQL│    │ Qdrant    │ │
│  └───────────┘    └───────────┘    └───────────┘    └───────────┘ │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Progress Tracking UI

```
┌────────────────────────────────────────────────────────────┐
│                  Processing Knowledge Base                  │
│                  My Product Documentation                   │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ████████████████████████████░░░░░░░░░░  75%               │
│                                                            │
│  Current Stage: Generating embeddings...                   │
│                                                            │
│  ┌─ Progress Details ───────────────────────────────────┐ │
│  │                                                       │ │
│  │  ✓ Collection created                                │ │
│  │  ✓ Content extracted (10 pages)                      │ │
│  │  ✓ Content chunked (45 chunks)                       │ │
│  │  ◐ Generating embeddings... (34/45)                  │ │
│  │  ○ Indexing vectors                                  │ │
│  │  ○ Updating database                                 │ │
│  │                                                       │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                            │
│  ┌─ Statistics ─────────────────────────────────────────┐ │
│  │                                                       │ │
│  │  Pages Processed:     10 / 10                        │ │
│  │  Chunks Created:      45                             │ │
│  │  Embeddings:          34 / 45                        │ │
│  │  Vectors Indexed:     0 / 45                         │ │
│  │                                                       │ │
│  │  Elapsed Time:        1m 23s                         │ │
│  │  Estimated Remaining: ~30s                           │ │
│  │                                                       │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                            │
│                              [Cancel Processing]           │
└────────────────────────────────────────────────────────────┘
```

### Pipeline Task Details

#### Celery Task: `process_web_kb_task`

```python
@shared_task(bind=True, name="process_web_kb")
def process_web_kb_task(
    self,
    kb_id: str,
    pipeline_id: str,
    sources: List[Dict],
    config: Dict
):
    """
    Main pipeline task for processing KB sources.

    Phases:
    1. Initialize - Create Qdrant collection
    2. Process Sources - Extract/chunk/embed content
    3. Index - Store vectors in Qdrant
    4. Finalize - Update database records
    """
```

#### Step 1: Initialize Qdrant Collection

```python
# Create collection with configured settings
qdrant_service.create_kb_collection(
    kb_id=kb_id,
    vector_size=384,  # Model dimensions
    distance_metric="Cosine",
    hnsw_m=16,
    hnsw_ef_construct=100
)
```

#### Step 2: Process Sources

**For No Chunking Strategy:**

```python
# Combine all sources into one document
all_content = []
for source in sources:
    approved_pages = source["metadata"]["approved_sources"]
    for page in approved_pages:
        content = page.get("edited_content") or page.get("content")
        all_content.append(f"=== {page['title']} ===\n{content}")

combined_content = "\n\n".join(all_content)

# Single "chunk" = entire content
chunks = [{
    "id": uuid4(),
    "content": combined_content,
    "chunk_index": 0,
    "metadata": {...}
}]
```

**For Chunked Strategies (e.g., by_heading):**

```python
# Process each source independently
for source in sources:
    for page in source["metadata"]["approved_sources"]:
        content = page.get("edited_content") or page.get("content")

        # Chunk using configured strategy
        page_chunks = chunking_service.chunk_content(
            content=content,
            strategy="by_heading",
            chunk_size=1000,
            chunk_overlap=200,
            preserve_code_blocks=True
        )

        # Add metadata to each chunk
        for i, chunk in enumerate(page_chunks):
            chunk["document_id"] = document.id
            chunk["page_url"] = page["url"]
            chunk["chunk_index"] = i
```

#### Step 3: Generate Embeddings

```python
# Batch embedding generation
texts = [chunk["content"] for chunk in all_chunks]

embeddings = embedding_service.embed_batch(
    texts=texts,
    model="all-MiniLM-L6-v2",
    batch_size=32,
    normalize=True
)

# Attach vectors to chunks
for chunk, vector in zip(all_chunks, embeddings):
    chunk["vector"] = vector
```

#### Step 4: Index in Qdrant

```python
# Create Qdrant point objects
qdrant_chunks = [
    QdrantChunk(
        chunk_id=chunk["id"],
        document_id=chunk["document_id"],
        kb_id=kb_id,
        content=chunk["content"],
        vector=chunk["vector"],
        metadata={
            "chunk_index": chunk["chunk_index"],
            "page_url": chunk["page_url"],
            "word_count": len(chunk["content"].split()),
            "character_count": len(chunk["content"])
        }
    )
    for chunk in all_chunks
]

# Upsert to Qdrant (batched)
qdrant_service.upsert_chunks_batch(
    kb_id=kb_id,
    chunks=qdrant_chunks,
    batch_size=100
)
```

#### Step 5: Save to PostgreSQL

```python
# Save Chunk records (web sources only, not file uploads)
for chunk_data in postgres_chunks:
    chunk = Chunk(
        id=chunk_data["id"],
        document_id=chunk_data["document_id"],
        kb_id=kb_id,
        content=chunk_data["content"],
        chunk_index=chunk_data["chunk_index"],
        word_count=chunk_data["word_count"],
        character_count=chunk_data["character_count"],
        chunk_metadata=chunk_data["metadata"]
    )
    db.add(chunk)

db.commit()
```

#### Step 6: Update KB Status

```python
# Update document statistics
document.status = "processed"
document.chunk_count = len(chunks)
document.word_count = total_words
document.character_count = total_chars

# Update KB status
kb.status = "ready"
kb.stats = {
    "total_documents": document_count,
    "total_chunks": chunk_count,
    "total_vectors": vector_count
}

db.commit()
```

### Progress Tracking (Redis)

```python
# Pipeline status structure
{
    "pipeline_id": "pipe_xyz",
    "kb_id": "kb_uuid",
    "status": "running",
    "current_stage": "Generating embeddings",
    "progress_percentage": 75,
    "stats": {
        "pages_scraped": 10,
        "pages_failed": 0,
        "chunks_created": 45,
        "embeddings_generated": 34,
        "vectors_indexed": 0
    },
    "logs": [
        {"timestamp": "...", "level": "info", "message": "Started processing"},
        {"timestamp": "...", "level": "info", "message": "Created 45 chunks"}
    ],
    "started_at": "2024-12-19T10:00:00Z",
    "updated_at": "2024-12-19T10:01:23Z"
}
```

---

## 11. Data Storage Patterns

### Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         DATA STORAGE LAYERS                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────┐                                               │
│  │      REDIS      │  ◀── Draft Phase (24hr TTL)                   │
│  │                 │      - Draft data                              │
│  │  Temporary      │      - Pipeline status                         │
│  │  Fast Access    │      - Progress tracking                       │
│  └─────────────────┘                                               │
│           │                                                         │
│           │ Finalize                                                │
│           ▼                                                         │
│  ┌─────────────────┐                                               │
│  │   POSTGRESQL    │  ◀── Persistent Storage                        │
│  │                 │      - KnowledgeBase records                   │
│  │  Relational     │      - Document records                        │
│  │  ACID           │      - Chunk records (web only)                │
│  └─────────────────┘      - User/Workspace data                     │
│           │                                                         │
│           │ Pipeline                                                │
│           ▼                                                         │
│  ┌─────────────────┐                                               │
│  │     QDRANT      │  ◀── Vector Storage                            │
│  │                 │      - Chunk embeddings                        │
│  │  Vector DB      │      - Semantic search index                   │
│  │  HNSW Index     │      - Chunk metadata                          │
│  └─────────────────┘                                               │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Redis Structure

```
# Draft storage (24hr TTL)
draft:kb:{draft_id}
├── draft_id: string
├── workspace_id: UUID
├── created_by: UUID
├── created_at: ISO timestamp
├── expires_at: ISO timestamp
└── data:
    ├── name: string
    ├── description: string
    ├── context: "chatbot" | "chatflow" | "both"
    ├── sources: Array<Source>
    ├── chunking_config: ChunkingConfig
    ├── embedding_config: EmbeddingConfig
    ├── vector_store_config: VectorStoreConfig
    └── retrieval_config: RetrievalConfig

# Pipeline tracking (6-24hr TTL)
pipeline:{pipeline_id}:status
├── pipeline_id: string
├── kb_id: UUID
├── status: "queued" | "running" | "completed" | "failed"
├── current_stage: string
├── progress_percentage: 0-100
├── stats: PipelineStats
├── started_at: ISO timestamp
└── updated_at: ISO timestamp

# Pipeline logs
pipeline:{pipeline_id}:logs
└── Array<{timestamp, level, message, details}>
```

### PostgreSQL Schema

```sql
-- Knowledge Base
CREATE TABLE knowledge_bases (
    id UUID PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'processing',
    context VARCHAR(20) DEFAULT 'both',
    config JSONB,  -- Contains chunking_config
    embedding_config JSONB,
    vector_store_config JSONB,
    context_settings JSONB,  -- Contains retrieval_config
    indexing_method VARCHAR(20) DEFAULT 'balanced',
    stats JSONB,
    error_message TEXT,
    created_by UUID NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP
);

-- Document
CREATE TABLE documents (
    id UUID PRIMARY KEY,
    kb_id UUID NOT NULL REFERENCES knowledge_bases(id),
    workspace_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    source_type VARCHAR(50) NOT NULL,
    source_url TEXT,
    source_metadata JSONB,  -- Contains approved_sources
    content_full TEXT,  -- NULL for file uploads
    content_preview TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    processing_metadata JSONB,
    chunk_count INTEGER DEFAULT 0,
    word_count INTEGER DEFAULT 0,
    character_count INTEGER DEFAULT 0,
    page_count INTEGER DEFAULT 0,
    processing_error TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP
);

-- Chunk (web sources only)
CREATE TABLE chunks (
    id UUID PRIMARY KEY,
    document_id UUID NOT NULL REFERENCES documents(id),
    kb_id UUID NOT NULL REFERENCES knowledge_bases(id),
    content TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    position INTEGER,  -- Character position in original
    page_number INTEGER,
    word_count INTEGER DEFAULT 0,
    character_count INTEGER DEFAULT 0,
    chunk_metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### Qdrant Structure

```
Collection: kb_{kb_id}
├── Configuration:
│   ├── vector_size: 384 (depends on model)
│   ├── distance: Cosine
│   └── hnsw_config:
│       ├── m: 16
│       └── ef_construct: 100
│
└── Points (one per chunk):
    ├── id: UUID (chunk_id)
    ├── vector: [float; 384]
    └── payload:
        ├── chunk_id: UUID
        ├── document_id: UUID
        ├── kb_id: UUID
        ├── content: string
        ├── chunk_index: integer
        ├── page_url: string
        ├── page_title: string
        ├── word_count: integer
        ├── character_count: integer
        └── metadata: object
```

### Storage Differences by Source Type

| Aspect | Web Sources | File Uploads |
|--------|-------------|--------------|
| **content_full** | Stored in PostgreSQL | NULL (Qdrant only) |
| **Chunks table** | Records saved | No records (Qdrant only) |
| **Qdrant** | Vectors stored | Vectors stored |
| **Can Download** | Yes | No |
| **Can Reindex** | Yes | No |

---

## 12. Chunking Strategies Deep Dive

### Strategy Comparison

| Strategy | Splitting Logic | Best Content Type | Chunk Boundaries |
|----------|-----------------|-------------------|------------------|
| **recursive** | Hierarchical separators | General | Paragraph → Sentence → Word |
| **by_heading** | Markdown headers | Documentation | # ## ### markers |
| **paragraph_based** | Double newlines | Articles | \n\n separators |
| **sentence_based** | Punctuation | Chat logs | . ! ? markers |
| **semantic** | Topic similarity | Diverse content | Embedding thresholds |
| **adaptive** | Content analysis | Mixed | Auto-selected |
| **hybrid** | Heading + Recursive | Complex docs | Combined approach |
| **no_chunking** | No splitting | Small docs | Entire content |

### Recursive Strategy (Default)

```python
def recursive_chunk(text, chunk_size, chunk_overlap):
    """
    Splits text hierarchically using separators in order:
    1. Double newlines (paragraphs)
    2. Single newlines
    3. Sentences (. ! ?)
    4. Words (spaces)
    5. Characters (last resort)
    """
    separators = ["\n\n", "\n", ". ", "! ", "? ", " ", ""]

    for separator in separators:
        if separator in text:
            splits = text.split(separator)
            chunks = []
            current_chunk = ""

            for split in splits:
                if len(current_chunk) + len(split) <= chunk_size:
                    current_chunk += split + separator
                else:
                    if current_chunk:
                        chunks.append(current_chunk.strip())
                    current_chunk = split + separator

            # Handle overlap
            return add_overlap(chunks, chunk_overlap)

    # Fallback: character split
    return [text[i:i+chunk_size] for i in range(0, len(text), chunk_size - chunk_overlap)]
```

### By Heading Strategy

```python
def by_heading_chunk(text, chunk_size, chunk_overlap):
    """
    Splits at markdown headings, preserving document structure.
    Each section becomes a chunk with its heading as context.
    """
    heading_pattern = r'^(#{1,6})\s+(.+)$'
    sections = []
    current_section = {"heading": None, "level": 0, "content": ""}

    for line in text.split("\n"):
        match = re.match(heading_pattern, line)
        if match:
            if current_section["content"]:
                sections.append(current_section)
            current_section = {
                "heading": match.group(2),
                "level": len(match.group(1)),
                "content": line + "\n"
            }
        else:
            current_section["content"] += line + "\n"

    sections.append(current_section)

    # Merge small sections, split large sections
    return normalize_sections(sections, chunk_size, chunk_overlap)
```

### Semantic Strategy

```python
def semantic_chunk(text, chunk_size, threshold=0.65):
    """
    Splits based on semantic similarity between paragraphs.
    Creates chunks where content is topically coherent.
    """
    paragraphs = text.split("\n\n")
    embeddings = embed_batch(paragraphs)

    chunks = []
    current_chunk = [paragraphs[0]]
    current_embedding = embeddings[0]

    for i in range(1, len(paragraphs)):
        similarity = cosine_similarity(current_embedding, embeddings[i])

        if similarity < threshold or len("\n\n".join(current_chunk)) > chunk_size:
            # Topic change detected - start new chunk
            chunks.append("\n\n".join(current_chunk))
            current_chunk = [paragraphs[i]]
            current_embedding = embeddings[i]
        else:
            current_chunk.append(paragraphs[i])
            # Update running embedding average
            current_embedding = (current_embedding + embeddings[i]) / 2

    chunks.append("\n\n".join(current_chunk))
    return chunks
```

### No Chunking Strategy

```python
def no_chunking(sources, config):
    """
    Combines ALL content from ALL sources into a single chunk.
    Used for small knowledge bases where context is important.
    """
    combined_parts = []

    for source in sources:
        for page in source["approved_pages"]:
            content = page.get("edited_content") or page.get("content")
            separator = f"\n\n=== {page['title']} ===\n\n"
            combined_parts.append(separator + content)

    full_content = "\n".join(combined_parts)

    # Single "chunk" containing everything
    return [{
        "id": uuid4(),
        "content": full_content,
        "chunk_index": 0,
        "metadata": {
            "strategy": "no_chunking",
            "source_count": len(sources),
            "total_pages": sum(len(s["approved_pages"]) for s in sources)
        }
    }]
```

### Choosing the Right Strategy

```
┌─────────────────────────────────────────────────────────────────────┐
│                    STRATEGY SELECTION GUIDE                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Content Type              Recommended Strategy                     │
│  ───────────────────────────────────────────────                   │
│  Technical documentation   by_heading                               │
│  API references            by_heading                               │
│  Blog posts                paragraph_based                          │
│  News articles             paragraph_based                          │
│  Chat transcripts          sentence_based                           │
│  Legal documents           semantic                                 │
│  Mixed content             adaptive                                 │
│  Small FAQ (<5KB)          no_chunking                              │
│  Complex manuals           hybrid                                   │
│  General purpose           recursive (default)                      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 13. Troubleshooting

### Common Issues

#### "Chunking strategy dropdown shows wrong value"

**Cause**: Backend stores strategy aliases (e.g., `by_paragraph`) but frontend expects canonical names (`paragraph_based`).

**Solution**: The frontend normalizes strategy names automatically. If you see this issue, refresh the page.

#### "Pipeline stuck at 0%"

**Cause**: Celery worker not running or not picking up the task.

**Solution**:
```bash
# Restart Celery worker
docker compose -f docker-compose.dev.yml restart celery-worker

# Check worker logs
docker compose -f docker-compose.dev.yml logs celery-worker
```

#### "No chunks created despite successful processing"

**Cause**: Content was too short or filtered out.

**Solution**: Check the minimum content thresholds. Content under 50 characters is skipped.

#### "Reindex button disabled"

**Cause**: KB contains file uploads which cannot be reindexed (content stored in Qdrant only).

**Solution**: File upload KBs cannot be reindexed. Create a new KB if you need to change chunking.

#### "Download not available"

**Cause**: For file uploads, content is stored only in Qdrant vectors, not in PostgreSQL.

**Solution**: Download is only available for web-scraped content. Original files should be kept separately.

### Debug Logging

Enable detailed logging in the frontend console:

```typescript
// In browser console
localStorage.setItem('DEBUG', 'kb:*');
```

Check backend logs:

```bash
# API logs
docker compose -f docker-compose.dev.yml logs backend-dev

# Pipeline logs
docker compose -f docker-compose.dev.yml logs celery-worker
```

### Support

For additional help:
- Check the GitHub issues: https://github.com/privexbot/privexbot/issues
- Review the API documentation: http://localhost:8000/api/docs

---

## Appendix: API Reference

### Draft Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/kb-drafts` | Create draft |
| GET | `/api/v1/kb-drafts/{id}` | Get draft |
| DELETE | `/api/v1/kb-drafts/{id}` | Delete draft |
| POST | `/api/v1/kb-drafts/{id}/sources/web` | Add web source |
| POST | `/api/v1/kb-drafts/{id}/sources/file` | Add file source |
| POST | `/api/v1/kb-drafts/{id}/sources/approve` | Approve content |
| PUT | `/api/v1/kb-drafts/{id}/config/chunking` | Update chunking |
| PUT | `/api/v1/kb-drafts/{id}/config/models` | Update models |
| POST | `/api/v1/kb-drafts/{id}/finalize` | Finalize draft |

### KB Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/kbs` | List KBs |
| GET | `/api/v1/kbs/{id}` | Get KB details |
| PATCH | `/api/v1/kbs/{id}` | Update KB |
| DELETE | `/api/v1/kbs/{id}` | Delete KB |
| POST | `/api/v1/kbs/{id}/reindex` | Reindex KB |
| GET | `/api/v1/kbs/{id}/documents` | List documents |
| GET | `/api/v1/kbs/{id}/chunks` | List chunks |

### Pipeline Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/kb-pipeline/{id}/status` | Get pipeline status |
| POST | `/api/v1/kb-pipeline/{id}/cancel` | Cancel pipeline |

---

*Document generated for PrivexBot v1.0*
