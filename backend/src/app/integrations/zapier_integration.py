"""
Zapier Integration - Handle Zapier webhook integration.

WHY:
- Enable automation workflows via Zapier
- Trigger chatbot/chatflow from external apps
- Send responses back to Zapier

HOW:
- Expose webhook endpoint for Zapier
- Process trigger events
- Return structured response
- Support various Zapier actions

PSEUDOCODE follows the existing codebase patterns.
"""

from uuid import UUID
from typing import Any, Tuple

from sqlalchemy.orm import Session


class ZapierIntegration:
    """
    Zapier webhook integration.

    WHY: Connect chatbots/chatflows to Zapier automation
    HOW: Webhook-based trigger and action handling
    """

    def get_webhook_url(
        self,
        entity_id: UUID,
        entity_type: str
    ) -> dict:
        """
        Get Zapier webhook URL.

        WHY: Provide webhook URL for Zapier configuration
        HOW: Generate standard webhook endpoint

        ARGS:
            entity_id: Chatbot or chatflow ID
            entity_type: "chatbot" or "chatflow"

        RETURNS:
            {
                "webhook_url": "https://api.example.com/webhooks/zapier/{entity_id}",
                "method": "POST",
                "content_type": "application/json"
            }
        """

        from app.core.config import settings

        webhook_url = f"{settings.API_BASE_URL}/webhooks/zapier/{entity_id}"

        return {
            "webhook_url": webhook_url,
            "method": "POST",
            "content_type": "application/json",
            "description": "Send POST requests with 'message' field to trigger chatbot"
        }


    async def handle_webhook(
        self,
        db: Session,
        entity_id: UUID,
        payload: dict
    ) -> dict:
        """
        Handle incoming Zapier webhook.

        WHY: Process triggers from Zapier workflows
        HOW: Extract message, route to service, return response

        ARGS:
            db: Database session
            entity_id: Chatbot or chatflow ID
            payload: Zapier webhook payload

        EXPECTED PAYLOAD:
            {
                "message": "User question or input",
                "session_id": "optional_session_id",
                "metadata": {
                    "source": "gmail",
                    "email": "user@example.com"
                }
            }

        RETURNS:
            {
                "response": "AI response text",
                "session_id": "uuid",
                "success": True
            }
        """

        from app.services.chatbot_service import chatbot_service

        # Extract message
        user_message = payload.get("message", "")
        if not user_message:
            return {
                "response": "No message provided",
                "success": False,
                "error": "Missing 'message' field in payload"
            }

        # Get session ID or generate
        session_id = payload.get("session_id", f"zapier_{entity_id}")

        # Determine bot type
        bot_type, bot = self._get_bot(db, entity_id)

        # Channel context
        channel_context = {
            "platform": "zapier",
            "metadata": payload.get("metadata", {}),
            "source": payload.get("metadata", {}).get("source", "zapier")
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
            # Placeholder - chatflow_service
            response = {
                "response": "Chatflow support coming soon",
                "session_id": session_id
            }

        return {
            "response": response["response"],
            "session_id": response["session_id"],
            "success": True,
            "sources": response.get("sources", [])
        }


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


    def get_sample_payload(self) -> dict:
        """
        Get sample Zapier payload.

        WHY: Help users configure Zapier integration
        HOW: Provide example payload structure
        """

        return {
            "message": "What is your return policy?",
            "session_id": "optional_unique_id",
            "metadata": {
                "source": "gmail",
                "email": "customer@example.com",
                "subject": "Question about returns"
            }
        }


    def get_response_schema(self) -> dict:
        """
        Get response schema for Zapier.

        WHY: Document response format for Zapier actions
        HOW: Provide JSON schema
        """

        return {
            "type": "object",
            "properties": {
                "response": {
                    "type": "string",
                    "description": "AI-generated response text"
                },
                "session_id": {
                    "type": "string",
                    "description": "Session ID for conversation continuity"
                },
                "success": {
                    "type": "boolean",
                    "description": "Whether request was successful"
                },
                "sources": {
                    "type": "array",
                    "description": "RAG sources (if applicable)",
                    "items": {
                        "type": "object",
                        "properties": {
                            "document_name": {"type": "string"},
                            "content": {"type": "string"},
                            "score": {"type": "number"}
                        }
                    }
                }
            }
        }


# Global instance
zapier_integration = ZapierIntegration()
