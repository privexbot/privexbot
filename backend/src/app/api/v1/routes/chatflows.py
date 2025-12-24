"""
Chatflow Routes - MVP endpoints for draft and deployed chatflow management.

WHY:
- CRUD operations for chatflows
- Draft management (Redis)
- Deployment to database
- Multi-tenant access control

HOW:
- FastAPI router with proper dependencies
- Draft-first architecture (Redis -> PostgreSQL)
- Uses get_current_user_with_org for org context
- Consistent patterns with chatbot routes
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import Tuple
from uuid import UUID

from app.db.session import get_db
from app.api.v1.dependencies import get_current_user_with_org
from app.models.user import User
from app.models.workspace import Workspace
from app.models.chatflow import Chatflow
from app.services.draft_service import draft_service, DraftType
from app.schemas.chatflow import (
    CreateChatflowDraftRequest,
    UpdateChatflowDraftRequest,
    FinalizeChatflowRequest,
)

UserContext = Tuple[User, str, str]

router = APIRouter(prefix="/chatflows", tags=["chatflows"])


# =============================================================================
# DRAFT ENDPOINTS (Phase 1 - Create/Edit in Redis)
# =============================================================================

@router.post("/drafts")
async def create_chatflow_draft(
    request: CreateChatflowDraftRequest,
    db: Session = Depends(get_db),
    user_context: UserContext = Depends(get_current_user_with_org)
):
    """
    Create a new chatflow draft in Redis.

    WHY: Start chatflow creation in draft mode
    HOW: Store in Redis with 24hr TTL
    """
    current_user, org_id, _ = user_context

    # Validate workspace access
    workspace = db.query(Workspace).filter(
        Workspace.id == request.workspace_id,
        Workspace.organization_id == org_id
    ).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    # Create draft
    draft_id = draft_service.create_draft(
        draft_type=DraftType.CHATFLOW,
        workspace_id=request.workspace_id,
        created_by=current_user.id,
        initial_data=request.initial_data
    )
    draft = draft_service.get_draft(DraftType.CHATFLOW, draft_id)

    return {"draft_id": draft_id, "expires_at": draft["expires_at"]}


@router.get("/drafts/{draft_id}")
async def get_chatflow_draft(
    draft_id: str,
    db: Session = Depends(get_db),
    user_context: UserContext = Depends(get_current_user_with_org)
):
    """
    Get chatflow draft by ID.

    WHY: Retrieve draft for editing
    HOW: Get from Redis, verify access
    """
    current_user, org_id, _ = user_context

    draft = draft_service.get_draft(DraftType.CHATFLOW, draft_id)
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found or expired")

    # Verify workspace access
    workspace = db.query(Workspace).filter(
        Workspace.id == UUID(draft["workspace_id"]),
        Workspace.organization_id == org_id
    ).first()
    if not workspace:
        raise HTTPException(status_code=403, detail="Access denied")

    return draft


@router.patch("/drafts/{draft_id}")
async def update_chatflow_draft(
    draft_id: str,
    request: UpdateChatflowDraftRequest,
    db: Session = Depends(get_db),
    user_context: UserContext = Depends(get_current_user_with_org)
):
    """
    Update chatflow draft (auto-save from frontend).

    WHY: Save changes during editing
    HOW: Update in Redis, extend TTL
    """
    current_user, org_id, _ = user_context

    draft = draft_service.get_draft(DraftType.CHATFLOW, draft_id)
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")

    # Verify workspace access
    workspace = db.query(Workspace).filter(
        Workspace.id == UUID(draft["workspace_id"]),
        Workspace.organization_id == org_id
    ).first()
    if not workspace:
        raise HTTPException(status_code=403, detail="Access denied")

    # Build updates dict from non-None fields
    updates = {k: v for k, v in request.model_dump().items() if v is not None}
    if updates:
        draft_service.update_draft(DraftType.CHATFLOW, draft_id, updates={"data": updates})

    return {"status": "updated", "draft_id": draft_id}


@router.post("/drafts/{draft_id}/finalize")
async def finalize_chatflow(
    draft_id: str,
    request: FinalizeChatflowRequest,
    db: Session = Depends(get_db),
    user_context: UserContext = Depends(get_current_user_with_org)
):
    """
    Deploy chatflow from draft to database.

    WHY: Convert draft to production chatflow
    HOW: Validate, save to DB, register webhooks
    """
    current_user, org_id, _ = user_context

    draft = draft_service.get_draft(DraftType.CHATFLOW, draft_id)
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")

    # Verify workspace access
    workspace = db.query(Workspace).filter(
        Workspace.id == UUID(draft["workspace_id"]),
        Workspace.organization_id == org_id
    ).first()
    if not workspace:
        raise HTTPException(status_code=403, detail="Access denied")

    # Update deployment config before finalizing
    draft_service.update_draft(
        DraftType.CHATFLOW, draft_id,
        updates={"data": {"deployment": {"channels": request.channels}}},
        extend_ttl=False
    )

    # Deploy
    try:
        result = draft_service.deploy_draft(DraftType.CHATFLOW, draft_id, db=db)
        return {"status": "deployed", "chatflow_id": result.get("chatflow_id")}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/drafts/{draft_id}")
async def delete_chatflow_draft(
    draft_id: str,
    db: Session = Depends(get_db),
    user_context: UserContext = Depends(get_current_user_with_org)
):
    """
    Delete chatflow draft (abandon).

    WHY: User abandons draft
    HOW: Delete from Redis
    """
    current_user, org_id, _ = user_context

    draft = draft_service.get_draft(DraftType.CHATFLOW, draft_id)
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")

    # Verify workspace access
    workspace = db.query(Workspace).filter(
        Workspace.id == UUID(draft["workspace_id"]),
        Workspace.organization_id == org_id
    ).first()
    if not workspace:
        raise HTTPException(status_code=403, detail="Access denied")

    draft_service.delete_draft(DraftType.CHATFLOW, draft_id)

    return {"status": "deleted", "draft_id": draft_id}


# =============================================================================
# DEPLOYED CHATFLOW ENDPOINTS (Phase 3 - Manage in Database)
# =============================================================================

@router.get("/")
async def list_chatflows(
    workspace_id: UUID = Query(...),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    user_context: UserContext = Depends(get_current_user_with_org)
):
    """
    List all deployed chatflows in a workspace.

    WHY: Display chatflows in dashboard
    HOW: Query database with pagination
    """
    current_user, org_id, _ = user_context

    # Validate workspace access
    workspace = db.query(Workspace).filter(
        Workspace.id == workspace_id,
        Workspace.organization_id == org_id
    ).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    # Get chatflows
    query = db.query(Chatflow).filter(
        Chatflow.workspace_id == workspace_id,
        Chatflow.is_deleted == False
    )
    total = query.count()
    chatflows = query.order_by(Chatflow.created_at.desc()).offset(skip).limit(limit).all()

    return {
        "items": [
            {
                "id": str(cf.id),
                "name": cf.name,
                "description": cf.description,
                "is_active": cf.is_active,
                "node_count": len(cf.config.get("nodes", [])) if cf.config else 0,
                "created_at": cf.created_at.isoformat() if cf.created_at else None,
            }
            for cf in chatflows
        ],
        "total": total,
        "skip": skip,
        "limit": limit
    }


@router.get("/{chatflow_id}")
async def get_chatflow(
    chatflow_id: UUID,
    db: Session = Depends(get_db),
    user_context: UserContext = Depends(get_current_user_with_org)
):
    """
    Get a deployed chatflow by ID.

    WHY: View/edit chatflow details
    HOW: Query database, verify access
    """
    current_user, org_id, _ = user_context

    chatflow = db.query(Chatflow).filter(
        Chatflow.id == chatflow_id,
        Chatflow.is_deleted == False
    ).first()
    if not chatflow:
        raise HTTPException(status_code=404, detail="Chatflow not found")

    # Verify access via workspace
    workspace = db.query(Workspace).filter(
        Workspace.id == chatflow.workspace_id,
        Workspace.organization_id == org_id
    ).first()
    if not workspace:
        raise HTTPException(status_code=403, detail="Access denied")

    return {
        "id": str(chatflow.id),
        "name": chatflow.name,
        "description": chatflow.description,
        "workspace_id": str(chatflow.workspace_id),
        "config": chatflow.config,
        "version": chatflow.version,
        "is_active": chatflow.is_active,
        "created_at": chatflow.created_at.isoformat() if chatflow.created_at else None,
        "updated_at": chatflow.updated_at.isoformat() if chatflow.updated_at else None,
        "deployed_at": chatflow.deployed_at.isoformat() if chatflow.deployed_at else None,
    }


@router.delete("/{chatflow_id}")
async def delete_chatflow(
    chatflow_id: UUID,
    db: Session = Depends(get_db),
    user_context: UserContext = Depends(get_current_user_with_org)
):
    """
    Soft delete a chatflow.

    WHY: Remove chatflow from active use
    HOW: Set is_deleted=True (soft delete)
    """
    current_user, org_id, _ = user_context

    chatflow = db.query(Chatflow).filter(
        Chatflow.id == chatflow_id,
        Chatflow.is_deleted == False
    ).first()
    if not chatflow:
        raise HTTPException(status_code=404, detail="Chatflow not found")

    # Verify access via workspace
    workspace = db.query(Workspace).filter(
        Workspace.id == chatflow.workspace_id,
        Workspace.organization_id == org_id
    ).first()
    if not workspace:
        raise HTTPException(status_code=403, detail="Access denied")

    # Soft delete
    chatflow.is_deleted = True
    db.commit()

    return {"status": "deleted", "chatflow_id": str(chatflow_id)}


@router.patch("/{chatflow_id}/toggle")
async def toggle_chatflow_active(
    chatflow_id: UUID,
    db: Session = Depends(get_db),
    user_context: UserContext = Depends(get_current_user_with_org)
):
    """
    Toggle chatflow active status.

    WHY: Enable/disable chatflow without deleting
    HOW: Flip is_active boolean
    """
    current_user, org_id, _ = user_context

    chatflow = db.query(Chatflow).filter(
        Chatflow.id == chatflow_id,
        Chatflow.is_deleted == False
    ).first()
    if not chatflow:
        raise HTTPException(status_code=404, detail="Chatflow not found")

    # Verify access via workspace
    workspace = db.query(Workspace).filter(
        Workspace.id == chatflow.workspace_id,
        Workspace.organization_id == org_id
    ).first()
    if not workspace:
        raise HTTPException(status_code=403, detail="Access denied")

    # Toggle
    chatflow.is_active = not chatflow.is_active
    db.commit()

    return {
        "status": "updated",
        "chatflow_id": str(chatflow_id),
        "is_active": chatflow.is_active
    }
