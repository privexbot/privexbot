"""Shared email-sending helper for chatflow nodes (email, handoff).

Both the `email` node and the `handoff` node need to deliver an email using a
workspace Credential. They previously duplicated the SMTP logic, and only the
email node supported Gmail-OAuth. This helper is the single send path:

  * SMTP credential (`credential_type="smtp"`, fields host/port/username/password):
    delivered via `smtplib` — port 465 → implicit SSL, otherwise STARTTLS. The
    credential's `username` is used as the From address.
  * Gmail-OAuth credential (`credential.provider == "google_gmail"`): delivered
    via the Gmail API over HTTPS (`google_adapter.send_gmail`), auto-refreshing
    and re-persisting the access token when it is about to expire. This path is
    robust on SecretVM where outbound SMTP egress may be restricted (it only
    needs port 443).

Returns a uniform dict `{"success": bool, "error": str | None, "metadata": dict}`
so callers just check `result["success"]`. Never raises for delivery failures —
those come back as `success=False` with a human-readable `error`.
"""

import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Any, Dict, Optional

from sqlalchemy.orm import Session


async def send_email(
    db: Session,
    credential,
    cred_data: Dict[str, Any],
    *,
    to: str,
    subject: str,
    body: str,
    body_type: str = "html",
    cc: Optional[str] = None,
    bcc: Optional[str] = None,
    reply_to: Optional[str] = None,
) -> Dict[str, Any]:
    """Send an email via the credential's transport (Gmail API or SMTP).

    `cred_data` is the already-decrypted credential payload (the caller decrypts
    once and may reuse it). `to`/`cc`/`bcc` may be comma-separated lists.
    """
    if not to:
        return {"success": False, "error": "Recipient email (to) is required", "metadata": {}}
    if not subject:
        return {"success": False, "error": "Email subject is required", "metadata": {}}

    if getattr(credential, "provider", None) == "google_gmail":
        return await _send_via_gmail(
            db, credential, cred_data,
            to=to, subject=subject, body=body, body_type=body_type,
            cc=cc, bcc=bcc, reply_to=reply_to,
        )

    return _send_via_smtp(
        cred_data,
        to=to, subject=subject, body=body, body_type=body_type,
        cc=cc, bcc=bcc, reply_to=reply_to,
    )


def _send_via_smtp(
    cred_data: Dict[str, Any],
    *,
    to: str,
    subject: str,
    body: str,
    body_type: str,
    cc: Optional[str],
    bcc: Optional[str],
    reply_to: Optional[str],
) -> Dict[str, Any]:
    """Deliver via SMTP (smtplib). Port 465 → SSL, else STARTTLS."""
    smtp_host = cred_data.get("host")
    smtp_port = int(cred_data.get("port", 587))
    smtp_username = cred_data.get("username")
    smtp_password = cred_data.get("password")

    if not all([smtp_host, smtp_username, smtp_password]):
        return {"success": False, "error": "Incomplete SMTP credentials", "metadata": {}}

    msg = MIMEMultipart("alternative")
    msg["From"] = smtp_username
    msg["To"] = to
    msg["Subject"] = subject
    if cc:
        msg["Cc"] = cc
    if reply_to:
        msg["Reply-To"] = reply_to
    msg.attach(MIMEText(body, "html" if body_type == "html" else "plain"))

    recipients = [a.strip() for a in to.split(",") if a.strip()]
    if cc:
        recipients += [a.strip() for a in cc.split(",") if a.strip()]
    if bcc:
        recipients += [a.strip() for a in bcc.split(",") if a.strip()]

    context_ssl = ssl.create_default_context()
    try:
        if smtp_port == 465:
            with smtplib.SMTP_SSL(smtp_host, smtp_port, context=context_ssl) as server:
                server.login(smtp_username, smtp_password)
                server.sendmail(smtp_username, recipients, msg.as_string())
        else:
            with smtplib.SMTP(smtp_host, smtp_port) as server:
                server.starttls(context=context_ssl)
                server.login(smtp_username, smtp_password)
                server.sendmail(smtp_username, recipients, msg.as_string())
    except smtplib.SMTPAuthenticationError:
        return {
            "success": False,
            "error": "SMTP authentication failed. Check your credentials.",
            "metadata": {},
        }
    except smtplib.SMTPException as e:
        return {"success": False, "error": f"SMTP error: {str(e)}", "metadata": {}}
    except Exception as e:
        return {"success": False, "error": f"Email send failed: {str(e)}", "metadata": {}}

    return {
        "success": True,
        "error": None,
        "metadata": {
            "to": to,
            "cc": cc or None,
            "subject": subject,
            "body_type": body_type,
            "recipients_count": len(recipients),
            "method": "smtp",
        },
    }


async def _send_via_gmail(
    db: Session,
    credential,
    cred_data: Dict[str, Any],
    *,
    to: str,
    subject: str,
    body: str,
    body_type: str,
    cc: Optional[str],
    bcc: Optional[str],
    reply_to: Optional[str],
) -> Dict[str, Any]:
    """Deliver via the Gmail API (HTTPS), refreshing the token if near expiry."""
    from datetime import datetime, timedelta
    from app.integrations.google_adapter import google_adapter
    from app.services.credential_service import credential_service

    try:
        access_token = cred_data.get("access_token")
        refresh_token = cred_data.get("refresh_token")
        expires_at = cred_data.get("expires_at", "")

        token_expired = False
        if expires_at:
            try:
                expiry = datetime.fromisoformat(expires_at)
                token_expired = (expiry - datetime.utcnow()).total_seconds() < 60
            except (ValueError, TypeError):
                token_expired = True

        if token_expired and refresh_token:
            refresh_result = await google_adapter.refresh_gmail_token(
                refresh_token,
                cred_data.get("client_id", ""),
                cred_data.get("client_secret", ""),
            )
            if "access_token" in refresh_result:
                access_token = refresh_result["access_token"]
                new_expires_in = refresh_result.get("expires_in", 3600)
                cred_data["access_token"] = access_token
                cred_data["expires_at"] = (
                    datetime.utcnow() + timedelta(seconds=new_expires_in)
                ).isoformat()
                encrypted_data, key_id = credential_service.encrypt_with_key_id(cred_data)
                credential.encrypted_data = encrypted_data
                credential.encryption_key_id = key_id
                db.commit()
            else:
                return {
                    "success": False,
                    "error": f"Gmail token refresh failed: {refresh_result.get('error', 'unknown')}",
                    "metadata": {},
                }

        result = await google_adapter.send_gmail(
            access_token=access_token,
            to=to,
            subject=subject,
            body=body,
            body_type=body_type,
            cc=cc or None,
            bcc=bcc or None,
            reply_to=reply_to or None,
        )

        if result.get("success"):
            return {
                "success": True,
                "error": None,
                "metadata": {
                    "to": to,
                    "cc": cc or None,
                    "subject": subject,
                    "body_type": body_type,
                    "message_id": result.get("message_id"),
                    "thread_id": result.get("thread_id"),
                    "method": "gmail_api",
                },
            }
        return {
            "success": False,
            "error": result.get("error", "Gmail send failed"),
            "metadata": {},
        }
    except Exception as e:
        return {"success": False, "error": f"Gmail send failed: {str(e)}", "metadata": {}}
