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

import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
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

            # Get SMTP credentials
            from app.services.credential_service import credential_service
            from app.models.credential import Credential

            credential = db.query(Credential).get(UUID(credential_id))
            if not credential:
                return self.handle_error(ValueError("SMTP credential not found"))

            cred_data = credential_service.get_decrypted_data(db, credential)

            # Check if this is a Gmail OAuth credential
            if credential.provider == "google_gmail":
                return await self._send_via_gmail(db, credential, cred_data, context, inputs)

            smtp_host = cred_data.get("host")
            smtp_port = int(cred_data.get("port", 587))
            smtp_username = cred_data.get("username")
            smtp_password = cred_data.get("password")

            if not all([smtp_host, smtp_username, smtp_password]):
                return self.handle_error(ValueError("Incomplete SMTP credentials"))

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

            # Build email message
            msg = MIMEMultipart("alternative")
            msg["From"] = smtp_username
            msg["To"] = to_addr
            msg["Subject"] = subject

            if cc_addr:
                msg["Cc"] = cc_addr
            if reply_to:
                msg["Reply-To"] = reply_to

            # Attach body
            if body_type == "html":
                msg.attach(MIMEText(body, "html"))
            else:
                msg.attach(MIMEText(body, "plain"))

            # Build recipient list
            recipients = [addr.strip() for addr in to_addr.split(",")]
            if cc_addr:
                recipients.extend([addr.strip() for addr in cc_addr.split(",")])
            if bcc_addr:
                recipients.extend([addr.strip() for addr in bcc_addr.split(",")])

            # Send email
            context_ssl = ssl.create_default_context()

            if smtp_port == 465:
                # SSL connection
                with smtplib.SMTP_SSL(smtp_host, smtp_port, context=context_ssl) as server:
                    server.login(smtp_username, smtp_password)
                    server.sendmail(smtp_username, recipients, msg.as_string())
            else:
                # STARTTLS connection
                with smtplib.SMTP(smtp_host, smtp_port) as server:
                    server.starttls(context=context_ssl)
                    server.login(smtp_username, smtp_password)
                    server.sendmail(smtp_username, recipients, msg.as_string())

            return {
                "output": "Email sent successfully",
                "success": True,
                "error": None,
                "metadata": {
                    "to": to_addr,
                    "cc": cc_addr or None,
                    "subject": subject,
                    "body_type": body_type,
                    "recipients_count": len(recipients)
                }
            }

        except smtplib.SMTPAuthenticationError:
            return {
                "output": None,
                "success": False,
                "error": "SMTP authentication failed. Check your credentials.",
                "metadata": {"node_id": self.node_id, "node_type": self.node_type}
            }
        except smtplib.SMTPException as e:
            return {
                "output": None,
                "success": False,
                "error": f"SMTP error: {str(e)}",
                "metadata": {"node_id": self.node_id, "node_type": self.node_type}
            }
        except Exception as e:
            return self.handle_error(e)

    async def _send_via_gmail(
        self,
        db: Session,
        credential,
        cred_data: dict,
        context: Dict[str, Any],
        inputs: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Send email via Gmail API using OAuth credential.

        WHY: Support Gmail as an alternative to SMTP for email sending
        HOW: Auto-refresh token if expired, then call google_adapter.send_gmail()
        """
        from app.integrations.google_adapter import google_adapter
        from app.services.credential_service import credential_service
        from datetime import datetime

        try:
            access_token = cred_data.get("access_token")
            refresh_token = cred_data.get("refresh_token")
            expires_at = cred_data.get("expires_at", "")

            # Auto-refresh token if expired or about to expire
            token_expired = False
            if expires_at:
                try:
                    expiry = datetime.fromisoformat(expires_at)
                    # Refresh if within 60 seconds of expiry
                    token_expired = (expiry - datetime.utcnow()).total_seconds() < 60
                except (ValueError, TypeError):
                    token_expired = True

            if token_expired and refresh_token:
                client_id = cred_data.get("client_id", "")
                client_secret = cred_data.get("client_secret", "")

                refresh_result = await google_adapter.refresh_gmail_token(
                    refresh_token, client_id, client_secret
                )

                if "access_token" in refresh_result:
                    access_token = refresh_result["access_token"]
                    # Update stored credential with new token
                    new_expires_in = refresh_result.get("expires_in", 3600)
                    from datetime import timedelta
                    new_expires_at = (datetime.utcnow() + timedelta(seconds=new_expires_in)).isoformat()
                    cred_data["access_token"] = access_token
                    cred_data["expires_at"] = new_expires_at
                    encrypted_data, key_id = credential_service.encrypt_with_key_id(cred_data)
                    credential.encrypted_data = encrypted_data
                    credential.encryption_key_id = key_id
                    db.commit()
                else:
                    return {
                        "output": None,
                        "success": False,
                        "error": f"Gmail token refresh failed: {refresh_result.get('error', 'unknown')}",
                        "metadata": {"node_id": self.node_id, "node_type": self.node_type}
                    }

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

            # Send via Gmail API
            result = await google_adapter.send_gmail(
                access_token=access_token,
                to=to_addr,
                subject=subject,
                body=body,
                body_type=body_type,
                cc=cc_addr or None,
                bcc=bcc_addr or None,
                reply_to=reply_to or None
            )

            if result.get("success"):
                return {
                    "output": "Email sent successfully via Gmail",
                    "success": True,
                    "error": None,
                    "metadata": {
                        "to": to_addr,
                        "cc": cc_addr or None,
                        "subject": subject,
                        "body_type": body_type,
                        "message_id": result.get("message_id"),
                        "thread_id": result.get("thread_id"),
                        "method": "gmail_api"
                    }
                }
            else:
                return {
                    "output": None,
                    "success": False,
                    "error": result.get("error", "Gmail send failed"),
                    "metadata": {"node_id": self.node_id, "node_type": self.node_type}
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
