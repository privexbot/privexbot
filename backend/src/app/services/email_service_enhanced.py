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

    html_content = f"""
        <h2>You're Invited!</h2>
        <p>You've been invited{inviter_text} to join <strong>{organization_name}</strong> on PrivexBot as a <strong>{role}</strong>.</p>
        <p>Click the button below to accept the invitation and gain access to this {resource_text}.</p>
        <div style="text-align: center; margin: 30px 0;">
            <a href="{invitation_url}" style="display: inline-block; padding: 15px 30px; background-color: #3b82f6; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
                Accept Invitation
            </a>
        </div>
        <p style="color: #6b7280; font-size: 14px;">
            Or copy and paste this link into your browser:<br>
            <a href="{invitation_url}">{invitation_url}</a>
        </p>
        <p style="color: #6b7280; font-size: 12px;">
            This invitation link will expire in 7 days. If you didn't expect this invitation, you can safely ignore this email.
        </p>
    """

    return send_email_with_retry(to_email, subject, html_content)


def send_password_reset_email_enhanced(
    to_email: str,
    reset_url: str
) -> bool:
    """
    Send password reset email with enhanced retry logic
    """
    subject = "Reset Your PrivexBot Password"

    html_content = f"""
        <h2>Password Reset Request</h2>
        <p>You've requested to reset your password for your PrivexBot account.</p>
        <p>Click the button below to create a new password:</p>
        <div style="text-align: center; margin: 30px 0;">
            <a href="{reset_url}" style="display: inline-block; padding: 15px 30px; background-color: #3b82f6; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
                Reset Password
            </a>
        </div>
        <p style="color: #6b7280; font-size: 14px;">
            Or copy and paste this link into your browser:<br>
            <a href="{reset_url}">{reset_url}</a>
        </p>
        <p style="color: #dc2626; font-size: 14px;">
            <strong>This link will expire in 1 hour.</strong>
        </p>
        <p style="color: #6b7280; font-size: 12px;">
            If you didn't request this password reset, please ignore this email. Your password will remain unchanged.
        </p>
    """

    return send_email_with_retry(to_email, subject, html_content)


def send_email_link_verification_enhanced(
    to_email: str,
    verification_code: str
) -> bool:
    """
    Send email link verification code with enhanced retry logic
    """
    subject = "Verify Email for Account Linking - PrivexBot"

    html_content = f"""
        <h2>Link Your Email Address</h2>
        <p>You're adding this email address to your PrivexBot account.</p>
        <p>Please use the following code to verify this email address:</p>
        <div style="font-size: 24px; font-weight: bold; color: #3b82f6; padding: 20px; background-color: #f3f4f6; border-radius: 8px; margin: 20px 0; text-align: center;">
            {verification_code}
        </div>
        <p>This code will expire in 5 minutes.</p>
        <p style="color: #6b7280; font-size: 12px;">
            If you didn't request this email linking, please ignore this email.
        </p>
    """

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
    resource_text = "organization" if resource_type == "organization" else "workspace"
    subject = f"Invitation Accepted - {accepter_email} joined your {resource_text}"

    html_content = f"""
        <h2>Invitation Accepted!</h2>
        <p>Good news! <strong>{accepter_email}</strong> has accepted your invitation to join <strong>{organization_name}</strong> as a <strong>{role}</strong>.</p>
        <p>They now have access to your {resource_text} and can start collaborating with your team.</p>
        <p style="color: #6b7280; font-size: 12px;">
            You're receiving this notification because you invited this user to your {resource_text}.
        </p>
    """

    return send_email_with_retry(to_email, subject, html_content)


def send_role_changed_email_enhanced(
    to_email: str,
    organization_name: str,
    old_role: str,
    new_role: str,
    changed_by_name: Optional[str] = None
) -> bool:
    """
    Send role change notification with enhanced retry logic
    """
    subject = f"Role Updated in {organization_name}"

    changed_by_text = f" by {changed_by_name}" if changed_by_name else ""

    html_content = f"""
        <h2>Your Role Has Been Updated</h2>
        <p>Your role in <strong>{organization_name}</strong> has been changed{changed_by_text}.</p>
        <div style="padding: 20px; background-color: #f3f4f6; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Previous Role:</strong> {old_role}</p>
            <p style="margin: 10px 0 0 0;"><strong>New Role:</strong> {new_role}</p>
        </div>
        <p>This change is effective immediately.</p>
        <p style="color: #6b7280; font-size: 12px;">
            If you have questions about this change, please contact your organization administrator.
        </p>
    """

    return send_email_with_retry(to_email, subject, html_content)


def send_member_removed_email_enhanced(
    to_email: str,
    organization_name: str,
    removed_by_name: Optional[str] = None
) -> bool:
    """
    Send member removal notification with enhanced retry logic
    """
    subject = f"Access Removed from {organization_name}"

    removed_by_text = f" by {removed_by_name}" if removed_by_name else ""

    html_content = f"""
        <h2>Access Removed</h2>
        <p>Your access to <strong>{organization_name}</strong> has been removed{removed_by_text}.</p>
        <p>You will no longer be able to access this organization's resources.</p>
        <p>If you believe this was done in error, please contact the organization administrator.</p>
        <p style="color: #6b7280; font-size: 12px;">
            This action is effective immediately.
        </p>
    """

    return send_email_with_retry(to_email, subject, html_content)