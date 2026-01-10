# How to Create a Knowledge Base with File Uploads in PrivexBot

## A Complete Step-by-Step Guide for Beginners

---

## Before You Begin

### What is a Knowledge Base?

A Knowledge Base (KB) is a collection of information that powers your AI chatbot. Think of it as your chatbot's library—the documents, guides, and resources your chatbot reads to answer questions accurately.

When someone asks your chatbot a question, it searches through the Knowledge Base, finds the most relevant information, and uses it to craft a helpful answer.

### Why Upload Files?

File uploads are perfect when you have:
- **Existing documentation** (PDFs, Word docs)
- **Spreadsheets** with product data or FAQs
- **Training materials** you want your chatbot to know
- **Internal guides** and procedures
- **Any content that already exists as files**

Unlike web URLs (which scrape live websites), file uploads give you **complete control** over exactly what content your chatbot learns.

### Supported File Types

PrivexBot supports **15+ file formats**:

| Category | Formats | Notes |
|----------|---------|-------|
| **Documents** | PDF, DOCX, DOC, RTF | Most common format |
| **Spreadsheets** | XLSX, XLS, CSV | Great for structured data |
| **Presentations** | PPTX, PPT | Slides converted to text |
| **Text Files** | TXT, MD, JSON, HTML | Fastest to process |
| **Rich Text** | EPUB, ODT, ODS, ODP | Open formats supported |

### File Size Limits

- **Maximum per file**: 100 MB
- **Maximum files per upload**: 20 files
- **Recommended**: Keep files under 20 MB for fastest processing

### What Happens When You Upload Files?

Your files go through a three-phase process:

```
Phase 1: UPLOAD & PARSE
Your file is uploaded and parsed by Apache Tika.
Text is extracted from PDFs, Word docs, etc.
Content is stored temporarily in Redis (24-hour expiry).

        ↓

Phase 2: FINALIZATION
You click "Create Knowledge Base."
Your configuration is saved to the database.
A background job is queued to process your content.

        ↓

Phase 3: PROCESSING
The system works in the background:
- Splits content into searchable chunks
- Converts text into mathematical vectors
- Stores vectors in a searchable database

        ↓

READY!
Your Knowledge Base is ready for your chatbot to use.
```

**Privacy Note**: All file parsing happens locally on PrivexBot's servers using Apache Tika. Your files are never sent to external services.

---

## The Complete Journey: From Login to Ready KB

### Step 1: Navigate to Knowledge Bases

After logging in, you'll land on your dashboard.

**How to get there:**

1. Look at the left sidebar navigation
2. Find and click **"Knowledge Bases"**
3. You'll see the Knowledge Bases list page

**What You'll See:**

```
┌─────────────────────────────────────────────────────────────┐
│  Knowledge Bases                    [+ Create Knowledge Base]│
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Stats Bar:                                                  │
│  ┌──────────┬──────────┬──────────┬──────────┐             │
│  │ Total KBs│ Documents│  Chunks  │Success % │             │
│  │    3     │    15    │   892    │   100%   │             │
│  └──────────┴──────────┴──────────┴──────────┘             │
│                                                              │
│  [All Statuses ▼] [All Contexts ▼] [🔍 Search...]          │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 📚 Product Manual                                     │  │
│  │ Status: Ready ● | Docs: 5 | Chunks: 234              │  │
│  │ Context: Both | Created: Jan 8, 2025                  │  │
│  │ [View] [Docs] [Test] [⋮]                             │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Status Colors:**
- **Green (Ready)**: KB is fully processed and usable
- **Blue (Processing)**: KB is being processed
- **Red (Failed)**: Something went wrong (you can retry)

---

### Step 2: Start Creating a New Knowledge Base

**Click the "Create Knowledge Base" button** in the top-right corner.

You'll enter a **7-step wizard**:

```
Step 1: Basic Info       → Name and describe your KB
Step 2: Content Sources  → Upload your files
Step 3: Content Approval → Review extracted content
Step 4: Chunking         → Configure how content is split
Step 5: Model & Store    → Select AI models
Step 6: Retrieval        → Configure search settings
Step 7: Finalize         → Review and create
```

---

### Step 3: Basic Information (Wizard Step 1 of 7)

This is where you name and describe your Knowledge Base.

**What You'll See:**

```
┌─────────────────────────────────────────────────────────────┐
│  Step 1: Basic Information                                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Name *                                                      │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Employee Handbook                                    │   │
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
│  │ Complete employee handbook including policies,       │   │
│  │ procedures, and benefits information.                │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  Context *                                                   │
│  ● Both Contexts (Recommended)                              │
│  ○ Chatbot Only                                             │
│  ○ Chatflow Only                                            │
│                                                              │
│                                    [Continue to Sources →]  │
└─────────────────────────────────────────────────────────────┘
```

**Fill in the fields:**

| Field | Required? | What to Enter | Example |
|-------|-----------|---------------|---------|
| **Name** | Yes | A clear name (3-100 characters) | "Employee Handbook" |
| **Workspace** | Auto-filled | Your current workspace | "My Workspace" |
| **Description** | No | Notes about the content | "HR policies and procedures" |
| **Context** | Yes | Where this KB can be used | Usually "Both Contexts" |

**Understanding Context:**

- **Both Contexts**: This KB works with simple chatbots AND advanced chatflows
- **Chatbot Only**: Only simple chatbots can use this KB
- **Chatflow Only**: Only visual chatflows can use this KB

**Recommendation:** Choose "Both Contexts" unless you have a specific reason to restrict it.

**Click "Continue to Sources"** when ready.

---

### Step 4: Upload Files (Wizard Step 2 of 7)

This is where you upload your documents.

**What You'll See:**

```
┌─────────────────────────────────────────────────────────────┐
│  Step 2: Content Sources                                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Select Source Type:                                         │
│                                                              │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐              │
│  │   🌐       │ │   📄       │ │   🔗       │              │
│  │  Website   │ │   Files    │ │Integration │              │
│  │            │ │ ★ Selected │ │  (Soon)    │              │
│  └────────────┘ └────────────┘ └────────────┘              │
│                                                              │
│  [File upload form appears below when selected]             │
│                                                              │
│  Added Sources: (0)                                          │
│  No sources added yet. Upload your first file above.        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Click on "Files"** to open the file upload form.

**The File Upload Form:**

```
┌─────────────────────────────────────────────────────────────┐
│  📄 Upload Files                                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                       │   │
│  │     ┌───────┐                                        │   │
│  │     │  📁   │   Drag & drop files here              │   │
│  │     └───────┘   or click to browse                  │   │
│  │                                                       │   │
│  │     Supports: PDF, DOCX, TXT, CSV, XLSX, PPTX, and  │   │
│  │     more (up to 100MB per file, max 20 files)       │   │
│  │                                                       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  Selected Files: (0)                                         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**To upload files:**

1. **Drag and drop** files directly onto the upload area, OR
2. **Click** the upload area to open a file browser

**After selecting files, you'll see:**

```
┌─────────────────────────────────────────────────────────────┐
│  📄 Upload Files                                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Selected Files: (3)                                         │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │ 📄 employee_handbook.pdf                            │    │
│  │    Size: 2.5 MB | Type: PDF                        │    │
│  │    Complexity: ● Medium                             │    │
│  │    Estimated time: ~15 seconds                      │    │
│  │                                           [Remove]  │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │ 📄 benefits_guide.docx                              │    │
│  │    Size: 1.2 MB | Type: Word Document              │    │
│  │    Complexity: ● Low                                │    │
│  │    Estimated time: ~8 seconds                       │    │
│  │                                           [Remove]  │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │ 📄 faq_database.csv                                 │    │
│  │    Size: 0.5 MB | Type: CSV Spreadsheet            │    │
│  │    Complexity: ● Low                                │    │
│  │    Estimated time: ~3 seconds                       │    │
│  │                                           [Remove]  │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  Total: 3 files (4.2 MB)                                    │
│  Estimated total time: ~26 seconds                          │
│                                                              │
│                                        [Upload 3 Files]     │
└─────────────────────────────────────────────────────────────┘
```

**Understanding Complexity Indicators:**

| Complexity | Color | Meaning | Examples |
|------------|-------|---------|----------|
| **Low** | Green | Fast processing (2-10 sec) | TXT, CSV, small DOCX |
| **Medium** | Yellow | Moderate processing (10-60 sec) | PDF, large DOCX |
| **High** | Orange | Longer processing (1-5 min) | Large PDF, scanned docs |
| **Very High** | Red | Extended processing (5-10 min) | Large scanned PDF, images |

**Why Processing Time Varies:**

| File Type | Processing Speed | Reason |
|-----------|------------------|--------|
| **TXT, CSV, MD** | Very Fast | Plain text, no conversion needed |
| **DOCX, XLSX** | Fast | Well-structured, easy to extract |
| **PDF (text)** | Medium | Needs text extraction |
| **PDF (scanned)** | Slow | Requires OCR (optical character recognition) |
| **Images** | Slow | Full OCR needed |

**Click "Upload 3 Files"** (or however many you selected).

---

### Step 5: Watch Files Being Processed

After clicking upload, you'll see real-time progress:

```
┌─────────────────────────────────────────────────────────────┐
│  📄 Upload Files                                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Uploading Files: (3)                                        │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │ 📄 employee_handbook.pdf                            │    │
│  │    ████████████████████████░░░░░░░░ 65%            │    │
│  │    Status: Parsing document (OCR may take a while)  │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │ 📄 benefits_guide.docx                        ✅    │    │
│  │    Status: Complete                                 │    │
│  │    Pages: 12 | Words: 4,567 | Time: 6.2s           │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │ 📄 faq_database.csv                           ✅    │    │
│  │    Status: Complete                                 │    │
│  │    Pages: 1 | Words: 2,345 | Time: 2.1s            │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**What Happens Behind the Scenes:**

```
1. FILE UPLOADED
   Your file is sent to the server
   ↓
2. DRAFT CREATED (if first file)
   A temporary draft is created in Redis
   API: POST /api/v1/kb-drafts
   ↓
3. FILE RECEIVED
   API: POST /api/v1/kb-drafts/{draft_id}/sources/file
   File stored temporarily for processing
   ↓
4. TIKA PARSING
   Apache Tika extracts text from your file:
   - PDFs: Extracts text layers, runs OCR if scanned
   - Word docs: Reads all text and formatting
   - Spreadsheets: Converts rows/columns to text
   - Text files: Reads directly
   ↓
5. CONTENT NORMALIZED
   - Removes excessive whitespace
   - Cleans up formatting
   - Splits into preview pages
   ↓
6. SOURCE CREATED
   File added to your draft with:
   - Extracted content
   - Page count
   - Word count
   - Preview pages for approval
   ↓
7. RESULT RETURNED
   You see success with stats
```

**When All Files Complete:**

```
┌─────────────────────────────────────────────────────────────┐
│  Added Sources: (3)                                          │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │ 📄 employee_handbook.pdf                      ✅    │    │
│  │    2.5 MB • 45 pages • 15,234 words                │    │
│  │    Parsed in 14.3 seconds                          │    │
│  │    [Preview] [Delete]                              │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │ 📄 benefits_guide.docx                        ✅    │    │
│  │    1.2 MB • 12 pages • 4,567 words                 │    │
│  │    Parsed in 6.2 seconds                           │    │
│  │    [Preview] [Delete]                              │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │ 📄 faq_database.csv                           ✅    │    │
│  │    0.5 MB • 1 page • 2,345 words                   │    │
│  │    Parsed in 2.1 seconds                           │    │
│  │    [Preview] [Delete]                              │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  Total: 58 pages • 22,146 words                             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

### Step 6: Preview Extracted Content (Optional but Recommended)

Before moving forward, you can preview what was extracted from each file.

**Click "Preview" on any file:**

```
┌─────────────────────────────────────────────────────────────┐
│  Preview: employee_handbook.pdf                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  File Information                                            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Filename:     employee_handbook.pdf                  │   │
│  │ Size:         2.5 MB                                 │   │
│  │ Type:         application/pdf                        │   │
│  │ Parsed:       Jan 10, 2025 at 2:34 PM               │   │
│  │ Parse time:   14.3 seconds                          │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  Content Statistics                                          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Pages:        45                                     │   │
│  │ Words:        15,234                                 │   │
│  │ Characters:   89,456                                 │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│  Extracted Pages:                                            │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │ Page 1 of 45                                        │    │
│  │ Words: 342 | Characters: 2,045                      │    │
│  │ ─────────────────────────────────────────────────── │    │
│  │ EMPLOYEE HANDBOOK                                    │    │
│  │                                                       │    │
│  │ Welcome to Our Company                               │    │
│  │                                                       │    │
│  │ This handbook is designed to provide you with       │    │
│  │ information about our company policies, procedures, │    │
│  │ and benefits. Please read it carefully and keep it  │    │
│  │ for future reference.                                │    │
│  │ ...                                                  │    │
│  │                                    [Edit] [Copy]    │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │ Page 2 of 45                                        │    │
│  │ Words: 456 | Characters: 2,734                      │    │
│  │ ─────────────────────────────────────────────────── │    │
│  │ TABLE OF CONTENTS                                   │    │
│  │                                                       │    │
│  │ 1. Company Overview .............. 3                │    │
│  │ 2. Employment Policies ........... 5                │    │
│  │ 3. Benefits ...................... 12               │    │
│  │ ...                                                  │    │
│  │                                    [Edit] [Copy]    │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  ... more pages ...                                          │
│                                                              │
│                                [Export] [Close]             │
└─────────────────────────────────────────────────────────────┘
```

**What to Look For:**

| Check | Why It Matters |
|-------|----------------|
| Text extracted correctly | Ensures your chatbot can read the content |
| Page count matches original | Confirms all pages were processed |
| No garbled text | OCR sometimes struggles with complex layouts |
| Important sections included | Key content should be visible |

**If Something Looks Wrong:**

- **Garbled text in PDFs**: The PDF might be image-based. OCR was used but may have errors.
- **Missing pages**: Very large files might timeout. Try splitting the file.
- **Strange formatting**: Some complex layouts don't convert perfectly. Consider editing.

---

### Step 7: Add More Files (Optional)

You can add more files by clicking "Files" again and uploading additional documents.

**Good practices:**
- Group related content together in one KB
- Keep file sizes manageable (under 20MB each)
- Upload all files before moving to the next step

**Click "Continue to Approval"** when you've uploaded all your files.

---

### Step 8: Content Approval (Wizard Step 3 of 7)

This step shows ALL pages from ALL files, letting you review and approve what goes into your Knowledge Base.

**Why This Step Matters:**

Not all extracted content is useful:
- Table of contents pages might not add value
- Headers/footers repeated on every page
- Legal disclaimers you don't need in the chatbot
- Garbled OCR text that should be excluded

This step lets you **curate exactly what your chatbot learns**.

**What You'll See:**

```
┌─────────────────────────────────────────────────────────────┐
│  Step 3: Content Approval                                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Stats:                                                      │
│  Total Pages: 58 | Selected: 58 | Edited: 0 | Words: 22,146 │
│                                                              │
│  [Select All] [Deselect All]            [Approve Selected]  │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ☑ 📄 Page 1 - EMPLOYEE HANDBOOK                            │
│     Source: employee_handbook.pdf | Words: 342               │
│     Status: ○ Not Approved                                   │
│     [Edit] [Preview]                                         │
│                                                              │
│  ☐ 📄 Page 2 - TABLE OF CONTENTS                            │
│     Source: employee_handbook.pdf | Words: 456               │
│     Status: ○ Not Approved                                   │
│     [Edit] [Preview]                                         │
│     ↑ Unchecked - will be excluded (not useful for chatbot) │
│                                                              │
│  ☑ 📄 Page 3 - COMPANY OVERVIEW                             │
│     Source: employee_handbook.pdf | Words: 523               │
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
| ☑ Checkbox | Selected for approval (will be included) |
| ☐ Checkbox | Not selected (will be excluded) |
| Words count | How much content is in this page |
| Source | Which file this page came from |
| Edit button | Modify the extracted content |
| Preview button | View the full page content |

**Editing Content (Fixing OCR Errors):**

If OCR made mistakes, you can fix them:

```
┌─────────────────────────────────────────────────────────────┐
│  Edit: Page 5 - VACATION POLICY                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Original content (from OCR):                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ VACAT1ON POL1CY                                      │   │
│  │                                                       │   │
│  │ All full-t1me employees are ent1tled to paid        │   │
│  │ vacat1on t1me based on length of serv1ce:          │   │
│  │ ...                                                   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ↓ Edit below (fix "1" → "i" errors) ↓                     │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ VACATION POLICY                                      │   │
│  │                                                       │   │
│  │ All full-time employees are entitled to paid        │   │
│  │ vacation time based on length of service:           │   │
│  │ ...                                                   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│                               [Cancel]  [Save Changes]      │
└─────────────────────────────────────────────────────────────┘
```

**When to Edit Content:**

| Situation | Action |
|-----------|--------|
| OCR errors (l → 1, O → 0) | Fix the text |
| Extra headers/footers | Remove them |
| Irrelevant sections | Delete or exclude |
| Missing context | Add clarifying text |
| Confusing formatting | Clean it up |

**Typical Pages to EXCLUDE (uncheck):**

- Table of contents
- Index pages
- Copyright notices
- Blank pages
- Page headers/footers only pages

**After Making Selections:**

**Click "Approve Selected"** to confirm your choices.

**What Happens Behind the Scenes:**

```
API: POST /api/v1/kb-drafts/{draft_id}/approve-sources

For each file source:
├── Approved page indices stored
├── Edited content saved (with is_edited: true flag)
└── Only approved pages will be processed later
```

**Click "Continue to Chunking"** when done.

---

### Step 9: Chunking Configuration (Wizard Step 4 of 7)

**This is critical for chatbot quality.** Chunking determines how your documents are split into searchable pieces.

**Why Chunking Matters for Files:**

When someone asks your chatbot a question:
1. The question is compared against all chunks
2. The most relevant chunks are retrieved
3. Those chunks are sent to the AI to generate an answer

**Good chunking** = Your chatbot finds the right information
**Bad chunking** = Your chatbot gives irrelevant or incomplete answers

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
│                                                              │
│  Chunk Overlap:                                              │
│  0   ├──────●───────────────────────────────────┤ 500       │
│              100                                             │
│                                                              │
│  [▼ Advanced Options]                                       │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Estimated Results:                                  │   │
│  │  ~156 chunks from 22,146 words                       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Understanding the Presets:**

| Preset | Chunk Size | Best For |
|--------|-----------|----------|
| **Precise** 🎯 | 256 chars | FAQ-style content, specific answers needed |
| **Balanced** ⚖️ | 512 chars | Most documents - **RECOMMENDED** |
| **Contextual** 📚 | 1024 chars | Complex topics needing detailed explanations |

**Chunking Strategies Explained:**

| Strategy | How It Works | Best For Your Files |
|----------|--------------|---------------------|
| **No Chunking** | Keep documents whole | Small files (<500 words each) |
| **By Heading** | Split at headers | Documents with clear sections (manuals, guides) |
| **By Paragraph** | Split at blank lines | Articles, essays, flowing text |
| **By Sentence** | Split at periods | When you need very precise answers |
| **Semantic** | AI finds topic changes | Mixed content, Q&A documents |
| **Adaptive** | Auto-detects best method | When unsure what to use |

**File-Specific Recommendations:**

| Your File Type | Recommended Strategy | Chunk Size |
|----------------|---------------------|-----------|
| **Employee Handbook** | By Heading | 512-1024 |
| **FAQ Document** | By Paragraph or Semantic | 256-512 |
| **Technical Manual** | By Heading | 1024 |
| **Policy Document** | By Heading | 512 |
| **CSV Data** | By Paragraph | 256-512 |
| **Product Catalog** | Semantic | 512 |

**Understanding Chunk Size:**

```
Smaller Chunks (256 chars)          Larger Chunks (1024 chars)
├─────────────────────┤             ├─────────────────────────────────────┤
│ More precise        │             │ More context                        │
│ May miss context    │             │ May include irrelevant info         │
│ More chunks = more  │             │ Fewer chunks = faster               │
│ thorough search     │             │ but less precise                    │
└─────────────────────┘             └─────────────────────────────────────┘
```

**Understanding Chunk Overlap:**

Overlap prevents losing information at chunk boundaries.

```
Without Overlap:
[Chunk 1: "The vacation policy states that..."]
[Chunk 2: "...employees receive 15 days per year."]
         ↑ Split in the middle of a sentence!

With Overlap (100 chars):
[Chunk 1: "The vacation policy states that employees..."]
[Chunk 2: "...states that employees receive 15 days per year."]
         ↑ Overlap ensures context is preserved
```

**Recommendation:** Set overlap to 20-30% of chunk size.

**Advanced Options:**

```
┌── Advanced Options ────────────────────────────────────────┐
│                                                             │
│  ☑ Preserve Code Blocks                                    │
│     Keeps code snippets intact (if your docs have code)    │
│                                                             │
│  ☐ Enable Enhanced Metadata                                │
│     Adds extra context to each chunk                       │
│     (Improves quality but slows processing)                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Click "Continue to Model & Store"** when configured.

---

### Step 10: Model & Vector Store (Wizard Step 5 of 7)

This step configures how your text is converted into searchable vectors.

**What Are Vectors?**

Vectors are lists of numbers representing the meaning of text. Similar text = similar numbers. This is how your chatbot finds relevant content.

**What You'll See:**

```
┌─────────────────────────────────────────────────────────────┐
│  Step 5: Model & Vector Store                                │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Embedding Model                                             │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ Model: [all-MiniLM-L6-v2 ▼] (Recommended)             │ │
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
│  Distance Metric: [Cosine ▼] (Recommended)                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Embedding Model Options:**

| Model | Speed | Quality | When to Use |
|-------|-------|---------|-------------|
| **all-MiniLM-L6-v2** | Fast ⚡ | Good | **RECOMMENDED** - Best balance |
| **all-MiniLM-L12-v2** | Medium | Better | Slightly better quality needed |
| **all-mpnet-base-v2** | Slow 🐢 | Best 🏆 | Accuracy-critical applications |

**Recommendation:** Stick with the default unless you have specific needs.

**Important:** You cannot change the embedding model after processing. If you need a different model later, you'll have to recreate the KB.

**Click "Continue to Retrieval"** when configured.

---

### Step 11: Retrieval Configuration (Wizard Step 6 of 7)

This configures how your chatbot searches the Knowledge Base.

**What You'll See:**

```
┌─────────────────────────────────────────────────────────────┐
│  Step 6: Retrieval Configuration                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Search Strategy                                             │
│                                                              │
│  ○ Semantic Search (by meaning)                             │
│  ○ Keyword Search (exact words)                             │
│  ● Hybrid Search (Recommended - combines both)              │
│                                                              │
│  ─────────────────────────────────────────────────────────  │
│                                                              │
│  Top K (Max Results): 10                                     │
│  1  ├────────────●─────────────────────────────────┤ 50     │
│                                                              │
│  Score Threshold: 0.7                                        │
│  0.0 ├─────────────────●───────────────────────────┤ 1.0    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Search Strategy Options:**

| Strategy | How It Works | Best For |
|----------|--------------|----------|
| **Hybrid** | Both meaning + keywords | **RECOMMENDED** - Most reliable |
| **Semantic** | Understands intent | Natural language questions |
| **Keyword** | Exact word matching | Technical terms, product names |

**Top K Explained:**

| Top K Value | Effect |
|-------------|--------|
| 3-5 | Fast, focused answers |
| **10** | **Balanced** - RECOMMENDED |
| 15-20 | Comprehensive, slower |

**Score Threshold Explained:**

| Threshold | Effect |
|-----------|--------|
| 0.5 | More results, some noise |
| **0.7** | **Balanced** - RECOMMENDED |
| 0.9 | Very strict, may miss content |

**Click "Continue to Finalize"** when configured.

---

### Step 12: Review and Finalize (Wizard Step 7 of 7)

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
│  │     Name: Employee Handbook                          │   │
│  │     Context: Both Contexts                           │   │
│  │     Workspace: My Workspace                          │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  📄 Content                                          │   │
│  │     Files: 3                                         │   │
│  │     Approved Pages: 55 of 58                         │   │
│  │     Total Words: ~21,500                             │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  ⚙️ Processing Configuration                         │   │
│  │     Chunking: By Heading (512 chars, 100 overlap)   │   │
│  │     Model: all-MiniLM-L6-v2 (384 dimensions)        │   │
│  │     Search: Hybrid (Top 10, threshold 0.7)          │   │
│  │     Estimated Chunks: ~152                           │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ⚠️ Once created, you cannot change the embedding model     │
│     without recreating the entire Knowledge Base.           │
│                                                              │
│                        [← Back]  [Create Knowledge Base]    │
└─────────────────────────────────────────────────────────────┘
```

**Review your configuration:**

- Is the name correct?
- Are all your files included?
- Did you approve the right pages?
- Are the chunking settings appropriate?

**Click "Create Knowledge Base" when ready.**

**What Happens When You Click Create (Phase 2 - Finalization):**

```
1. VALIDATE DRAFT
   ├── Check all required fields
   ├── Verify files have content
   └── Ensure approved pages exist

2. CREATE DATABASE RECORDS
   ├── Knowledge Base record (PostgreSQL)
   │   └── Status: "processing"
   ├── Document records for each file
   │   └── Status: "pending"
   └── API: POST /api/v1/kb-drafts/{draft_id}/finalize

3. INITIALIZE PIPELINE
   ├── Create pipeline tracking (Redis)
   └── Pipeline ID: kb_{kb_id}_{timestamp}

4. QUEUE BACKGROUND TASK
   ├── Celery task: process_web_kb_task
   └── Queue: high_priority

5. CLEANUP
   └── Delete draft from Redis

6. REDIRECT
   └── Navigate to Pipeline Monitor
```

---

### Step 13: Watch Processing (Pipeline Monitor)

After clicking "Create Knowledge Base," you're redirected to the Pipeline Monitor.

**What You'll See:**

```
┌─────────────────────────────────────────────────────────────┐
│  Processing: Employee Handbook                               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Overall Progress                                            │
│  ██████████████████████░░░░░░░░░░░░░░░░░░░░░ 55%            │
│                                                              │
│  Current Stage: Generating Embeddings...                     │
│                                                              │
│  ─────────────────────────────────────────────────────────  │
│                                                              │
│  Stages:                                                     │
│                                                              │
│  ✅ Parsing           Content extracted                     │
│  ✅ Chunking          152 chunks created                    │
│  🔄 Embedding         Processing... (84/152)                │
│  ⏳ Indexing          Waiting                               │
│                                                              │
│  ─────────────────────────────────────────────────────────  │
│                                                              │
│  Stats:                                                      │
│  Files: 3    Chunks: 152    Embeddings: 84    Vectors: 0    │
│                                                              │
│  Estimated time remaining: ~1 minute                         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Processing Stages for File Uploads:**

| Stage | What Happens | Duration |
|-------|--------------|----------|
| **Parsing** | Uses your approved content (already extracted) | 1-2 seconds |
| **Chunking** | Splits content using your configured strategy | 1-5 seconds |
| **Embedding** | Converts chunks to vectors | 1-10 seconds per 100 chunks |
| **Indexing** | Stores vectors in Qdrant | 1-5 seconds |

**What Happens Behind the Scenes (Phase 3):**

```
Celery Worker picks up the task
         ↓
Create Qdrant collection for this KB
         ↓
For each file:
    ├── Load approved/edited content from document metadata
    ├── Apply chunking strategy
    │   └── Split into ~152 chunks (based on your config)
    ├── Generate embeddings (384-dimensional vectors)
    └── Index vectors in Qdrant
         ↓
Update KB status to "ready"
         ↓
Processing complete!
```

**Processing Time for Files:**

| Content Size | Chunks | Estimated Time |
|--------------|--------|----------------|
| Small (1-10 pages) | ~20-50 | 30 seconds - 2 minutes |
| Medium (10-50 pages) | ~50-200 | 2-5 minutes |
| Large (50-100 pages) | ~200-500 | 5-10 minutes |

---

### Step 14: Knowledge Base Ready!

When processing completes:

```
┌─────────────────────────────────────────────────────────────┐
│  ✅ Processing Complete!                                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Your Knowledge Base is ready to use.                        │
│                                                              │
│  Summary:                                                    │
│  ├── Files: 3                                               │
│  ├── Documents: 55 pages                                    │
│  ├── Chunks: 152                                            │
│  ├── Processing Time: 2 minutes 45 seconds                  │
│  └── Status: Ready                                          │
│                                                              │
│              [View Knowledge Base] [Test Search] [Go to List]│
└─────────────────────────────────────────────────────────────┘
```

**Your KB appears in the list:**

```
┌──────────────────────────────────────────────────────────┐
│ 📚 Employee Handbook                                      │
│ Status: Ready ● | Docs: 55 | Chunks: 152                 │
│ Context: Both | Created: Jan 10, 2025                     │
│ [View] [Docs] [Test] [⋮]                                 │
└──────────────────────────────────────────────────────────┘
```

---

## Part 3: File-Specific Tips and Best Practices

### Optimizing Different File Types

**PDF Files:**

| Tip | Why |
|-----|-----|
| Use text-based PDFs (not scanned) | 10x faster processing, better accuracy |
| Split very large PDFs (>30MB) | Prevents timeout issues |
| Check for password protection | Protected PDFs can't be parsed |
| Re-save scanned PDFs with OCR | Pre-processed OCR is more reliable |

**Word Documents (DOCX):**

| Tip | Why |
|-----|-----|
| Use consistent heading styles | "By Heading" chunking works better |
| Avoid excessive images | Text extraction focuses on text |
| Convert .doc to .docx | Newer format parses more reliably |

**Spreadsheets (CSV, XLSX):**

| Tip | Why |
|-----|-----|
| Include header rows | Helps understand the data structure |
| Keep data clean | Empty rows/columns add noise |
| Consider one topic per file | Easier to chunk meaningfully |
| CSV often works better | Simpler format, more reliable parsing |

**Text Files (TXT, MD):**

| Tip | Why |
|-----|-----|
| Use Markdown formatting | Heading detection works well |
| Add section headers | Improves "By Heading" chunking |
| Keep line lengths reasonable | Prevents odd line-break chunking |

### Common File Upload Issues and Solutions

**Issue: "Processing timed out"**

```
Cause: File too large or complex for OCR
Solutions:
├── Split file into smaller parts
├── Convert scanned PDF to searchable PDF
├── Use a text-based format if possible
└── Try uploading during off-peak hours
```

**Issue: "Garbled text extracted"**

```
Cause: OCR struggled with the document
Solutions:
├── Use higher-quality scan
├── Edit content in approval step to fix errors
├── Re-save document in a different format
└── Extract text manually and upload as TXT
```

**Issue: "File type not supported"**

```
Supported: PDF, DOCX, DOC, TXT, CSV, XLSX, XLS,
          PPTX, PPT, MD, JSON, HTML, RTF, EPUB

Not Supported: Video, audio, images without text,
               password-protected files
```

**Issue: "Pages missing or incomplete"**

```
Cause: Complex formatting or embedded objects
Solutions:
├── Check the original file for issues
├── Export as simpler format (PDF → TXT)
├── Upload individual sections separately
└── Preview and verify before approval
```

---

## Part 4: Understanding How Your Choices Affect Performance

### Configuration Recommendations by Document Type

**HR/Policy Documents (like Employee Handbook):**
```
Chunking: By Heading, 512-1024 chars
Retrieval: Hybrid, Top K 10, Threshold 0.7
Why: Policies have clear sections, need complete context
```

**FAQ Documents:**
```
Chunking: By Paragraph, 256-512 chars
Retrieval: Hybrid, Top K 5, Threshold 0.7
Why: Q&A pairs should stay together, precise answers needed
```

**Technical Manuals:**
```
Chunking: By Heading, 1024 chars, Preserve Code Blocks
Retrieval: Hybrid, Top K 15, Threshold 0.6
Why: Technical content needs context, code should stay intact
```

**Product Catalogs (from CSV/XLSX):**
```
Chunking: By Paragraph, 256-512 chars
Retrieval: Keyword or Hybrid, Top K 10, Threshold 0.7
Why: Product info is structured, exact matching important
```

### How File Quality Affects Chatbot Quality

```
HIGH QUALITY FILES                  LOW QUALITY FILES
├── Clean, readable text            ├── Blurry scans
├── Consistent formatting           ├── Mixed fonts/sizes
├── Clear section headers           ├── No structure
├── Proofread content               ├── Typos and errors
        ↓                                   ↓
Better chatbot answers              Poor or wrong answers
Higher user satisfaction            Frustrated users
```

---

## Part 5: What Happens When Someone Asks a Question

After your KB is ready and connected to a chatbot:

```
User asks: "What is the vacation policy?"
                    ↓
1. EMBEDDING
   Question converted to 384-dimensional vector
                    ↓
2. SEARCH
   Qdrant finds most similar chunks from your files:
   ├── "VACATION POLICY - All employees receive..." (0.89)
   ├── "Time Off Requests - Submit vacation..." (0.78)
   └── "Benefits Overview - Including vacation..." (0.72)
                    ↓
3. FILTER
   Only chunks above 0.7 threshold included
                    ↓
4. AI GENERATION
   Top chunks sent to AI with the question:
   "Using this context from the Employee Handbook,
    answer the question about vacation policy..."
                    ↓
5. RESPONSE
   "According to the Employee Handbook, all full-time
    employees receive 15 days of paid vacation per year.
    Vacation requests should be submitted at least
    two weeks in advance through the HR portal..."
```

---

## Summary: The Complete File Upload Journey

```
┌─────────────────────────────────────────────────────────────┐
│                  FILE UPLOAD KB JOURNEY                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. NAVIGATE                                                 │
│     └── Go to Knowledge Bases page                          │
│                                                              │
│  2. CREATE WIZARD                                            │
│     ├── Step 1: Name your KB                                │
│     ├── Step 2: Upload files (drag & drop)                  │
│     ├── Step 3: Review & approve extracted content          │
│     ├── Step 4: Configure chunking strategy                 │
│     ├── Step 5: Select embedding model                      │
│     ├── Step 6: Configure search settings                   │
│     └── Step 7: Review and create                           │
│                                                              │
│  3. PROCESSING                                               │
│     └── Watch progress: Parse → Chunk → Embed → Index       │
│                                                              │
│  4. READY                                                    │
│     └── KB appears in list with "Ready" status              │
│                                                              │
│  5. USE                                                      │
│     └── Connect KB to chatbot                               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Key Differences from Web URL KBs:**

| Aspect | File Upload | Web URL |
|--------|-------------|---------|
| Content source | Your files | Live websites |
| Content control | Complete control | Depends on website |
| Processing | Immediate (Tika) | May require crawling |
| Updates | Re-upload new files | Re-crawl website |
| Best for | Internal docs, manuals | Public documentation |

**Remember:**
- Preview content before approving to catch extraction issues
- Use appropriate chunking for your document type
- Smaller files process faster and more reliably
- Edit content if OCR made mistakes
- Test your KB before deploying to users

Your Knowledge Base is only as good as the content you put in. Take time to upload quality documents, review the extracted content, and configure settings appropriately—your chatbot will thank you with better answers!

---

*Need help? Visit the PrivexBot documentation or contact support.*
