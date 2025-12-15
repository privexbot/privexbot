"""
ChatSession model - Conversation sessions for both chatbots and chatflows.

WHY:
- Track conversation history across messages
- Enable context-aware responses (memory)
- Support session management (expire, close, resume)
- Works for BOTH chatbots and chatflows (unified)

HOW:
- One session per conversation
- Links to either chatbot OR chatflow (polymorphic)
- Stores session metadata (IP, user agent, geolocation)
- Automatic cleanup of old sessions

PSEUDOCODE:
-----------
class ChatSession(Base):
    __tablename__ = "chat_sessions"

    # Identity
    id: UUID (primary key, auto-generated)
        WHY: Unique identifier for this conversation session

    # Polymorphic Bot Reference (CRITICAL DESIGN)
    bot_type: str (enum: "chatbot" | "chatflow")
        WHY: Track which type of bot owns this session
        HOW: Enables unified chat history for both types

    bot_id: UUID (indexed)
        WHY: ID of either chatbot or chatflow
        HOW: Query specific sessions with: bot_type + bot_id

        NOTE: Not a foreign key because it can point to two different tables
        VALIDATION: Check existence in appropriate table on create

    workspace_id: UUID (foreign key -> workspaces.id, indexed)
        WHY: Tenant isolation - all sessions belong to workspace
        SECURITY: Cannot access sessions from other workspaces

    # Session Context
    session_metadata: JSONB (default: {})
        WHY: Store additional context about the session

        STRUCTURE:
        {
            # User Information (from lead capture or widget)
            "user": {
                "name": "John Doe",
                "email": "john@example.com",
                "user_agent": "Mozilla/5.0...",
                "platform": "web",  # "web" | "telegram" | "discord" | "whatsapp" | "api"
                "widget_version": "1.2.3"
            },

            # Geolocation (from IP)
            "location": {
                "ip": "203.0.113.42",
                "country": "United States",
                "country_code": "US",
                "region": "California",
                "city": "San Francisco",
                "timezone": "America/Los_Angeles",
                "lat": 37.7749,
                "lon": -122.4194
            },

            # Channel Information
            "channel": {
                "type": "telegram",  # "website" | "telegram" | "discord" | "whatsapp"
                "chat_id": "12345678",  # Telegram chat ID
                "user_id": "@john_doe",  # Platform user ID
                "webhook_url": "https://..."
            },

            # Session Settings
            "preferences": {
                "language": "en",
                "timezone": "America/Los_Angeles"
            },

            # Analytics
            "utm": {
                "source": "google",
                "medium": "cpc",
                "campaign": "spring_sale"
            }
        }

    # Session State
    status: str (enum, default: "active")
        WHY: Track session lifecycle
        VALUES:
            - "active": Currently in use
            - "idle": No messages for >10 minutes
            - "closed": Explicitly closed
            - "expired": Auto-closed after timeout

    message_count: int (default: 0)
        WHY: Track conversation length
        HOW: Increment on each message
        USE: Analytics, session limits

    # Timestamps
    created_at: datetime (auto-set)
        WHY: When conversation started

    updated_at: datetime (auto-update)
        WHY: Last message timestamp
        USE: Detect idle sessions

    last_message_at: datetime | None
        WHY: Track activity for idle detection
        HOW: Updated on every message

    closed_at: datetime | None
        WHY: When session ended

    expires_at: datetime | None (default: now() + 24 hours)
        WHY: Auto-cleanup old sessions
        HOW: Background job deletes expired sessions

    # Relationships
    messages: list[ChatMessage] (one-to-many, cascade delete)
        WHY: All messages in this session
        HOW: Ordered by created_at

    workspace: Workspace (many-to-one)

    # Indexes
    index: (bot_type, bot_id, status)
        WHY: Fast queries for active sessions of a bot

    index: (workspace_id, created_at)
        WHY: List all sessions for workspace

    index: (status, expires_at)
        WHY: Find expired sessions for cleanup

    index: (updated_at)
        WHY: Find idle sessions


SESSION LIFECYCLE:
------------------
1. Create:
    status = "active"
    message_count = 0
    expires_at = now() + 24 hours

2. Active Use:
    - message_count increments
    - last_message_at updates
    - status remains "active"

3. Idle Detection:
    if last_message_at < now() - 10 minutes:
        status = "idle"

4. Expiration:
    if expires_at < now():
        status = "expired"
        Background job deletes after 7 days

5. Close:
    User closes widget or types "/end"
    status = "closed"
    closed_at = now()


MEMORY MANAGEMENT:
------------------
WHY: Keep relevant context without overwhelming LLM
HOW: Rolling window of recent messages

def get_context_messages(session, max_messages=10):
    """Get recent messages for LLM context."""

    messages = session.messages.order_by(
        ChatMessage.created_at.desc()
    ).limit(max_messages).all()

    return list(reversed(messages))  # Chronological order


SECURITY:
---------
WHY: Sessions may contain PII
HOW: Tenant isolation + encryption

- workspace_id ensures isolation
- session_metadata encrypted in database
- Cannot access sessions from other workspaces
- GDPR: Users can request session deletion


POLYMORPHIC QUERY PATTERN:
---------------------------
WHY: Handle both chatbot and chatflow sessions
HOW: Filter by bot_type + bot_id

# Get all sessions for a chatbot
sessions = db.query(ChatSession).filter(
    ChatSession.bot_type == "chatbot",
    ChatSession.bot_id == chatbot_id,
    ChatSession.workspace_id == workspace_id
).all()

# Get all sessions for a chatflow
sessions = db.query(ChatSession).filter(
    ChatSession.bot_type == "chatflow",
    ChatSession.bot_id == chatflow_id,
    ChatSession.workspace_id == workspace_id
).all()


ANALYTICS USE CASES:
--------------------
- Conversation length distribution
- Geographic distribution of users
- Channel performance (web vs Telegram vs Discord)
- Time-based usage patterns
- Drop-off points (where users leave)
"""

from sqlalchemy import Column, String, Integer, DateTime, Index, Enum
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from datetime import datetime, timedelta
import uuid
import enum

from app.db.base_class import Base


class SessionStatus(str, enum.Enum):
    """Session status enum."""
    ACTIVE = "active"
    IDLE = "idle"
    CLOSED = "closed"
    EXPIRED = "expired"


class BotType(str, enum.Enum):
    """Bot type enum."""
    CHATBOT = "chatbot"
    CHATFLOW = "chatflow"


class ChatSession(Base):
    """Chat session model - works for both chatbots and chatflows."""

    __tablename__ = "chat_sessions"

    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Polymorphic bot reference
    bot_type = Column(Enum(BotType), nullable=False, index=True)
    bot_id = Column(UUID(as_uuid=True), nullable=False, index=True)

    # Tenant isolation
    workspace_id = Column(
        UUID(as_uuid=True),
        nullable=False,
        index=True
    )

    # Session context
    session_metadata = Column(JSONB, nullable=False, default={})

    # Session state
    status = Column(
        Enum(SessionStatus),
        nullable=False,
        default=SessionStatus.ACTIVE,
        index=True
    )
    message_count = Column(Integer, nullable=False, default=0)

    # Timestamps
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        index=True
    )
    last_message_at = Column(DateTime, nullable=True)
    closed_at = Column(DateTime, nullable=True)
    expires_at = Column(
        DateTime,
        nullable=False,
        default=lambda: datetime.utcnow() + timedelta(hours=24),
        index=True
    )

    # Relationships
    messages = relationship(
        "ChatMessage",
        back_populates="session",
        cascade="all, delete-orphan",
        lazy="dynamic"
    )

    # Indexes
    __table_args__ = (
        Index("ix_chat_sessions_bot_lookup", "bot_type", "bot_id", "status"),
        Index("ix_chat_sessions_workspace", "workspace_id", "created_at"),
        Index("ix_chat_sessions_cleanup", "status", "expires_at"),
    )

    def __repr__(self):
        return f"<ChatSession {self.id} ({self.bot_type}/{self.bot_id})>"
