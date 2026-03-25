"""
OrganizationMember model - User membership in organization with role.

WHY:
- Define which users belong to which organizations
- Assign roles (owner, admin, member) for permissions
- Enable multi-org support (one user can be in many orgs)

HOW:
- Junction table between User and Organization
- Stores role for RBAC (Role-Based Access Control)
- Unique constraint prevents duplicate memberships

PSEUDOCODE:
-----------
class OrganizationMember(Base):
    __tablename__ = "organization_members"

    # Fields
    id: UUID (primary key, auto-generated)

    user_id: UUID (foreign key -> users.id, indexed, cascade delete)
        WHY: Which user this membership is for
        HOW: When user deleted, their memberships are deleted

    organization_id: UUID (foreign key -> organizations.id, indexed, cascade delete)
        WHY: Which organization this membership is in
        HOW: When org deleted, all memberships are deleted

    role: str (enum: 'owner', 'admin', 'member', required)
        WHY: Determines what user can do in this organization
        HOW: Used by permission_service to calculate permissions

        ROLES EXPLAINED:
        - 'owner': Full control
            * Delete organization
            * Manage all members and workspaces
            * Transfer ownership
            * Billing and settings

        - 'admin': Management permissions
            * Create/delete workspaces
            * Add/remove members (except owner)
            * Manage workspace access
            * Cannot delete org

        - 'member': Basic access
            * Access assigned workspaces
            * Cannot manage org or add users
            * Workspace permissions determined by WorkspaceMember role

    created_at: datetime (auto-set on creation)
    updated_at: datetime (auto-update on modification)

    # Constraints
    unique_constraint: (user_id, organization_id)
        WHY: User can only have one role per organization
        HOW: Database enforces this, prevents duplicate memberships
        EXAMPLE: User cannot be both 'admin' and 'member' in same org

    # Relationships
    user: User (many-to-one back reference)
        WHY: Access user details from membership

    organization: Organization (many-to-one back reference)
        WHY: Access org details from membership

PERMISSION CALCULATION:
-----------------------
WHY: JWT needs to know user's permissions in current org
HOW: When creating JWT or switching org context:
    1. Query this table for user's role in selected org
    2. Map role to permissions (permission_service.py)
    3. Store in JWT perms field

EXAMPLE:
    user_id=123, organization_id=456, role='admin'
    Permissions: {
        "org:read": true,
        "org:write": true,
        "workspace:create": true,
        "workspace:delete": true,
        "member:invite": true,
        "org:delete": false  # Only owner can delete org
    }
"""

# ACTUAL IMPLEMENTATION
from sqlalchemy import Column, String, DateTime, ForeignKey, UniqueConstraint, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.db.base_class import Base
import uuid
from datetime import datetime


class OrganizationMember(Base):
    """
    OrganizationMember - Junction table for user membership in organizations with roles.

    Enables multi-org support where one user can belong to multiple organizations
    with different roles in each.

    Roles: owner, admin, member
    """
    __tablename__ = "organization_members"

    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Foreign keys
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    organization_id = Column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    # Role (owner | admin | member)
    role = Column(String(50), nullable=False, index=True)
    # role values: 'owner', 'admin', 'member'

    # Invitation tracking
    invited_by = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True
    )

    # Timestamps
    joined_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Constraints
    __table_args__ = (
        UniqueConstraint('user_id', 'organization_id', name='uq_user_organization'),
        Index('idx_orgmember_user', 'user_id'),
        Index('idx_orgmember_org', 'organization_id'),
        Index('idx_orgmember_role', 'role'),
    )

    # Relationships
    user = relationship("User", foreign_keys=[user_id], back_populates="organization_memberships")
    organization = relationship("Organization", back_populates="members")
    inviter = relationship("User", foreign_keys=[invited_by])

    def __repr__(self):
        return f"<OrganizationMember(user_id={self.user_id}, org_id={self.organization_id}, role={self.role})>"

    @property
    def is_owner(self) -> bool:
        """Check if this member is an owner"""
        return self.role == 'owner'

    @property
    def is_admin(self) -> bool:
        """Check if this member is an admin or owner"""
        return self.role in ['owner', 'admin']

    @property
    def can_manage_members(self) -> bool:
        """Check if this member can manage other members"""
        return self.role in ['owner', 'admin']

    @property
    def can_manage_workspaces(self) -> bool:
        """Check if this member can create/delete workspaces"""
        return self.role in ['owner', 'admin']

    @property
    def can_delete_organization(self) -> bool:
        """Check if this member can delete the organization"""
        return self.role == 'owner'

    @property
    def can_manage_billing(self) -> bool:
        """Check if this member can manage billing and subscriptions"""
        return self.role == 'owner'
