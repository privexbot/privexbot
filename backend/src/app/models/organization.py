"""
Organization model - Top-level tenant entity.

WHY:
- Multi-tenancy: Isolate data between different companies/teams
- Top level in hierarchy: Organization -> Workspace -> Chatbot
- One user can belong to multiple organizations

HOW:
- Each organization is a separate tenant
- Users join organizations via OrganizationMember with roles
- Organizations contain workspaces which contain chatbots

PSEUDOCODE:
-----------
class Organization(Base):
    __tablename__ = "organizations"

    # Fields
    id: UUID (primary key, auto-generated)
        WHY: Unique identifier for this organization
        HOW: Used in JWT as org_id for tenant context

    name: str (organization name, required)
        WHY: Human-readable organization name
        EXAMPLE: "Acme Corp", "Engineering Team"

    created_by: UUID (foreign key -> users.id, nullable)
        WHY: Track who created this organization (usually becomes owner)
        HOW: First user to create org gets 'owner' role in OrganizationMember

    created_at: datetime (auto-set on creation)
    updated_at: datetime (auto-update on modification)

    # Relationships
    creator: User (many-to-one)
        WHY: Reference to the user who created this org

    members: list[OrganizationMember] (one-to-many, cascade delete)
        WHY: All users who belong to this organization
        HOW: When org deleted, all memberships are deleted

    workspaces: list[Workspace] (one-to-many, cascade delete)
        WHY: Subdivisions within this organization
        HOW: When org deleted, all workspaces (and their chatbots) are deleted

TENANT ISOLATION:
-----------------
WHY: Ensure Organization A cannot access Organization B's data
HOW: All queries must filter by org_id from JWT
EXAMPLE:
    # Get chatbots for current org
    chatbots = db.query(Chatbot)
        .join(Workspace)
        .join(Organization)
        .filter(Organization.id == current_user.org_id)
        .all()
"""

from sqlalchemy import Column, String, DateTime, ForeignKey, Index, Boolean
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.db.base_class import Base
import uuid
from datetime import datetime, timedelta


class Organization(Base):
    """
    Organization model - Top-level tenant entity for multi-tenancy.

    Organizations contain workspaces, which contain chatbots/chatflows and knowledge bases.
    Users belong to organizations via OrganizationMember with roles.

    Subscription Tiers: free, starter, pro, enterprise
    Subscription Status: trial, active, cancelled, suspended
    """
    __tablename__ = "organizations"

    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Organization info
    name = Column(String(255), nullable=False)
    billing_email = Column(String(255), nullable=False, index=True)
    avatar_url = Column(String(512), nullable=True)  # Optional organization avatar/logo URL

    # Subscription management
    subscription_tier = Column(
        String(50),
        nullable=False,
        default='free',
        index=True
    )
    # subscription_tier values: 'free', 'starter', 'pro', 'enterprise'

    subscription_status = Column(
        String(50),
        nullable=False,
        default='trial'
    )
    # subscription_status values: 'trial', 'active', 'cancelled', 'suspended'

    trial_ends_at = Column(DateTime, nullable=True)  # When trial expires
    subscription_starts_at = Column(DateTime, nullable=True)  # When paid subscription started
    subscription_ends_at = Column(DateTime, nullable=True)  # For cancelled subscriptions

    # Organization settings (JSONB for flexibility)
    settings = Column(JSONB, nullable=False, default=dict, server_default='{}')
    # settings structure:
    # {
    #     "branding": {"logo_url": "...", "primary_color": "#..."},
    #     "defaults": {"default_model": "secret-ai-v1", "default_temperature": 0.7},
    #     "features": {"analytics_enabled": true}
    # }

    # Default organization flag (user's personal organization created at signup)
    is_default = Column(Boolean, nullable=False, default=False)

    # Creator tracking
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    creator = relationship("User", foreign_keys=[created_by])

    members = relationship(
        "OrganizationMember",
        back_populates="organization",
        cascade="all, delete-orphan",
        lazy="dynamic"
    )

    workspaces = relationship(
        "Workspace",
        back_populates="organization",
        cascade="all, delete-orphan",
        lazy="dynamic"
    )

    def __repr__(self):
        return f"<Organization(id={self.id}, name={self.name}, tier={self.subscription_tier})>"

    @property
    def is_trial(self) -> bool:
        """Check if organization is in trial period"""
        return self.subscription_status == 'trial'

    @property
    def is_active(self) -> bool:
        """Check if organization has active subscription"""
        return self.subscription_status in ['trial', 'active']

    @property
    def is_trial_expired(self) -> bool:
        """Check if trial period has expired"""
        if self.subscription_status != 'trial':
            return False
        if not self.trial_ends_at:
            return False
        return datetime.utcnow() > self.trial_ends_at

    def set_trial_period(self, days: int = 30):
        """Set trial period for organization"""
        self.subscription_status = 'trial'
        self.trial_ends_at = datetime.utcnow() + timedelta(days=days)

    @property
    def member_count(self) -> int:
        """Get count of organization members"""
        return self.members.count()

    @property
    def workspace_count(self) -> int:
        """Get count of workspaces in organization"""
        return self.workspaces.count()
