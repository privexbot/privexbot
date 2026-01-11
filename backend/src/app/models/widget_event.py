"""
WidgetEvent model - Analytics events from the chat widget.

WHY:
- Track widget usage and user behavior
- Provide analytics dashboards for chatbot owners
- Identify engagement patterns and optimization opportunities

HOW:
- Store events from widget (load, open, close, message, etc.)
- Aggregate for time-series analytics
- Support filtering by bot, session, date range
"""

from sqlalchemy import Column, String, DateTime, Index, Enum
from sqlalchemy.dialects.postgresql import UUID, JSONB
from datetime import datetime
import uuid
import enum


from app.db.base_class import Base


class EventType(str, enum.Enum):
    """Widget event types."""
    WIDGET_LOADED = "widget_loaded"
    WIDGET_OPENED = "widget_opened"
    WIDGET_CLOSED = "widget_closed"
    MESSAGE_SENT = "message_sent"
    MESSAGE_RECEIVED = "message_received"
    LEAD_COLLECTED = "lead_collected"
    LEAD_SKIPPED = "lead_skipped"
    FEEDBACK_GIVEN = "feedback_given"
    PAGE_VIEW = "page_view"  # Hosted chat page visits
    ERROR = "error"


class WidgetEvent(Base):
    """Widget analytics event model."""

    __tablename__ = "widget_events"

    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Bot reference
    bot_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    bot_type = Column(String(20), nullable=False, default="chatbot")

    # Workspace for tenant isolation
    workspace_id = Column(UUID(as_uuid=True), nullable=False, index=True)

    # Event details
    event_type = Column(
        Enum(EventType),
        nullable=False,
        index=True
    )

    # Session tracking
    session_id = Column(String(100), nullable=True, index=True)

    # Event data (flexible JSON for different event types)
    event_data = Column(JSONB, nullable=False, default={})
    """
    Structure varies by event_type:

    widget_loaded:
        {
            "url": "https://example.com/page",
            "referrer": "https://google.com",
            "user_agent": "Mozilla/5.0...",
            "screen_width": 1920,
            "screen_height": 1080
        }

    widget_opened/closed:
        {
            "url": "https://example.com/page",
            "duration_seconds": 120  # for closed events
        }

    message_sent:
        {
            "message_length": 50,
            "has_urls": false,
            "has_email": false
        }

    lead_collected:
        {
            "fields_provided": ["email", "name"],
            "source": "before_chat"  # or "after_messages"
        }

    error:
        {
            "error_type": "api_error",
            "error_message": "Rate limit exceeded"
        }
    """

    # Timestamps
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)

    # Client-provided timestamp (for offline/delayed events)
    client_timestamp = Column(DateTime, nullable=True)

    # Indexes for analytics queries
    __table_args__ = (
        # Time-based queries per bot
        Index("ix_widget_events_bot_time", "bot_id", "created_at"),
        # Event type analysis
        Index("ix_widget_events_type_time", "event_type", "created_at"),
        # Workspace analytics
        Index("ix_widget_events_workspace_time", "workspace_id", "created_at"),
        # Session analysis
        Index("ix_widget_events_session", "bot_id", "session_id", "created_at"),
    )

    def __repr__(self):
        return f"<WidgetEvent {self.id} ({self.event_type})>"
