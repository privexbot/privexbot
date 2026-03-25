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
from app.services.credential_service import credential_service
from app.models.credential import Credential

# Chatflow is optional - may not be implemented yet
try:
    from app.services.chatflow_service import chatflow_service
    CHATFLOW_AVAILABLE = True
except ImportError:
    chatflow_service = None
    CHATFLOW_AVAILABLE = False

router = APIRouter(prefix="/webhooks/telegram", tags=["webhooks"])


def _get_telegram_bot_token(db: Session, deployment_config: dict) -> Optional[str]:
    """
    Get Telegram bot token from deployment config using credential service.

    WHY: Tokens are stored as credential_id references, not raw values
    HOW: Look up credential, decrypt, return bot_token
    """
    telegram_channel = deployment_config.get("telegram", {})
    credential_id = telegram_channel.get("bot_token_credential_id")

    if not credential_id:
        return None

    try:
        credential = db.query(Credential).get(UUID(credential_id))
        if not credential:
            return None

        cred_data = credential_service.get_decrypted_data(db, credential)
        return cred_data.get("bot_token")
    except Exception:
        return None


def _is_chat_allowed(deployment_config: dict, chat_id: int) -> bool:
    """
    Check if chat_id is allowed based on allowlist/blocklist.

    WHY: Users may want to restrict bot to specific groups/channels
    HOW: Check against allowed_chat_ids and blocked_chat_ids in config

    RULES:
    - If both lists empty → allow all
    - If allowed_chat_ids set → only allow if in list
    - If blocked_chat_ids set → block if in list
    - allowed_chat_ids takes precedence over blocked_chat_ids
    """
    telegram_channel = deployment_config.get("telegram", {})

    allowed_chat_ids = telegram_channel.get("allowed_chat_ids", [])
    blocked_chat_ids = telegram_channel.get("blocked_chat_ids", [])

    chat_id_str = str(chat_id)

    # If allowlist is set, only allow chats in the list
    if allowed_chat_ids:
        return chat_id_str in [str(cid) for cid in allowed_chat_ids]

    # If blocklist is set, block chats in the list
    if blocked_chat_ids:
        return chat_id_str not in [str(cid) for cid in blocked_chat_ids]

    # No restrictions - allow all
    return True


def _resolve_bot(db: Session, bot_id: UUID):
    """
    Resolve bot_id to Chatbot or Chatflow.

    Returns (bot_type, bot, deployment_config).
    Chatbot uses bot.deployment_config (dedicated column).
    Chatflow uses chatflow.config["deployment"] (nested in config JSONB).
    """
    from app.models.chatbot import Chatbot
    from app.models.chatflow import Chatflow

    bot = db.query(Chatbot).filter(Chatbot.id == bot_id).first()
    if bot:
        return "chatbot", bot, bot.deployment_config or {}

    chatflow = db.query(Chatflow).filter(Chatflow.id == bot_id).first()
    if chatflow:
        return "chatflow", chatflow, (chatflow.config or {}).get("deployment", {})

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Bot not found"
    )


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

    # Get bot from database (supports both chatbots and chatflows)
    bot_type, bot, deployment_config = _resolve_bot(db, bot_id)

    # Check if Telegram is enabled
    telegram_config = deployment_config.get("telegram", {})

    if not telegram_config or telegram_config.get("status") != "success":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Telegram not enabled for this bot"
        )

    # Verify webhook secret token (Telegram sends this in header if configured)
    webhook_secret = telegram_config.get("webhook_secret")
    if webhook_secret:
        header_token = request.headers.get("X-Telegram-Bot-Api-Secret-Token")
        if header_token != webhook_secret:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid webhook signature"
            )

    # Check if this chat is allowed (allowlist/blocklist filtering)
    if not _is_chat_allowed(deployment_config, chat_id):
        # Silently ignore messages from blocked/non-allowed chats
        return {"status": "ignored", "reason": "chat_not_allowed"}

    # Generate session ID (includes user_id for per-user isolation in group chats)
    session_id = f"telegram_{chat_id}_{user_id}"

    # Execute bot (chatbot or chatflow)
    channel_context = {
        "platform": "telegram",
        "chat_id": chat_id,
        "user_id": user_id,
        "username": from_user.get("username"),
        "first_name": from_user.get("first_name")
    }

    if bot_type == "chatbot":
        response = await chatbot_service.process_message(
            db=db,
            chatbot=bot,
            user_message=text,
            session_id=session_id,
            channel_context=channel_context
        )
    else:  # chatflow
        response = await chatflow_service.execute(
            db=db,
            chatflow=bot,
            user_message=text,
            session_id=session_id,
            channel_context=channel_context
        )

    # Send response to Telegram
    telegram_bot_token = _get_telegram_bot_token(db, deployment_config)

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

    # Get bot (supports both chatbots and chatflows)
    bot_type, bot, deployment_config = _resolve_bot(db, bot_id)

    # Get bot token via credential service
    telegram_bot_token = _get_telegram_bot_token(db, deployment_config)

    if not telegram_bot_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Telegram not configured or token credential not found"
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

    # Get bot (supports both chatbots and chatflows)
    bot_type, bot, deployment_config = _resolve_bot(db, bot_id)

    # Get bot token via credential service
    telegram_bot_token = _get_telegram_bot_token(db, deployment_config)

    if not telegram_bot_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Telegram not configured or token credential not found"
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

    # Get bot (supports both chatbots and chatflows)
    bot_type, bot, deployment_config = _resolve_bot(db, bot_id)

    # Get bot token via credential service
    telegram_bot_token = _get_telegram_bot_token(db, deployment_config)

    if not telegram_bot_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Telegram not configured or token credential not found"
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
