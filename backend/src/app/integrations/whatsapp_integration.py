"""
WhatsApp Integration - Handle WhatsApp Business API webhooks.

WHY:
- Deploy chatbots/chatflows to WhatsApp Business
- Receive messages via Cloud API webhooks
- Send responses back to WhatsApp users

HOW:
- Register webhook with WhatsApp Cloud API
- Handle incoming message events
- Route to chatbot_service or chatflow_service
- Send response via WhatsApp Business API

PSEUDOCODE follows the existing codebase patterns.
"""

import requests
from uuid import UUID
from typing import Any, Tuple

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.credential import Credential


class WhatsAppIntegration:
    """
    WhatsApp Business API integration.

    WHY: Multi-channel deployment to WhatsApp
    HOW: Webhook-based message handling via Cloud API
    """

    def register_webhook(
        self,
        db: Session,
        entity_id: UUID,
        entity_type: str,
        config: dict
    ) -> dict:
        """
        Register webhook with WhatsApp Business API.

        WHY: Receive messages from WhatsApp users
        HOW: Configure webhook in WhatsApp Cloud API dashboard

        ARGS:
            db: Database session
            entity_id: Chatbot or chatflow ID
            entity_type: "chatbot" or "chatflow"
            config: {
                "access_token": "credential_id_ref",  # Reference to encrypted credential
                "phone_number_id": "whatsapp_phone_number_id",
                "phone_number": "+1234567890"
            }

        RETURNS:
            {
                "webhook_url": "https://...",
                "phone_number": "+1234567890"
            }
        """

        from app.services.credential_service import credential_service

        # Get access token from credentials
        credential_id = config["access_token"]
        credential = db.query(Credential).get(UUID(credential_id))

        if not credential:
            raise ValueError("WhatsApp access token credential not found")

        cred_data = credential_service.get_decrypted_data(db, credential)
        access_token = cred_data["access_token"]

        # Webhook URL
        webhook_url = f"{settings.API_BASE_URL}/webhooks/whatsapp/{entity_id}"

        # WhatsApp webhook registration is done manually in Meta dashboard
        # This returns the webhook URL for configuration

        return {
            "webhook_url": webhook_url,
            "phone_number": config.get("phone_number"),
            "phone_number_id": config.get("phone_number_id")
        }


    async def handle_webhook(
        self,
        db: Session,
        entity_id: UUID,
        webhook_data: dict
    ) -> dict:
        """
        Handle incoming WhatsApp message (webhook).

        WHY: Process user messages from WhatsApp
        HOW: Extract message, route to bot service, send response

        ARGS:
            db: Database session
            entity_id: Chatbot or chatflow ID
            webhook_data: WhatsApp webhook payload (JSON)

        RETURNS:
            {"status": "ok"}
        """

        from app.services.chatbot_service import chatbot_service

        # Parse webhook data
        entry = webhook_data.get("entry", [{}])[0]
        changes = entry.get("changes", [{}])[0]
        value = changes.get("value", {})

        messages = value.get("messages", [])
        if not messages:
            return {"status": "ignored"}  # No messages

        message = messages[0]
        user_message = message.get("text", {}).get("body", "")
        from_number = message.get("from")
        message_id = message.get("id")

        # Determine bot type
        bot_type, bot = self._get_bot(db, entity_id)

        # Session ID (unique per WhatsApp user)
        session_id = f"whatsapp_{from_number}"

        # Channel context
        channel_context = {
            "platform": "whatsapp",
            "from_number": from_number,
            "message_id": message_id
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

        # Send response back to WhatsApp
        await self._send_message(
            db=db,
            bot=bot,
            to_number=from_number,
            text=response["response"]
        )

        return {"status": "ok"}


    async def _send_message(
        self,
        db: Session,
        bot: Any,
        to_number: str,
        text: str
    ):
        """Send message to WhatsApp user."""

        from app.services.credential_service import credential_service

        # Get WhatsApp config
        deployment = bot.config.get("deployment", {})
        channels = deployment.get("channels", [])

        whatsapp_config = None
        for channel in channels:
            if channel["type"] == "whatsapp":
                whatsapp_config = channel["config"]
                break

        if not whatsapp_config:
            raise ValueError("WhatsApp config not found")

        # Get access token
        credential_id = whatsapp_config["access_token"]
        credential = db.query(Credential).get(UUID(credential_id))
        cred_data = credential_service.get_decrypted_data(db, credential)
        access_token = cred_data["access_token"]

        phone_number_id = whatsapp_config["phone_number_id"]

        # Send message via WhatsApp Cloud API
        requests.post(
            f"https://graph.facebook.com/v18.0/{phone_number_id}/messages",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            },
            json={
                "messaging_product": "whatsapp",
                "to": to_number,
                "type": "text",
                "text": {"body": text}
            }
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


# Global instance
whatsapp_integration = WhatsAppIntegration()
