"""
Notification Node - Post messages to team channels (Slack, Discord, Teams).

WHY:
- Teams need real-time awareness of chatbot activity
- New leads, escalations, failures, high-value conversations
- Single node covers all webhook-based notification platforms

HOW:
- All platforms (Slack, Discord, Teams) accept incoming webhooks
- Channel selector determines payload format
- Variable interpolation in message template
- Urgency indicator for visual priority
"""

import time
from typing import Any, Dict, Optional
from uuid import UUID
from sqlalchemy.orm import Session
import requests

from app.chatflow.nodes.base_node import BaseNode


class NotificationNode(BaseNode):
    """
    Team notification node for Slack, Discord, and Microsoft Teams.

    WHY: Real-time team awareness of chatbot events
    HOW: POST formatted messages to platform webhook URLs
    """

    async def execute(
        self,
        db: Session,
        context: Dict[str, Any],
        inputs: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Send notification to team channel.

        CONFIG:
            {
                "channel": "slack",  # "slack", "discord", "teams", "custom"
                "webhook_url": "https://hooks.slack.com/...",  # Direct URL or from credential
                "credential_id": "uuid",  # Optional, alternative to webhook_url
                "message": "New lead: {{user_name}} - {{user_email}}",
                "title": "Lead Alert",  # Optional
                "urgency": "info",  # "info", "warning", "alert"
                "mention": "",  # Optional: "@channel", "@here", user ID
            }

        RETURNS:
            {
                "output": "Notification sent",
                "success": True,
                "metadata": {
                    "channel": "slack",
                    "status_code": 200
                }
            }
        """
        try:
            channel = self.config.get("channel", "slack")
            message = self.config.get("message", "")
            title = self.config.get("title", "")
            urgency = self.config.get("urgency", "info")
            mention = self.config.get("mention", "")

            # Merge context for variable resolution
            vars_ctx = {**context.get("variables", {}), **inputs}

            # Resolve variables
            message = self.resolve_variable(message, vars_ctx)
            title = self.resolve_variable(title, vars_ctx) if title else ""

            # Get webhook URL (from config or credential)
            webhook_url = self._get_webhook_url(db)
            if not webhook_url:
                return self.handle_error(ValueError("Webhook URL is required (via url or credential)"))

            webhook_url = self.resolve_variable(webhook_url, vars_ctx)

            # Build platform-specific payload
            payload = self._build_payload(channel, message, title, urgency, mention)

            # Send notification
            start_time = time.time()
            response = requests.post(
                webhook_url,
                json=payload,
                headers={"Content-Type": "application/json"},
                timeout=10
            )
            response_time = int((time.time() - start_time) * 1000)

            if response.status_code < 400:
                return {
                    "output": "Notification sent",
                    "success": True,
                    "error": None,
                    "metadata": {
                        "channel": channel,
                        "status_code": response.status_code,
                        "response_time_ms": response_time
                    }
                }
            else:
                return {
                    "output": None,
                    "success": False,
                    "error": f"Notification failed: HTTP {response.status_code}",
                    "metadata": {
                        "channel": channel,
                        "status_code": response.status_code,
                        "response_body": response.text[:200]
                    }
                }

        except Exception as e:
            return self.handle_error(e)

    def _get_webhook_url(self, db: Session) -> Optional[str]:
        """Get webhook URL from direct config or credential."""
        # Direct URL takes priority
        url = self.config.get("webhook_url")
        if url:
            return url

        # Fall back to credential
        credential_id = self.config.get("credential_id")
        if credential_id:
            from app.services.credential_service import credential_service
            from app.models.credential import Credential

            credential = db.query(Credential).get(UUID(credential_id))
            if credential:
                cred_data = credential_service.get_decrypted_data(db, credential)
                return cred_data.get("webhook_url") or cred_data.get("api_key")

        return None

    def _build_payload(
        self,
        channel: str,
        message: str,
        title: str,
        urgency: str,
        mention: str
    ) -> dict:
        """Build platform-specific webhook payload."""

        urgency_emoji = {"info": "ℹ️", "warning": "⚠️", "alert": "🚨"}.get(urgency, "ℹ️")
        urgency_color = {"info": "#3b82f6", "warning": "#f59e0b", "alert": "#ef4444"}.get(urgency, "#3b82f6")

        full_message = f"{mention} " if mention else ""
        full_message += message

        if channel == "slack":
            payload: dict = {
                "attachments": [{
                    "color": urgency_color,
                    "blocks": [{
                        "type": "section",
                        "text": {
                            "type": "mrkdwn",
                            "text": full_message
                        }
                    }]
                }]
            }
            if title:
                payload["attachments"][0]["blocks"].insert(0, {
                    "type": "header",
                    "text": {"type": "plain_text", "text": f"{urgency_emoji} {title}"}
                })
            return payload

        elif channel == "discord":
            embed: dict = {
                "description": full_message,
                "color": int(urgency_color.lstrip("#"), 16),
            }
            if title:
                embed["title"] = f"{urgency_emoji} {title}"
            return {"embeds": [embed]}

        elif channel == "teams":
            card: dict = {
                "@type": "MessageCard",
                "@context": "http://schema.org/extensions",
                "themeColor": urgency_color.lstrip("#"),
                "text": full_message,
            }
            if title:
                card["summary"] = title
                card["title"] = f"{urgency_emoji} {title}"
            return card

        else:
            # Custom / generic webhook
            return {
                "title": f"{urgency_emoji} {title}" if title else None,
                "message": full_message,
                "urgency": urgency,
            }

    def validate_config(self) -> tuple[bool, Optional[str]]:
        """Validate notification node configuration."""
        if not self.config.get("webhook_url") and not self.config.get("credential_id"):
            return False, "Webhook URL or credential is required"
        if not self.config.get("message"):
            return False, "Notification message is required"

        channel = self.config.get("channel", "slack")
        if channel not in ["slack", "discord", "teams", "custom"]:
            return False, f"Invalid channel: {channel}"

        return True, None
