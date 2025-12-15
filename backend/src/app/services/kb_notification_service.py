"""
KB Notification Service - Multi-channel notifications for KB events.

WHY:
- Inform users of KB processing completion
- Alert on errors and failures
- Support multiple delivery channels (email, webhook, in-app)
- Track delivery status and retry failures

HOW:
- Create notification records for events
- Queue for async delivery via Celery
- Track attempts and status
- Support templated messages
"""

from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.models.kb_notification import KBNotification
from app.models.knowledge_base import KnowledgeBase
from app.models.user import User


def create_notification(
    db: Session,
    kb_id: UUID,
    user_id: UUID,
    event: str,
    channel: str,
    recipient: Optional[str] = None,
    subject: Optional[str] = None,
    body: Optional[str] = None,
    event_metadata: Optional[Dict[str, Any]] = None,
    scheduled_at: Optional[datetime] = None
) -> KBNotification:
    """
    Create a notification for delivery.

    WHY: Queue notification for async delivery
    HOW: Create DB record with pending status

    Args:
        db: Database session
        kb_id: UUID of knowledge base
        user_id: UUID of user to notify
        event: Event that triggered notification
        channel: Delivery channel (email, webhook, in_app)
        recipient: Email address or webhook URL
        subject: Notification subject/title
        body: Notification content
        event_metadata: Additional context
        scheduled_at: When to deliver (None = immediate)

    Returns:
        Created KBNotification object
    """
    notification = KBNotification(
        kb_id=kb_id,
        user_id=user_id,
        event=event,
        channel=channel,
        recipient=recipient,
        subject=subject,
        body=body,
        event_metadata=event_metadata or {},
        scheduled_at=scheduled_at,
        status="pending"
    )

    db.add(notification)
    db.commit()
    db.refresh(notification)
    return notification


def notify_kb_processing_completed(
    db: Session,
    kb_id: UUID,
    user_id: UUID,
    kb_name: str,
    stats: Dict[str, Any]
) -> List[KBNotification]:
    """
    Notify user that KB processing completed successfully.

    WHY: User wants to know when KB is ready
    HOW: Create email and in-app notifications

    Args:
        db: Database session
        kb_id: UUID of knowledge base
        user_id: UUID of user to notify
        kb_name: Name of the KB
        stats: Processing statistics

    Returns:
        List of created notifications
    """
    # Get user for email
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return []

    notifications = []

    # Email notification
    subject = f"✅ Knowledge Base '{kb_name}' is ready"
    body = f"""
Your knowledge base '{kb_name}' has been successfully processed and is now ready to use.

Processing Summary:
- Documents processed: {stats.get('total_documents', 0)}
- Chunks created: {stats.get('total_chunks', 0)}
- Processing time: {stats.get('duration_seconds', 0)} seconds

You can now use this knowledge base with your chatbots and chatflows.
"""

    # Note: Actual email address would come from user's auth identity
    # For now, we'll create the notification without recipient
    email_notif = create_notification(
        db=db,
        kb_id=kb_id,
        user_id=user_id,
        event="kb.processing.completed",
        channel="email",
        subject=subject,
        body=body,
        event_metadata={"stats": stats}
    )
    notifications.append(email_notif)

    # In-app notification
    in_app_notif = create_notification(
        db=db,
        kb_id=kb_id,
        user_id=user_id,
        event="kb.processing.completed",
        channel="in_app",
        subject=f"KB '{kb_name}' is ready",
        body=f"Your knowledge base has been processed with {stats.get('total_chunks', 0)} chunks.",
        event_metadata={"stats": stats}
    )
    notifications.append(in_app_notif)

    return notifications


def notify_kb_processing_failed(
    db: Session,
    kb_id: UUID,
    user_id: UUID,
    kb_name: str,
    error_message: str
) -> List[KBNotification]:
    """
    Notify user that KB processing failed.

    WHY: User needs to know about failures
    HOW: Create email and in-app notifications

    Args:
        db: Database session
        kb_id: UUID of knowledge base
        user_id: UUID of user to notify
        kb_name: Name of the KB
        error_message: Error details

    Returns:
        List of created notifications
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return []

    notifications = []

    # Email notification
    subject = f"❌ Knowledge Base '{kb_name}' processing failed"
    body = f"""
Unfortunately, processing of your knowledge base '{kb_name}' has failed.

Error: {error_message}

Please check your KB configuration and try again. If the problem persists, contact support.
"""

    email_notif = create_notification(
        db=db,
        kb_id=kb_id,
        user_id=user_id,
        event="kb.processing.failed",
        channel="email",
        subject=subject,
        body=body,
        event_metadata={"error": error_message}
    )
    notifications.append(email_notif)

    # In-app notification
    in_app_notif = create_notification(
        db=db,
        kb_id=kb_id,
        user_id=user_id,
        event="kb.processing.failed",
        channel="in_app",
        subject=f"KB '{kb_name}' processing failed",
        body=f"Processing failed: {error_message[:100]}",
        event_metadata={"error": error_message}
    )
    notifications.append(in_app_notif)

    return notifications


def notify_kb_member_added(
    db: Session,
    kb_id: UUID,
    new_member_user_id: UUID,
    kb_name: str,
    role: str,
    added_by_name: str
) -> KBNotification:
    """
    Notify user they were added to a KB.

    WHY: User should know they have access
    HOW: Create in-app notification

    Args:
        db: Database session
        kb_id: UUID of knowledge base
        new_member_user_id: UUID of newly added user
        kb_name: Name of the KB
        role: Role assigned to user
        added_by_name: Name of user who added them

    Returns:
        Created notification
    """
    subject = f"You've been added to '{kb_name}'"
    body = f"{added_by_name} added you as a {role} to the knowledge base '{kb_name}'."

    return create_notification(
        db=db,
        kb_id=kb_id,
        user_id=new_member_user_id,
        event="kb.member.added",
        channel="in_app",
        subject=subject,
        body=body,
        event_metadata={"role": role, "added_by": added_by_name}
    )


def get_pending_notifications(
    db: Session,
    limit: int = 100
) -> List[KBNotification]:
    """
    Get pending notifications ready for delivery.

    WHY: Celery task picks these up for sending
    HOW: Query pending notifications that are scheduled or overdue

    Args:
        db: Database session
        limit: Maximum notifications to fetch

    Returns:
        List of pending notifications
    """
    now = datetime.utcnow()

    notifications = db.query(KBNotification).filter(
        KBNotification.status == "pending",
        KBNotification.attempts < KBNotification.max_attempts,
        or_(
            KBNotification.scheduled_at == None,
            KBNotification.scheduled_at <= now
        )
    ).limit(limit).all()

    return notifications


def mark_notification_sent(
    db: Session,
    notification_id: UUID
) -> KBNotification:
    """
    Mark notification as successfully sent.

    WHY: Track delivery status
    HOW: Update status and sent_at timestamp

    Args:
        db: Database session
        notification_id: UUID of notification

    Returns:
        Updated notification
    """
    notification = db.query(KBNotification).filter(
        KBNotification.id == notification_id
    ).first()

    if notification:
        notification.mark_sent()
        db.commit()
        db.refresh(notification)

    return notification


def mark_notification_failed(
    db: Session,
    notification_id: UUID,
    error_message: str
) -> KBNotification:
    """
    Mark notification delivery as failed.

    WHY: Track failures for retry or alerting
    HOW: Update status and error message

    Args:
        db: Database session
        notification_id: UUID of notification
        error_message: Error details

    Returns:
        Updated notification
    """
    notification = db.query(KBNotification).filter(
        KBNotification.id == notification_id
    ).first()

    if notification:
        notification.increment_attempts()

        # If max attempts reached, mark as failed
        if notification.attempts >= notification.max_attempts:
            notification.mark_failed(error_message)
        else:
            # Otherwise keep as pending for retry
            notification.error_message = error_message

        db.commit()
        db.refresh(notification)

    return notification


def get_user_notifications(
    db: Session,
    user_id: UUID,
    channel: Optional[str] = None,
    limit: int = 50,
    offset: int = 0
) -> List[KBNotification]:
    """
    Get user's notifications.

    WHY: Display in UI notification center
    HOW: Query notifications for user

    Args:
        db: Database session
        user_id: UUID of user
        channel: Filter by channel (optional)
        limit: Maximum notifications to return
        offset: Number to skip

    Returns:
        List of notifications
    """
    query = db.query(KBNotification).filter(
        KBNotification.user_id == user_id
    )

    if channel:
        query = query.filter(KBNotification.channel == channel)

    notifications = query.order_by(
        KBNotification.created_at.desc()
    ).limit(limit).offset(offset).all()

    return notifications


def get_unread_notifications_count(
    db: Session,
    user_id: UUID
) -> int:
    """
    Get count of unread in-app notifications.

    WHY: Show notification badge count
    HOW: Count unread in-app notifications

    Args:
        db: Database session
        user_id: UUID of user

    Returns:
        Count of unread notifications
    """
    # For this implementation, we consider "sent" in-app notifications as "unread"
    # You could add a separate "read" status or table to track reads
    count = db.query(KBNotification).filter(
        KBNotification.user_id == user_id,
        KBNotification.channel == "in_app",
        KBNotification.status == "sent"
    ).count()

    return count


def retry_failed_notification(
    db: Session,
    notification_id: UUID,
    scheduled_at: Optional[datetime] = None
) -> KBNotification:
    """
    Retry a failed notification.

    WHY: Manual retry for important notifications
    HOW: Reset status to pending and optionally reschedule

    Args:
        db: Database session
        notification_id: UUID of notification
        scheduled_at: When to retry (None = immediate)

    Returns:
        Updated notification
    """
    notification = db.query(KBNotification).filter(
        KBNotification.id == notification_id
    ).first()

    if notification and notification.status == "failed":
        notification.status = "pending"
        notification.error_message = None
        notification.attempts = 0  # Reset attempt counter
        notification.scheduled_at = scheduled_at
        db.commit()
        db.refresh(notification)

    return notification
