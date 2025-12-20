"""
Chatbot Routes - API endpoints for chatbot management.

PHASE 1: Draft Mode (Redis Only)
- User configures chatbot without database writes
- Configure AI model, system prompt, KB connections
- Fast, non-committal configuration

PHASE 2: Deployment (Create DB Records)
- Create Chatbot + API Key in PostgreSQL
- Initialize multi-channel deployments
- Return API key (shown only once)

PHASE 3: Active Usage
- Process messages via chatbot service
- Track analytics and sessions
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional, Any
from uuid import UUID
from pydantic import BaseModel, Field
from datetime import datetime

from app.db.session import get_db
from app.api.v1.dependencies import get_current_user, get_current_user_with_org
from app.models.user import User
from app.models.workspace import Workspace
from app.models.chatbot import Chatbot, ChatbotStatus
from app.models.knowledge_base import KnowledgeBase
from app.services.draft_service import draft_service, DraftType
from app.services.chatbot_service import chatbot_service

# Type alias for the user context tuple
from typing import Tuple
UserContext = Tuple[User, str, str]  # (user, org_id, ws_id)

router = APIRouter(prefix="/chatbots", tags=["chatbots"])


# ═══════════════════════════════════════════════════════════════════════════
# REQUEST/RESPONSE MODELS
# ═══════════════════════════════════════════════════════════════════════════

class CreateChatbotDraftRequest(BaseModel):
    """Request model for creating a chatbot draft."""
    name: str = Field(..., min_length=1, max_length=100, description="Chatbot name")
    description: Optional[str] = Field(None, description="Internal description")
    workspace_id: UUID = Field(..., description="Workspace ID")

    # AI Configuration (optional, has defaults)
    model: str = Field(default="secret-ai-v1", description="AI model to use")
    temperature: float = Field(default=0.7, ge=0.0, le=2.0, description="Response randomness")
    max_tokens: int = Field(default=2000, ge=1, le=8000, description="Max response length")

    # Prompt Configuration
    system_prompt: str = Field(
        default="You are a helpful assistant.",
        description="System prompt for the AI"
    )


class UpdateChatbotDraftRequest(BaseModel):
    """Request model for updating chatbot draft data."""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    model: Optional[str] = None
    temperature: Optional[float] = Field(None, ge=0.0, le=2.0)
    max_tokens: Optional[int] = Field(None, ge=1, le=8000)
    system_prompt: Optional[str] = None
    persona: Optional[dict] = None
    instructions: Optional[List[dict]] = None
    restrictions: Optional[List[dict]] = None
    messages: Optional[dict] = None
    appearance: Optional[dict] = None
    memory: Optional[dict] = None
    lead_capture: Optional[dict] = None


class AttachKBRequest(BaseModel):
    """Request model for attaching a knowledge base."""
    kb_id: UUID = Field(..., description="Knowledge Base ID")
    enabled: bool = Field(default=True, description="Whether KB is enabled")
    priority: int = Field(default=1, ge=1, le=10, description="Search priority")
    retrieval_override: Optional[dict] = Field(
        default=None,
        description="Override retrieval settings for this KB"
    )


class DeploymentChannelConfig(BaseModel):
    """Configuration for a deployment channel."""
    type: str = Field(..., description="Channel type: website, telegram, discord, whatsapp, api")
    enabled: bool = Field(default=True)
    config: Optional[dict] = Field(default=None, description="Channel-specific config")


class DeployChatbotRequest(BaseModel):
    """Request model for deploying a chatbot."""
    channels: List[DeploymentChannelConfig] = Field(
        default=[],
        description="Deployment channels to enable"
    )


class ChatbotDraftResponse(BaseModel):
    """Response model for chatbot draft."""
    id: str
    type: str
    workspace_id: str
    status: str
    created_at: str
    updated_at: str
    expires_at: str
    data: dict
    preview: Optional[dict] = None


class ChatbotResponse(BaseModel):
    """Response model for deployed chatbot."""
    id: UUID
    name: str
    description: Optional[str]
    status: str
    workspace_id: UUID
    ai_config: dict
    prompt_config: dict
    kb_config: dict
    branding_config: dict
    deployment_config: dict
    behavior_config: dict
    cached_metrics: dict
    created_at: datetime
    deployed_at: Optional[datetime]


class TestMessageRequest(BaseModel):
    """Request model for testing chatbot."""
    message: str = Field(..., min_length=1, description="Test message")
    session_id: Optional[str] = Field(None, description="Optional session ID for context")


class TestMessageResponse(BaseModel):
    """Response model for test message."""
    response: str
    sources: Optional[List[dict]] = None
    session_id: str
    message_id: str


# ═══════════════════════════════════════════════════════════════════════════
# DRAFT MANAGEMENT ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════

@router.post("/drafts", response_model=dict)
async def create_chatbot_draft(
    request: CreateChatbotDraftRequest,
    db: Session = Depends(get_db),
    user_context: UserContext = Depends(get_current_user_with_org)
):
    """
    Create a new chatbot draft in Redis.

    This starts the chatbot creation process without committing to database.
    The draft expires after 24 hours if not deployed.
    """
    current_user, org_id, _ = user_context

    # Validate workspace access
    workspace = db.query(Workspace).filter(
        Workspace.id == request.workspace_id,
        Workspace.organization_id == org_id
    ).first()

    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found or access denied"
        )

    # Create draft with initial data
    initial_data = {
        "name": request.name,
        "description": request.description,
        "model": request.model,
        "temperature": request.temperature,
        "max_tokens": request.max_tokens,
        "system_prompt": request.system_prompt,
        "knowledge_bases": [],
        "appearance": {},
        "memory": {"enabled": True, "max_messages": 20},
        "deployment": {"channels": []}
    }

    draft_id = draft_service.create_draft(
        draft_type=DraftType.CHATBOT,
        workspace_id=request.workspace_id,
        created_by=current_user.id,
        initial_data=initial_data
    )

    draft = draft_service.get_draft(DraftType.CHATBOT, draft_id)

    return {
        "draft_id": draft_id,
        "expires_at": draft["expires_at"],
        "message": "Chatbot draft created successfully"
    }


@router.get("/drafts", response_model=List[dict])
async def list_chatbot_drafts(
    workspace_id: UUID = Query(..., description="Workspace ID"),
    db: Session = Depends(get_db),
    user_context: UserContext = Depends(get_current_user_with_org)
):
    """List all chatbot drafts for a workspace."""
    current_user, org_id, _ = user_context

    # Validate workspace access
    workspace = db.query(Workspace).filter(
        Workspace.id == workspace_id,
        Workspace.organization_id == org_id
    ).first()

    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found"
        )

    drafts = draft_service.list_drafts(
        draft_type=DraftType.CHATBOT,
        workspace_id=workspace_id
    )

    return drafts


@router.get("/drafts/{draft_id}", response_model=ChatbotDraftResponse)
async def get_chatbot_draft(
    draft_id: str,
    db: Session = Depends(get_db),
    user_context: UserContext = Depends(get_current_user_with_org)
):
    """Get a chatbot draft by ID."""
    current_user, org_id, _ = user_context

    draft = draft_service.get_draft(DraftType.CHATBOT, draft_id)

    if not draft:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Draft not found or expired"
        )

    # Verify workspace access
    workspace = db.query(Workspace).filter(
        Workspace.id == UUID(draft["workspace_id"]),
        Workspace.organization_id == org_id
    ).first()

    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    return ChatbotDraftResponse(**draft)


@router.patch("/drafts/{draft_id}", response_model=dict)
async def update_chatbot_draft(
    draft_id: str,
    request: UpdateChatbotDraftRequest,
    db: Session = Depends(get_db),
    user_context: UserContext = Depends(get_current_user_with_org)
):
    """
    Update chatbot draft configuration.

    Auto-saves to Redis with extended TTL.
    """
    current_user, org_id, _ = user_context

    draft = draft_service.get_draft(DraftType.CHATBOT, draft_id)

    if not draft:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Draft not found or expired"
        )

    # Verify workspace access
    workspace = db.query(Workspace).filter(
        Workspace.id == UUID(draft["workspace_id"]),
        Workspace.organization_id == org_id
    ).first()

    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    # Build update dict from non-None fields
    updates = {k: v for k, v in request.model_dump().items() if v is not None}

    if updates:
        draft_service.update_draft(
            draft_type=DraftType.CHATBOT,
            draft_id=draft_id,
            updates={"data": updates}
        )

    return {"status": "updated", "draft_id": draft_id}


@router.delete("/drafts/{draft_id}", response_model=dict)
async def delete_chatbot_draft(
    draft_id: str,
    db: Session = Depends(get_db),
    user_context: UserContext = Depends(get_current_user_with_org)
):
    """Delete a chatbot draft (abandon creation)."""
    current_user, org_id, _ = user_context

    draft = draft_service.get_draft(DraftType.CHATBOT, draft_id)

    if not draft:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Draft not found or expired"
        )

    # Verify workspace access
    workspace = db.query(Workspace).filter(
        Workspace.id == UUID(draft["workspace_id"]),
        Workspace.organization_id == org_id
    ).first()

    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    draft_service.delete_draft(DraftType.CHATBOT, draft_id)

    return {"status": "deleted", "draft_id": draft_id}


# ═══════════════════════════════════════════════════════════════════════════
# KNOWLEDGE BASE ATTACHMENT
# ═══════════════════════════════════════════════════════════════════════════

@router.post("/drafts/{draft_id}/kb", response_model=dict)
async def attach_kb_to_draft(
    draft_id: str,
    request: AttachKBRequest,
    db: Session = Depends(get_db),
    user_context: UserContext = Depends(get_current_user_with_org)
):
    """Attach a knowledge base to the chatbot draft."""
    current_user, org_id, _ = user_context

    draft = draft_service.get_draft(DraftType.CHATBOT, draft_id)

    if not draft:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Draft not found or expired"
        )

    # Verify KB exists and is in the same workspace
    kb = db.query(KnowledgeBase).filter(
        KnowledgeBase.id == request.kb_id,
        KnowledgeBase.workspace_id == UUID(draft["workspace_id"])
    ).first()

    if not kb:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Knowledge base not found or not in same workspace"
        )

    # Add KB to draft
    current_kbs = draft["data"].get("knowledge_bases", [])

    # Check if already attached
    existing_kb_ids = [k.get("kb_id") for k in current_kbs]
    if str(request.kb_id) in existing_kb_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Knowledge base already attached"
        )

    # Add new KB config
    kb_config = {
        "kb_id": str(request.kb_id),
        "name": kb.name,  # Cache name for display
        "enabled": request.enabled,
        "priority": request.priority,
        "retrieval_override": request.retrieval_override
    }
    current_kbs.append(kb_config)

    draft_service.update_draft(
        draft_type=DraftType.CHATBOT,
        draft_id=draft_id,
        updates={"data": {"knowledge_bases": current_kbs}}
    )

    return {"status": "attached", "kb_id": str(request.kb_id), "kb_name": kb.name}


@router.delete("/drafts/{draft_id}/kb/{kb_id}", response_model=dict)
async def detach_kb_from_draft(
    draft_id: str,
    kb_id: UUID,
    db: Session = Depends(get_db),
    user_context: UserContext = Depends(get_current_user_with_org)
):
    """Detach a knowledge base from the chatbot draft."""
    current_user, org_id, _ = user_context

    draft = draft_service.get_draft(DraftType.CHATBOT, draft_id)

    if not draft:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Draft not found or expired"
        )

    # Remove KB from draft
    current_kbs = draft["data"].get("knowledge_bases", [])
    updated_kbs = [k for k in current_kbs if k.get("kb_id") != str(kb_id)]

    if len(updated_kbs) == len(current_kbs):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Knowledge base not attached to this draft"
        )

    draft_service.update_draft(
        draft_type=DraftType.CHATBOT,
        draft_id=draft_id,
        updates={"data": {"knowledge_bases": updated_kbs}}
    )

    return {"status": "detached", "kb_id": str(kb_id)}


# ═══════════════════════════════════════════════════════════════════════════
# DEPLOYMENT
# ═══════════════════════════════════════════════════════════════════════════

@router.post("/drafts/{draft_id}/deploy", response_model=dict)
async def deploy_chatbot(
    draft_id: str,
    request: DeployChatbotRequest,
    db: Session = Depends(get_db),
    user_context: UserContext = Depends(get_current_user_with_org)
):
    """
    Deploy chatbot from draft to production.

    This:
    1. Validates the draft configuration
    2. Creates the chatbot in PostgreSQL
    3. Generates an API key (shown only once)
    4. Initializes deployment channels

    Returns the API key - store it securely as it won't be shown again.
    """
    current_user, org_id, _ = user_context

    draft = draft_service.get_draft(DraftType.CHATBOT, draft_id)

    if not draft:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Draft not found or expired"
        )

    # Verify workspace access
    workspace = db.query(Workspace).filter(
        Workspace.id == UUID(draft["workspace_id"]),
        Workspace.organization_id == org_id
    ).first()

    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    # Update deployment config in draft
    if request.channels:
        deployment_config = {
            "channels": [ch.model_dump() for ch in request.channels]
        }
        draft_service.update_draft(
            draft_type=DraftType.CHATBOT,
            draft_id=draft_id,
            updates={"data": {"deployment": deployment_config}},
            extend_ttl=False
        )

    # Validate before deployment
    validation = draft_service.validate_draft(DraftType.CHATBOT, draft_id)
    if not validation["valid"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "message": "Validation failed",
                "errors": validation["errors"],
                "warnings": validation.get("warnings", [])
            }
        )

    # Deploy
    try:
        result = draft_service.deploy_draft(
            draft_type=DraftType.CHATBOT,
            draft_id=draft_id,
            db=db
        )

        return {
            "status": "deployed",
            "chatbot_id": result.get("chatbot_id"),
            "api_key": result.get("api_key"),  # Only shown once!
            "api_key_prefix": result.get("api_key_prefix"),
            "channels": result.get("channels", {}),
            "message": "Chatbot deployed successfully. Save your API key - it won't be shown again."
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Deployment failed: {str(e)}"
        )


# ═══════════════════════════════════════════════════════════════════════════
# DEPLOYED CHATBOT MANAGEMENT
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/", response_model=dict)
async def list_chatbots(
    workspace_id: UUID = Query(..., description="Workspace ID"),
    status_filter: Optional[str] = Query(None, description="Filter by status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    user_context: UserContext = Depends(get_current_user_with_org)
):
    """List all deployed chatbots in a workspace."""
    current_user, org_id, _ = user_context

    # Validate workspace access
    workspace = db.query(Workspace).filter(
        Workspace.id == workspace_id,
        Workspace.organization_id == org_id
    ).first()

    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found"
        )

    # Build query
    query = db.query(Chatbot).filter(Chatbot.workspace_id == workspace_id)

    if status_filter:
        query = query.filter(Chatbot.status == status_filter)

    total = query.count()
    chatbots = query.order_by(Chatbot.created_at.desc()).offset(skip).limit(limit).all()

    return {
        "items": [
            {
                "id": str(cb.id),
                "name": cb.name,
                "description": cb.description,
                "status": cb.status.value if hasattr(cb.status, 'value') else cb.status,
                "created_at": cb.created_at.isoformat() if cb.created_at else None,
                "deployed_at": cb.deployed_at.isoformat() if cb.deployed_at else None,
                "cached_metrics": cb.cached_metrics
            }
            for cb in chatbots
        ],
        "total": total,
        "skip": skip,
        "limit": limit
    }


@router.get("/{chatbot_id}", response_model=dict)
async def get_chatbot(
    chatbot_id: UUID,
    db: Session = Depends(get_db),
    user_context: UserContext = Depends(get_current_user_with_org)
):
    """Get a deployed chatbot by ID."""
    current_user, org_id, _ = user_context

    chatbot = db.query(Chatbot).filter(Chatbot.id == chatbot_id).first()

    if not chatbot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chatbot not found"
        )

    # Verify workspace access
    workspace = db.query(Workspace).filter(
        Workspace.id == chatbot.workspace_id,
        Workspace.organization_id == org_id
    ).first()

    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    return {
        "id": str(chatbot.id),
        "name": chatbot.name,
        "description": chatbot.description,
        "status": chatbot.status.value if hasattr(chatbot.status, 'value') else chatbot.status,
        "workspace_id": str(chatbot.workspace_id),
        "ai_config": chatbot.ai_config,
        "prompt_config": chatbot.prompt_config,
        "kb_config": chatbot.kb_config,
        "branding_config": chatbot.branding_config,
        "deployment_config": chatbot.deployment_config,
        "behavior_config": chatbot.behavior_config,
        "lead_capture_config": chatbot.lead_capture_config,
        "analytics_config": chatbot.analytics_config,
        "cached_metrics": chatbot.cached_metrics,
        "created_at": chatbot.created_at.isoformat() if chatbot.created_at else None,
        "deployed_at": chatbot.deployed_at.isoformat() if chatbot.deployed_at else None
    }


@router.patch("/{chatbot_id}", response_model=dict)
async def update_chatbot(
    chatbot_id: UUID,
    request: UpdateChatbotDraftRequest,
    db: Session = Depends(get_db),
    user_context: UserContext = Depends(get_current_user_with_org)
):
    """Update a deployed chatbot's configuration."""
    current_user, org_id, _ = user_context

    chatbot = db.query(Chatbot).filter(Chatbot.id == chatbot_id).first()

    if not chatbot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chatbot not found"
        )

    # Verify workspace access
    workspace = db.query(Workspace).filter(
        Workspace.id == chatbot.workspace_id,
        Workspace.organization_id == org_id
    ).first()

    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    # Update fields
    updates = request.model_dump(exclude_none=True)

    if "name" in updates:
        chatbot.name = updates["name"]
    if "description" in updates:
        chatbot.description = updates["description"]

    # Update AI config
    if any(k in updates for k in ["model", "temperature", "max_tokens"]):
        ai_config = chatbot.ai_config.copy() if chatbot.ai_config else {}
        if "model" in updates:
            ai_config["model"] = updates["model"]
        if "temperature" in updates:
            ai_config["temperature"] = updates["temperature"]
        if "max_tokens" in updates:
            ai_config["max_tokens"] = updates["max_tokens"]
        chatbot.ai_config = ai_config

    # Update prompt config
    if any(k in updates for k in ["system_prompt", "persona", "instructions", "restrictions", "messages"]):
        prompt_config = chatbot.prompt_config.copy() if chatbot.prompt_config else {}
        if "system_prompt" in updates:
            prompt_config["system_prompt"] = updates["system_prompt"]
        if "persona" in updates:
            prompt_config["persona"] = updates["persona"]
        if "instructions" in updates:
            prompt_config["instructions"] = updates["instructions"]
        if "restrictions" in updates:
            prompt_config["restrictions"] = updates["restrictions"]
        if "messages" in updates:
            prompt_config["messages"] = updates["messages"]
        chatbot.prompt_config = prompt_config

    # Update branding
    if "appearance" in updates:
        chatbot.branding_config = updates["appearance"]

    # Update behavior
    if "memory" in updates:
        behavior_config = chatbot.behavior_config.copy() if chatbot.behavior_config else {}
        behavior_config["memory"] = updates["memory"]
        chatbot.behavior_config = behavior_config

    # Update lead capture
    if "lead_capture" in updates:
        chatbot.lead_capture_config = updates["lead_capture"]

    db.commit()
    db.refresh(chatbot)

    return {"status": "updated", "chatbot_id": str(chatbot.id)}


@router.delete("/{chatbot_id}", response_model=dict)
async def delete_chatbot(
    chatbot_id: UUID,
    db: Session = Depends(get_db),
    user_context: UserContext = Depends(get_current_user_with_org)
):
    """Archive a chatbot (soft delete)."""
    current_user, org_id, _ = user_context

    chatbot = db.query(Chatbot).filter(Chatbot.id == chatbot_id).first()

    if not chatbot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chatbot not found"
        )

    # Verify workspace access
    workspace = db.query(Workspace).filter(
        Workspace.id == chatbot.workspace_id,
        Workspace.organization_id == org_id
    ).first()

    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    # Soft delete by changing status
    chatbot.status = ChatbotStatus.ARCHIVED

    db.commit()

    return {"status": "archived", "chatbot_id": str(chatbot_id)}


# ═══════════════════════════════════════════════════════════════════════════
# TESTING & PREVIEW
# ═══════════════════════════════════════════════════════════════════════════

@router.post("/drafts/{draft_id}/test", response_model=TestMessageResponse)
async def test_draft_chatbot(
    draft_id: str,
    request: TestMessageRequest,
    db: Session = Depends(get_db),
    user_context: UserContext = Depends(get_current_user_with_org)
):
    """
    Test a chatbot draft with a message.

    This allows testing the chatbot configuration before deployment.
    """
    current_user, org_id, _ = user_context

    draft = draft_service.get_draft(DraftType.CHATBOT, draft_id)

    if not draft:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Draft not found or expired"
        )

    # Verify workspace access
    workspace = db.query(Workspace).filter(
        Workspace.id == UUID(draft["workspace_id"]),
        Workspace.organization_id == org_id
    ).first()

    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    try:
        result = await chatbot_service.preview_response(
            db=db,
            draft_id=draft_id,
            user_message=request.message,
            session_id=request.session_id
        )

        return TestMessageResponse(**result)

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Test failed: {str(e)}"
        )


@router.post("/{chatbot_id}/test", response_model=TestMessageResponse)
async def test_deployed_chatbot(
    chatbot_id: UUID,
    request: TestMessageRequest,
    db: Session = Depends(get_db),
    user_context: UserContext = Depends(get_current_user_with_org)
):
    """Test a deployed chatbot with a message."""
    current_user, org_id, _ = user_context

    chatbot = db.query(Chatbot).filter(Chatbot.id == chatbot_id).first()

    if not chatbot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chatbot not found"
        )

    # Verify workspace access
    workspace = db.query(Workspace).filter(
        Workspace.id == chatbot.workspace_id,
        Workspace.organization_id == org_id
    ).first()

    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    try:
        session_id = request.session_id or f"test_{current_user.id}"

        result = await chatbot_service.process_message(
            db=db,
            chatbot=chatbot,
            user_message=request.message,
            session_id=session_id,
            channel_context={"platform": "test", "user_id": str(current_user.id)}
        )

        return TestMessageResponse(**result)

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Test failed: {str(e)}"
        )


# ═══════════════════════════════════════════════════════════════════════════
# ANALYTICS
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/{chatbot_id}/analytics", response_model=dict)
async def get_chatbot_analytics(
    chatbot_id: UUID,
    days: int = Query(7, ge=1, le=90, description="Number of days to analyze"),
    db: Session = Depends(get_db),
    user_context: UserContext = Depends(get_current_user_with_org)
):
    """Get chatbot usage analytics."""
    current_user, org_id, _ = user_context

    chatbot = db.query(Chatbot).filter(Chatbot.id == chatbot_id).first()

    if not chatbot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chatbot not found"
        )

    # Verify workspace access
    workspace = db.query(Workspace).filter(
        Workspace.id == chatbot.workspace_id,
        Workspace.organization_id == org_id
    ).first()

    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    try:
        stats = chatbot_service.get_chatbot_stats(db=db, chatbot_id=chatbot_id)
        return {
            "chatbot_id": str(chatbot_id),
            "period_days": days,
            **stats,
            "cached_metrics": chatbot.cached_metrics
        }
    except Exception as e:
        # Return cached metrics if stats calculation fails
        return {
            "chatbot_id": str(chatbot_id),
            "period_days": days,
            **chatbot.cached_metrics,
            "error": str(e)
        }
