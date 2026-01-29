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
from app.services.credential_service import credential_service
from app.services.discord_guild_service import discord_guild_service
from app.models.credential import Credential
from app.core.config import settings

# Chatflow is optional - may not be implemented yet
try:
    from app.services.chatflow_service import chatflow_service
    CHATFLOW_AVAILABLE = True
except ImportError:
    chatflow_service = None
    CHATFLOW_AVAILABLE = False

router = APIRouter(prefix="/webhooks/discord", tags=["webhooks"])


def _get_discord_bot_token(db: Session, deployment_config: dict) -> Optional[str]:
    """
    Get Discord bot token from deployment config using credential service.

    WHY: Tokens are stored as credential_id references, not raw values
    HOW: Look up credential, decrypt, return bot_token
    """
    discord_channel = deployment_config.get("discord", {})
    credential_id = discord_channel.get("bot_token_credential_id")

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


def _is_guild_allowed(deployment_config: dict, guild_id: str) -> bool:
    """
    Check if guild_id (server) is allowed based on allowlist/blocklist.

    WHY: Users may want to restrict bot to specific Discord servers
    HOW: Check against allowed_guild_ids and blocked_guild_ids in config

    RULES:
    - If both lists empty → allow all
    - If allowed_guild_ids set → only allow if in list
    - If blocked_guild_ids set → block if in list
    - allowed_guild_ids takes precedence over blocked_guild_ids
    """
    discord_channel = deployment_config.get("discord", {})

    allowed_guild_ids = discord_channel.get("allowed_guild_ids", [])
    blocked_guild_ids = discord_channel.get("blocked_guild_ids", [])

    guild_id_str = str(guild_id) if guild_id else ""

    # If allowlist is set, only allow guilds in the list
    if allowed_guild_ids:
        return guild_id_str in [str(gid) for gid in allowed_guild_ids]

    # If blocklist is set, block guilds in the list
    if blocked_guild_ids:
        return guild_id_str not in [str(gid) for gid in blocked_guild_ids]

    # No restrictions - allow all
    return True


# ═══════════════════════════════════════════════════════════════════════════════
# SHARED BOT ARCHITECTURE - Routes messages to correct chatbot based on guild_id
# IMPORTANT: Literal /shared* routes MUST be defined before /{bot_id} routes,
# otherwise FastAPI matches "shared" as a bot_id UUID and returns 422.
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/shared")
async def discord_shared_webhook(
    request: Request,
    x_signature_ed25519: Optional[str] = Header(None),
    x_signature_timestamp: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """
    Shared Discord bot webhook - routes messages to correct chatbot based on guild_id.

    WHY: ONE Discord bot serves ALL customers
    HOW: guild_id → DiscordGuildDeployment → chatbot_id → process message

    ARCHITECTURE:
    1. Shared bot receives message with guild_id
    2. Lookup DiscordGuildDeployment by guild_id
    3. Route to correct chatbot for AI processing
    4. Return response to Discord

    URL:
        POST /webhooks/discord/shared

    FLOW:
        User types in Discord → Shared bot receives →
        Lookup guild deployment → Route to chatbot →
        AI generates response → Return to Discord

    RETURNS:
        Discord interaction response
    """
    # Get raw body for signature verification
    body = await request.body()

    # Verify signature using shared bot public key
    public_key = settings.DISCORD_SHARED_PUBLIC_KEY

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

    # Parse interaction
    interaction = await request.json()
    interaction_type = interaction.get("type")

    # Type 1: PING (Discord verification)
    if interaction_type == 1:
        return {"type": 1}

    # Extract guild_id
    guild_id = interaction.get("guild_id")
    if not guild_id:
        # DM not supported in shared bot architecture
        return {
            "type": 4,
            "data": {
                "content": "Direct messages are not supported. Please use me in a server.",
                "flags": 64  # Ephemeral
            }
        }

    # Lookup chatbot for this guild
    result = discord_guild_service.get_chatbot_for_guild(db, guild_id)

    if not result:
        return {
            "type": 4,
            "data": {
                "content": "This bot is not configured for this server. Please contact your administrator.",
                "flags": 64  # Ephemeral
            }
        }

    chatbot, deployment = result

    # Check channel restrictions
    channel_id = interaction.get("channel_id")
    if not deployment.check_channel_access(channel_id):
        # Silent ignore for restricted channels
        return {
            "type": 4,
            "data": {
                "content": "",
                "flags": 64  # Ephemeral empty
            }
        }

    # Extract user info
    member = interaction.get("member", {})
    user = member.get("user", {}) or interaction.get("user", {})
    user_id = user.get("id")
    username = user.get("username")

    # Extract message content based on interaction type
    if interaction_type == 2:  # APPLICATION_COMMAND (slash command)
        data = interaction.get("data", {})
        command_name = data.get("name", "")
        options = data.get("options", [])

        # Handle different command structures
        if command_name == "ask" and options:
            # /ask command with message option
            message_content = options[0].get("value", "")
        elif command_name == "chat" and options:
            # /chat command with message option
            message_content = options[0].get("value", "")
        elif options:
            # Generic: first option value
            message_content = options[0].get("value", "")
        else:
            message_content = f"/{command_name}"

    elif interaction_type == 3:  # MESSAGE_COMPONENT (button, select menu)
        data = interaction.get("data", {})
        message_content = data.get("custom_id", "")

    else:
        message_content = ""

    if not message_content:
        return {
            "type": 4,
            "data": {
                "content": "Please provide a message.",
                "flags": 64  # Ephemeral
            }
        }

    # Generate session ID (unique per user in channel)
    session_id = f"discord_{guild_id}_{channel_id}_{user_id}"

    # Update guild metadata (track last message)
    discord_guild_service.update_guild_metadata(
        db=db,
        guild_id=guild_id,
        metadata_updates={
            "last_message_at": interaction.get("timestamp"),
            "total_messages": (deployment.guild_metadata or {}).get("total_messages", 0) + 1
        }
    )

    # Process message through chatbot service
    response = await chatbot_service.process_message(
        db=db,
        chatbot=chatbot,
        user_message=message_content,
        session_id=session_id,
        channel_context={
            "platform": "discord",
            "guild_id": guild_id,
            "channel_id": channel_id,
            "user_id": user_id,
            "username": username,
            "guild_name": deployment.guild_name
        }
    )

    # Truncate response to Discord's 2000 char limit
    response_text = response.get("response", "")[:2000]

    # Return Discord interaction response
    return {
        "type": 4,  # CHANNEL_MESSAGE_WITH_SOURCE
        "data": {
            "content": response_text
        }
    }


@router.get("/shared/invite-url")
async def get_shared_bot_invite_url():
    """
    Get the invite URL for the shared Discord bot.

    WHY: Users need to add the shared bot to their server
    HOW: Generate OAuth2 URL with appropriate permissions

    RETURNS:
        {
            "invite_url": "https://discord.com/api/oauth2/authorize?...",
            "application_id": "123456789"
        }
    """
    try:
        invite_url = discord_guild_service.generate_invite_url()
        return {
            "invite_url": invite_url,
            "application_id": settings.DISCORD_SHARED_APPLICATION_ID
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/shared/register-commands")
async def register_shared_bot_commands():
    """
    Register slash commands for the shared Discord bot.

    WHY: Enable /ask and /chat commands for shared bot architecture
    HOW: Call Discord API with shared bot credentials

    IMPORTANT: This is a one-time setup operation. Call this after:
    1. Setting DISCORD_SHARED_BOT_TOKEN and DISCORD_SHARED_APPLICATION_ID in .env
    2. Setting "Interactions Endpoint URL" in Discord Developer Portal to:
       https://your-domain.com/api/v1/webhooks/discord/shared

    Commands registered:
    - /ask <message> - Ask the chatbot a question
    - /chat <message> - Chat with the chatbot

    RETURNS:
        {
            "status": "registered",
            "commands": [...],
            "discord_response": {...}
        }
    """
    bot_token = settings.DISCORD_SHARED_BOT_TOKEN
    application_id = settings.DISCORD_SHARED_APPLICATION_ID

    if not bot_token or not application_id:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Shared Discord bot not configured. Set DISCORD_SHARED_BOT_TOKEN and DISCORD_SHARED_APPLICATION_ID in environment."
        )

    # Default slash commands for shared bot
    commands = [
        {
            "name": "ask",
            "description": "Ask the chatbot a question",
            "type": 1,  # CHAT_INPUT
            "options": [
                {
                    "name": "message",
                    "description": "Your question or message",
                    "type": 3,  # STRING
                    "required": True
                }
            ]
        },
        {
            "name": "chat",
            "description": "Chat with the chatbot",
            "type": 1,  # CHAT_INPUT
            "options": [
                {
                    "name": "message",
                    "description": "Your message",
                    "type": 3,  # STRING
                    "required": True
                }
            ]
        }
    ]

    result = await discord_integration.register_global_commands(
        bot_token=bot_token,
        application_id=application_id,
        commands=commands
    )

    return {
        "status": "registered",
        "commands": commands,
        "discord_response": result
    }


@router.get("/shared/commands")
async def get_shared_bot_commands():
    """
    Get currently registered commands for the shared Discord bot.

    WHY: View current commands for debugging/verification
    HOW: Query Discord API with shared bot credentials

    RETURNS:
        {
            "commands": [...]
        }
    """
    bot_token = settings.DISCORD_SHARED_BOT_TOKEN
    application_id = settings.DISCORD_SHARED_APPLICATION_ID

    if not bot_token or not application_id:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Shared Discord bot not configured. Set DISCORD_SHARED_BOT_TOKEN and DISCORD_SHARED_APPLICATION_ID in environment."
        )

    commands = await discord_integration.get_global_commands(
        bot_token=bot_token,
        application_id=application_id
    )

    return {"commands": commands}


# ═══════════════════════════════════════════════════════════════════════════════
# PER-BOT ROUTES - Parameterized /{bot_id} routes (must come after /shared*)
# ═══════════════════════════════════════════════════════════════════════════════

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

    # Try chatbot first (primary use case)
    bot = db.query(Chatbot).filter(Chatbot.id == bot_id).first()
    if not bot:
        # Chatflow not yet implemented - return 404
        # TODO: Add chatflow support when Chatflow model is available
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bot not found"
        )

    # Check if Discord is enabled
    deployment_config = bot.deployment_config or {}
    discord_config = deployment_config.get("discord", {})

    if not discord_config or discord_config.get("status") != "success":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Discord not enabled for this bot"
        )

    # Get public key for verification
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
        # Extract guild_id for filtering
        guild_id = interaction.get("guild_id")

        # Check if this guild is allowed (allowlist/blocklist filtering)
        if not _is_guild_allowed(deployment_config, guild_id):
            # Return empty response for blocked guilds
            return {"type": 4, "data": {"content": "", "flags": 64}}  # Ephemeral empty

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
        session_id = f"discord_{guild_id}_{channel_id}_{user_id}"

        # Execute chatbot
        # TODO: Add chatflow support when Chatflow model is available
        response = await chatbot_service.process_message(
            db=db,
            chatbot=bot,
            user_message=message_content,
            session_id=session_id,
            channel_context={
                "platform": "discord",
                "guild_id": guild_id,
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

    bot = db.query(Chatbot).filter(Chatbot.id == bot_id).first()
    if not bot:
        # TODO: Add chatflow support when Chatflow model is available
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bot not found"
        )

    # Get Discord config via credential service
    deployment_config = bot.deployment_config or {}
    discord_config = deployment_config.get("discord", {})
    bot_token = _get_discord_bot_token(db, deployment_config)
    application_id = discord_config.get("application_id")

    if not bot_token or not application_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Discord not properly configured or token credential not found"
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

    bot = db.query(Chatbot).filter(Chatbot.id == bot_id).first()
    if not bot:
        # TODO: Add chatflow support when Chatflow model is available
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bot not found"
        )

    # Get Discord config via credential service
    deployment_config = bot.deployment_config or {}
    discord_config = deployment_config.get("discord", {})
    bot_token = _get_discord_bot_token(db, deployment_config)
    application_id = discord_config.get("application_id")

    if not bot_token or not application_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Discord not properly configured or token credential not found"
        )

    # Get commands
    commands = await discord_integration.get_global_commands(
        bot_token=bot_token,
        application_id=application_id
    )

    return {"commands": commands}
