"""
Discord Webhook Handler - Process incoming Discord messages.

WHY:
- Receive messages from Discord
- Route to chatbot/chatflow execution
- Send responses back to Discord

HOW:
- FastAPI webhook endpoint
- Discord interaction parsing
- Bot execution delegation
- Response formatting

PSEUDOCODE follows the existing codebase patterns.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Request, Header
from sqlalchemy.orm import Session
from uuid import UUID
from typing import Optional
import hmac
import hashlib

from app.db.session import get_db
from app.integrations.discord_integration import discord_integration
from app.services.chatbot_service import chatbot_service
from app.services.chatflow_service import chatflow_service

router = APIRouter(prefix="/webhooks/discord", tags=["webhooks"])


@router.post("/{bot_id}")
async def discord_webhook(
    bot_id: UUID,
    request: Request,
    x_signature_ed25519: Optional[str] = Header(None),
    x_signature_timestamp: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """
    Discord webhook handler.

    WHY: Receive and process Discord interactions
    HOW: Verify signature, parse interaction, execute bot

    FLOW:
    1. Verify Discord signature
    2. Parse interaction
    3. Handle interaction type (PING, MESSAGE_CREATE, etc.)
    4. Execute bot
    5. Send response to Discord

    URL:
        POST /webhooks/discord/{bot_id}

    BODY:
        {
            "type": 2,  // MESSAGE_CREATE
            "data": {
                "content": "Hello"
            },
            "member": {
                "user": {
                    "id": "12345",
                    "username": "johndoe"
                }
            },
            "channel_id": "67890"
        }

    RETURNS:
        {
            "type": 4,  // CHANNEL_MESSAGE_WITH_SOURCE
            "data": {
                "content": "Response message"
            }
        }
    """

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

    # Check if Discord is enabled
    deployment_config = bot.deployment_config or {}
    if "discord" not in deployment_config.get("channels", []):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Discord not enabled for this bot"
        )

    # Get public key for verification
    discord_config = deployment_config.get("discord", {})
    public_key = discord_config.get("public_key")

    # Parse body
    body = await request.body()
    interaction = await request.json()

    # Verify signature
    if public_key and x_signature_ed25519 and x_signature_timestamp:
        is_valid = discord_integration.verify_signature(
            body=body,
            signature=x_signature_ed25519,
            timestamp=x_signature_timestamp,
            public_key=public_key
        )

        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid signature"
            )

    # Handle interaction type
    interaction_type = interaction.get("type")

    # Type 1: PING (Discord verification)
    if interaction_type == 1:
        return {"type": 1}

    # Type 2: APPLICATION_COMMAND or Type 3: MESSAGE_COMPONENT
    if interaction_type in [2, 3]:
        # Extract message
        data = interaction.get("data", {})
        message_content = data.get("content") or data.get("custom_id", "")

        # Extract user info
        member = interaction.get("member", {})
        user = member.get("user", {}) or interaction.get("user", {})
        user_id = user.get("id")
        username = user.get("username")
        channel_id = interaction.get("channel_id")

        # Generate session ID
        session_id = f"discord_{channel_id}_{user_id}"

        # Execute bot
        if bot_type == "chatbot":
            response = await chatbot_service.process_message(
                db=db,
                chatbot=bot,
                user_message=message_content,
                session_id=session_id,
                channel_context={
                    "platform": "discord",
                    "channel_id": channel_id,
                    "user_id": user_id,
                    "username": username
                }
            )
        else:
            response = await chatflow_service.execute(
                db=db,
                chatflow=bot,
                user_message=message_content,
                session_id=session_id,
                channel_context={
                    "platform": "discord",
                    "channel_id": channel_id,
                    "user_id": user_id,
                    "username": username
                }
            )

        # Return Discord interaction response
        return {
            "type": 4,  # CHANNEL_MESSAGE_WITH_SOURCE
            "data": {
                "content": response["response"]
            }
        }

    # Unknown interaction type
    return {"type": 4, "data": {"content": "Unknown interaction type"}}


@router.post("/{bot_id}/register-commands")
async def register_discord_commands(
    bot_id: UUID,
    commands: list,
    db: Session = Depends(get_db)
):
    """
    Register Discord slash commands.

    WHY: Configure bot commands
    HOW: Call Discord API

    BODY:
        {
            "commands": [
                {
                    "name": "help",
                    "description": "Get help",
                    "type": 1
                }
            ]
        }

    RETURNS:
        {"status": "registered", "commands_count": 1}
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

    # Get Discord config
    deployment_config = bot.deployment_config or {}
    discord_config = deployment_config.get("discord", {})
    bot_token = discord_config.get("bot_token")
    application_id = discord_config.get("application_id")

    if not bot_token or not application_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Discord not properly configured"
        )

    # Register commands
    result = await discord_integration.register_global_commands(
        bot_token=bot_token,
        application_id=application_id,
        commands=commands
    )

    return {
        "status": "registered",
        "commands_count": len(commands)
    }


@router.get("/{bot_id}/commands")
async def get_discord_commands(
    bot_id: UUID,
    db: Session = Depends(get_db)
):
    """
    Get registered Discord commands.

    WHY: View current commands
    HOW: Query Discord API

    RETURNS:
        {
            "commands": [...]
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

    # Get Discord config
    deployment_config = bot.deployment_config or {}
    discord_config = deployment_config.get("discord", {})
    bot_token = discord_config.get("bot_token")
    application_id = discord_config.get("application_id")

    if not bot_token or not application_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Discord not properly configured"
        )

    # Get commands
    commands = await discord_integration.get_global_commands(
        bot_token=bot_token,
        application_id=application_id
    )

    return {"commands": commands}
