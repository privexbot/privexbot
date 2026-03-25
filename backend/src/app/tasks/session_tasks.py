"""
Session Maintenance Tasks - Cleanup of expired chat sessions.

WHY:
- Prevent database bloat from accumulated sessions
- Sessions have 24hr TTL + 7 day grace period
- Cleanup frees storage and improves query performance

HOW:
- Celery Beat scheduled task (run daily)
- Delete sessions where expires_at < (now - 7 days)
- Cascade deletes associated messages

SCHEDULE: Daily at 3 AM (low traffic period)
"""

from celery import shared_task
from datetime import datetime

from app.db.session import SessionLocal
from app.services.session_service import session_service


@shared_task(bind=True, name="cleanup_expired_sessions")
def cleanup_expired_sessions_task(self):
    """
    Delete expired chat sessions from database.

    SCHEDULE: Daily
    QUEUE: low_priority
    DURATION: Varies based on session count

    WHY: Sessions accumulate forever without cleanup
    HOW: Delete sessions where expires_at < (now - 7 days)

    Returns:
        {
            "cleaned": int,
            "message": str
        }
    """
    db = SessionLocal()
    try:
        count = session_service.cleanup_expired_sessions(db)
        return {
            "cleaned": count,
            "message": f"Cleaned up {count} expired sessions"
        }
    except Exception as e:
        return {
            "cleaned": 0,
            "error": str(e)
        }
    finally:
        db.close()
