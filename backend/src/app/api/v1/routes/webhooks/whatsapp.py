"""
WhatsApp Webhook Handler - Process incoming WhatsApp messages.

WHY:
- Receive messages from WhatsApp Business API
- Route to chatbot/chatflow execution
- Send responses back to WhatsApp

HOW:
- FastAPI webhook endpoint
- WhatsApp webhook verification
- Message parsing
- Bot execution delegation

PSEUDOCODE follows the existing codebase patterns.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from sqlalchemy.orm import Session
from uuid import UUID
from typing import Optional

from app.db.session import get_db
from app.integrations.whatsapp_integration import whatsapp_integration
from app.services.chatbot_service import chatbot_service
from app.services.chatflow_service import chatflow_service

router = APIRouter(prefix="/webhooks/whatsapp", tags=["webhooks"])


@router.get("/{bot_id}")
async def whatsapp_webhook_verification(
    bot_id: UUID,
    hub_mode: Optional[str] = Query(None, alias="hub.mode"),
    hub_challenge: Optional[str] = Query(None, alias="hub.challenge"),
    hub_verify_token: Optional[str] = Query(None, alias="hub.verify_token"),
    db: Session = Depends(get_db)
):
    """
    WhatsApp webhook verification.

    WHY: Verify webhook with Facebook/WhatsApp
    HOW: Check verify token and return challenge

    URL:
        GET /webhooks/whatsapp/{bot_id}?hub.mode=subscribe&hub.challenge=123&hub.verify_token=token

    RETURNS:
        hub.challenge (as plain text)
    """

    # Get bot from database
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

    # Check if WhatsApp is enabled
    deployment_config = bot.deployment_config or {}
    if "whatsapp" not in deployment_config.get("channels", []):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="WhatsApp not enabled for this bot"
        )

    # Get verify token
    whatsapp_config = deployment_config.get("whatsapp", {})
    expected_verify_token = whatsapp_config.get("verify_token")

    # Verify webhook
    if hub_mode == "subscribe" and hub_verify_token == expected_verify_token:
        return int(hub_challenge)  # Return challenge as integer
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid verify token"
        )


@router.post("/{bot_id}")
async def whatsapp_webhook(
    bot_id: UUID,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    WhatsApp webhook handler.

    WHY: Receive and process WhatsApp messages
    HOW: Parse webhook, extract message, execute bot

    FLOW:
    1. Parse WhatsApp webhook
    2. Extract message and sender info
    3. Get bot from database
    4. Execute bot
    5. Send response via WhatsApp API

    URL:
        POST /webhooks/whatsapp/{bot_id}

    BODY:
        {
            "object": "whatsapp_business_account",
            "entry": [
                {
                    "changes": [
                        {
                            "value": {
                                "messaging_product": "whatsapp",
                                "messages": [
                                    {
                                        "from": "1234567890",
                                        "id": "wamid.xxx",
                                        "text": {
                                            "body": "Hello"
                                        },
                                        "type": "text"
                                    }
                                ]
                            }
                        }
                    ]
                }
            ]
        }

    RETURNS:
        {"status": "ok"}
    """

    # Parse webhook
    webhook_data = await request.json()

    # Get bot from database
    from app.models.chatbot import Chatbot
    from app.models.chatflow import Chatflow

    chatbot = db.query(Chatbot).filter(Chatbot.id == bot_id).first()
    if chatbot:
        bot_type = "chatbot"
        bot = chatbot
    else:
        chatflow = db.query(Chatflow).filter(Chatflow.id == bot_id).first()
        if chatflow:
            bot_type = "chatflow"
            bot = chatflow
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Bot not found"
            )

    # Check if WhatsApp is enabled
    deployment_config = bot.deployment_config or {}
    if "whatsapp" not in deployment_config.get("channels", []):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="WhatsApp not enabled for this bot"
        )

    # Extract message from webhook
    entry = webhook_data.get("entry", [])
    if not entry:
        return {"status": "ignored"}

    changes = entry[0].get("changes", [])
    if not changes:
        return {"status": "ignored"}

    value = changes[0].get("value", {})
    messages = value.get("messages", [])

    if not messages:
        return {"status": "ignored"}

    message = messages[0]

    # Extract message details
    message_type = message.get("type")
    from_number = message.get("from")
    message_id = message.get("id")

    # Only handle text messages for now
    if message_type != "text":
        return {"status": "ignored"}

    text = message.get("text", {}).get("body", "")

    # Generate session ID
    session_id = f"whatsapp_{from_number}"

    # Get WhatsApp config
    whatsapp_config = deployment_config.get("whatsapp", {})
    access_token = whatsapp_config.get("access_token")
    phone_number_id = whatsapp_config.get("phone_number_id")

    # Execute bot
    if bot_type == "chatbot":
        response = await chatbot_service.process_message(
            db=db,
            chatbot=bot,
            user_message=text,
            session_id=session_id,
            channel_context={
                "platform": "whatsapp",
                "from_number": from_number,
                "message_id": message_id
            }
        )
    else:
        response = await chatflow_service.execute(
            db=db,
            chatflow=bot,
            user_message=text,
            session_id=session_id,
            channel_context={
                "platform": "whatsapp",
                "from_number": from_number,
                "message_id": message_id
            }
        )

    # Send response to WhatsApp
    if access_token and phone_number_id:
        await whatsapp_integration.send_message(
            access_token=access_token,
            phone_number_id=phone_number_id,
            to=from_number,
            message=response["response"]
        )

    return {"status": "ok"}


@router.post("/{bot_id}/send-template")
async def send_whatsapp_template(
    bot_id: UUID,
    to: str,
    template_data: dict,
    db: Session = Depends(get_db)
):
    """
    Send WhatsApp template message.

    WHY: Send pre-approved template messages
    HOW: Call WhatsApp API with template

    BODY:
        {
            "to": "1234567890",
            "template_name": "welcome_message",
            "language": "en",
            "components": [...]
        }

    RETURNS:
        {
            "message_id": "wamid.xxx",
            "status": "sent"
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

    # Get WhatsApp config
    deployment_config = bot.deployment_config or {}
    whatsapp_config = deployment_config.get("whatsapp", {})
    access_token = whatsapp_config.get("access_token")
    phone_number_id = whatsapp_config.get("phone_number_id")

    if not access_token or not phone_number_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="WhatsApp not properly configured"
        )

    # Send template
    result = await whatsapp_integration.send_template_message(
        access_token=access_token,
        phone_number_id=phone_number_id,
        to=to,
        template_name=template_data["template_name"],
        language=template_data.get("language", "en"),
        components=template_data.get("components", [])
    )

    return result


@router.get("/{bot_id}/templates")
async def get_whatsapp_templates(
    bot_id: UUID,
    db: Session = Depends(get_db)
):
    """
    Get approved WhatsApp templates.

    WHY: View available templates
    HOW: Query WhatsApp Business API

    RETURNS:
        {
            "templates": [
                {
                    "name": "welcome_message",
                    "language": "en",
                    "status": "APPROVED",
                    "components": [...]
                }
            ]
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

    # Get WhatsApp config
    deployment_config = bot.deployment_config or {}
    whatsapp_config = deployment_config.get("whatsapp", {})
    access_token = whatsapp_config.get("access_token")
    business_account_id = whatsapp_config.get("business_account_id")

    if not access_token or not business_account_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="WhatsApp not properly configured"
        )

    # Get templates
    templates = await whatsapp_integration.get_message_templates(
        access_token=access_token,
        business_account_id=business_account_id
    )

    return {"templates": templates}
