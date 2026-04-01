"""
Slack Workspace Deployment model - Maps Slack workspaces to chatbots for shared bot architecture.

WHY:
- Shared bot architecture: ONE Slack app serves ALL customers
- Multiple Slack workspaces (teams) -> different chatbots
- Team ID routing determines which chatbot handles each message
- Enables multi-tenant Slack deployment without per-customer Slack apps

HOW:
- Maps team_id -> chatbot_id
- Supports channel restrictions (only respond in specific channels)
- Tracks deployment status and metadata
- Isolated by workspace for multi-tenancy

Architecture:
- Shared Slack App receives event with team_id
- Lookup SlackWorkspaceDeployment by team_id
- Route to correct chatbot for AI processing
- Return response via chat.postMessage
"""

from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.db.base_class import Base
import uuid
from datetime import datetime


class SlackWorkspaceDeployment(Base):
    """
    Maps Slack workspace to chatbot for shared bot architecture.

    One-to-one: Each workspace can only be mapped to ONE chatbot
    Many-to-one: Multiple workspaces can map to the SAME chatbot

    Examples:
    - Team "Acme Corp" -> Customer Support Bot
    - Team "Beta Testers" -> Customer Support Bot (same bot, different team)
    - Team "Sales HQ" -> Sales Assistant Bot (different bot)
    """
    __tablename__ = "slack_workspace_deployments"

    # ═══════════════════════════════════════════════════════════════
    # IDENTITY
    # ═══════════════════════════════════════════════════════════════
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # ═══════════════════════════════════════════════════════════════
    # TENANT ISOLATION (CRITICAL)
    # ═══════════════════════════════════════════════════════════════
    workspace_id = Column(
        UUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    # CRITICAL: Every deployment belongs to exactly one workspace
    # CASCADE: When workspace deleted, deployments are deleted

    # ═══════════════════════════════════════════════════════════════
    # SLACK IDENTIFIERS
    # ═══════════════════════════════════════════════════════════════
    team_id = Column(
        String(100),
        nullable=False,
        unique=True,  # One chatbot per Slack workspace (globally)
        index=True
    )
    # Slack workspace ID (e.g., "T0123456789")
    # UNIQUE: Ensures one chatbot per Slack workspace

    team_name = Column(String(200), nullable=True)
    # Cached workspace name for display purposes
    # Updated when deployment is created/modified

    team_domain = Column(String(200), nullable=True)
    # Slack workspace domain (e.g., "acme-corp")

    team_icon = Column(String(500), nullable=True)
    # Cached workspace icon URL for display

    # ═══════════════════════════════════════════════════════════════
    # BOT TOKEN (per-workspace, obtained via OAuth install)
    # ═══════════════════════════════════════════════════════════════
    bot_token_encrypted = Column(String(1000), nullable=True)
    # Encrypted xoxb-... token for this workspace
    # Obtained when workspace admin installs the Slack app
    # Each workspace gets its own bot token via OAuth

    bot_user_id = Column(String(100), nullable=True)
    # The bot's Slack user ID in this workspace (e.g., "U0123BOT")
    # Used to ignore the bot's own messages and prevent loops

    # ═══════════════════════════════════════════════════════════════
    # TARGET CHATBOT
    # ═══════════════════════════════════════════════════════════════
    chatbot_id = Column(
        UUID(as_uuid=True),
        ForeignKey("chatbots.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    # The chatbot that handles messages from this workspace
    # CASCADE: When chatbot deleted, deployment is deleted

    # ═══════════════════════════════════════════════════════════════
    # CHANNEL RESTRICTIONS
    # ═══════════════════════════════════════════════════════════════
    allowed_channel_ids = Column(JSONB, nullable=False, default=list)
    # List of channel IDs where bot is allowed to respond
    # Empty list = ALL channels allowed (DMs always allowed)
    # Example: ["C0123456789", "C9876543210"]

    # ═══════════════════════════════════════════════════════════════
    # STATUS
    # ═══════════════════════════════════════════════════════════════
    is_active = Column(Boolean, nullable=False, default=True)
    # Whether this deployment is active
    # False = bot won't respond to messages from this workspace

    # ═══════════════════════════════════════════════════════════════
    # AUDIT TRAIL
    # ═══════════════════════════════════════════════════════════════
    created_by = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=True
    )
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    deployed_at = Column(DateTime, nullable=True)
    # When the deployment was activated

    updated_at = Column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )

    # ═══════════════════════════════════════════════════════════════
    # EXTRA DATA (Note: 'metadata' is reserved by SQLAlchemy)
    # ═══════════════════════════════════════════════════════════════
    team_metadata = Column(JSONB, nullable=False, default=dict)
    # Additional metadata:
    # {
    #     "member_count": 150,
    #     "connected_at": "2024-01-15T10:30:00Z",
    #     "last_message_at": "2024-01-15T14:30:00Z",
    #     "total_messages": 450,
    #     "app_id": "A0123456789"
    # }

    # ═══════════════════════════════════════════════════════════════
    # RELATIONSHIPS
    # ═══════════════════════════════════════════════════════════════
    workspace = relationship("Workspace", back_populates="slack_workspace_deployments")
    chatbot = relationship("Chatbot", back_populates="slack_workspace_deployments")
    creator = relationship("User", foreign_keys=[created_by])

    # ═══════════════════════════════════════════════════════════════
    # INDEXES
    # ═══════════════════════════════════════════════════════════════
    __table_args__ = (
        Index("ix_slack_workspace_workspace_chatbot", "workspace_id", "chatbot_id"),
        Index("ix_slack_workspace_active", "team_id", "is_active"),
    )

    def __repr__(self):
        return f"<SlackWorkspaceDeployment(team_id={self.team_id}, chatbot_id={self.chatbot_id})>"

    @property
    def is_channel_allowed(self) -> bool:
        """Check if bot should respond in any channel (empty = all allowed)."""
        return len(self.allowed_channel_ids) == 0

    def check_channel_access(self, channel_id: str) -> bool:
        """
        Check if bot is allowed to respond in a specific channel.

        Args:
            channel_id: Slack channel ID to check

        Returns:
            True if allowed, False if restricted
        """
        # Empty list = all channels allowed
        if not self.allowed_channel_ids:
            return True
        return channel_id in self.allowed_channel_ids
