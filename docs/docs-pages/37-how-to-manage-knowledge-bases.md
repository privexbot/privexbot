# Knowledge Base Management

After deploying a knowledge base, you'll need to maintain it—adding new content, monitoring quality, and troubleshooting issues. This guide covers all post-deployment knowledge base operations.

---

## Table of Contents

1. [KB Lifecycle Overview](#kb-lifecycle-overview)
2. [Adding Sources to Existing KB](#adding-sources-to-existing-kb)
3. [Managing Documents](#managing-documents)
4. [Testing KB Quality](#testing-kb-quality)
5. [Monitoring Processing](#monitoring-processing)
6. [Reindexing a KB](#reindexing-a-kb)
7. [Retrying Failed KBs](#retrying-failed-kbs)
8. [KB Statistics](#kb-statistics)
9. [Troubleshooting](#troubleshooting)

---

## KB Lifecycle Overview

Understanding the knowledge base lifecycle helps you manage content effectively.

### Status Flow

```
┌─────────┐     ┌────────────┐     ┌──────────┐     ┌────────┐
│  Draft  │────▶│ Processing │────▶│  Ready   │────▶│ Active │
└─────────┘     └────────────┘     └──────────┘     └────────┘
                      │                                  │
                      ▼                                  ▼
                 ┌────────┐                        ┌─────────┐
                 │ Failed │                        │ Updating│
                 └────────┘                        └─────────┘
```

### Status Definitions

| Status | Description | Actions Available |
|--------|-------------|-------------------|
| **Draft** | Initial creation, not yet deployed | Edit freely, deploy |
| **Processing** | Documents being chunked and embedded | Cancel, monitor progress |
| **Ready** | Processing complete, not connected to bots | Connect to chatbots |
| **Active** | Connected to one or more chatbots | Add sources, test, view stats |
| **Failed** | Processing encountered errors | Retry, view errors |
| **Updating** | New sources being processed | Monitor progress |

### Storage Architecture

PrivexBot uses two storage systems:

1. **PostgreSQL**: Document metadata, source records, configuration
2. **Qdrant**: Vector embeddings for semantic search

Both must be synchronized for proper operation.

---

## Adding Sources to Existing KB

Expand your knowledge base by adding new content sources.

### Step 1: Access Your Knowledge Base

1. Navigate to **Knowledge Bases** in your workspace
2. Click on the KB you want to update
3. Go to the **Sources** tab

### Step 2: Add New Sources

Click **+ Add Source** and choose a source type:

#### File Upload

1. Select **File Upload**
2. Drag files or click to browse
3. Supported formats:
   - Documents: PDF, DOCX, DOC, TXT, RTF
   - Spreadsheets: CSV, XLSX, XLS
   - Data: JSON, XML
   - Code: MD, HTML, various programming languages
4. Click **Upload**

**File Limits:**
| Limit | Value |
|-------|-------|
| Max file size | 50 MB |
| Max files per upload | 20 |
| Total storage per KB | Based on plan |

#### Website URL

1. Select **Website**
2. Enter the URL to scrape
3. Configure options:
   - **Depth**: How many links to follow (0-3)
   - **Max Pages**: Limit total pages scraped
   - **Include Patterns**: URL patterns to include
   - **Exclude Patterns**: URL patterns to skip
4. Click **Add URL**

#### Direct Text

1. Select **Text Document**
2. Enter a title
3. Paste or type your content
4. Click **Create Document**

### Step 3: Process New Sources

New sources enter a processing queue:

1. **Parsing**: Extract text from files
2. **Chunking**: Split into manageable pieces
3. **Embedding**: Convert to vectors
4. **Indexing**: Store in Qdrant

Monitor progress in the **Pipeline Status** section.

---

## Managing Documents

### Viewing Documents

1. Go to your KB → **Documents** tab
2. View all documents with their status:

| Column | Description |
|--------|-------------|
| **Name** | Document title or filename |
| **Source** | Origin (file, URL, text) |
| **Status** | processed, processing, failed |
| **Chunks** | Number of text chunks |
| **Added** | Date added |

### Document Status Icons

| Icon | Status | Meaning |
|------|--------|---------|
| ✓ | Processed | Ready for search |
| ⟳ | Processing | Currently being embedded |
| ✗ | Failed | Error during processing |
| ○ | Pending | Queued for processing |

### Updating Document Metadata

1. Click on a document name
2. Edit available fields:
   - **Title**: Display name
   - **Description**: Optional notes
   - **Tags**: For organization
3. Click **Save**

**Note**: Changing metadata doesn't require reprocessing.

### Deleting Documents

1. Select documents using checkboxes
2. Click **Delete Selected**
3. Confirm the action

**What Happens:**
- Document removed from PostgreSQL
- Vectors removed from Qdrant
- Chunk count updated
- Search results update immediately

### Bulk Operations

| Operation | How | Notes |
|-----------|-----|-------|
| Select All | Click header checkbox | Current page only |
| Delete Multiple | Select → Delete | Confirmation required |
| Reprocess Multiple | Select → Reprocess | Re-chunks and re-embeds |

---

## Testing KB Quality

Verify your knowledge base returns relevant results.

### Using the Test Search Interface

1. Go to your KB → **Test** tab
2. Enter a test query
3. Review results

### Search Result Details

Each result shows:

```
┌─────────────────────────────────────────────────────────────┐
│ Result 1                                        Score: 0.89 │
├─────────────────────────────────────────────────────────────┤
│ Source: product-manual.pdf                                  │
│ Page: 23                                                    │
│                                                             │
│ "The installation process requires administrator            │
│ privileges. First, download the installer from..."          │
│                                                             │
│ Chunk ID: abc123  |  Tokens: 245                           │
└─────────────────────────────────────────────────────────────┘
```

### Understanding Scores

| Score Range | Interpretation |
|-------------|----------------|
| 0.9 - 1.0 | Excellent match |
| 0.8 - 0.9 | Good match |
| 0.7 - 0.8 | Relevant |
| 0.6 - 0.7 | Possibly relevant |
| Below 0.6 | Likely not relevant |

### Search Strategies

Test with different strategies to compare results:

| Strategy | Best For | How It Works |
|----------|----------|--------------|
| **Hybrid Search** | Most queries | Combines semantic + keyword |
| **Semantic** | Conceptual questions | Meaning-based matching |
| **Keyword** | Exact terms, names | Traditional text search |

### Testing Best Practices

1. **Test Real Questions**: Use questions your users actually ask
2. **Check Edge Cases**: Test misspellings, synonyms, partial phrases
3. **Verify Sources**: Ensure returned chunks cite correct documents
4. **Compare Strategies**: Find which works best for your content
5. **Note Gaps**: Identify missing information to add

---

## Monitoring Processing

### Pipeline Status Dashboard

Access via KB → **Pipeline** tab or notification banner.

```
┌──────────────────────────────────────────────────────────────┐
│  Pipeline Status: Processing                    [Cancel]     │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Documents: ████████████░░░░░░░░  12/20 (60%)               │
│  Chunks:    ██████░░░░░░░░░░░░░░  156/~500 (31%)            │
│  Embeddings:████░░░░░░░░░░░░░░░░  89/156 (57%)              │
│                                                              │
│  Current: Processing "annual-report-2024.pdf"                │
│  Estimated time remaining: ~3 minutes                        │
│                                                              │
│  ─────────────────────────────────────────────────────────   │
│  Activity Log:                                               │
│  14:32:15 - Completed: user-manual.pdf (45 chunks)          │
│  14:31:02 - Completed: faq-document.txt (12 chunks)         │
│  14:30:45 - Started: annual-report-2024.pdf                 │
└──────────────────────────────────────────────────────────────┘
```

### Real-Time Progress Indicators

| Indicator | Meaning |
|-----------|---------|
| Document Progress | Files parsed and chunked |
| Chunk Progress | Text segments created |
| Embedding Progress | Vectors generated |
| Current File | What's being processed now |

### Processing Queues

Documents are processed through specialized queues:

1. **Parsing Queue**: Extract text from files
2. **Web Scraping Queue**: Fetch and parse URLs
3. **Chunking Queue**: Split text into segments
4. **Embedding Queue**: Generate vectors

### Viewing Logs

Click **View Full Log** for detailed processing history:

```
2024-01-15 14:32:15 [INFO] Document processed: user-manual.pdf
  - Pages extracted: 45
  - Chunks created: 45
  - Avg chunk size: 512 tokens

2024-01-15 14:31:02 [WARNING] Document processed with issues: faq.txt
  - Warning: File encoding detected as Windows-1252, converted to UTF-8
  - Chunks created: 12
```

### Canceling Processing

If you need to stop processing:

1. Click **Cancel Pipeline**
2. Confirm the action
3. Already-processed documents remain
4. Pending documents stay in queue (can resume later)

---

## Reindexing a KB

Reindexing recreates all vectors from existing documents.

### When to Reindex

| Situation | Reindex? |
|-----------|----------|
| Changed chunking settings | Yes |
| Switching embedding model | Yes |
| Poor search results | Maybe - test first |
| Adding new documents | No - automatic |
| Vector database issues | Yes |

### How to Reindex

1. Go to KB → **Settings** tab
2. Scroll to **Maintenance** section
3. Click **Reindex Knowledge Base**
4. Configure options:
   - **Preserve edits**: Keep manual content edits
   - **New chunk settings**: Optionally change chunking
5. Confirm and start

### Reindex Process

```
1. Backup existing vectors (safety)
2. Clear Qdrant collection
3. Re-chunk all documents with new settings
4. Generate new embeddings
5. Index in Qdrant
6. Verify integrity
7. Update statistics
```

### Preview Rechunking

Before reindexing, preview how changes affect your content:

1. Click **Preview Rechunking**
2. Compare old vs new chunk counts
3. Review sample chunks
4. Decide whether to proceed

### During Reindex

- KB remains searchable with old vectors
- New vectors replace old on completion
- Process can take significant time for large KBs
- Progress shown in Pipeline tab

---

## Retrying Failed KBs

When processing fails, you can retry with the enhanced retry feature.

### Identifying Failed KBs

Failed KBs show:
- Red status badge
- Error message summary
- Retry button

### Checking Retry Eligibility

Not all failures can be retried. Check the error type:

| Error Type | Retryable? | Solution |
|------------|------------|----------|
| Temporary network error | Yes | Retry |
| Invalid file format | No | Remove and re-add file |
| Rate limit exceeded | Yes | Wait, then retry |
| Embedding service down | Yes | Retry later |
| Out of storage | No | Upgrade plan or delete content |
| Corrupted file | No | Upload new file |

### How to Retry

1. Go to the failed KB
2. Review the error message
3. Click **Retry Processing**
4. Choose retry options:
   - **Full Retry**: Reprocess everything
   - **Failed Only**: Only retry failed documents
5. Confirm and start

### Enhanced Retry Features

The retry system includes:

- **State Restoration**: Preserves user edits to content
- **Incremental Processing**: Skips successfully processed documents
- **Error Details**: Specific failure reasons per document
- **Automatic Backoff**: Handles rate limits gracefully

### After Retry

Monitor the Pipeline tab for:
- Progress on retried documents
- Any new errors
- Completion status

---

## KB Statistics

### Accessing Statistics

Go to KB → **Overview** or **Stats** tab.

### Available Metrics

| Metric | Description |
|--------|-------------|
| **Total Documents** | Number of source documents |
| **Total Chunks** | Number of text segments |
| **Total Tokens** | Approximate token count |
| **Storage Used** | Disk space consumed |
| **Vector Count** | Embeddings in Qdrant |
| **Last Updated** | Most recent change |

### Health Indicators

```
┌─────────────────────────────────────────────────────────────┐
│  Knowledge Base Health                                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ✓ Vector Store Connected      ✓ All documents processed   │
│  ✓ Embeddings synchronized     ✓ No orphaned chunks        │
│                                                             │
│  Documents: 45    Chunks: 1,234    Vectors: 1,234          │
│                                                             │
│  Status: Healthy                                            │
└─────────────────────────────────────────────────────────────┘
```

### Health Check Details

| Check | What It Verifies |
|-------|------------------|
| Vector Store Connected | Qdrant is accessible |
| Documents Processed | No pending/failed docs |
| Embeddings Synchronized | DB chunk count = Qdrant vector count |
| No Orphaned Chunks | All vectors have valid documents |

### Query Performance Stats

If available:
- Average query latency
- Queries per day
- Most common queries
- Zero-result queries

---

## Troubleshooting

### Stuck Pipelines

**Symptoms**: Processing shows "In Progress" for hours

**Diagnosis**:
1. Check Pipeline tab for last activity
2. Look for error messages in logs
3. Verify backend services are running

**Solutions**:

| Issue | Solution |
|-------|----------|
| Worker crashed | Contact support to restart |
| Large file timeout | Split into smaller files |
| External service down | Wait and retry |
| Queue backlog | Wait for processing |

**Workaround**: Cancel pipeline and retry

### Failed Processing

**Common Errors and Solutions**:

| Error | Cause | Solution |
|-------|-------|----------|
| "Could not parse file" | Unsupported/corrupted file | Convert to different format |
| "Embedding failed" | AI service issue | Retry later |
| "Rate limit exceeded" | Too many requests | Wait 15 min, retry |
| "Out of memory" | File too large | Split into smaller files |
| "Invalid encoding" | Non-UTF8 text | Convert file to UTF-8 |

### Poor Search Results

**Symptoms**: Relevant content not returned or low scores

**Diagnosis Checklist**:
- [ ] Content actually exists in KB
- [ ] Document processed successfully
- [ ] Using appropriate search strategy
- [ ] Query is well-formed

**Solutions**:

| Issue | Solution |
|-------|----------|
| Content missing | Add relevant documents |
| Chunking too small | Increase chunk size |
| Chunking too large | Decrease chunk size |
| Wrong strategy | Try hybrid instead of semantic |
| Poor content quality | Improve source documents |

### Vector Count Mismatch

**Symptoms**: "Embeddings not synchronized" warning

**Cause**: PostgreSQL and Qdrant have different chunk counts

**Solutions**:
1. **Minor mismatch**: Usually self-corrects
2. **Persistent mismatch**: Run health check
3. **Significant mismatch**: Reindex KB

### Cannot Delete Documents

**Symptoms**: Delete button disabled or error on delete

**Possible Causes**:
- Document still processing
- Connected to active chatbot
- Backend service issue

**Solutions**:
1. Wait for processing to complete
2. Disconnect from chatbots first (if required)
3. Refresh and retry

### Cannot Connect KB to Chatbot

**Symptoms**: KB doesn't appear in chatbot KB selector

**Possible Causes**:
- KB still in draft mode
- KB in different workspace
- KB status is failed

**Solutions**:
1. Deploy the KB first
2. Check workspace context
3. Fix and retry failed KB

---

## Best Practices

### Content Organization

| Practice | Benefit |
|----------|---------|
| Group related content | Better retrieval accuracy |
| Use descriptive filenames | Easier management |
| Add metadata/tags | Filter and organize |
| Regular content audits | Remove outdated info |

### Chunk Size Optimization

| Content Type | Recommended Chunk Size |
|--------------|------------------------|
| FAQs | 200-300 tokens |
| Technical docs | 400-600 tokens |
| Long-form articles | 500-800 tokens |
| Code documentation | 300-500 tokens |

### Maintenance Schedule

| Task | Frequency |
|------|-----------|
| Add new content | As created |
| Review search quality | Weekly |
| Check health status | Weekly |
| Remove outdated content | Monthly |
| Full audit | Quarterly |

---

## Next Steps

- **[Create Chatflows](34-how-to-create-chatflows.md)**: Build bots using your KB
- **[View Analytics](44-how-to-use-analytics.md)**: Track KB usage
- **[Troubleshooting Guide](50-troubleshooting-guide.md)**: More problem solutions

---

*Need help? Visit our [Troubleshooting Guide](50-troubleshooting-guide.md) or contact support.*
