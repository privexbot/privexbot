"""
Document Routes - API endpoints for document management.

WHY:
- Document CRUD operations
- Upload and processing
- Status monitoring
- Reindexing

HOW:
- FastAPI router
- File upload handling
- Celery task management
- Multi-tenant access control
"""

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session
from typing import List, Optional, Literal
from uuid import UUID
import json
from datetime import datetime

from app.db.session import get_db
from app.api.v1.dependencies import get_current_user
from app.models.user import User
from app.models.document import Document
from app.models.knowledge_base import KnowledgeBase

router = APIRouter(prefix="/documents", tags=["documents"])


@router.post("/")
async def upload_document(
    kb_id: UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Upload document to KB.

    WHY: Add new document to existing KB
    HOW: Save file, create document, queue processing

    RETURNS:
        {
            "document_id": "uuid",
            "filename": "guide.pdf",
            "status": "pending"
        }
    """

    # Get KB and verify access
    kb = db.query(KnowledgeBase).filter(
        KnowledgeBase.id == kb_id
    ).first()

    if not kb:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Knowledge base not found"
        )

    # Verify access
    from app.models.workspace import Workspace
    workspace = db.query(Workspace).filter(
        Workspace.id == kb.workspace_id,
        Workspace.org_id == current_user.org_id
    ).first()

    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    # Read file content
    content = await file.read()

    # Parse document
    from app.services.document_processing_service import document_processing_service

    parsed = await document_processing_service.parse_document(
        content=content,
        filename=file.filename,
        content_type=file.content_type
    )

    # Create document
    document = Document(
        kb_id=kb_id,
        source_type="upload",
        source_url=None,
        content=parsed["content"],
        title=parsed.get("title", file.filename),
        metadata={
            "filename": file.filename,
            "content_type": file.content_type,
            "file_size": len(content),
            "page_count": parsed.get("page_count"),
            "uploaded_by": str(current_user.id)
        },
        status="pending"
    )

    db.add(document)
    db.commit()
    db.refresh(document)

    # Queue for processing
    from app.tasks.document_tasks import process_document_task
    process_document_task.delay(
        document_id=str(document.id),
        kb_id=str(kb_id)
    )

    return {
        "document_id": str(document.id),
        "filename": file.filename,
        "status": "pending"
    }


@router.get("/")
async def list_documents(
    kb_id: UUID,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List all documents in KB.

    WHY: Display documents in dashboard
    HOW: Query database with pagination

    RETURNS:
        {
            "items": [...],
            "total": 42,
            "skip": 0,
            "limit": 50
        }
    """

    # Get KB and verify access
    kb = db.query(KnowledgeBase).filter(
        KnowledgeBase.id == kb_id
    ).first()

    if not kb:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Knowledge base not found"
        )

    # Verify access
    from app.models.workspace import Workspace
    workspace = db.query(Workspace).filter(
        Workspace.id == kb.workspace_id,
        Workspace.org_id == current_user.org_id
    ).first()

    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    # Get documents
    query = db.query(Document).filter(
        Document.kb_id == kb_id
    )

    total = query.count()
    documents = query.offset(skip).limit(limit).all()

    return {
        "items": documents,
        "total": total,
        "skip": skip,
        "limit": limit
    }


@router.get("/{document_id}")
async def get_document(
    document_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get single document by ID.

    WHY: View document details
    HOW: Query database, verify access
    """

    document = db.query(Document).filter(
        Document.id == document_id
    ).first()

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )

    # Verify access through KB
    kb = db.query(KnowledgeBase).filter(
        KnowledgeBase.id == document.kb_id
    ).first()

    from app.models.workspace import Workspace
    workspace = db.query(Workspace).filter(
        Workspace.id == kb.workspace_id,
        Workspace.org_id == current_user.org_id
    ).first()

    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    return document


@router.patch("/{document_id}")
async def update_document(
    document_id: UUID,
    updates: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update document metadata.

    WHY: Modify document details
    HOW: Update database

    BODY:
        {
            "title": "Updated Title",
            "metadata": {...}
        }
    """

    document = db.query(Document).filter(
        Document.id == document_id
    ).first()

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )

    # Verify access
    kb = db.query(KnowledgeBase).filter(
        KnowledgeBase.id == document.kb_id
    ).first()

    from app.models.workspace import Workspace
    workspace = db.query(Workspace).filter(
        Workspace.id == kb.workspace_id,
        Workspace.org_id == current_user.org_id
    ).first()

    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    # Update fields (prevent updating content directly)
    allowed_fields = ["title", "metadata"]
    for key, value in updates.items():
        if key in allowed_fields and hasattr(document, key):
            setattr(document, key, value)

    db.commit()
    db.refresh(document)

    return document


@router.delete("/{document_id}")
async def delete_document(
    document_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete document.

    WHY: Remove document from KB
    HOW: Queue deletion task (cleanup vectors, chunks)

    FLOW:
    1. Verify access
    2. Queue deletion task
    3. Task deletes vectors, chunks, document
    """

    document = db.query(Document).filter(
        Document.id == document_id
    ).first()

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )

    # Verify access
    kb = db.query(KnowledgeBase).filter(
        KnowledgeBase.id == document.kb_id
    ).first()

    from app.models.workspace import Workspace
    workspace = db.query(Workspace).filter(
        Workspace.id == kb.workspace_id,
        Workspace.org_id == current_user.org_id
    ).first()

    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    # Queue deletion task
    from app.tasks.document_tasks import delete_document_task
    delete_document_task.delay(
        document_id=str(document_id)
    )

    return {"status": "deleting"}


@router.post("/{document_id}/reindex")
async def reindex_document(
    document_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Reindex document.

    WHY: Update embeddings after config changes
    HOW: Queue reindexing task

    FLOW:
    1. Verify access
    2. Queue reindexing task
    3. Task deletes old chunks/vectors, creates new ones
    """

    document = db.query(Document).filter(
        Document.id == document_id
    ).first()

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )

    # Verify access
    kb = db.query(KnowledgeBase).filter(
        KnowledgeBase.id == document.kb_id
    ).first()

    from app.models.workspace import Workspace
    workspace = db.query(Workspace).filter(
        Workspace.id == kb.workspace_id,
        Workspace.org_id == current_user.org_id
    ).first()

    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    # Queue reindexing task
    from app.tasks.document_tasks import reindex_document_task
    reindex_document_task.delay(
        document_id=str(document_id)
    )

    return {"status": "reindexing"}


@router.get("/{document_id}/chunks")
async def get_document_chunks(
    document_id: UUID,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all chunks for document.

    WHY: View/debug document chunks
    HOW: Query chunks table

    RETURNS:
        {
            "items": [...],
            "total": 25,
            "skip": 0,
            "limit": 50
        }
    """

    document = db.query(Document).filter(
        Document.id == document_id
    ).first()

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )

    # Verify access
    kb = db.query(KnowledgeBase).filter(
        KnowledgeBase.id == document.kb_id
    ).first()

    from app.models.workspace import Workspace
    workspace = db.query(Workspace).filter(
        Workspace.id == kb.workspace_id,
        Workspace.org_id == current_user.org_id
    ).first()

    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    # Get chunks
    from app.models.chunk import Chunk

    query = db.query(Chunk).filter(
        Chunk.document_id == document_id
    )

    total = query.count()
    chunks = query.offset(skip).limit(limit).all()

    return {
        "items": chunks,
        "total": total,
        "skip": skip,
        "limit": limit
    }


@router.get("/{document_id}/status")
async def get_document_status(
    document_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get document processing status.

    WHY: Monitor processing progress
    HOW: Return status and metadata

    RETURNS:
        {
            "status": "indexed",
            "chunks_created": 25,
            "error": null,
            "processing_time_ms": 1234
        }
    """

    document = db.query(Document).filter(
        Document.id == document_id
    ).first()

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )

    # Verify access
    kb = db.query(KnowledgeBase).filter(
        KnowledgeBase.id == document.kb_id
    ).first()

    from app.models.workspace import Workspace
    workspace = db.query(Workspace).filter(
        Workspace.id == kb.workspace_id,
        Workspace.org_id == current_user.org_id
    ).first()

    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    # Get chunk count
    from app.models.chunk import Chunk
    chunks_created = db.query(Chunk).filter(
        Chunk.document_id == document_id
    ).count()

    return {
        "status": document.status,
        "chunks_created": chunks_created,
        "error": document.metadata.get("error"),
        "processing_time_ms": document.metadata.get("processing_time_ms")
    }


@router.get("/{document_id}/download")
async def download_document(
    document_id: UUID,
    format: Literal["txt", "md", "json"] = Query("txt", description="Download format: txt, md (markdown), or json"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Download document content in specified format.

    WHY: Export document for backup or external use
    HOW: Return content with appropriate Content-Type headers

    FORMATS:
    - txt: Plain text content
    - md: Markdown with title and metadata
    - json: Structured JSON with all fields
    """

    document = db.query(Document).filter(
        Document.id == document_id
    ).first()

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )

    # Verify access through KB
    kb = db.query(KnowledgeBase).filter(
        KnowledgeBase.id == document.kb_id
    ).first()

    from app.models.workspace import Workspace
    workspace = db.query(Workspace).filter(
        Workspace.id == kb.workspace_id,
        Workspace.org_id == current_user.org_id
    ).first()

    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    # Get document content
    # Priority: content_full > reconstructed from chunks (skip content_preview - it's truncated)
    content = document.content_full

    if not content:
        # Reconstruct from chunks
        from app.models.chunk import Chunk
        chunks = db.query(Chunk).filter(
            Chunk.document_id == document_id
        ).order_by(Chunk.chunk_index).all()

        if chunks:
            content = "\n\n".join([c.content for c in chunks if c.content])
        else:
            content = "No content available for this document."

    # Generate safe filename
    safe_name = "".join(c for c in document.name if c.isalnum() or c in "._- ").strip()
    if not safe_name:
        safe_name = f"document_{document_id}"

    # Format content based on requested format
    if format == "txt":
        # Plain text
        output = content
        content_type = "text/plain; charset=utf-8"
        filename = f"{safe_name}.txt"

    elif format == "md":
        # Markdown with metadata header
        output = f"""# {document.name}

**Source Type:** {document.source_type}
**Status:** {document.status}
**Created:** {document.created_at.isoformat() if document.created_at else 'N/A'}
**Word Count:** {document.word_count or 0}
**Chunks:** {document.chunk_count or 0}

---

{content}
"""
        content_type = "text/markdown; charset=utf-8"
        filename = f"{safe_name}.md"

    else:  # json
        # Structured JSON
        output_data = {
            "id": str(document.id),
            "name": document.name,
            "source_type": document.source_type,
            "source_url": document.source_url,
            "status": document.status,
            "content": content,
            "word_count": document.word_count or 0,
            "character_count": document.character_count or 0,
            "chunk_count": document.chunk_count or 0,
            "created_at": document.created_at.isoformat() if document.created_at else None,
            "updated_at": document.updated_at.isoformat() if document.updated_at else None,
            "source_metadata": document.source_metadata or {},
            "custom_metadata": document.custom_metadata or {},
        }
        output = json.dumps(output_data, indent=2, ensure_ascii=False)
        content_type = "application/json; charset=utf-8"
        filename = f"{safe_name}.json"

    return Response(
        content=output,
        media_type=content_type,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )
