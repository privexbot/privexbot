"""
Notification model - General-purpose in-app notification system.

Separate from KBNotification (which has a NOT NULL kb_id FK and is KB-scoped).
This model supports notifications for any event: chatbot deploy, KB processing,
invitation accepted, lead captured, etc.
"""

from sqlalchemy import Column, String, Boolean, Text, Index, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.db.base_class import Base


class Notification(Base):
    __tablename__ = "notifications"

    # User who receives the notification
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    # Event type: "kb.processing.completed", "chatbot.deployed", "invitation.accepted", etc.
    event = Column(String(100), nullable=False, index=True)

    # Display fields
    title = Column(String(500), nullable=False)
    body = Column(Text, nullable=True)
    link = Column(String(500), nullable=True)  # Frontend route: "/knowledge-bases/{id}"

    # Read state
    is_read = Column(Boolean, default=False, nullable=False, index=True)

    # Polymorphic resource reference (optional)
    resource_type = Column(String(50), nullable=True)  # "kb", "chatbot", "chatflow", "invitation", "lead"
    resource_id = Column(UUID(as_uuid=True), nullable=True)

    # Extra context
    event_metadata = Column(JSONB, nullable=True)

    # Composite indexes for common queries
    __table_args__ = (
        Index('idx_notif_user_unread', 'user_id', 'is_read', 'created_at'),
        Index('idx_notif_user_event', 'user_id', 'event'),
    )

    # Relationships
    user = relationship("User", foreign_keys=[user_id])
