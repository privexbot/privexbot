"""
Telegram Webhook Handler - Process incoming Telegram messages.

WHY:
- Receive messages from Telegram Bot API
- Route to chatbot/chatflow execution
- Send responses back to Telegram

HOW:
- FastAPI webhook endpoint
- Telegram update parsing
- Bot execution delegation
- Response formatting

PSEUDOCODE follows the existing codebase patterns.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from uuid import UUID
from typing import Optional

from app.db.session import get_db
from app.integrations.telegram_integration import telegram_integration
from app.services.chatbot_service import chatbot_service
from app.services.chatflow_service import chatflow_service

router = APIRouter(prefix="/webhooks/telegram", tags=["webhooks"])


@router.post("/{bot_id}")
async def telegram_webhook(
    bot_id: UUID,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Telegram webhook handler.

    WHY: Receive and process Telegram messages
    HOW: Parse update, execute bot, send response

    FLOW:
    1. Parse Telegram update
    2. Extract message and user info
    3. Get bot from database
    4. Execute bot (chatbot or chatflow)
    5. Send response to Telegram

    URL:
        POST /webhooks/telegram/{bot_id}

    BODY:
        {
            "update_id": 123456,
            "message": {
                "message_id": 789,
                "from": {
                    "id": 12345,
                    "first_name": "John",
                    "username": "johndoe"
                },
                "chat": {
                    "id": 12345,
                    "type": "private"
                },
                "text": "Hello"
            }
        }

    RETURNS:
        {"status": "ok"}
    """

    # Parse Telegram update
    update = await request.json()

    # Extract message
    message = update.get("message")
    if not message:
        # Handle callback queries, inline queries, etc.
        return {"status": "ignored"}

    # Extract text
    text = message.get("text")
    if not text:
        return {"status": "ignored"}

    # Extract user info
    from_user = message.get("from", {})
    chat_id = message.get("chat", {}).get("id")
    user_id = from_user.get("id")

    # Get bot from database (polymorphic)
    from app.models.chatbot import Chatbot
    from app.models.chatflow import Chatflow
    from app.models.api_key import APIKey

    # Try chatbot first
    chatbot = db.query(Chatbot).filter(
        Chatbot.id == bot_id
    ).first()

    if chatbot:
        bot_type = "chatbot"
        bot = chatbot
    else:
        # Try chatflow
        chatflow = db.query(Chatflow).filter(
            Chatflow.id == bot_id
        ).first()

        if chatflow:
            bot_type = "chatflow"
            bot = chatflow
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Bot not found"
            )

    # Check if Telegram is enabled
    deployment_config = bot.deployment_config or {}
    if "telegram" not in deployment_config.get("channels", []):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Telegram not enabled for this bot"
        )

    # Generate session ID
    session_id = f"telegram_{chat_id}"

    # Execute bot
    if bot_type == "chatbot":
        response = await chatbot_service.process_message(
            db=db,
            chatbot=bot,
            user_message=text,
            session_id=session_id,
            channel_context={
                "platform": "telegram",
                "chat_id": chat_id,
                "user_id": user_id,
                "username": from_user.get("username"),
                "first_name": from_user.get("first_name")
            }
        )
    else:
        response = await chatflow_service.execute(
            db=db,
            chatflow=bot,
            user_message=text,
            session_id=session_id,
            channel_context={
                "platform": "telegram",
                "chat_id": chat_id,
                "user_id": user_id,
                "username": from_user.get("username"),
                "first_name": from_user.get("first_name")
            }
        )

    # Send response to Telegram
    telegram_bot_token = deployment_config.get("telegram", {}).get("bot_token")

    if telegram_bot_token:
        await telegram_integration.send_message(
            bot_token=telegram_bot_token,
            chat_id=chat_id,
            message=response["response"]
        )

    return {"status": "ok"}


@router.get("/{bot_id}/webhook-info")
async def get_webhook_info(
    bot_id: UUID,
    db: Session = Depends(get_db)
):
    """
    Get Telegram webhook info.

    WHY: Debug webhook configuration
    HOW: Query Telegram API

    RETURNS:
        {
            "webhook_url": "https://...",
            "is_set": true,
            "pending_update_count": 0
        }
    """

    # Get bot
    from app.models.chatbot import Chatbot
    from app.models.chatflow import Chatflow

    chatbot = db.query(Chatbot).filter(Chatbot.id == bot_id).first()
    if chatbot:
        bot = chatbot
    else:
        chatflow = db.query(Chatflow).filter(Chatflow.id == bot_id).first()
        if chatflow:
            bot = chatflow
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Bot not found"
            )

    # Get bot token
    deployment_config = bot.deployment_config or {}
    telegram_bot_token = deployment_config.get("telegram", {}).get("bot_token")

    if not telegram_bot_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Telegram not configured"
        )

    # Get webhook info from Telegram
    webhook_info = await telegram_integration.get_webhook_info(
        bot_token=telegram_bot_token
    )

    return webhook_info


@router.post("/{bot_id}/set-webhook")
async def set_telegram_webhook(
    bot_id: UUID,
    webhook_url: str,
    db: Session = Depends(get_db)
):
    """
    Set Telegram webhook URL.

    WHY: Configure webhook after deployment
    HOW: Call Telegram setWebhook API

    BODY:
        {
            "webhook_url": "https://api.privexbot.com/webhooks/telegram/{bot_id}"
        }

    RETURNS:
        {"status": "success"}
    """

    # Get bot
    from app.models.chatbot import Chatbot
    from app.models.chatflow import Chatflow

    chatbot = db.query(Chatbot).filter(Chatbot.id == bot_id).first()
    if chatbot:
        bot = chatbot
    else:
        chatflow = db.query(Chatflow).filter(Chatflow.id == bot_id).first()
        if chatflow:
            bot = chatflow
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Bot not found"
            )

    # Get bot token
    deployment_config = bot.deployment_config or {}
    telegram_bot_token = deployment_config.get("telegram", {}).get("bot_token")

    if not telegram_bot_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Telegram not configured"
        )

    # Set webhook
    result = await telegram_integration.set_webhook(
        bot_token=telegram_bot_token,
        webhook_url=webhook_url
    )

    if result["ok"]:
        return {"status": "success"}
    else:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=result.get("description", "Failed to set webhook")
        )


@router.delete("/{bot_id}/webhook")
async def delete_telegram_webhook(
    bot_id: UUID,
    db: Session = Depends(get_db)
):
    """
    Delete Telegram webhook.

    WHY: Remove webhook when disabling Telegram
    HOW: Call Telegram deleteWebhook API

    RETURNS:
        {"status": "deleted"}
    """

    # Get bot
    from app.models.chatbot import Chatbot
    from app.models.chatflow import Chatflow

    chatbot = db.query(Chatbot).filter(Chatbot.id == bot_id).first()
    if chatbot:
        bot = chatbot
    else:
        chatflow = db.query(Chatflow).filter(Chatflow.id == bot_id).first()
        if chatflow:
            bot = chatflow
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Bot not found"
            )

    # Get bot token
    deployment_config = bot.deployment_config or {}
    telegram_bot_token = deployment_config.get("telegram", {}).get("bot_token")

    if not telegram_bot_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Telegram not configured"
        )

    # Delete webhook
    result = await telegram_integration.delete_webhook(
        bot_token=telegram_bot_token
    )

    if result["ok"]:
        return {"status": "deleted"}
    else:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=result.get("description", "Failed to delete webhook")
        )
