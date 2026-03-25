# Comprehensive Guide: Creating a Knowledge Base with File Upload

> **End-to-end walkthrough** — from preparing your files to testing search results — with deep guidance on every configuration option.

---

## Table of Contents

- [Part 1: Before You Start](#part-1-before-you-start)
- [Part 2: Step 1 — Basic Info](#part-2-step-1--basic-info)
- [Part 3: Step 2 — Add Documents (File Upload)](#part-3-step-2--add-documents-file-upload)
- [Part 4: Step 2 — Add Documents (Text Input)](#part-4-step-2--add-documents-text-input)
- [Part 5: Source Management & Content Preview](#part-5-source-management--content-preview)
- [Part 6: Content Approval](#part-6-content-approval)
- [Part 7: Step 3 — Configure](#part-7-step-3--configure)
- [Part 8: Step 4 — Review & Create](#part-8-step-4--review--create)
- [Part 9: Pipeline Monitor](#part-9-pipeline-monitor--watching-processing)
- [Part 10: KB Detail Page](#part-10-kb-detail-page--your-finished-knowledge-base)
- [Part 11: Configuration Recipes](#part-11-configuration-recipes)
- [Part 12: Troubleshooting](#part-12-troubleshooting)
- [Part 13: Quick Reference Tables](#part-13-quick-reference-tables)

---

## Part 1: Before You Start

### Prerequisites

1. **PrivexBot account** — sign up or log in
2. **Workspace** — you need at least one workspace (created during onboarding)
3. **Files ready** — the documents you want to add to your knowledge base (see Supported Formats below)

### The 4-Step Wizard Flow

```
Step 1          Step 2              Step 3           Step 4
┌──────────┐    ┌───────────────┐   ┌────────────┐   ┌──────────────┐
│ Basic    │───▶│ Add Documents │──▶│ Configure  │──▶│ Review &     │
│ Info     │    │ (Upload Files │   │ (Chunking, │   │ Create       │
│          │    │  or Paste     │   │  Model,    │   │              │
│          │    │  Text)        │   │  Retrieval)│   │              │
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
| **Source** | A content origin — in this guide, an uploaded file or pasted text |
| **Chunk** | A segment of text created by splitting your content for efficient search |
| **Embedding** | A numerical vector representation of text that enables semantic search |
| **Vector** | The stored embedding in Qdrant that powers similarity matching |
| **Retrieval** | The process of finding the most relevant chunks for a user's question |
| **Pipeline** | The automated sequence: Parsing → Chunking → Embedding → Indexing |
| **Tika** | Apache Tika — the document parsing engine that extracts text from 15+ file formats |

### Supported File Formats

| Format | Extensions | MIME Type | Category | OCR Support |
|--------|-----------|-----------|----------|-------------|
| **PDF** | `.pdf` | `application/pdf` | Document | Yes |
| **Word (modern)** | `.docx` | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | Document | No |
| **Word (legacy)** | `.doc` | `application/msword` | Document | No |
| **Excel (modern)** | `.xlsx` | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` | Spreadsheet | No |
| **Excel (legacy)** | `.xls` | `application/vnd.ms-excel` | Spreadsheet | No |
| **PowerPoint (modern)** | `.pptx` | `application/vnd.openxmlformats-officedocument.presentationml.presentation` | Presentation | No |
| **PowerPoint (legacy)** | `.ppt` | `application/vnd.ms-powerpoint` | Presentation | No |
| **Plain Text** | `.txt` | `text/plain` | Text | N/A |
| **CSV** | `.csv` | `text/csv` | Data | N/A |
| **Markdown** | `.md` | `text/markdown` | Text | N/A |
| **JSON** | `.json` | `application/json` | Data | N/A |
| **HTML** | `.html` | `text/html` | Web | N/A |
| **Rich Text** | `.rtf` | `application/rtf` | Document | No |
| **EPUB** | `.epub` | `application/epub+zip` | Book | No |

> **Note**: The backend Tika service supports additional formats beyond what the frontend accepts (ODT, ODS, ODP, XML, PNG, JPG, TIFF, BMP). The table above reflects the 14 formats accepted by the upload form.

---

## Part 2: Step 1 — Basic Info

When you click **Create Knowledge Base**, the wizard opens to Step 1.

### Fields

| Field | Required | Validation | Default |
|-------|----------|-----------|---------|
| **Knowledge Base Name** | Yes | Min 3 chars, max 100 chars | (empty) |
| **Description** | No | Free text | (empty) |

- **Name** — Choose a descriptive name like "Product Manuals" or "Company Policies Q1 2026". This name appears in your KB list and when attaching KBs to chatbots.
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

## Part 3: Step 2 — Add Documents (File Upload)

### Choosing a Source Type

Step 2 opens with the **Source Selector** — a grid titled **"Choose a Source"** with the subtitle *"Select how you want to add documents to your knowledge base"*.

Six source types in three categories:

| Category | Source | Label | Description |
|----------|--------|-------|-------------|
| **Direct** | Upload Files | "Upload Files" | PDF, DOCX, TXT, MD files |
| **Direct** | Paste Text | "Paste Text" | Copy and paste content directly |
| **Web** | Add URL | "Add URL" | Single webpage or document |
| **Web** | Crawl Website | "Crawl Website" | Scrape entire website or sitemap |
| **Cloud** | Notion | "Notion" | Import from Notion workspace |
| **Cloud** | Google Drive | "Google Drive" | Docs, Sheets, or Drive folders |

This guide focuses on **Upload Files** (primary) and **Paste Text** (secondary). For web sources, see [Guide: Creating a KB with Web URLs](guide-create-kb-with-web-urls.md).

> **Tip**: You can add multiple sources from different types to the same knowledge base. All documents will be processed and indexed together.

### File Upload Form

When you click **"Upload Files"**, the file upload form appears.

#### Drag-and-Drop Zone

The upload area is a dashed-border rectangle with:
- **Upload icon** (arrow-up) at the top
- **"Drag & drop files here, or click to browse"** — primary instruction
- **"PDF, Word, Excel, PowerPoint, Text, CSV, Markdown, JSON, HTML"** — accepted formats
- **"Max 20 files, up to 100.0 MB each"** — limits
- **"Large PDFs with scanned images may take several minutes to process"** — warning

#### Dropzone Visual States

| State | Appearance | When |
|-------|-----------|------|
| **Idle** | Gray dashed border, default colors | No interaction |
| **Drag active (valid)** | Primary blue border, light blue background | Dragging supported file(s) over the zone |
| **Drag active (invalid)** | Red border, light red background | Dragging unsupported file type over the zone |
| **Disabled** | 50% opacity, no pointer events | Upload is in progress |

#### Upload Limits

| Limit | Value |
|-------|-------|
| **Max file size** | 100 MB per file |
| **Max files** | 20 files per upload batch |
| **Min file size** | > 0 bytes (empty files rejected) |

Files that exceed 100 MB are rejected by the dropzone automatically. Duplicate filenames are silently ignored (existing file takes priority).

#### File Complexity Analysis

When files are added to the upload queue, each file is analyzed for **complexity** — an estimate of how long parsing will take. This helps set expectations before upload.

**Estimation Formulas:**

| File Category | Types | Formula | Example (10 MB) |
|--------------|-------|---------|-----------------|
| **Fast parse** | TXT, CSV, MD, JSON, HTML | `2 + (sizeMB × 0.5)` seconds | ~7s |
| **OCR types** | PDF, PNG, JPG, TIFF | `10 + (sizeMB × 8)` seconds | ~90s |
| **Other types** | DOCX, XLSX, PPTX, RTF, EPUB, DOC, XLS, PPT | `5 + (sizeMB × 2)` seconds | ~25s |

**Complexity Levels:**

| Level | Badge Color | When Assigned |
|-------|------------|---------------|
| **low** | Green | Fast-parse types under 20 MB |
| **medium** | Yellow | Other types under 20 MB, or fast types over 20 MB |
| **high** | Orange | OCR types over 5 MB, or any file over 20 MB with medium base |
| **very_high** | Red | Any file over 50 MB |

**Size-Based Warnings:**

| File Size | Warning | Effect |
|-----------|---------|--------|
| > 20 MB | "Large file (X.X MB)" | Complexity bumps up one level |
| > 50 MB | "Consider splitting into smaller documents" | Complexity set to `very_high` |
| > 100 MB | "Exceeds maximum size of 100MB" | File cannot be processed (`canProcess: false`) |

#### File List Display

After adding files, they appear in a scrollable list (max height 256px) with a header showing the total count:

**"Files (N)"** — with an optional green counter: **"N uploaded"** for successfully processed files.

Each file row shows:

| Element | Position | Description |
|---------|----------|-------------|
| **File icon** | Left | Icon based on MIME type (PDF, spreadsheet, image, or generic file) |
| **Filename** | Center-top | Truncated with ellipsis if too long |
| **Complexity badge** | After filename | Color-coded badge (shown for pending files only): "low", "medium", "high", or "complex" (for very_high) |
| **File size** | Below filename | Formatted: B, KB, or MB |
| **Estimated time** | After size (dot-separated) | Shown for pending files: "~Ns" or "~N min" |
| **Status message** | After size | Shown during processing: amber-colored text |
| **Parse results** | After size | Shown after success: "N pages", "N words", "N.Ns" |
| **Complexity warnings** | Below size row | Amber text with alert icon, max 2 warnings shown |
| **Progress bar** | Below file info | Shown during uploading/parsing status |
| **Action button** | Right side | Depends on status (see below) |

**Per-File Status & Action Buttons:**

| Status | Row Color | Right-Side Element | Progress |
|--------|-----------|-------------------|----------|
| **pending** | Gray background | `×` remove button | — |
| **uploading** | Blue background | Spinning loader (amber) | Progress bar |
| **parsing** | Amber background | Spinning loader (amber) | Progress bar |
| **success** | Green background | Green checkmark | — |
| **error** | Red background | Red alert icon | — |

**Error Display**: When a file fails, the error message appears in red text below the file info, supporting multi-line messages (`whitespace-pre-line`).

#### Estimated Time Summary Panel

When pending files exist, a summary panel appears below the file list:

- **"Total estimated time:"** followed by the sum of all pending files' estimated seconds
- If any pending file has `high` or `very_high` complexity: amber warning with alert icon — **"Complex files may take longer"**

#### Upload Flow

When you click the **Upload** button:

1. **Draft preparation** — If `onBeforeUpload` is provided, the system first ensures a draft exists. Button shows **"Preparing..."** with spinner.
2. **Mark all pending as uploading** — All pending files switch to `uploading` status at 10% progress with message "Uploading..."
3. **Parallel processing** — Each file is uploaded and parsed independently via `Promise.all`
4. **Per-file progress animation** — Every 3 seconds, progress increments by 5% (up to 90%) for files still in uploading/parsing status
5. **Status transition per file**:
   - `pending` → `uploading` (10%) → `parsing` (30%, message: "Parsing document (OCR may take a while)...") → `success` (100%)
   - Or: → `error` (with error message)
6. **Completion** — If all files succeed, the `onSuccess` callback fires

#### Upload Button States

| State | Label | Icon | When |
|-------|-------|------|------|
| **Ready** | "Upload (N)" | Upload arrow | Pending files exist, not uploading |
| **Preparing** | "Preparing..." | Spinning loader | Draft is being created |
| **Processing** | "Processing..." | Spinning loader | Files are being uploaded/parsed |
| **Disabled** | "Upload" | Upload arrow | No pending files, or upload in progress |

---

## Part 4: Step 2 — Add Documents (Text Input)

### Choosing Text Input

Click **"Paste Text"** in the Source Selector to open the text input form. The form is titled **"Add Text Content"** with the subtitle *"Enter text content directly or use a template"*.

### Quick Templates

Four templates help you get started:

| Template | Name | Description | Content Structure |
|----------|------|-------------|-------------------|
| **FAQ** | FAQ | Question and answer format | `Q: ...\nA: ...` pairs |
| **Procedure** | Procedure | Step-by-step instructions | Title + numbered steps |
| **Policy** | Policy | Company policy or guidelines | Overview + Guidelines + Exceptions |
| **Knowledge Article** | Knowledge Article | General knowledge content | Title + Summary + Details + Related Topics |

Click a template button to populate the content textarea. The template content is a starting point — edit it freely.

> **Tip**: Select a template to get started, or write your own content below.

### Form Fields

#### Title (Required)

- **Label**: "Title *"
- **Placeholder**: "e.g., How to reset your password"
- **Helper text**: "Give your content a descriptive title"
- **Validation**: Must not be empty

#### Content (Required)

- **Label**: "Content *"
- **Placeholder**: "Enter your content here..."
- **Size**: 12 rows tall, monospace font
- **Helper text**: "Supports plain text, markdown formatting, and structured content"
- **Minimum**: 10 words required

**Live Statistics** (displayed in the top-right of the content section):

| Stat | Format |
|------|--------|
| Words | `N words` |
| Characters | `N characters` |
| Lines | `N lines` |

**Content Badges** (displayed below the textarea):

| Badge | Color | When |
|-------|-------|------|
| "Good length" | Default (blue) | 10+ words |
| "Too short" | Secondary (gray) | 1-9 words |

### Advanced Options

Click **"Advanced Options"** (with gear icon) to expand additional settings:

| Option | Type | Default | Values |
|--------|------|---------|--------|
| **Content Format** | Dropdown | Plain Text | Plain Text, Markdown, Structured Text |
| **Language** | Dropdown | Auto-detect | Auto-detect, English, Spanish, French, German |
| **Preserve line breaks and formatting** | Checkbox | On | On/Off |
| **Auto-generate title from content (if empty)** | Checkbox | Off | On/Off |

### Live Preview

When content is not empty, a preview panel appears:

- **Title** — displayed in bold (or "Untitled" if title is empty)
- **Content** — first 200 characters with "..." truncation
- Gray background with border, max height 128px with scroll

### Actions

| Button | Type | Enabled When |
|--------|------|-------------|
| **Cancel** | Outline | Always |
| **Add Text Content** | Primary (with + icon) | Title not empty AND content not empty AND 10+ words |

### Validation Errors (Toast Notifications)

| Error | Title | Description |
|-------|-------|-------------|
| No title | "Title Required" | "Please enter a title for this content" |
| No content | "Content Required" | "Please enter some content" |
| Too short | "Content Too Short" | "Please enter at least 10 words of content" |

---

## Part 5: Source Management & Content Preview

### Added Sources List

After adding files or text, the **"Added Sources (N)"** section shows all sources as cards.

#### Source Card Layout

Each card displays:

| Element | Description |
|---------|-------------|
| **Icon** | File icon (for files), Globe (for web), Type icon (for text) |
| **Title** | Filename (for files), URL (for web), title (for text) |
| **Status badge** | Green "Completed", Red "Failed", or Amber "Pending" |
| **Description** | File: "X.XX MB, N pages, N words" / Text: "N characters" |
| **Source type** | "file source" / "text source" / "web source" |
| **Date** | "Added [today's date]" |
| **Actions dropdown** | Gear icon with "Preview Content" and "Remove Source" |

#### Empty State

When no sources have been added:

> **"No Sources Added Yet"**
>
> Use the source types above to add content
>
> 1. Select a source type (Website, File, Text)
> 2. Configure and preview the content
> 3. Approve & add the source
> 4. Continue to approval step

#### Source Actions

| Action | Icon | Description |
|--------|------|-------------|
| **Preview Content** | Eye icon | Opens the full content preview dialog |
| **Remove Source** | Trash icon (red) | Opens delete confirmation dialog |

### Delete Confirmation Dialog

Title: **"Remove Source?"** (with red alert icon)

> "This will remove the source from your knowledge base draft. You can add it back later if needed."

Buttons: **Cancel** (outline) | **Remove Source** (red, with trash icon)

### Content Preview Dialog

A full-screen dialog (95% viewport width, max 7xl, 95% viewport height) with three sections:

#### Header
- Source icon + **"Full Content Preview"**
- Source title as subtitle

#### File Preview Content

For file sources, the preview shows two information cards plus editable page content:

**1. File Information Card:**

| Field | Source |
|-------|--------|
| **Filename** | From metadata, or "Unknown" |
| **Size** | Calculated from `file_size` metadata, displayed as "X.XX MB" |
| **Type** | From `mime_type` metadata, or "auto-detected" |
| **Parsing Time** | From `parsing_time_ms` metadata, displayed as "X.Xs" |

**2. Content Statistics Card:**

| Stat | Source |
|------|--------|
| **Total Pages** | Count of preview pages, or `page_count` metadata |
| **Total Words** | Sum of words across all preview pages, or `word_count` metadata |
| **Parsed Date** | From `parsed_at` metadata, formatted as locale date |

**3. Parsed Document Content — Editable Page Cards:**

For each page extracted from the file:

- **Page header**: "Page N:" + page title
- **Word count badge**: "N words" in gray
- **"Edited" badge**: Blue badge shown if page has been edited
- **Edit button**: Opens inline ContentEditor
- **Copy button**: Copies page content to clipboard
- **Revert button**: Reverts to original content (only shown for edited pages, orange styling)

**Page content area**: Monospace text in a scrollable container (max 192px height).

If no preview pages are available:

> **"Content Preview Unavailable"**
> "Full content preview not available. The file may have failed to parse or contains no extractable text content."

#### Toolbar Actions (above page list)

| Action | Style | Description |
|--------|-------|-------------|
| **Copy All Pages** | Blue outline | Copies all pages to clipboard as Markdown with `---` separators |
| **Export All** | Green outline dropdown | Export as Markdown (.md), Plain Text (.txt), or HTML (.html) |

#### Footer
- Source type label ("File Source", "Text Source", "Web Source")
- **Close Preview** button (gray)

---

## Part 6: Content Approval

After adding sources, the wizard includes a **Content Approval** step. This aggregates pages from ALL sources (files, web, text) for review before proceeding to configuration.

### Approval Card

The card is titled **"Content Approval"** with the subtitle *"Review extracted content and approve pages for knowledge base creation"*.

### Statistics Panel

Five stats displayed in a gradient panel:

| Stat | Color | Source |
|------|-------|--------|
| **Total Pages** | Gray/white | Count of all pages across all sources |
| **Selected** | Blue | Currently selected pages (for approval) |
| **Edited** | Amber | Pages that have been manually edited |
| **Total Words** | Purple | Sum of words across all pages |
| **Approved** | Green | Pages already approved |

### Extracted Pages List

A scrollable list (400px height) of all pages from all sources. Each page row has:

#### Page States

| State | Background | Badge | Selectable |
|-------|-----------|-------|------------|
| **Not approved** | White/gray | — | Yes |
| **Selected** (for approval) | Light blue | — | Yes |
| **Approved** | Light green, slight opacity | Green "Approved" badge | No (locked) |
| **Needs re-approval** | Light amber | Amber "Needs Re-approval" badge | Yes |
| **Edited** (not needing re-approval) | — | Blue "Edited" badge | — |

#### Page Row Content

| Element | Description |
|---------|-------------|
| **Checkbox** | Select/deselect for approval (disabled for already-approved pages) |
| **File icon** | Gray file icon |
| **Title** | Page title or "Page N" |
| **Badges** | Approved / Needs Re-approval / Edited |
| **URL** | Shown for web sources (truncated on desktop, full on mobile) |
| **Stats** | "N words, N characters" (live-calculated from content) |
| **Preview button** | "Preview Content" / "Preview" — opens content preview modal |

### Bulk Actions

| Action | Button | When Available |
|--------|--------|----------------|
| **Select All / Deselect All** | Toggle button | Always. Only selects pages that are not already approved (or that need re-approval) |
| **Approve Selected (N)** | Green button | When at least 1 page is selected |

### How Approval Works

1. Pages from ALL draft sources are aggregated into a unified list
2. By default, all unapproved pages are pre-selected
3. Click **"Approve Selected (N)"** to approve
4. Approved pages are persisted to source metadata (`approvedPageIndices`) — they survive wizard navigation (back/forward)
5. If you edit a page after approving it, it gets a "Needs Re-approval" badge — you must re-approve it

### Pre-Approval

When all pages were approved during source addition (immediate preview flow), the system shows a toast:

> **"Content Pre-Approved"**
> "All N pages were approved during source addition. You can proceed to the next step."

---

## Part 7: Step 3 — Configure

Step 3 presents three configuration sections: **Chunking**, **Model**, and **Retrieval**. Each has sensible defaults.

### Chunking Configuration

The chunking card is titled **"Chunking Configuration"** with the subtitle *"Configure how your content will be split into chunks for optimal retrieval"*.

#### Presets (Quick Start)

Choose a preset to auto-configure strategy, chunk size, and overlap:

| Preset | Icon | Strategy | Chunk Size | Overlap | Min | Max | Best For |
|--------|------|----------|-----------|---------|-----|-----|----------|
| **Precise** | Target | Semantic | 256 | 50 | 50 | 512 | Detailed Q&A, definitions, glossaries |
| **Balanced** | Balance | By Heading | 512 | 100 | 100 | 1,024 | Most use cases (default) |
| **Contextual** | Books | Hybrid | 1,024 | 200 | 200 | 2,048 | Long-form content, comprehensive answers |

> **Recommendation**: Start with **Balanced** preset. Only change to Precise if answers are too vague, or Contextual if answers lack context.

#### All 9 Chunking Strategies

| Strategy | Value | How It Works | Best For | Chunk Size Rec |
|----------|-------|-------------|----------|---------------|
| **No Chunking** | `no_chunking` | Keeps each document as a single chunk | Very small docs, summaries | N/A |
| **By Sentence** | `sentence_based` | Splits at sentence boundaries (`.!?`) | Precise Q&A, FAQs, definitions | 256-512 |
| **By Paragraph** | `paragraph_based` | Splits at paragraph breaks (`\n\n`) | Blog posts, articles | 512-1,000 |
| **By Heading** | `by_heading` | Splits at Markdown heading boundaries (`# ## ###`) | Structured docs, guides, wikis | 512-1,024 |
| **Semantic** | `semantic` | Uses AI embeddings to detect topic boundaries | Mixed content, varied topics | 256-512 |
| **Adaptive** | `adaptive` | Auto-detects best strategy based on content structure | Unknown content structure | 512-1,024 |
| **Hybrid** | `hybrid` | Heading-first, then paragraph splitting for oversized chunks | Complex long-form documents | 1,024-2,048 |
| **Custom** | `custom` | Splits at user-defined separator strings | Special formats, custom markup | Varies |
| **Recursive** | `recursive` | Recursively splits using hierarchy of separators (`\n\n` → `\n` → `. ` → ` `) | General purpose, default fallback | 500-1,500 |

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
| **Keep Original Files** | Switch | Off | Stores originals in cloud storage for re-processing. Only shown for file uploads. |

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
- **Search speed**: Fast (chunk_size < 512) or Moderate (chunk_size >= 512)
- **Context richness**: High (chunk_size > 512) or Moderate (chunk_size <= 512)

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

## Part 8: Step 4 — Review & Create

The final step shows a summary of everything you configured:

### Review Summary Card

| Section | What It Shows |
|---------|---------------|
| **Name** | Your KB name |
| **Documents** | "N files, M URLs" |
| **Configuration** | Chunking strategy (capitalized), chunk size, chunk overlap |

### Info Banner

> Your knowledge base will be created and documents will be processed in the background. You'll be notified when it's ready.

### What "Create Knowledge Base" Does

When you click the button:

1. **Validates** the draft (name >= 3 chars, at least 1 source, workspace set)
2. **Finalizes** the Redis draft -> saves KB to PostgreSQL database
3. **Creates** a Celery background task for the processing pipeline
4. **Redirects** you to the Pipeline Monitor page

---

## Part 9: Pipeline Monitor — Watching Processing

After creation, you're redirected to the Pipeline Monitor page titled **"Processing Knowledge Base"**.

### 5 Pipeline Stages

| Stage | Description |
|-------|-------------|
| **Scraping** | Extracting content from sources (for file uploads, this is the Tika parsing stage) |
| **Parsing** | Processing and cleaning content |
| **Chunking** | Splitting content into searchable chunks |
| **Embedding** | Generating AI embeddings |
| **Indexing** | Storing in vector database |

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
| **Refresh** | Refresh icon | Always (manual status refresh) |
| **Retry Pipeline** | Retry button | When pipeline fails or KB status is `failed` |
| **Cancel Pipeline** | Cancel button | While pipeline is running |
| **View Knowledge Base** | Link | When pipeline completes |

### Healthy Pipeline vs Warning Signs

**Healthy**:
- Stages complete sequentially (scraping -> parsing -> chunking -> embedding -> indexing)
- All metrics increase steadily
- Status reaches "Completed"

**Warning Signs**:
- "Failed" count > 0 — some files couldn't be parsed
- Pipeline stuck on one stage for > 5 minutes
- Status shows "failed" — check the error message

### What to Do When Pipeline Fails

1. Read the error message in the red alert at the bottom
2. Click **Retry Pipeline** — this cleans up previous state and starts fresh
3. If retry fails, check:
   - Is the file corrupted or empty?
   - Does the file contain extractable text (not just scanned images)?
   - Is the Tika service running and healthy?

---

## Part 10: KB Detail Page — Your Finished Knowledge Base

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

For file upload sources, the document name shows the original filename and source type shows "file".

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
  - **Score** — color-coded: green (>= 0.8), yellow (0.6-0.79), red (< 0.6)
  - **Confidence** badge — High (>= 0.8), Medium (0.6-0.79), Low (< 0.6)
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
| **>= 0.80** | Green | Excellent match | Content is highly relevant |
| **0.60 – 0.79** | Yellow | Moderate match | May need better chunking or more content |
| **< 0.60** | Red | Weak match | Re-chunk, add content, or lower threshold |

---

## Part 11: Configuration Recipes

Pre-built configuration combinations for common file upload use cases:

| Use Case | File Types | Chunk Strategy | Chunk Size | Overlap | Embedding Model | Retrieval Strategy |
|----------|-----------|---------------|-----------|---------|----------------|-------------------|
| **Product manuals (PDF)** | PDF | By Heading | 1,024 | 200 | all-MiniLM-L6-v2 | hybrid_search |
| **FAQ documents** | TXT, MD | By Sentence | 256 | 50 | all-MiniLM-L6-v2 | keyword_search |
| **Legal contracts** | PDF | Semantic | 256 | 50 | all-mpnet-base-v2 | similarity_score_threshold |
| **Data sheets** | CSV, XLSX | By Paragraph | 512 | 100 | all-MiniLM-L6-v2 | hybrid_search |
| **Technical documentation** | DOCX | By Heading | 512 | 100 | all-MiniLM-L12-v2 | hybrid_search |
| **Multi-language documents** | Any | By Heading | 512 | 100 | paraphrase-multilingual-MiniLM-L12-v2 | hybrid_search |
| **Mixed file batch** | Mixed | Adaptive | 1,024 | 200 | all-MiniLM-L6-v2 | hybrid_search |
| **Presentation decks** | PPTX | By Paragraph | 512 | 100 | all-MiniLM-L6-v2 | semantic_search |
| **Knowledge articles (text)** | Text input | By Sentence | 256 | 50 | all-MiniLM-L6-v2 | hybrid_search |
| **Company policies** | PDF, DOCX | Hybrid | 1,024 | 200 | all-MiniLM-L6-v2 | hybrid_search |

### Recipe: Quick Start (Defaults)

If you just want to get something working fast:

1. Drop your files into the upload zone
2. Click **Upload (N)**
3. Wait for parsing to complete
4. Review sources — click Preview to inspect content
5. Approve content in the Content Approval step
6. Leave all Step 3 settings at defaults (Balanced preset, hybrid_search)
7. Create Knowledge Base

This gives you: By Heading chunking, 1,000-char chunks, 200-char overlap, hybrid search. Good for most document types.

### Recipe: High-Precision Legal/Contract Search

For legal documents where precision matters more than recall:

1. Upload your PDF contracts
2. In Step 3, change:
   - Chunking preset: **Precise**
   - Strategy: **Semantic** (256 chars, 50 overlap)
   - Embedding model: **all-mpnet-base-v2** (highest quality)
   - Retrieval: **Threshold (Strict)** with score threshold 0.8
   - Top K: 3-5
3. Create Knowledge Base
4. In Test Search, verify that queries return highly specific contract clauses

### Recipe: Large Document Batch

For 10-20 mixed documents where comprehensiveness matters:

1. Upload all files (up to 20)
2. Wait for parallel parsing (watch the estimated time summary)
3. Review and approve all content
4. In Step 3, change:
   - Chunking: **Contextual** preset (1,024 chars, 200 overlap, Hybrid strategy)
   - Keep embedding model at default (all-MiniLM-L6-v2 for speed)
   - Retrieval: **Hybrid** with Top K: 10-15
5. Create Knowledge Base

---

## Part 12: Troubleshooting

### File Upload Issues

| Problem | Cause | Solution |
|---------|-------|----------|
| **File rejected on drop** | Unsupported format or > 100 MB | Check [Supported File Formats](#supported-file-formats) table. Split large files. |
| **Duplicate file ignored** | Same filename already in the queue | Rename the file or remove the existing entry first |
| **No files accepted** | Browser drag-and-drop issue | Try clicking the zone to use the file browser instead |
| **Upload button disabled** | No pending files in queue, or upload in progress | Add files first, or wait for current upload to finish |

### Parsing Issues

| Problem | Cause | Solution |
|---------|-------|----------|
| **"Parsing document (OCR may take a while)..." hangs** | Complex scanned PDF | Wait up to 10 minutes. The system retries up to 3 times with exponential backoff. |
| **Upload times out** | Large PDF requiring OCR | Split PDF into smaller parts. The system auto-falls back to text-only extraction if OCR times out. |
| **No content extracted** | Binary/image-only PDF with no text layer | Ensure PDF has a text layer. Re-save as searchable PDF. |
| **Content looks garbled** | Wrong encoding or damaged file | Re-save the file in UTF-8 or try a different format (e.g., save DOCX as PDF). |
| **Complexity shows "very_high"** | File > 50 MB | Split into smaller documents. Consider extracting only relevant sections. |
| **Error: "File is empty"** | Zero-byte file uploaded | Re-save the file and ensure it has content. |
| **Error: "File too large"** | File exceeds 100 MB limit | Compress the file, split into parts, or remove unnecessary pages/images. |
| **Error: "Cannot connect to document parsing service"** | Tika Docker container is down | Contact support or restart the backend services. |

### Text Input Issues

| Problem | Cause | Solution |
|---------|-------|----------|
| **"Add Text Content" button disabled** | Title empty, content empty, or fewer than 10 words | Fill in the required fields with sufficient content |
| **Template doesn't load** | JavaScript error | Refresh the page and try again |
| **Content stats show 0 words** | Only whitespace entered | Enter actual text content |

### Pipeline Issues

| Problem | Cause | Solution |
|---------|-------|----------|
| **Pipeline fails at Embedding** | Memory issue with large batch | Reduce embedding batch size in model config. Try re-processing with fewer documents. |
| **Pipeline stuck at "Processing"** | Backend issue or very large content | Wait up to 10 minutes, then try Cancel -> Retry |
| **Preview shows no pages** | Tika parsing returned empty result | Check file isn't corrupted. Try opening and re-saving in the original application. |
| **"Failed" count > 0 in pipeline** | Some files couldn't be processed | Check which files failed. Re-upload corrected versions. |

### Test Search Issues

| Problem | Cause | Solution |
|---------|-------|----------|
| **Test Search returns low scores** | Poor chunking for your content | Try a different chunking strategy (Semantic or Adaptive) |
| **Test Search returns no results** | Content gap or high threshold | Lower score threshold from 0.7 to 0.5, or add more content |
| **Chunks too small** | Chunk size set too low | Increase chunk_size to 512-1,024 |
| **Chunks contain mixed topics** | Chunk size too large | Decrease chunk_size to 256-512, try Semantic strategy |

---

## Part 13: Quick Reference Tables

### All Default Values

| Setting | Default Value |
|---------|---------------|
| KB Context | `both` |
| Max File Size | 100 MB |
| Max Files Per Upload | 20 |
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
| Text Input: Content Format | Plain Text |
| Text Input: Language | Auto-detect |
| Text Input: Preserve Formatting | On |
| Text Input: Auto-generate Title | Off |

### All Field Ranges

| Field | Min | Max | Step |
|-------|-----|-----|------|
| KB Name length | 3 chars | 100 chars | — |
| File size | 1 byte | 100 MB | — |
| Files per upload | 1 | 20 | — |
| Text input words | 10 | — | — |
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

### File Complexity Estimation Formulas

| Category | File Types | Formula | Complexity |
|----------|-----------|---------|------------|
| **Fast parse** | TXT, CSV, MD, JSON, HTML | `2 + (sizeMB * 0.5)` seconds | low |
| **OCR types** | PDF, PNG, JPG, TIFF | `10 + (sizeMB * 8)` seconds | medium-high |
| **Other types** | DOCX, XLSX, PPTX, DOC, XLS, PPT, RTF, EPUB | `5 + (sizeMB * 2)` seconds | medium |

**Size multipliers**: > 20 MB bumps complexity one level. > 50 MB sets `very_high`. > 100 MB rejects the file.

### Backend Tika Service Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| **Base timeout** | 30 seconds | Starting timeout for all files |
| **Timeout per 100KB** | 1.0 second | Additional timeout per 100KB of file |
| **OCR multiplier** | 3.0x | Timeout multiplier for OCR-capable formats (PDF, images) |
| **Office multiplier** | 1.5x | Timeout multiplier for Office formats (DOCX, XLSX, PPTX) |
| **Max timeout** | 600 seconds (10 min) | Absolute maximum timeout |
| **Min timeout** | 30 seconds | Absolute minimum timeout |
| **Max file size** | 100 MB | Maximum accepted file size |
| **OCR enabled** | Yes | Whether OCR processing is available |
| **Max retries** | 3 | Number of retry attempts on failure |
| **Retry backoff base** | 2.0 seconds | Exponential backoff base between retries |
| **Retry backoff max** | 30 seconds | Maximum backoff between retries |

**Adaptive Timeout Formula**:
```
timeout = base_timeout + (file_size_kb / 100) * timeout_per_100kb
if OCR type: timeout *= ocr_multiplier (3.0x)
if Office type: timeout *= 1.5x
clamp(min_timeout, timeout, max_timeout)
```

**Retry Behavior**:
- Attempt 1: Normal parse (with OCR if applicable)
- Attempt 2 (on timeout): Retry without OCR (text-only fallback), or with increased timeout (1.5x)
- Attempt 3: Final attempt with further increased timeout
- After all failures: Detailed error message with suggestions

### Comparison: File Upload vs Web URL vs Text Input

| Aspect | File Upload | Web URL | Text Input |
|--------|------------|---------|------------|
| **Source** | Local files on your computer | Public web pages | Content you type/paste |
| **Supported formats** | 14 file types | Any accessible URL | Plain text, Markdown, Structured |
| **Processing** | Apache Tika (local Docker) | Crawl4AI / Jina Reader | Direct (no parsing) |
| **Preview** | Parsed pages with editing | Scraped pages with editing | Live preview (200 chars) |
| **Max content** | 100 MB per file, 20 files | 1,000 pages, depth 10 | No limit (10+ words min) |
| **OCR support** | Yes (PDF, images) | N/A | N/A |
| **Editing** | Edit parsed pages | Edit scraped pages | Edit before adding |
| **Best for** | Existing documents, PDFs, spreadsheets | Documentation sites, blogs | Quick FAQ entries, policies, short content |
| **Speed** | Depends on file complexity | 6-15s for single page | Instant |
| **Privacy** | Files parsed locally (Tika in Docker) | Crawled via server-side scraper | Direct input (no external calls) |

### Strategy Comparison Matrix

| Strategy | Speed | Quality | Structured Docs | Unstructured Text | Mixed Content | Code | Multilingual |
|----------|-------|---------|----------------|-------------------|---------------|------|-------------|
| No Chunking | Best | Low | Low | Low | Low | Low | Best |
| By Sentence | Fast | Good | Low | Very Good | Good | Poor | Fast |
| By Paragraph | Fast | Good | Good | Best | Good | Low | Fast |
| By Heading | Fast | Very Good | Best | Low | Good | Good | Fast |
| Semantic | Slow | Best | Very Good | Best | Best | Low | Good |
| Adaptive | Medium | Very Good | Very Good | Very Good | Best | Good | Fast |
| Hybrid | Medium | Best | Best | Very Good | Best | Good | Fast |
| Custom | Fast | Good | Good | Good | Low | Best | Fast |
| Recursive | Best | Good | Good | Very Good | Very Good | Good | Best |

### Text Input Templates Reference

| Template | Best For | Structure |
|----------|---------|-----------|
| **FAQ** | Customer support, common questions | Q&A pairs separated by blank lines |
| **Procedure** | How-to guides, processes | Title + numbered steps |
| **Policy** | Company rules, guidelines | Overview + Guidelines list + Exceptions |
| **Knowledge Article** | General documentation | Title + Summary + Details + Related Topics |

---

*Last updated: February 2026*
*Source verified against: KBFileUploadForm.tsx, KBTextInput.tsx, SourceSelector.tsx, KBSourceList.tsx, KBContentApproval.tsx, KBChunkingConfig.tsx, KBCreationWizard.tsx, kb-store.ts, knowledge-base.ts, pipeline-monitor.tsx, detail.tsx, KBTestSearch.tsx, tika_service.py, chunking_service.py, embedding_service_local.py, qdrant_service.py*
