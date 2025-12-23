"""
Discord Integration - Handle Discord Bot webhooks.

WHY:
- Deploy chatbots/chatflows to Discord servers
- Receive messages via Discord Gateway or webhooks
- Send responses back to Discord channels

HOW:
- Register application with Discord
- Handle incoming message events
- Route to chatbot_service or chatflow_service
- Send response via Discord API

PSEUDOCODE follows the existing codebase patterns.
"""

import requests
from uuid import UUID
from typing import Any, Tuple, Optional, List

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.credential import Credential


class DiscordIntegration:
    """
    Discord Bot API integration.

    WHY: Multi-channel deployment to Discord
    HOW: Webhook and Gateway-based message handling
    """

    # Discord permission flags
    # See: https://discord.com/developers/docs/topics/permissions
    PERMISSIONS = {
        "send_messages": 2048,
        "embed_links": 16384,
        "read_message_history": 65536,
        "add_reactions": 64,
        "use_slash_commands": 2147483648,
    }

    def generate_invite_url(
        self,
        application_id: str,
        scopes: Optional[List[str]] = None,
        permissions: Optional[List[str]] = None
    ) -> str:
        """
        Generate Discord bot invite URL.

        WHY: Users need a link to add bot to their servers
        HOW: Construct OAuth2 authorize URL with proper scopes and permissions

        ARGS:
            application_id: Discord application/client ID
            scopes: OAuth2 scopes (default: ["bot", "applications.commands"])
            permissions: Permission names from PERMISSIONS dict

        RETURNS:
            Discord OAuth2 authorize URL

        EXAMPLE:
            url = discord_integration.generate_invite_url(
                application_id="123456789",
                permissions=["send_messages", "use_slash_commands"]
            )
            # Returns: https://discord.com/api/oauth2/authorize?client_id=123456789&permissions=2147485696&scope=bot+applications.commands
        """
        scopes = scopes or ["bot", "applications.commands"]
        permissions = permissions or ["send_messages", "embed_links", "read_message_history", "use_slash_commands"]

        # Calculate permission integer from permission names
        permission_int = 0
        for perm in permissions:
            if perm in self.PERMISSIONS:
                permission_int |= self.PERMISSIONS[perm]

        scope_str = "+".join(scopes)
        return f"https://discord.com/api/oauth2/authorize?client_id={application_id}&permissions={permission_int}&scope={scope_str}"

    def register_webhook(
        self,
        db: Session,
        entity_id: UUID,
        entity_type: str,
        config: dict
    ) -> dict:
        """
        Register webhook/bot with Discord.

        WHY: Receive messages from Discord
        HOW: Use Discord bot token and application ID

        ARGS:
            db: Database session
            entity_id: Chatbot or chatflow ID
            entity_type: "chatbot" or "chatflow"
            config: {
                "bot_token": "credential_id_ref",  # Reference to encrypted credential
                "application_id": "discord_app_id"
            }

        RETURNS:
            {
                "webhook_url": "https://...",
                "bot_username": "YourBot#1234",
                "application_id": "123456789",
                "invite_url": "https://discord.com/api/oauth2/authorize?..."
            }
        """

        from app.services.credential_service import credential_service

        # Get bot token from credentials
        credential_id = config["bot_token"]
        credential = db.query(Credential).get(UUID(credential_id))

        if not credential:
            raise ValueError("Discord bot token credential not found")

        cred_data = credential_service.get_decrypted_data(db, credential)
        bot_token = cred_data["bot_token"]

        # Webhook URL for interactions
        webhook_url = f"{settings.API_BASE_URL}/webhooks/discord/{entity_id}"

        # Get bot info from Discord API
        headers = {"Authorization": f"Bot {bot_token}"}
        bot_info = requests.get(
            "https://discord.com/api/v10/users/@me",
            headers=headers
        ).json()

        bot_username = f"{bot_info['username']}#{bot_info['discriminator']}"
        application_id = config.get("application_id")

        # Generate invite URL if application_id is provided
        invite_url = None
        if application_id:
            invite_url = self.generate_invite_url(application_id)

        return {
            "webhook_url": webhook_url,
            "bot_username": bot_username,
            "application_id": application_id,
            "invite_url": invite_url
        }


    async def handle_webhook(
        self,
        db: Session,
        entity_id: UUID,
        interaction_data: dict
    ) -> dict:
        """
        Handle incoming Discord interaction (webhook).

        WHY: Process user messages from Discord
        HOW: Extract message, route to bot service, send response

        ARGS:
            db: Database session
            entity_id: Chatbot or chatflow ID
            interaction_data: Discord Interaction object (JSON)

        RETURNS:
            {"type": 4, "data": {"content": "response"}}  # Discord interaction response
        """

        from app.services.chatbot_service import chatbot_service

        # Parse interaction (simplified)
        if interaction_data.get("type") != 2:  # APPLICATION_COMMAND
            return {"status": "ignored"}

        user_message = interaction_data.get("data", {}).get("options", [{}])[0].get("value", "")
        user_id = interaction_data.get("member", {}).get("user", {}).get("id")
        channel_id = interaction_data.get("channel_id")
        guild_id = interaction_data.get("guild_id")

        # Determine bot type
        bot_type, bot = self._get_bot(db, entity_id)

        # Session ID (unique per Discord user in channel)
        session_id = f"discord_{guild_id}_{channel_id}_{user_id}"

        # Channel context
        channel_context = {
            "platform": "discord",
            "channel_id": channel_id,
            "user_id": user_id,
            "guild_id": guild_id
        }

        # Route to appropriate service
        if bot_type == "chatbot":
            response = await chatbot_service.process_message(
                db=db,
                chatbot=bot,
                user_message=user_message,
                session_id=session_id,
                channel_context=channel_context
            )
        else:  # chatflow
            # Placeholder - chatflow_service not yet implemented
            response = {"response": "Chatflow support coming soon"}

        # Return Discord interaction response
        return {
            "type": 4,  # CHANNEL_MESSAGE_WITH_SOURCE
            "data": {
                "content": response["response"]
            }
        }


    def verify_signature(
        self,
        body: bytes,
        signature: str,
        timestamp: str,
        public_key: str
    ) -> bool:
        """
        Verify Discord interaction signature.

        WHY: Discord requires signature verification for security
        HOW: Use Ed25519 to verify the signature
        """
        try:
            from nacl.signing import VerifyKey
            from nacl.exceptions import BadSignature

            verify_key = VerifyKey(bytes.fromhex(public_key))
            message = timestamp.encode() + body
            verify_key.verify(message, bytes.fromhex(signature))
            return True
        except (BadSignature, Exception):
            return False

    async def register_global_commands(
        self,
        bot_token: str,
        application_id: str,
        commands: list
    ) -> dict:
        """
        Register global slash commands with Discord.

        WHY: Set up bot commands users can invoke
        HOW: Call Discord API to register commands
        """
        headers = {"Authorization": f"Bot {bot_token}"}
        response = requests.put(
            f"https://discord.com/api/v10/applications/{application_id}/commands",
            headers=headers,
            json=commands
        )
        return response.json()

    async def get_global_commands(
        self,
        bot_token: str,
        application_id: str
    ) -> list:
        """
        Get registered global commands from Discord.

        WHY: View current commands for debugging
        HOW: Call Discord API to list commands
        """
        headers = {"Authorization": f"Bot {bot_token}"}
        response = requests.get(
            f"https://discord.com/api/v10/applications/{application_id}/commands",
            headers=headers
        )
        return response.json()

    def _get_bot(self, db: Session, entity_id: UUID) -> Tuple[str, Any]:
        """Get bot by ID (chatbot or chatflow)."""

        from app.models.chatbot import Chatbot
        from app.models.chatflow import Chatflow

        # Try chatbot first
        chatbot = db.query(Chatbot).get(entity_id)
        if chatbot:
            return "chatbot", chatbot

        # Try chatflow
        chatflow = db.query(Chatflow).get(entity_id)
        if chatflow:
            return "chatflow", chatflow

        raise ValueError("Bot not found")


    def _get_bot_token(self, db: Session, bot) -> str:
        """Extract Discord bot token from bot config."""

        from app.services.credential_service import credential_service

        # After deployment, deployment_config contains channel results directly
        # e.g., {"discord": {"bot_token_credential_id": "...", ...}, "website": {...}}
        discord_config = bot.deployment_config.get("discord", {})
        credential_id = discord_config.get("bot_token_credential_id")

        if not credential_id:
            raise ValueError("Discord bot token credential not found in deployment config")

        credential = db.query(Credential).get(UUID(credential_id))
        if not credential:
            raise ValueError("Discord credential not found")

        cred_data = credential_service.get_decrypted_data(db, credential)

        return cred_data["bot_token"]


# Global instance
discord_integration = DiscordIntegration()
