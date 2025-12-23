"""
Telegram Integration - Handle Telegram Bot API webhooks.

WHY:
- Deploy chatbots/chatflows to Telegram
- Receive messages via webhook
- Send responses back to Telegram

HOW:
- Register webhook with Telegram API
- Handle incoming updates
- Route to chatbot_service or chatflow_service
- Send response via Telegram API

PSEUDOCODE follows the existing codebase patterns.
"""

import requests
from uuid import UUID
from typing import Any, Optional, Tuple

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.credential import Credential


class TelegramIntegration:
    """
    Telegram Bot API integration.

    WHY: Multi-channel deployment to Telegram
    HOW: Webhook-based message handling
    """

    def register_webhook(
        self,
        db: Session,
        entity_id: UUID,
        entity_type: str,
        config: dict
    ) -> dict:
        """
        Register webhook with Telegram.

        WHY: Receive messages from Telegram
        HOW: Call Telegram setWebhook API

        ARGS:
            db: Database session
            entity_id: Chatbot or chatflow ID
            entity_type: "chatbot" or "chatflow"
            config: {
                "bot_token": "credential_id_ref"  # Reference to encrypted credential
            }

        RETURNS:
            {
                "webhook_url": "https://...",
                "bot_username": "@your_bot"
            }
        """

        from app.services.credential_service import credential_service

        # Get bot token from credentials
        credential_id = config["bot_token"]
        credential = db.query(Credential).get(UUID(credential_id))

        if not credential:
            raise ValueError("Telegram bot token credential not found")

        cred_data = credential_service.get_decrypted_data(db, credential)
        bot_token = cred_data["bot_token"]

        # Webhook URL
        webhook_url = f"{settings.API_BASE_URL}/webhooks/telegram/{entity_id}"

        # Register webhook with Telegram
        response = requests.post(
            f"https://api.telegram.org/bot{bot_token}/setWebhook",
            json={"url": webhook_url}
        )

        response.raise_for_status()

        # Get bot info
        bot_info = requests.get(
            f"https://api.telegram.org/bot{bot_token}/getMe"
        ).json()

        bot_username = bot_info["result"]["username"]

        return {
            "webhook_url": webhook_url,
            "bot_username": f"@{bot_username}"
        }


    async def handle_webhook(
        self,
        db: Session,
        entity_id: UUID,
        update_data: dict
    ) -> dict:
        """
        Handle incoming Telegram update (webhook).

        WHY: Process user messages from Telegram
        HOW: Extract message, route to bot service, send response

        ARGS:
            db: Database session
            entity_id: Chatbot or chatflow ID
            update_data: Telegram Update object (JSON)

        RETURNS:
            {"status": "ok"}
        """

        from app.services.chatbot_service import chatbot_service

        # Parse update (simplified - in production use python-telegram-bot)
        if "message" not in update_data or "text" not in update_data["message"]:
            return {"status": "ignored"}  # Not a text message

        message_data = update_data["message"]
        user_message = message_data["text"]
        chat_id = message_data["chat"]["id"]
        user_id = message_data["from"]["id"]

        # Extract user info from Telegram
        from_user = message_data.get("from", {})
        telegram_username = from_user.get("username")
        first_name = from_user.get("first_name")
        last_name = from_user.get("last_name")

        # Determine bot type
        bot_type, bot = self._get_bot(db, entity_id)

        # Session ID (unique per Telegram user)
        session_id = f"telegram_{chat_id}_{user_id}"

        # Auto-capture Telegram user data on first message
        await self._auto_capture_lead(
            db=db,
            bot=bot,
            bot_type=bot_type,
            session_id=session_id,
            telegram_user_id=str(user_id),
            telegram_username=telegram_username,
            first_name=first_name,
            last_name=last_name
        )

        # Channel context
        channel_context = {
            "platform": "telegram",
            "chat_id": chat_id,
            "user_id": user_id,
            "username": telegram_username,
            "first_name": first_name,
            "last_name": last_name
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

        # Send response back to Telegram
        await self._send_message(
            chat_id=chat_id,
            text=response["response"],
            bot_token=self._get_bot_token(db, bot)
        )

        return {"status": "ok"}


    async def _send_message(
        self,
        chat_id: int,
        text: str,
        bot_token: str
    ):
        """Send message to Telegram user."""

        requests.post(
            f"https://api.telegram.org/bot{bot_token}/sendMessage",
            json={
                "chat_id": chat_id,
                "text": text,
                "parse_mode": "Markdown"  # Support markdown formatting
            }
        )

    async def send_message(
        self,
        bot_token: str,
        chat_id: int,
        message: str
    ):
        """
        Public method to send message to Telegram user.

        WHY: Called by webhook handler to send responses
        HOW: Call Telegram sendMessage API
        """
        requests.post(
            f"https://api.telegram.org/bot{bot_token}/sendMessage",
            json={
                "chat_id": chat_id,
                "text": message,
                "parse_mode": "Markdown"
            }
        )

    async def get_webhook_info(self, bot_token: str) -> dict:
        """
        Get webhook info from Telegram.

        WHY: Debug and verify webhook configuration
        HOW: Call Telegram getWebhookInfo API
        """
        response = requests.get(
            f"https://api.telegram.org/bot{bot_token}/getWebhookInfo"
        )
        data = response.json()

        if data.get("ok"):
            result = data.get("result", {})
            return {
                "webhook_url": result.get("url", ""),
                "is_set": bool(result.get("url")),
                "pending_update_count": result.get("pending_update_count", 0),
                "last_error_date": result.get("last_error_date"),
                "last_error_message": result.get("last_error_message")
            }
        return {"ok": False, "error": data.get("description", "Failed to get webhook info")}

    async def set_webhook(self, bot_token: str, webhook_url: str) -> dict:
        """
        Set Telegram webhook URL.

        WHY: Configure where Telegram sends updates
        HOW: Call Telegram setWebhook API
        """
        response = requests.post(
            f"https://api.telegram.org/bot{bot_token}/setWebhook",
            json={"url": webhook_url}
        )
        return response.json()

    async def delete_webhook(self, bot_token: str) -> dict:
        """
        Delete Telegram webhook.

        WHY: Remove webhook when disabling Telegram channel
        HOW: Call Telegram deleteWebhook API
        """
        response = requests.post(
            f"https://api.telegram.org/bot{bot_token}/deleteWebhook"
        )
        return response.json()


    async def _auto_capture_lead(
        self,
        db: Session,
        bot: Any,
        bot_type: str,
        session_id: str,
        telegram_user_id: str,
        telegram_username: Optional[str] = None,
        first_name: Optional[str] = None,
        last_name: Optional[str] = None
    ):
        """
        Auto-capture lead from Telegram on first message.

        WHY: Telegram provides username and name
        HOW: Check lead_capture_config, capture if enabled

        NOTE: Telegram does NOT provide email/phone automatically.
              Must be collected via conversation or contact sharing.
        """

        # Check if lead capture is enabled
        lead_config = getattr(bot, "lead_capture_config", None) or {}
        if not lead_config.get("enabled"):
            return  # Lead capture not enabled

        # Check platform-specific settings
        platforms = lead_config.get("platforms", {})
        telegram_config = platforms.get("telegram", {})

        if not telegram_config.get("enabled", True):
            return  # Telegram lead capture disabled

        if not telegram_config.get("auto_capture_username", True):
            return  # Auto-capture disabled

        # Check if lead already exists for this session
        from app.services.lead_capture_service import lead_capture_service

        existing_lead = await lead_capture_service.check_lead_exists(
            db=db,
            workspace_id=bot.workspace_id,
            session_id=session_id
        )

        if existing_lead:
            return  # Lead already captured

        # Check privacy settings
        privacy = lead_config.get("privacy", {})
        require_consent = privacy.get("require_consent", False)

        # If strict consent required, check session for consent status
        if require_consent:
            from app.models.chat_session import ChatSession

            session = db.query(ChatSession).filter(
                ChatSession.session_id == session_id
            ).first()

            if session:
                metadata = session.session_metadata or {}
                # Only capture if user explicitly gave consent
                if not metadata.get("consent_given"):
                    return  # Consent not given yet - don't capture

        # For Telegram, capture with implicit consent (user initiated)
        # If strict consent required, set consent_given=False
        consent_given = not require_consent

        # Auto-capture the lead
        await lead_capture_service.capture_from_telegram(
            db=db,
            workspace_id=bot.workspace_id,
            bot_id=bot.id,
            bot_type=bot_type,
            session_id=session_id,
            telegram_user_id=telegram_user_id,
            telegram_username=telegram_username,
            first_name=first_name,
            last_name=last_name,
            consent_given=consent_given
        )

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
        """Extract Telegram bot token from bot config."""

        from app.services.credential_service import credential_service

        # After deployment, deployment_config contains channel results directly
        # e.g., {"telegram": {"bot_token_credential_id": "...", ...}, "website": {...}}
        telegram_config = bot.deployment_config.get("telegram", {})
        credential_id = telegram_config.get("bot_token_credential_id")

        if not credential_id:
            raise ValueError("Telegram bot token credential not found in deployment config")

        credential = db.query(Credential).get(UUID(credential_id))
        if not credential:
            raise ValueError("Telegram credential not found")

        cred_data = credential_service.get_decrypted_data(db, credential)

        return cred_data["bot_token"]


# Global instance
telegram_integration = TelegramIntegration()
