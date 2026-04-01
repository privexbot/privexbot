"""
Slack Workspace Management Routes - API endpoints for managing Slack workspace deployments.

WHY:
- Manage workspace -> chatbot mappings for shared bot architecture
- Deploy chatbots to Slack workspaces
- List/remove workspace deployments
- Update channel restrictions

HOW:
- CRUD operations on SlackWorkspaceDeployment records
- Tenant isolation via workspace_id
- Integrates with slack_workspace_service

Shared Bot Architecture:
- ONE Slack app installed to ALL customer workspaces
- team_id -> chatbot_id mapping via SlackWorkspaceDeployment
- Messages route to correct chatbot based on workspace
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional, Tuple
from uuid import UUID
from pydantic import BaseModel, Field
from datetime import datetime

from app.db.session import get_db
from app.api.v1.dependencies import get_current_user, get_current_user_with_org
from app.models.user import User
from app.models.chatbot import Chatbot, ChatbotStatus
from app.models.slack_workspace_deployment import SlackWorkspaceDeployment
from app.services.slack_workspace_service import slack_workspace_service
from app.core.config import settings

# Type alias for the user context tuple
UserContext = Tuple[User, str, str]  # (user, org_id, ws_id)

router = APIRouter(prefix="/slack/workspaces", tags=["slack"])


# ═══════════════════════════════════════════════════════════════════════════
# REQUEST/RESPONSE MODELS
# ═══════════════════════════════════════════════════════════════════════════

class DeployToWorkspaceRequest(BaseModel):
    """Request model for deploying chatbot to a Slack workspace."""
    chatbot_id: UUID = Field(..., description="Chatbot ID to deploy")
    team_id: str = Field(..., description="Slack workspace ID (e.g., T0123456789)")
    team_name: Optional[str] = Field(None, description="Slack workspace name (for display)")
    allowed_channel_ids: Optional[List[str]] = Field(
        None,
        description="List of channel IDs to respond in (empty = all channels)"
    )


class UpdateWorkspaceDeploymentRequest(BaseModel):
    """Request model for updating a workspace deployment."""
    allowed_channel_ids: Optional[List[str]] = Field(
        None,
        description="List of channel IDs to respond in (empty = all channels)"
    )
    is_active: Optional[bool] = Field(None, description="Whether deployment is active")


class ReassignWorkspaceRequest(BaseModel):
    """Request model for reassigning a workspace to a different chatbot."""
    new_chatbot_id: UUID = Field(..., description="New chatbot ID to assign")


class WorkspaceDeploymentResponse(BaseModel):
    """Response model for workspace deployment."""
    id: UUID
    workspace_id: UUID
    team_id: str
    team_name: Optional[str]
    team_domain: Optional[str]
    team_icon: Optional[str]
    chatbot_id: UUID
    chatbot_name: Optional[str] = None
    allowed_channel_ids: List[str]
    is_active: bool
    created_at: datetime
    deployed_at: Optional[datetime]

    class Config:
        from_attributes = True


class InstallUrlResponse(BaseModel):
    """Response model for Slack app install URL."""
    install_url: str
    instructions: str


# ═══════════════════════════════════════════════════════════════════════════
# ROUTES
# ═══════════════════════════════════════════════════════════════════════════

@router.post("/deploy", response_model=WorkspaceDeploymentResponse)
async def deploy_to_workspace(
    request: DeployToWorkspaceRequest,
    db: Session = Depends(get_db),
    user_context: UserContext = Depends(get_current_user_with_org)
):
    """
    Deploy chatbot to a Slack workspace.

    FLOW:
    1. Verify chatbot belongs to user's workspace
    2. Check workspace not already deployed
    3. Create deployment record
    4. Return deployment details

    NOTE: The Slack app must already be installed to the workspace
          via the OAuth install flow (GET /slack/workspaces/install-url).
    """
    user, org_id, ws_id = user_context

    try:
        deployment = slack_workspace_service.deploy_to_workspace(
            db=db,
            workspace_id=UUID(ws_id),
            chatbot_id=request.chatbot_id,
            team_id=request.team_id,
            user_id=user.id,
            team_name=request.team_name,
            allowed_channel_ids=request.allowed_channel_ids or []
        )

        chatbot = db.query(Chatbot).filter(Chatbot.id == deployment.chatbot_id).first()

        return WorkspaceDeploymentResponse(
            id=deployment.id,
            workspace_id=deployment.workspace_id,
            team_id=deployment.team_id,
            team_name=deployment.team_name,
            team_domain=deployment.team_domain,
            team_icon=deployment.team_icon,
            chatbot_id=deployment.chatbot_id,
            chatbot_name=chatbot.name if chatbot else None,
            allowed_channel_ids=deployment.allowed_channel_ids or [],
            is_active=deployment.is_active,
            created_at=deployment.created_at,
            deployed_at=deployment.deployed_at
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/", response_model=List[WorkspaceDeploymentResponse])
async def list_workspace_deployments(
    chatbot_id: Optional[UUID] = Query(None, description="Filter by chatbot ID"),
    active_only: bool = Query(False, description="Only return active deployments"),
    db: Session = Depends(get_db),
    user_context: UserContext = Depends(get_current_user_with_org)
):
    """List all Slack workspace deployments for the workspace."""
    user, org_id, ws_id = user_context

    deployments = slack_workspace_service.list_workspace_deployments(
        db=db,
        workspace_id=UUID(ws_id),
        chatbot_id=chatbot_id,
        active_only=active_only
    )

    chatbot_ids = list(set(d.chatbot_id for d in deployments))
    chatbots = {c.id: c for c in db.query(Chatbot).filter(Chatbot.id.in_(chatbot_ids)).all()} if chatbot_ids else {}

    return [
        WorkspaceDeploymentResponse(
            id=d.id,
            workspace_id=d.workspace_id,
            team_id=d.team_id,
            team_name=d.team_name,
            team_domain=d.team_domain,
            team_icon=d.team_icon,
            chatbot_id=d.chatbot_id,
            chatbot_name=chatbots[d.chatbot_id].name if d.chatbot_id in chatbots else None,
            allowed_channel_ids=d.allowed_channel_ids or [],
            is_active=d.is_active,
            created_at=d.created_at,
            deployed_at=d.deployed_at
        )
        for d in deployments
    ]


# ═══════════════════════════════════════════════════════════════════════════
# STATIC ROUTES - Must be defined BEFORE parametric /{team_id} routes
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/install-url", response_model=InstallUrlResponse)
async def get_install_url(
    chatbot_id: Optional[UUID] = Query(None, description="Chatbot ID to auto-associate after install"),
    user_context: UserContext = Depends(get_current_user_with_org)
):
    """
    Get the install URL for the shared Slack app.

    WHY: Users need to install the Slack app to their workspace before deploying
    HOW: Generate Slack OAuth authorize URL with required bot scopes

    NOTE: Pass chatbot_id to auto-associate the installation with a chatbot.
    """
    if not settings.SLACK_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Slack integration not configured. Contact administrator."
        )

    user, org_id, ws_id = user_context

    # Build state parameter for auto-association
    redirect_uri = None
    if chatbot_id:
        # State will be passed through OAuth flow and returned in callback
        # The callback handler uses this to auto-create the deployment
        pass

    try:
        install_url = slack_workspace_service.generate_install_url(redirect_uri=redirect_uri)

        # Append state parameter if chatbot_id provided
        if chatbot_id:
            install_url += f"&state={ws_id}:{chatbot_id}"

        return InstallUrlResponse(
            install_url=install_url,
            instructions=(
                "1. Click the install URL to add the PrivexBot app to your Slack workspace\n"
                "2. Select the workspace and authorize the app\n"
                "3. The app will be automatically connected after authorization\n"
                "4. Use POST /slack/workspaces/deploy to connect a chatbot to the workspace"
            )
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e)
        )


# ═══════════════════════════════════════════════════════════════════════════
# PARAMETRIC ROUTES
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/{team_id}", response_model=WorkspaceDeploymentResponse)
async def get_workspace_deployment(
    team_id: str,
    db: Session = Depends(get_db),
    user_context: UserContext = Depends(get_current_user_with_org)
):
    """Get a specific Slack workspace deployment."""
    user, org_id, ws_id = user_context

    deployment = slack_workspace_service.get_deployment(
        db=db,
        workspace_id=UUID(ws_id),
        team_id=team_id
    )

    if not deployment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No deployment found for Slack workspace {team_id}"
        )

    chatbot = db.query(Chatbot).filter(Chatbot.id == deployment.chatbot_id).first()

    return WorkspaceDeploymentResponse(
        id=deployment.id,
        workspace_id=deployment.workspace_id,
        team_id=deployment.team_id,
        team_name=deployment.team_name,
        team_domain=deployment.team_domain,
        team_icon=deployment.team_icon,
        chatbot_id=deployment.chatbot_id,
        chatbot_name=chatbot.name if chatbot else None,
        allowed_channel_ids=deployment.allowed_channel_ids or [],
        is_active=deployment.is_active,
        created_at=deployment.created_at,
        deployed_at=deployment.deployed_at
    )


@router.patch("/{team_id}", response_model=WorkspaceDeploymentResponse)
async def update_workspace_deployment(
    team_id: str,
    request: UpdateWorkspaceDeploymentRequest,
    db: Session = Depends(get_db),
    user_context: UserContext = Depends(get_current_user_with_org)
):
    """Update a Slack workspace deployment (channel restrictions, active status)."""
    user, org_id, ws_id = user_context

    deployment = slack_workspace_service.get_deployment(
        db=db,
        workspace_id=UUID(ws_id),
        team_id=team_id
    )

    if not deployment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No deployment found for Slack workspace {team_id}"
        )

    if request.allowed_channel_ids is not None:
        slack_workspace_service.update_channel_restrictions(
            db=db,
            workspace_id=UUID(ws_id),
            team_id=team_id,
            allowed_channel_ids=request.allowed_channel_ids
        )

    if request.is_active is not None:
        if request.is_active:
            slack_workspace_service.activate_workspace(db, UUID(ws_id), team_id)
        else:
            slack_workspace_service.deactivate_workspace(db, UUID(ws_id), team_id)

    # Refresh
    deployment = slack_workspace_service.get_deployment(db, UUID(ws_id), team_id)
    chatbot = db.query(Chatbot).filter(Chatbot.id == deployment.chatbot_id).first()

    return WorkspaceDeploymentResponse(
        id=deployment.id,
        workspace_id=deployment.workspace_id,
        team_id=deployment.team_id,
        team_name=deployment.team_name,
        team_domain=deployment.team_domain,
        team_icon=deployment.team_icon,
        chatbot_id=deployment.chatbot_id,
        chatbot_name=chatbot.name if chatbot else None,
        allowed_channel_ids=deployment.allowed_channel_ids or [],
        is_active=deployment.is_active,
        created_at=deployment.created_at,
        deployed_at=deployment.deployed_at
    )


@router.delete("/{team_id}")
async def remove_workspace_deployment(
    team_id: str,
    db: Session = Depends(get_db),
    user_context: UserContext = Depends(get_current_user_with_org)
):
    """Remove a Slack workspace deployment."""
    user, org_id, ws_id = user_context

    removed = slack_workspace_service.remove_workspace(
        db=db,
        workspace_id=UUID(ws_id),
        team_id=team_id
    )

    if not removed:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No deployment found for Slack workspace {team_id}"
        )

    return {"detail": f"Slack workspace {team_id} deployment removed"}


@router.post("/{team_id}/activate", response_model=WorkspaceDeploymentResponse)
async def activate_workspace(
    team_id: str,
    db: Session = Depends(get_db),
    user_context: UserContext = Depends(get_current_user_with_org)
):
    """Activate a Slack workspace deployment."""
    user, org_id, ws_id = user_context

    deployment = slack_workspace_service.activate_workspace(db, UUID(ws_id), team_id)

    if not deployment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No deployment found for Slack workspace {team_id}"
        )

    chatbot = db.query(Chatbot).filter(Chatbot.id == deployment.chatbot_id).first()

    return WorkspaceDeploymentResponse(
        id=deployment.id,
        workspace_id=deployment.workspace_id,
        team_id=deployment.team_id,
        team_name=deployment.team_name,
        team_domain=deployment.team_domain,
        team_icon=deployment.team_icon,
        chatbot_id=deployment.chatbot_id,
        chatbot_name=chatbot.name if chatbot else None,
        allowed_channel_ids=deployment.allowed_channel_ids or [],
        is_active=deployment.is_active,
        created_at=deployment.created_at,
        deployed_at=deployment.deployed_at
    )


@router.post("/{team_id}/deactivate", response_model=WorkspaceDeploymentResponse)
async def deactivate_workspace(
    team_id: str,
    db: Session = Depends(get_db),
    user_context: UserContext = Depends(get_current_user_with_org)
):
    """Deactivate a Slack workspace deployment."""
    user, org_id, ws_id = user_context

    deployment = slack_workspace_service.deactivate_workspace(db, UUID(ws_id), team_id)

    if not deployment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No deployment found for Slack workspace {team_id}"
        )

    chatbot = db.query(Chatbot).filter(Chatbot.id == deployment.chatbot_id).first()

    return WorkspaceDeploymentResponse(
        id=deployment.id,
        workspace_id=deployment.workspace_id,
        team_id=deployment.team_id,
        team_name=deployment.team_name,
        team_domain=deployment.team_domain,
        team_icon=deployment.team_icon,
        chatbot_id=deployment.chatbot_id,
        chatbot_name=chatbot.name if chatbot else None,
        allowed_channel_ids=deployment.allowed_channel_ids or [],
        is_active=deployment.is_active,
        created_at=deployment.created_at,
        deployed_at=deployment.deployed_at
    )


@router.post("/{team_id}/reassign", response_model=WorkspaceDeploymentResponse)
async def reassign_workspace(
    team_id: str,
    request: ReassignWorkspaceRequest,
    db: Session = Depends(get_db),
    user_context: UserContext = Depends(get_current_user_with_org)
):
    """Reassign a Slack workspace to a different chatbot."""
    user, org_id, ws_id = user_context

    try:
        deployment = slack_workspace_service.reassign_chatbot(
            db=db,
            workspace_id=UUID(ws_id),
            team_id=team_id,
            new_chatbot_id=request.new_chatbot_id
        )

        if not deployment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No deployment found for Slack workspace {team_id}"
            )

        chatbot = db.query(Chatbot).filter(Chatbot.id == deployment.chatbot_id).first()

        return WorkspaceDeploymentResponse(
            id=deployment.id,
            workspace_id=deployment.workspace_id,
            team_id=deployment.team_id,
            team_name=deployment.team_name,
            team_domain=deployment.team_domain,
            team_icon=deployment.team_icon,
            chatbot_id=deployment.chatbot_id,
            chatbot_name=chatbot.name if chatbot else None,
            allowed_channel_ids=deployment.allowed_channel_ids or [],
            is_active=deployment.is_active,
            created_at=deployment.created_at,
            deployed_at=deployment.deployed_at
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/{team_id}/channels")
async def get_workspace_channels(
    team_id: str,
    db: Session = Depends(get_db),
    user_context: UserContext = Depends(get_current_user_with_org)
):
    """
    List channels in a Slack workspace.

    WHY: Allow users to select specific channels for the bot to respond in
    HOW: Call Slack API conversations.list with the deployment's bot token
    """
    user, org_id, ws_id = user_context

    deployment = slack_workspace_service.get_deployment(
        db=db,
        workspace_id=UUID(ws_id),
        team_id=team_id
    )

    if not deployment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No deployment found for Slack workspace {team_id}"
        )

    if not deployment.bot_token_encrypted:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No bot token available for this workspace. Re-install the Slack app."
        )

    channels = await slack_workspace_service.fetch_team_channels(
        bot_token=deployment.bot_token_encrypted
    )

    if channels is None:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to fetch channels from Slack API"
        )

    return {
        "channels": channels,
        "total": len(channels)
    }
