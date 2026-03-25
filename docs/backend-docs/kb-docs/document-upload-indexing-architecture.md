# Document Upload & Indexing Architecture

> **Last Updated**: December 18, 2024
> **Status**: Production Ready
> **Scope**: Backend document creation, file upload, and indexing flows

---

## Table of Contents

1. [Overview](#overview)
2. [KB Types and Their Characteristics](#kb-types-and-their-characteristics)
3. [Document Creation Endpoints](#document-creation-endpoints)
4. [Storage Patterns](#storage-patterns)
5. [Celery Tasks](#celery-tasks)
6. [Indexing Flow](#indexing-flow)
7. [Reindexing Architecture](#reindexing-architecture)
8. [Frontend Integration](#frontend-integration)
9. [File Format Support](#file-format-support)
10. [Best Practices](#best-practices)

---

## Overview

PrivexBot supports two distinct Knowledge Base (KB) creation methods, each with different storage patterns optimized for their use cases:

| KB Type | Creation Method | Content Storage | Privacy Level |
|---------|----------------|-----------------|---------------|
| **Web URL KB** | Web scraping with content approval | PostgreSQL + Qdrant | Standard |
| **File Upload KB** | Direct file upload via Tika | Qdrant only | Enhanced |

### Design Principles

1. **Privacy-First**: File upload content is never persisted in PostgreSQL
2. **Consistency**: Same KB type maintains consistent storage patterns
3. **Flexibility**: Web URL KBs support both text and file additions
4. **Performance**: Qdrant-only storage for file uploads reduces database load

---

## KB Types and Their Characteristics

### Web URL KB

Created via web scraping flow with content approval/editing.

```
Characteristics:
- Source Type: "web_scraping"
- Content Storage: PostgreSQL (content_full, content_preview)
- Chunk Storage: PostgreSQL + Qdrant (dual storage)
- Reindexable: YES
- Editable Documents: YES
```

**Allowed Operations:**
- Add text documents (POST /documents)
- Upload simple files (.txt, .md, .json, .csv)
- Edit existing documents
- Full reindexing with configuration changes

### File Upload KB

Created via direct file upload with Tika parsing.

```
Characteristics:
- Source Type: "file_upload"
- Content Storage: None (Qdrant vectors only)
- Chunk Storage: Qdrant only
- Reindexable: NO (vectors preserved)
- Editable Documents: NO
```

**Allowed Operations:**
- Upload files (PDF, Word, Excel, PowerPoint, etc.)
- View document metadata
- Delete documents

**Restricted Operations:**
- Add text documents (BLOCKED)
- Edit documents (content in Qdrant only)
- Reindex (no source content to re-process)

---

## Document Creation Endpoints

### 1. Text Document Creation

**Endpoint:** `POST /api/v1/kbs/{kb_id}/documents`

```python
# Request Body
{
    "name": "Document Title",
    "content": "Full document content...",
    "source_type": "manual",
    "custom_metadata": {}
}
```

**Flow:**
```
Request → Validate Content → Check KB Type → Create Document → Queue Task
                                   ↓
                            File Upload KB?
                                   ↓
                            YES → BLOCK (400 Error)
                            NO  → Continue
```

**Storage:**
- `Document.content_full`: Full content stored
- `Document.content_preview`: First 500 characters
- Task: `process_document_task`
- Chunks: PostgreSQL + Qdrant

### 2. File Upload

**Endpoint:** `POST /api/v1/kbs/{kb_id}/documents/upload`

```python
# Request: multipart/form-data
file: UploadFile
```

**Flow:**
```
Request → Read File → Detect KB Type → Validate Size → Parse Content → Create Document → Queue Task
                            ↓
                     File Upload KB?
                            ↓
              YES                           NO
               ↓                             ↓
    Tika Parsing (robust)      Simple Parsing (text only)
    Max: 50MB                  Max: 10MB
    Formats: PDF, Word, etc.   Formats: .txt, .md, .json, .csv
               ↓                             ↓
    content_full = None        content_full = parsed_content
    skip_postgres_chunks=True  skip_postgres_chunks=False
```

**Task:** `process_file_upload_document_task`

---

## Storage Patterns

### PostgreSQL Document Table

| Field | Web URL KB | File Upload KB |
|-------|------------|----------------|
| `content_full` | Full content | `NULL` |
| `content_preview` | First 500 chars | `NULL` |
| `source_type` | "web_scraping" / "manual" | "file_upload" |
| `source_metadata` | Scraping info | File info + approved_sources |
| `processing_metadata` | Includes storage strategy | `chunk_storage_location: "qdrant_only"` |

### PostgreSQL Chunk Table

| KB Type | Chunks in PostgreSQL |
|---------|---------------------|
| Web URL KB | YES (with embeddings) |
| File Upload KB | NO |

### Qdrant Vector Store

| KB Type | Vectors in Qdrant |
|---------|-------------------|
| Web URL KB | YES |
| File Upload KB | YES (primary storage) |

**Collection Naming:** `kb_{kb_id}`

**Vector Metadata:**
```json
{
    "document_id": "uuid",
    "kb_id": "uuid",
    "workspace_id": "uuid",
    "kb_context": "string",
    "chunk_index": 0,
    "document_name": "string",
    "source_type": "web_scraping|file_upload",
    "word_count": 150,
    "character_count": 850
}
```

---

## Celery Tasks

### Task Registration

**File:** `src/app/tasks/__init__.py`

```python
from app.tasks.document_processing_tasks import (
    process_document_task,
    reprocess_document_task,
    process_file_upload_document_task  # For file uploads to existing KBs
)
```

### process_document_task

**Purpose:** Process text documents for web URL KBs

```python
@shared_task(bind=True, name="process_document")
def process_document_task(
    self,
    document_id: str,
    content: str,
    kb_config: Dict[str, Any]
):
```

**Storage:** PostgreSQL chunks + Qdrant vectors

### process_file_upload_document_task

**Purpose:** Process file uploads with configurable storage

```python
@shared_task(bind=True, name="process_file_upload_document")
def process_file_upload_document_task(
    self,
    document_id: str,
    content: str,
    kb_config: Dict[str, Any],
    chunking_config: Dict[str, Any] = None,
    embedding_config: Dict[str, Any] = None,
    skip_postgres_chunks: bool = True  # Key parameter
):
```

**Parameter: `skip_postgres_chunks`**

| Value | Storage | Use Case |
|-------|---------|----------|
| `True` | Qdrant only | File Upload KB |
| `False` | PostgreSQL + Qdrant | Web URL KB file upload |

### reindex_kb_task

**Purpose:** Re-process all documents with new configuration

```python
@shared_task(bind=True, name="reindex_kb")
def reindex_kb_task(self, kb_id: str, new_config: dict = None):
```

**Important:** Skips file upload documents (no content to reindex)

---

## Indexing Flow

### Initial KB Creation

#### Web URL KB Flow

```
Draft Creation (Redis)
        ↓
Add Web Sources
        ↓
Preview & Approve Content
        ↓
Finalize Draft → Create KB + Documents in PostgreSQL
        ↓
Queue process_web_kb_task
        ↓
┌─────────────────────────────────────┐
│  For each source:                   │
│  1. Use approved content            │
│  2. Chunk content                   │
│  3. Generate embeddings             │
│  4. Store Document.content_full     │
│  5. Create Chunk records (PG)       │
│  6. Index in Qdrant                 │
└─────────────────────────────────────┘
        ↓
Update KB status = "ready"
```

#### File Upload KB Flow

```
Draft Creation (Redis)
        ↓
Upload Files → Tika Parsing
        ↓
Preview Parsed Content
        ↓
Finalize Draft → Create KB + Documents in PostgreSQL
        ↓
Queue process_web_kb_task (with file sources)
        ↓
┌─────────────────────────────────────┐
│  For each file source:              │
│  1. Use parsed content              │
│  2. Chunk content                   │
│  3. Generate embeddings             │
│  4. Document.content_full = NULL    │
│  5. Skip PostgreSQL chunks          │
│  6. Index ONLY in Qdrant            │
└─────────────────────────────────────┘
        ↓
Update KB status = "ready"
```

### Adding Documents to Existing KB

#### Text Document (Web URL KB only)

```
POST /api/v1/kbs/{kb_id}/documents
        ↓
Validate: Is file-upload-only KB? → YES → 400 Error
        ↓ NO
Create Document (content_full = content)
        ↓
Queue process_document_task
        ↓
Chunk → Embed → Store in PostgreSQL + Qdrant
```

#### File Upload

```
POST /api/v1/kbs/{kb_id}/documents/upload
        ↓
Detect KB Type (check existing documents)
        ↓
┌─────────────────┬──────────────────────┐
│ Web URL KB      │ File Upload KB       │
├─────────────────┼──────────────────────┤
│ Simple parsing  │ Tika parsing         │
│ 10MB limit      │ 50MB limit           │
│ .txt,.md,.json  │ PDF, Word, Excel...  │
│ content_full=✓  │ content_full=NULL    │
│ skip_postgres=F │ skip_postgres=T      │
└─────────────────┴──────────────────────┘
        ↓
Queue process_file_upload_document_task
        ↓
Chunk → Embed → Store based on skip_postgres_chunks
```

---

## Reindexing Architecture

### When to Reindex

- Chunking configuration changed
- Embedding model changed
- Vector store settings changed
- Content corruption recovery

### Reindex Flow

```
reindex_kb_task(kb_id, new_config)
        ↓
Get all documents for KB
        ↓
Delete all chunks from PostgreSQL
        ↓
Delete Qdrant collection
        ↓
Recreate Qdrant collection (with new config)
        ↓
For each document:
    ├── source_type == "file_upload"?
    │       ↓ YES
    │   SKIP (log warning)
    │       ↓
    └── NO: Re-chunk from content_full
            ↓
        Generate embeddings
            ↓
        Create PostgreSQL chunks
            ↓
        Index in Qdrant
        ↓
Update KB stats
```

### Reindex Limitations

| KB Type | Reindex Support | Notes |
|---------|-----------------|-------|
| Web URL KB (text only) | Full | All documents reindexed |
| Web URL KB (mixed) | Partial | File uploads skipped |
| File Upload KB | None | All documents skipped |

**Warning Message:**
```
⚠️ [REINDEX] {n} file upload document(s) skipped -
their content is stored in Qdrant only and cannot be
reindexed from PostgreSQL
```

### Alternative for File Upload KBs

If configuration changes are needed for File Upload KBs:

1. Export document metadata (optional)
2. Delete the KB
3. Create new KB with desired configuration
4. Re-upload files

---

## Frontend Integration

### Supported Formats by KB Type

**File:** `frontend/src/pages/knowledge-bases/documents.tsx`

```typescript
const getSupportedFormats = () => {
  if (isFileUploadOnlyKB()) {
    return {
      accept: '.pdf,.doc,.docx,.txt,.md,.csv,.json,.xlsx,.xls,.pptx,.ppt,.rtf,.odt,.html,.htm,.xml',
      description: 'PDF, Word, Excel, PowerPoint, Text, Markdown, CSV, JSON, and more',
      maxSize: '50MB'
    };
  }
  return {
    accept: '.txt,.md,.csv,.json',
    description: 'Text, Markdown, CSV, JSON',
    maxSize: '10MB'
  };
};
```

### KB Type Detection

```typescript
const isFileUploadOnlyKB = (): boolean => {
  if (!Array.isArray(documents) || documents.length === 0) return false;
  return documents.every((doc) => doc.source_type === 'file_upload');
};
```

### Edit Restrictions

```typescript
const canEditDocument = (doc: KBDocument): boolean => {
  if (doc.source_type === 'file_upload') return false;
  if (doc.processing_metadata?.chunk_storage_location === 'qdrant_only') return false;
  return true;
};
```

---

## File Format Support

### Web URL KBs (Simple Parsing)

| Format | Extension | Parser |
|--------|-----------|--------|
| Plain Text | .txt | UTF-8 decode |
| Markdown | .md | UTF-8 decode |
| JSON | .json | json.loads |
| CSV | .csv | csv.reader |

### File Upload KBs (Tika Parsing)

| Category | Extensions |
|----------|------------|
| Documents | .pdf, .doc, .docx, .rtf, .odt |
| Spreadsheets | .xlsx, .xls, .ods, .csv |
| Presentations | .pptx, .ppt, .odp |
| Text | .txt, .md, .json, .xml |
| Web | .html, .htm |
| Images (OCR) | .png, .jpg, .tiff |

---

## Best Practices

### 1. Choose the Right KB Type

| Use Case | Recommended KB Type |
|----------|-------------------|
| Documentation sites | Web URL KB |
| Internal documents (PDF, Word) | File Upload KB |
| Mixed content | Web URL KB (allows both) |
| Privacy-sensitive files | File Upload KB |

### 2. Configuration Planning

For **File Upload KBs**, plan configuration carefully before creation:
- Chunking strategy and size
- Embedding model
- Vector store settings

These cannot be changed via reindex.

### 3. Document Management

**Web URL KBs:**
- Edit documents as needed
- Reindex after configuration changes
- Mix text and file uploads freely

**File Upload KBs:**
- Upload all files at creation
- Cannot edit after processing
- Delete and re-upload if changes needed

### 4. Storage Considerations

| Concern | Recommendation |
|---------|---------------|
| PostgreSQL size | Use File Upload KB for large document sets |
| Search quality | Web URL KB (hybrid search) |
| Privacy | File Upload KB (no content in DB) |
| Flexibility | Web URL KB |

---

## API Reference

### Create Text Document

```http
POST /api/v1/kbs/{kb_id}/documents
Content-Type: application/json

{
    "name": "string",
    "content": "string (min 50 chars)",
    "source_type": "manual",
    "custom_metadata": {}
}
```

**Responses:**
- `201`: Document created, processing queued
- `400`: File upload KB (text not allowed)
- `413`: Content too large

### Upload File

```http
POST /api/v1/kbs/{kb_id}/documents/upload
Content-Type: multipart/form-data

file: binary
```

**Responses:**
- `201`: Document created, processing queued
- `400`: Unsupported format / Content too short
- `413`: File too large

### Trigger Reindex

```http
POST /api/v1/kbs/{kb_id}/reindex
Content-Type: application/json

{
    "chunking_config": {},
    "embedding_config": {},
    "vector_store_config": {}
}
```

**Responses:**
- `202`: Reindex queued
- `400`: KB not found

---

## Troubleshooting

### "Unregistered task" Error

**Symptom:** Celery reports `process_file_upload_document` not found

**Solution:** Restart Celery worker to pick up new task registration
```bash
docker compose -f docker-compose.dev.yml restart privexbot-celery-dev
```

### File Upload Rejected for Web URL KB

**Symptom:** 400 error with "Unsupported file format"

**Cause:** Web URL KBs only support .txt, .md, .json, .csv

**Solution:** Use File Upload KB for PDF/Word files, or convert to supported format

### Reindex Shows 0 Documents Processed

**Symptom:** Reindex completes but reports no documents processed

**Cause:** All documents are file uploads (content not in PostgreSQL)

**Solution:** This is expected behavior. File upload content is preserved in Qdrant.

---

## Changelog

| Date | Change |
|------|--------|
| 2024-12-18 | Fixed storage consistency for web URL KB file uploads |
| 2024-12-18 | Added Tika parsing for file upload KB additions |
| 2024-12-18 | Registered `process_file_upload_document_task` in Celery |
| 2024-12-18 | Added frontend format differentiation by KB type |
