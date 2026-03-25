"""
Zapier Webhook Handler - Process incoming Zapier webhook triggers.

WHY:
- Zapier generates webhook URLs on deploy but no handler route existed
- Enable inbound automation: Zapier -> PrivexBot -> process -> respond
- Complete the Zapier integration (outbound already works via Webhook Node)

HOW:
- FastAPI webhook endpoint following Discord/Telegram handler pattern
- Route to chatbot or chatflow execution
- Return structured response for Zapier actions
"""

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from uuid import UUID
from typing import Optional
import logging

from app.db.session import get_db
from app.integrations.zapier_integration import zapier_integration
from app.services.chatbot_service import chatbot_service

logger = logging.getLogger(__name__)

# Chatflow is optional
try:
    from app.services.chatflow_service import chatflow_service
    CHATFLOW_AVAILABLE = True
except ImportError:
    chatflow_service = None
    CHATFLOW_AVAILABLE = False

router = APIRouter(prefix="/webhooks/zapier", tags=["webhooks"])


@router.post("/{bot_id}")
async def zapier_webhook(
    bot_id: UUID,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Zapier inbound webhook handler.

    WHY: Receive triggers from Zapier workflows and process through bot
    HOW: Parse payload, route to chatbot/chatflow, return response

    URL:
        POST /webhooks/zapier/{bot_id}

    BODY:
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
            "success": true,
            "sources": []
        }
    """
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid JSON payload"
        )

    # Validate message exists
    user_message = payload.get("message", "")
    if not user_message:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing 'message' field in payload"
        )

    # Resolve bot (chatbot or chatflow)
    from app.models.chatbot import Chatbot
    from app.models.chatflow import Chatflow

    bot = db.query(Chatbot).filter(Chatbot.id == bot_id).first()
    bot_type = "chatbot"

    if not bot:
        bot = db.query(Chatflow).filter(Chatflow.id == bot_id).first()
        bot_type = "chatflow"

    if not bot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bot not found"
        )

    # Check if Zapier channel is enabled
    if bot_type == "chatbot":
        deployment_config = bot.deployment_config or {}
    else:
        deployment_config = (bot.config or {}).get("deployment", {})

    zapier_config = deployment_config.get("zapier", {})
    if zapier_config and zapier_config.get("status") != "success":
        logger.warning(f"Zapier webhook received for bot {bot_id} but Zapier channel is not active")
        # Still process - some users may configure webhooks manually

    # Session ID
    session_id = payload.get("session_id", f"zapier_{bot_id}")

    # Channel context
    channel_context = {
        "platform": "zapier",
        "metadata": payload.get("metadata", {}),
        "source": payload.get("metadata", {}).get("source", "zapier")
    }

    # Execute bot
    try:
        if bot_type == "chatbot":
            response = await chatbot_service.process_message(
                db=db,
                chatbot=bot,
                user_message=user_message,
                session_id=session_id,
                channel_context=channel_context
            )
        elif bot_type == "chatflow" and CHATFLOW_AVAILABLE:
            response = await chatflow_service.execute(
                db=db,
                chatflow=bot,
                user_message=user_message,
                session_id=session_id,
                channel_context=channel_context
            )
        else:
            response = {
                "response": "Chatflow execution not available",
                "session_id": session_id
            }

        return {
            "response": response.get("response", ""),
            "session_id": response.get("session_id", session_id),
            "success": True,
            "sources": response.get("sources", [])
        }

    except Exception as e:
        logger.error(f"Zapier webhook execution error for bot {bot_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error processing message"
        )


@router.get("/{bot_id}/sample")
async def zapier_sample_payload(bot_id: UUID):
    """
    Get sample payload for Zapier configuration.

    WHY: Help users configure their Zapier triggers
    HOW: Return example payload structure
    """
    return {
        "sample_payload": zapier_integration.get_sample_payload(),
        "response_schema": zapier_integration.get_response_schema(),
        "webhook_url": f"/webhooks/zapier/{bot_id}",
        "method": "POST",
        "content_type": "application/json"
    }
