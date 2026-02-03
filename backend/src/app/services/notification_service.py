"""
Notification Service - CRUD operations and event helpers for in-app notifications.
"""

from uuid import UUID
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.models.notification import Notification


# ========================================
# CORE CRUD
# ========================================

def create_notification(
    db: Session,
    user_id: UUID,
    event: str,
    title: str,
    body: Optional[str] = None,
    link: Optional[str] = None,
    resource_type: Optional[str] = None,
    resource_id: Optional[UUID] = None,
    metadata: Optional[dict] = None,
) -> Notification:
    """Create a single notification."""
    notif = Notification(
        user_id=user_id,
        event=event,
        title=title,
        body=body,
        link=link,
        resource_type=resource_type,
        resource_id=resource_id,
        event_metadata=metadata,
    )
    db.add(notif)
    db.commit()
    db.refresh(notif)
    return notif


def get_notifications(
    db: Session,
    user_id: UUID,
    limit: int = 20,
    offset: int = 0,
    unread_only: bool = False,
) -> tuple[list[Notification], int]:
    """Paginated list with total count."""
    query = db.query(Notification).filter(Notification.user_id == user_id)

    if unread_only:
        query = query.filter(Notification.is_read == False)  # noqa: E712

    total = query.count()
    items = query.order_by(desc(Notification.created_at)).offset(offset).limit(limit).all()
    return items, total


def get_unread_count(db: Session, user_id: UUID) -> int:
    """Count unread notifications (lightweight, for badge polling)."""
    return (
        db.query(Notification)
        .filter(Notification.user_id == user_id, Notification.is_read == False)  # noqa: E712
        .count()
    )


def mark_as_read(db: Session, notification_id: UUID, user_id: UUID) -> Optional[Notification]:
    """Mark one notification as read (verifies ownership)."""
    notif = (
        db.query(Notification)
        .filter(Notification.id == notification_id, Notification.user_id == user_id)
        .first()
    )
    if notif and not notif.is_read:
        notif.is_read = True
        db.commit()
        db.refresh(notif)
    return notif


def mark_all_as_read(db: Session, user_id: UUID) -> int:
    """Bulk mark all unread as read. Returns count updated."""
    count = (
        db.query(Notification)
        .filter(Notification.user_id == user_id, Notification.is_read == False)  # noqa: E712
        .update({"is_read": True})
    )
    db.commit()
    return count


# ========================================
# EVENT HELPERS
# ========================================

def notify_kb_completed(
    db: Session,
    user_id: UUID,
    kb_id: UUID,
    kb_name: str,
    stats: dict,
) -> Notification:
    """Emit notification when KB processing completes successfully."""
    chunks = stats.get("total_chunks", 0)
    docs = stats.get("total_documents", 0)
    return create_notification(
        db=db,
        user_id=user_id,
        event="kb.processing.completed",
        title=f"Knowledge base \"{kb_name}\" is ready",
        body=f"Processing complete: {docs} document(s), {chunks} chunk(s) indexed.",
        link=f"/knowledge-bases/{kb_id}",
        resource_type="kb",
        resource_id=kb_id,
        metadata=stats,
    )


def notify_kb_failed(
    db: Session,
    user_id: UUID,
    kb_id: UUID,
    kb_name: str,
    error: str,
) -> Notification:
    """Emit notification when KB processing fails."""
    return create_notification(
        db=db,
        user_id=user_id,
        event="kb.processing.failed",
        title=f"Knowledge base \"{kb_name}\" failed",
        body=error[:300] if error else "Processing failed.",
        link=f"/knowledge-bases/{kb_id}",
        resource_type="kb",
        resource_id=kb_id,
        metadata={"error": error},
    )


def notify_chatbot_deployed(
    db: Session,
    user_id: UUID,
    chatbot_id: UUID,
    chatbot_name: str,
) -> Notification:
    """Emit notification when a chatbot is deployed."""
    return create_notification(
        db=db,
        user_id=user_id,
        event="chatbot.deployed",
        title=f"Chatbot \"{chatbot_name}\" deployed",
        body="Your chatbot is now live and ready to receive messages.",
        link=f"/chatbots/{chatbot_id}",
        resource_type="chatbot",
        resource_id=chatbot_id,
    )


def notify_chatflow_deployed(
    db: Session,
    user_id: UUID,
    chatflow_id: UUID,
    chatflow_name: str,
) -> Notification:
    """Emit notification when a chatflow is deployed."""
    return create_notification(
        db=db,
        user_id=user_id,
        event="chatflow.deployed",
        title=f"Chatflow \"{chatflow_name}\" deployed",
        body="Your chatflow is now live and ready to receive messages.",
        link=f"/chatflows/{chatflow_id}",
        resource_type="chatflow",
        resource_id=chatflow_id,
    )


def notify_invitation_accepted(
    db: Session,
    inviter_user_id: UUID,
    invitee_name: str,
    org_name: str,
) -> Notification:
    """Emit notification to the inviter when someone accepts their invitation."""
    return create_notification(
        db=db,
        user_id=inviter_user_id,
        event="invitation.accepted",
        title=f"{invitee_name} accepted your invitation",
        body=f"They have joined your {org_name}.",
        resource_type="invitation",
    )


def notify_lead_captured(
    db: Session,
    user_id: UUID,
    lead_email: str,
    bot_name: str,
) -> Notification:
    """Emit notification when a lead is captured."""
    return create_notification(
        db=db,
        user_id=user_id,
        event="lead.captured",
        title="New lead captured",
        body=f"{lead_email} via {bot_name}.",
        link="/leads",
        resource_type="lead",
    )
