# Knowledge Base Draft Mode Architecture

**CRITICAL: All KB creation happens in DRAFT mode BEFORE database save**

---

## Overview

### The Correct Flow

**IMPORTANT:** The KB creation process follows a **draft-first** approach:

```
1. START → Create Draft (in-memory/temp storage)
2. Add Sources → Files, websites, Notion, etc. (NOT saved to DB)
3. Configure → Chunking, indexing, annotations (NOT saved to DB)
4. Preview → See all chunks from all sources (NOT saved to DB)
5. Edit → Add/remove sources, change settings (NOT saved to DB)
6. FINALIZE → ONLY NOW save to database + trigger background processing
```

**WHY this approach:**

- ✅ Users can experiment without polluting database
- ✅ Preview everything before committing
- ✅ Edit and combine sources freely
- ✅ No orphaned records if user abandons creation
- ✅ Faster UX (no DB writes until finalize)
- ✅ Easier rollback (just discard draft)

---

## Architecture Components

### 1. Draft Storage (Temporary)

**WHERE:** Redis or in-memory cache (NOT PostgreSQL)

**WHY:**

- Fast read/write
- Automatic expiration
- No DB pollution
- Easy to discard

**STRUCTURE:**

```python
# Redis key structure
draft:{draft_id} = {
    "name": "Product Knowledge Base",
    "description": "Combined product docs",
    "workspace_id": "uuid",
    "embedding_config": {...},
    "vector_store_config": {...},

    # Sources (NOT yet documents)
    "sources": [
        {
            "id": "temp_source_1",
            "type": "file_upload",
            "status": "parsed",  # parsed, pending, error
            "temp_file_path": "/tmp/uploads/file_abc123.pdf",
            "content": "extracted text...",
            "name": "Product Manual.pdf",
            "metadata": {...},
            "chunking_config": {...},
            "annotations": {...}
        },
        {
            "id": "temp_source_2",
            "type": "website",
            "status": "crawled",
            "url": "https://example.com/docs",
            "pages": [
                {"url": "...", "content": "..."},
                {"url": "...", "content": "..."}
            ],
            "chunking_config": {...},
            "annotations": {...}
        },
        {
            "id": "temp_source_3",
            "type": "notion",
            "notion_page_id": "page_123",
            "content": "...",
            "annotations": {...}
        }
    ],

    # Generated chunks (for preview)
    "chunks_preview": [
        {
            "source_id": "temp_source_1",
            "content": "chunk text...",
            "position": 0,
            "metadata": {...}
        },
        // ... up to 100-200 chunks for preview
    ],

    "created_at": "2025-01-10T10:00:00Z",
    "expires_at": "2025-01-10T22:00:00Z"  # 12 hour expiry
}
```

---

### 2. KB Draft Service

**File:** `backend/src/app/services/kb_draft_service.py`

```python
import redis
import json
from datetime import datetime, timedelta
from uuid import uuid4

class KBDraftService:
    """
    Manage KB drafts (before database save).

    WHY: Keep everything in temp storage until finalize
    HOW: Use Redis for fast, expiring storage
    """

    def __init__(self):
        self.redis_client = redis.Redis(
            host='localhost',
            port=6379,
            db=1,  # Separate DB for drafts
            decode_responses=True
        )
        self.draft_ttl = 12 * 60 * 60  # 12 hours

    def create_draft(self, workspace_id: str, kb_data: dict) -> str:
        """
        Create new KB draft.

        WHY: Start draft creation process
        HOW: Generate draft ID, store in Redis

        RETURNS: draft_id
        """

        draft_id = str(uuid4())

        draft = {
            "id": draft_id,
            "workspace_id": workspace_id,
            "name": kb_data.get("name"),
            "description": kb_data.get("description"),
            "embedding_config": kb_data.get("embedding_config"),
            "vector_store_config": kb_data.get("vector_store_config"),
            "context_settings": kb_data.get("context_settings", {}),
            "sources": [],
            "chunks_preview": [],
            "created_at": datetime.utcnow().isoformat(),
            "expires_at": (datetime.utcnow() + timedelta(seconds=self.draft_ttl)).isoformat()
        }

        # Store in Redis with expiration
        self.redis_client.setex(
            f"draft:{draft_id}",
            self.draft_ttl,
            json.dumps(draft)
        )

        return draft_id

    def get_draft(self, draft_id: str) -> dict | None:
        """Get draft by ID."""

        data = self.redis_client.get(f"draft:{draft_id}")
        if not data:
            return None

        return json.loads(data)

    def update_draft(self, draft_id: str, updates: dict):
        """
        Update draft with new data.

        WHY: User is editing draft (add sources, change settings)
        HOW: Update Redis entry, extend TTL
        """

        draft = self.get_draft(draft_id)
        if not draft:
            raise ValueError("Draft not found or expired")

        # Update fields
        draft.update(updates)

        # Save back with extended TTL
        self.redis_client.setex(
            f"draft:{draft_id}",
            self.draft_ttl,
            json.dumps(draft)
        )

    def add_source(self, draft_id: str, source_data: dict) -> str:
        """
        Add source to draft.

        WHY: User is adding a file, website, etc.
        HOW: Generate temp source ID, add to sources list

        FLOW:
        1. Generate temp source ID
        2. Parse content (if file)
        3. Add to draft sources
        4. Regenerate chunk preview

        RETURNS: source_id
        """

        draft = self.get_draft(draft_id)
        if not draft:
            raise ValueError("Draft not found")

        # Generate temp source ID
        source_id = f"temp_source_{uuid4().hex[:8]}"

        source = {
            "id": source_id,
            "type": source_data["type"],
            "status": "pending",
            "added_at": datetime.utcnow().isoformat(),
            **source_data
        }

        draft["sources"].append(source)

        # Save
        self.update_draft(draft_id, {"sources": draft["sources"]})

        return source_id

    def remove_source(self, draft_id: str, source_id: str):
        """
        Remove source from draft.

        WHY: User wants to remove a source
        HOW: Filter out source, regenerate preview
        """

        draft = self.get_draft(draft_id)
        if not draft:
            raise ValueError("Draft not found")

        draft["sources"] = [s for s in draft["sources"] if s["id"] != source_id]

        # Regenerate chunk preview
        chunks_preview = self._generate_chunks_preview(draft)

        self.update_draft(draft_id, {
            "sources": draft["sources"],
            "chunks_preview": chunks_preview
        })

    def _generate_chunks_preview(self, draft: dict) -> list:
        """
        Generate chunk preview from all sources.

        WHY: Show user what chunks will be created
        HOW: Chunk all source content, return first 100-200 chunks

        NOTE: This is PREVIEW only - actual chunking happens after finalize
        """

        from app.services.chunking_service import ChunkingService

        chunker = ChunkingService()
        all_chunks = []

        for source in draft["sources"]:
            # Get chunking config (source-level or draft-level)
            chunking_config = source.get("chunking_config") or \
                              draft.get("default_chunking_config") or \
                              {"strategy": "size_based", "max_characters": 1000, "overlap": 200}

            # Chunk source content
            content = source.get("content", "")
            if not content:
                continue

            chunks = chunker.chunk_text(
                content=content,
                config=chunking_config
            )

            # Add source reference to each chunk
            for i, chunk in enumerate(chunks):
                all_chunks.append({
                    "source_id": source["id"],
                    "source_name": source.get("name", "Unnamed"),
                    "source_type": source["type"],
                    "content": chunk["content"],
                    "position": i,
                    "metadata": chunk.get("metadata", {})
                })

        # Return first 200 chunks for preview
        return all_chunks[:200]

    def regenerate_preview(self, draft_id: str):
        """
        Regenerate chunk preview.

        WHY: User changed chunking settings or added/removed sources
        HOW: Re-chunk all sources, update preview
        """

        draft = self.get_draft(draft_id)
        if not draft:
            raise ValueError("Draft not found")

        chunks_preview = self._generate_chunks_preview(draft)

        self.update_draft(draft_id, {"chunks_preview": chunks_preview})

        return chunks_preview

    def finalize_draft(self, draft_id: str, db) -> str:
        """
        Finalize draft → Save to database → Trigger background processing.

        WHY: User is happy with preview, ready to create KB
        HOW:
        1. Create KB record in database
        2. Create document records for each source
        3. Move temp files to permanent storage
        4. Queue background processing tasks
        5. Delete draft from Redis

        RETURNS: kb_id (UUID from database)
        """

        from app.models.knowledge_base import KnowledgeBase
        from app.models.document import Document
        from app.tasks.document_tasks import process_document
        import shutil
        import os

        draft = self.get_draft(draft_id)
        if not draft:
            raise ValueError("Draft not found or expired")

        # 1. Create KB in database
        kb = KnowledgeBase(
            workspace_id=draft["workspace_id"],
            name=draft["name"],
            description=draft.get("description"),
            embedding_config=draft["embedding_config"],
            vector_store_config=draft["vector_store_config"],
            context_settings=draft.get("context_settings", {}),
            created_by=draft.get("created_by")
        )

        db.add(kb)
        db.flush()  # Get KB ID

        # 2. Create document records for each source
        document_ids = []

        for source in draft["sources"]:
            # Move temp file to permanent storage (if file upload)
            file_path = None
            if source["type"] == "file_upload" and source.get("temp_file_path"):
                # Move from /tmp to permanent storage
                permanent_dir = f"/storage/kb_{kb.id}/documents"
                os.makedirs(permanent_dir, exist_ok=True)

                filename = os.path.basename(source["temp_file_path"])
                file_path = f"{permanent_dir}/{filename}"

                shutil.move(source["temp_file_path"], file_path)

            # Create document
            document = Document(
                knowledge_base_id=kb.id,
                name=source.get("name"),
                source_type=source["type"],
                source_url=source.get("url") or source.get("source_url"),
                source_metadata=source.get("metadata", {}),
                file_path=file_path,
                content=source.get("content"),  # Store content temporarily
                chunking_config=source.get("chunking_config"),
                annotations=source.get("annotations"),
                status="pending",
                created_by=draft.get("created_by")
            )

            db.add(document)
            db.flush()  # Get document ID

            document_ids.append(str(document.id))

        db.commit()

        # 3. Initialize vector store collection
        from app.services.vector_store_service import VectorStoreService
        vector_store_service = VectorStoreService()
        vector_store_service.create_collection(kb)

        # 4. Queue background processing for each document
        for doc_id in document_ids:
            process_document.delay(doc_id)

        # 5. Delete draft from Redis
        self.redis_client.delete(f"draft:{draft_id}")

        return str(kb.id)
```

---

### 3. API Endpoints (Draft Mode)

```python
# backend/src/app/api/v1/routes/kb_draft.py

from fastapi import APIRouter, Depends, UploadFile, File
from app.services.kb_draft_service import KBDraftService
from app.models.user import User
from app.api.dependencies import get_current_user

router = APIRouter()
kb_draft_service = KBDraftService()


@router.post("/kb/draft")
def create_kb_draft(
    kb_data: dict,
    current_user: User = Depends(get_current_user)
):
    """
    Create new KB draft.

    WHY: Start KB creation in draft mode
    HOW: Store in Redis (NOT database)

    FLOW:
    1. User clicks "Create Knowledge Base"
    2. Frontend calls this endpoint
    3. Draft created in Redis
    4. Returns draft_id for subsequent operations
    """

    draft_id = kb_draft_service.create_draft(
        workspace_id=current_user.workspace_id,
        kb_data={
            **kb_data,
            "created_by": str(current_user.id)
        }
    )

    return {"draft_id": draft_id, "status": "draft"}


@router.get("/kb/draft/{draft_id}")
def get_kb_draft(
    draft_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Get KB draft.

    WHY: Fetch current draft state
    HOW: Retrieve from Redis
    """

    draft = kb_draft_service.get_draft(draft_id)

    if not draft:
        raise HTTPException(404, "Draft not found or expired")

    # Verify workspace access
    if draft["workspace_id"] != str(current_user.workspace_id):
        raise HTTPException(403, "Access denied")

    return draft


@router.post("/kb/draft/{draft_id}/sources/upload")
async def add_file_source(
    draft_id: str,
    file: UploadFile = File(...),
    chunking_config: dict | None = None,
    annotations: dict | None = None,
    current_user: User = Depends(get_current_user)
):
    """
    Add file upload source to draft.

    WHY: User uploads PDF, Word, etc.
    HOW:
    1. Save file to /tmp (temporary)
    2. Parse/extract text
    3. Add to draft sources
    4. Regenerate preview

    NOTE: File NOT moved to permanent storage until finalize
    """

    import tempfile
    from app.integrations.unstructured_adapter import parse_document

    # Save to temp location
    temp_dir = tempfile.gettempdir()
    temp_path = f"{temp_dir}/draft_{draft_id}_{file.filename}"

    with open(temp_path, "wb") as f:
        f.write(await file.read())

    # Parse document
    content = parse_document(temp_path, file.content_type)

    # Add source to draft
    source_id = kb_draft_service.add_source(draft_id, {
        "type": "file_upload",
        "name": file.filename,
        "temp_file_path": temp_path,
        "content": content,
        "metadata": {
            "filename": file.filename,
            "size": file.size,
            "mime_type": file.content_type
        },
        "chunking_config": chunking_config,
        "annotations": annotations,
        "status": "parsed"
    })

    # Regenerate preview
    kb_draft_service.regenerate_preview(draft_id)

    return {"source_id": source_id, "status": "parsed"}


@router.post("/kb/draft/{draft_id}/sources/website")
async def add_website_source(
    draft_id: str,
    url: str,
    crawl_config: dict,
    chunking_config: dict | None = None,
    annotations: dict | None = None,
    current_user: User = Depends(get_current_user)
):
    """
    Add website source to draft.

    WHY: User wants to scrape website
    HOW:
    1. Crawl website (Crawl4AI)
    2. Store pages in draft
    3. Regenerate preview

    NOTE: This is SYNCHRONOUS for small sites or ASYNC for large sites
    """

    from app.integrations.crawl4ai_adapter import crawl_website

    # Crawl website
    pages = await crawl_website(url, crawl_config)

    # Combine all page content
    combined_content = "\n\n".join([
        f"=== {page['title']} ===\n{page['content']}"
        for page in pages
    ])

    # Add source
    source_id = kb_draft_service.add_source(draft_id, {
        "type": "website",
        "name": f"Website: {url}",
        "url": url,
        "content": combined_content,
        "metadata": {
            "pages_crawled": len(pages),
            "crawl_config": crawl_config
        },
        "chunking_config": chunking_config,
        "annotations": annotations,
        "status": "crawled"
    })

    # Regenerate preview
    kb_draft_service.regenerate_preview(draft_id)

    return {"source_id": source_id, "pages_crawled": len(pages)}


@router.post("/kb/draft/{draft_id}/sources/text")
def add_text_source(
    draft_id: str,
    name: str,
    content: str,
    format: str = "text",
    chunking_config: dict | None = None,
    annotations: dict | None = None,
    current_user: User = Depends(get_current_user)
):
    """
    Add direct text paste source.

    WHY: User pastes text/markdown/JSON
    HOW: Add directly to draft
    """

    source_id = kb_draft_service.add_source(draft_id, {
        "type": "text_input",
        "name": name,
        "content": content,
        "metadata": {"format": format},
        "chunking_config": chunking_config,
        "annotations": annotations,
        "status": "ready"
    })

    # Regenerate preview
    kb_draft_service.regenerate_preview(draft_id)

    return {"source_id": source_id}


@router.delete("/kb/draft/{draft_id}/sources/{source_id}")
def remove_source(
    draft_id: str,
    source_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Remove source from draft.

    WHY: User wants to remove a source
    HOW: Remove from draft, regenerate preview
    """

    kb_draft_service.remove_source(draft_id, source_id)

    return {"status": "removed"}


@router.patch("/kb/draft/{draft_id}/sources/{source_id}")
def update_source(
    draft_id: str,
    source_id: str,
    updates: dict,
    current_user: User = Depends(get_current_user)
):
    """
    Update source (chunking config, annotations, etc.).

    WHY: User wants to change settings for a source
    HOW: Update draft, regenerate preview
    """

    draft = kb_draft_service.get_draft(draft_id)

    # Find and update source
    for source in draft["sources"]:
        if source["id"] == source_id:
            source.update(updates)
            break

    # Save
    kb_draft_service.update_draft(draft_id, {"sources": draft["sources"]})

    # Regenerate preview
    kb_draft_service.regenerate_preview(draft_id)

    return {"status": "updated"}


@router.get("/kb/draft/{draft_id}/preview")
def preview_chunks(
    draft_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Preview chunks from all sources.

    WHY: Show user what chunks will be created
    HOW: Return chunk preview from draft

    NOTE: This is PREVIEW only - actual chunks created after finalize
    """

    draft = kb_draft_service.get_draft(draft_id)

    if not draft:
        raise HTTPException(404, "Draft not found")

    return {
        "draft_id": draft_id,
        "sources": draft["sources"],
        "chunks_preview": draft["chunks_preview"],
        "total_chunks_estimated": len(draft["chunks_preview"]),
        "status": "preview"
    }


@router.post("/kb/draft/{draft_id}/finalize")
def finalize_kb(
    draft_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Finalize draft → Save to database → Process in background.

    WHY: User is satisfied with preview
    HOW:
    1. Create KB in database
    2. Create documents for each source
    3. Move temp files to permanent storage
    4. Queue background processing
    5. Delete draft from Redis

    RETURNS: kb_id (final database ID)
    """

    kb_id = kb_draft_service.finalize_draft(draft_id, db)

    return {
        "kb_id": kb_id,
        "status": "processing",
        "message": "Knowledge base created. Documents are being processed in the background."
    }
```

---

### 4. Frontend Flow (Draft Mode)

```javascript
// frontend/src/pages/KBCreationWizard.jsx

function KBCreationWizard() {
  const [step, setStep] = useState(1);
  const [draftId, setDraftId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [chunksPreview, setChunksPreview] = useState([]);

  // Step 1: Create draft
  const createDraft = async (kbData) => {
    const response = await fetch("/api/v1/kb/draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(kbData),
    });

    const data = await response.json();
    setDraftId(data.draft_id);
    setStep(2);
  };

  // Step 2: Add sources
  const addFileSource = async (file) => {
    const formData = new FormData();
    formData.append("file", file);

    await fetch(`/api/v1/kb/draft/${draftId}/sources/upload`, {
      method: "POST",
      body: formData,
    });

    // Refresh draft
    await refreshDraft();
  };

  const addWebsiteSource = async (url, crawlConfig) => {
    await fetch(`/api/v1/kb/draft/${draftId}/sources/website`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, crawl_config: crawlConfig }),
    });

    await refreshDraft();
  };

  // Refresh draft state
  const refreshDraft = async () => {
    const response = await fetch(`/api/v1/kb/draft/${draftId}`);
    const data = await response.json();
    setDraft(data);
  };

  // Step 3: Preview chunks
  const previewChunks = async () => {
    const response = await fetch(`/api/v1/kb/draft/${draftId}/preview`);
    const data = await response.json();
    setChunksPreview(data.chunks_preview);
    setStep(3);
  };

  // Step 4: Finalize
  const finalize = async () => {
    const response = await fetch(`/api/v1/kb/draft/${draftId}/finalize`, {
      method: "POST",
    });

    const data = await response.json();

    // Navigate to KB detail page
    navigate(`/kb/${data.kb_id}`);
  };

  return (
    <div>
      {step === 1 && <KBBasicInfoForm onSubmit={createDraft} />}

      {step === 2 && (
        <SourcesManager
          draftId={draftId}
          sources={draft?.sources || []}
          onAddFile={addFileSource}
          onAddWebsite={addWebsiteSource}
          onNext={previewChunks}
        />
      )}

      {step === 3 && (
        <ChunkPreviewPanel
          chunks={chunksPreview}
          onBack={() => setStep(2)}
          onFinalize={finalize}
        />
      )}
    </div>
  );
}
```

---

## Summary

### The CORRECT Flow (Draft Mode)

**1. Create Draft (in-memory):**

```
POST /api/v1/kb/draft
→ Returns: draft_id
→ Stored in: Redis
```

**2. Add Sources (temp storage):**

```
POST /api/v1/kb/draft/{draft_id}/sources/upload
POST /api/v1/kb/draft/{draft_id}/sources/website
POST /api/v1/kb/draft/{draft_id}/sources/text
→ Files saved to: /tmp
→ Content stored in: Redis
→ Auto-regenerates chunk preview
```

**3. Edit Sources:**

```
PATCH /api/v1/kb/draft/{draft_id}/sources/{source_id}
DELETE /api/v1/kb/draft/{draft_id}/sources/{source_id}
→ Updated in: Redis
→ Preview regenerated
```

**4. Preview Chunks:**

```
GET /api/v1/kb/draft/{draft_id}/preview
→ Returns: 100-200 chunk preview
→ From: Redis (not DB)
```

**5. Finalize (save to DB):**

```
POST /api/v1/kb/draft/{draft_id}/finalize
→ Creates: KB in PostgreSQL
→ Creates: Document records in PostgreSQL
→ Moves: Temp files to permanent storage
→ Queues: Background processing tasks
→ Deletes: Draft from Redis
→ Returns: kb_id (final database ID)
```

**AFTER finalize:**

- Celery workers process documents
- Parse → Chunk → Embed → Index
- All happens in background

This architecture keeps the database clean, provides instant preview, and only commits when the user is ready.
