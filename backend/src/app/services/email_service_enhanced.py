"""
Enhanced Email Service with Retry Logic and Multiple SMTP Fallbacks

This service provides robust email sending with:
1. Automatic retry on network failures
2. Multiple SMTP port fallback (465 SSL, 587 TLS, 25 plain)
3. Connection pooling and caching
4. Better error handling and logging
"""

import smtplib
import socket
import logging
import time
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional, List, Tuple
from functools import wraps
from app.core.config import Settings

logger = logging.getLogger(__name__)


def _create_html_template(subject: str, heading: str, body_html: str) -> str:
    """
    Create a simple HTML email template.

    WHY: Consistent email styling across all notifications
    HOW: Basic responsive HTML template
    """
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>{subject}</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
        <table role="presentation" style="width: 100%; border-collapse: collapse;">
            <tr>
                <td align="center" style="padding: 40px 0;">
                    <table role="presentation" style="width: 600px; max-width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <!-- Header -->
                        <tr>
                            <td style="padding: 40px 40px 20px 40px; text-align: center; background-color: #3b82f6; border-radius: 8px 8px 0 0;">
                                <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">PrivexBot</h1>
                            </td>
                        </tr>
                        <!-- Body -->
                        <tr>
                            <td style="padding: 40px;">
                                <h2 style="margin: 0 0 20px 0; color: #1f2937; font-size: 20px; font-weight: 600;">{heading}</h2>
                                {body_html}
                            </td>
                        </tr>
                        <!-- Footer -->
                        <tr>
                            <td style="padding: 20px 40px; text-align: center; border-top: 1px solid #e5e7eb;">
                                <p style="margin: 0; color: #6b7280; font-size: 12px;">
                                    This is an automated email from PrivexBot. Please do not reply to this email.
                                </p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """


def retry_on_network_error(max_retries: int = 3, delay: float = 2.0):
    """Decorator to retry function on network errors"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            last_error = None
            for attempt in range(max_retries):
                try:
                    return func(*args, **kwargs)
                except (socket.gaierror, socket.timeout, OSError, ConnectionError) as e:
                    last_error = e
                    if attempt < max_retries - 1:
                        wait_time = delay * (2 ** attempt)  # Exponential backoff
                        logger.warning(
                            f"Network error on attempt {attempt + 1}/{max_retries}: {e}. "
                            f"Retrying in {wait_time}s..."
                        )
                        time.sleep(wait_time)
                    else:
                        logger.error(f"All {max_retries} attempts failed: {e}")
            raise last_error
        return wrapper
    return decorator


class EnhancedEmailService:
    """Enhanced email service with multiple fallbacks and retry logic"""

    # SMTP configurations to try in order
    SMTP_CONFIGS: List[Tuple[int, bool, str]] = [
        (587, True, "STARTTLS"),   # Most common, TLS
        (465, False, "SSL"),       # SSL/TLS wrapper
        (25, True, "Plain/TLS"),   # Standard SMTP, might be blocked
        (2525, True, "Alternative") # Alternative port some providers use
    ]

    def __init__(self, settings: Settings):
        self.settings = settings
        self._last_working_config: Optional[Tuple[int, bool, str]] = None

    def _test_smtp_connection(self, host: str, port: int, use_starttls: bool) -> bool:
        """Test if SMTP connection works with given configuration"""
        try:
            if not use_starttls and port == 465:
                # SSL connection
                with smtplib.SMTP_SSL(host, port, timeout=5) as server:
                    server.noop()  # Test command
            else:
                # STARTTLS or plain connection
                with smtplib.SMTP(host, port, timeout=5) as server:
                    if use_starttls:
                        server.starttls()
                    server.noop()  # Test command
            return True
        except Exception as e:
            logger.debug(f"SMTP test failed for {host}:{port} ({use_starttls=}): {e}")
            return False

    @retry_on_network_error(max_retries=3, delay=1.0)
    def _send_with_config(
        self,
        message: MIMEMultipart,
        host: str,
        port: int,
        use_starttls: bool,
        username: str,
        password: str
    ) -> bool:
        """Send email with specific SMTP configuration"""
        if not use_starttls and port == 465:
            # SSL/TLS wrapper mode
            with smtplib.SMTP_SSL(host, port, timeout=30) as server:
                server.login(username, password)
                server.send_message(message)
        else:
            # STARTTLS or plain mode
            with smtplib.SMTP(host, port, timeout=30) as server:
                if use_starttls:
                    server.starttls()
                server.login(username, password)
                server.send_message(message)
        return True

    def send_email(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        plain_content: Optional[str] = None
    ) -> bool:
        """
        Send email with automatic fallback to different SMTP configurations

        Returns:
            True if email was sent successfully, False otherwise
        """
        # Skip in development if not configured
        if not self.settings.SMTP_USER or not self.settings.SMTP_PASSWORD:
            logger.info(f"[EmailService] SMTP not configured. Would send to {to_email}: {subject}")
            return True

        # Create message
        message = MIMEMultipart("alternative")
        message["Subject"] = subject
        message["From"] = f"{self.settings.SMTP_FROM_NAME} <{self.settings.SMTP_FROM_EMAIL}>"
        message["To"] = to_email

        # Add content
        if plain_content:
            message.attach(MIMEText(plain_content, "plain"))
        message.attach(MIMEText(html_content, "html"))

        # Try last working configuration first if available
        if self._last_working_config:
            port, use_starttls, desc = self._last_working_config
            try:
                logger.debug(f"Trying last working config: port {port} ({desc})")
                result = self._send_with_config(
                    message,
                    self.settings.SMTP_HOST,
                    port,
                    use_starttls,
                    self.settings.SMTP_USER,
                    self.settings.SMTP_PASSWORD
                )
                if result:
                    logger.info(f"[EmailService] Email sent to {to_email} using port {port} ({desc})")
                    return True
            except Exception as e:
                logger.warning(f"Last working config failed: {e}")
                self._last_working_config = None

        # Try each SMTP configuration
        errors = []
        for port, use_starttls, description in self.SMTP_CONFIGS:
            try:
                # Skip if this was the last working config we already tried
                if self._last_working_config and self._last_working_config[0] == port:
                    continue

                logger.debug(f"Trying SMTP {self.settings.SMTP_HOST}:{port} ({description})")

                # Quick connection test first
                if not self._test_smtp_connection(self.settings.SMTP_HOST, port, use_starttls):
                    logger.debug(f"Skipping port {port} - connection test failed")
                    continue

                # Try to send
                result = self._send_with_config(
                    message,
                    self.settings.SMTP_HOST,
                    port,
                    use_starttls,
                    self.settings.SMTP_USER,
                    self.settings.SMTP_PASSWORD
                )

                if result:
                    logger.info(
                        f"[EmailService] ✅ Email sent to {to_email} using port {port} ({description})"
                    )
                    # Remember this working configuration
                    self._last_working_config = (port, use_starttls, description)
                    return True

            except Exception as e:
                error_msg = f"Port {port} ({description}): {str(e)}"
                errors.append(error_msg)
                logger.debug(f"Failed with {error_msg}")
                continue

        # All attempts failed
        logger.error(
            f"[EmailService] ❌ Failed to send email to {to_email} after trying all ports. "
            f"Errors: {'; '.join(errors)}"
        )
        return False


# Singleton instance
_email_service: Optional[EnhancedEmailService] = None


def get_email_service() -> EnhancedEmailService:
    """Get or create the email service singleton"""
    global _email_service
    if _email_service is None:
        from app.core.config import settings
        _email_service = EnhancedEmailService(settings)
    return _email_service


# Backwards compatible function
def send_email_with_retry(
    to_email: str,
    subject: str,
    html_content: str,
    plain_content: Optional[str] = None
) -> bool:
    """
    Send email with automatic retry and port fallback

    This is the main function to use for sending emails.
    """
    service = get_email_service()
    return service.send_email(to_email, subject, html_content, plain_content)


# Enhanced wrapper functions for specific email types
def send_invitation_email_enhanced(
    to_email: str,
    organization_name: str,
    inviter_name: Optional[str],
    role: str,
    invitation_url: str,
    resource_type: str = "organization"
) -> bool:
    """
    Send invitation email with enhanced retry logic
    """
    # Email subject
    subject = f"You've been invited to join {organization_name} on PrivexBot"

    # Build HTML body
    inviter_text = f" by {inviter_name}" if inviter_name else ""
    resource_text = "organization" if resource_type == "organization" else "workspace"

    body_html = f"""
        <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px; line-height: 1.5;">
            You've been invited{inviter_text} to join <strong>{organization_name}</strong> on PrivexBot as a <strong>{role}</strong>.
        </p>
        <p style="margin: 0 0 24px 0; color: #374151; font-size: 16px; line-height: 1.5;">
            Click the button below to accept the invitation and gain access to this {resource_text}.
        </p>
        <table role="presentation" style="margin: 0 0 24px 0;">
            <tr>
                <td>
                    <a href="{invitation_url}" style="display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
                        Accept Invitation
                    </a>
                </td>
            </tr>
        </table>
        <p style="margin: 0 0 16px 0; color: #6b7280; font-size: 14px; line-height: 1.5;">
            Or copy and paste this link into your browser:
        </p>
        <p style="margin: 0 0 24px 0; color: #3b82f6; font-size: 14px; word-break: break-all;">
            {invitation_url}
        </p>
        <p style="margin: 0; color: #6b7280; font-size: 14px; line-height: 1.5;">
            This invitation will expire in 7 days. If you didn't expect this invitation, you can safely ignore this email.
        </p>
    """

    # Create full HTML email using template
    html_content = _create_html_template(
        subject=subject,
        heading=f"You've been invited to {organization_name}",
        body_html=body_html
    )

    return send_email_with_retry(to_email, subject, html_content)


def send_password_reset_email_enhanced(
    to_email: str,
    reset_url: str
) -> bool:
    """
    Send password reset email with enhanced retry logic
    """
    subject = "Reset your PrivexBot password"

    body_html = f"""
        <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px; line-height: 1.5;">
            We received a request to reset the password for your PrivexBot account associated with this email address.
        </p>
        <p style="margin: 0 0 24px 0; color: #374151; font-size: 16px; line-height: 1.5;">
            Click the button below to reset your password. This link will expire in <strong>1 hour</strong>.
        </p>
        <table role="presentation" style="margin: 0 0 24px 0;">
            <tr>
                <td>
                    <a href="{reset_url}" style="display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
                        Reset Password
                    </a>
                </td>
            </tr>
        </table>
        <p style="margin: 0 0 16px 0; color: #6b7280; font-size: 14px; line-height: 1.5;">
            Or copy and paste this link into your browser:
        </p>
        <p style="margin: 0 0 24px 0; color: #3b82f6; font-size: 14px; word-break: break-all;">
            {reset_url}
        </p>
        <div style="padding: 16px; background-color: #fef3c7; border: 1px solid #fcd34d; border-radius: 6px; margin: 24px 0;">
            <p style="margin: 0 0 8px 0; color: #92400e; font-size: 14px; font-weight: 600;">
                ⚠️ Security Notice
            </p>
            <p style="margin: 0; color: #92400e; font-size: 14px; line-height: 1.5;">
                If you didn't request this password reset, please ignore this email and your password will remain unchanged.
                Someone may have entered your email address by mistake.
            </p>
        </div>
        <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 12px; line-height: 1.5;">
            For security reasons:
        </p>
        <ul style="margin: 0; padding-left: 20px; color: #6b7280; font-size: 12px; line-height: 1.5;">
            <li>This link expires in 1 hour</li>
            <li>This link can only be used once</li>
            <li>We will never ask for your password via email</li>
        </ul>
    """

    # Create full HTML email using template
    html_content = _create_html_template(
        subject=subject,
        heading="Password Reset Request",
        body_html=body_html
    )

    return send_email_with_retry(to_email, subject, html_content)


def send_email_link_verification_enhanced(
    to_email: str,
    verification_code: str
) -> bool:
    """
    Send email link verification code with enhanced retry logic
    """
    subject = "Verify your email address for account linking"

    body_html = f"""
        <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px; line-height: 1.5;">
            You've requested to link this email address to your existing <strong>PrivexBot</strong> account.
        </p>
        <p style="margin: 0 0 24px 0; color: #374151; font-size: 16px; line-height: 1.5;">
            To complete the email linking process, please verify your email address using the verification code below:
        </p>
        <div style="text-align: center; margin: 24px 0;">
            <div style="display: inline-block; padding: 20px 40px; background-color: #f3f4f6; border: 2px dashed #9ca3af; border-radius: 8px;">
                <span style="font-size: 32px; font-weight: 700; color: #1f2937; letter-spacing: 4px; font-family: 'Courier New', monospace;">
                    {verification_code}
                </span>
            </div>
        </div>
        <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px; line-height: 1.5;">
            Enter this code in the verification form to complete the linking process.
        </p>
        <div style="padding: 16px; background-color: #fef3c7; border: 1px solid #fcd34d; border-radius: 6px; margin: 24px 0;">
            <p style="margin: 0 0 8px 0; color: #92400e; font-size: 14px; font-weight: 600;">
                ⏰ Time Sensitive
            </p>
            <p style="margin: 0; color: #92400e; font-size: 14px; line-height: 1.5;">
                This verification code will expire in <strong>5 minutes</strong> for security reasons.
            </p>
        </div>
        <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 12px; line-height: 1.5;">
            For security reasons:
        </p>
        <ul style="margin: 0; padding-left: 20px; color: #6b7280; font-size: 12px; line-height: 1.5;">
            <li>This code expires in 5 minutes</li>
            <li>This code can only be used once</li>
            <li>Don't share this code with anyone</li>
        </ul>
        <div style="margin: 24px 0; padding: 16px; background-color: #eff6ff; border: 1px solid #3b82f6; border-radius: 6px;">
            <p style="margin: 0; color: #1e40af; font-size: 14px; line-height: 1.5;">
                If you didn't request this email linking, please ignore this email and the verification code will expire automatically.
            </p>
        </div>
    """

    # Create full HTML email using template
    html_content = _create_html_template(
        subject=subject,
        heading="Verify Email for Account Linking",
        body_html=body_html
    )

    return send_email_with_retry(to_email, subject, html_content)


def send_invitation_accepted_email_enhanced(
    to_email: str,
    accepter_email: str,
    organization_name: str,
    role: str,
    resource_type: str = "organization"
) -> bool:
    """
    Send invitation accepted notification with enhanced retry logic
    """
    from app.core.config import settings

    subject = f"{accepter_email} accepted your invitation to {organization_name}"

    resource_text = "organization" if resource_type == "organization" else "workspace"

    body_html = f"""
        <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px; line-height: 1.5;">
            Great news! <strong>{accepter_email}</strong> has accepted your invitation to join <strong>{organization_name}</strong>.
        </p>
        <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px; line-height: 1.5;">
            They now have <strong>{role}</strong> access to the {resource_text}.
        </p>
        <table role="presentation" style="margin: 0 0 16px 0;">
            <tr>
                <td>
                    <a href="{settings.FRONTEND_URL}/dashboard" style="display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
                        Go to Dashboard
                    </a>
                </td>
            </tr>
        </table>
    """

    # Create full HTML email using template
    html_content = _create_html_template(
        subject=subject,
        heading="Invitation Accepted",
        body_html=body_html
    )

    return send_email_with_retry(to_email, subject, html_content)


def send_role_changed_email_enhanced(
    to_email: str,
    organization_name: str,
    old_role: str,
    new_role: str,
    resource_type: str = "organization"
) -> bool:
    """
    Send role change notification with enhanced retry logic
    """
    from app.core.config import settings

    subject = f"Your role in {organization_name} has been updated"

    resource_text = "organization" if resource_type == "organization" else "workspace"

    body_html = f"""
        <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px; line-height: 1.5;">
            Your role in <strong>{organization_name}</strong> has been changed from <strong>{old_role}</strong> to <strong>{new_role}</strong>.
        </p>
        <p style="margin: 0 0 24px 0; color: #374151; font-size: 16px; line-height: 1.5;">
            Your permissions in this {resource_text} have been updated accordingly.
        </p>
        <table role="presentation" style="margin: 0 0 16px 0;">
            <tr>
                <td>
                    <a href="{settings.FRONTEND_URL}/dashboard" style="display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
                        Go to Dashboard
                    </a>
                </td>
            </tr>
        </table>
    """

    # Create full HTML email using template
    html_content = _create_html_template(
        subject=subject,
        heading="Role Updated",
        body_html=body_html
    )

    return send_email_with_retry(to_email, subject, html_content)


def send_member_removed_email_enhanced(
    to_email: str,
    organization_name: str,
    resource_type: str = "organization"
) -> bool:
    """
    Send member removal notification with enhanced retry logic
    """
    subject = f"You've been removed from {organization_name}"

    resource_text = "organization" if resource_type == "organization" else "workspace"

    body_html = f"""
        <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px; line-height: 1.5;">
            You've been removed from <strong>{organization_name}</strong>.
        </p>
        <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px; line-height: 1.5;">
            You no longer have access to this {resource_text}. If you believe this was a mistake, please contact the {resource_text} administrator.
        </p>
    """

    # Create full HTML email using template
    html_content = _create_html_template(
        subject=subject,
        heading="Access Removed",
        body_html=body_html
    )

    return send_email_with_retry(to_email, subject, html_content)