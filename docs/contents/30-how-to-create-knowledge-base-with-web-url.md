# How to Create a Knowledge Base with Web URLs in PrivexBot

## A Complete Step-by-Step Guide for Beginners

---

## Before You Begin

### What is a Knowledge Base?

A Knowledge Base (KB) is a collection of information that your AI chatbot uses to answer questions. Think of it as your chatbot's brain—the more relevant information you put in, the smarter and more helpful your chatbot becomes.

When someone asks your chatbot a question, it searches through the Knowledge Base to find relevant information, then uses that information to craft an accurate answer.

### What Happens When You Create a Knowledge Base?

Creating a Knowledge Base in PrivexBot involves three phases:

```
Phase 1: DRAFT MODE
You configure everything. Nothing is saved permanently yet.
Your settings are stored temporarily in Redis (24-hour expiry).
You can preview, edit, and perfect before committing.

        ↓

Phase 2: FINALIZATION
You click "Create Knowledge Base."
Your configuration is saved permanently to the database.
A background job is queued to process your content.

        ↓

Phase 3: PROCESSING
The system works in the background:
- Extracts content from your web pages
- Splits content into searchable chunks
- Converts text into mathematical vectors
- Stores vectors in a searchable database

        ↓

READY!
Your Knowledge Base is ready for your chatbot to use.
```

This "Draft-First" approach means you can experiment freely without polluting your database with incomplete Knowledge Bases.

### What You'll Need

Before starting, make sure you have:

1. **A PrivexBot account** - You should be logged in
2. **A workspace** - You'll create the KB inside a workspace
3. **Web URLs** - The website pages you want your chatbot to learn from

---

## The Complete Journey: From Login to Ready KB

### Step 1: Navigate to Knowledge Bases

After logging in, you'll land on your dashboard.

**How to get there:**

1. Look at the left sidebar navigation
2. Find and click **"Knowledge Bases"**
3. You'll see the Knowledge Bases list page

**What You'll See on the KB List Page:**

```
┌─────────────────────────────────────────────────────────────┐
│  Knowledge Bases                    [+ Create Knowledge Base]│
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Stats Bar:                                                  │
│  ┌──────────┬──────────┬──────────┬──────────┐             │
│  │ Total KBs│ Documents│  Chunks  │Success % │             │
│  │    5     │    47    │   1,234  │   95%    │             │
│  └──────────┴──────────┴──────────┴──────────┘             │
│                                                              │
│  Filters: [All Statuses ▼] [All Contexts ▼] [🔍 Search...] │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 📚 Product Documentation                              │  │
│  │ Status: Ready ● | Docs: 12 | Chunks: 456             │  │
│  │ Context: Both | Created: Jan 5, 2025                  │  │
│  │ [View] [Docs] [Test] [⋮]                             │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 📚 FAQ Database                                       │  │
│  │ Status: Processing ● | Docs: 3 | Chunks: --          │  │
│  │ Context: Chatbot | Created: Jan 8, 2025               │  │
│  │ [View] [⋮]                                           │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Status Colors:**
- **Green (Ready)**: KB is fully processed and usable
- **Blue (Processing)**: KB is being processed in the background
- **Red (Failed)**: Something went wrong (you can retry)

---

### Step 2: Start Creating a New Knowledge Base

**Click the "Create Knowledge Base" button** in the top-right corner.

You'll be taken to a new page with a **7-step wizard**. The steps are:

```
Step 1: Basic Info       → Name and describe your KB
Step 2: Content Sources  → Add web URLs
Step 3: Content Approval → Review and approve extracted content
Step 4: Chunking         → Configure how content is split
Step 5: Model & Store    → Select AI models and storage settings
Step 6: Retrieval        → Configure how search works
Step 7: Finalize         → Review and create
```

You'll see a progress stepper at the top showing which step you're on.

---

### Step 3: Basic Information (Wizard Step 1 of 7)

This is where you give your Knowledge Base a name and basic settings.

**What You'll See:**

```
┌─────────────────────────────────────────────────────────────┐
│  Step 1: Basic Information                                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Name *                                                      │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Product Documentation                                │   │
│  └─────────────────────────────────────────────────────┘   │
│  Give your knowledge base a clear, descriptive name         │
│                                                              │
│  Workspace                                                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ My Workspace (read-only)                            │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  Description                                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Contains all product documentation from our help     │   │
│  │ center website.                                      │   │
│  └─────────────────────────────────────────────────────┘   │
│  Optional: Add notes about what this KB contains            │
│                                                              │
│  Context *                                                   │
│  ○ Both Contexts (Recommended)                              │
│  ○ Chatbot Only                                             │
│  ○ Chatflow Only                                            │
│                                                              │
│                                    [Continue to Sources →]  │
└─────────────────────────────────────────────────────────────┘
```

**Fill in the fields:**

| Field | Required? | What to Enter | Example |
|-------|-----------|---------------|---------|
| **Name** | Yes | A clear name to identify this KB (3-100 characters) | "Product Documentation" |
| **Workspace** | Auto-filled | Shows your current workspace | "My Workspace" |
| **Description** | No | Notes about what this KB contains | "Help center articles and FAQs" |
| **Context** | Yes | Where this KB can be used | Usually "Both Contexts" |

**Understanding Context:**

- **Both Contexts**: This KB can be used by both simple chatbots AND advanced chatflows
- **Chatbot Only**: Only simple chatbots can use this KB
- **Chatflow Only**: Only visual chatflows can use this KB

**Recommendation:** Choose "Both Contexts" unless you have a specific reason to restrict access.

**What Happens Behind the Scenes:**

At this point, nothing is saved to the database yet. Your form data is stored in your browser's memory. The system validates that:
- Name is between 3-100 characters
- Context is selected

**Click "Continue to Sources"** when ready.

---

### Step 4: Add Web Sources (Wizard Step 2 of 7)

This is where you tell PrivexBot which web pages to learn from.

**What You'll See:**

```
┌─────────────────────────────────────────────────────────────┐
│  Step 2: Content Sources                                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Select Source Type:                                         │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐              │
│  │   🌐       │ │   📄       │ │   🔗       │              │
│  │  Website   │ │   Files    │ │ Integration│              │
│  │            │ │            │ │  (Soon)    │              │
│  └────────────┘ └────────────┘ └────────────┘              │
│                                                              │
│  [Website source form appears below when selected]          │
│                                                              │
│  Added Sources: (0)                                          │
│  No sources added yet. Add your first source above.         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Click on "Website"** to add web URLs.

**The Web Source Form Expands:**

```
┌─────────────────────────────────────────────────────────────┐
│  🌐 Add Website Source                                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  URL *                                                       │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ https://docs.example.com                            │   │
│  └─────────────────────────────────────────────────────┘   │
│  [Single URL] [Bulk URLs]                                   │
│                                                              │
│  Crawl Method                                                │
│  ○ Single Page - Just fetch this one URL                    │
│  ● Crawl Website - Follow links and get multiple pages      │
│                                                              │
│  ┌── Crawl Settings (when Crawl Website is selected) ──┐   │
│  │                                                       │   │
│  │  Max Pages: [50        ] (1-100)                     │   │
│  │  Maximum number of pages to crawl                     │   │
│  │                                                       │   │
│  │  Max Depth: [3         ] (1-10)                      │   │
│  │  How many link levels to follow                       │   │
│  │                                                       │   │
│  │  [▼ Advanced Options]                                │   │
│  │                                                       │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                              │
│                                      [Preview Content]      │
└─────────────────────────────────────────────────────────────┘
```

**Understanding the Settings:**

| Setting | What It Does | Recommendation |
|---------|--------------|----------------|
| **Single Page** | Fetches only the exact URL you enter | Use for specific pages |
| **Crawl Website** | Starts at URL and follows links to find more pages | Use for entire docs sites |
| **Max Pages** | Stops crawling after this many pages | 50 is good for most sites |
| **Max Depth** | How many "clicks" deep to follow | 3 covers most documentation |

**Example Scenarios:**

**Scenario 1: Single FAQ page**
```
URL: https://example.com/faq
Method: Single Page
```

**Scenario 2: Entire documentation site**
```
URL: https://docs.example.com
Method: Crawl Website
Max Pages: 50
Max Depth: 3
```

**Advanced Options (Click to Expand):**

```
┌── Advanced Options ────────────────────────────────────────┐
│                                                             │
│  Include Patterns (Optional)                                │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ /docs/**, /help/**                                  │  │
│  └─────────────────────────────────────────────────────┘  │
│  Only crawl URLs matching these patterns                   │
│                                                             │
│  Exclude Patterns (Optional)                                │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ /admin/**, /login/**                                │  │
│  └─────────────────────────────────────────────────────┘  │
│  Skip URLs matching these patterns                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Pattern Examples:**

| Pattern | What It Matches |
|---------|-----------------|
| `/docs/**` | Any URL containing /docs/ |
| `/help/**` | Any URL containing /help/ |
| `/blog/**` | Any URL containing /blog/ |
| `*.pdf` | Any PDF files |

**Enter your URL and configure settings, then click "Preview Content".**

**What Happens Behind the Scenes When You Click Preview:**

1. **Draft Created**: A temporary draft is created in Redis (expires in 24 hours)
   - API Call: `POST /api/v1/kb-drafts`

2. **Source Added**: Your URL configuration is added to the draft
   - API Call: `POST /api/v1/kb-drafts/{draft_id}/sources/web`

3. **Content Extracted**: The Crawl4AI service visits your URL(s) and extracts content
   - For "Crawl Website": It follows links up to your Max Pages/Max Depth limits
   - HTML is converted to clean markdown text

4. **Preview Generated**: You see the extracted pages in a preview modal

**How Your Choices Affect Performance:**

| Choice | Impact |
|--------|--------|
| More pages | More comprehensive answers, longer processing time |
| Higher depth | Finds more linked content, may include irrelevant pages |
| Include patterns | Focuses on relevant content only |
| Exclude patterns | Avoids irrelevant or private pages |

---

### Step 5: Review Preview and Approve Source

After clicking "Preview Content," you'll see a modal showing what was extracted.

**What You'll See:**

```
┌─────────────────────────────────────────────────────────────┐
│  Preview: https://docs.example.com                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Summary:                                                    │
│  Pages Found: 12    Words: 15,234    Characters: 89,456     │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│  Pages Extracted:                                            │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │ 📄 Getting Started                                  │    │
│  │    URL: /docs/getting-started                       │    │
│  │    Words: 1,234 | Characters: 7,890                 │    │
│  │    [Preview Content ▼]                              │    │
│  │    ────────────────────────────────────────────     │    │
│  │    # Getting Started                                │    │
│  │    Welcome to our documentation. This guide will    │    │
│  │    help you get started with our platform...        │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │ 📄 Installation Guide                               │    │
│  │    URL: /docs/installation                          │    │
│  │    Words: 2,456 | Characters: 14,567                │    │
│  │    [Preview Content ▼]                              │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  ... more pages ...                                          │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                    [Reject Preview]  [Approve Preview]      │
└─────────────────────────────────────────────────────────────┘
```

**Review the extracted content:**

- **Check page titles** - Do these look like the pages you wanted?
- **Check word counts** - Is there enough content?
- **Preview content** - Does the extracted text look correct?

**Click "Approve Preview"** if the content looks good.

**What Happens When You Approve:**

1. The source is added to your main draft
2. All preview pages are stored in the source metadata
3. The draft is updated in Redis with the new source

**The source now appears in your source list:**

```
┌─────────────────────────────────────────────────────────────┐
│  Added Sources: (1)                                          │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │ 🌐 https://docs.example.com                        │    │
│  │    Crawl • 12 pages • 15,234 words                 │    │
│  │    Status: ● Completed                              │    │
│  │    [Preview] [Delete]                              │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

### Step 6: Add More Sources (Optional)

You can add multiple web sources to a single Knowledge Base.

**To add another source:**
1. Click on "Website" again
2. Enter a different URL
3. Configure settings
4. Preview and approve

**Example of multiple sources:**
```
Added Sources: (3)

🌐 https://docs.example.com (Crawl • 12 pages)
🌐 https://blog.example.com/tutorials (Crawl • 8 pages)
🌐 https://example.com/faq (Single Page • 1 page)
```

**Click "Continue to Approval"** when you've added all your sources.

---

### Step 7: Content Approval (Wizard Step 3 of 7)

This step shows ALL pages from ALL sources, letting you review and approve what goes into your Knowledge Base.

**Why This Step Matters:**

Not all extracted content is useful. Some pages might be:
- Navigation pages with little content
- Duplicate content
- Outdated information
- Irrelevant to your chatbot's purpose

This step lets you curate exactly what your chatbot learns.

**What You'll See:**

```
┌─────────────────────────────────────────────────────────────┐
│  Step 3: Content Approval                                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Stats:                                                      │
│  Total Pages: 21 | Selected: 21 | Edited: 0 | Words: 24,567 │
│                                                              │
│  [Select All] [Deselect All]            [Approve Selected]  │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ☑ 📄 Getting Started                                       │
│     Source: docs.example.com | Words: 1,234                  │
│     Status: ○ Not Approved                                   │
│     [Edit] [Preview]                                         │
│                                                              │
│  ☑ 📄 Installation Guide                                    │
│     Source: docs.example.com | Words: 2,456                  │
│     Status: ○ Not Approved                                   │
│     [Edit] [Preview]                                         │
│                                                              │
│  ☐ 📄 Site Navigation (unchecked - will be excluded)        │
│     Source: docs.example.com | Words: 45                     │
│     Status: ○ Not Approved                                   │
│     [Edit] [Preview]                                         │
│                                                              │
│  ... more pages ...                                          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**What Each Element Means:**

| Element | Meaning |
|---------|---------|
| ☑ Checkbox | Selected for approval (will be included in KB) |
| ☐ Checkbox | Not selected (will be excluded from KB) |
| Words count | How much content is in this page |
| Source | Which website this page came from |
| Edit button | Modify the extracted content if needed |
| Preview button | View the full content |

**Editing Content (Optional but Powerful):**

If you click "Edit" on any page, you can modify the content:

```
┌─────────────────────────────────────────────────────────────┐
│  Edit: Getting Started                                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ # Getting Started                                    │   │
│  │                                                       │   │
│  │ Welcome to our documentation. This guide will help   │   │
│  │ you get started with our platform quickly.           │   │
│  │                                                       │   │
│  │ ## Prerequisites                                      │   │
│  │                                                       │   │
│  │ Before you begin, make sure you have:                 │   │
│  │ - A registered account                                │   │
│  │ - Node.js version 16 or higher                        │   │
│  │ ...                                                   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│                               [Cancel]  [Save Changes]      │
└─────────────────────────────────────────────────────────────┘
```

**When to Edit Content:**

- Remove outdated information
- Fix extraction errors
- Add clarifying context
- Remove irrelevant sections
- Correct formatting issues

**Select the pages you want to include, then click "Approve Selected".**

**What Happens Behind the Scenes:**

1. API Call: `POST /api/v1/kb-drafts/{draft_id}/approve-sources`
2. For each source:
   - Approved page indices are stored
   - Any edited content is stored with `is_edited: true`
3. Only approved pages will be processed into the final Knowledge Base

**Click "Continue to Chunking"** when done.

---

### Step 8: Chunking Configuration (Wizard Step 4 of 7)

**This is one of the most important steps.** Chunking determines how your content is split into searchable pieces.

**Why Chunking Matters:**

When someone asks your chatbot a question:
1. The question is compared against all chunks
2. The most relevant chunks are retrieved
3. Those chunks are sent to the AI to generate an answer

If chunks are too big: You get too much irrelevant context.
If chunks are too small: You might miss important context.
The right chunking strategy gives your chatbot the best information to answer questions.

**What You'll See:**

```
┌─────────────────────────────────────────────────────────────┐
│  Step 4: Chunking Configuration                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Choose a Preset:                                            │
│                                                              │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │   🎯        │ │   ⚖️        │ │   📚        │           │
│  │  Precise    │ │  Balanced   │ │ Contextual  │           │
│  │             │ │ ★ Selected  │ │             │           │
│  │  256 chars  │ │  512 chars  │ │ 1024 chars  │           │
│  │  50 overlap │ │ 100 overlap │ │ 200 overlap │           │
│  └─────────────┘ └─────────────┘ └─────────────┘           │
│                                                              │
│  Or choose a custom strategy:                                │
│                                                              │
│  Strategy: [By Heading ▼]                                   │
│                                                              │
│  Chunk Size:                                                 │
│  100 ├────────●────────────────────────────────┤ 4000      │
│                512                                           │
│  Target size for each chunk in characters                    │
│                                                              │
│  Chunk Overlap:                                              │
│  0   ├──────●───────────────────────────────────┤ 500       │
│              100                                             │
│  Characters shared between adjacent chunks                   │
│                                                              │
│  [▼ Advanced Options]                                       │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Estimated Results:                                  │   │
│  │  ~48 chunks from 24,567 characters                   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Understanding the Presets:**

| Preset | Chunk Size | Overlap | Best For |
|--------|-----------|---------|----------|
| **Precise** 🎯 | 256 chars | 50 | FAQ-style content, when you need exact answers |
| **Balanced** ⚖️ | 512 chars | 100 | Most documentation - **RECOMMENDED** |
| **Contextual** 📚 | 1024 chars | 200 | Complex topics needing detailed explanations |

**Understanding Chunking Strategies:**

| Strategy | How It Splits | Best For |
|----------|--------------|----------|
| **No Chunking** | Keeps documents whole | Very short documents, <500 words each |
| **By Heading** | Splits at headers (# ## ###) | Structured documentation with clear sections |
| **By Paragraph** | Splits at blank lines | Blog posts, articles with natural paragraphs |
| **By Sentence** | Splits at sentence boundaries | When you need very precise answers |
| **Semantic** | AI detects topic changes | Mixed content, conversations |
| **Adaptive** | Auto-selects best method | When you're unsure what to use |

**Understanding the Parameters:**

**Chunk Size (100-4000 characters):**

```
Smaller Chunks (256 chars)          Larger Chunks (1024 chars)
├─────────────────────┤             ├─────────────────────────────────────┤
│ More chunks created │             │ Fewer chunks created                │
│ Higher precision    │             │ More context per chunk              │
│ May miss context    │             │ May include irrelevant info         │
│ Faster search       │             │ Richer answers                      │
└─────────────────────┘             └─────────────────────────────────────┘
```

**Chunk Overlap:**

Overlap prevents losing information at chunk boundaries.

```
Without Overlap:
┌─────────┐ ┌─────────┐
│ Chunk 1 │ │ Chunk 2 │
└─────────┘ └─────────┘
         ↑
    Information here might be cut off

With Overlap:
┌───────────────┐
│    Chunk 1    │
└──────────┬────┘
     ┌─────┴────────┐
     │    Chunk 2   │
     └──────────────┘
         ↑
    Shared content ensures context is preserved
```

**Recommendation:** Set overlap to 20-30% of chunk size (e.g., 100 overlap for 512 chunk size).

**Advanced Options:**

```
┌── Advanced Options ────────────────────────────────────────┐
│                                                             │
│  ☑ Preserve Code Blocks                                    │
│     Keep code blocks intact during chunking                 │
│                                                             │
│  ☐ Enable Enhanced Metadata                                │
│     Adds extra context (previous/next chunk, headings)     │
│     Improves retrieval but increases processing time        │
│                                                             │
│  Semantic Threshold: 0.65 (for Semantic strategy)          │
│  Higher = more, smaller chunks | Lower = fewer, larger     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**What Happens Behind the Scenes:**

- Your configuration is saved to the draft in Redis
- API Call: `POST /api/v1/kb-drafts/{draft_id}/chunking`
- No actual processing yet—just storing your preferences

**How Chunking Affects Your Chatbot:**

| Scenario | Recommended Settings |
|----------|---------------------|
| FAQ bot (short, specific answers) | Precise preset, 256 chars |
| Documentation bot (general help) | Balanced preset, 512 chars |
| Technical support (detailed answers) | Contextual preset, 1024 chars |
| Mixed content (various types) | Adaptive strategy |

**Click "Continue to Model & Store"** when configured.

---

### Step 9: Model & Vector Store (Wizard Step 5 of 7)

This step configures how your text is converted into searchable vectors.

**What Are Vectors?**

Vectors are lists of numbers that represent the meaning of text. Similar text produces similar vectors, which is how your chatbot finds relevant content.

```
"How do I reset my password?"
    ↓
[0.234, -0.567, 0.891, ..., 0.123]  ← 384 numbers

"I forgot my login credentials"
    ↓
[0.245, -0.554, 0.887, ..., 0.134]  ← Similar numbers!

"What's the weather today?"
    ↓
[0.876, 0.123, -0.456, ..., 0.789]  ← Very different numbers
```

**What You'll See:**

```
┌─────────────────────────────────────────────────────────────┐
│  Step 5: Model & Vector Store                                │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Embedding Model                                             │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ Model: [all-MiniLM-L6-v2 ▼]                           │ │
│  │                                                        │ │
│  │ Dimensions: 384                                        │ │
│  │ Speed: Fast                                            │ │
│  │ Quality: Good                                          │ │
│  │ Best for: General purpose, most use cases              │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                              │
│  Vector Store                                                │
│                                                              │
│  Provider: Qdrant (default)                                  │
│                                                              │
│  Distance Metric: [Cosine ▼]                                │
│  How similarity between vectors is calculated                │
│                                                              │
│  [▼ Advanced Settings]                                      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Understanding Embedding Models:**

| Model | Dimensions | Speed | Quality | When to Use |
|-------|-----------|-------|---------|-------------|
| **all-MiniLM-L6-v2** | 384 | Fast ⚡ | Good | **RECOMMENDED** - Best balance |
| **all-MiniLM-L12-v2** | 384 | Medium ⚡⚡ | Better | When you need slightly better quality |
| **all-mpnet-base-v2** | 768 | Slow 🐢 | Best 🏆 | Accuracy-critical applications |

**Recommendation:** Stick with the default `all-MiniLM-L6-v2` unless you have specific accuracy requirements.

**Understanding Distance Metrics:**

| Metric | What It Measures | When to Use |
|--------|-----------------|-------------|
| **Cosine** | Angle between vectors | **RECOMMENDED** - Best for text |
| **Euclidean** | Straight-line distance | Mathematical applications |
| **Dot Product** | Raw similarity score | When speed is critical |

**Advanced Settings (Usually Keep Defaults):**

```
┌── Advanced Settings ───────────────────────────────────────┐
│                                                             │
│  HNSW M Parameter: [16]                                    │
│  Connections per node (higher = better search, more memory)│
│                                                             │
│  ef_construct: [100]                                       │
│  Build-time accuracy (higher = better index, slower build) │
│                                                             │
│  Batch Size: [32]                                          │
│  How many texts to process at once                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Important Note:** You cannot change the embedding model after processing. If you need a different model later, you'll have to reindex the entire Knowledge Base.

**What Happens Behind the Scenes:**

- Configuration saved to draft
- API Call: `POST /api/v1/kb-drafts/{draft_id}/model-config`
- Model will be used during Phase 3 processing

**Click "Continue to Retrieval"** when configured.

---

### Step 10: Retrieval Configuration (Wizard Step 6 of 7)

This step configures how your chatbot searches the Knowledge Base when answering questions.

**What You'll See:**

```
┌─────────────────────────────────────────────────────────────┐
│  Step 6: Retrieval Configuration                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Search Strategy                                             │
│                                                              │
│  ○ Semantic Search                                          │
│    Finds content by meaning and context                     │
│                                                              │
│  ○ Keyword Search                                           │
│    Finds content by exact word matches                      │
│                                                              │
│  ● Hybrid Search (Recommended)                              │
│    Combines semantic and keyword for best results           │
│                                                              │
│  ─────────────────────────────────────────────────────────  │
│                                                              │
│  Top K (Max Results)                                         │
│  1  ├────────────●─────────────────────────────────┤ 50     │
│                  10                                          │
│  How many chunks to retrieve per question                    │
│                                                              │
│  Score Threshold                                             │
│  0.0 ├─────────────────●───────────────────────────┤ 1.0    │
│                        0.7                                   │
│  Minimum relevance score to include a result                 │
│                                                              │
│  ☐ Enable Reranking                                         │
│    Re-rank results for better relevance (adds latency)      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Understanding Search Strategies:**

| Strategy | How It Works | Best For |
|----------|--------------|----------|
| **Semantic Search** | Understands meaning, finds conceptually similar content | Natural language questions |
| **Keyword Search** | Matches exact words and phrases | Technical terms, product names |
| **Hybrid Search** | Uses both semantic + keyword | **RECOMMENDED** - Best of both |

**Example:**

```
Question: "How do I change my password?"

Semantic Search finds:
- "Updating your login credentials" (same meaning)
- "Password reset instructions" (related concept)

Keyword Search finds:
- "To change your password, click..." (exact words)

Hybrid Search finds:
- All of the above (best coverage)
```

**Understanding Top K:**

```
Top K = 5:  Retrieves 5 most relevant chunks
Top K = 10: Retrieves 10 most relevant chunks
Top K = 20: Retrieves 20 most relevant chunks

More chunks = More context but slower, may include noise
Fewer chunks = Faster but might miss relevant info
```

**Recommended Top K values:**

| Use Case | Top K | Why |
|----------|-------|-----|
| Quick FAQ bot | 3-5 | Fast, focused answers |
| General documentation | 5-10 | **RECOMMENDED** - Good balance |
| Complex technical support | 10-15 | Comprehensive coverage |

**Understanding Score Threshold:**

The threshold filters out low-relevance results.

```
Score Threshold = 0.5
├── Chunk A (score: 0.85) ✅ Included
├── Chunk B (score: 0.72) ✅ Included
├── Chunk C (score: 0.48) ❌ Excluded (below threshold)
└── Chunk D (score: 0.31) ❌ Excluded (below threshold)
```

**Recommended thresholds:**

| Threshold | Effect | When to Use |
|-----------|--------|-------------|
| 0.5 | Includes more results, some noise | When coverage is important |
| 0.7 | Balanced, only confident matches | **RECOMMENDED** |
| 0.9 | Very strict, may miss some relevant content | When precision is critical |

**What Happens Behind the Scenes:**

- Configuration saved to draft
- API Call: `POST /api/v1/kb-drafts/{draft_id}/retrieval-config`
- These settings apply every time your chatbot queries the KB

**Click "Continue to Finalize"** when configured.

---

### Step 11: Review and Finalize (Wizard Step 7 of 7)

This is the final step before creating your Knowledge Base.

**What You'll See:**

```
┌─────────────────────────────────────────────────────────────┐
│  Step 7: Review & Finalize                                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Configuration Summary                                       │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  📝 Basic Information                                │   │
│  │     Name: Product Documentation                      │   │
│  │     Context: Both Contexts                           │   │
│  │     Workspace: My Workspace                          │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  📚 Content                                          │   │
│  │     Sources: 3                                       │   │
│  │     Approved Pages: 21                               │   │
│  │     Total Words: ~24,567                             │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  ⚙️ Processing Configuration                         │   │
│  │     Chunking: By Heading (512 chars, 100 overlap)   │   │
│  │     Model: all-MiniLM-L6-v2 (384 dimensions)        │   │
│  │     Search: Hybrid (Top 10, threshold 0.7)          │   │
│  │     Estimated Chunks: ~48                            │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ⚠️ Once created, you cannot change the embedding model     │
│     without reindexing the entire Knowledge Base.           │
│                                                              │
│                        [← Back]  [Create Knowledge Base]    │
└─────────────────────────────────────────────────────────────┘
```

**Review your configuration carefully:**

- Is the name correct?
- Are all the sources you wanted included?
- Are the chunking settings appropriate for your content?
- Is the embedding model what you want?

**Click "Create Knowledge Base" when ready.**

**What Happens When You Click Create (Phase 2 - Finalization):**

This is the critical transition from temporary draft to permanent Knowledge Base:

```
Step 1: Validate Draft
├── Check all required fields
├── Verify sources have content
└── Ensure at least one approved page

Step 2: Create Database Records
├── Knowledge Base record in PostgreSQL
│   - Status: "processing"
│   - All configuration saved
├── Document records for each approved page
│   - Content stored
│   - Status: "pending"
└── API: POST /api/v1/kb-drafts/{draft_id}/finalize

Step 3: Initialize Pipeline
├── Create pipeline tracking in Redis
├── Pipeline ID: kb_{kb_id}_{timestamp}
└── Status: "queued"

Step 4: Queue Background Task
├── Celery task queued: process_web_kb_task
├── Queue: high_priority
└── Task begins processing in background

Step 5: Cleanup
├── Delete draft from Redis
└── Draft is no longer accessible

Step 6: Redirect User
└── Navigate to Pipeline Monitor page
```

**API Response:**
```json
{
  "kb_id": "uuid-of-your-new-kb",
  "pipeline_id": "kb_uuid_1234567890",
  "status": "processing",
  "message": "Knowledge base created and processing started"
}
```

---

### Step 12: Watch Processing (Pipeline Monitor)

After clicking "Create Knowledge Base," you're redirected to the Pipeline Monitor page.

**What You'll See:**

```
┌─────────────────────────────────────────────────────────────┐
│  Processing: Product Documentation                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Overall Progress                                            │
│  ████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░ 45%            │
│                                                              │
│  Current Stage: Generating Embeddings...                     │
│                                                              │
│  ─────────────────────────────────────────────────────────  │
│                                                              │
│  Stages:                                                     │
│                                                              │
│  ✅ Scraping          Complete                              │
│  ✅ Parsing           Complete                              │
│  ✅ Chunking          48 chunks created                     │
│  🔄 Embedding         Processing... (24/48)                 │
│  ⏳ Indexing          Waiting                               │
│                                                              │
│  ─────────────────────────────────────────────────────────  │
│                                                              │
│  Stats:                                                      │
│  Pages: 21    Chunks: 48    Embeddings: 24    Vectors: 0    │
│                                                              │
│  Estimated time remaining: ~2 minutes                        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Understanding the Processing Stages:**

| Stage | What Happens | Duration |
|-------|--------------|----------|
| **Scraping** | Fetches any remaining content (if needed) | 0-30 seconds |
| **Parsing** | Cleans and extracts text from content | 1-5 seconds per page |
| **Chunking** | Splits content using your configured strategy | 1-2 seconds total |
| **Embedding** | Converts chunks to vectors using the AI model | 1-10 seconds per 100 chunks |
| **Indexing** | Stores vectors in Qdrant for fast search | 1-5 seconds total |

**What Happens Behind the Scenes (Phase 3 - Background Processing):**

```
Celery Worker picks up the task
         ↓
Creates Qdrant collection for this KB
         ↓
For each approved page:
    ├── Load approved content (or edited content if modified)
    ├── Apply chunking strategy
    │   ├── By Heading: Split at # ## ### markers
    │   ├── By Paragraph: Split at blank lines
    │   └── etc.
    ├── Generate embeddings for each chunk
    │   └── Using all-MiniLM-L6-v2 (or selected model)
    ├── Store vectors in Qdrant
    └── Create Chunk records in PostgreSQL
         ↓
Update KB status to "ready"
         ↓
Update pipeline status to "completed"
```

**Frontend Polling:**

The page automatically polls for updates:
- API: `GET /api/v1/kb-pipeline/{pipeline_id}/status`
- Interval: Every 2-3 seconds
- Stops when status is "completed" or "failed"

**Processing Time Estimates:**

| KB Size | Pages | Estimated Time |
|---------|-------|----------------|
| Small | 1-10 | 1-3 minutes |
| Medium | 10-50 | 3-10 minutes |
| Large | 50-100 | 10-20 minutes |
| Very Large | 100+ | 20-45 minutes |

**If Processing Fails:**

If something goes wrong, you'll see:

```
┌─────────────────────────────────────────────────────────────┐
│  ❌ Processing Failed                                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Error: Failed to scrape URL: Connection timeout             │
│                                                              │
│  What you can do:                                            │
│  • Check if the source URLs are still accessible             │
│  • Verify your network connection                            │
│  • Try again with fewer pages                                │
│                                                              │
│                                            [Retry Processing]│
└─────────────────────────────────────────────────────────────┘
```

You can click "Retry Processing" to try again.

---

### Step 13: Knowledge Base Ready!

When processing completes, you'll see:

```
┌─────────────────────────────────────────────────────────────┐
│  ✅ Processing Complete!                                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Your Knowledge Base is ready to use.                        │
│                                                              │
│  Summary:                                                    │
│  ├── Documents: 21                                          │
│  ├── Chunks: 48                                             │
│  ├── Processing Time: 3 minutes 24 seconds                  │
│  └── Status: Ready                                          │
│                                                              │
│              [View Knowledge Base] [Test Search] [Go to List]│
└─────────────────────────────────────────────────────────────┘
```

**Your KB is now visible in the Knowledge Base list:**

```
┌──────────────────────────────────────────────────────────┐
│ 📚 Product Documentation                                  │
│ Status: Ready ● | Docs: 21 | Chunks: 48                  │
│ Context: Both | Created: Jan 10, 2025                     │
│ [View] [Docs] [Test] [⋮]                                 │
└──────────────────────────────────────────────────────────┘
```

**What You Can Do Now:**

| Action | What It Does |
|--------|--------------|
| **View** | See KB details and configuration |
| **Docs** | Browse individual documents and chunks |
| **Test** | Try search queries against your KB |
| **Edit Settings** | Modify retrieval settings (not chunking/model) |
| **Delete** | Remove the KB entirely |

**To use this KB with a chatbot:**

1. Create or edit a chatbot
2. In the chatbot's "Knowledge Base" section, select your new KB
3. Your chatbot will now use this KB to answer questions

---

## Part 3: Understanding How Your Choices Affect Performance

### Chunking Strategy Quick Reference

| Your Content Type | Recommended Strategy | Chunk Size | Why |
|-------------------|---------------------|-----------|-----|
| **FAQs** (short Q&A pairs) | No Chunking or By Paragraph | 256-512 | Keep Q&A pairs together |
| **Documentation** (with headers) | By Heading | 512-1024 | Preserves section structure |
| **Blog posts** (flowing text) | By Paragraph | 512 | Natural reading flow |
| **Technical manuals** | By Heading + Preserve Code | 1024 | Keeps code examples intact |
| **Mixed content** | Adaptive | 512 | Auto-detects best approach |

### Configuration Combinations for Common Use Cases

**Use Case 1: Customer Support FAQ Bot**

```
Content: Short FAQ entries
Goal: Quick, precise answers

Chunking:
├── Strategy: No Chunking or By Paragraph
├── Chunk Size: 256
└── Overlap: 50

Model: all-MiniLM-L6-v2 (fast)

Retrieval:
├── Strategy: Hybrid
├── Top K: 5
└── Threshold: 0.7

Expected Results: Fast responses, precise answers
```

**Use Case 2: Product Documentation Bot**

```
Content: Structured documentation with sections
Goal: Helpful, comprehensive answers

Chunking:
├── Strategy: By Heading
├── Chunk Size: 512
└── Overlap: 100

Model: all-MiniLM-L6-v2 (balanced)

Retrieval:
├── Strategy: Hybrid
├── Top K: 10
└── Threshold: 0.6

Expected Results: Well-structured answers with good context
```

**Use Case 3: Technical Support Bot**

```
Content: Complex technical documentation
Goal: Detailed, accurate answers

Chunking:
├── Strategy: By Heading
├── Chunk Size: 1024
├── Overlap: 200
└── Preserve Code Blocks: Yes

Model: all-mpnet-base-v2 (high quality)

Retrieval:
├── Strategy: Hybrid
├── Top K: 15
├── Threshold: 0.5
└── Reranking: Yes

Expected Results: Comprehensive technical answers
```

### How Search Works When Someone Asks a Question

```
User asks: "How do I reset my password?"
                    ↓
Step 1: EMBEDDING
Question converted to vector:
[0.234, -0.567, 0.891, ..., 0.123]
                    ↓
Step 2: SEARCH (using your retrieval settings)
Qdrant finds most similar chunks:
├── Chunk A: "Password Reset Instructions" (score: 0.89)
├── Chunk B: "Account Security Settings" (score: 0.76)
├── Chunk C: "Login Troubleshooting" (score: 0.71)
├── Chunk D: "General Account Help" (score: 0.65)
└── Chunk E: "Contact Support" (score: 0.52) ← Below 0.7 threshold, excluded
                    ↓
Step 3: FILTER (using your threshold)
Only chunks scoring ≥ 0.7 included:
├── Chunk A: "Password Reset Instructions" ✅
├── Chunk B: "Account Security Settings" ✅
├── Chunk C: "Login Troubleshooting" ✅
└── Chunk D: "General Account Help" ❌ (below threshold)
                    ↓
Step 4: SEND TO AI
Top 3 chunks sent to AI with the question:
"Using this context, answer the user's question about
resetting their password..."
                    ↓
Step 5: AI RESPONDS
"To reset your password, follow these steps:
1. Click 'Forgot Password' on the login page
2. Enter your email address
3. Check your email for the reset link
4. Click the link and create a new password"
```

---

## Part 4: Troubleshooting Common Issues

### Issue 1: Processing Takes Too Long

**Symptoms:**
- Progress stuck at same percentage
- Estimated time keeps increasing

**Possible Causes & Solutions:**

| Cause | Solution |
|-------|----------|
| Too many pages | Reduce Max Pages in crawl settings |
| Large documents | Use smaller chunk size to process faster |
| Network issues | Check if source URLs are accessible |
| Server load | Wait or try again during off-peak hours |

### Issue 2: Chatbot Gives Poor Answers

**Symptoms:**
- Answers don't match the question
- Missing relevant information
- Too generic responses

**Possible Causes & Solutions:**

| Cause | Solution |
|-------|----------|
| Chunks too large | Reduce chunk size to 256-512 |
| Chunks too small | Increase chunk size to 512-1024 |
| Wrong strategy | Try By Heading for documentation |
| Threshold too high | Lower score threshold to 0.5-0.6 |
| Not enough chunks | Increase Top K to 10-15 |

### Issue 3: Missing Content in Answers

**Symptoms:**
- Chatbot says "I don't know"
- Important information not found

**Possible Causes & Solutions:**

| Cause | Solution |
|-------|----------|
| Pages not approved | Check content approval step |
| Content excluded by patterns | Review include/exclude patterns |
| Content not crawled | Increase Max Pages and Max Depth |
| Threshold too strict | Lower score threshold |

### Issue 4: Scraping Fails

**Symptoms:**
- Error during preview
- Processing fails at scraping stage

**Possible Causes & Solutions:**

| Cause | Solution |
|-------|----------|
| Website blocks bots | Try Single Page mode instead of Crawl |
| URL not accessible | Verify URL works in browser |
| Authentication required | Use a publicly accessible URL |
| SSL/certificate issues | Ensure URL uses valid HTTPS |

### Issue 5: Slow Query Response Time

**Symptoms:**
- Chatbot takes several seconds to respond
- Users complain about wait times

**Possible Causes & Solutions:**

| Cause | Solution |
|-------|----------|
| Too many chunks retrieved | Reduce Top K to 5 |
| Reranking enabled | Disable reranking |
| Large embedding model | Use all-MiniLM-L6-v2 (fastest) |
| Too many chunks total | Consider splitting into multiple KBs |

---

## Part 5: Next Steps After Creating Your KB

### Testing Your Knowledge Base

Before connecting to a chatbot, test your KB:

1. Go to Knowledge Bases list
2. Click "Test" on your KB
3. Enter sample questions
4. Review the retrieved chunks
5. Adjust settings if needed

**Good test questions to try:**
- Questions you expect users to ask
- Questions with exact words from your content
- Questions phrased differently but same meaning
- Edge cases and unusual phrasings

### Connecting to a Chatbot

1. Navigate to **Chatbots** in the sidebar
2. Create a new chatbot or edit existing
3. In the **Knowledge Base** section:
   - Click "Add Knowledge Base"
   - Select your newly created KB
4. Save the chatbot
5. Test via the chatbot preview

### Maintaining Your Knowledge Base

**When to update your KB:**
- Source content has changed
- Users report outdated information
- New content needs to be added

**How to update:**
- Add new sources through the KB management page
- Re-crawl existing sources to get updated content
- Delete and recreate if major changes needed

---

## Summary: The Complete Journey

```
┌─────────────────────────────────────────────────────────────┐
│                    KB CREATION JOURNEY                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. NAVIGATE                                                 │
│     └── Go to Knowledge Bases page                          │
│                                                              │
│  2. CREATE WIZARD                                            │
│     ├── Step 1: Name and describe your KB                   │
│     ├── Step 2: Add web URLs                                │
│     ├── Step 3: Approve extracted content                   │
│     ├── Step 4: Configure chunking                          │
│     ├── Step 5: Set embedding model                         │
│     ├── Step 6: Configure search settings                   │
│     └── Step 7: Review and create                           │
│                                                              │
│  3. PROCESSING                                               │
│     └── Watch progress: Scrape → Parse → Chunk → Embed      │
│                                                              │
│  4. READY                                                    │
│     └── KB appears in list with "Ready" status              │
│                                                              │
│  5. USE                                                      │
│     └── Connect KB to chatbot                               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Remember:**
- Draft mode lets you experiment safely
- Chunking is the most impactful setting for answer quality
- Hybrid search with balanced settings works for most use cases
- You can always adjust retrieval settings later
- Test your KB before deploying to users

Your Knowledge Base is the foundation of your chatbot's intelligence. Take time to configure it well, and your chatbot will provide much better answers to your users.

---

*Need help? Visit the PrivexBot documentation or contact support.*
