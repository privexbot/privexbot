"""
Lead model - Captured user information from chatbot/chatflow interactions.

WHY:
- Optional feature for builders to capture leads (email, name, location)
- Track end-user engagement and geographical distribution
- Enable lead generation from bot interactions

HOW:
- Lives within workspace (through bot relationship)
- Stores user-provided info + auto-captured metadata
- Minimal design - just essential lead data
"""

from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Index, Enum
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.db.base_class import Base
import uuid
import enum
from datetime import datetime


class LeadStatus(str, enum.Enum):
    """Lead lifecycle status."""
    NEW = "new"                 # Newly captured
    CONTACTED = "contacted"     # Follow-up initiated
    QUALIFIED = "qualified"     # Meets criteria
    CONVERTED = "converted"     # Became customer
    UNQUALIFIED = "unqualified" # Did not meet criteria


class Lead(Base):
    """
    Lead model - Captured user information from chatbot/chatflow interactions.

    WHY:
    - Capture visitor information for follow-up
    - Track geographical distribution of users
    - Enable lead generation from bot interactions

    Examples: Website visitor who shared email, Discord user who opted-in
    """
    __tablename__ = "leads"

    # ═══════════════════════════════════════════════════════════════
    # TENANT ISOLATION (CRITICAL)
    # ═══════════════════════════════════════════════════════════════
    workspace_id = Column(
        UUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    # CRITICAL: Every lead belongs to exactly one workspace
    # CASCADE: When workspace deleted, leads are deleted

    # ═══════════════════════════════════════════════════════════════
    # BOT REFERENCE
    # ═══════════════════════════════════════════════════════════════
    bot_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    # Which bot/chatflow captured this lead
    # NOTE: Not a foreign key - can be chatbot OR chatflow ID

    bot_type = Column(String(20), nullable=False, default="chatbot")
    # Distinguish between "chatbot" and "chatflow"
    # VALUES: "chatbot" | "chatflow"

    session_id = Column(String(100), nullable=True, index=True)
    # Link lead to specific chat session
    # Reference to ChatSession.session_id

    # ═══════════════════════════════════════════════════════════════
    # USER-PROVIDED INFORMATION
    # ═══════════════════════════════════════════════════════════════
    email = Column(String(255), nullable=False, index=True)
    # Primary contact method - required

    name = Column(String(255), nullable=True)
    # User's name for personalization

    phone = Column(String(50), nullable=True)
    # Additional contact method

    custom_fields = Column(JSONB, nullable=True, default=dict)
    # Flexible storage for additional lead data
    # Example: {"company": "Acme Inc", "role": "Manager"}

    # ═══════════════════════════════════════════════════════════════
    # AUTO-CAPTURED METADATA
    # ═══════════════════════════════════════════════════════════════
    ip_address = Column(String(45), nullable=True)
    # User's IP address for geolocation
    # 45 chars to support IPv6

    country = Column(String(100), nullable=True, index=True)
    # Resolved from IP using GeoIP service
    # Example: "United States"

    country_code = Column(String(3), nullable=True, index=True)
    # ISO 3166-1 alpha-2 code
    # Example: "US"

    region = Column(String(100), nullable=True)
    # State/province level location
    # Example: "California"

    city = Column(String(100), nullable=True)
    # City level location
    # Example: "San Francisco"

    timezone = Column(String(50), nullable=True)
    # User's timezone for follow-up scheduling
    # Example: "America/Los_Angeles"

    # ═══════════════════════════════════════════════════════════════
    # ENGAGEMENT METADATA
    # ═══════════════════════════════════════════════════════════════
    channel = Column(String(20), nullable=True, default="website", index=True)
    # Where lead was captured
    # VALUES: "website" | "discord" | "telegram" | "whatsapp" | "api"

    referrer = Column(String(500), nullable=True)
    # Where user came from
    # Example: "https://google.com/search?q=..."

    user_agent = Column(String(500), nullable=True)
    # Device/browser information

    language = Column(String(10), nullable=True)
    # User's preferred language
    # Example: "en-US"

    # ═══════════════════════════════════════════════════════════════
    # PRIVACY & CONSENT (GDPR Compliance)
    # ═══════════════════════════════════════════════════════════════
    consent_given = Column(String(1), nullable=False, default="N")
    # Whether user explicitly consented to data collection
    # VALUES: "Y" (yes), "N" (no), "P" (pending)

    consent_timestamp = Column(DateTime, nullable=True)
    # When consent was given

    consent_method = Column(String(50), nullable=True)
    # How consent was obtained
    # VALUES: "form", "chat", "implicit", "api"

    data_processing_agreed = Column(String(1), nullable=False, default="N")
    # Whether user agreed to data processing terms
    # VALUES: "Y" (yes), "N" (no)

    # ═══════════════════════════════════════════════════════════════
    # LEAD STATUS
    # ═══════════════════════════════════════════════════════════════
    status = Column(
        Enum(LeadStatus),
        nullable=False,
        default=LeadStatus.NEW,
        index=True
    )
    # Track lead lifecycle

    notes = Column(Text, nullable=True)
    # Internal notes about this lead

    # ═══════════════════════════════════════════════════════════════
    # TIMESTAMPS
    # ═══════════════════════════════════════════════════════════════
    captured_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    # When lead was captured (distinct from created_at for analytics)

    # ═══════════════════════════════════════════════════════════════
    # RELATIONSHIPS
    # ═══════════════════════════════════════════════════════════════
    workspace = relationship("Workspace", back_populates="leads")

    # ═══════════════════════════════════════════════════════════════
    # INDEXES
    # ═══════════════════════════════════════════════════════════════
    __table_args__ = (
        Index("idx_leads_workspace_bot", "workspace_id", "bot_id"),
        Index("idx_leads_captured_at", "captured_at"),
    )

    def __repr__(self):
        return f"<Lead {self.email} ({self.status.value})>"
