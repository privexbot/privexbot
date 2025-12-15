"""
Chatflow Routes - API endpoints for chatflow management.

WHY:
- CRUD operations for chatflows
- Draft management
- Deployment configuration
- Testing and analytics

HOW:
- FastAPI router
- Draft-first architecture
- Multi-tenant access control
- Service layer delegation

PSEUDOCODE follows the existing codebase patterns.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID

from app.db.session import get_db
from app.api.v1.dependencies import get_current_user
from app.models.user import User
from app.models.chatflow import Chatflow
from app.services.draft_service import draft_service
from app.services.chatflow_service import chatflow_service

router = APIRouter(prefix="/chatflows", tags=["chatflows"])


@router.post("/drafts")
async def create_chatflow_draft(
    workspace_id: UUID,
    initial_data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create new chatflow draft.

    WHY: Start chatflow creation in draft mode
    HOW: Use draft service, store in Redis

    FLOW:
    1. Validate workspace access
    2. Create draft in Redis
    3. Return draft_id

    BODY:
        {
            "name": "Customer Support Flow",
            "description": "...",
            "nodes": [],
            "edges": []
        }

    RETURNS:
        {
            "draft_id": "draft_chatflow_abc123",
            "expires_at": "2025-10-01T12:00:00Z"
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

    # Create draft
    draft_id = draft_service.create_draft(
        draft_type="chatflow",
        workspace_id=workspace_id,
        created_by=current_user.id,
        initial_data=initial_data
    )

    draft = draft_service.get_draft(draft_id)

    return {
        "draft_id": draft_id,
        "expires_at": draft["expires_at"]
    }


@router.get("/drafts/{draft_id}")
async def get_chatflow_draft(
    draft_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get chatflow draft.

    WHY: Retrieve draft for editing
    HOW: Get from Redis

    RETURNS:
        {
            "id": "draft_chatflow_abc123",
            "type": "chatflow",
            "status": "draft",
            "data": {...},
            "expires_at": "..."
        }
    """

    draft = draft_service.get_draft(draft_id)

    if not draft:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Draft not found or expired"
        )

    # Verify access
    from app.models.workspace import Workspace
    workspace = db.query(Workspace).filter(
        Workspace.id == UUID(draft["workspace_id"]),
        Workspace.org_id == current_user.org_id
    ).first()

    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    return draft


@router.patch("/drafts/{draft_id}")
async def update_chatflow_draft(
    draft_id: str,
    updates: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update chatflow draft.

    WHY: Save changes during editing
    HOW: Update in Redis

    BODY:
        {
            "nodes": [...],
            "edges": [...],
            "name": "Updated Name"
        }
    """

    draft = draft_service.get_draft(draft_id)

    if not draft:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Draft not found"
        )

    # Update draft
    draft_service.update_draft(draft_id, updates)

    return {"status": "updated"}


@router.post("/drafts/{draft_id}/finalize")
async def finalize_chatflow_draft(
    draft_id: str,
    deployment_config: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Finalize chatflow draft and deploy.

    WHY: Convert draft to production chatflow
    HOW: Validate, save to DB, deploy to channels

    BODY:
        {
            "channels": ["website", "telegram"],
            "telegram_bot_token": "...",
            "allowed_domains": ["example.com"]
        }

    RETURNS:
        {
            "chatflow_id": "uuid",
            "channels": {
                "website": {"status": "success", "embed_code": "..."},
                "telegram": {"status": "success", "webhook_url": "..."}
            }
        }
    """

    # Finalize draft
    result = await draft_service.finalize_draft(
        db=db,
        draft_id=draft_id,
        finalized_by=current_user.id,
        deployment_config=deployment_config
    )

    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.get("errors", ["Finalization failed"])
        )

    return result


@router.get("/")
async def list_chatflows(
    workspace_id: UUID,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List all chatflows in workspace.

    WHY: Display chatflows in dashboard
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

    # Get chatflows
    query = db.query(Chatflow).filter(
        Chatflow.workspace_id == workspace_id
    )

    total = query.count()
    chatflows = query.offset(skip).limit(limit).all()

    return {
        "items": chatflows,
        "total": total,
        "skip": skip,
        "limit": limit
    }


@router.get("/{chatflow_id}")
async def get_chatflow(
    chatflow_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get single chatflow by ID.

    WHY: View/edit chatflow details
    HOW: Query database, verify access
    """

    chatflow = db.query(Chatflow).filter(
        Chatflow.id == chatflow_id
    ).first()

    if not chatflow:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chatflow not found"
        )

    # Verify access
    from app.models.workspace import Workspace
    workspace = db.query(Workspace).filter(
        Workspace.id == chatflow.workspace_id,
        Workspace.org_id == current_user.org_id
    ).first()

    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    return chatflow


@router.delete("/{chatflow_id}")
async def delete_chatflow(
    chatflow_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete chatflow.

    WHY: Remove chatflow
    HOW: Soft delete, cleanup webhooks

    FLOW:
    1. Verify access
    2. Unregister webhooks
    3. Soft delete chatflow
    """

    chatflow = db.query(Chatflow).filter(
        Chatflow.id == chatflow_id
    ).first()

    if not chatflow:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chatflow not found"
        )

    # Verify access
    from app.models.workspace import Workspace
    workspace = db.query(Workspace).filter(
        Workspace.id == chatflow.workspace_id,
        Workspace.org_id == current_user.org_id
    ).first()

    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    # TODO: Unregister webhooks for deployed channels

    # Soft delete
    chatflow.is_deleted = True
    db.commit()

    return {"status": "deleted"}


@router.post("/{chatflow_id}/test")
async def test_chatflow(
    chatflow_id: UUID,
    test_message: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Test chatflow execution.

    WHY: Test before deployment
    HOW: Execute chatflow with test input

    BODY:
        {
            "message": "Hello, I need help"
        }

    RETURNS:
        {
            "response": "...",
            "execution_trace": [...],
            "nodes_executed": 5,
            "total_time_ms": 1234
        }
    """

    chatflow = db.query(Chatflow).filter(
        Chatflow.id == chatflow_id
    ).first()

    if not chatflow:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chatflow not found"
        )

    # Verify access
    from app.models.workspace import Workspace
    workspace = db.query(Workspace).filter(
        Workspace.id == chatflow.workspace_id,
        Workspace.org_id == current_user.org_id
    ).first()

    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    # Execute chatflow
    result = await chatflow_service.execute(
        db=db,
        chatflow=chatflow,
        user_message=test_message,
        session_id=f"test_{current_user.id}",
        test_mode=True
    )

    return result


@router.get("/{chatflow_id}/analytics")
async def get_chatflow_analytics(
    chatflow_id: UUID,
    days: int = 7,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get chatflow analytics.

    WHY: Monitor usage and performance
    HOW: Aggregate from chat_sessions and chat_messages

    RETURNS:
        {
            "total_conversations": 1234,
            "total_messages": 5678,
            "avg_conversation_length": 4.6,
            "top_entry_nodes": [...],
            "avg_execution_time_ms": 850
        }
    """

    chatflow = db.query(Chatflow).filter(
        Chatflow.id == chatflow_id
    ).first()

    if not chatflow:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chatflow not found"
        )

    # Verify access
    from app.models.workspace import Workspace
    workspace = db.query(Workspace).filter(
        Workspace.id == chatflow.workspace_id,
        Workspace.org_id == current_user.org_id
    ).first()

    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    # TODO: Implement analytics aggregation

    return {
        "total_conversations": 0,
        "total_messages": 0,
        "avg_conversation_length": 0,
        "top_entry_nodes": [],
        "avg_execution_time_ms": 0
    }
