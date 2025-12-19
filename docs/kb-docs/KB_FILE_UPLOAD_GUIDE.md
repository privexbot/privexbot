# Knowledge Base Creation Guide: File Upload Flow

This comprehensive guide covers the complete file upload workflow for creating Knowledge Bases in PrivexBot, from frontend file selection to backend storage and retrieval.

---

## Table of Contents

1. [Overview](#overview)
2. [Supported File Formats](#supported-file-formats)
3. [Frontend Flow](#frontend-flow)
4. [Backend Processing](#backend-processing)
5. [Storage Architecture](#storage-architecture)
6. [Pipeline Processing](#pipeline-processing)
7. [Chunking Strategies](#chunking-strategies)
8. [Content Approval Flow](#content-approval-flow)
9. [API Reference](#api-reference)
10. [Troubleshooting](#troubleshooting)

---

## Overview

### File Upload vs Web URL

| Aspect | File Upload | Web URL |
|--------|-------------|---------|
| Content Source | Local files (PDF, DOCX, CSV, etc.) | Website scraping |
| Parsing | Apache Tika (Docker container) | Crawl4AI / Firecrawl |
| PostgreSQL Storage | **Metadata only** (no content) | Full content stored |
| Qdrant Storage | **Primary storage** (content + vectors) | Secondary storage |
| Reindexing | Not supported (content not in DB) | Supported from PostgreSQL |
| Privacy | Higher (content only in Qdrant) | Standard |

### Key Architecture Principle

**File Upload KB uses Qdrant-Only Storage**: For privacy and storage efficiency, file upload content is stored ONLY in the Qdrant vector database, not in PostgreSQL. PostgreSQL stores only metadata for filtering and management.

---

## Supported File Formats

Apache Tika supports 15+ file formats with automatic detection:

### Documents
| Format | Extensions | OCR Support | Notes |
|--------|-----------|-------------|-------|
| PDF | `.pdf` | Yes | Scanned PDFs use OCR |
| Word | `.doc`, `.docx` | No | Full formatting preserved |
| OpenDocument | `.odt` | No | LibreOffice format |
| Rich Text | `.rtf` | No | Cross-platform format |

### Spreadsheets
| Format | Extensions | Notes |
|--------|-----------|-------|
| Excel | `.xls`, `.xlsx` | All sheets extracted |
| OpenDocument | `.ods` | LibreOffice Calc |
| CSV | `.csv` | Auto-delimiter detection |

### Presentations
| Format | Extensions | Notes |
|--------|-----------|-------|
| PowerPoint | `.ppt`, `.pptx` | Slide text extracted |
| OpenDocument | `.odp` | LibreOffice Impress |

### Text & Data
| Format | Extensions | Notes |
|--------|-----------|-------|
| Plain Text | `.txt` | UTF-8 encoding |
| Markdown | `.md` | Structure preserved |
| JSON | `.json` | Parsed and formatted |
| HTML | `.html` | Tags stripped, text extracted |
| XML | `.xml` | Content extracted |

### Images (with OCR)
| Format | Extensions | Notes |
|--------|-----------|-------|
| PNG | `.png` | OCR text extraction |
| JPEG | `.jpg`, `.jpeg` | OCR text extraction |
| TIFF | `.tiff` | OCR text extraction |
| BMP | `.bmp` | OCR text extraction |

### Size Limits
- **Maximum file size**: 100 MB
- **Maximum files per upload**: 20 files
- **Minimum content**: 50 characters after parsing

---

## Frontend Flow

### Step 1: Select Source Type

**Location**: `frontend/src/pages/knowledge-bases/create.tsx`

When creating a KB, users select "File Upload" as the source type:

```typescript
const sourceTypeOptions = [
  {
    id: SourceType.WEB_URL,
    name: 'Web URLs',
    description: 'Import content from websites',
    icon: Globe,
  },
  {
    id: SourceType.FILE,
    name: 'File Upload',
    description: 'Upload PDF, Word, CSV, and more (15+ formats)',
    icon: FileUp,
  },
];
```

### Step 2: File Upload Form

**Location**: `frontend/src/components/kb/KBFileUploadForm.tsx`

#### Drag & Drop Interface

The upload form uses `react-dropzone` for intuitive file selection:

```typescript
const { getRootProps, getInputProps, isDragActive } = useDropzone({
  onDrop,
  accept: ACCEPTED_FILE_TYPES,
  maxSize: MAX_FILE_SIZE, // 100MB
  maxFiles: MAX_FILES,    // 20 files
  disabled: isUploading,
});
```

#### File Complexity Analysis

Before upload, each file is analyzed to estimate processing time:

```typescript
function analyzeFileComplexity(file: File): FileComplexity {
  const fileSizeMB = file.size / (1024 * 1024);

  // Fast parse types (text-based)
  const fastTypes = ['text/plain', 'text/csv', 'text/markdown', 'application/json'];

  // OCR types (require image processing)
  const ocrTypes = ['application/pdf', 'image/png', 'image/jpeg'];

  if (isFastType) {
    estimatedSeconds = Math.ceil(2 + fileSizeMB * 0.5);
    complexity = 'low';
  } else if (isOcrType) {
    estimatedSeconds = Math.ceil(10 + fileSizeMB * 8); // OCR is slower
    complexity = fileSizeMB > 5 ? 'high' : 'medium';
  }

  return { complexity, estimatedSeconds, warnings, canProcess };
}
```

#### Complexity Indicators

| Complexity | Color | Typical Files |
|------------|-------|---------------|
| Low | Green | TXT, CSV, MD, JSON (<5MB) |
| Medium | Yellow | DOCX, XLSX (<20MB) |
| High | Orange | PDF with OCR, large files (>20MB) |
| Very High | Red | Large PDFs, scanned documents (>50MB) |

### Step 3: Upload Process

**Location**: `frontend/src/store/kb-store.ts` → `addFileSource()`

#### Upload Flow

```
User drops files
    ↓
Complexity analysis per file
    ↓
Ensure KB draft exists (Redis)
    ↓
Upload to backend (parallel)
    ↓
Backend parses with Tika
    ↓
Store in Redis draft
    ↓
Return preview_pages for approval
```

#### Progress Tracking

```typescript
const uploadSingleFile = async (fileState: UploadedFileState) => {
  // Progress animation (increments 5% every 3 seconds)
  const progressInterval = setInterval(() => {
    setFiles((prev) =>
      prev.map((f) => {
        if (f.id === fileState.id && f.progress < 90) {
          return { ...f, progress: f.progress + 5 };
        }
        return f;
      })
    );
  }, 3000);

  // Call API
  const result = await kbClient.draft.addFileSource(draftId, file);

  // Update with actual results
  setFiles((prev) =>
    prev.map((f) =>
      f.id === fileState.id
        ? { ...f, status: 'success', progress: 100, result }
        : f
    )
  );
};
```

#### API Client Call

**Location**: `frontend/src/lib/kb-client.ts`

```typescript
async addFileSource(draftId: string, file: File): Promise<FileSourceResponse> {
  const formData = new FormData();
  formData.append('file', file);

  // Adaptive timeout based on file size and type
  const timeout = calculateFileUploadTimeout(file);

  const response = await axios.post(
    `/kb-drafts/${draftId}/sources/file`,
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout,
    }
  );

  return response.data;
}
```

#### Timeout Calculation

```typescript
function calculateFileUploadTimeout(file: File): number {
  const sizeMB = file.size / (1024 * 1024);
  const isOcrType = file.type.includes('pdf') || file.type.includes('image');

  let timeout = 60000; // 60s base
  timeout += sizeMB * 30000; // +30s per MB
  if (isOcrType) timeout *= 3; // OCR multiplier
  if (sizeMB > 10) timeout += 60000; // Large file bonus
  if (sizeMB > 30) timeout += 120000; // Very large file bonus

  return Math.min(timeout, 600000); // Max 10 minutes
}
```

### Step 4: Content Review

After upload, users review extracted content in the source list:

**Location**: `frontend/src/components/kb/KBSourceList.tsx`

```typescript
// Display file metadata
<div className="text-sm text-gray-500">
  {formatFileSize(source.metadata?.file_size)} •
  {source.metadata?.page_count} pages •
  {source.metadata?.word_count} words
</div>
```

### Step 5: Content Approval

**Location**: `frontend/src/components/kb/KBContentApproval.tsx`

Users can review and edit each page's content before finalizing:

```typescript
// Aggregate all pages from all sources
const allPages = draftSources.flatMap(source => {
  const pages = source.metadata?.previewPages || [];
  return pages.map((page, index) => ({
    source_id: source.source_id,
    page_index: index,
    content: page.edited_content || page.content, // Prefer edited
    word_count: page.word_count,
    is_approved: page.is_approved,
    is_edited: !!page.edited_content,
  }));
});
```

### Step 6: Chunking Configuration

Same as web URL flow - users select chunking strategy:

**Location**: `frontend/src/components/kb/KBChunkingSettings.tsx`

Available strategies for file uploads:
- `recursive` (Recommended) - Default, works for most content
- `by_heading` - For structured documents with clear headings
- `paragraph_based` - For well-formatted text
- `sentence_based` - Fine-grained, may lose context
- `semantic` - AI-powered topic detection
- `adaptive` - Auto-selects based on content
- `hybrid` - Combines multiple strategies
- `no_chunking` - Keep entire document as one chunk

### Step 7: Model & Store Configuration

**Location**: `frontend/src/components/kb/KBModelConfig.tsx`

```typescript
// Storage estimation for file uploads
const getEstimatedStorage = () => {
  let totalChars = 0;
  draftSources.forEach(source => {
    totalChars += source.metadata?.char_count || 0;
  });

  // Estimate: 1 char ≈ 1.5 bytes (including overhead)
  const storageKB = (totalChars * 1.5) / 1024;
  return formatStorage(storageKB); // Returns KB or MB
};
```

### Step 8: Finalization

**Location**: `frontend/src/pages/knowledge-bases/create.tsx` → `handleFinalize()`

```typescript
const handleFinalize = async () => {
  // Call finalize endpoint
  const result = await kbClient.draft.finalize(draftId);

  // Navigate to KB list with pipeline tracking
  navigate('/knowledge-bases', {
    state: {
      pipelineId: result.pipeline_id,
      showProgress: true
    }
  });
};
```

---

## Backend Processing

### Phase 1: Draft Creation (Redis)

**Endpoint**: `POST /api/v1/kb-drafts/{draft_id}/sources/file`

**Location**: `backend/src/app/api/v1/routes/kb_draft.py:486`

```python
@router.post("/{draft_id}/sources/file")
async def add_file_source_to_draft(
    draft_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Add file upload to KB draft with Tika parsing."""

    # Read file content
    content = await file.read()
    file_stream = BytesIO(content)

    # Parse with Tika and store in Redis
    result = await kb_draft_service.add_file_source_to_draft(
        draft_id=draft_id,
        file_stream=file_stream,
        filename=file.filename,
        file_size=len(content),
        mime_type=file.content_type
    )

    return result
```

### Tika Service

**Location**: `backend/src/app/services/tika_service.py`

#### Configuration

```python
class TikaConfig:
    def __init__(
        self,
        url: str = "http://tika:9998",      # Docker container
        base_timeout: int = 30,              # 30 seconds base
        timeout_per_100kb: float = 1.0,      # +1s per 100KB
        ocr_multiplier: float = 3.0,         # 3x for OCR files
        max_timeout: int = 600,              # 10 minutes max
        max_file_size_mb: int = 100,         # 100MB max
        ocr_enabled: bool = True,
        max_retries: int = 3,                # Retry count
        retry_backoff_base: float = 2.0,     # Exponential backoff
    ):
```

#### Parsing Flow

```python
async def parse_file(
    self,
    file_stream: BinaryIO,
    filename: str,
    metadata_only: bool = False
) -> ParsedFile:
    """
    Parse file using Apache Tika REST API.

    Flow:
    1. Detect MIME type (python-magic)
    2. Calculate adaptive timeout
    3. Send to Tika /rmeta/text endpoint
    4. Extract content and metadata
    5. Normalize whitespace
    6. Return ParsedFile object
    """

    # Read file content
    content = file_stream.read()

    # Detect MIME type
    mime_type = magic.from_buffer(content, mime=True)

    # Calculate timeout based on size and type
    timeout = self.calculate_adaptive_timeout(len(content), mime_type)

    # Call Tika with retries
    for attempt in range(self.config.max_retries):
        try:
            response = await self._call_tika(content, mime_type, timeout)
            break
        except TimeoutError:
            if attempt < self.config.max_retries - 1:
                await asyncio.sleep(self.config.retry_backoff_base ** attempt)

    # Extract and normalize content
    text, metadata = self._extract_content_and_metadata(response)
    text = self._normalize_content(text)

    return ParsedFile(
        content=text,
        metadata=metadata,
        mime_type=mime_type,
        file_size=len(content),
        page_count=metadata.get('page_count'),
        parsing_time_ms=elapsed_ms
    )
```

#### Adaptive Timeout Formula

```python
def calculate_adaptive_timeout(self, file_size_bytes: int, mime_type: str) -> int:
    file_size_kb = file_size_bytes / 1024

    # Base timeout + size-based addition
    timeout = self.config.base_timeout + (file_size_kb / 100) * self.config.timeout_per_100kb

    # OCR multiplier for PDF/images
    if mime_type in self.OCR_HEAVY_TYPES:
        timeout *= self.config.ocr_multiplier

    # Clamp to min/max
    return max(self.config.min_timeout, min(timeout, self.config.max_timeout))
```

### KB Draft Service

**Location**: `backend/src/app/services/kb_draft_service.py:108`

```python
async def add_file_source_to_draft(
    self,
    draft_id: str,
    file_stream: Any,
    filename: str,
    file_size: int,
    mime_type: str
) -> Dict[str, Any]:
    """
    Add file upload to KB draft with Tika parsing.

    IMPORTANT: Content stored ONLY in Redis draft.
    When finalized, content goes ONLY to Qdrant (not PostgreSQL).
    """

    # Parse with Tika
    parsed_file = await tika_service.parse_file(
        file_stream=file_stream,
        filename=filename,
        metadata_only=False
    )

    # Normalize content
    content = normalize_content(parsed_file.content)

    # Create preview pages for Content Approval
    preview_pages = []
    if parsed_file.page_count and parsed_file.page_count > 1:
        # Split by page markers (form feed character)
        page_splits = content.split('\x0c')
        for i, page_content in enumerate(page_splits):
            page_content = normalize_content(page_content)
            if page_content:
                preview_pages.append({
                    "url": f"file:///{filename}#page={i+1}",
                    "title": f"{filename} - Page {i+1}",
                    "content": page_content,
                    "word_count": len(page_content.split()),
                    "char_count": len(page_content),
                    "source_id": source_id,
                    "page_index": i
                })
    else:
        # Single page
        preview_pages.append({
            "url": f"file:///{filename}",
            "title": filename,
            "content": content,
            ...
        })

    # Store source in Redis draft
    source = {
        "id": source_id,
        "type": "file_upload",           # CRITICAL: Source type flag
        "filename": filename,
        "file_size": file_size,
        "mime_type": mime_type,
        "parsed_content": content,        # CRITICAL: Stored in Redis only
        "preview_pages": preview_pages,   # For Content Approval
        "file_metadata": parsed_file.metadata,
        "page_count": len(preview_pages),
        "char_count": len(content),
        "word_count": len(content.split()),
        "parsing_time_ms": parsed_file.parsing_time_ms,
    }

    # Add to draft sources
    draft_service.update_draft(DraftType.KB, draft_id, {"data": {"sources": sources}})

    return {
        "source_id": source_id,
        "filename": filename,
        "page_count": len(preview_pages),
        "char_count": len(content),
        "word_count": len(content.split()),
        "preview_pages": preview_pages  # Return for frontend
    }
```

### Phase 2: Finalization

**Endpoint**: `POST /api/v1/kb-drafts/{draft_id}/finalize`

When user clicks "Create Knowledge Base":

1. Create KB record in PostgreSQL
2. Create Document placeholder records (metadata only for file uploads)
3. Queue Celery background task
4. Return `pipeline_id` for progress tracking

---

## Storage Architecture

### The Dual Storage Pattern

```
┌─────────────────────────────────────────────────────────────────┐
│                    FILE UPLOAD KB                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  PostgreSQL (Metadata Only)                                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ knowledge_bases: id, name, workspace_id, status, config  │   │
│  │ documents: id, kb_id, name, source_type="file_upload"   │   │
│  │           content_full=NULL, content_preview=NULL        │   │
│  │           source_metadata={filename, file_size, ...}     │   │
│  │ chunks: NOT CREATED for file uploads                     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Qdrant (Primary Storage)                                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Collection: kb_{kb_id}                                   │   │
│  │ Points:                                                  │   │
│  │   - id: chunk UUID                                       │   │
│  │   - vector: [384-dim embedding]                          │   │
│  │   - payload:                                             │   │
│  │       content: "full chunk text"  ← CONTENT STORED HERE  │   │
│  │       document_id: "..."                                 │   │
│  │       document_name: "filename.pdf"                      │   │
│  │       source_type: "file_upload"                         │   │
│  │       chunk_index: 0                                     │   │
│  │       word_count: 150                                    │   │
│  │       storage_location: "qdrant_only"                    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Comparison: File Upload vs Web URL

```
┌─────────────────────────────────────────────────────────────────┐
│                    WEB URL KB                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  PostgreSQL (Full Storage)                                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ knowledge_bases: id, name, workspace_id, status, config  │   │
│  │ documents: id, kb_id, name, source_type="web_scraping"  │   │
│  │           content_full="full document text"  ← STORED    │   │
│  │           content_preview="first 500 chars..."           │   │
│  │ chunks: id, document_id, content, chunk_index  ← STORED  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Qdrant (Secondary Storage)                                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Same structure as file upload                            │   │
│  │ Used for retrieval, PostgreSQL for backup/reindex        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Why Qdrant-Only for File Uploads?

1. **Privacy**: Sensitive documents aren't stored in relational DB
2. **Storage Efficiency**: No duplicate content storage
3. **Simplicity**: Single source of truth for content
4. **Performance**: Vector search directly accesses content

### Trade-off: No Reindexing

Because file content isn't stored in PostgreSQL, file upload KBs **cannot be reindexed**:

```python
# In kb_pipeline_tasks.py
if document.source_type == "file_upload":
    print(f"⏭️ Skipping file upload document: {document.name} (content in Qdrant only)")
    file_upload_skipped += 1
    continue  # Cannot reindex - content not in PostgreSQL
```

To re-process a file upload KB, users must:
1. Delete the KB
2. Re-upload the files
3. Create a new KB

---

## Pipeline Processing

### Celery Task: `process_web_kb_task`

**Location**: `backend/src/app/tasks/kb_pipeline_tasks.py`

Despite the name, this task handles both web and file sources:

```python
@shared_task(bind=True, name="process_web_kb")
def process_web_kb_task(
    self,
    kb_id: str,
    pipeline_id: str,
    sources: List[Dict[str, Any]],
    config: Dict[str, Any],
    preview_data: Optional[Dict[str, Any]] = None
):
    """
    Process KB sources (web URLs or file uploads).

    For file uploads:
    - Content already parsed by Tika (in Redis draft)
    - Skip scraping step
    - Go directly to chunking → embedding → indexing
    - Store in Qdrant only (skip PostgreSQL chunks)
    """
```

### Source Type Detection

```python
# Count source types
file_sources_count = sum(1 for s in sources if s.get("type") == "file_upload")
web_sources_count = sum(1 for s in sources if s.get("type") in ("web_scraping", "approved_content"))

# Determine overall type for metrics
if file_sources_count > 0 and web_sources_count > 0:
    source_type_for_metrics = "mixed"
elif file_sources_count > 0:
    source_type_for_metrics = "file_upload"
else:
    source_type_for_metrics = "web_scraping"
```

### File Upload Processing Path

```python
# Check for file upload source
if not scraped_pages and source.get("type") == "file_upload":
    # Content already parsed by Tika
    filename = source.get("filename", "Uploaded File")
    parsed_content = source.get("parsed_content", "")  # From Redis draft
    file_metadata = source.get("file_metadata", {})

    # Create scraped_pages format
    scraped_pages = [{
        "url": f"file:///{filename}",
        "title": filename,
        "content": parsed_content,
        "source": "file_upload",  # Flag for storage decision
        "metadata": {
            "filename": filename,
            "file_size": source.get("file_size"),
            "mime_type": source.get("mime_type"),
            ...
        }
    }]
```

### Storage Decision

```python
# Check if page is from file upload
is_file_upload_page = scraped_page.get("source") == "file_upload"

# Create Document with conditional storage
document = Document(
    kb_id=kb_id,
    workspace_id=kb.workspace_id,
    name=title,
    source_type="file_upload" if is_file_upload_page else "web_scraping",
    source_url=page_url,
    content_full=None if is_file_upload_page else page_content,      # Skip for files
    content_preview=None if is_file_upload_page else page_content[:500],  # Skip for files
    ...
)
```

### Processing with Smart KB Service

```python
processing_result = smart_kb_service.process_document_with_proper_storage(
    document=document,
    content=page_content,
    kb=kb,
    user_config=user_chunking_config,
    skip_postgres_chunks=is_file_upload_page  # CRITICAL: Skip PostgreSQL for files
)
```

### Smart KB Service Processing

**Location**: `backend/src/app/services/smart_kb_service.py`

```python
async def process_document_with_proper_storage(
    self,
    document: Document,
    content: str,
    kb: KnowledgeBase,
    user_config: Dict[str, Any],
    skip_postgres_chunks: bool = False  # True for file uploads
) -> Dict[str, Any]:
    """
    Process document content: chunk → embed → store.

    For file uploads (skip_postgres_chunks=True):
    - Create chunks
    - Generate embeddings
    - Store in Qdrant only
    - Skip PostgreSQL chunk creation
    """

    # 1. Make chunking decision
    chunking_decision = self.make_chunking_decision(content, document.name, kb, user_config)

    # 2. Apply chunking
    chunks_data = chunking_service.chunk_document(
        text=content,
        strategy=chunking_decision.strategy,
        chunk_size=chunking_decision.chunk_size,
        chunk_overlap=chunking_decision.chunk_overlap,
        preserve_code_blocks=True
    )

    # 3. Generate embeddings
    chunk_texts = [chunk["content"] for chunk in chunks_data]
    embeddings = await embedding_service.generate_embeddings(chunk_texts)

    # 4. Prepare storage
    postgres_chunks = []  # Empty for file uploads
    qdrant_chunks = []

    for idx, (chunk_data, embedding) in enumerate(zip(chunks_data, embeddings)):
        chunk_id = uuid4()

        # PostgreSQL chunk (skip for file uploads)
        if not skip_postgres_chunks:
            postgres_chunks.append({
                "id": chunk_id,
                "document_id": document.id,
                "content": chunk_data["content"],
                "chunk_index": idx,
                ...
            })

        # Qdrant chunk (always created)
        qdrant_chunks.append(QdrantChunk(
            id=chunk_id,
            embedding=embedding,
            content=chunk_data["content"],  # Full text in Qdrant
            metadata={
                "document_id": str(document.id),
                "source_type": document.source_type,
                "storage_location": "qdrant_only" if skip_postgres_chunks else "dual",
                ...
            }
        ))

    # 5. Index in Qdrant
    qdrant_service.upsert_chunks(kb.id, qdrant_chunks)

    # 6. Log storage strategy
    if skip_postgres_chunks:
        print(f"📁 [FILE_UPLOAD] Qdrant-only: 0 postgres, {len(qdrant_chunks)} qdrant")
    else:
        print(f"🌐 [WEB] Dual storage: {len(postgres_chunks)} postgres, {len(qdrant_chunks)} qdrant")

    return {
        "postgres_chunks": postgres_chunks,
        "qdrant_chunks": qdrant_chunks,
        "chunking_decision": chunking_decision,
        "skip_postgres_chunks": skip_postgres_chunks
    }
```

### Progress Tracking

```python
class PipelineProgressTracker:
    def __init__(self, pipeline_id: str, kb_id: str, source_type: str):
        self.stats = {
            "pages_discovered": 0,      # Files: documents added
            "pages_scraped": 0,         # Files: documents parsed
            "pages_failed": 0,
            "chunks_created": 0,
            "embeddings_generated": 0,
            "vectors_indexed": 0,
            "source_type": source_type,  # "file_upload", "web_scraping", "mixed"
            "file_sources": 0,
            "web_sources": 0
        }
```

Frontend polls `/api/v1/kb-pipeline/{pipeline_id}/status` every 2 seconds to display progress.

---

## Chunking Strategies

### Strategy Selection for Files

| Strategy | Best For | File Types |
|----------|----------|------------|
| `recursive` | General use | All |
| `by_heading` | Structured docs | PDF, DOCX with headings |
| `paragraph_based` | Well-formatted text | TXT, MD |
| `sentence_based` | Fine-grained search | Any (may lose context) |
| `semantic` | Topic-aware splitting | Long documents |
| `adaptive` | Auto-detection | All |
| `hybrid` | Mixed content | PDFs with code + prose |
| `no_chunking` | Small documents | < 2000 chars |

### Chunking Configuration

```typescript
interface ChunkingConfig {
  strategy: string;           // Chunking strategy
  chunk_size: number;         // Target size (200-4000 chars)
  chunk_overlap: number;      // Overlap (0-500 chars)
  preserve_code_blocks: bool; // Keep code intact
  enable_enhanced_metadata: bool; // Include context
}
```

### Enhanced Metadata

When `enable_enhanced_metadata` is enabled:

```python
{
    "content": "chunk text...",
    "context_before": "previous chunk summary...",
    "context_after": "next chunk summary...",
    "parent_heading": "Section 3: Installation",
    "position_in_doc": 5,
    "total_chunks": 20
}
```

---

## Content Approval Flow

### Editing Content Before Processing

**Location**: `frontend/src/components/kb/KBContentPreviewModal.tsx`

Users can edit extracted content before finalization:

```typescript
const [editedContent, setEditedContent] = useState(page.content);

const handleSave = () => {
  // Update source with edited content
  updateSourcePage(source_id, page_index, {
    edited_content: editedContent,
    is_edited: true
  });
};
```

### Content Priority

```typescript
// Always use edited content if available
const displayContent = page.edited_content || page.content || '';
```

### Backend Content Guarantee

**Location**: `backend/src/app/tasks/kb_pipeline_tasks.py`

```python
# Automatically prefer edited_content
if content_source == "preview_data" and isinstance(scraped_page, dict):
    edited_content = scraped_page.get("edited_content")
    if edited_content and edited_content.strip():
        page_content = edited_content  # Use approved/edited content
        content_source = "corrected_to_approved"
```

---

## API Reference

### Create KB Draft

```http
POST /api/v1/kb-drafts/
Content-Type: application/json

{
  "name": "My Knowledge Base",
  "description": "Documentation from uploaded files",
  "workspace_id": "uuid",
  "context": "both"
}

Response:
{
  "draft_id": "uuid",
  "workspace_id": "uuid",
  "expires_at": "2024-01-16T12:00:00Z"
}
```

### Upload File to Draft

```http
POST /api/v1/kb-drafts/{draft_id}/sources/file
Content-Type: multipart/form-data

file: <binary file data>

Response:
{
  "source_id": "uuid",
  "filename": "document.pdf",
  "file_size": 1024000,
  "mime_type": "application/pdf",
  "page_count": 15,
  "char_count": 25000,
  "word_count": 4200,
  "parsing_time_ms": 3500,
  "preview_pages": [
    {
      "url": "file:///document.pdf#page=1",
      "title": "document.pdf - Page 1",
      "content": "Page content...",
      "word_count": 280,
      "char_count": 1650,
      "source_id": "uuid",
      "page_index": 0
    }
  ]
}
```

### Bulk Upload Files

```http
POST /api/v1/kb-drafts/{draft_id}/sources/files/bulk
Content-Type: multipart/form-data

files: <file1>, <file2>, ...

Response:
{
  "total_files": 5,
  "successful": 5,
  "failed": 0,
  "total_chars": 125000,
  "total_words": 21000,
  "total_pages": 75,
  "sources": [...],
  "failures": []
}
```

### Update Chunking Config

```http
PUT /api/v1/kb-drafts/{draft_id}/config/chunking
Content-Type: application/json

{
  "strategy": "by_heading",
  "chunk_size": 1000,
  "chunk_overlap": 200,
  "preserve_code_blocks": true
}
```

### Finalize Draft

```http
POST /api/v1/kb-drafts/{draft_id}/finalize
Content-Type: application/json

Response:
{
  "kb_id": "uuid",
  "pipeline_id": "uuid",
  "status": "processing",
  "message": "KB created, processing 5 documents..."
}
```

### Check Pipeline Status

```http
GET /api/v1/kb-pipeline/{pipeline_id}/status

Response:
{
  "pipeline_id": "uuid",
  "kb_id": "uuid",
  "status": "processing",
  "progress": 65,
  "stats": {
    "pages_discovered": 5,
    "pages_scraped": 5,
    "chunks_created": 45,
    "embeddings_generated": 45,
    "vectors_indexed": 45,
    "source_type": "file_upload"
  },
  "current_stage": "embedding",
  "started_at": "2024-01-15T10:00:00Z"
}
```

---

## Troubleshooting

### Common Issues

#### 1. File Upload Timeout

**Symptoms**: Upload fails after long wait, timeout error

**Causes**:
- Large file (>50MB)
- PDF requiring OCR
- Slow Tika service

**Solutions**:
- Split large files into smaller parts
- Use fast parse formats when possible (TXT, MD)
- Check Tika container health: `docker logs tika`

#### 2. Empty Content Extracted

**Symptoms**: File uploads successfully but no content

**Causes**:
- Scanned PDF without OCR layer
- Password-protected document
- Corrupted file

**Solutions**:
- Use OCR software to add text layer to PDFs
- Remove password protection before upload
- Re-save document from source application

#### 3. OCR Taking Too Long

**Symptoms**: Processing stuck at "parsing" stage

**Causes**:
- Large scanned PDF (many pages)
- High-resolution images

**Solutions**:
- Reduce image resolution before scanning
- Split large PDFs into sections
- Consider using pre-OCR'd documents

#### 4. Chunking Creates Too Many/Few Chunks

**Symptoms**: Unexpected chunk count

**Solutions**:
- Adjust `chunk_size` (larger = fewer chunks)
- Adjust `chunk_overlap` (larger = more overlap)
- Try different strategy (e.g., `by_heading` for structured docs)

#### 5. Cannot Reindex File Upload KB

**Symptoms**: Reindex button doesn't work for file KBs

**Cause**: By design - content stored only in Qdrant

**Solution**:
1. Delete the existing KB
2. Re-upload files
3. Create new KB with updated configuration

### Checking Tika Health

```bash
# Check Tika container status
docker ps | grep tika

# Check Tika logs
docker logs tika --tail 100

# Test Tika endpoint
curl -X GET http://localhost:9998/tika
```

### Checking Pipeline Status

```bash
# View Celery worker logs
docker logs celery-worker --tail 100

# Check Redis for pipeline status
redis-cli GET "pipeline:{pipeline_id}:status"
```

---

## Summary

The file upload flow in PrivexBot follows this path:

```
Frontend                           Backend                          Storage
────────                           ───────                          ───────

1. Select files    ─────────────>
   (drag & drop)

2. Complexity
   analysis

3. Upload files    ─────────────>  4. Receive file
                                   5. Parse with Tika ────────────>  Redis (draft)
                                   6. Extract content                 24hr TTL
                                   7. Create preview_pages
                                   8. Store in Redis draft

9. Review content  <─────────────
   (preview_pages)

10. Edit/Approve   ─────────────>  11. Update draft

12. Configure      ─────────────>  13. Update config
    chunking

14. Finalize       ─────────────>  15. Create KB record ──────────>  PostgreSQL
                                   16. Create Document               (metadata only)
                                       (metadata only)
                                   17. Queue Celery task

                                   18. Celery: Chunk content
                                   19. Celery: Generate embeddings
                                   20. Celery: Index vectors ──────>  Qdrant
                                                                      (content + vectors)

21. Monitor        <─────────────  22. Progress updates <──────────  Redis
    progress                                                          (status)

23. KB Ready!      <─────────────  24. Status: "ready"
```

**Key Points**:
- Files are parsed immediately on upload (Tika)
- Content stored in Redis draft until finalization
- After finalization: metadata in PostgreSQL, content+vectors in Qdrant only
- No reindexing possible for file uploads (content not in PostgreSQL)
- Privacy-focused design - sensitive content not in relational DB
