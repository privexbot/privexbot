"""
Slack Integration - Handle Slack Bot events and messaging.

WHY:
- Deploy chatbots/chatflows to Slack workspaces
- Receive messages via Slack Events API
- Send responses back to Slack channels/DMs

HOW:
- Verify HMAC-SHA256 request signatures (Slack security)
- Handle Events API payloads (message, app_mention)
- Route to chatbot_service or chatflow_service
- Send response via chat.postMessage

Key difference from Discord:
- Signature: HMAC-SHA256 (not Ed25519)
- Events: Slack Events API with url_verification challenge
- Responses: chat.postMessage API call (not interaction response)
- 3-second deadline: must respond 200 immediately, process async
- Message limit: 3000 chars per message (split if longer)
"""

import hashlib
import hmac
import time
import logging
from typing import Any, Tuple, Optional
from uuid import UUID

import httpx
from sqlalchemy.orm import Session

from app.core.config import settings

logger = logging.getLogger(__name__)

# Slack message character limit
SLACK_MESSAGE_LIMIT = 3000


class SlackIntegration:
    """
    Slack Bot API integration.

    WHY: Multi-channel deployment to Slack
    HOW: Events API-based message handling with HMAC-SHA256 verification
    """

    def verify_signature(
        self,
        body: bytes,
        timestamp: str,
        signature: str,
        signing_secret: str = None
    ) -> bool:
        """
        Verify Slack request signature using HMAC-SHA256.

        WHY: Slack requires signature verification for security
        HOW: HMAC-SHA256 of "v0:{timestamp}:{body}" compared to X-Slack-Signature

        ARGS:
            body: Raw request body bytes
            timestamp: X-Slack-Request-Timestamp header
            signature: X-Slack-Signature header (format: "v0=...")
            signing_secret: Slack Signing Secret (defaults to config)

        RETURNS:
            True if signature is valid
        """
        if not signing_secret:
            signing_secret = settings.SLACK_SIGNING_SECRET

        if not signing_secret:
            logger.error("SLACK_SIGNING_SECRET not configured")
            return False

        # Protect against replay attacks (5 minute window)
        try:
            request_timestamp = int(timestamp)
            if abs(time.time() - request_timestamp) > 300:
                logger.warning("Slack request timestamp too old (possible replay attack)")
                return False
        except (ValueError, TypeError):
            logger.warning("Invalid Slack request timestamp")
            return False

        # Compute expected signature
        basestring = f"v0:{timestamp}:{body.decode('utf-8')}"
        expected = "v0=" + hmac.new(
            signing_secret.encode("utf-8"),
            basestring.encode("utf-8"),
            hashlib.sha256
        ).hexdigest()

        # Constant-time comparison
        return hmac.compare_digest(expected, signature)

    async def send_message(
        self,
        bot_token: str,
        channel_id: str,
        text: str,
        blocks: list = None,
        thread_ts: str = None
    ) -> dict:
        """
        Send a message to a Slack channel or DM.

        WHY: Reply to user messages
        HOW: POST to chat.postMessage API

        ARGS:
            bot_token: Slack bot OAuth token (xoxb-...)
            channel_id: Slack channel or DM ID
            text: Message text (fallback for notifications)
            blocks: Optional Block Kit blocks for rich formatting
            thread_ts: Optional thread timestamp to reply in thread

        RETURNS:
            Slack API response dict
        """
        # Split long messages (Slack limit: ~3000 chars for best rendering)
        if len(text) > SLACK_MESSAGE_LIMIT and not blocks:
            return await self._send_chunked_message(bot_token, channel_id, text, thread_ts)

        payload = {
            "channel": channel_id,
            "text": text,
        }

        if blocks:
            payload["blocks"] = blocks
        if thread_ts:
            payload["thread_ts"] = thread_ts

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    "https://slack.com/api/chat.postMessage",
                    headers={
                        "Authorization": f"Bearer {bot_token}",
                        "Content-Type": "application/json"
                    },
                    json=payload,
                    timeout=10.0
                )

                data = response.json()
                if not data.get("ok"):
                    logger.error(f"Slack chat.postMessage error: {data.get('error')}")
                return data

            except Exception as e:
                logger.error(f"Failed to send Slack message: {e}")
                return {"ok": False, "error": str(e)}

    async def _send_chunked_message(
        self,
        bot_token: str,
        channel_id: str,
        text: str,
        thread_ts: str = None
    ) -> dict:
        """Split and send long messages in chunks."""
        chunks = []
        while text:
            if len(text) <= SLACK_MESSAGE_LIMIT:
                chunks.append(text)
                break

            # Find a good split point (newline or space)
            split_at = text.rfind("\n", 0, SLACK_MESSAGE_LIMIT)
            if split_at == -1:
                split_at = text.rfind(" ", 0, SLACK_MESSAGE_LIMIT)
            if split_at == -1:
                split_at = SLACK_MESSAGE_LIMIT

            chunks.append(text[:split_at])
            text = text[split_at:].lstrip()

        last_response = None
        for chunk in chunks:
            last_response = await self.send_message(bot_token, channel_id, chunk, thread_ts=thread_ts)

        return last_response or {"ok": False, "error": "No chunks to send"}

    async def handle_event(
        self,
        db: Session,
        team_id: str,
        event: dict,
        bot_user_id: str = None
    ) -> Optional[dict]:
        """
        Handle incoming Slack event and route to chatbot.

        WHY: Process user messages from Slack
        HOW: Extract message, route to bot service, send response

        ARGS:
            db: Database session
            team_id: Slack workspace ID
            event: Slack event payload (from event_callback)
            bot_user_id: The bot's own user ID (to ignore self-messages)

        RETURNS:
            Response dict or None if event was ignored
        """
        event_type = event.get("type")

        # Only handle message events and app_mention
        if event_type not in ("message", "app_mention"):
            return None

        # Ignore bot messages (prevent loops)
        if event.get("bot_id") or event.get("subtype") == "bot_message":
            return None

        # Ignore the bot's own messages
        user_id = event.get("user")
        if bot_user_id and user_id == bot_user_id:
            return None

        # Ignore message edits, deletes, etc.
        if event.get("subtype"):
            return None

        text = event.get("text", "").strip()
        if not text:
            return None

        channel_id = event.get("channel")
        channel_type = event.get("channel_type", "")  # "im" for DMs, "channel" for public

        # Lookup chatbot for this team
        from app.services.slack_workspace_service import slack_workspace_service

        result = slack_workspace_service.get_chatbot_for_team(db, team_id)
        if not result:
            logger.warning(f"No chatbot deployment found for Slack team {team_id}")
            return None

        chatbot, deployment = result

        # Check channel restrictions (DMs always allowed)
        if channel_type != "im" and not deployment.check_channel_access(channel_id):
            return None

        # Strip bot mention from app_mention events
        if event_type == "app_mention" and bot_user_id:
            text = text.replace(f"<@{bot_user_id}>", "").strip()

        # Build session ID (unique per Slack user in workspace)
        session_id = f"slack_{team_id}_{user_id}"

        # Auto-capture lead
        await self._auto_capture_lead(
            db=db,
            bot=chatbot,
            bot_type="chatbot",
            session_id=session_id,
            slack_user_id=user_id,
            team_id=team_id,
            team_name=deployment.team_name
        )

        # Channel context
        channel_context = {
            "platform": "slack",
            "channel_id": channel_id,
            "channel_type": channel_type,
            "user_id": user_id,
            "team_id": team_id,
            "team_name": deployment.team_name
        }

        # Route to chatbot service
        from app.services.chatbot_service import chatbot_service

        response = await chatbot_service.process_message(
            db=db,
            chatbot=chatbot,
            user_message=text,
            session_id=session_id,
            channel_context=channel_context
        )

        # Send response back to Slack
        bot_token = deployment.bot_token_encrypted
        if bot_token and response.get("response"):
            # Reply in thread for channel messages, direct for DMs
            thread_ts = event.get("ts") if channel_type != "im" else None

            await self.send_message(
                bot_token=bot_token,
                channel_id=channel_id,
                text=response["response"],
                thread_ts=thread_ts
            )

        # Update metadata
        slack_workspace_service.update_team_metadata(
            db, team_id,
            {"last_message_at": str(time.time()), "total_messages": (deployment.team_metadata or {}).get("total_messages", 0) + 1}
        )

        return response

    async def exchange_oauth_code(
        self,
        code: str,
        redirect_uri: str = None
    ) -> dict:
        """
        Exchange OAuth authorization code for bot token.

        WHY: Complete Slack app installation flow
        HOW: POST to oauth.v2.access endpoint

        RETURNS:
            Slack OAuth response with access_token, team info, etc.
        """
        if not redirect_uri:
            redirect_uri = f"{settings.API_BASE_URL}/webhooks/slack/oauth/callback"

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    "https://slack.com/api/oauth.v2.access",
                    data={
                        "client_id": settings.SLACK_CLIENT_ID,
                        "client_secret": settings.SLACK_CLIENT_SECRET,
                        "code": code,
                        "redirect_uri": redirect_uri
                    },
                    timeout=10.0
                )

                data = response.json()
                if not data.get("ok"):
                    logger.error(f"Slack OAuth error: {data.get('error')}")
                return data

            except Exception as e:
                logger.error(f"Slack OAuth exchange failed: {e}")
                return {"ok": False, "error": str(e)}

    async def get_team_info(self, bot_token: str) -> Optional[dict]:
        """Get Slack workspace info using bot token."""
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    "https://slack.com/api/team.info",
                    headers={"Authorization": f"Bearer {bot_token}"},
                    timeout=10.0
                )
                data = response.json()
                if data.get("ok"):
                    team = data.get("team", {})
                    return {
                        "team_id": team.get("id"),
                        "team_name": team.get("name"),
                        "team_domain": team.get("domain"),
                        "team_icon": team.get("icon", {}).get("image_132"),
                    }
                return None
            except Exception:
                return None

    async def _auto_capture_lead(
        self,
        db: Session,
        bot: Any,
        bot_type: str,
        session_id: str,
        slack_user_id: str,
        team_id: str = None,
        team_name: str = None
    ):
        """
        Auto-capture lead from Slack on first interaction.

        WHY: Slack provides user ID and workspace context
        HOW: Check lead_capture_config, capture if enabled
        """
        lead_config = getattr(bot, "lead_capture_config", None) or {}
        if not lead_config.get("enabled"):
            return

        platforms = lead_config.get("platforms", {})
        slack_config = platforms.get("slack", {})

        if not slack_config.get("enabled", True):
            return

        if not slack_config.get("auto_capture_username", True):
            return

        from app.services.lead_capture_service import lead_capture_service

        existing_lead = await lead_capture_service.check_lead_exists(
            db=db,
            workspace_id=bot.workspace_id,
            session_id=session_id
        )

        if existing_lead:
            return

        privacy = lead_config.get("privacy", {})
        require_consent = privacy.get("require_consent", False)

        if require_consent:
            from app.models.chat_session import ChatSession
            session = db.query(ChatSession).filter(
                ChatSession.session_id == session_id
            ).first()
            if session:
                metadata = session.session_metadata or {}
                if not metadata.get("consent_given"):
                    return

        consent_given = not require_consent

        await lead_capture_service.capture_lead(
            db=db,
            workspace_id=bot.workspace_id,
            bot_id=bot.id,
            bot_type=bot_type,
            session_id=session_id,
            channel="slack",
            name=None,
            custom_fields={
                "slack_user_id": slack_user_id,
                "team_id": team_id,
                "team_name": team_name
            },
            consent_given=consent_given
        )

    def _get_bot(self, db: Session, entity_id: UUID) -> Tuple[str, Any]:
        """Get bot by ID (chatbot or chatflow)."""
        from app.models.chatbot import Chatbot
        from app.models.chatflow import Chatflow

        chatbot = db.query(Chatbot).get(entity_id)
        if chatbot:
            return "chatbot", chatbot

        chatflow = db.query(Chatflow).get(entity_id)
        if chatflow:
            return "chatflow", chatflow

        raise ValueError("Bot not found")


# Global instance
slack_integration = SlackIntegration()
