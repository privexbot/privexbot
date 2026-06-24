"""
Email Node - Send emails via SMTP within chatflows.

WHY:
- Email is the most universal business action
- SMTP credential type already exists but nothing uses it
- Confirmations, notifications, follow-ups, summaries
- Drag-and-drop email sending in visual workflow

HOW:
- Uses SMTP credentials from credential system
- Variable interpolation in to, subject, body
- Supports HTML and plain text
- CC/BCC support
"""

from typing import Any, Dict, Optional
from uuid import UUID
from sqlalchemy.orm import Session

from app.chatflow.nodes.base_node import BaseNode


class EmailNode(BaseNode):
    """
    Email sending node using SMTP credentials.

    WHY: Send emails as part of chatflow automation
    HOW: SMTP connection using existing credential system
    """

    async def execute(
        self,
        db: Session,
        context: Dict[str, Any],
        inputs: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Send an email via SMTP.

        CONFIG:
            {
                "credential_id": "uuid",  # SMTP credential (required)
                "to": "user@example.com",  # Supports {{variables}}
                "cc": "",  # Optional
                "bcc": "",  # Optional
                "subject": "Re: {{topic}}",  # Supports {{variables}}
                "body": "Hello {{user_name}}...",  # Supports {{variables}}
                "body_type": "html",  # "html" or "text", default "html"
                "reply_to": "",  # Optional
            }

        RETURNS:
            {
                "output": "Email sent successfully",
                "success": True,
                "metadata": {
                    "to": "user@example.com",
                    "subject": "Re: Your inquiry"
                }
            }
        """
        try:
            credential_id = self.config.get("credential_id")
            if not credential_id:
                return self.handle_error(ValueError("SMTP credential is required"))

            from app.services.credential_service import credential_service
            from app.services.email_sender import send_email
            from app.models.credential import Credential

            credential = db.query(Credential).get(UUID(credential_id))
            if not credential:
                return self.handle_error(ValueError("SMTP credential not found"))

            cred_data = credential_service.get_decrypted_data(db, credential)

            # Merge context for variable resolution
            vars_ctx = {**context.get("variables", {}), **inputs}

            # Resolve template variables
            to_addr = self.resolve_variable(self.config.get("to", ""), vars_ctx)
            cc_addr = self.resolve_variable(self.config.get("cc", ""), vars_ctx)
            bcc_addr = self.resolve_variable(self.config.get("bcc", ""), vars_ctx)
            subject = self.resolve_variable(self.config.get("subject", ""), vars_ctx)
            body = self.resolve_variable(self.config.get("body", ""), vars_ctx)
            reply_to = self.resolve_variable(self.config.get("reply_to", ""), vars_ctx)
            body_type = self.config.get("body_type", "html")

            if not to_addr:
                return self.handle_error(ValueError("Recipient email (to) is required"))
            if not subject:
                return self.handle_error(ValueError("Email subject is required"))

            # Single send path — dispatches SMTP vs Gmail on credential.provider.
            result = await send_email(
                db, credential, cred_data,
                to=to_addr, subject=subject, body=body, body_type=body_type,
                cc=cc_addr or None, bcc=bcc_addr or None, reply_to=reply_to or None,
            )

            if result["success"]:
                meta = dict(result.get("metadata", {}))
                return {
                    "output": "Email sent successfully",
                    "success": True,
                    "error": None,
                    "metadata": meta,
                }
            return {
                "output": None,
                "success": False,
                "error": result.get("error", "Email send failed"),
                "metadata": {"node_id": self.node_id, "node_type": self.node_type},
            }

        except Exception as e:
            return self.handle_error(e)

    def validate_config(self) -> tuple[bool, Optional[str]]:
        """Validate email node configuration."""
        if not self.config.get("credential_id"):
            return False, "SMTP credential is required"
        if not self.config.get("to"):
            return False, "Recipient email is required"
        if not self.config.get("subject"):
            return False, "Email subject is required"
        return True, None
