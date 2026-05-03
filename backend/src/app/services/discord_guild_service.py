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
        allowed_channel_ids: List[str] = None,
        entity_type: str = "chatbot",
    ) -> DiscordGuildDeployment:
        """
        Deploy a chatbot OR chatflow to a Discord guild (server).

        Despite the historical `chatbot_id` argument name, this method now
        accepts either a chatbot UUID or a chatflow UUID; the `entity_type`
        argument disambiguates which table to validate against. The
        `chatbot_id` column on the row stores the entity id; the
        `entity_type` column distinguishes them. The FK on chatbot_id was
        dropped in the migration that introduced entity_type so chatflow
        ids can live there.

        ARGS:
            entity_type: "chatbot" (default) or "chatflow".
            chatbot_id:  The id to bind, regardless of entity_type.
        """
        if entity_type not in ("chatbot", "chatflow"):
            raise ValueError(f"Unsupported entity_type: {entity_type!r}")

        # Validate the entity exists in this workspace and is dispatch-ready.
        if entity_type == "chatbot":
            chatbot = db.query(Chatbot).filter(
                Chatbot.id == chatbot_id,
                Chatbot.workspace_id == workspace_id,
            ).first()
            if not chatbot:
                raise ValueError("Chatbot not found in this workspace")
            if chatbot.status != ChatbotStatus.ACTIVE:
                raise ValueError(
                    f"Chatbot must be active to deploy (current status: {chatbot.status})"
                )
        else:
            from app.models.chatflow import Chatflow

            chatflow = db.query(Chatflow).filter(
                Chatflow.id == chatbot_id,
                Chatflow.workspace_id == workspace_id,
            ).first()
            if not chatflow:
                raise ValueError("Chatflow not found in this workspace")
            if not chatflow.is_active:
                raise ValueError("Chatflow must be active to deploy")

        # Check guild not already deployed
        existing = db.query(DiscordGuildDeployment).filter(
            DiscordGuildDeployment.guild_id == guild_id
        ).first()

        if existing:
            if existing.workspace_id == workspace_id:
                raise ValueError(
                    f"Guild {guild_id} is already deployed to {existing.entity_type} {existing.chatbot_id}"
                )
            else:
                raise ValueError(f"Guild {guild_id} is already deployed to another workspace")

        # Create deployment record
        deployment = DiscordGuildDeployment(
            workspace_id=workspace_id,
            guild_id=guild_id,
            guild_name=guild_name,
            guild_icon=guild_icon,
            chatbot_id=chatbot_id,
            entity_type=entity_type,
            allowed_channel_ids=allowed_channel_ids or [],
            is_active=True,
            created_by=user_id,
            deployed_at=datetime.utcnow()
        )

        db.add(deployment)
        db.commit()
        db.refresh(deployment)

        return deployment

    def get_entity_for_guild(
        self,
        db: Session,
        guild_id: str
    ) -> Optional[Tuple[str, Any, DiscordGuildDeployment]]:
        """
        Lookup the chatbot OR chatflow that handles this guild.

        Reads `entity_type` from the deployment row to dispatch to the right
        table. Falls back to chatbot for legacy rows where entity_type would
        be NULL — but the column has a server default of 'chatbot' so that
        path shouldn't trigger in practice.

        RETURNS:
            Tuple of (bot_type, entity, deployment) or None
        """
        deployment = db.query(DiscordGuildDeployment).filter(
            DiscordGuildDeployment.guild_id == guild_id,
            DiscordGuildDeployment.is_active == True
        ).first()

        if not deployment:
            return None

        entity_type = (deployment.entity_type or "chatbot").lower()

        if entity_type == "chatflow":
            from app.models.chatflow import Chatflow
            chatflow = db.query(Chatflow).filter(
                Chatflow.id == deployment.chatbot_id,
                Chatflow.is_active == True
            ).first()
            if chatflow:
                return ("chatflow", chatflow, deployment)
            return None

        # Default / chatbot path
        chatbot = db.query(Chatbot).filter(
            Chatbot.id == deployment.chatbot_id,
            Chatbot.status == ChatbotStatus.ACTIVE
        ).first()

        if chatbot:
            return ("chatbot", chatbot, deployment)

        return None

    def remove_for_entity(
        self,
        db: Session,
        entity_type: str,
        entity_id: UUID,
    ) -> int:
        """
        Delete all Discord guild deployments bound to a chatbot or chatflow.

        WHY: `discord_guild_deployments.chatbot_id` is polymorphic (chatbot
        OR chatflow id, disambiguated by `entity_type`) and the DB-level FK
        was dropped in migration `d876f78053d0`. Without that FK there is no
        ON DELETE CASCADE — orphan rows would block re-binding the same
        `guild_id` to a replacement entity (the column is UNIQUE). This
        method restores cascade semantics at the application layer; callers
        invoke it from chatbot/chatflow delete code paths.

        IMPORTANT: does NOT commit. The bulk delete runs in the caller's
        transaction so that if the surrounding entity-delete fails after
        this call, both rollback together.

        ARGS:
            entity_type: "chatbot" or "chatflow".
            entity_id:   The chatbot or chatflow uuid.

        RETURNS:
            Number of deployment rows removed.
        """
        if entity_type not in ("chatbot", "chatflow"):
            raise ValueError(f"Unsupported entity_type: {entity_type!r}")

        return db.query(DiscordGuildDeployment).filter(
            DiscordGuildDeployment.chatbot_id == entity_id,
            DiscordGuildDeployment.entity_type == entity_type,
        ).delete(synchronize_session=False)

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

    def generate_invite_url(
        self,
        entity_type: Optional[str] = None,
        entity_id: Optional[UUID] = None,
        workspace_id: Optional[UUID] = None,
    ) -> str:
        """
        Generate Discord bot invite URL for the shared bot.

        When `entity_type` and `entity_id` are passed, the URL includes a
        signed `state` parameter and `redirect_uri` pointing at our OAuth
        callback (`/webhooks/discord/oauth/callback`). The callback decodes
        state, creates a `DiscordGuildDeployment` row binding `guild_id` to
        the entity, then redirects the user back to the studio. Without
        these args (legacy use), the URL is the bare invite — operator must
        bind manually via the API.

        ARGS:
            entity_type:  "chatbot" or "chatflow" — only required for
                          state-encoded URLs.
            entity_id:    The chatbot/chatflow id to bind on install.
            workspace_id: Workspace id (carried in state for auth).
        """
        import base64
        import json
        import secrets as _secrets
        from urllib.parse import quote, urlencode

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

        params = {
            "client_id": application_id,
            "permissions": str(permissions),
            "scope": "bot applications.commands",
        }

        if entity_type and entity_id and workspace_id:
            # `response_type=code` switches Discord to the OAuth flow that
            # gives us back an exchangeable code on our redirect_uri. Without
            # this, install is "bot drops in server, no callback." With it,
            # we can finish binding automatically.
            params["response_type"] = "code"
            params["redirect_uri"] = f"{settings.API_BASE_URL.rstrip('/')}/webhooks/discord/oauth/callback"
            state_payload = {
                "entity_type": entity_type,
                "entity_id": str(entity_id),
                "workspace_id": str(workspace_id),
                "csrf": _secrets.token_urlsafe(16),
            }
            params["state"] = base64.urlsafe_b64encode(
                json.dumps(state_payload).encode()
            ).decode().rstrip("=")

        # Use `+` between scopes for Discord's parser (urllib quote replaces
        # spaces with %20 which Discord also accepts but the existing tests
        # in this repo expect `+`). Override scope encoding manually.
        scope_value = params.pop("scope")
        query = urlencode(params, quote_via=quote)
        return (
            f"https://discord.com/api/oauth2/authorize?{query}"
            f"&scope={scope_value.replace(' ', '+')}"
        )

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
