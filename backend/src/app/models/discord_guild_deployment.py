"""
Discord Guild Deployment model - Maps Discord guilds to chatbots for shared bot architecture.

WHY:
- Shared bot architecture: ONE Discord bot token serves ALL customers
- Multiple Discord servers (guilds) → different chatbots
- Guild ID routing determines which chatbot handles each message
- Enables multi-tenant Discord deployment without per-customer bot tokens

HOW:
- Maps guild_id → chatbot_id
- Supports channel restrictions (only respond in specific channels)
- Tracks deployment status and metadata
- Isolated by workspace for multi-tenancy

Architecture:
- Shared Discord Bot receives message with guild_id
- Lookup DiscordGuildDeployment by guild_id
- Route to correct chatbot for AI processing
- Return response to Discord channel
"""

from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.db.base_class import Base
import uuid
from datetime import datetime


class DiscordGuildDeployment(Base):
    """
    Maps Discord guild to chatbot for shared bot architecture.

    One-to-one: Each guild can only be mapped to ONE chatbot
    Many-to-one: Multiple guilds can map to the SAME chatbot

    Examples:
    - Guild "GamersUnite" → Customer Support Bot
    - Guild "TechHelp" → Customer Support Bot (same bot, different guild)
    - Guild "SalesTeam" → Sales Assistant Bot (different bot)
    """
    __tablename__ = "discord_guild_deployments"

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
    # DISCORD IDENTIFIERS
    # ═══════════════════════════════════════════════════════════════
    guild_id = Column(
        String(100),
        nullable=False,
        unique=True,  # One chatbot per guild (globally)
        index=True
    )
    # Discord server ID (snowflake format)
    # Example: "1234567890123456789"
    # UNIQUE: Ensures one chatbot per Discord server

    guild_name = Column(String(200), nullable=True)
    # Cached guild name for display purposes
    # Updated when deployment is created/modified
    # Example: "GamersUnite Community"

    guild_icon = Column(String(500), nullable=True)
    # Cached guild icon URL for display
    # Example: "https://cdn.discordapp.com/icons/123/abc.png"

    # ═══════════════════════════════════════════════════════════════
    # TARGET CHATBOT
    # ═══════════════════════════════════════════════════════════════
    chatbot_id = Column(
        UUID(as_uuid=True),
        ForeignKey("chatbots.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    # The chatbot that handles messages from this guild
    # CASCADE: When chatbot deleted, deployment is deleted

    # ═══════════════════════════════════════════════════════════════
    # CHANNEL RESTRICTIONS
    # ═══════════════════════════════════════════════════════════════
    allowed_channel_ids = Column(JSONB, nullable=False, default=list)
    # List of channel IDs where bot is allowed to respond
    # Empty list = ALL channels allowed
    # Example: ["123456789", "987654321"]

    # ═══════════════════════════════════════════════════════════════
    # STATUS
    # ═══════════════════════════════════════════════════════════════
    is_active = Column(Boolean, nullable=False, default=True)
    # Whether this deployment is active
    # False = bot won't respond to messages from this guild

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
    guild_metadata = Column(JSONB, nullable=False, default=dict)
    # Additional metadata:
    # {
    #     "member_count": 1500,
    #     "connected_at": "2024-01-15T10:30:00Z",
    #     "last_message_at": "2024-01-15T14:30:00Z",
    #     "total_messages": 450,
    #     "invite_url": "https://discord.com/invite/abc123"
    # }

    # ═══════════════════════════════════════════════════════════════
    # RELATIONSHIPS
    # ═══════════════════════════════════════════════════════════════
    workspace = relationship("Workspace", back_populates="discord_guild_deployments")
    chatbot = relationship("Chatbot", back_populates="discord_guild_deployments")
    creator = relationship("User", foreign_keys=[created_by])

    # ═══════════════════════════════════════════════════════════════
    # INDEXES
    # ═══════════════════════════════════════════════════════════════
    __table_args__ = (
        Index("ix_discord_guild_workspace_chatbot", "workspace_id", "chatbot_id"),
        Index("ix_discord_guild_active", "guild_id", "is_active"),
    )

    def __repr__(self):
        return f"<DiscordGuildDeployment(guild_id={self.guild_id}, chatbot_id={self.chatbot_id})>"

    @property
    def is_channel_allowed(self) -> bool:
        """Check if bot should respond in any channel (empty = all allowed)."""
        return len(self.allowed_channel_ids) == 0

    def check_channel_access(self, channel_id: str) -> bool:
        """
        Check if bot is allowed to respond in a specific channel.

        Args:
            channel_id: Discord channel ID to check

        Returns:
            True if allowed, False if restricted
        """
        # Empty list = all channels allowed
        if not self.allowed_channel_ids:
            return True
        return channel_id in self.allowed_channel_ids
