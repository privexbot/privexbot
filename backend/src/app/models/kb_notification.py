"""
KBNotification model - User notification preferences and delivery tracking for KB events.

WHY:
- Keep users informed of KB processing completion
- Alert on errors and failures
- Support multiple channels (email, webhook)
- Track delivery status

HOW:
- Store user notification preferences
- Queue notifications for delivery
- Track delivery attempts and status
- Support retry logic

PSEUDOCODE:
-----------
class KBNotification(Base):
    __tablename__ = "kb_notifications"

    # Fields
    id: UUID (primary key, auto-generated)

    kb_id: UUID (foreign key -> knowledge_bases.id, indexed, CASCADE delete)
        WHY: Which KB this notification is about
        HOW: Notification deleted when KB is deleted

    user_id: UUID (foreign key -> users.id, indexed, CASCADE delete)
        WHY: Who should receive this notification
        HOW: Notification deleted when user is deleted

    event: str (required, indexed)
        WHY: What event triggered this notification
        HOW: Standardized event names

        EVENTS:
        - 'kb.processing.completed': KB processing finished successfully
        - 'kb.processing.failed': KB processing failed
        - 'kb.reindex.completed': Re-indexing completed
        - 'kb.reindex.failed': Re-indexing failed
        - 'kb.member.added': User added to KB
        - 'kb.member.removed': User removed from KB

    channel: str (required, indexed)
        WHY: How to deliver notification
        HOW: email, webhook, in_app
        VALUES: 'email', 'webhook', 'in_app'

    status: str (required, indexed)
        WHY: Track delivery status
        HOW: Update as notification is processed
        VALUES: 'pending', 'sent', 'failed', 'cancelled'

    recipient: str (nullable)
        WHY: Email address or webhook URL
        HOW: Depends on channel type

    subject: str (nullable)
        WHY: Email subject or notification title
        HOW: Template-based generation

    body: text (nullable)
        WHY: Notification content
        HOW: Template-based generation with variables

    metadata: JSONB (nullable)
        WHY: Additional context for notification
        HOW: KB stats, error details, etc.

    error_message: text (nullable)
        WHY: Track delivery failures
        HOW: Store error for debugging

    attempts: int (default 0)
        WHY: Track retry attempts
        HOW: Increment on each attempt

    max_attempts: int (default 3)
        WHY: Prevent infinite retries
        HOW: Stop trying after max_attempts

    scheduled_at: datetime (nullable)
        WHY: Delay notification delivery
        HOW: For rate limiting or batching

    sent_at: datetime (nullable)
        WHY: When notification was successfully delivered
        HOW: Set when status changes to 'sent'

    created_at: datetime (auto-set on creation, indexed)
    updated_at: datetime (auto-update on modification)

    # Relationships
    kb: KnowledgeBase (many-to-one)
    user: User (many-to-one)

NOTIFICATION FLOW:
------------------
1. Event occurs (KB processing completes)
2. Create KBNotification record (status='pending')
3. Celery task picks up pending notifications
4. Attempt delivery via channel
5. Update status ('sent' or 'failed')
6. Retry on failure (up to max_attempts)

RETRY LOGIC:
------------
WHY: Transient failures (email service down, network issues)
HOW: Exponential backoff
    - Attempt 1: Immediate
    - Attempt 2: +5 minutes
    - Attempt 3: +15 minutes
    - If still failing: mark as 'failed', alert admin
"""

# ACTUAL IMPLEMENTATION
from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Integer, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.db.base_class import Base
import uuid
from datetime import datetime


class KBNotification(Base):
    """
    KBNotification - Notification queue and delivery tracking for KB events.

    Supports multiple channels: email, webhook, in-app
    Tracks delivery status and retries failed deliveries.

    Event naming convention: <resource>.<event>.<status>
    Examples: kb.processing.completed, kb.reindex.failed
    """
    __tablename__ = "kb_notifications"

    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Foreign keys
    kb_id = Column(
        UUID(as_uuid=True),
        ForeignKey("knowledge_bases.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    # Notification details
    event = Column(String(100), nullable=False, index=True)
    # Examples: 'kb.processing.completed', 'kb.processing.failed', 'kb.member.added'

    channel = Column(String(50), nullable=False, index=True)
    # Values: 'email', 'webhook', 'in_app'

    status = Column(String(50), nullable=False, default='pending', index=True)
    # Values: 'pending', 'sent', 'failed', 'cancelled'

    # Delivery details
    recipient = Column(String(255), nullable=True)
    # Email address or webhook URL

    subject = Column(String(500), nullable=True)
    # Email subject or notification title

    body = Column(Text, nullable=True)
    # Notification content

    event_metadata = Column(JSONB, nullable=True)
    # Additional context: KB stats, error details, etc.

    # Error tracking
    error_message = Column(Text, nullable=True)
    # Store delivery failure details

    # Retry logic
    attempts = Column(Integer, default=0, nullable=False)
    max_attempts = Column(Integer, default=3, nullable=False)

    # Scheduling
    scheduled_at = Column(DateTime, nullable=True)
    # When to send (for delayed/batched notifications)

    sent_at = Column(DateTime, nullable=True)
    # When successfully delivered

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Indexes for common query patterns
    __table_args__ = (
        Index('idx_kbnotif_status_scheduled', 'status', 'scheduled_at'),  # For worker queries
        Index('idx_kbnotif_kb_event', 'kb_id', 'event'),  # KB-specific notifications
        Index('idx_kbnotif_user_created', 'user_id', 'created_at'),  # User notification history
    )

    # Relationships
    kb = relationship("KnowledgeBase", foreign_keys=[kb_id])
    user = relationship("User", foreign_keys=[user_id])

    def __repr__(self):
        return f"<KBNotification(event={self.event}, channel={self.channel}, status={self.status})>"

    @property
    def is_pending(self) -> bool:
        """Check if notification is pending delivery"""
        return self.status == 'pending'

    @property
    def is_sent(self) -> bool:
        """Check if notification was successfully sent"""
        return self.status == 'sent'

    @property
    def is_failed(self) -> bool:
        """Check if notification delivery failed"""
        return self.status == 'failed'

    @property
    def can_retry(self) -> bool:
        """Check if notification can be retried"""
        return self.status == 'pending' and self.attempts < self.max_attempts

    @property
    def is_email(self) -> bool:
        """Check if this is an email notification"""
        return self.channel == 'email'

    @property
    def is_webhook(self) -> bool:
        """Check if this is a webhook notification"""
        return self.channel == 'webhook'

    @property
    def is_in_app(self) -> bool:
        """Check if this is an in-app notification"""
        return self.channel == 'in_app'

    def mark_sent(self):
        """Mark notification as successfully sent"""
        self.status = 'sent'
        self.sent_at = datetime.utcnow()

    def mark_failed(self, error_message: str):
        """Mark notification as failed"""
        self.status = 'failed'
        self.error_message = error_message

    def increment_attempts(self):
        """Increment retry attempt counter"""
        self.attempts += 1

    def to_dict(self) -> dict:
        """Convert notification to dictionary for API responses"""
        return {
            'id': str(self.id),
            'kb_id': str(self.kb_id),
            'user_id': str(self.user_id),
            'event': self.event,
            'channel': self.channel,
            'status': self.status,
            'recipient': self.recipient,
            'subject': self.subject,
            'attempts': self.attempts,
            'max_attempts': self.max_attempts,
            'scheduled_at': self.scheduled_at.isoformat() if self.scheduled_at else None,
            'sent_at': self.sent_at.isoformat() if self.sent_at else None,
            'created_at': self.created_at.isoformat(),
            'can_retry': self.can_retry
        }
