# Comprehensive Guide: Creating a Knowledge Base with Web URLs

> **End-to-end walkthrough** — from your first click to testing search results — with deep guidance on every configuration option.

---

## Table of Contents

- [Part 1: Before You Start](#part-1-before-you-start)
- [Part 2: Step 1 — Basic Info](#part-2-step-1--basic-info)
- [Part 3: Step 2 — Add Documents (Web Sources)](#part-3-step-2--add-documents-web-sources)
- [Part 4: Step 3 — Configure](#part-4-step-3--configure)
- [Part 5: Step 4 — Review & Create](#part-5-step-4--review--create)
- [Part 6: Pipeline Monitor](#part-6-pipeline-monitor--watching-processing)
- [Part 7: KB Detail Page](#part-7-kb-detail-page--your-finished-knowledge-base)
- [Part 8: Configuration Recipes](#part-8-configuration-recipes)
- [Part 9: Troubleshooting](#part-9-troubleshooting)
- [Part 10: Quick Reference Tables](#part-10-quick-reference-tables)

---

## Part 1: Before You Start

### Prerequisites

1. **PrivexBot account** — sign up or log in
2. **Workspace** — you need at least one workspace (created during onboarding)
3. **At least one URL** — the web page or site you want to add to your knowledge base

### The 4-Step Wizard Flow

```
Step 1          Step 2              Step 3           Step 4
┌──────────┐    ┌───────────────┐   ┌────────────┐   ┌──────────────┐
│ Basic    │───▶│ Add Documents │──▶│ Configure  │──▶│ Review &     │
│ Info     │    │ (Web Sources) │   │ (Chunking, │   │ Create       │
│          │    │               │   │  Model,    │   │              │
│          │    │               │   │  Retrieval)│   │              │
└──────────┘    └───────────────┘   └────────────┘   └──────────────┘
                                                            │
                                                            ▼
                                                     ┌──────────────┐
                                                     │ Pipeline     │
                                                     │ Monitor      │
                                                     └──────┬───────┘
                                                            │
                                                            ▼
                                                     ┌──────────────┐
                                                     │ KB Detail    │
                                                     │ Page         │
                                                     └──────────────┘
```

### Key Terminology

| Term | Meaning |
|------|---------|
| **Knowledge Base (KB)** | A searchable collection of content your chatbot uses to answer questions |
| **Draft** | A temporary KB configuration stored in Redis (not yet saved to the database) — auto-expires after 24 hours |
| **Source** | A content origin — in this guide, a web URL |
| **Chunk** | A segment of text created by splitting your content for efficient search |
| **Embedding** | A numerical vector representation of text that enables semantic search |
| **Vector** | The stored embedding in Qdrant that powers similarity matching |
| **Retrieval** | The process of finding the most relevant chunks for a user's question |
| **Pipeline** | The automated sequence: Scraping → Parsing → Chunking → Embedding → Indexing |

---

## Part 2: Step 1 — Basic Info

When you click **Create Knowledge Base**, the wizard opens to Step 1.

### Fields

| Field | Required | Validation | Default |
|-------|----------|-----------|---------|
| **Knowledge Base Name** | Yes | Min 3 chars, max 100 chars | (empty) |
| **Description** | No | Free text | (empty) |

- **Name** — Choose a descriptive name like "Product Documentation" or "Support Articles Q3 2025". This name appears in your KB list and when attaching KBs to chatbots.
- **Description** — Helps you and your team remember what content this KB contains. Not used by the AI directly.

### Usage Context

The KB stores a `context` field that determines where it can be used:

| Context | Value | When to Use |
|---------|-------|-------------|
| **Chatbot** | `chatbot` | KB will only be used by simple form-based chatbots |
| **Chatflow** | `chatflow` | KB will only be used in visual workflow chatflows |
| **Both** | `both` | KB available for both chatbots and chatflows (default, recommended) |

> **Recommendation**: Leave context as "Both" unless you have a specific reason to restrict it.

### What to Do

1. Enter a name (3-100 characters)
2. Optionally add a description
3. Click **Next**

---

## Part 3: Step 2 — Add Documents (Web Sources)

This is where you add your web URLs. The form is titled **"Add Website URL"** with the subtitle *"Enter a URL to scrape content from a website"*.

### Single URL Mode (Default)

1. **Enter URL** in the "Website URL" field (placeholder: `https://example.com`)
2. Click **Validate** to check the URL is accessible
3. Choose a **Crawl Method** (see below)
4. Configure **Advanced Options** if needed
5. Click **Preview Content** to see what will be extracted
6. Review the preview, then **Approve & Add Source** or **Reject & Discard**

### Bulk URL Mode

Enable via the **"Bulk URL Mode"** checkbox at the top of the form.

1. Enter URLs in the textarea — **one per line**
2. Click **"Validate N URLs"** to check all URLs at once
3. Review validation results (green = valid, red = invalid)
4. Optionally configure **per-URL settings** by clicking "Configure" on any URL
5. Click **Preview Content** — all valid URLs are scraped together
6. Review and approve

**Per-URL Configuration** (available in bulk mode):
- **Max Pages** — override the global setting for this specific URL (1-500)
- **Max Depth** — override the global setting for this specific URL (1-10)
- **Include Patterns** — URL-specific include patterns with smart suggestions
- **Exclude Patterns** — URL-specific exclude patterns with smart suggestions

### Crawl Method

| Method | Value | Label | Description | Use When |
|--------|-------|-------|-------------|----------|
| **Single Page** | `single` | Single Page | Scrape content from a single page only | You want exactly one page (FAQ, landing page, policy) |
| **Crawl Website** | `crawl` | Crawl Website | Crawl multiple linked pages within the domain | You want to index a docs site, blog, or multi-page resource |

**Default**: Crawl Website (`crawl`)

### Preview Content Flow

When you click **"Preview Content"**, the system:

1. Creates a **temporary draft** in Redis (separate from your main KB draft)
2. Adds the URL(s) as web sources to that temporary draft
3. Triggers the backend scraper (Crawl4AI with Jina Reader fallback)
4. Waits for content extraction (6-15 seconds depending on crawl mode and URL count)
5. Retrieves extracted pages and displays them in the preview panel

**Preview Panel Contents**:

- **Stats Header** — total pages extracted, total words, extraction method
- **Configuration Summary** — crawl method, max pages, max depth, patterns used
- **Page List** — each extracted page with:
  - Page number and title
  - URL
  - Word count
  - Checkbox for selection (all selected by default)
  - **Edit** button (pencil icon) — opens inline content editor
  - **Copy** button — copies page content to clipboard
  - **"Preview content"** collapsible — shows first 500 characters
  - "Edited" badge if content was modified

**Toolbar Actions** (above page list):
- **Select All / Deselect All** checkbox
- **Copy Selected** — copies all selected pages to clipboard
- **Export** dropdown — export as Markdown, Text, or HTML

**Decision Alert** at bottom:
> "Content Preview Complete — This is the full content that would be extracted and added to your knowledge base. Review the content quality and coverage before making your decision."

**Footer Actions**:
- **"Reject & Discard"** (red) — discards the preview and deletes the temporary draft
- Page count indicator — "N of M pages selected"
- **"Approve & Add Source"** / **"Approve N of M pages"** (green) — adds selected pages to your KB draft

### Advanced Options (Collapsible)

Click the **"Advanced Options"** button to expand.

| Option | Type | Min | Max | Default | Description |
|--------|------|-----|-----|---------|-------------|
| **Max Pages** | Number | 1 | 1,000 | 50 | Maximum number of pages to crawl from the website |
| **Max Depth** | Number | 1 | 10 | 3 | How many link-levels deep to follow from the starting URL |
| **Include Patterns** | Glob patterns | — | — | (none) | Only crawl URLs matching these patterns |
| **Exclude Patterns** | Glob patterns | — | — | (none) | Skip URLs matching these patterns |

#### Max Pages Guidance

| Site Size | Recommended Max Pages |
|-----------|----------------------|
| Single page (FAQ, policy) | 1 (use Single Page mode) |
| Small docs site (5-20 pages) | 25 |
| Medium docs site (20-100 pages) | 100 |
| Large docs site (100+ pages) | 200-500 |
| Full crawl | 1,000 |

#### Max Depth Guidance

```
Depth 1: Start page only
         example.com/docs

Depth 2: Start page + direct links
         example.com/docs
         ├── example.com/docs/getting-started
         └── example.com/docs/api-reference

Depth 3: Start page + 2 levels of links (DEFAULT)
         example.com/docs
         ├── example.com/docs/getting-started
         │   ├── example.com/docs/getting-started/installation
         │   └── example.com/docs/getting-started/quickstart
         └── example.com/docs/api-reference
             └── example.com/docs/api-reference/endpoints
```

| Use Case | Recommended Depth |
|----------|-------------------|
| Single page | 1 |
| Section of a site | 2 |
| Full documentation site | 3 (default) |
| Deep nested wiki | 5-7 |
| Exhaustive crawl | 10 |

### Include/Exclude Pattern Reference

Patterns use **glob syntax** — the same wildcards used in file paths.

| Pattern | Matches |
|---------|---------|
| `/docs/**` | Any URL under /docs/ |
| `/blog/**` | Any URL under /blog/ |
| `/api/v2/**` | API v2 documentation only |
| `*.html` | Only .html pages |
| `/*/guide*` | Any guide page in any section |

#### Real-World Pattern Examples

| Site Type | Include Patterns | Exclude Patterns |
|-----------|-----------------|------------------|
| Docs site | `/docs/**` | `/docs/changelog/**`, `/docs/archive/**` |
| Blog | `/blog/**`, `/articles/**` | `/blog/tags/**`, `/blog/author/**` |
| E-commerce | `/products/**`, `/help/**` | `/products/*/reviews`, `/cart/**` |
| API docs | `/api/**`, `/reference/**` | `/api/deprecated/**` |
| Wiki | `/wiki/**` | `/wiki/talk:**`, `/wiki/User:**` |

**How to add patterns**:
1. Type the pattern in the input field (placeholder: `/docs/**, /api/**`)
2. Press **Enter** or click **"Add Pattern"**
3. Patterns appear as removable badges — click `×` to remove

### Smart Pattern Suggestions (Bulk Mode)

When configuring individual URLs in bulk mode, the system automatically generates pattern suggestions based on the URL path. For example, if your URL is `https://docs.example.com/v2/guides/`, you'll see suggestions like:
- `/v2/**` — everything in version 2
- `/v2/guides/**` — only the guides section

Click a suggestion to add it as an include pattern.

---

## Part 4: Step 3 — Configure

Step 3 presents three configuration sections: **Chunking**, **Model**, and **Retrieval**. Each has sensible defaults.

### Chunking Configuration

The chunking card is titled **"Chunking Configuration"** with the subtitle *"Configure how your content will be split into chunks for optimal retrieval"*.

#### Presets (Quick Start)

Choose a preset to auto-configure strategy, chunk size, and overlap:

| Preset | Icon | Strategy | Chunk Size | Overlap | Min | Max | Best For |
|--------|------|----------|-----------|---------|-----|-----|----------|
| **Precise** | 🎯 | Semantic | 256 | 50 | 50 | 512 | Detailed Q&A, definitions, glossaries |
| **Balanced** | ⚖️ | By Heading | 512 | 100 | 100 | 1,024 | Most use cases (default) |
| **Contextual** | 📚 | Hybrid | 1,024 | 200 | 200 | 2,048 | Long-form content, comprehensive answers |

> **Recommendation**: Start with **Balanced** preset. Only change to Precise if answers are too vague, or Contextual if answers lack context.

#### All 9 Chunking Strategies

| Strategy | Value | Icon | How It Works | Best For | Chunk Size Rec |
|----------|-------|------|-------------|----------|---------------|
| **No Chunking** | `no_chunking` | 📋 | Keeps each document as a single chunk | Very small docs, summaries | N/A |
| **By Sentence** | `sentence_based` | 📝 | Splits at sentence boundaries (`.!?`) | Precise Q&A, FAQs, definitions | 256-512 |
| **By Paragraph** | `paragraph_based` | ¶ | Splits at paragraph breaks (`\n\n`) | Blog posts, articles | 512-1,000 |
| **By Heading** | `by_heading` | 📋 | Splits at Markdown heading boundaries (`# ## ###`) | Structured docs, guides, wikis | 512-1,024 |
| **Semantic** | `semantic` | 🧠 | Uses AI embeddings to detect topic boundaries | Mixed content, varied topics | 256-512 |
| **Adaptive** | `adaptive` | 🎯 | Auto-detects best strategy based on content structure | Unknown content structure | 512-1,024 |
| **Hybrid** | `hybrid` | ⚡ | Heading-first, then paragraph splitting for oversized chunks | Complex long-form documents | 1,024-2,048 |
| **Custom** | `custom` | 🔧 | Splits at user-defined separator strings | Special formats, custom markup | Varies |
| **Recursive** | `recursive` | 🔄 | Recursively splits using hierarchy of separators (`\n\n` → `\n` → `. ` → ` `) | General purpose, default fallback | 500-1,500 |

#### Strategy-Specific Settings

**For most strategies** (all except No Chunking and Custom):

| Setting | Type | Min | Max | Step | Default |
|---------|------|-----|-----|------|---------|
| **Chunk Size** (characters) | Slider | 100 | 4,000 | 100 | 1,000 |
| **Chunk Overlap** (characters) | Slider | 0 | 500 | 50 | 200 |

**For Semantic strategy** — additional setting:

| Setting | Type | Min | Max | Step | Default |
|---------|------|-----|-----|------|---------|
| **Similarity Threshold** | Slider | 0.1 | 1.0 | 0.1 | 0.7 |

Higher values = more similar content kept together (fewer, larger chunks). Lower values = more splits (more, smaller chunks).

**For Custom strategy** — instead of chunk size/overlap:

| Setting | Type | Default |
|---------|------|---------|
| **Custom Separators** (one per line) | Textarea | (empty) |

Example separators: `\n\n`, `---`, `===`, `<!-- split -->`, `### `, `## `

**For No Chunking strategy**: No configuration needed. Content is stored as complete documents.

#### Advanced Settings

Shown for all strategies **except** No Chunking:

| Setting | Type | Min | Max | Default | Description |
|---------|------|-----|-----|---------|-------------|
| **Minimum Chunk Size** | Number input | 10 | 500 | 50 | Chunks below this size are merged with adjacent chunks |
| **Maximum Chunk Size** | Number input | 256 | 4,096 | 2,048 | Hard limit — chunks are split if they exceed this |

#### Processing Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| **Preserve code blocks and formatting** | Checkbox | On | Keeps code blocks intact during chunking — prevents code from being split mid-function |
| **Enable enhanced chunk metadata** | Checkbox | Off | Adds `context_before`, `context_after`, `parent_heading`, and `document_analysis` to each chunk. Improves retrieval quality but increases processing time. Available for ALL strategies. |
| **Keep Original Files** | Switch | Off | Only shown for file uploads (not web sources). Stores originals in cloud storage for re-processing. |

#### Estimated Results Panel

The blue panel shows:
- **Estimated chunks** — calculated from total content length and chunk size/overlap
- **Quality Score** — 0 to 100, calculated as:

```
Base Score: 70

+ Strategy Bonus:
  Hybrid: +25 | Semantic: +20 | Adaptive: +18 |
  By Heading: +15 | By Paragraph: +10 | Others: +0

+ Size Optimization: +10
  (if chunk_size between 256 and 1,024)

+ Overlap Optimization: +10
  (if overlap/size ratio between 0.1 and 0.3)

Maximum: 100
```

The green panel shows **Performance Impact**:
- **Search speed**: Fast (chunk_size < 512) or Moderate (chunk_size ≥ 512)
- **Context richness**: High (chunk_size > 512) or Moderate (chunk_size ≤ 512)

### Model Configuration

These settings control how your text is converted to vectors.

#### Embedding Model

| Model | Dimensions | Size | Speed | Quality | Best For |
|-------|-----------|------|-------|---------|----------|
| **all-MiniLM-L6-v2** | 384 | 90 MB | Fast | Good | Most use cases (default) |
| **all-MiniLM-L12-v2** | 384 | 120 MB | Medium | Better | Higher accuracy needs |
| **all-mpnet-base-v2** | 768 | 420 MB | Slow | Best | Maximum quality, precision-critical |
| **paraphrase-multilingual-MiniLM-L12-v2** | 384 | 470 MB | Medium | Good | 50+ languages, non-English content |

**Default**: `all-MiniLM-L6-v2` (local, CPU-only)

> **Recommendation**: Use the default unless you need multilingual support or maximum quality.

#### Embedding Settings

| Setting | Default | Description |
|---------|---------|-------------|
| **Provider** | `local` | Runs on CPU locally (privacy-preserving) |
| **Batch Size** | 32 | Number of texts embedded at once. Higher = faster but more memory. |
| **Normalize Embeddings** | On | Normalizes vectors to unit length for consistent cosine similarity |

#### Vector Store Configuration

| Setting | Default | Options | Description |
|---------|---------|---------|-------------|
| **Provider** | Qdrant | Qdrant (only option) | Vector database for storing embeddings |
| **Distance Metric** | Cosine | Cosine, Dot Product (`Dot`), Euclidean (`Euclid`) | How similarity is measured |
| **HNSW M** | 16 | 4-64 | Number of connections per node in the search index. Higher = better recall but more memory |
| **EF Construct** | 100 | 50-500 | Build-time search accuracy. Higher = more accurate index but slower build |
| **Vector Size** | 384 | (matches model) | Automatically set from embedding model dimensions |
| **Batch Size** | 100 | — | Number of vectors upserted at once |

**Distance Metric Guidance**:

| Metric | When to Use |
|--------|-------------|
| **Cosine** (default, recommended) | General purpose. Measures angle between vectors — works well for text similarity |
| **Dot Product** | When vectors are already normalized. Slightly faster than cosine |
| **Euclidean** | When absolute distances matter more than directions. Rarely needed for text |

### Retrieval Configuration

These settings control how chunks are found when your chatbot searches.

#### Search Strategy

| Strategy | Value | Description | Best For |
|----------|-------|-------------|----------|
| **Hybrid** (Recommended) | `hybrid_search` | 70/30 blend of semantic + keyword search | Most use cases (default) |
| **Semantic** | `semantic_search` | Pure vector similarity matching | Natural language questions |
| **Keyword** | `keyword_search` | Exact term matching | Technical terms, product names, codes |
| **MMR** (Diverse) | `mmr` | Maximal Marginal Relevance — diverse results | Avoid repetition, broad topic coverage |
| **Threshold** (Strict) | `similarity_score_threshold` | Only returns results above quality threshold | Precision-critical, may return fewer results |

**Default**: `hybrid_search`

#### Retrieval Settings

| Setting | Default | Range | Description |
|---------|---------|-------|-------------|
| **Top K** | 10 | 1-20 | Number of chunks to retrieve per search |
| **Score Threshold** | 0.7 | 0.0-1.0 | Minimum similarity score to include a result |
| **Rerank** | Off | On/Off | Re-rank results using a secondary model (not yet available) |

**Top K Guidance**:

| Use Case | Top K |
|----------|-------|
| Quick, precise answers | 3-5 |
| General Q&A | 5-10 (default) |
| Comprehensive research | 10-15 |
| Maximum coverage | 15-20 |

---

## Part 5: Step 4 — Review & Create

The final step shows a summary of everything you configured:

### Review Summary Card

| Section | What It Shows |
|---------|---------------|
| **Name** | Your KB name |
| **Documents** | "N files, M URLs" |
| **Configuration** | Chunking strategy (capitalized), chunk size, chunk overlap |

### Info Banner

> 🚀 Your knowledge base will be created and documents will be processed in the background. You'll be notified when it's ready.

### What "Create Knowledge Base" Does

When you click the button:

1. **Validates** the draft (name ≥ 3 chars, at least 1 source, workspace set)
2. **Finalizes** the Redis draft → saves KB to PostgreSQL database
3. **Creates** a Celery background task for the processing pipeline
4. **Redirects** you to the Pipeline Monitor page

---

## Part 6: Pipeline Monitor — Watching Processing

After creation, you're redirected to the Pipeline Monitor page titled **"Processing Knowledge Base"**.

### 5 Pipeline Stages

| Stage | Icon | Description |
|-------|------|-------------|
| **Scraping** | 🔍 FileSearch | Extracting content from web sources |
| **Parsing** | 🕐 Clock | Processing and cleaning content |
| **Chunking** | 🗄️ Database | Splitting content into searchable chunks |
| **Embedding** | 🧠 Brain | Generating AI embeddings |
| **Indexing** | 💻 Cpu | Storing in vector database |

Each stage shows one of three states:
- **Pending** — gray, waiting to start
- **Active** — blue, pulsing animation, "Processing..." badge
- **Completed** — green, checkmark, "Completed" badge

### 6 Tracked Metrics

The stats grid shows real-time numbers. Labels adapt based on source type:

| Metric | Web Source Label | File Upload Label | Color |
|--------|----------------|-------------------|-------|
| Sources discovered | Pages Found | Docs Added | Gray |
| Sources processed | Pages Scraped | Docs Parsed | Blue |
| Failed | Failed | Failed | Red |
| Chunks | Chunks | Chunks | Purple |
| Embeddings | Embeddings | Embeddings | Yellow |
| Indexed | Indexed | Indexed | Green |

### Overall Progress

A progress bar shows estimated completion percentage (0-100%) calculated from completed stages (each stage = 20%).

### Pipeline Actions

| Action | Button | When Available |
|--------|--------|----------------|
| **Refresh** | 🔄 icon | Always (manual status refresh) |
| **Retry Pipeline** | Retry button | When pipeline fails or KB status is `failed` |
| **Cancel Pipeline** | Cancel button | While pipeline is running |
| **View Knowledge Base** | Link | When pipeline completes |

### Healthy Pipeline vs Warning Signs

**Healthy**:
- Stages complete sequentially (scraping → parsing → chunking → embedding → indexing)
- All metrics increase steadily
- Status reaches "Completed"

**Warning Signs**:
- "Failed" count > 0 — some pages couldn't be scraped
- Pipeline stuck on one stage for > 5 minutes
- Status shows "failed" — check the error message

### What to Do When Pipeline Fails

1. Read the error message in the red alert at the bottom
2. Click **Retry Pipeline** — this cleans up previous state and starts fresh
3. If retry fails, check:
   - Is the URL still accessible?
   - Did you set max_pages too high for the site?
   - Is the backend running and healthy?

---

## Part 7: KB Detail Page — Your Finished Knowledge Base

After the pipeline completes, navigate to your KB detail page.

### Header & Stats Cards

The header shows your KB name, status badge (ready/processing/failed), and creation date.

Four stats cards at the top:

| Card | Metric | Source |
|------|--------|--------|
| **Documents** | Number of documents | Document count |
| **Chunks** | Total chunk count | From pipeline results |
| **Total Words** | Combined word count | Across all documents |
| **Avg Chunk Size** | Average characters per chunk | Calculated |

### 5 Tabs

#### 1. Overview Tab

Displays KB metadata:
- **KB ID** — unique identifier
- **Context** — chatbot / chatflow / both
- **Status** — ready, processing, failed
- **Created/Updated** timestamps

#### 2. Documents Tab

Lists all documents in your KB:
- Document name, status, source type
- Word count, character count, page count
- Actions: **View Content**, **Edit** (for web scraping documents)

#### 3. Chunks Tab

Shows the first 20 chunks stored in your KB:
- **Chunk number** (global index)
- **Document name** badge
- **Character count**
- **Content preview** (first 3 lines)

If chunks are stored in Qdrant only (file uploads), shows a special panel:
> "Chunks Stored in Vector Database" — with Total Chunks, Documents, and Avg Size metrics.

Message at bottom: *"Showing first 20 chunks of N total"*

#### 4. Settings Tab

Read-only display of your KB configuration in 4 sections:

**Chunking Configuration** (blue):
- Strategy, Chunk Size, Chunk Overlap, Preserve Headings

**Model & Embedding Configuration** (green):
- Embedding Model, Vector Store, Distance Metric, HNSW M, Indexing Method, Context

**Retrieval Configuration** (purple):
- Search Strategy, Top K Results, Score Threshold

**Danger Zone** (red):
- **Delete Knowledge Base** — permanently deletes KB and all data (requires confirmation dialog)

#### 5. Test Search Tab

An interactive search interface to validate your KB works before deploying.

**Search Configuration**:
- **Query Input** — text field with placeholder *"Enter your search query... (e.g., 'How do I reset my password?')"*
- **Search Strategy** dropdown — same 5 strategies as retrieval config
- **Results Count (Top K)** slider — 1 to 20 (default: 5)

**Search Strategies in Test Search**:

| Strategy | Label | Description |
|----------|-------|-------------|
| `hybrid_search` | Hybrid (Recommended) | Combines semantic + keyword search (70/30) |
| `semantic_search` | Semantic | Pure vector similarity - natural language |
| `keyword_search` | Keyword | Exact term matching - technical queries |
| `mmr` | MMR (Diverse) | Diverse results - avoid repetition |
| `similarity_score_threshold` | Threshold (Strict) | Quality over quantity - may return fewer |

**Search Results** show:
- Total results count
- Strategy used (and whether fallback was used)
- Processing time in milliseconds
- For each result:
  - **Score** — color-coded: green (≥ 0.8), yellow (0.6-0.79), red (< 0.6)
  - **Confidence** badge — High (≥ 0.8), Medium (0.6-0.79), Low (< 0.6)
  - **Content** preview (expandable)
  - **Document ID**, page URL, page title
  - **Reasoning** — why this chunk was selected (if available)

> **Note**: Search is only available when KB status is "ready".

### Test Search Best Practices

Run these 5 types of test queries:

| Test Type | Example | What to Check |
|-----------|---------|---------------|
| **Core questions** | "How do I install the product?" | Are the top results relevant? |
| **Edge cases** | "What happens if X fails?" | Can the KB find less common info? |
| **Out-of-scope** | "What's the weather today?" | Low scores or no results (expected) |
| **Phrasing variations** | "installation steps" vs "how to set up" | Do different phrasings find the same content? |
| **Strategy comparison** | Same query, different strategies | Which strategy gives the best results? |

### Score Interpretation

| Score Range | Color | Meaning | Action |
|-------------|-------|---------|--------|
| **≥ 0.80** | Green | Excellent match | Content is highly relevant |
| **0.60 – 0.79** | Yellow | Moderate match | May need better chunking or more content |
| **< 0.60** | Red | Weak match | Re-chunk, add content, or lower threshold |

---

## Part 8: Configuration Recipes

Pre-built configuration combinations for common use cases:

| Use Case | Crawl Method | Max Pages | Chunk Strategy | Chunk Size | Overlap | Embedding Model | Retrieval Strategy |
|----------|-------------|-----------|---------------|-----------|---------|----------------|-------------------|
| **Product docs** (10-50 pages) | Crawl | 50 | By Heading | 512 | 100 | all-MiniLM-L6-v2 | hybrid_search |
| **Single FAQ page** | Single Page | 1 | By Sentence | 256 | 50 | all-MiniLM-L6-v2 | keyword_search |
| **Large docs site** (100+ pages) | Crawl | 200 | Adaptive | 1,024 | 200 | all-MiniLM-L6-v2 | hybrid_search |
| **Blog archive** | Crawl | 100 | By Paragraph | 512 | 100 | all-MiniLM-L6-v2 | semantic_search |
| **API reference** | Crawl | 50 | By Heading | 1,024 | 200 | all-MiniLM-L12-v2 | hybrid_search |
| **Multi-language docs** | Crawl | 50 | By Heading | 512 | 100 | paraphrase-multilingual-MiniLM-L12-v2 | hybrid_search |
| **Legal/policy docs** | Single Page | 1 | Semantic | 256 | 50 | all-mpnet-base-v2 | similarity_score_threshold |
| **Customer support articles** | Crawl | 100 | By Heading | 512 | 100 | all-MiniLM-L6-v2 | hybrid_search |

### Recipe: Quick Start (Defaults)

If you just want to get something working fast:

1. Enter your URL
2. Leave Crawl Method as "Crawl Website"
3. Skip Advanced Options
4. Preview Content → Approve all pages
5. Leave all Step 3 settings at defaults (Balanced preset, hybrid_search)
6. Create Knowledge Base

This gives you: By Heading chunking, 1,000-char chunks, 200-char overlap, hybrid search. Good for most websites.

---

## Part 9: Troubleshooting

| Problem | Cause | Solution |
|---------|-------|----------|
| **No content extracted** | Site blocks automated access | Try a different URL, check if the site requires JavaScript rendering |
| **Preview takes too long** | Large site, deep crawl | Reduce max_pages (try 10-25) and max_depth (try 2) |
| **Preview shows 0 pages** | Scraping failed silently | Check if the URL works in your browser, try Single Page mode |
| **Pipeline fails at Scraping** | URL inaccessible from server | Verify URL doesn't require authentication or VPN |
| **Pipeline fails at Embedding** | Memory issue with large batch | Reduce embedding batch size (default: 32) |
| **Pipeline stuck at "Processing"** | Backend issue or very large content | Wait up to 10 minutes, then try Cancel → Retry |
| **Test Search returns low scores** | Poor chunking for your content | Try a different chunking strategy (Semantic or Adaptive) |
| **Test Search returns no results** | Content gap or high threshold | Lower score threshold from 0.7 to 0.5, or add more content |
| **Chunks too small** | Chunk size set too low | Increase chunk_size to 512-1,024 |
| **Chunks contain mixed topics** | Chunk size too large | Decrease chunk_size to 256-512, try Semantic strategy |
| **"Approve & Add Source" does nothing** | No pages selected | Click "Select All" or check individual page checkboxes |
| **Validation says "Invalid URL"** | Missing protocol or malformed URL | Ensure URL starts with `https://` |
| **Bulk mode: some URLs invalid** | Mixed valid/invalid URLs | Fix invalid URLs or remove them; only valid URLs are processed |

---

## Part 10: Quick Reference Tables

### All Default Values

| Setting | Default Value |
|---------|---------------|
| KB Context | `both` |
| Crawl Method | `crawl` (Crawl Website) |
| Max Pages | 50 |
| Max Depth | 3 |
| Include Patterns | (none) |
| Exclude Patterns | (none) |
| Chunking Strategy | `by_heading` |
| Chunk Size | 1,000 characters |
| Chunk Overlap | 200 characters |
| Min Chunk Size | 50 |
| Max Chunk Size | 2,048 |
| Preserve Code Blocks | On |
| Enhanced Metadata | Off |
| Keep Original Files | Off |
| Embedding Model | `all-MiniLM-L6-v2` |
| Embedding Provider | `local` (CPU) |
| Embedding Batch Size | 32 |
| Embedding Dimensions | 384 |
| Vector Store | Qdrant |
| Distance Metric | Cosine |
| HNSW M | 16 |
| EF Construct | 100 |
| Vector Batch Size | 100 |
| Retrieval Strategy | `hybrid_search` |
| Top K | 10 |
| Score Threshold | 0.7 |
| Rerank | Off |
| Draft TTL | 24 hours |

### All Field Ranges

| Field | Min | Max | Step |
|-------|-----|-----|------|
| KB Name length | 3 chars | 100 chars | — |
| Max Pages | 1 | 1,000 | 1 |
| Max Depth | 1 | 10 | 1 |
| Chunk Size (slider) | 100 | 4,000 | 100 |
| Chunk Overlap (slider) | 0 | 500 | 50 |
| Semantic Threshold | 0.1 | 1.0 | 0.1 |
| Min Chunk Size | 10 | 500 | 1 |
| Max Chunk Size | 256 | 4,096 | 1 |
| HNSW M | 4 | 64 | — |
| EF Construct | 50 | 500 | — |
| Top K (retrieval) | 1 | 20 | 1 |
| Score Threshold | 0.0 | 1.0 | — |
| Embedding Batch Size | 8 | 128 | — |
| Bulk Max Pages (per-URL) | 1 | 500 | 1 |
| Bulk Max Depth (per-URL) | 1 | 10 | 1 |

### Pattern Cheat Sheet

| Pattern | Example Match | Use Case |
|---------|---------------|----------|
| `/docs/**` | `/docs/getting-started`, `/docs/api/v2/endpoints` | Include only docs |
| `/blog/**` | `/blog/2025/my-post` | Include only blog |
| `*.pdf` | `/files/manual.pdf` | Only PDF links |
| `/*/api/**` | `/v1/api/users`, `/v2/api/auth` | API docs in any version |
| `/help/*` | `/help/faq` (not `/help/faq/details`) | Help pages (single level) |
| `/admin/**` | `/admin/settings`, `/admin/users/list` | Exclude admin pages |
| `/auth/**` | `/auth/login`, `/auth/register` | Exclude auth pages |
| `*/changelog*` | `/docs/changelog`, `/v2/changelog-2025` | Exclude changelogs |

### Strategy Comparison Matrix

| Strategy | Speed | Quality | Structured Docs | Unstructured Text | Mixed Content | Code | Multilingual |
|----------|-------|---------|----------------|-------------------|---------------|------|-------------|
| No Chunking | ★★★★★ | ★★☆☆☆ | ★★☆☆☆ | ★★☆☆☆ | ★★☆☆☆ | ★★☆☆☆ | ★★★★★ |
| By Sentence | ★★★★☆ | ★★★☆☆ | ★★☆☆☆ | ★★★★☆ | ★★★☆☆ | ★☆☆☆☆ | ★★★★☆ |
| By Paragraph | ★★★★☆ | ★★★☆☆ | ★★★☆☆ | ★★★★★ | ★★★☆☆ | ★★☆☆☆ | ★★★★☆ |
| By Heading | ★★★★☆ | ★★★★☆ | ★★★★★ | ★★☆☆☆ | ★★★☆☆ | ★★★☆☆ | ★★★★☆ |
| Semantic | ★★☆☆☆ | ★★★★★ | ★★★★☆ | ★★★★★ | ★★★★★ | ★★☆☆☆ | ★★★☆☆ |
| Adaptive | ★★★☆☆ | ★★★★☆ | ★★★★☆ | ★★★★☆ | ★★★★★ | ★★★☆☆ | ★★★★☆ |
| Hybrid | ★★★☆☆ | ★★★★★ | ★★★★★ | ★★★★☆ | ★★★★★ | ★★★☆☆ | ★★★★☆ |
| Custom | ★★★★☆ | ★★★☆☆ | ★★★☆☆ | ★★★☆☆ | ★★☆☆☆ | ★★★★★ | ★★★★☆ |
| Recursive | ★★★★★ | ★★★☆☆ | ★★★☆☆ | ★★★★☆ | ★★★★☆ | ★★★☆☆ | ★★★★★ |

---

*Last updated: February 2026*
*Source verified against: KBWebSourceForm.tsx, KBChunkingConfig.tsx, KBCreationWizard.tsx, kb-store.ts, knowledge-base.ts, pipeline-monitor.tsx, detail.tsx, KBTestSearch.tsx, chunking_service.py, embedding_service_local.py, qdrant_service.py*
