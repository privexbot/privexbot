"""
Invitation Service - Business logic for email-based invitations.

WHY:
- Handle invitation lifecycle (create, send, accept, cancel)
- Generate secure tokens
- Send email notifications
- Create memberships on acceptance

HOW:
- Uses Invitation model for persistence
- Uses email_service for notifications
- Integrates with tenant_service for membership creation
"""

import secrets
from datetime import datetime, timedelta
from typing import List, Optional, Tuple
from uuid import UUID
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.invitation import Invitation
from app.models.user import User
from app.models.auth_identity import AuthIdentity
from app.models.organization import Organization
from app.models.workspace import Workspace
from app.models.organization_member import OrganizationMember
from app.models.workspace_member import WorkspaceMember
from app.services import email_service
from app.services.email_service_enhanced import (
    send_invitation_email_enhanced,
    send_invitation_accepted_email_enhanced
)
from app.services.tenant_service import (
    add_organization_member,
    add_workspace_member,
    verify_organization_permission,
    verify_workspace_permission
)


def _generate_invitation_token() -> str:
    """
    Generate secure random token for invitation URL.

    WHY: Secure, unguessable invitation links
    HOW: Uses secrets module for cryptographically strong random tokens
    RETURNS: URL-safe token string
    """
    return secrets.token_urlsafe(32)


def _generate_invitation_url(token: str, frontend_url: str) -> str:
    """
    Generate full invitation acceptance URL.

    WHY: Email needs complete URL for users to click
    HOW: Combines frontend URL with token parameter
    RETURNS: Full URL string
    """
    return f"{frontend_url}/invitations/accept?token={token}"


def create_invitation(
    db: Session,
    email: str,
    resource_type: str,
    resource_id: UUID,
    invited_role: str,
    inviter_id: UUID,
    frontend_url: str
) -> Invitation:
    """
    Create a new invitation and send email.

    WHY: Invite users by email instead of requiring UUID
    HOW: Creates invitation record, generates token, sends email

    Args:
        db: Database session
        email: Email address to invite
        resource_type: 'organization' or 'workspace'
        resource_id: UUID of organization or workspace
        invited_role: Role to assign on acceptance
        inviter_id: UUID of user sending invitation
        frontend_url: Frontend base URL for generating invitation link

    Returns:
        Created Invitation object

    Raises:
        HTTPException: If validation fails or user already member
    """
    # Check if user with this email already exists and is already a member
    # Query by AuthIdentity since User doesn't have email field directly
    existing_auth = db.query(AuthIdentity).filter(
        AuthIdentity.provider == "email",
        AuthIdentity.provider_id == email
    ).first()
    existing_user = existing_auth.user if existing_auth else None

    if resource_type == "organization":
        # Verify resource exists
        org = db.query(Organization).filter(Organization.id == resource_id).first()
        if not org:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Organization not found"
            )

        # Check if user already a member
        if existing_user:
            existing_membership = db.query(OrganizationMember).filter(
                OrganizationMember.user_id == existing_user.id,
                OrganizationMember.organization_id == resource_id
            ).first()
            if existing_membership:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="User is already a member of this organization"
                )

        resource_name = org.name

    elif resource_type == "workspace":
        # Verify resource exists
        workspace = db.query(Workspace).filter(Workspace.id == resource_id).first()
        if not workspace:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Workspace not found"
            )

        # Check if user already a member
        if existing_user:
            existing_membership = db.query(WorkspaceMember).filter(
                WorkspaceMember.user_id == existing_user.id,
                WorkspaceMember.workspace_id == resource_id
            ).first()
            if existing_membership:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="User is already a member of this workspace"
                )

        resource_name = workspace.name
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid resource type"
        )

    # Check for existing pending invitation
    existing_invitation = db.query(Invitation).filter(
        Invitation.email == email,
        Invitation.resource_type == resource_type,
        Invitation.resource_id == resource_id,
        Invitation.status == 'pending'
    ).first()

    if existing_invitation:
        # Cancel old invitation and create new one (implicit resend)
        existing_invitation.status = 'cancelled'

    # Generate token
    token = _generate_invitation_token()

    # Create invitation
    invitation = Invitation(
        email=email,
        resource_type=resource_type,
        resource_id=resource_id,
        invited_role=invited_role,
        token=token,
        invited_by=inviter_id,
        invited_at=datetime.utcnow(),
        expires_at=datetime.utcnow() + timedelta(days=7),  # 7 days expiration
        status='pending'
    )

    db.add(invitation)
    db.commit()
    db.refresh(invitation)

    # Generate invitation URL
    invitation_url = _generate_invitation_url(token, frontend_url)

    # Get inviter name for email
    inviter = db.query(User).filter(User.id == inviter_id).first()
    inviter_name = inviter.username if inviter else None

    # Send invitation email with enhanced retry logic
    send_invitation_email_enhanced(
        to_email=email,
        organization_name=resource_name,
        inviter_name=inviter_name,
        role=invited_role,
        invitation_url=invitation_url,
        resource_type=resource_type
    )

    return invitation


def get_invitation_by_token(db: Session, token: str) -> Optional[Invitation]:
    """
    Get invitation by token.

    WHY: Retrieve invitation from URL token
    HOW: Query by token field

    Args:
        db: Database session
        token: Invitation token from URL

    Returns:
        Invitation object or None if not found
    """
    return db.query(Invitation).filter(Invitation.token == token).first()


def get_invitation_details(
    db: Session,
    token: str
) -> Tuple[Invitation, str, Optional[str]]:
    """
    Get invitation details for public accept page.

    WHY: Show invitation info to unauthenticated users
    HOW: Fetch invitation and related resource name

    Args:
        db: Database session
        token: Invitation token from URL

    Returns:
        Tuple of (Invitation, resource_name, inviter_name)

    Raises:
        HTTPException: If invitation not found, expired, or already used
    """
    invitation = get_invitation_by_token(db, token)

    if not invitation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invitation not found"
        )

    if invitation.is_expired:
        invitation.status = 'expired'
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="Invitation has expired"
        )

    if invitation.status != 'pending':
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invitation has already been {invitation.status}"
        )

    # Get resource name
    if invitation.resource_type == "organization":
        resource = db.query(Organization).filter(
            Organization.id == invitation.resource_id
        ).first()
    else:
        resource = db.query(Workspace).filter(
            Workspace.id == invitation.resource_id
        ).first()

    resource_name = resource.name if resource else "Unknown"

    # Get inviter name
    inviter = db.query(User).filter(User.id == invitation.invited_by).first()
    inviter_name = inviter.username if inviter else None

    return invitation, resource_name, inviter_name


def accept_invitation(
    db: Session,
    token: str,
    user_id: UUID
) -> Invitation:
    """
    Accept an invitation and create membership.

    WHY: Allow users to consent to joining org/workspace
    HOW: Creates OrganizationMember or WorkspaceMember

    Args:
        db: Database session
        token: Invitation token from URL
        user_id: UUID of accepting user (must be authenticated)

    Returns:
        Updated Invitation object

    Raises:
        HTTPException: If invitation invalid, expired, or membership creation fails
    """
    invitation = get_invitation_by_token(db, token)

    if not invitation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invitation not found"
        )

    if invitation.is_expired:
        invitation.status = 'expired'
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="Invitation has expired"
        )

    if invitation.status != 'pending':
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invitation has already been {invitation.status}"
        )

    # Get user
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Verify invitation email matches user email (optional, for security)
    # Note: Users can accept invitations even if email doesn't match,
    # as they might have multiple email addresses

    try:
        # Create membership based on resource type
        if invitation.resource_type == "organization":
            # Add to organization
            add_organization_member(
                db=db,
                organization_id=invitation.resource_id,
                inviter_id=invitation.invited_by,
                invitee_id=user_id,
                role=invitation.invited_role
            )
        elif invitation.resource_type == "workspace":
            # Add to workspace
            add_workspace_member(
                db=db,
                workspace_id=invitation.resource_id,
                inviter_id=invitation.invited_by,
                invitee_id=user_id,
                role=invitation.invited_role
            )

        # Mark invitation as accepted
        invitation.mark_accepted(user_id)
        db.commit()
        db.refresh(invitation)

        # Send acceptance notification to inviter
        if invitation.invited_by:
            inviter = db.query(User).filter(User.id == invitation.invited_by).first()
            # Get inviter's email from AuthIdentity
            inviter_auth = db.query(AuthIdentity).filter(
                AuthIdentity.user_id == invitation.invited_by,
                AuthIdentity.provider == "email"
            ).first()

            if inviter and inviter_auth:
                # Get resource name
                if invitation.resource_type == "organization":
                    resource = db.query(Organization).filter(
                        Organization.id == invitation.resource_id
                    ).first()
                else:
                    resource = db.query(Workspace).filter(
                        Workspace.id == invitation.resource_id
                    ).first()

                resource_name = resource.name if resource else "Unknown"

                # Notify inviter with enhanced retry logic
                send_invitation_accepted_email_enhanced(
                    to_email=inviter_auth.provider_id,  # Inviter's email
                    accepter_email=invitation.email,  # Invitee's email
                    organization_name=resource_name,
                    role=invitation.invited_role,
                    resource_type=invitation.resource_type
                )

        return invitation

    except HTTPException:
        # Re-raise HTTP exceptions (e.g., from add_member functions)
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to accept invitation: {str(e)}"
        )


def reject_invitation(
    db: Session,
    token: str
) -> Invitation:
    """
    Reject an invitation.

    WHY: Allow users to decline invitation
    HOW: Mark invitation as 'rejected'

    Args:
        db: Database session
        token: Invitation token from URL

    Returns:
        Updated Invitation object

    Raises:
        HTTPException: If invitation not found or invalid
    """
    invitation = get_invitation_by_token(db, token)

    if not invitation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invitation not found"
        )

    if invitation.status != 'pending':
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invitation has already been {invitation.status}"
        )

    invitation.status = 'rejected'
    db.commit()
    db.refresh(invitation)

    return invitation


def cancel_invitation(
    db: Session,
    invitation_id: UUID,
    canceller_id: UUID
) -> Invitation:
    """
    Cancel a pending invitation.

    WHY: Allow admins to revoke invitations
    HOW: Mark invitation as 'cancelled'

    Args:
        db: Database session
        invitation_id: UUID of invitation to cancel
        canceller_id: UUID of user cancelling (must have permission)

    Returns:
        Updated Invitation object

    Raises:
        HTTPException: If invitation not found or no permission
    """
    invitation = db.query(Invitation).filter(Invitation.id == invitation_id).first()

    if not invitation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invitation not found"
        )

    # Verify permission to cancel
    if invitation.resource_type == "organization":
        verify_organization_permission(
            db=db,
            organization_id=invitation.resource_id,
            user_id=canceller_id,
            required_role="admin"
        )
    elif invitation.resource_type == "workspace":
        # Get workspace to retrieve organization_id
        workspace = db.query(Workspace).filter(Workspace.id == invitation.resource_id).first()
        if not workspace:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Workspace not found"
            )

        verify_workspace_permission(
            db=db,
            workspace_id=invitation.resource_id,
            organization_id=workspace.organization_id,
            user_id=canceller_id,
            required_role="admin"
        )

    if invitation.status != 'pending':
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot cancel invitation that is {invitation.status}"
        )

    invitation.mark_cancelled()
    db.commit()
    db.refresh(invitation)

    return invitation


def resend_invitation(
    db: Session,
    invitation_id: UUID,
    resender_id: UUID,
    frontend_url: str
) -> Invitation:
    """
    Resend invitation email (generates new token).

    WHY: User might not have received original email
    HOW: Generates new token, extends expiration, sends new email

    Args:
        db: Database session
        invitation_id: UUID of invitation to resend
        resender_id: UUID of user resending (must have permission)
        frontend_url: Frontend base URL for generating invitation link

    Returns:
        Updated Invitation object

    Raises:
        HTTPException: If invitation not found or no permission
    """
    invitation = db.query(Invitation).filter(Invitation.id == invitation_id).first()

    if not invitation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invitation not found"
        )

    # Verify permission to resend
    if invitation.resource_type == "organization":
        verify_organization_permission(
            db=db,
            organization_id=invitation.resource_id,
            user_id=resender_id,
            required_role="admin"
        )
    elif invitation.resource_type == "workspace":
        # Get workspace to retrieve organization_id
        workspace = db.query(Workspace).filter(Workspace.id == invitation.resource_id).first()
        if not workspace:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Workspace not found"
            )

        verify_workspace_permission(
            db=db,
            workspace_id=invitation.resource_id,
            organization_id=workspace.organization_id,
            user_id=resender_id,
            required_role="admin"
        )

    if invitation.status != 'pending':
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot resend invitation that is {invitation.status}"
        )

    # Generate new token and extend expiration
    invitation.token = _generate_invitation_token()
    invitation.expires_at = datetime.utcnow() + timedelta(days=7)
    db.commit()
    db.refresh(invitation)

    # Generate new invitation URL
    invitation_url = _generate_invitation_url(invitation.token, frontend_url)

    # Get resource name
    if invitation.resource_type == "organization":
        resource = db.query(Organization).filter(
            Organization.id == invitation.resource_id
        ).first()
    else:
        resource = db.query(Workspace).filter(
            Workspace.id == invitation.resource_id
        ).first()

    resource_name = resource.name if resource else "Unknown"

    # Get inviter name
    inviter = db.query(User).filter(User.id == invitation.invited_by).first()
    inviter_name = inviter.username if inviter else None

    # Resend email with enhanced retry logic
    send_invitation_email_enhanced(
        to_email=invitation.email,
        organization_name=resource_name,
        inviter_name=inviter_name,
        role=invitation.invited_role,
        invitation_url=invitation_url,
        resource_type=invitation.resource_type
    )

    return invitation


def list_invitations_for_resource(
    db: Session,
    resource_type: str,
    resource_id: UUID,
    user_id: UUID,
    status_filter: Optional[str] = None
) -> List[Invitation]:
    """
    List all invitations for a resource.

    WHY: Show pending/accepted invitations to admins
    HOW: Query by resource and optional status

    Args:
        db: Database session
        resource_type: 'organization' or 'workspace'
        resource_id: UUID of organization or workspace
        user_id: UUID of requesting user (must have permission)
        status_filter: Optional status to filter by ('pending', 'accepted', etc.)

    Returns:
        List of Invitation objects

    Raises:
        HTTPException: If no permission
    """
    # Verify permission
    if resource_type == "organization":
        verify_organization_permission(
            db=db,
            organization_id=resource_id,
            user_id=user_id,
            required_role="member"  # All members can see invitations
        )
    elif resource_type == "workspace":
        # Get workspace to retrieve organization_id
        workspace = db.query(Workspace).filter(Workspace.id == resource_id).first()
        if not workspace:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Workspace not found"
            )

        verify_workspace_permission(
            db=db,
            workspace_id=resource_id,
            organization_id=workspace.organization_id,
            user_id=user_id,
            required_role="viewer"  # All members can see invitations
        )

    # Build query
    query = db.query(Invitation).filter(
        Invitation.resource_type == resource_type,
        Invitation.resource_id == resource_id
    )

    # Apply status filter if provided
    if status_filter:
        query = query.filter(Invitation.status == status_filter)

    # Order by most recent first
    query = query.order_by(Invitation.invited_at.desc())

    return query.all()
