"""
Invitation model - Email-based invitations to organizations and workspaces.

WHY:
- Enable user-friendly invitations via email instead of requiring UUIDs
- Provide consent/acceptance flow for joining organizations/workspaces
- Track invitation status and expiration
- Send email notifications to invited users

HOW:
- Store pending invitations with secure tokens
- Link to resource (organization or workspace)
- Generate unique invitation links
- Expire after 7 days by default
- Track acceptance/rejection

PSEUDOCODE:
-----------
class Invitation(Base):
    __tablename__ = "invitations"

    # Fields
    id: UUID (primary key, auto-generated)

    resource_type: str ('organization' or 'workspace')
        WHY: Know what the user is being invited to

    resource_id: UUID
        WHY: The org_id or workspace_id

    email: str (required, indexed)
        WHY: Who to invite (email-based, not user_id)
        HOW: User might not exist yet

    invited_role: str (required)
        WHY: What role they'll have when accepted
        VALUES: For orgs: owner/admin/member
                For workspaces: admin/editor/viewer

    status: str (default='pending', indexed)
        WHY: Track invitation lifecycle
        VALUES: pending, accepted, rejected, expired, cancelled

    token: str (unique, indexed)
        WHY: Secure random token for invitation URL
        HOW: Generated via secrets.token_urlsafe(32)

    invited_by: UUID (foreign key -> users.id)
        WHY: Track who sent the invitation

    invited_at: datetime (auto-set)
    expires_at: datetime (default=7 days from now)
        WHY: Invitations should not be valid forever

    accepted_at: datetime (nullable)
    accepted_by_user_id: UUID (nullable)
        WHY: Track when/who accepted

USAGE FLOW:
-----------
1. Admin invites user by email
2. System creates Invitation record with token
3. System sends email with invitation link
4. User clicks link (unauthenticated page)
5. User sees invitation details and accepts
6. System creates OrganizationMember/WorkspaceMember
7. System marks invitation as 'accepted'
8. User gains access to resource

EXPIRATION:
-----------
- Invitations expire after 7 days
- Expired invitations cannot be accepted
- Can resend invitation (creates new token)
"""

# ACTUAL IMPLEMENTATION
from sqlalchemy import Column, String, DateTime, ForeignKey, Index, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.db.base_class import Base
import uuid
from datetime import datetime, timedelta


class Invitation(Base):
    """
    Invitation - Email-based invitations to organizations and workspaces.

    Enables proper invitation flow:
    1. Invite by email (not UUID)
    2. Send email notification
    3. User accepts/rejects
    4. Membership created on acceptance
    """
    __tablename__ = "invitations"

    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Resource identification
    resource_type = Column(
        String(50),
        nullable=False,
        index=True
    )
    # resource_type values: 'organization', 'workspace'

    resource_id = Column(
        UUID(as_uuid=True),
        nullable=False,
        index=True
    )
    # resource_id is organization_id or workspace_id depending on resource_type

    # Invitee information
    email = Column(
        String(255),
        nullable=False,
        index=True
    )
    # Email of person being invited (may not have account yet)

    invited_role = Column(
        String(50),
        nullable=False
    )
    # Role to assign when invitation is accepted
    # For organizations: 'owner', 'admin', 'member'
    # For workspaces: 'admin', 'editor', 'viewer'

    # Invitation status
    status = Column(
        String(50),
        nullable=False,
        default='pending',
        index=True
    )
    # status values: 'pending', 'accepted', 'rejected', 'expired', 'cancelled'

    # Security token for invitation URL
    token = Column(
        String(255),
        nullable=False,
        unique=True,
        index=True
    )
    # Secure random token generated via secrets.token_urlsafe(32)

    # Invitation metadata
    invited_by = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True
    )
    # Who sent the invitation

    # Timestamps
    invited_at = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    expires_at = Column(
        DateTime,
        nullable=False
    )
    # Default: 7 days from invited_at

    accepted_at = Column(
        DateTime,
        nullable=True
    )
    # Set when invitation is accepted

    accepted_by_user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True
    )
    # User who accepted (might be different if email matches existing user)

    created_at = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False
    )

    # Constraints
    __table_args__ = (
        CheckConstraint(
            "resource_type IN ('organization', 'workspace')",
            name='check_resource_type'
        ),
        CheckConstraint(
            "status IN ('pending', 'accepted', 'rejected', 'expired', 'cancelled')",
            name='check_status'
        ),
        Index('idx_invitation_email', 'email'),
        Index('idx_invitation_token', 'token'),
        Index('idx_invitation_status', 'status'),
        Index('idx_invitation_resource', 'resource_type', 'resource_id'),
    )

    # Relationships
    inviter = relationship("User", foreign_keys=[invited_by], backref="sent_invitations")
    accepter = relationship("User", foreign_keys=[accepted_by_user_id], backref="accepted_invitations")

    def __repr__(self):
        return f"<Invitation(email={self.email}, resource_type={self.resource_type}, status={self.status})>"

    @property
    def is_pending(self) -> bool:
        """Check if invitation is pending"""
        return self.status == 'pending'

    @property
    def is_accepted(self) -> bool:
        """Check if invitation has been accepted"""
        return self.status == 'accepted'

    @property
    def is_expired(self) -> bool:
        """Check if invitation has expired"""
        if self.status == 'expired':
            return True
        if self.status == 'pending' and self.expires_at < datetime.utcnow():
            return True
        return False

    @property
    def can_be_accepted(self) -> bool:
        """Check if invitation can still be accepted"""
        return self.status == 'pending' and not self.is_expired

    def mark_accepted(self, user_id: uuid.UUID):
        """Mark invitation as accepted"""
        self.status = 'accepted'
        self.accepted_at = datetime.utcnow()
        self.accepted_by_user_id = user_id

    def mark_expired(self):
        """Mark invitation as expired"""
        self.status = 'expired'

    def mark_cancelled(self):
        """Mark invitation as cancelled"""
        self.status = 'cancelled'
