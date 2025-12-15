"""
Knowledge Base Routes - API endpoints for production KB management.

WHY:
- CRUD operations for production knowledge bases
- Document management
- KB configuration
- Analytics and monitoring

HOW:
- FastAPI router
- PostgreSQL persistence
- Multi-tenant access control
- Background task queuing

NOTE: Draft creation is handled by kb_draft.py

PSEUDOCODE follows the existing codebase patterns.
"""

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID

from app.db.session import get_db
from app.api.v1.dependencies import get_current_user
from app.models.user import User
from app.models.knowledge_base import KnowledgeBase

router = APIRouter(prefix="/knowledge-bases", tags=["knowledge_bases"])


@router.get("/")
async def list_knowledge_bases(
    workspace_id: UUID,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List all knowledge bases in workspace.

    WHY: Display KBs in dashboard
    HOW: Query database with pagination

    RETURNS:
        {
            "items": [...],
            "total": 42,
            "skip": 0,
            "limit": 50
        }
    """

    from app.models.workspace import Workspace

    # Validate workspace access
    workspace = db.query(Workspace).filter(
        Workspace.id == workspace_id,
        Workspace.org_id == current_user.org_id
    ).first()

    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found"
        )

    # Get KBs
    query = db.query(KnowledgeBase).filter(
        KnowledgeBase.workspace_id == workspace_id,
        KnowledgeBase.is_deleted == False
    )

    total = query.count()
    kbs = query.offset(skip).limit(limit).all()

    return {
        "items": kbs,
        "total": total,
        "skip": skip,
        "limit": limit
    }


@router.get("/{kb_id}")
async def get_knowledge_base(
    kb_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get single KB by ID.

    WHY: View KB details
    HOW: Query database, verify access
    """

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

    return kb


@router.patch("/{kb_id}")
async def update_knowledge_base(
    kb_id: UUID,
    updates: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update KB configuration.

    WHY: Modify KB settings
    HOW: Update database

    BODY:
        {
            "name": "Updated Name",
            "description": "...",
            "config": {
                "chunking_config": {...}
            }
        }
    """

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

    # Update fields
    for key, value in updates.items():
        if hasattr(kb, key):
            setattr(kb, key, value)

    db.commit()
    db.refresh(kb)

    return kb


@router.delete("/{kb_id}")
async def delete_knowledge_base(
    kb_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete knowledge base.

    WHY: Remove KB and all documents
    HOW: Soft delete, cleanup vectors

    FLOW:
    1. Verify access
    2. Delete all vectors from vector store
    3. Soft delete KB (cascades to documents, chunks)
    """

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

    # TODO: Delete vectors from vector store

    # Soft delete
    kb.is_deleted = True
    db.commit()

    return {"status": "deleted"}


@router.post("/{kb_id}/query")
async def query_knowledge_base(
    kb_id: UUID,
    query: str,
    top_k: int = 5,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Query KB for testing.

    WHY: Test retrieval before using in chatbot
    HOW: Vector search, return results

    BODY:
        {
            "query": "How do I reset my password?",
            "top_k": 5
        }

    RETURNS:
        {
            "results": [
                {
                    "chunk_id": "uuid",
                    "content": "...",
                    "score": 0.95,
                    "metadata": {...}
                }
            ]
        }
    """

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

    # Query KB
    from app.services.retrieval_service import retrieval_service

    results = await retrieval_service.retrieve(
        db=db,
        kb_id=kb_id,
        query=query,
        top_k=top_k
    )

    return {"results": results}


@router.get("/{kb_id}/analytics")
async def get_kb_analytics(
    kb_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get KB analytics.

    WHY: Monitor KB usage
    HOW: Aggregate from usage logs

    RETURNS:
        {
            "total_documents": 50,
            "total_chunks": 1234,
            "total_queries": 5678,
            "avg_retrieval_score": 0.85,
            "storage_size_mb": 12.5
        }
    """

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

    # Get document and chunk counts
    from app.models.document import Document
    from app.models.chunk import Chunk

    total_documents = db.query(Document).filter(
        Document.kb_id == kb_id
    ).count()

    total_chunks = db.query(Chunk).filter(
        Chunk.kb_id == kb_id
    ).count()

    return {
        "total_documents": total_documents,
        "total_chunks": total_chunks,
        "total_queries": 0,  # TODO: Track queries
        "avg_retrieval_score": 0,
        "storage_size_mb": 0
    }


@router.post("/{kb_id}/documents/upload")
async def add_document_to_kb(
    kb_id: UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Add document to existing KB.

    WHY: Upload new document to production KB
    HOW: Create document, queue processing

    NOTE: For bulk uploads during KB creation, use kb_draft.py workflow

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
    from app.models.document import Document

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


@router.get("/{kb_id}/documents")
async def list_kb_documents(
    kb_id: UUID,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List all documents in KB.

    WHY: View KB contents
    HOW: Query documents table

    RETURNS:
        {
            "items": [...],
            "total": 50
        }
    """

    # Verify KB access
    kb = db.query(KnowledgeBase).filter(
        KnowledgeBase.id == kb_id
    ).first()

    if not kb:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Knowledge base not found"
        )

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
    from app.models.document import Document

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
