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

@router.post("/deploy", response_model=GuildDeploymentResponse)
async def deploy_to_guild(
    request: DeployToGuildRequest,
    db: Session = Depends(get_db),
    user_context: UserContext = Depends(get_current_user_with_org)
):
    """
    Deploy chatbot to a Discord guild (server).

    WHY: Enable chatbot to receive messages from Discord server
    HOW: Create DiscordGuildDeployment mapping guild → chatbot

    FLOW:
    1. Verify chatbot belongs to user's workspace
    2. Check guild not already deployed
    3. Create deployment record
    4. Return deployment details

    ARGS (body):
        chatbot_id: Chatbot to deploy
        guild_id: Discord server ID
        guild_name: Optional server name for display
        allowed_channel_ids: Optional channel restrictions

    RETURNS:
        GuildDeploymentResponse with deployment details

    NOTE: User must first add the shared bot to their Discord server
          using the invite URL from GET /discord/guilds/invite-url
    """
    user, org_id, ws_id = user_context

    try:
        deployment = discord_guild_service.deploy_to_guild(
            db=db,
            workspace_id=UUID(ws_id),
            chatbot_id=request.chatbot_id,
            guild_id=request.guild_id,
            user_id=user.id,
            guild_name=request.guild_name,
            allowed_channel_ids=request.allowed_channel_ids or []
        )

        # Get chatbot name for response
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
    user_context: UserContext = Depends(get_current_user_with_org)
):
    """
    Get the invite URL for the shared Discord bot.

    WHY: Users need to add the shared bot to their server before deploying
    HOW: Generate OAuth2 authorize URL with required permissions

    RETURNS:
        InviteUrlResponse with invite URL and instructions

    NOTE: After adding the bot, user must call POST /discord/guilds/deploy
          with their guild_id to connect a chatbot.
    """
    if not settings.DISCORD_SHARED_APPLICATION_ID:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Discord integration not configured. Contact administrator."
        )

    try:
        invite_url = discord_guild_service.generate_invite_url()
        return InviteUrlResponse(
            invite_url=invite_url,
            application_id=settings.DISCORD_SHARED_APPLICATION_ID,
            instructions=(
                "1. Click the invite URL to add the bot to your Discord server\n"
                "2. Select the server and authorize the bot\n"
                "3. Copy your server ID (enable Developer Mode in Discord settings)\n"
                "4. Use POST /discord/guilds/deploy with your chatbot_id and guild_id"
            )
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e)
        )


class AvailableGuildInfo(BaseModel):
    """Response model for an available Discord guild."""
    guild_id: str
    guild_name: str
    guild_icon: Optional[str] = None


class AvailableGuildsResponse(BaseModel):
    """Response model for list of available guilds."""
    guilds: List[AvailableGuildInfo]
    message: str
    error: Optional[str] = None  # Error details for troubleshooting


@router.get("/available", response_model=AvailableGuildsResponse)
async def get_available_guilds(
    refresh: bool = Query(False, description="Force refresh cache (bypass 60s cache)"),
    db: Session = Depends(get_db),
    user_context: UserContext = Depends(get_current_user_with_org)
):
    """
    Get list of Discord servers where bot is present but not yet deployed.

    WHY: Auto-detect servers for better UX (no manual guild_id entry)
    HOW: Fetch guilds from Discord API, filter out already deployed ones

    ARGS (query):
        refresh: If true, bypass cache and fetch fresh data from Discord API

    RETURNS:
        AvailableGuildsResponse with list of available guilds

    FLOW:
    1. Fetch all guilds where shared bot is present (Discord API, cached 60s)
    2. Get already deployed guilds for this workspace
    3. Return guilds that are available (present but not deployed)

    CACHING:
        Results are cached for 60 seconds to prevent Discord rate limits.
        Use ?refresh=true after adding bot to a new server.

    NOTE: If a guild is already deployed to another workspace, it won't appear
          in this list (guild_id is globally unique in deployments).
    """
    user, org_id, ws_id = user_context

    # Fetch all guilds where bot is present (cached unless refresh=true)
    all_guilds, fetch_error = await discord_guild_service.fetch_bot_guilds(force_refresh=refresh)

    # If there was an error fetching guilds, return it for troubleshooting
    if fetch_error:
        return AvailableGuildsResponse(
            guilds=[],
            message="Failed to fetch Discord servers.",
            error=fetch_error
        )

    if not all_guilds:
        return AvailableGuildsResponse(
            guilds=[],
            message="No servers found. Add the bot to a Discord server first using the invite URL.",
            error=None
        )

    # Get ALL deployed guilds (globally, since guild_id is unique)
    from app.models.discord_guild_deployment import DiscordGuildDeployment
    deployed_guild_ids = set(
        d.guild_id for d in db.query(DiscordGuildDeployment.guild_id).all()
    )

    # Filter out already deployed guilds
    available = [
        AvailableGuildInfo(
            guild_id=g["guild_id"],
            guild_name=g["guild_name"],
            guild_icon=g["guild_icon"]
        )
        for g in all_guilds
        if g["guild_id"] not in deployed_guild_ids
    ]

    if not available:
        return AvailableGuildsResponse(
            guilds=[],
            message="All servers with the bot are already connected. Add the bot to another server or remove an existing connection.",
            error=None
        )

    return AvailableGuildsResponse(
        guilds=available,
        message=f"Found {len(available)} available server(s).",
        error=None
    )


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
