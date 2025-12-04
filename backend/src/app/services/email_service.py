"""
Email Service - Send transactional emails via SMTP.

WHY:
- Send invitation emails with accept links
- Send notification emails (role changes, removals)
- Simple SMTP-based implementation (no external service dependencies)

HOW:
- Uses Python's built-in smtplib
- Configured via environment variables
- HTML email templates
- Falls back gracefully in development

USAGE:
------
from app.services.email_service import send_invitation_email

await send_invitation_email(
    to_email="user@example.com",
    organization_name="Acme Corp",
    inviter_name="John Doe",
    role="admin",
    invitation_url="https://app.com/invitations/accept?token=abc123"
)
"""

import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
from app.core.config import Settings

logger = logging.getLogger(__name__)


def _get_settings() -> Settings:
    """Get settings instance"""
    from app.core.config import settings
    return settings


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


def _send_email(
    to_email: str,
    subject: str,
    html_content: str,
    settings: Settings
) -> bool:
    """
    Send email via SMTP.

    WHY: Core email sending function
    HOW: Uses smtplib with TLS
    RETURNS: True if sent successfully, False otherwise
    """
    # Skip sending in development if SMTP not configured
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        logger.warning(
            f"[EmailService] SMTP not configured. Would send email to {to_email} with subject: {subject}"
        )
        logger.info(f"[EmailService] Email content preview:\n{html_content[:500]}...")
        return True  # Return True in dev to not block flow

    try:
        # Create message
        message = MIMEMultipart("alternative")
        message["Subject"] = subject
        message["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>"
        message["To"] = to_email

        # Add HTML content
        html_part = MIMEText(html_content, "html")
        message.attach(html_part)

        # Send via SMTP with timeout
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=5) as server:
            server.starttls()  # Enable TLS
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(message)

        logger.info(f"[EmailService] Email sent successfully to {to_email}")
        return True

    except Exception as e:
        logger.error(f"[EmailService] Failed to send email to {to_email}: {str(e)}")
        return False


def send_invitation_email(
    to_email: str,
    organization_name: str,
    inviter_name: Optional[str],
    role: str,
    invitation_url: str,
    resource_type: str = "organization"
) -> bool:
    """
    Send invitation email to user.

    WHY: Notify user they've been invited
    HOW: Email with accept link

    Args:
        to_email: Recipient email address
        organization_name: Name of organization (or workspace name for workspace invitations)
        inviter_name: Name of person who sent invitation
        role: Role being offered
        invitation_url: Full URL to accept invitation
        resource_type: 'organization' or 'workspace'

    Returns:
        True if email sent successfully, False otherwise
    """
    settings = _get_settings()

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

    # Create full HTML email
    html_content = _create_html_template(
        subject=subject,
        heading=f"You've been invited to {organization_name}",
        body_html=body_html
    )

    return _send_email(
        to_email=to_email,
        subject=subject,
        html_content=html_content,
        settings=settings
    )


def send_invitation_accepted_email(
    to_email: str,
    accepter_email: str,
    organization_name: str,
    role: str,
    resource_type: str = "organization"
) -> bool:
    """
    Send notification to inviter that invitation was accepted.

    WHY: Keep inviter informed of invitation status
    HOW: Simple notification email

    Args:
        to_email: Inviter's email address
        accepter_email: Email of person who accepted
        organization_name: Name of organization/workspace
        role: Role that was assigned
        resource_type: 'organization' or 'workspace'

    Returns:
        True if email sent successfully, False otherwise
    """
    settings = _get_settings()

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

    html_content = _create_html_template(
        subject=subject,
        heading="Invitation Accepted",
        body_html=body_html
    )

    return _send_email(
        to_email=to_email,
        subject=subject,
        html_content=html_content,
        settings=settings
    )


def send_role_changed_email(
    to_email: str,
    organization_name: str,
    old_role: str,
    new_role: str,
    resource_type: str = "organization"
) -> bool:
    """
    Send notification that user's role has changed.

    WHY: Keep users informed of permission changes
    HOW: Simple notification email

    Args:
        to_email: User's email address
        organization_name: Name of organization/workspace
        old_role: Previous role
        new_role: New role
        resource_type: 'organization' or 'workspace'

    Returns:
        True if email sent successfully, False otherwise
    """
    settings = _get_settings()

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

    html_content = _create_html_template(
        subject=subject,
        heading="Role Updated",
        body_html=body_html
    )

    return _send_email(
        to_email=to_email,
        subject=subject,
        html_content=html_content,
        settings=settings
    )


def send_member_removed_email(
    to_email: str,
    organization_name: str,
    resource_type: str = "organization"
) -> bool:
    """
    Send notification that user has been removed from organization/workspace.

    WHY: Keep users informed when they lose access
    HOW: Simple notification email

    Args:
        to_email: User's email address
        organization_name: Name of organization/workspace
        resource_type: 'organization' or 'workspace'

    Returns:
        True if email sent successfully, False otherwise
    """
    settings = _get_settings()

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

    html_content = _create_html_template(
        subject=subject,
        heading="Access Removed",
        body_html=body_html
    )

    return _send_email(
        to_email=to_email,
        subject=subject,
        html_content=html_content,
        settings=settings
    )


def send_password_reset_email(
    to_email: str,
    reset_url: str
) -> bool:
    """
    Send password reset email to user.

    WHY: Allow users to securely reset forgotten passwords
    HOW: Email with unique reset link that expires in 1 hour

    Args:
        to_email: User's email address
        reset_url: Full URL to reset password (includes token)

    Returns:
        True if email sent successfully, False otherwise

    Security Notes:
        - Token expires in 1 hour
        - One-time use only
        - Secure random token generation
    """
    settings = _get_settings()

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

    html_content = _create_html_template(
        subject=subject,
        heading="Password Reset Request",
        body_html=body_html
    )

    return _send_email(
        to_email=to_email,
        subject=subject,
        html_content=html_content,
        settings=settings
    )
