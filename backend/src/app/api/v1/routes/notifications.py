"""
Notification API routes - In-app notification endpoints.

Endpoints:
  GET  /notifications        - Paginated list
  GET  /notifications/count  - Unread count (lightweight, for badge polling)
  PUT  /notifications/{id}/read  - Mark single as read
  PUT  /notifications/read-all   - Mark all as read
"""

from uuid import UUID
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.api.v1.dependencies import get_current_user
from app.models.user import User
from app.services import notification_service

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("")
async def list_notifications(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    unread_only: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Paginated notification list."""
    items, total = notification_service.get_notifications(
        db=db,
        user_id=current_user.id,
        limit=limit,
        offset=offset,
        unread_only=unread_only,
    )
    unread_count = notification_service.get_unread_count(db, current_user.id)

    return {
        "items": [
            {
                "id": str(n.id),
                "event": n.event,
                "title": n.title,
                "body": n.body,
                "link": n.link,
                "is_read": n.is_read,
                "resource_type": n.resource_type,
                "resource_id": str(n.resource_id) if n.resource_id else None,
                "metadata": n.event_metadata,
                "created_at": n.created_at.isoformat(),
            }
            for n in items
        ],
        "total": total,
        "unread_count": unread_count,
    }


@router.get("/count")
async def get_unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lightweight unread count for badge polling."""
    return {"unread_count": notification_service.get_unread_count(db, current_user.id)}


@router.put("/{notification_id}/read")
async def mark_as_read(
    notification_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark a single notification as read."""
    notif = notification_service.mark_as_read(db, notification_id, current_user.id)
    if not notif:
        return {"status": "not_found"}
    return {"status": "ok"}


@router.put("/read-all")
async def mark_all_as_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark all notifications as read."""
    count = notification_service.mark_all_as_read(db, current_user.id)
    return {"status": "ok", "count": count}
