"""
KBMember model - User membership in Knowledge Base with role-based access control.

WHY:
- Fine-grained access control for Knowledge Bases
- Share KB with specific users without workspace access
- Different permission levels for collaboration
- Track who can view/edit/manage each KB

HOW:
- Junction table between User and KnowledgeBase
- User must have workspace access to be KB member
- Role determines what user can do with this KB

PSEUDOCODE:
-----------
class KBMember(Base):
    __tablename__ = "kb_members"

    # Fields
    id: UUID (primary key, auto-generated)

    user_id: UUID (foreign key -> users.id, indexed, cascade delete)
        WHY: Which user has access to this KB
        HOW: When user deleted, their KB access is removed

    kb_id: UUID (foreign key -> knowledge_bases.id, indexed, cascade delete)
        WHY: Which KB this membership grants access to
        HOW: When KB deleted, all memberships deleted

    role: str (enum: 'admin', 'editor', 'viewer', required)
        WHY: Determines user's permissions for this KB
        HOW: Used to control KB view/edit/delete/reindex operations

        ROLES EXPLAINED:
        - 'admin': Full KB control
            * View KB and stats
            * Edit KB configuration
            * Delete KB
            * Re-index KB
            * Manage KB members
            * View analytics

        - 'editor': Content management
            * View KB and stats
            * Edit KB configuration
            * Re-index KB
            * Cannot delete KB
            * Cannot manage members
            * View analytics

        - 'viewer': Read-only access
            * View KB and stats
            * View analytics
            * Cannot edit or delete
            * Cannot manage members
            * Good for stakeholders/observers

    created_at: datetime (auto-set on creation)
    updated_at: datetime (auto-update on modification)

    # Constraints
    unique_constraint: (user_id, kb_id)
        WHY: User can only have one role per KB
        HOW: Prevents conflicting permissions

    # Relationships
    user: User (many-to-one back reference)
        WHY: Access user details

    kb: KnowledgeBase (many-to-one back reference)
        WHY: Access KB and workspace details

PERMISSION HIERARCHY:
---------------------
WHY: KB creator and workspace admins should have full access
HOW: Check permissions in this order:
    1. If user is KB creator (kb.created_by) -> grant admin access
    2. If user is workspace admin -> grant admin access
    3. Else check KBMember role for this KB
    4. If no KBMember entry -> no access

EXAMPLE ACCESS CONTROL:
-----------------------
Scenario: User wants to delete KB X

Check 1: Is user active?
Check 2: Is user the KB creator (kb.created_by)?
    - If yes -> ALLOW

Check 3: Get user's workspace role from WorkspaceMember
    - If 'admin' -> ALLOW (workspace admins can manage all KBs)

Check 4: Get user's KB role from KBMember
    - If 'admin' -> ALLOW
    - If 'editor' or 'viewer' -> DENY
    - If no entry -> DENY

VALIDATION RULES:
-----------------
WHY: User must have workspace access before becoming KB member
HOW: Before creating KBMember:
    1. Get kb.workspace_id
    2. Verify user has workspace access (WorkspaceMember or org admin)
    3. If not -> reject with error "Must have workspace access first"
"""

# ACTUAL IMPLEMENTATION
from sqlalchemy import Column, String, DateTime, ForeignKey, UniqueConstraint, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.db.base_class import Base
import uuid
from datetime import datetime


class KBMember(Base):
    """
    KBMember - Junction table for user membership in Knowledge Bases with roles.

    Provides fine-grained access control for Knowledge Bases.
    Users must have workspace access before they can be KB members.

    Roles: admin, editor, viewer
    """
    __tablename__ = "kb_members"

    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Foreign keys
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    kb_id = Column(
        UUID(as_uuid=True),
        ForeignKey("knowledge_bases.id", ondelete="CASCADE"),
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
        UniqueConstraint('user_id', 'kb_id', name='uq_user_kb'),
        Index('idx_kbmember_user', 'user_id'),
        Index('idx_kbmember_kb', 'kb_id'),
        Index('idx_kbmember_role', 'role'),
    )

    # Relationships
    user = relationship("User", foreign_keys=[user_id], backref="kb_memberships")
    kb = relationship("KnowledgeBase", back_populates="members")
    inviter = relationship("User", foreign_keys=[invited_by])

    def __repr__(self):
        return f"<KBMember(user_id={self.user_id}, kb_id={self.kb_id}, role={self.role})>"

    @property
    def is_admin(self) -> bool:
        """Check if this member is a KB admin"""
        return self.role == 'admin'

    @property
    def can_edit(self) -> bool:
        """Check if this member can edit KB configuration"""
        return self.role in ['admin', 'editor']

    @property
    def can_delete(self) -> bool:
        """Check if this member can delete KB"""
        return self.role == 'admin'

    @property
    def can_manage_members(self) -> bool:
        """Check if this member can manage KB members"""
        return self.role == 'admin'

    @property
    def can_reindex(self) -> bool:
        """Check if this member can trigger re-indexing"""
        return self.role in ['admin', 'editor']

    @property
    def is_viewer(self) -> bool:
        """Check if this member is a viewer (read-only)"""
        return self.role == 'viewer'

    def has_permission(self, permission: str) -> bool:
        """
        Check if member has specific permission based on role.

        Permission hierarchy:
        - admin: all permissions
        - editor: read, edit, reindex (no delete, no manage_members)
        - viewer: read only

        Args:
            permission: One of 'read', 'edit', 'delete', 'reindex', 'manage_members', 'view_analytics'

        Returns:
            True if role has permission, False otherwise
        """
        permission_map = {
            'admin': ['read', 'edit', 'delete', 'reindex', 'manage_members', 'view_analytics'],
            'editor': ['read', 'edit', 'reindex', 'view_analytics'],
            'viewer': ['read', 'view_analytics']
        }

        allowed_permissions = permission_map.get(self.role, [])
        return permission in allowed_permissions
