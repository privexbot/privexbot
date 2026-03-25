"""
Human Handoff Node - Transfer conversation to a human agent.

WHY:
- Every support chatbot needs an escalation path
- Transfers full context so agent doesn't re-ask questions
- Supports multiple handoff methods (webhook, email, Slack)

HOW:
- Collects conversation transcript and context
- Sends handoff package to external system
- Marks session as "handed_off"
- Returns handoff message to user
"""

import time
import json
from typing import Any, Dict, Optional
from uuid import UUID
from sqlalchemy.orm import Session
import requests

from app.chatflow.nodes.base_node import BaseNode


class HandoffNode(BaseNode):
    """
    Human handoff node for escalating to live agents.

    WHY: Seamless escalation with full context transfer
    HOW: Send conversation data to external agent system
    """

    async def execute(
        self,
        db: Session,
        context: Dict[str, Any],
        inputs: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Execute human handoff.

        CONFIG:
            {
                "method": "webhook",  # "webhook", "email", "slack"
                "credential_id": "uuid",  # For webhook auth or SMTP
                "webhook_url": "https://helpdesk.example.com/api/handoff",
                "context_depth": "full",  # "full", "last_10", "summary"
                "handoff_message": "Connecting you with a human agent...",
                "priority": "normal",  # "low", "normal", "high", "urgent"
                "department": "",  # Optional routing tag
                "metadata_fields": []  # Extra context fields to include
            }

        RETURNS:
            {
                "output": "Connecting you with a human agent...",
                "success": True,
                "metadata": {
                    "handoff_method": "webhook",
                    "priority": "normal",
                    "session_id": "uuid",
                    "handed_off": True
                }
            }
        """
        try:
            method = self.config.get("method", "webhook")
            handoff_message = self.config.get(
                "handoff_message",
                "I'm connecting you with a human agent who can help further. They'll have the full context of our conversation."
            )
            priority = self.config.get("priority", "normal")
            department = self.config.get("department", "")
            context_depth = self.config.get("context_depth", "full")

            # Merge context for variable resolution
            vars_ctx = {**context.get("variables", {}), **inputs}
            handoff_message = self.resolve_variable(handoff_message, vars_ctx)
            department = self.resolve_variable(department, vars_ctx) if department else ""

            # Build handoff package
            handoff_data = self._build_handoff_package(context, inputs, context_depth, priority, department)

            # Execute handoff via chosen method
            if method == "webhook":
                success, error = await self._handoff_via_webhook(db, handoff_data, vars_ctx)
            elif method == "email":
                success, error = await self._handoff_via_email(db, handoff_data, vars_ctx)
            elif method == "slack":
                success, error = await self._handoff_via_slack(db, handoff_data, vars_ctx)
            else:
                return self.handle_error(ValueError(f"Unknown handoff method: {method}"))

            # Mark session as handed off in context
            context.setdefault("metadata", {})["handed_off"] = True

            if success:
                return {
                    "output": handoff_message,
                    "success": True,
                    "error": None,
                    "metadata": {
                        "handoff_method": method,
                        "priority": priority,
                        "department": department or None,
                        "session_id": context.get("session_id"),
                        "handed_off": True
                    }
                }
            else:
                # Still show handoff message to user even if delivery failed
                return {
                    "output": handoff_message,
                    "success": True,
                    "error": None,
                    "metadata": {
                        "handoff_method": method,
                        "priority": priority,
                        "handed_off": True,
                        "delivery_warning": error
                    }
                }

        except Exception as e:
            return self.handle_error(e)

    def _build_handoff_package(
        self,
        context: Dict[str, Any],
        inputs: Dict[str, Any],
        context_depth: str,
        priority: str,
        department: str
    ) -> dict:
        """Build the handoff data package with conversation context."""
        history = context.get("history", [])

        if context_depth == "last_10":
            transcript = history[-10:] if len(history) > 10 else history
        elif context_depth == "summary":
            user_count = sum(1 for m in history if m.get("role") == "user")
            assistant_count = sum(1 for m in history if m.get("role") == "assistant")
            transcript = {
                "summary": f"{user_count} user messages, {assistant_count} assistant responses",
                "last_messages": history[-3:] if history else []
            }
        else:
            transcript = history

        package = {
            "session_id": context.get("session_id"),
            "workspace_id": context.get("workspace_id"),
            "priority": priority,
            "transcript": transcript,
            "current_message": context.get("user_message"),
            "collected_variables": {
                k: v for k, v in context.get("variables", {}).items()
                if not k.startswith("_")
            },
        }

        if department:
            package["department"] = department

        # Include extra metadata fields if specified
        metadata_fields = self.config.get("metadata_fields", [])
        if metadata_fields:
            extra = {}
            for field in metadata_fields:
                if field in context.get("variables", {}):
                    extra[field] = context["variables"][field]
            if extra:
                package["extra_metadata"] = extra

        return package

    async def _handoff_via_webhook(self, db: Session, handoff_data: dict, vars_ctx: dict) -> tuple[bool, Optional[str]]:
        """Send handoff data via webhook POST."""
        webhook_url = self.config.get("webhook_url")
        if not webhook_url:
            return False, "Webhook URL is required for webhook handoff"

        webhook_url = self.resolve_variable(webhook_url, vars_ctx)
        headers = {"Content-Type": "application/json"}

        # Apply credential if specified
        credential_id = self.config.get("credential_id")
        if credential_id:
            from app.services.credential_service import credential_service
            from app.models.credential import Credential

            credential = db.query(Credential).get(UUID(credential_id))
            if credential:
                cred_data = credential_service.get_decrypted_data(db, credential)
                if "api_key" in cred_data:
                    headers["Authorization"] = f"Bearer {cred_data['api_key']}"

        try:
            response = requests.post(webhook_url, json=handoff_data, headers=headers, timeout=10)
            if response.status_code < 400:
                return True, None
            return False, f"Webhook returned HTTP {response.status_code}"
        except Exception as e:
            return False, str(e)

    async def _handoff_via_email(self, db: Session, handoff_data: dict, vars_ctx: dict) -> tuple[bool, Optional[str]]:
        """Send handoff transcript via email."""
        import smtplib
        import ssl
        from email.mime.text import MIMEText
        from email.mime.multipart import MIMEMultipart

        credential_id = self.config.get("credential_id")
        if not credential_id:
            return False, "SMTP credential is required for email handoff"

        from app.services.credential_service import credential_service
        from app.models.credential import Credential

        credential = db.query(Credential).get(UUID(credential_id))
        if not credential:
            return False, "SMTP credential not found"

        cred_data = credential_service.get_decrypted_data(db, credential)
        to_addr = self.resolve_variable(self.config.get("email_to", ""), vars_ctx)
        if not to_addr:
            return False, "Recipient email not configured"

        # Build email
        msg = MIMEMultipart("alternative")
        msg["From"] = cred_data.get("username")
        msg["To"] = to_addr
        msg["Subject"] = f"[{handoff_data.get('priority', 'normal').upper()}] Human Handoff - Session {handoff_data.get('session_id', 'unknown')[:8]}"

        # Format transcript
        transcript = handoff_data.get("transcript", [])
        if isinstance(transcript, list):
            lines = []
            for m in transcript:
                role = m.get("role", "unknown").title()
                content = m.get("content", "")
                lines.append(f"<b>{role}:</b> {content}")
            transcript_html = "<br>".join(lines)
        else:
            transcript_html = json.dumps(transcript, indent=2)

        body = f"""
        <h2>Human Handoff Request</h2>
        <p><b>Priority:</b> {handoff_data.get('priority', 'normal')}</p>
        <p><b>Session:</b> {handoff_data.get('session_id', 'N/A')}</p>
        <p><b>Current message:</b> {handoff_data.get('current_message', 'N/A')}</p>
        <hr>
        <h3>Conversation Transcript</h3>
        {transcript_html}
        """

        msg.attach(MIMEText(body, "html"))

        try:
            smtp_host = cred_data.get("host")
            smtp_port = int(cred_data.get("port", 587))
            context_ssl = ssl.create_default_context()

            if smtp_port == 465:
                with smtplib.SMTP_SSL(smtp_host, smtp_port, context=context_ssl) as server:
                    server.login(cred_data["username"], cred_data["password"])
                    server.sendmail(cred_data["username"], [to_addr], msg.as_string())
            else:
                with smtplib.SMTP(smtp_host, smtp_port) as server:
                    server.starttls(context=context_ssl)
                    server.login(cred_data["username"], cred_data["password"])
                    server.sendmail(cred_data["username"], [to_addr], msg.as_string())

            return True, None
        except Exception as e:
            return False, f"Email send failed: {str(e)}"

    async def _handoff_via_slack(self, db: Session, handoff_data: dict, vars_ctx: dict) -> tuple[bool, Optional[str]]:
        """Send handoff notification to Slack channel."""
        webhook_url = self.config.get("webhook_url")
        if not webhook_url:
            # Try credential
            credential_id = self.config.get("credential_id")
            if credential_id:
                from app.services.credential_service import credential_service
                from app.models.credential import Credential

                credential = db.query(Credential).get(UUID(credential_id))
                if credential:
                    cred_data = credential_service.get_decrypted_data(db, credential)
                    webhook_url = cred_data.get("webhook_url")

        if not webhook_url:
            return False, "Slack webhook URL is required"

        webhook_url = self.resolve_variable(webhook_url, vars_ctx)

        priority = handoff_data.get("priority", "normal")
        priority_emoji = {"low": "🟢", "normal": "🟡", "high": "🟠", "urgent": "🔴"}.get(priority, "🟡")

        # Format transcript for Slack
        transcript = handoff_data.get("transcript", [])
        if isinstance(transcript, list):
            transcript_text = "\n".join(
                f"*{m.get('role', '?').title()}:* {m.get('content', '')}"
                for m in transcript[-5:]  # Last 5 messages for Slack
            )
        else:
            transcript_text = str(transcript)

        payload = {
            "blocks": [
                {
                    "type": "header",
                    "text": {"type": "plain_text", "text": f"{priority_emoji} Human Handoff Required"}
                },
                {
                    "type": "section",
                    "fields": [
                        {"type": "mrkdwn", "text": f"*Priority:* {priority}"},
                        {"type": "mrkdwn", "text": f"*Session:* `{str(handoff_data.get('session_id', 'N/A'))[:8]}`"},
                    ]
                },
                {
                    "type": "section",
                    "text": {"type": "mrkdwn", "text": f"*Current message:*\n>{handoff_data.get('current_message', 'N/A')}"}
                },
                {"type": "divider"},
                {
                    "type": "section",
                    "text": {"type": "mrkdwn", "text": f"*Recent transcript:*\n{transcript_text}"}
                },
            ]
        }

        department = handoff_data.get("department")
        if department:
            payload["blocks"].insert(2, {
                "type": "section",
                "text": {"type": "mrkdwn", "text": f"*Department:* {department}"}
            })

        try:
            response = requests.post(webhook_url, json=payload, timeout=10)
            if response.status_code < 400:
                return True, None
            return False, f"Slack webhook returned HTTP {response.status_code}"
        except Exception as e:
            return False, str(e)

    def validate_config(self) -> tuple[bool, Optional[str]]:
        """Validate handoff node configuration."""
        method = self.config.get("method", "webhook")
        if method not in ["webhook", "email", "slack"]:
            return False, f"Invalid handoff method: {method}"

        if method == "webhook" and not self.config.get("webhook_url"):
            return False, "Webhook URL is required for webhook handoff"

        if method == "email":
            if not self.config.get("credential_id"):
                return False, "SMTP credential is required for email handoff"
            if not self.config.get("email_to"):
                return False, "Recipient email is required for email handoff"

        if method == "slack":
            if not self.config.get("webhook_url") and not self.config.get("credential_id"):
                return False, "Slack webhook URL or credential is required"

        return True, None
