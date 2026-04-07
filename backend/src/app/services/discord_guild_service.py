"""
Discord Guild Deployment Service - Manage Discord guild deployments for shared bot architecture.

WHY:
- Shared bot architecture: ONE Discord bot serves ALL customers
- Map Discord guilds (servers) to chatbots
- Route messages to correct chatbot based on guild_id
- Multi-tenant isolation via workspace

HOW:
- Create/manage DiscordGuildDeployment records
- Lookup chatbot for guild_id (message routing)
- List deployments for workspace/chatbot
- Handle deployment lifecycle (activate/deactivate/remove)

Architecture:
- Shared Discord Bot receives message with guild_id
- Service looks up DiscordGuildDeployment by guild_id
- Returns chatbot to process the message
- Supports channel restrictions per deployment
"""

from datetime import datetime
from typing import Optional, List, Tuple, Dict, Any
from uuid import UUID
import httpx
import json
import logging
import redis

from sqlalchemy.orm import Session

from app.models.discord_guild_deployment import DiscordGuildDeployment
from app.models.chatbot import Chatbot, ChatbotStatus
from app.models.workspace import Workspace
from app.core.config import settings

# Redis cache configuration for Discord API responses
GUILDS_CACHE_KEY = "discord:bot:guilds"
GUILDS_CACHE_TTL = 60  # 60 seconds - balances freshness vs rate limits

logger = logging.getLogger(__name__)


class DiscordGuildService:
    """
    Manage Discord guild deployments for shared bot architecture.

    WHY: Route Discord messages to correct chatbot based on guild
    HOW: DiscordGuildDeployment model maps guild_id → chatbot_id
    """

    def deploy_to_guild(
        self,
        db: Session,
        workspace_id: UUID,
        chatbot_id: UUID,
        guild_id: str,
        user_id: UUID = None,
        guild_name: str = None,
        guild_icon: str = None,
        allowed_channel_ids: List[str] = None
    ) -> DiscordGuildDeployment:
        """
        Deploy chatbot to a Discord guild (server).

        WHY: Enable chatbot to receive messages from Discord server
        HOW: Create DiscordGuildDeployment record mapping guild → chatbot

        ARGS:
            db: Database session
            workspace_id: Workspace ID (for tenant isolation)
            chatbot_id: Chatbot ID to deploy
            guild_id: Discord server ID (snowflake)
            user_id: User creating the deployment
            guild_name: Discord server name (cached for display)
            guild_icon: Discord server icon URL
            allowed_channel_ids: Optional list of channel IDs to respond in (empty = all)

        RETURNS:
            Created DiscordGuildDeployment instance

        RAISES:
            ValueError: If chatbot not found, wrong workspace, or guild already deployed
        """
        # Verify chatbot belongs to workspace
        chatbot = db.query(Chatbot).filter(
            Chatbot.id == chatbot_id,
            Chatbot.workspace_id == workspace_id
        ).first()

        if not chatbot:
            raise ValueError("Chatbot not found in this workspace")

        # Check chatbot is active
        if chatbot.status != ChatbotStatus.ACTIVE:
            raise ValueError(f"Chatbot must be active to deploy (current status: {chatbot.status})")

        # Check guild not already deployed
        existing = db.query(DiscordGuildDeployment).filter(
            DiscordGuildDeployment.guild_id == guild_id
        ).first()

        if existing:
            if existing.workspace_id == workspace_id:
                raise ValueError(f"Guild {guild_id} is already deployed to chatbot {existing.chatbot_id}")
            else:
                raise ValueError(f"Guild {guild_id} is already deployed to another workspace")

        # Create deployment record
        deployment = DiscordGuildDeployment(
            workspace_id=workspace_id,
            guild_id=guild_id,
            guild_name=guild_name,
            guild_icon=guild_icon,
            chatbot_id=chatbot_id,
            allowed_channel_ids=allowed_channel_ids or [],
            is_active=True,
            created_by=user_id,
            deployed_at=datetime.utcnow()
        )

        db.add(deployment)
        db.commit()
        db.refresh(deployment)

        return deployment

    def get_chatbot_for_guild(
        self,
        db: Session,
        guild_id: str
    ) -> Optional[Tuple[Chatbot, DiscordGuildDeployment]]:
        """
        Lookup which chatbot handles a guild's messages.

        WHY: Route incoming Discord messages to correct chatbot
        HOW: Find active deployment for guild_id

        ARGS:
            db: Database session
            guild_id: Discord server ID

        RETURNS:
            Tuple of (Chatbot, DiscordGuildDeployment) or None if not found
        """
        deployment = db.query(DiscordGuildDeployment).filter(
            DiscordGuildDeployment.guild_id == guild_id,
            DiscordGuildDeployment.is_active == True
        ).first()

        if not deployment:
            return None

        chatbot = db.query(Chatbot).filter(
            Chatbot.id == deployment.chatbot_id,
            Chatbot.status == ChatbotStatus.ACTIVE
        ).first()

        if not chatbot:
            return None

        return (chatbot, deployment)

    def get_entity_for_guild(
        self,
        db: Session,
        guild_id: str
    ) -> Optional[Tuple[str, Any, DiscordGuildDeployment]]:
        """
        Lookup chatbot OR chatflow for a guild's messages.

        WHY: Support both chatbots and chatflows in Discord shared bot
        HOW: Check chatbot table first, then chatflow table by chatbot_id

        RETURNS:
            Tuple of (bot_type, entity, deployment) or None
        """
        deployment = db.query(DiscordGuildDeployment).filter(
            DiscordGuildDeployment.guild_id == guild_id,
            DiscordGuildDeployment.is_active == True
        ).first()

        if not deployment:
            return None

        # Try chatbot first (primary use case)
        chatbot = db.query(Chatbot).filter(
            Chatbot.id == deployment.chatbot_id,
            Chatbot.status == ChatbotStatus.ACTIVE
        ).first()

        if chatbot:
            return ("chatbot", chatbot, deployment)

        # Try chatflow (chatbot_id may reference a chatflow)
        from app.models.chatflow import Chatflow
        chatflow = db.query(Chatflow).filter(
            Chatflow.id == deployment.chatbot_id,
            Chatflow.is_active == True
        ).first()

        if chatflow:
            return ("chatflow", chatflow, deployment)

        return None

    def remove_guild(
        self,
        db: Session,
        workspace_id: UUID,
        guild_id: str
    ) -> bool:
        """
        Remove guild deployment.

        WHY: Stop chatbot from responding to guild
        HOW: Delete deployment record

        ARGS:
            db: Database session
            workspace_id: Workspace ID (for tenant isolation)
            guild_id: Discord server ID to remove

        RETURNS:
            True if removed, False if not found
        """
        deployment = db.query(DiscordGuildDeployment).filter(
            DiscordGuildDeployment.guild_id == guild_id,
            DiscordGuildDeployment.workspace_id == workspace_id
        ).first()

        if not deployment:
            return False

        db.delete(deployment)
        db.commit()
        return True

    def deactivate_guild(
        self,
        db: Session,
        workspace_id: UUID,
        guild_id: str
    ) -> Optional[DiscordGuildDeployment]:
        """
        Temporarily deactivate guild deployment.

        WHY: Pause chatbot responses without deleting deployment
        HOW: Set is_active = False

        ARGS:
            db: Database session
            workspace_id: Workspace ID (for tenant isolation)
            guild_id: Discord server ID

        RETURNS:
            Updated deployment or None if not found
        """
        deployment = db.query(DiscordGuildDeployment).filter(
            DiscordGuildDeployment.guild_id == guild_id,
            DiscordGuildDeployment.workspace_id == workspace_id
        ).first()

        if not deployment:
            return None

        deployment.is_active = False
        db.commit()
        db.refresh(deployment)
        return deployment

    def activate_guild(
        self,
        db: Session,
        workspace_id: UUID,
        guild_id: str
    ) -> Optional[DiscordGuildDeployment]:
        """
        Reactivate guild deployment.

        WHY: Resume chatbot responses after pause
        HOW: Set is_active = True

        ARGS:
            db: Database session
            workspace_id: Workspace ID (for tenant isolation)
            guild_id: Discord server ID

        RETURNS:
            Updated deployment or None if not found
        """
        deployment = db.query(DiscordGuildDeployment).filter(
            DiscordGuildDeployment.guild_id == guild_id,
            DiscordGuildDeployment.workspace_id == workspace_id
        ).first()

        if not deployment:
            return None

        deployment.is_active = True
        deployment.deployed_at = datetime.utcnow()
        db.commit()
        db.refresh(deployment)
        return deployment

    def update_channel_restrictions(
        self,
        db: Session,
        workspace_id: UUID,
        guild_id: str,
        allowed_channel_ids: List[str]
    ) -> Optional[DiscordGuildDeployment]:
        """
        Update which channels the bot responds in.

        WHY: Limit bot to specific channels in a guild
        HOW: Update allowed_channel_ids list

        ARGS:
            db: Database session
            workspace_id: Workspace ID (for tenant isolation)
            guild_id: Discord server ID
            allowed_channel_ids: List of channel IDs (empty = all channels)

        RETURNS:
            Updated deployment or None if not found
        """
        deployment = db.query(DiscordGuildDeployment).filter(
            DiscordGuildDeployment.guild_id == guild_id,
            DiscordGuildDeployment.workspace_id == workspace_id
        ).first()

        if not deployment:
            return None

        deployment.allowed_channel_ids = allowed_channel_ids
        db.commit()
        db.refresh(deployment)
        return deployment

    def list_guild_deployments(
        self,
        db: Session,
        workspace_id: UUID,
        chatbot_id: UUID = None,
        active_only: bool = False
    ) -> List[DiscordGuildDeployment]:
        """
        List all guild deployments for workspace/chatbot.

        WHY: Display deployed guilds in dashboard
        HOW: Query deployments with optional filters

        ARGS:
            db: Database session
            workspace_id: Workspace ID (required for tenant isolation)
            chatbot_id: Optional filter by chatbot
            active_only: If True, only return active deployments

        RETURNS:
            List of DiscordGuildDeployment records
        """
        query = db.query(DiscordGuildDeployment).filter(
            DiscordGuildDeployment.workspace_id == workspace_id
        )

        if chatbot_id:
            query = query.filter(DiscordGuildDeployment.chatbot_id == chatbot_id)

        if active_only:
            query = query.filter(DiscordGuildDeployment.is_active == True)

        return query.order_by(DiscordGuildDeployment.created_at.desc()).all()

    def get_deployment(
        self,
        db: Session,
        workspace_id: UUID,
        guild_id: str
    ) -> Optional[DiscordGuildDeployment]:
        """
        Get a specific guild deployment.

        ARGS:
            db: Database session
            workspace_id: Workspace ID (for tenant isolation)
            guild_id: Discord server ID

        RETURNS:
            DiscordGuildDeployment or None if not found
        """
        return db.query(DiscordGuildDeployment).filter(
            DiscordGuildDeployment.guild_id == guild_id,
            DiscordGuildDeployment.workspace_id == workspace_id
        ).first()

    def update_guild_metadata(
        self,
        db: Session,
        guild_id: str,
        metadata_updates: Dict[str, Any]
    ) -> Optional[DiscordGuildDeployment]:
        """
        Update guild metadata (e.g., after receiving a message).

        WHY: Track usage stats, last message time, etc.
        HOW: Merge new metadata with existing

        ARGS:
            db: Database session
            guild_id: Discord server ID
            metadata_updates: Dict of metadata to update/add

        RETURNS:
            Updated deployment or None if not found
        """
        deployment = db.query(DiscordGuildDeployment).filter(
            DiscordGuildDeployment.guild_id == guild_id
        ).first()

        if not deployment:
            return None

        # Merge metadata
        existing_metadata = deployment.guild_metadata or {}
        existing_metadata.update(metadata_updates)
        deployment.guild_metadata = existing_metadata

        db.commit()
        db.refresh(deployment)
        return deployment

    def generate_invite_url(self) -> str:
        """
        Generate Discord bot invite URL for shared bot.

        WHY: Users need to add the shared bot to their server
        HOW: Use environment-configured application ID

        RETURNS:
            Discord OAuth2 invite URL
        """
        application_id = settings.DISCORD_SHARED_APPLICATION_ID

        if not application_id:
            raise ValueError("DISCORD_SHARED_APPLICATION_ID not configured")

        # Permission bits for a support/chat bot:
        # - View Channels (1024) - Required to see messages
        # - Send Messages (2048) - Required to reply
        # - Embed Links (16384) - Rich formatted responses
        # - Attach Files (32768) - Share documents/images
        # - Read Message History (65536) - Context for conversations
        # - Add Reactions (64) - Feedback UI
        # - Use Slash Commands (2147483648) - /ask, /chat commands
        permissions = 1024 | 2048 | 16384 | 32768 | 65536 | 64 | 2147483648

        scopes = "bot+applications.commands"

        return f"https://discord.com/api/oauth2/authorize?client_id={application_id}&permissions={permissions}&scope={scopes}"

    async def fetch_bot_guilds(self, force_refresh: bool = False) -> Tuple[List[Dict[str, Any]], Optional[str]]:
        """
        Fetch list of guilds where the shared bot is present.

        WHY: Auto-detect servers for better UX (no manual guild_id entry)
        HOW: Call Discord API GET /users/@me/guilds with Redis caching

        ARGS:
            force_refresh: If True, bypass cache and fetch fresh data

        RETURNS:
            Tuple of (guilds_list, error_message)
            - If success: ([guilds...], None)
            - If error: ([], "error description")

        CACHING:
            - Uses Redis cache with 60s TTL to prevent Discord rate limits
            - Shared bot architecture amplifies rate limit risk (many users, one token)
            - Cache key: discord:bot:guilds
        """
        # 1. Check Redis cache first (unless force refresh)
        if not force_refresh:
            try:
                redis_client = redis.from_url(settings.REDIS_URL)
                cached = redis_client.get(GUILDS_CACHE_KEY)
                if cached:
                    logger.info("Discord guilds served from cache")
                    return json.loads(cached), None
            except Exception as e:
                logger.warning(f"Redis cache check failed: {e}")
                # Continue without cache if Redis fails

        # 2. Validate bot token
        bot_token = settings.DISCORD_SHARED_BOT_TOKEN

        if not bot_token:
            logger.warning("Discord bot token not configured (DISCORD_SHARED_BOT_TOKEN is empty)")
            return [], "Discord bot not configured. Please set DISCORD_SHARED_BOT_TOKEN in environment."

        # 3. Fetch from Discord API
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    "https://discord.com/api/v10/users/@me/guilds",
                    headers={"Authorization": f"Bot {bot_token}"},
                    timeout=10.0
                )

                logger.info(f"Discord API /users/@me/guilds response: {response.status_code}")

                if response.status_code == 200:
                    guilds = response.json()
                    logger.info(f"Found {len(guilds)} guild(s) where bot is present")
                    result = [
                        {
                            "guild_id": g["id"],
                            "guild_name": g["name"],
                            "guild_icon": f"https://cdn.discordapp.com/icons/{g['id']}/{g['icon']}.png" if g.get("icon") else None,
                        }
                        for g in guilds
                    ]

                    # 4. Cache the result in Redis
                    try:
                        redis_client = redis.from_url(settings.REDIS_URL)
                        redis_client.setex(
                            GUILDS_CACHE_KEY,
                            GUILDS_CACHE_TTL,
                            json.dumps(result)
                        )
                        logger.info(f"Cached {len(result)} Discord guilds for {GUILDS_CACHE_TTL}s")
                    except Exception as e:
                        logger.warning(f"Failed to cache Discord guilds: {e}")

                    return result, None
                elif response.status_code == 401:
                    logger.error("Discord API returned 401: Invalid bot token")
                    return [], "Invalid Discord bot token. Please check DISCORD_SHARED_BOT_TOKEN."
                elif response.status_code == 403:
                    logger.error("Discord API returned 403: Missing permissions or intents")
                    return [], "Discord bot missing permissions. Enable 'Server Members Intent' in Discord Developer Portal."
                elif response.status_code == 429:
                    retry_after = response.headers.get("Retry-After", "a few seconds")
                    logger.warning(f"Discord API rate limited (429). Retry after: {retry_after}")
                    return [], f"Discord API rate limited. Please wait {retry_after} seconds and try again."
                else:
                    logger.error(f"Discord API error: {response.status_code} - {response.text}")
                    return [], f"Discord API error ({response.status_code})"

            except httpx.TimeoutException:
                logger.error("Discord API timeout")
                return [], "Discord API timeout. Please try again."
            except Exception as e:
                logger.error(f"Discord API exception: {e}")
                return [], f"Failed to connect to Discord: {str(e)}"

    def invalidate_guilds_cache(self) -> bool:
        """
        Invalidate the Discord guilds cache.

        WHY: Allow users to force-refresh guild list after adding bot to new server
        HOW: Delete the Redis cache key

        RETURNS:
            True if cache was invalidated, False on error
        """
        try:
            redis_client = redis.from_url(settings.REDIS_URL)
            redis_client.delete(GUILDS_CACHE_KEY)
            logger.info("Discord guilds cache invalidated")
            return True
        except Exception as e:
            logger.warning(f"Failed to invalidate Discord guilds cache: {e}")
            return False

    async def fetch_guild_info(
        self,
        guild_id: str
    ) -> Optional[Dict[str, Any]]:
        """
        Fetch guild info from Discord API.

        WHY: Get guild name and icon for display
        HOW: Call Discord API with bot token

        ARGS:
            guild_id: Discord server ID

        RETURNS:
            Dict with guild name, icon, member_count, etc.
        """
        bot_token = settings.DISCORD_SHARED_BOT_TOKEN

        if not bot_token:
            return None

        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    f"https://discord.com/api/v10/guilds/{guild_id}",
                    headers={"Authorization": f"Bot {bot_token}"}
                )

                if response.status_code == 200:
                    data = response.json()
                    return {
                        "guild_id": data.get("id"),
                        "guild_name": data.get("name"),
                        "guild_icon": f"https://cdn.discordapp.com/icons/{data['id']}/{data['icon']}.png" if data.get("icon") else None,
                        "member_count": data.get("approximate_member_count"),
                        "owner_id": data.get("owner_id")
                    }
                return None
            except Exception:
                return None

    async def fetch_guild_channels(
        self,
        guild_id: str
    ) -> Optional[List[Dict[str, Any]]]:
        """
        Fetch list of channels from a Discord guild.

        WHY: Allow users to select specific channels for the bot to respond in
        HOW: Call Discord API GET /guilds/{guild_id}/channels

        ARGS:
            guild_id: Discord server ID

        RETURNS:
            List of text channels with id, name, type, position
            Returns only text channels (type 0) and announcement channels (type 5)
        """
        bot_token = settings.DISCORD_SHARED_BOT_TOKEN

        if not bot_token:
            return None

        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    f"https://discord.com/api/v10/guilds/{guild_id}/channels",
                    headers={"Authorization": f"Bot {bot_token}"}
                )

                if response.status_code == 200:
                    channels = response.json()
                    # Filter to text channels (0) and announcement channels (5)
                    # Also include voice text-in-voice (type 2 has text now but we skip for simplicity)
                    text_channels = [
                        {
                            "id": ch.get("id"),
                            "name": ch.get("name"),
                            "type": ch.get("type"),
                            "position": ch.get("position", 0),
                            "parent_id": ch.get("parent_id"),  # Category ID
                        }
                        for ch in channels
                        if ch.get("type") in [0, 5]  # GUILD_TEXT, GUILD_ANNOUNCEMENT
                    ]
                    # Sort by position
                    text_channels.sort(key=lambda x: x.get("position", 0))
                    return text_channels
                elif response.status_code == 403:
                    # Bot doesn't have permission to view channels
                    return []
                return None
            except Exception:
                return None

    def reassign_chatbot(
        self,
        db: Session,
        workspace_id: UUID,
        guild_id: str,
        new_chatbot_id: UUID
    ) -> Optional[DiscordGuildDeployment]:
        """
        Reassign a guild to a different chatbot.

        WHY: Change which chatbot handles a guild without re-adding
        HOW: Update chatbot_id in deployment

        ARGS:
            db: Database session
            workspace_id: Workspace ID (for tenant isolation)
            guild_id: Discord server ID
            new_chatbot_id: New chatbot to assign

        RETURNS:
            Updated deployment or None if not found

        RAISES:
            ValueError: If new chatbot not found or not in workspace
        """
        # Verify new chatbot belongs to workspace
        chatbot = db.query(Chatbot).filter(
            Chatbot.id == new_chatbot_id,
            Chatbot.workspace_id == workspace_id
        ).first()

        if not chatbot:
            raise ValueError("New chatbot not found in this workspace")

        if chatbot.status != ChatbotStatus.ACTIVE:
            raise ValueError(f"New chatbot must be active (current status: {chatbot.status})")

        deployment = db.query(DiscordGuildDeployment).filter(
            DiscordGuildDeployment.guild_id == guild_id,
            DiscordGuildDeployment.workspace_id == workspace_id
        ).first()

        if not deployment:
            return None

        deployment.chatbot_id = new_chatbot_id
        db.commit()
        db.refresh(deployment)
        return deployment


# Global instance
discord_guild_service = DiscordGuildService()
