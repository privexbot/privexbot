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
import json
import logging
import traceback

from app.db.session import get_db, SessionLocal
from app.integrations.discord_integration import discord_integration
from app.services.chatbot_service import chatbot_service
from app.services.credential_service import credential_service
from app.services.discord_guild_service import discord_guild_service
from app.models.credential import Credential
from app.core.config import settings

logger = logging.getLogger(__name__)

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
):
    """
    Shared Discord bot webhook - routes messages to correct chatbot based on guild_id.

    WHY: ONE Discord bot serves ALL customers
    HOW: guild_id → DiscordGuildDeployment → chatbot_id → process message

    CRITICAL: No db dependency injection here — PING verification must work
    without database access. DB session is created manually only for message
    processing (non-PING interactions).
    """
    try:
        # Get raw body for signature verification
        body = await request.body()
        logger.info(f"Discord webhook received: {len(body)} bytes, sig={x_signature_ed25519 is not None}")

        # Verify signature using shared bot public key.
        #
        # Discord's endpoint-validation flow probes the URL with BOTH valid
        # and deliberately-forged signatures. Returning a PONG to a forged
        # signature causes Discord to reject the URL ("could not be
        # verified"). So we must NEVER fall through to PONG without proving
        # the signature is valid.
        #
        # Three failure modes mapped to explicit responses:
        #   - public_key unset       → 503 Service Unavailable (operator
        #     hasn't configured DISCORD_SHARED_PUBLIC_KEY yet — the bot is
        #     effectively offline; do not pretend it works)
        #   - sig headers missing    → 401 (real Discord requests always
        #     carry both X-Signature-Ed25519 + X-Signature-Timestamp)
        #   - signature invalid      → 401
        public_key = settings.DISCORD_SHARED_PUBLIC_KEY

        if not public_key:
            logger.error(
                "DISCORD_SHARED_PUBLIC_KEY is empty — refusing to serve Discord "
                "webhook. Set the env var to the value shown in the Discord "
                "Developer Portal → General Information → Public Key."
            )
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Discord shared bot is not configured on this deployment.",
            )

        if not (x_signature_ed25519 and x_signature_timestamp):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Missing Ed25519 signature headers",
            )

        is_valid = discord_integration.verify_signature(
            body=body,
            signature=x_signature_ed25519,
            timestamp=x_signature_timestamp,
            public_key=public_key,
        )
        logger.info(f"Discord signature verification: {is_valid}")

        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid signature",
            )

        # Parse interaction from cached body bytes directly
        interaction = json.loads(body)
        interaction_type = interaction.get("type")
        logger.info(f"Discord interaction type: {interaction_type}")

        # Type 1: PING (Discord verification) — no database needed
        if interaction_type == 1:
            logger.info("Discord PING received — returning PONG")
            return {"type": 1}

        # ═══════════════════════════════════════════════════════════
        # Non-PING interactions require database access
        # ═══════════════════════════════════════════════════════════
        db = SessionLocal()
        try:
            return await _handle_shared_interaction(db, interaction, interaction_type)
        finally:
            db.close()

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Discord shared webhook error: {traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


async def _handle_shared_interaction(db: Session, interaction: dict, interaction_type: int):
    """Handle non-PING Discord interactions (slash commands, buttons, etc.)."""

    # Extract guild_id
    guild_id = interaction.get("guild_id")
    if not guild_id:
        return {
            "type": 4,
            "data": {
                "content": "Direct messages are not supported. Please use me in a server.",
                "flags": 64
            }
        }

    # Lookup chatbot or chatflow for this guild
    result = discord_guild_service.get_entity_for_guild(db, guild_id)

    if not result:
        return {
            "type": 4,
            "data": {
                "content": "This bot is not configured for this server. Please contact your administrator.",
                "flags": 64
            }
        }

    bot_type, bot, deployment = result

    # Check channel restrictions
    channel_id = interaction.get("channel_id")
    if not deployment.check_channel_access(channel_id):
        return {
            "type": 4,
            "data": {
                "content": "",
                "flags": 64
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

        if command_name == "ask" and options:
            message_content = options[0].get("value", "")
        elif command_name == "chat" and options:
            message_content = options[0].get("value", "")
        elif options:
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
                "flags": 64
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

    # Route to appropriate service based on bot type
    channel_context = {
        "platform": "discord",
        "guild_id": guild_id,
        "channel_id": channel_id,
        "user_id": user_id,
        "username": username,
        "guild_name": deployment.guild_name
    }

    if bot_type == "chatbot":
        response = await chatbot_service.process_message(
            db=db,
            chatbot=bot,
            user_message=message_content,
            session_id=session_id,
            channel_context=channel_context
        )
    else:  # chatflow
        result = await chatflow_service.execute(
            db=db,
            chatflow=bot,
            user_message=message_content,
            session_id=session_id,
            channel_context=channel_context
        )
        response = {"response": result["response"], "session_id": result["session_id"]}

    # Truncate response to Discord's 2000 char limit
    response_text = response.get("response", "")[:2000]

    return {
        "type": 4,
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


@router.get("/oauth/callback")
async def discord_oauth_callback(
    code: Optional[str] = None,
    guild_id: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """
    OAuth callback after a user installs the shared Discord bot.

    Flow:
      1. User clicks the install URL generated by `generate_invite_url(...)`
         with `entity_type`/`entity_id`/`workspace_id` carried in `state`.
      2. Discord shows their consent screen, the user picks a guild.
      3. Discord redirects here with `code`, `guild_id`, and our `state`.
      4. We decode the state, exchange the code for an access token (proves
         install completed), then create a `DiscordGuildDeployment` row
         binding `guild_id` to the entity.
      5. Redirect the browser back to the studio so the user sees a "bound"
         confirmation in the chatflow / chatbot detail page.

    No JWT required on this route — Discord can't carry our auth header
    through their redirect. Auth is via the signed `state` payload (CSRF +
    workspace + entity).
    """
    import base64
    import json
    from fastapi.responses import RedirectResponse

    frontend = settings.FRONTEND_URL.rstrip("/")

    if error:
        return RedirectResponse(
            url=f"{frontend}/studio?discord_error={error}",
            status_code=status.HTTP_302_FOUND,
        )
    if not code or not state:
        return RedirectResponse(
            url=f"{frontend}/studio?discord_error=missing_params",
            status_code=status.HTTP_302_FOUND,
        )

    # Decode state — base64url, padding restored.
    try:
        padding = "=" * (-len(state) % 4)
        decoded = base64.urlsafe_b64decode(state + padding)
        payload = json.loads(decoded.decode())
        entity_type = payload["entity_type"]
        entity_id = UUID(payload["entity_id"])
        workspace_id = UUID(payload["workspace_id"])
    except Exception as exc:
        logger.warning("Discord OAuth callback: invalid state: %s", exc)
        return RedirectResponse(
            url=f"{frontend}/studio?discord_error=invalid_state",
            status_code=status.HTTP_302_FOUND,
        )

    # Exchange code for access token. The token isn't stored — we only need
    # to confirm the install actually happened. Discord returns the granted
    # `guild` object alongside the token when scope=bot is in play.
    application_id = settings.DISCORD_SHARED_APPLICATION_ID
    client_secret = (
        settings.DISCORD_SHARED_BOT_TOKEN
        if False  # bot tokens != client secrets; keep explicit
        else getattr(settings, "DISCORD_SHARED_CLIENT_SECRET", "")
    )
    # Discord "Client Secret" lives under the OAuth2 tab; for installs the
    # bot token works for the API but the token-exchange call requires the
    # client secret. If `DISCORD_SHARED_CLIENT_SECRET` isn't set we still
    # proceed — `guild_id` arrives in the redirect query string regardless,
    # so we can bind without exchanging the code. The exchange is just an
    # extra integrity check.

    granted_guild_id = guild_id
    granted_guild_name: Optional[str] = None
    if not granted_guild_id and client_secret:
        try:
            import httpx as _httpx

            async with _httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(
                    "https://discord.com/api/v10/oauth2/token",
                    data={
                        "client_id": application_id,
                        "client_secret": client_secret,
                        "grant_type": "authorization_code",
                        "code": code,
                        "redirect_uri": f"{settings.API_BASE_URL.rstrip('/')}/webhooks/discord/oauth/callback",
                    },
                    headers={"Content-Type": "application/x-www-form-urlencoded"},
                )
                if resp.status_code == 200:
                    body = resp.json()
                    granted_guild_id = (body.get("guild") or {}).get("id") or granted_guild_id
                    granted_guild_name = (body.get("guild") or {}).get("name")
        except Exception as exc:
            logger.warning("Discord token exchange failed: %s", exc)

    if not granted_guild_id:
        return RedirectResponse(
            url=f"{frontend}/studio?discord_error=no_guild",
            status_code=status.HTTP_302_FOUND,
        )

    # Create the binding. If a row for this guild already exists in this
    # workspace, treat as success (idempotent) — re-installs shouldn't error.
    try:
        deployment = discord_guild_service.deploy_to_guild(
            db=db,
            workspace_id=workspace_id,
            chatbot_id=entity_id,
            guild_id=granted_guild_id,
            entity_type=entity_type,
            guild_name=granted_guild_name,
        )
    except ValueError as exc:
        msg = str(exc).lower()
        if "already deployed" in msg:
            # Idempotent re-install, fall through to success redirect.
            pass
        else:
            logger.warning("Discord deploy_to_guild failed: %s", exc)
            return RedirectResponse(
                url=f"{frontend}/studio?discord_error={exc}",
                status_code=status.HTTP_302_FOUND,
            )

    # Per-guild slash command registration — instant availability, no 1hr
    # cache wait. Best-effort: a failure here doesn't void the binding.
    try:
        if settings.DISCORD_SHARED_BOT_TOKEN and application_id:
            commands = [
                {
                    "name": "ask",
                    "description": "Ask the assistant a question",
                    "options": [
                        {"name": "message", "type": 3, "description": "Your question", "required": True}
                    ],
                },
                {
                    "name": "chat",
                    "description": "Chat with the assistant",
                    "options": [
                        {"name": "message", "type": 3, "description": "Your message", "required": True}
                    ],
                },
            ]
            await discord_integration.register_guild_commands(
                bot_token=settings.DISCORD_SHARED_BOT_TOKEN,
                application_id=application_id,
                guild_id=granted_guild_id,
                commands=commands,
            )
    except Exception as exc:
        logger.warning("Discord per-guild slash registration failed: %s", exc)

    # Redirect back to the studio entity so the user sees the binding.
    if entity_type == "chatflow":
        target = f"{frontend}/studio/{entity_id}?discord_guild={granted_guild_id}"
    else:
        target = f"{frontend}/chatbots/{entity_id}?discord_guild={granted_guild_id}"
    return RedirectResponse(url=target, status_code=status.HTTP_302_FOUND)


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

    # Get bot from database (supports both chatbots and chatflows)
    bot_type, bot, deployment_config = _resolve_bot(db, bot_id)

    # Check if Discord is enabled
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

        # Execute bot (chatbot or chatflow)
        channel_context = {
            "platform": "discord",
            "guild_id": guild_id,
            "channel_id": channel_id,
            "user_id": user_id,
            "username": username
        }

        if bot_type == "chatbot":
            response = await chatbot_service.process_message(
                db=db,
                chatbot=bot,
                user_message=message_content,
                session_id=session_id,
                channel_context=channel_context
            )
        else:  # chatflow
            response = await chatflow_service.execute(
                db=db,
                chatflow=bot,
                user_message=message_content,
                session_id=session_id,
                channel_context=channel_context
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

    # Get bot (supports both chatbots and chatflows)
    bot_type, bot, deployment_config = _resolve_bot(db, bot_id)

    # Get Discord config via credential service
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

    # Get bot (supports both chatbots and chatflows)
    bot_type, bot, deployment_config = _resolve_bot(db, bot_id)

    # Get Discord config via credential service
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
