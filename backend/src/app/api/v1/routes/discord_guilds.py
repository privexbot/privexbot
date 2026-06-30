"""
Discord Guild Management Routes - API endpoints for managing Discord guild deployments.

WHY:
- Manage guild → chatbot mappings for shared bot architecture
- Deploy chatbots to Discord servers
- List/remove guild deployments
- Update channel restrictions

HOW:
- CRUD operations on DiscordGuildDeployment records
- Tenant isolation via workspace_id
- Integrates with discord_guild_service

Shared Bot Architecture:
- ONE Discord bot token serves ALL customers
- guild_id → chatbot_id mapping via DiscordGuildDeployment
- Messages route to correct chatbot based on guild
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
from app.models.discord_guild_deployment import DiscordGuildDeployment
from app.services.discord_guild_service import discord_guild_service
from app.core.config import settings

# Type alias for the user context tuple
UserContext = Tuple[User, str, str]  # (user, org_id, ws_id)

router = APIRouter(prefix="/discord/guilds", tags=["discord"])


# ═══════════════════════════════════════════════════════════════════════════
# REQUEST/RESPONSE MODELS
# ═══════════════════════════════════════════════════════════════════════════

class DeployToGuildRequest(BaseModel):
    """Request model for deploying chatbot to a Discord guild."""
    chatbot_id: UUID = Field(..., description="Chatbot ID to deploy")
    guild_id: str = Field(..., description="Discord server ID (snowflake)")
    guild_name: Optional[str] = Field(None, description="Discord server name (for display)")
    allowed_channel_ids: Optional[List[str]] = Field(
        None,
        description="List of channel IDs to respond in (empty = all channels)"
    )


class UpdateGuildDeploymentRequest(BaseModel):
    """Request model for updating a guild deployment."""
    allowed_channel_ids: Optional[List[str]] = Field(
        None,
        description="List of channel IDs to respond in (empty = all channels)"
    )
    is_active: Optional[bool] = Field(None, description="Whether deployment is active")


class ReassignGuildRequest(BaseModel):
    """Request model for reassigning a guild to a different chatbot."""
    new_chatbot_id: UUID = Field(..., description="New chatbot ID to assign")


class GuildDeploymentResponse(BaseModel):
    """Response model for guild deployment."""
    id: UUID
    workspace_id: UUID
    guild_id: str
    guild_name: Optional[str]
    guild_icon: Optional[str]
    chatbot_id: UUID
    chatbot_name: Optional[str] = None
    allowed_channel_ids: List[str]
    is_active: bool
    created_at: datetime
    deployed_at: Optional[datetime]

    class Config:
        from_attributes = True


class InviteUrlResponse(BaseModel):
    """Response model for bot invite URL."""
    invite_url: str
    application_id: str
    instructions: str


# ═══════════════════════════════════════════════════════════════════════════
# ROUTES
# ═══════════════════════════════════════════════════════════════════════════

# NOTE: The manual `POST /deploy` route was removed (multi-tenancy fix).
# A chatbot can only be bound to a Discord guild via the signed-OAuth callback
# (`webhooks/discord.py`), which proves the caller has Discord "Manage Server"
# rights on that guild and ties the binding to the authorizing workspace. This
# closes the cross-tenant guild-claim hole. The `deploy_to_guild` service method
# is still used by that callback.


@router.get("/", response_model=List[GuildDeploymentResponse])
async def list_guild_deployments(
    chatbot_id: Optional[UUID] = Query(None, description="Filter by chatbot ID"),
    active_only: bool = Query(False, description="Only return active deployments"),
    db: Session = Depends(get_db),
    user_context: UserContext = Depends(get_current_user_with_org)
):
    """
    List all guild deployments for the workspace.

    WHY: View which Discord servers are connected to chatbots
    HOW: Query DiscordGuildDeployment with optional filters

    ARGS (query):
        chatbot_id: Optional filter by chatbot
        active_only: If true, only return active deployments

    RETURNS:
        List of GuildDeploymentResponse
    """
    user, org_id, ws_id = user_context

    deployments = discord_guild_service.list_guild_deployments(
        db=db,
        workspace_id=UUID(ws_id),
        chatbot_id=chatbot_id,
        active_only=active_only
    )

    # Get chatbot names for response
    chatbot_ids = list(set(d.chatbot_id for d in deployments))
    chatbots = {c.id: c for c in db.query(Chatbot).filter(Chatbot.id.in_(chatbot_ids)).all()}

    return [
        GuildDeploymentResponse(
            id=d.id,
            workspace_id=d.workspace_id,
            guild_id=d.guild_id,
            guild_name=d.guild_name,
            guild_icon=d.guild_icon,
            chatbot_id=d.chatbot_id,
            chatbot_name=chatbots.get(d.chatbot_id, {}).name if chatbots.get(d.chatbot_id) else None,
            allowed_channel_ids=d.allowed_channel_ids or [],
            is_active=d.is_active,
            created_at=d.created_at,
            deployed_at=d.deployed_at
        )
        for d in deployments
    ]


# ═══════════════════════════════════════════════════════════════════════════
# STATIC ROUTES - Must be defined BEFORE parametric /{guild_id} routes
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/invite-url", response_model=InviteUrlResponse)
async def get_invite_url(
    chatbot_id: UUID = Query(..., description="Chatbot to auto-connect when the bot is added"),
    entity_type: str = Query("chatbot", description="'chatbot' or 'chatflow'"),
    user_context: UserContext = Depends(get_current_user_with_org)
):
    """
    Get the signed-OAuth invite URL for the shared Discord bot.

    WHY: Adding the bot now auto-connects it to `chatbot_id` for the caller's
         workspace via the OAuth callback — no manual server-ID step, and no
         way to bind a server you don't have Discord admin rights on.
    HOW: Generate an OAuth2 authorize URL whose HMAC-signed `state` carries
         entity_type + entity_id + workspace_id; the callback verifies the
         signature and creates the (workspace-scoped) deployment.
    """
    if not settings.DISCORD_SHARED_APPLICATION_ID:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Discord integration not configured. Contact administrator."
        )
    if entity_type not in ("chatbot", "chatflow"):
        raise HTTPException(status_code=400, detail="Invalid entity_type")

    user, org_id, ws_id = user_context
    try:
        invite_url = discord_guild_service.generate_invite_url(
            entity_type=entity_type,
            entity_id=chatbot_id,
            workspace_id=ws_id,
        )
        return InviteUrlResponse(
            invite_url=invite_url,
            application_id=settings.DISCORD_SHARED_APPLICATION_ID,
            instructions=(
                "1. Click the invite URL\n"
                "2. Pick your Discord server and authorize the bot\n"
                "3. Done — the bot connects to this chatbot automatically."
            )
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e)
        )


# NOTE: The `GET /available` route was removed (multi-tenancy fix). It listed
# EVERY guild the shared bot is in, minus globally-deployed ones, with no
# workspace scoping — leaking other tenants' servers. Connecting now happens via
# the signed-OAuth invite (`/invite-url` → callback), and the workspace's own
# connected servers are listed by `GET /` (`list_guild_deployments`, scoped).


# ═══════════════════════════════════════════════════════════════════════════
# PARAMETRIC ROUTES - /{guild_id} based routes
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/{guild_id}", response_model=GuildDeploymentResponse)
async def get_guild_deployment(
    guild_id: str,
    db: Session = Depends(get_db),
    user_context: UserContext = Depends(get_current_user_with_org)
):
    """
    Get details of a specific guild deployment.

    ARGS:
        guild_id: Discord server ID

    RETURNS:
        GuildDeploymentResponse
    """
    user, org_id, ws_id = user_context

    deployment = discord_guild_service.get_deployment(
        db=db,
        workspace_id=UUID(ws_id),
        guild_id=guild_id
    )

    if not deployment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Guild deployment not found"
        )

    chatbot = db.query(Chatbot).filter(Chatbot.id == deployment.chatbot_id).first()

    return GuildDeploymentResponse(
        id=deployment.id,
        workspace_id=deployment.workspace_id,
        guild_id=deployment.guild_id,
        guild_name=deployment.guild_name,
        guild_icon=deployment.guild_icon,
        chatbot_id=deployment.chatbot_id,
        chatbot_name=chatbot.name if chatbot else None,
        allowed_channel_ids=deployment.allowed_channel_ids or [],
        is_active=deployment.is_active,
        created_at=deployment.created_at,
        deployed_at=deployment.deployed_at
    )


@router.patch("/{guild_id}", response_model=GuildDeploymentResponse)
async def update_guild_deployment(
    guild_id: str,
    request: UpdateGuildDeploymentRequest,
    db: Session = Depends(get_db),
    user_context: UserContext = Depends(get_current_user_with_org)
):
    """
    Update a guild deployment (channel restrictions, active status).

    ARGS:
        guild_id: Discord server ID
        request: Fields to update

    RETURNS:
        Updated GuildDeploymentResponse
    """
    user, org_id, ws_id = user_context
    workspace_id = UUID(ws_id)

    # Handle channel restrictions update
    if request.allowed_channel_ids is not None:
        deployment = discord_guild_service.update_channel_restrictions(
            db=db,
            workspace_id=workspace_id,
            guild_id=guild_id,
            allowed_channel_ids=request.allowed_channel_ids
        )
    else:
        deployment = discord_guild_service.get_deployment(
            db=db,
            workspace_id=workspace_id,
            guild_id=guild_id
        )

    if not deployment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Guild deployment not found"
        )

    # Handle active status update
    if request.is_active is not None:
        if request.is_active:
            deployment = discord_guild_service.activate_guild(
                db=db,
                workspace_id=workspace_id,
                guild_id=guild_id
            )
        else:
            deployment = discord_guild_service.deactivate_guild(
                db=db,
                workspace_id=workspace_id,
                guild_id=guild_id
            )

    chatbot = db.query(Chatbot).filter(Chatbot.id == deployment.chatbot_id).first()

    return GuildDeploymentResponse(
        id=deployment.id,
        workspace_id=deployment.workspace_id,
        guild_id=deployment.guild_id,
        guild_name=deployment.guild_name,
        guild_icon=deployment.guild_icon,
        chatbot_id=deployment.chatbot_id,
        chatbot_name=chatbot.name if chatbot else None,
        allowed_channel_ids=deployment.allowed_channel_ids or [],
        is_active=deployment.is_active,
        created_at=deployment.created_at,
        deployed_at=deployment.deployed_at
    )


@router.post("/{guild_id}/reassign", response_model=GuildDeploymentResponse)
async def reassign_guild_chatbot(
    guild_id: str,
    request: ReassignGuildRequest,
    db: Session = Depends(get_db),
    user_context: UserContext = Depends(get_current_user_with_org)
):
    """
    Reassign a guild to a different chatbot.

    WHY: Change which chatbot handles a guild without removing and re-adding
    HOW: Update chatbot_id in deployment

    ARGS:
        guild_id: Discord server ID
        new_chatbot_id: New chatbot to assign

    RETURNS:
        Updated GuildDeploymentResponse
    """
    user, org_id, ws_id = user_context

    try:
        deployment = discord_guild_service.reassign_chatbot(
            db=db,
            workspace_id=UUID(ws_id),
            guild_id=guild_id,
            new_chatbot_id=request.new_chatbot_id
        )

        if not deployment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Guild deployment not found"
            )

        chatbot = db.query(Chatbot).filter(Chatbot.id == deployment.chatbot_id).first()

        return GuildDeploymentResponse(
            id=deployment.id,
            workspace_id=deployment.workspace_id,
            guild_id=deployment.guild_id,
            guild_name=deployment.guild_name,
            guild_icon=deployment.guild_icon,
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


@router.delete("/{guild_id}")
async def remove_guild_deployment(
    guild_id: str,
    db: Session = Depends(get_db),
    user_context: UserContext = Depends(get_current_user_with_org)
):
    """
    Remove guild deployment (disconnect chatbot from Discord server).

    WHY: Stop chatbot from responding to messages from this guild
    HOW: Delete DiscordGuildDeployment record

    ARGS:
        guild_id: Discord server ID to remove

    RETURNS:
        {"status": "removed", "guild_id": "..."}

    NOTE: This only removes the mapping. The Discord bot remains in the server.
          To fully remove the bot, the server admin must kick the bot.
    """
    user, org_id, ws_id = user_context

    removed = discord_guild_service.remove_guild(
        db=db,
        workspace_id=UUID(ws_id),
        guild_id=guild_id
    )

    if not removed:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Guild deployment not found"
        )

    return {
        "status": "removed",
        "guild_id": guild_id
    }


@router.post("/{guild_id}/activate")
async def activate_guild(
    guild_id: str,
    db: Session = Depends(get_db),
    user_context: UserContext = Depends(get_current_user_with_org)
):
    """
    Activate a paused guild deployment.

    WHY: Resume chatbot responses after temporary pause
    HOW: Set is_active = True

    RETURNS:
        {"status": "activated", "guild_id": "..."}
    """
    user, org_id, ws_id = user_context

    deployment = discord_guild_service.activate_guild(
        db=db,
        workspace_id=UUID(ws_id),
        guild_id=guild_id
    )

    if not deployment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Guild deployment not found"
        )

    return {
        "status": "activated",
        "guild_id": guild_id
    }


@router.post("/{guild_id}/deactivate")
async def deactivate_guild(
    guild_id: str,
    db: Session = Depends(get_db),
    user_context: UserContext = Depends(get_current_user_with_org)
):
    """
    Temporarily deactivate a guild deployment.

    WHY: Pause chatbot responses without removing deployment
    HOW: Set is_active = False

    RETURNS:
        {"status": "deactivated", "guild_id": "..."}
    """
    user, org_id, ws_id = user_context

    deployment = discord_guild_service.deactivate_guild(
        db=db,
        workspace_id=UUID(ws_id),
        guild_id=guild_id
    )

    if not deployment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Guild deployment not found"
        )

    return {
        "status": "deactivated",
        "guild_id": guild_id
    }


class ChannelInfo(BaseModel):
    """Response model for Discord channel info."""
    id: str
    name: str
    type: int
    position: int
    parent_id: Optional[str] = None


class ChannelListResponse(BaseModel):
    """Response model for list of channels."""
    guild_id: str
    channels: List[ChannelInfo]


@router.get("/{guild_id}/channels", response_model=ChannelListResponse)
async def get_guild_channels(
    guild_id: str,
    db: Session = Depends(get_db),
    user_context: UserContext = Depends(get_current_user_with_org)
):
    """
    Get list of text channels in a Discord guild.

    WHY: Allow users to select specific channels for the bot to respond in
    HOW: Call Discord API to fetch guild channels

    ARGS:
        guild_id: Discord server ID

    RETURNS:
        ChannelListResponse with list of text channels

    NOTE: Bot must be in the server to fetch channels.
          Returns only text channels (type 0) and announcement channels (type 5).
    """
    user, org_id, ws_id = user_context

    # Verify user has a deployment for this guild
    deployment = discord_guild_service.get_deployment(
        db=db,
        workspace_id=UUID(ws_id),
        guild_id=guild_id
    )

    if not deployment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Guild deployment not found. Deploy to this guild first."
        )

    # Fetch channels from Discord API
    channels = await discord_guild_service.fetch_guild_channels(guild_id)

    if channels is None:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to fetch channels from Discord. The bot may not be in this server."
        )

    return ChannelListResponse(
        guild_id=guild_id,
        channels=[
            ChannelInfo(
                id=ch["id"],
                name=ch["name"],
                type=ch["type"],
                position=ch["position"],
                parent_id=ch.get("parent_id")
            )
            for ch in channels
        ]
    )
