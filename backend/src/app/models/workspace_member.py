"""
WorkspaceMember model - User membership in workspace with role.

WHY:
- Fine-grained access control within workspaces
- Not all org members need access to all workspaces
- Separate permissions for different teams/projects

HOW:
- Junction table between User and Workspace
- User must be org member to be workspace member
- Role determines what user can do in this workspace

PSEUDOCODE:
-----------
class WorkspaceMember(Base):
    __tablename__ = "workspace_members"

    # Fields
    id: UUID (primary key, auto-generated)

    user_id: UUID (foreign key -> users.id, indexed, cascade delete)
        WHY: Which user has access to this workspace
        HOW: When user deleted, their workspace access is removed

    workspace_id: UUID (foreign key -> workspaces.id, indexed, cascade delete)
        WHY: Which workspace this membership grants access to
        HOW: When workspace deleted, all memberships deleted

    role: str (enum: 'admin', 'editor', 'viewer', required)
        WHY: Determines user's permissions in this workspace
        HOW: Used to control chatbot create/edit/delete operations

        ROLES EXPLAINED:
        - 'admin': Full workspace control
            * Create/edit/delete chatbots
            * Manage workspace members
            * Edit workspace settings
            * View all workspace data

        - 'editor': Content management
            * Create/edit chatbots
            * Cannot delete chatbots
            * Cannot manage members
            * View workspace data

        - 'viewer': Read-only access
            * View chatbots and configurations
            * Cannot create or edit
            * Cannot manage members
            * Good for stakeholders/observers

    created_at: datetime (auto-set on creation)
    updated_at: datetime (auto-update on modification)

    # Constraints
    unique_constraint: (user_id, workspace_id)
        WHY: User can only have one role per workspace
        HOW: Prevents conflicting permissions

    # Relationships
    user: User (many-to-one back reference)
        WHY: Access user details

    workspace: Workspace (many-to-one back reference)
        WHY: Access workspace and parent org details

PERMISSION HIERARCHY:
---------------------
WHY: Org admins/owners should access all workspaces
HOW: Check permissions in this order:
    1. If user is org 'owner' or 'admin' -> grant admin access to workspace
    2. Else check WorkspaceMember role for this workspace
    3. If no WorkspaceMember entry -> no access

EXAMPLE ACCESS CONTROL:
-----------------------
Scenario: User wants to delete chatbot in Workspace X

Check 1: Is user active?
Check 2: Get user's org role from OrganizationMember
    - If 'owner' or 'admin' -> ALLOW (org admins can do anything)

Check 3: Get user's workspace role from WorkspaceMember
    - If 'admin' -> ALLOW
    - If 'editor' or 'viewer' -> DENY
    - If no entry -> DENY

VALIDATION RULES:
-----------------
WHY: User must be org member before becoming workspace member
HOW: Before creating WorkspaceMember:
    1. Get workspace.organization_id
    2. Verify OrganizationMember exists for (user_id, organization_id)
    3. If not -> reject with error "Must be organization member first"
"""

# ACTUAL IMPLEMENTATION
from sqlalchemy import Column, String, DateTime, ForeignKey, UniqueConstraint, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.db.base_class import Base
import uuid
from datetime import datetime


class WorkspaceMember(Base):
    """
    WorkspaceMember - Junction table for user membership in workspaces with roles.

    Provides fine-grained access control within workspaces.
    Users must be organization members before they can be workspace members.

    Roles: admin, editor, viewer
    """
    __tablename__ = "workspace_members"

    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Foreign keys
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    workspace_id = Column(
        UUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    # Role (admin | editor | viewer)
    role = Column(String(50), nullable=False, index=True)
    # role values: 'admin', 'editor', 'viewer'

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
        UniqueConstraint('user_id', 'workspace_id', name='uq_user_workspace'),
        Index('idx_wsmember_user', 'user_id'),
        Index('idx_wsmember_workspace', 'workspace_id'),
        Index('idx_wsmember_role', 'role'),
    )

    # Relationships
    user = relationship("User", foreign_keys=[user_id], back_populates="workspace_memberships")
    workspace = relationship("Workspace", back_populates="members")
    inviter = relationship("User", foreign_keys=[invited_by])

    def __repr__(self):
        return f"<WorkspaceMember(user_id={self.user_id}, workspace_id={self.workspace_id}, role={self.role})>"

    @property
    def is_admin(self) -> bool:
        """Check if this member is a workspace admin"""
        return self.role == 'admin'

    @property
    def can_edit(self) -> bool:
        """Check if this member can edit resources"""
        return self.role in ['admin', 'editor']

    @property
    def can_delete(self) -> bool:
        """Check if this member can delete resources"""
        return self.role == 'admin'

    @property
    def can_manage_members(self) -> bool:
        """Check if this member can manage workspace members"""
        return self.role == 'admin'

    @property
    def is_viewer(self) -> bool:
        """Check if this member is a viewer (read-only)"""
        return self.role == 'viewer'

    def has_permission(self, permission: str) -> bool:
        """
        Check if member has specific permission based on role.

        Permission hierarchy:
        - admin: all permissions
        - editor: read, create, edit (no delete, no manage_members)
        - viewer: read only

        Args:
            permission: One of 'read', 'create', 'edit', 'delete', 'manage_members'

        Returns:
            True if role has permission, False otherwise
        """
        permission_map = {
            'admin': ['read', 'create', 'edit', 'delete', 'manage_members'],
            'editor': ['read', 'create', 'edit'],
            'viewer': ['read']
        }

        allowed_permissions = permission_map.get(self.role, [])
        return permission in allowed_permissions
