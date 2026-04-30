"""
User model - Core user identity independent of authentication method.

WHY:
- Separates user identity from authentication methods
- Allows one user to have multiple login methods (email + multiple wallets)
- Central point for all user-related data and permissions

HOW:
- User is created when first authentication happens
- Links to auth_identities for different login methods
- Tracks memberships in organizations and workspaces

PSEUDOCODE:
-----------
class User(Base):
    __tablename__ = "users"

    # Fields
    id: UUID (primary key, auto-generated)
        WHY: Unique identifier, never changes even if username changes

    username: str (unique, indexed)
        WHY: Human-readable identifier, can be email or custom name
        HOW: Must be unique across all users

    is_active: bool (default: True)
        WHY: Soft delete - disable users without deleting their data
        HOW: Check this before allowing login or operations

    created_at: datetime (auto-set on creation)
    updated_at: datetime (auto-update on modification)

    # Relationships
    auth_identities: list[AuthIdentity] (one-to-many, cascade delete)
        WHY: One user can log in via email, MetaMask, Phantom, etc.
        HOW: When user deleted, all auth methods are deleted too
    organization_memberships: list[OrganizationMember] (one-to-many)
        WHY: Track which orgs this user belongs to and their roles

    workspace_memberships: list[WorkspaceMember] (one-to-many)
        WHY: Track which workspaces this user can access

    created_organizations: list[Organization] (one-to-many)
    created_workspaces: list[Workspace] (one-to-many)
    created_chatbots: list[Chatbot] (one-to-many)
    created_chatflows: list[Chatflow] (one-to-many)
        WHY: Track audit trail of who created what
        NOTE: Chatbots and chatflows are SEPARATE entities
"""

# ACTUAL IMPLEMENTATION
from sqlalchemy import Column, String, Boolean, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.db.base_class import Base
import uuid
from datetime import datetime


class User(Base):
    """
    User model - Independent of authentication method

    One user can have multiple auth methods (email + wallets)
    """
    __tablename__ = "users"

    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # User info
    username = Column(String(255), unique=True, nullable=False, index=True)
    avatar_url = Column(String(512), nullable=True)  # Optional user avatar/profile image URL
    is_active = Column(Boolean, default=True, nullable=False)
    is_staff = Column(Boolean, default=False, server_default="false", nullable=False)  # Staff access for backoffice
    has_beta_access = Column(Boolean, default=False, server_default="false", nullable=False)  # Beta tester access

    # Public referral code — generated lazily on first read of /referrals/me.
    # Unique across all users; nullable to keep the migration trivial for
    # existing rows.
    referral_code = Column(String(32), unique=True, nullable=True, index=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    auth_identities = relationship(
        "AuthIdentity",
        back_populates="user",
        cascade="all, delete-orphan"
    )

    # Organization and Workspace memberships
    # These need explicit cascade to properly delete when user is deleted
    organization_memberships = relationship(
        "OrganizationMember",
        foreign_keys="OrganizationMember.user_id",
        cascade="all, delete-orphan",
        passive_deletes=True
    )

    workspace_memberships = relationship(
        "WorkspaceMember",
        foreign_keys="WorkspaceMember.user_id",
        cascade="all, delete-orphan",
        passive_deletes=True
    )

    def __repr__(self):
        return f"<User(id={self.id}, username={self.username})>"