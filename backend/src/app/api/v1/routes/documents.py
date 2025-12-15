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

PSEUDOCODE follows the existing codebase patterns.
"""

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID

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
