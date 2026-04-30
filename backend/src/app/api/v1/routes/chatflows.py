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

from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Any, Optional, Tuple
from uuid import UUID, uuid4

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


def _ensure_chatflow_access(
    db: Session,
    chatflow_id: UUID,
    org_id: str,
) -> Tuple[Chatflow, Workspace]:
    """Resolve a chatflow + verify the active org has access via its workspace.

    Centralized so the test/api-keys/redeploy endpoints share the same auth
    surface. Raises 404 / 403 to match the rest of this module.
    """
    chatflow = db.query(Chatflow).filter(
        Chatflow.id == chatflow_id,
        Chatflow.is_deleted == False,
    ).first()
    if not chatflow:
        raise HTTPException(status_code=404, detail="Chatflow not found")

    workspace = db.query(Workspace).filter(
        Workspace.id == chatflow.workspace_id,
        Workspace.organization_id == org_id,
    ).first()
    if not workspace:
        raise HTTPException(status_code=403, detail="Access denied")

    return chatflow, workspace

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

        # Emit notification (non-critical)
        try:
            from app.services import notification_service
            notification_service.notify_chatflow_deployed(
                db=db,
                user_id=current_user.id,
                chatflow_id=UUID(result.get("chatflow_id")),
                chatflow_name=draft.get("data", {}).get("name", "Chatflow"),
                workspace_id=workspace.id,
            )
        except Exception:
            pass

        # Surface the full deploy result so the success modal can show:
        #   - the API key (only on first deploy — `_update_chatflow` returns
        #     no `api_key` field, which the modal handles correctly)
        #   - the api_key_prefix
        #   - the per-channel registration outcomes (`channels` dict)
        # Stripping these earlier was the cause of the empty deploy modal.
        return {
            "status": "deployed",
            "chatflow_id": result.get("chatflow_id"),
            "api_key": result.get("api_key"),
            "api_key_prefix": result.get("api_key_prefix"),
            "channels": result.get("channels", {}),
        }
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


@router.post("/{chatflow_id}/edit")
async def create_edit_draft(
    chatflow_id: UUID,
    db: Session = Depends(get_db),
    user_context: UserContext = Depends(get_current_user_with_org)
):
    """
    Create a draft from a deployed chatflow for editing.

    WHY: Allow editing deployed chatflows without recreating from scratch
    HOW: Load chatflow config into a new Redis draft, return draft_id
    """
    current_user, org_id, _ = user_context

    # Verify chatflow exists and user has access
    chatflow = db.query(Chatflow).filter(
        Chatflow.id == chatflow_id,
        Chatflow.is_deleted == False
    ).first()
    if not chatflow:
        raise HTTPException(status_code=404, detail="Chatflow not found")

    # Verify workspace access
    workspace = db.query(Workspace).filter(
        Workspace.id == chatflow.workspace_id,
        Workspace.organization_id == org_id
    ).first()
    if not workspace:
        raise HTTPException(status_code=403, detail="Access denied")

    try:
        draft_id = draft_service.create_edit_draft(
            chatflow_id=chatflow_id,
            workspace_id=chatflow.workspace_id,
            created_by=current_user.id,
            db=db
        )
        return {"draft_id": draft_id}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


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


# =============================================================================
# AUTHENTICATED LIVE TEST
# =============================================================================
# Mirrors POST /chatbots/{id}/test (chatbot.py:1443-1490): workspace-scoped
# auth, no API key or is_public requirement. Used by the studio "Live test"
# panel to exercise a deployed chatflow as the signed-in user.


class _ChatflowTestRequest(BaseModel):
    message: str
    session_id: Optional[str] = None


class _ChatflowTestResponse(BaseModel):
    response: str
    session_id: str
    message_id: str
    sources: Optional[list[dict[str, Any]]] = None


@router.post("/{chatflow_id}/test", response_model=_ChatflowTestResponse)
async def test_deployed_chatflow(
    chatflow_id: UUID,
    request: _ChatflowTestRequest,
    db: Session = Depends(get_db),
    user_context: UserContext = Depends(get_current_user_with_org),
):
    """Run a single-turn test message against a deployed chatflow.

    WHY: Studio live-test should not depend on the public widget endpoint,
         which gates on `is_public` and an API key.
    HOW: Authenticated via JWT, scoped to the chatflow's workspace within the
         active org, dispatches to chatflow_service.execute().
    """
    from app.services.chatflow_service import chatflow_service

    current_user, org_id, _ = user_context

    chatflow, _ws = _ensure_chatflow_access(db, chatflow_id, org_id)

    session_id = request.session_id or f"test_{current_user.id}_{uuid4().hex[:8]}"

    try:
        result = await chatflow_service.execute(
            db=db,
            chatflow=chatflow,
            user_message=request.message,
            session_id=session_id,
            channel_context={
                "platform": "test",
                "user_id": str(current_user.id),
            },
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Test failed: {str(e)[:300]}",
        )

    return _ChatflowTestResponse(
        response=result["response"],
        session_id=result["session_id"],
        message_id=result["message_id"],
        sources=result.get("sources"),
    )


# =============================================================================
# API KEY MANAGEMENT
# =============================================================================
# Mirrors the chatbot pattern (chatbot.py:1764-1990). The full key is only
# shown once on creation/regeneration; subsequent reads only return prefix.


class APIKeyResponse(BaseModel):
    id: str
    name: str
    key_prefix: str
    is_active: bool
    created_at: datetime
    last_used_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None


class APIKeyCreateResponse(BaseModel):
    id: str
    name: str
    key_prefix: str
    api_key: str  # Full key — only shown once
    message: str


@router.get("/{chatflow_id}/api-keys", response_model=list[APIKeyResponse])
async def list_chatflow_api_keys(
    chatflow_id: UUID,
    db: Session = Depends(get_db),
    user_context: UserContext = Depends(get_current_user_with_org),
):
    """List API keys for a chatflow (prefix only, never the full key)."""
    from app.models.api_key import APIKey

    _current_user, org_id, _ = user_context
    chatflow, _ws = _ensure_chatflow_access(db, chatflow_id, org_id)

    api_keys = db.query(APIKey).filter(
        APIKey.entity_id == chatflow.id,
        APIKey.entity_type == "chatflow",
    ).order_by(APIKey.created_at.desc()).all()

    return [
        APIKeyResponse(
            id=str(key.id),
            name=key.name,
            key_prefix=key.key_prefix,
            is_active=key.is_active and not key.is_revoked,
            created_at=key.created_at,
            last_used_at=key.last_used_at,
            expires_at=key.expires_at,
        )
        for key in api_keys
    ]


@router.post("/{chatflow_id}/api-keys/regenerate", response_model=APIKeyCreateResponse)
async def regenerate_chatflow_api_key(
    chatflow_id: UUID,
    db: Session = Depends(get_db),
    user_context: UserContext = Depends(get_current_user_with_org),
):
    """Rotate the chatflow API key. Old keys are removed; new key returned once."""
    from app.models.api_key import APIKey, create_api_key

    current_user, org_id, _ = user_context
    chatflow, _ws = _ensure_chatflow_access(db, chatflow_id, org_id)

    # Hard-delete prior keys (matches chatbot.py:1881-1884 behavior)
    db.query(APIKey).filter(
        APIKey.entity_id == chatflow.id,
        APIKey.entity_type == "chatflow",
    ).delete(synchronize_session=False)

    new_key, plain_key = create_api_key(
        workspace_id=chatflow.workspace_id,
        name=f"API Key for {chatflow.name}",
        entity_type="chatflow",
        entity_id=chatflow.id,
        created_by=current_user.id,
        permissions=["read", "execute"],
    )
    db.add(new_key)
    db.commit()

    return APIKeyCreateResponse(
        id=str(new_key.id),
        name=new_key.name,
        key_prefix=new_key.key_prefix,
        api_key=plain_key,
        message="New API key generated. Save it now — it won't be shown again!",
    )


@router.delete("/{chatflow_id}/api-keys/{key_id}", response_model=dict)
async def delete_chatflow_api_key(
    chatflow_id: UUID,
    key_id: UUID,
    db: Session = Depends(get_db),
    user_context: UserContext = Depends(get_current_user_with_org),
):
    """Permanently delete a specific API key (irreversible)."""
    from app.models.api_key import APIKey

    _current_user, org_id, _ = user_context
    chatflow, _ws = _ensure_chatflow_access(db, chatflow_id, org_id)

    api_key = db.query(APIKey).filter(
        APIKey.id == key_id,
        APIKey.entity_id == chatflow.id,
        APIKey.entity_type == "chatflow",
    ).first()
    if not api_key:
        raise HTTPException(status_code=404, detail="API key not found")

    key_prefix = api_key.key_prefix
    db.delete(api_key)
    db.commit()

    return {"status": "deleted", "key_id": str(key_id), "key_prefix": key_prefix}


# =============================================================================
# RE-REGISTER CHANNELS
# =============================================================================
# One-click "Re-register channels" action for the detail page. Re-runs
# draft_service._initialize_channels using the chatflow's already-stored
# deployment config — no need to round-trip through the builder UI.


class _RedeployChannelsResponse(BaseModel):
    chatflow_id: str
    channels: dict[str, Any]


def _reconstruct_channels_input(deployment: Any) -> list[dict[str, Any]]:
    """Convert any of the three stored shapes back into the array form that
    `_initialize_channels` consumes:
      1) flat dict {telegram: {bot_token_credential_id: ...}, ...}  (post-deploy)
      2) array      [{type, enabled, config: {...}}, ...]            (draft input)
      3) wrapped    {channels: [...]}                                (legacy)
    """
    if not deployment:
        return []

    # Wrapped legacy form
    if (
        isinstance(deployment, dict)
        and isinstance(deployment.get("channels"), list)
    ):
        return list(deployment["channels"])

    # Already an array
    if isinstance(deployment, list):
        return list(deployment)

    # Flat dict — rebuild credential / config from each entry
    if isinstance(deployment, dict):
        rebuilt: list[dict[str, Any]] = []
        for ch_type, cfg in deployment.items():
            if not isinstance(cfg, dict):
                continue
            credential_id = (
                cfg.get("bot_token_credential_id")
                or cfg.get("access_token_credential_id")
                or cfg.get("credential_id")
            )
            entry: dict[str, Any] = {
                "type": ch_type,
                "enabled": True,
                "config": {},
            }
            if credential_id:
                entry["credential_id"] = credential_id
                # _initialize_channels also reads from config.bot_token /
                # config.access_token as a fallback — populate both for safety.
                if ch_type in ("telegram", "discord"):
                    entry["config"]["bot_token"] = credential_id
                elif ch_type == "whatsapp":
                    entry["config"]["access_token"] = credential_id
            # Preserve any other channel-specific scalars (phone_number_id, etc.)
            for k in ("phone_number_id", "phone_number", "allowed_domains"):
                if k in cfg:
                    entry["config"][k] = cfg[k]
            rebuilt.append(entry)
        return rebuilt

    return []


@router.post("/{chatflow_id}/channels/redeploy", response_model=_RedeployChannelsResponse)
async def redeploy_chatflow_channels(
    chatflow_id: UUID,
    db: Session = Depends(get_db),
    user_context: UserContext = Depends(get_current_user_with_org),
):
    """Re-run channel registration for a deployed chatflow.

    WHY: After the JSONB-persistence and import-typo bugs, some chatflows have
         channels stored in the legacy / draft input shape with no webhook
         URLs. This endpoint lets the user re-register without going through
         the builder again.
    HOW: Read chatflow.config.deployment, normalize it back to the array form,
         look up the active API key, run draft_service._initialize_channels,
         persist the resulting flat dict via reassignment.
    """
    from app.models.api_key import APIKey

    _current_user, org_id, _ = user_context
    chatflow, _ws = _ensure_chatflow_access(db, chatflow_id, org_id)

    stored_deployment = (chatflow.config or {}).get("deployment")
    channels_input = _reconstruct_channels_input(stored_deployment)
    if not channels_input:
        raise HTTPException(
            status_code=400,
            detail=(
                "No deployment channels found on this chatflow. Open it in the "
                "builder, choose channels, and click Deploy first."
            ),
        )

    existing_key = db.query(APIKey).filter(
        APIKey.entity_id == chatflow.id,
        APIKey.entity_type == "chatflow",
        APIKey.is_active == True,
    ).first()
    if not existing_key:
        raise HTTPException(
            status_code=400,
            detail="No active API key for this chatflow. Regenerate one first.",
        )

    # _initialize_channels embeds the api_key only into the website embed
    # code; for telegram/discord/whatsapp/zapier/slack registration the value
    # is irrelevant. Using key_prefix is acceptable here (matches the same
    # call site in draft_service._update_chatflow).
    deployment_results = draft_service._initialize_channels(
        entity_id=chatflow.id,
        entity_type="chatflow",
        deployment_config={"channels": channels_input},
        api_key=existing_key.key_prefix,
        db=db,
    )

    chatflow.config = {
        **(chatflow.config or {}),
        "deployment": deployment_results["channels"],
    }
    db.commit()

    return _RedeployChannelsResponse(
        chatflow_id=str(chatflow.id),
        channels=deployment_results["channels"],
    )


# =============================================================================
# PER-CHANNEL CONFIGURATION (mirrors chatbot.py:974-1080 telegram pattern)
# =============================================================================
# A single PUT endpoint replaces six near-identical channel-specific routes
# while still merging at the per-channel level (so updating telegram does NOT
# clobber a previously-registered slack entry).


_VALID_CHANNEL_TYPES = {"website", "telegram", "discord", "slack", "whatsapp", "zapier"}
_CREDENTIAL_REQUIRED_CHANNELS = {"telegram", "discord", "whatsapp"}


class _ChannelUpdateRequest(BaseModel):
    enabled: bool = True
    credential_id: Optional[str] = None
    config: Optional[dict[str, Any]] = None  # Channel-specific extras


class _ChannelUpdateResponse(BaseModel):
    channel_type: str
    result: dict[str, Any]


@router.put(
    "/{chatflow_id}/channels/{channel_type}",
    response_model=_ChannelUpdateResponse,
)
async def update_chatflow_channel(
    chatflow_id: UUID,
    channel_type: str,
    request: _ChannelUpdateRequest,
    db: Session = Depends(get_db),
    user_context: UserContext = Depends(get_current_user_with_org),
):
    """Add / update / disable a single deployment channel for a chatflow.

    WHY: Users want to connect a Telegram bot (or rotate the credential)
         without round-tripping through the builder.
    HOW: Re-uses `_initialize_channels` for that one channel and merges the
         result into `chatflow.config["deployment"]` at the channel-level
         (preserving other channels' state).

    NOTE: Webhook registration calls external APIs synchronously. Expect a
          few seconds of latency on Telegram/Discord. Errors are surfaced
          directly to the caller rather than swallowed.
    """
    from app.models.api_key import APIKey

    _current_user, org_id, _ = user_context

    if channel_type not in _VALID_CHANNEL_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown channel type '{channel_type}'. Valid: {sorted(_VALID_CHANNEL_TYPES)}",
        )

    if (
        request.enabled
        and channel_type in _CREDENTIAL_REQUIRED_CHANNELS
        and not request.credential_id
    ):
        raise HTTPException(
            status_code=400,
            detail=f"Channel '{channel_type}' requires a credential_id.",
        )

    chatflow, _ws = _ensure_chatflow_access(db, chatflow_id, org_id)

    existing_key = db.query(APIKey).filter(
        APIKey.entity_id == chatflow.id,
        APIKey.entity_type == "chatflow",
        APIKey.is_active == True,
    ).first()
    if not existing_key:
        raise HTTPException(
            status_code=400,
            detail="No active API key for this chatflow. Regenerate one first.",
        )

    existing_deployment = (chatflow.config or {}).get("deployment") or {}
    # Normalize legacy / array shapes to an empty flat dict so the per-channel
    # merge below is well-defined. The redeploy endpoint exists for callers
    # who want to migrate a legacy row in bulk.
    if isinstance(existing_deployment, dict) and isinstance(
        existing_deployment.get("channels"), list
    ):
        existing_deployment = {}
    elif isinstance(existing_deployment, list):
        existing_deployment = {}

    if not request.enabled:
        # Disable: drop the channel entry from the flat dict. Webhooks
        # registered remotely are not yet automatically deregistered — that
        # is a follow-up. Removing the entry stops _resolve_bot from finding
        # it, so inbound traffic on a stale webhook will 4xx.
        new_deployment = {
            k: v for k, v in existing_deployment.items() if k != channel_type
        }
        chatflow.config = {**(chatflow.config or {}), "deployment": new_deployment}
        db.commit()
        return _ChannelUpdateResponse(
            channel_type=channel_type,
            result={"status": "disabled"},
        )

    channel_input: dict[str, Any] = {
        "type": channel_type,
        "enabled": True,
        "config": dict(request.config or {}),
    }
    if request.credential_id:
        channel_input["credential_id"] = request.credential_id
        # _initialize_channels also reads the credential from
        # config.bot_token / config.access_token as a fallback.
        if channel_type in ("telegram", "discord"):
            channel_input["config"].setdefault("bot_token", request.credential_id)
        elif channel_type == "whatsapp":
            channel_input["config"].setdefault("access_token", request.credential_id)

    try:
        deployment_results = draft_service._initialize_channels(
            entity_id=chatflow.id,
            entity_type="chatflow",
            deployment_config={"channels": [channel_input]},
            api_key=existing_key.key_prefix,
            db=db,
        )
    except Exception as e:
        # Per-channel errors are normally turned into status:"error" inside
        # _initialize_channels; reaching here means a setup-level failure.
        raise HTTPException(
            status_code=500,
            detail=f"Channel registration failed: {str(e)[:300]}",
        )

    channel_result = deployment_results.get("channels", {}).get(channel_type) or {
        "status": "error",
        "error": "Channel was not registered (unknown reason).",
    }

    # Merge at the per-channel level — do NOT replace the whole deployment
    # dict, that would clobber other already-registered channels.
    merged_deployment = {**existing_deployment, channel_type: channel_result}
    chatflow.config = {**(chatflow.config or {}), "deployment": merged_deployment}
    db.commit()

    return _ChannelUpdateResponse(channel_type=channel_type, result=channel_result)

