"""
Chatbot Routes - API endpoints for chatbot management.

WHY:
- CRUD operations for chatbots
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
from typing import List, Optional
from uuid import UUID

from app.db.session import get_db
from app.api.v1.dependencies import get_current_user
from app.models.user import User
from app.models.chatbot import Chatbot
from app.services.draft_service import draft_service
from app.services.chatbot_service import chatbot_service

router = APIRouter(prefix="/chatbots", tags=["chatbots"])


@router.post("/drafts")
async def create_chatbot_draft(
    workspace_id: UUID,
    initial_data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create new chatbot draft.

    WHY: Start chatbot creation in draft mode
    HOW: Use draft service, store in Redis

    FLOW:
    1. Validate workspace access
    2. Create draft in Redis
    3. Return draft_id

    BODY:
        {
            "name": "Support Chatbot",
            "description": "Customer support assistant",
            "system_prompt": "You are a helpful customer support agent...",
            "model": "gpt-4",
            "temperature": 0.7,
            "knowledge_bases": []
        }

    RETURNS:
        {
            "draft_id": "draft_chatbot_abc123",
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
        draft_type="chatbot",
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
async def get_chatbot_draft(
    draft_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get chatbot draft.

    WHY: Retrieve draft for editing
    HOW: Get from Redis

    RETURNS:
        {
            "id": "draft_chatbot_abc123",
            "type": "chatbot",
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
async def update_chatbot_draft(
    draft_id: str,
    updates: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update chatbot draft.

    WHY: Save changes during editing
    HOW: Update in Redis

    BODY:
        {
            "name": "Updated Name",
            "system_prompt": "Updated prompt...",
            "knowledge_bases": ["kb_id_1", "kb_id_2"]
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
async def finalize_chatbot_draft(
    draft_id: str,
    deployment_config: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Finalize chatbot draft and deploy.

    WHY: Convert draft to production chatbot
    HOW: Validate, save to DB, deploy to channels

    BODY:
        {
            "channels": ["website", "telegram"],
            "telegram_bot_token": "123456:ABC...",
            "allowed_domains": ["example.com"]
        }

    RETURNS:
        {
            "chatbot_id": "uuid",
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
async def list_chatbots(
    workspace_id: UUID,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List all chatbots in workspace.

    WHY: Display chatbots in dashboard
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

    # Get chatbots
    query = db.query(Chatbot).filter(
        Chatbot.workspace_id == workspace_id
    )

    total = query.count()
    chatbots = query.offset(skip).limit(limit).all()

    return {
        "items": chatbots,
        "total": total,
        "skip": skip,
        "limit": limit
    }


@router.get("/{chatbot_id}")
async def get_chatbot(
    chatbot_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get single chatbot by ID.

    WHY: View/edit chatbot details
    HOW: Query database, verify access
    """

    chatbot = db.query(Chatbot).filter(
        Chatbot.id == chatbot_id
    ).first()

    if not chatbot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chatbot not found"
        )

    # Verify access
    from app.models.workspace import Workspace
    workspace = db.query(Workspace).filter(
        Workspace.id == chatbot.workspace_id,
        Workspace.org_id == current_user.org_id
    ).first()

    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    return chatbot


@router.patch("/{chatbot_id}")
async def update_chatbot(
    chatbot_id: UUID,
    updates: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update chatbot configuration.

    WHY: Modify chatbot settings
    HOW: Update database

    BODY:
        {
            "name": "Updated Name",
            "system_prompt": "Updated prompt...",
            "model": "gpt-4-turbo",
            "temperature": 0.8
        }
    """

    chatbot = db.query(Chatbot).filter(
        Chatbot.id == chatbot_id
    ).first()

    if not chatbot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chatbot not found"
        )

    # Verify access
    from app.models.workspace import Workspace
    workspace = db.query(Workspace).filter(
        Workspace.id == chatbot.workspace_id,
        Workspace.org_id == current_user.org_id
    ).first()

    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    # Update fields
    for key, value in updates.items():
        if hasattr(chatbot, key):
            setattr(chatbot, key, value)

    db.commit()
    db.refresh(chatbot)

    return chatbot


@router.delete("/{chatbot_id}")
async def delete_chatbot(
    chatbot_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete chatbot.

    WHY: Remove chatbot
    HOW: Soft delete, cleanup webhooks

    FLOW:
    1. Verify access
    2. Unregister webhooks
    3. Soft delete chatbot
    """

    chatbot = db.query(Chatbot).filter(
        Chatbot.id == chatbot_id
    ).first()

    if not chatbot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chatbot not found"
        )

    # Verify access
    from app.models.workspace import Workspace
    workspace = db.query(Workspace).filter(
        Workspace.id == chatbot.workspace_id,
        Workspace.org_id == current_user.org_id
    ).first()

    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    # TODO: Unregister webhooks for deployed channels

    # Soft delete
    chatbot.is_deleted = True
    db.commit()

    return {"status": "deleted"}


@router.post("/{chatbot_id}/test")
async def test_chatbot(
    chatbot_id: UUID,
    test_message: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Test chatbot with message.

    WHY: Test before deployment
    HOW: Execute chatbot with test input

    BODY:
        {
            "message": "Hello, I need help"
        }

    RETURNS:
        {
            "response": "...",
            "sources": [...],
            "tokens_used": 150,
            "response_time_ms": 850
        }
    """

    chatbot = db.query(Chatbot).filter(
        Chatbot.id == chatbot_id
    ).first()

    if not chatbot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chatbot not found"
        )

    # Verify access
    from app.models.workspace import Workspace
    workspace = db.query(Workspace).filter(
        Workspace.id == chatbot.workspace_id,
        Workspace.org_id == current_user.org_id
    ).first()

    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    # Execute chatbot
    result = await chatbot_service.process_message(
        db=db,
        chatbot=chatbot,
        user_message=test_message,
        session_id=f"test_{current_user.id}",
        channel_context={"platform": "test"}
    )

    return result


@router.get("/{chatbot_id}/analytics")
async def get_chatbot_analytics(
    chatbot_id: UUID,
    days: int = 7,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get chatbot analytics.

    WHY: Monitor usage and performance
    HOW: Aggregate from chat_sessions and chat_messages

    RETURNS:
        {
            "total_conversations": 1234,
            "total_messages": 5678,
            "avg_conversation_length": 4.6,
            "avg_response_time_ms": 850,
            "user_satisfaction": 4.5
        }
    """

    chatbot = db.query(Chatbot).filter(
        Chatbot.id == chatbot_id
    ).first()

    if not chatbot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chatbot not found"
        )

    # Verify access
    from app.models.workspace import Workspace
    workspace = db.query(Workspace).filter(
        Workspace.id == chatbot.workspace_id,
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
        "avg_response_time_ms": 0,
        "user_satisfaction": 0
    }


@router.post("/{chatbot_id}/kb/attach")
async def attach_knowledge_base(
    chatbot_id: UUID,
    kb_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Attach knowledge base to chatbot.

    WHY: Enable RAG for chatbot
    HOW: Update chatbot.knowledge_bases

    BODY:
        {
            "kb_id": "uuid"
        }
    """

    chatbot = db.query(Chatbot).filter(
        Chatbot.id == chatbot_id
    ).first()

    if not chatbot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chatbot not found"
        )

    # Verify KB exists and belongs to same workspace
    from app.models.knowledge_base import KnowledgeBase
    kb = db.query(KnowledgeBase).filter(
        KnowledgeBase.id == kb_id,
        KnowledgeBase.workspace_id == chatbot.workspace_id
    ).first()

    if not kb:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Knowledge base not found or not in same workspace"
        )

    # Add KB to chatbot
    if not chatbot.knowledge_bases:
        chatbot.knowledge_bases = []

    if kb_id not in chatbot.knowledge_bases:
        chatbot.knowledge_bases.append(kb_id)
        db.commit()

    return {"status": "attached"}


@router.delete("/{chatbot_id}/kb/{kb_id}")
async def detach_knowledge_base(
    chatbot_id: UUID,
    kb_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Detach knowledge base from chatbot.

    WHY: Remove KB from chatbot
    HOW: Update chatbot.knowledge_bases
    """

    chatbot = db.query(Chatbot).filter(
        Chatbot.id == chatbot_id
    ).first()

    if not chatbot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chatbot not found"
        )

    # Remove KB from chatbot
    if chatbot.knowledge_bases and kb_id in chatbot.knowledge_bases:
        chatbot.knowledge_bases.remove(kb_id)
        db.commit()

    return {"status": "detached"}
