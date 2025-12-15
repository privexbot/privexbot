"""
Workspace model - Subdivision within an organization.

WHY:
- Organize resources within an organization (e.g., "Engineering", "Marketing")
- Finer-grained access control than organization level
- Separate chatbots by department or project

HOW:
- Lives within an organization (must have organization_id)
- Users access workspaces via WorkspaceMember with roles
- Contains chatbots and other resources

PSEUDOCODE:
-----------
class Workspace(Base):
    __tablename__ = "workspaces"

    # Fields
    id: UUID (primary key, auto-generated)
        WHY: Unique identifier for this workspace
        HOW: Used in JWT as ws_id for workspace context

    name: str (workspace name, required)
        WHY: Human-readable workspace name
        EXAMPLE: "Customer Support Bots", "Sales Team"

    organization_id: UUID (foreign key -> organizations.id, indexed, cascade delete)
        WHY: CRITICAL - Links workspace to parent organization for tenancy
        HOW: Indexed for fast queries, required field, cannot be null
        TENANT ISOLATION: All workspace operations must verify org_id matches user's org

    created_by: UUID (foreign key -> users.id, nullable)
        WHY: Track who created this workspace

    created_at: datetime (auto-set on creation)
    updated_at: datetime (auto-update on modification)

    # Relationships
    organization: Organization (many-to-one back reference)
        WHY: Access parent organization from workspace
        HOW: workspace.organization.name

    creator: User (many-to-one)
        WHY: Reference to user who created workspace

    members: list[WorkspaceMember] (one-to-many, cascade delete)
        WHY: All users who have access to this workspace
        HOW: When workspace deleted, all memberships deleted

    chatbots: list[Chatbot] (one-to-many, cascade delete)
        WHY: All simple chatbots in this workspace
        HOW: When workspace deleted, all chatbots deleted

    chatflows: list[Chatflow] (one-to-many, cascade delete)
        WHY: All advanced workflow chatflows in this workspace
        HOW: When workspace deleted, all chatflows deleted
        NOTE: Chatflows are SEPARATE from chatbots - different model/table

    knowledge_bases: list[KnowledgeBase] (one-to-many, cascade delete)
        WHY: All knowledge bases in this workspace
        HOW: When workspace deleted, all KBs (and their documents/chunks) deleted
        NOTE: Single KB can be accessed by multiple chatbots/chatflows via context settings
        DESIGN: No association table - KB has context_settings that control bot access

PERMISSION FLOW:
----------------
WHY: User needs proper access to view/edit workspace
HOW:
    1. Check user is member of parent organization
    2. Check user is member of this workspace OR is org admin/owner
    3. Check role in WorkspaceMember for specific permissions

EXAMPLE:
    User A in Organization X, Workspace Y:
    - Can access Workspace Y's chatbots and chatflows
    - Cannot access Workspace Z's chatbots/chatflows (even in same org)
    - Unless User A is org admin/owner (can access all workspaces)

RESOURCE TYPES IN WORKSPACE:
-----------------------------
- Chatbots: Simple form-based bots (FAQ, knowledge base)
- Chatflows: Advanced drag-and-drop workflow bots (multi-step, API integration)
- Knowledge Bases: RAG knowledge storage (documents, chunks, embeddings)
- All are separate tables/models with separate APIs

KNOWLEDGE BASE ACCESS PATTERN:
-------------------------------
WHY: Single KB can be shared across multiple bots
HOW: Bot config contains KB references, KB has context_settings for access control

EXAMPLE:
    Workspace has:
        - KB1 ("Product Docs")
        - Chatbot1 (uses KB1)
        - Chatbot2 (uses KB1)
        - Chatflow1 (uses KB1)

    KB1.context_settings = {
        "access_mode": "all",  # All bots in workspace can access
        "retrieval_config": {"top_k": 5}
    }

    Chatbot1.config = {
        "knowledge_bases": [
            {
                "kb_id": "KB1_id",
                "enabled": true,
                "override_retrieval": {"top_k": 3}  # Bot-specific override
            }
        ]
    }
"""

# ACTUAL IMPLEMENTATION
from sqlalchemy import Column, String, Text, DateTime, Boolean, ForeignKey, UniqueConstraint, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.db.base_class import Base
import uuid
from datetime import datetime


class Workspace(Base):
    """
    Workspace model - Subdivision within an organization.

    Workspaces organize resources (chatbots, chatflows, knowledge bases) within an organization.
    Each workspace has its own members with specific roles (admin, editor, viewer).

    Examples: "Customer Support", "Marketing", "Sales", "Engineering"
    """
    __tablename__ = "workspaces"

    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Parent organization (CRITICAL for tenancy)
    organization_id = Column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    # Workspace info
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    avatar_url = Column(String(512), nullable=True)  # Optional workspace avatar/logo URL

    # Workspace settings (JSONB for flexibility)
    settings = Column(JSONB, nullable=False, default=dict, server_default='{}')
    # settings structure:
    # {
    #     "theme": {"color": "#3B82F6", "icon": "briefcase"},
    #     "defaults": {"chatbot_model": "secret-ai-v1", "enable_analytics": true},
    #     "integrations": {"slack_channel": "#support", "webhook_url": "https://..."}
    # }

    # Default workspace flag (each org has one default workspace)
    is_default = Column(Boolean, nullable=False, default=False)

    # Creator tracking
    created_by = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True
    )

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Constraints
    __table_args__ = (
        UniqueConstraint('organization_id', 'name', name='uq_workspace_org_name'),
        Index('idx_workspace_org', 'organization_id'),
        Index('idx_workspace_created_by', 'created_by'),
    )

    # Relationships
    organization = relationship("Organization", back_populates="workspaces")
    creator = relationship("User", foreign_keys=[created_by])

    members = relationship(
        "WorkspaceMember",
        back_populates="workspace",
        cascade="all, delete-orphan",
        lazy="dynamic"
    )

    # Resources in this workspace
    # NOTE: These relationships will be defined when the models exist
    # chatbots = relationship("Chatbot", back_populates="workspace", cascade="all, delete-orphan")
    # chatflows = relationship("Chatflow", back_populates="workspace", cascade="all, delete-orphan")
    knowledge_bases = relationship("KnowledgeBase", back_populates="workspace", cascade="all, delete-orphan")
    # leads = relationship("Lead", back_populates="workspace", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Workspace(id={self.id}, name={self.name}, org_id={self.organization_id})>"

    @property
    def member_count(self) -> int:
        """Get count of workspace members"""
        return self.members.count()

    @property
    def resource_count(self) -> dict:
        """Get count of resources in workspace (when relationships defined)"""
        return {
            "chatbots": 0,  # Will be len(self.chatbots) when defined
            "chatflows": 0,  # Will be len(self.chatflows) when defined
            "knowledge_bases": 0,  # Will be len(self.knowledge_bases) when defined
            "leads": 0  # Will be len(self.leads) when defined
        }
