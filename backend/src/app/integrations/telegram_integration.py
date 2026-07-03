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

import asyncio
import re
import secrets
import requests
from uuid import UUID
from typing import Any, Optional, Tuple

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.credential import Credential
from app.utils.validation import validate_rate_limit

# Telegram API limits: 30 msgs/sec per bot, 20 msgs/min to same group
TELEGRAM_MSG_PER_SEC = 25  # Leave buffer from 30 limit

# Telegram embeds the bot token in the request URL (bot<id>:<hash>/method), so
# any HTTPError raised by requests carries the token in its message. Scrub it
# before the error can reach persisted config, API responses, or logs.
_TELEGRAM_TOKEN_RE = re.compile(r"bot\d+:[A-Za-z0-9_-]+")


def _redact_telegram_token(text: str) -> str:
    """Remove a Telegram bot token from a string (e.g. an HTTPError message).

    MUST be applied to any error raised from a Telegram `raise_for_status()`
    call — the token rides in the URL, so the raw message leaks the secret.
    """
    return _TELEGRAM_TOKEN_RE.sub("bot<redacted>", text)


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
        # Frontend stores Telegram credential under the generic `api_key` key
        # (Credentials.tsx:328-337); older code paths used the provider-
        # specific `bot_token`. Accept either at READ time so both legacy
        # and freshly-created credentials work — no Fernet decrypt-reencrypt
        # data migration needed (which would carry production-data risk).
        bot_token = cred_data.get("bot_token") or cred_data.get("api_key")
        if not bot_token:
            raise ValueError(
                "Telegram credential is missing both `bot_token` and "
                "`api_key`. Re-create the credential at "
                "/settings/credentials and try again."
            )

        # Webhook URL
        webhook_url = f"{settings.API_BASE_URL}/webhooks/telegram/{entity_id}"

        # Generate secret token for webhook verification (prevents fake webhooks)
        webhook_secret = secrets.token_urlsafe(32)

        # Register webhook with Telegram (including secret_token for verification)
        response = requests.post(
            f"https://api.telegram.org/bot{bot_token}/setWebhook",
            json={
                "url": webhook_url,
                "secret_token": webhook_secret
            }
        )

        try:
            response.raise_for_status()
        except requests.HTTPError as e:
            # Re-raise with the token scrubbed, preserving the HTTPError type
            # and .response so callers' status handling still works. `from None`
            # drops the token-bearing original from the traceback chain.
            raise requests.HTTPError(
                _redact_telegram_token(str(e)), response=e.response
            ) from None

        # Get bot info
        bot_info = requests.get(
            f"https://api.telegram.org/bot{bot_token}/getMe"
        ).json()

        bot_username = bot_info["result"]["username"]

        return {
            "webhook_url": webhook_url,
            "bot_username": f"@{bot_username}",
            "webhook_secret": webhook_secret
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
            from app.services.chatflow_service import chatflow_service

            result = await chatflow_service.execute(
                db=db,
                chatflow=bot,
                user_message=user_message,
                session_id=session_id,
                channel_context=channel_context
            )
            response = {"response": result["response"], "session_id": result["session_id"]}

        # Send response back to Telegram
        await self._send_message(
            chat_id=chat_id,
            text=response["response"],
            bot_token=self._get_bot_token(db, bot)
        )

        return {"status": "ok"}


    async def _send_single_message(
        self,
        chat_id: int,
        text: str,
        bot_token: str,
        reply_to_message_id: Optional[int] = None
    ):
        """Send a single message to Telegram (max 4096 chars)."""
        url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
        payload = {
            "chat_id": chat_id,
            "text": text[:4096],  # Enforce Telegram limit
            "parse_mode": "Markdown"
        }
        if reply_to_message_id is not None:
            payload["reply_to_message_id"] = reply_to_message_id
            # Don't 400-drop the reply if the original message was deleted.
            payload["allow_sending_without_reply"] = True
        response = requests.post(url, json=payload)
        # Markdown parse errors return 400 and silently drop the message;
        # retry once as plain text so the reply is still delivered.
        if response.status_code == 400:
            payload.pop("parse_mode", None)
            response = requests.post(url, json=payload)
        return response

    async def _send_message(
        self,
        chat_id: int,
        text: str,
        bot_token: str,
        reply_to_message_id: Optional[int] = None
    ):
        """Send message to Telegram user with rate limiting and chunking."""
        # Rate limit check (using first 10 chars of token as identifier)
        try:
            from app.db.session import redis_client
            rate_key = f"telegram_rate:{bot_token[:10]}"

            if not validate_rate_limit(rate_key, TELEGRAM_MSG_PER_SEC, 1, redis_client):
                # Wait briefly and retry once
                await asyncio.sleep(0.1)
                if not validate_rate_limit(rate_key, TELEGRAM_MSG_PER_SEC, 1, redis_client):
                    raise Exception("Telegram rate limit exceeded")
        except ImportError:
            pass  # Redis not available, skip rate limiting

        # Split into chunks if message exceeds 4096 chars
        if len(text) <= 4096:
            await self._send_single_message(chat_id, text, bot_token, reply_to_message_id)
        else:
            chunks = [text[i:i+4096] for i in range(0, len(text), 4096)]
            for i, chunk in enumerate(chunks):
                # Thread only the first chunk to the original message.
                await self._send_single_message(
                    chat_id, chunk, bot_token,
                    reply_to_message_id if i == 0 else None
                )
                if i < len(chunks) - 1:
                    await asyncio.sleep(0.1)  # Small delay between chunks

    async def send_message(
        self,
        bot_token: str,
        chat_id: int,
        message: str,
        reply_to_message_id: Optional[int] = None
    ):
        """
        Public method to send message to Telegram user.

        WHY: Called by webhook handler to send responses
        HOW: Call Telegram sendMessage API with rate limiting and chunking
        """
        await self._send_message(chat_id, message, bot_token, reply_to_message_id)

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
        # Same dual-key compat as register_webhook above — credentials may
        # be stored under either `bot_token` (legacy) or `api_key` (current).
        token = cred_data.get("bot_token") or cred_data.get("api_key")
        if not token:
            raise ValueError(
                "Telegram credential is missing both `bot_token` and "
                "`api_key`. Re-create the credential and re-deploy the bot."
            )
        return token

    @staticmethod
    def find_existing_telegram_users(
        db: Session,
        credential_id: str,
        workspace_id: UUID,
        exclude_entity_id: Optional[UUID] = None,
    ) -> list[dict]:
        """Find chatbots/chatflows that already use this Telegram credential.

        Telegram bot tokens are 1:1 with a Telegram bot, and each bot can
        have only ONE active webhook URL. If two chatbots/chatflows try to
        register Telegram webhooks against the same credential, the second
        `setWebhook` silently overwrites the first — chatbot/chatflow A
        stops receiving Telegram updates with no warning. The deploy flow
        uses this helper to detect the collision and refuse the deploy
        instead, surfacing the conflict to the operator.

        ARGS:
            credential_id: The credential UUID being deployed (string).
            workspace_id: Restrict the scan to this workspace (credentials
                are workspace-scoped, so a collision can only happen here).
            exclude_entity_id: The entity that's currently deploying — its
                own existing registration is not a conflict.

        RETURNS:
            List of dicts: `{entity_type, entity_id, entity_name}` for every
            other entity already wired to this credential. Empty list when
            it's safe to proceed.
        """
        # Local imports — keeps integrations free of heavy model deps at
        # module load.
        from app.models.chatbot import Chatbot, ChatbotStatus
        from app.models.chatflow import Chatflow

        cred_id_str = str(credential_id)
        conflicts: list[dict] = []

        # Chatbots: deployment_config.channels.telegram.bot_token_credential_id
        chatbots = (
            db.query(Chatbot)
            .filter(
                Chatbot.workspace_id == workspace_id,
                Chatbot.status != ChatbotStatus.ARCHIVED,
            )
            .all()
        )
        for bot in chatbots:
            if exclude_entity_id and bot.id == exclude_entity_id:
                continue
            channels = (bot.deployment_config or {}).get("channels", {})
            tg = channels.get("telegram") if isinstance(channels, dict) else None
            if isinstance(tg, dict) and str(tg.get("bot_token_credential_id") or "") == cred_id_str:
                conflicts.append(
                    {
                        "entity_type": "chatbot",
                        "entity_id": str(bot.id),
                        "entity_name": bot.name,
                    }
                )

        # Chatflows: config.deployment.channels.telegram.bot_token_credential_id
        chatflows = (
            db.query(Chatflow)
            .filter(Chatflow.workspace_id == workspace_id)
            .all()
        )
        for flow in chatflows:
            if exclude_entity_id and flow.id == exclude_entity_id:
                continue
            cfg = flow.config or {}
            channels = (cfg.get("deployment", {}) or {}).get("channels", {})
            tg = channels.get("telegram") if isinstance(channels, dict) else None
            if isinstance(tg, dict) and str(tg.get("bot_token_credential_id") or "") == cred_id_str:
                conflicts.append(
                    {
                        "entity_type": "chatflow",
                        "entity_id": str(flow.id),
                        "entity_name": flow.name,
                    }
                )

        return conflicts

    @staticmethod
    def other_entities_using_telegram_credential(
        db: Session,
        credential_id: str,
        workspace_id: UUID,
        exclude_entity_id: Optional[UUID] = None,
    ) -> int:
        """Count OTHER entities in the workspace wired to this Telegram credential.

        WHY: A Telegram bot token has exactly one active webhook. When a
        credential is shared, disconnecting one entity must NOT `deleteWebhook`
        (that would silently break the bot for the remaining entity). Callers
        use this to decide whether it's safe to delete the webhook (count == 0).

        HOW: Scan both storage shapes — the flat `telegram` key (written by the
        chatbot/chatflow connect endpoints) and the nested `channels.telegram`
        key (deploy-dialog shape) — across chatbots (`deployment_config`) and
        chatflows (`config.deployment`).
        """
        from app.models.chatbot import Chatbot, ChatbotStatus
        from app.models.chatflow import Chatflow

        cred_id_str = str(credential_id)

        def _matches(deployment: dict) -> bool:
            if not isinstance(deployment, dict):
                return False
            candidates = [deployment.get("telegram")]
            channels = deployment.get("channels")
            if isinstance(channels, dict):
                candidates.append(channels.get("telegram"))
            return any(
                isinstance(tg, dict)
                and str(tg.get("bot_token_credential_id") or "") == cred_id_str
                for tg in candidates
            )

        count = 0
        for bot in (
            db.query(Chatbot)
            .filter(
                Chatbot.workspace_id == workspace_id,
                Chatbot.status != ChatbotStatus.ARCHIVED,
            )
            .all()
        ):
            if exclude_entity_id and bot.id == exclude_entity_id:
                continue
            if _matches(bot.deployment_config or {}):
                count += 1

        for flow in (
            db.query(Chatflow).filter(Chatflow.workspace_id == workspace_id).all()
        ):
            if exclude_entity_id and flow.id == exclude_entity_id:
                continue
            if _matches((flow.config or {}).get("deployment", {}) or {}):
                count += 1

        return count


# Global instance
telegram_integration = TelegramIntegration()
