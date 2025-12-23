"""
Chatbot Metrics Tasks - Celery tasks for updating chatbot metrics.

WHY:
- Background job to pre-calculate metrics for fast dashboard loading
- Periodic refresh to keep cached_metrics up-to-date
- On-demand refresh for single chatbot after conversation

HOW:
- Celery task with scheduled execution
- Uses ChatbotMetricsService to calculate metrics
- Updates Chatbot.cached_metrics JSONB field
"""

from celery import shared_task
from typing import Optional, List, Dict, Any

from app.db.session import SessionLocal
from app.services.chatbot_metrics_service import ChatbotMetricsService


@shared_task(
    name="update_chatbot_metrics",
    bind=True,
    max_retries=3,
    default_retry_delay=60
)
def update_chatbot_metrics_task(
    self,
    chatbot_id: str
) -> Dict[str, Any]:
    """
    Update metrics for a single chatbot.

    Args:
        chatbot_id: UUID string of the chatbot

    Returns:
        Dict with updated metrics
    """
    from uuid import UUID

    db = SessionLocal()
    try:
        service = ChatbotMetricsService(db)
        metrics = service.update_chatbot_metrics(UUID(chatbot_id))
        return {
            "status": "success",
            "chatbot_id": chatbot_id,
            "metrics": metrics
        }
    except Exception as e:
        print(f"Error updating metrics for chatbot {chatbot_id}: {e}")
        raise self.retry(exc=e)
    finally:
        db.close()


@shared_task(
    name="update_all_chatbot_metrics",
    bind=True,
    max_retries=2,
    default_retry_delay=120
)
def update_all_chatbot_metrics_task(
    self,
    workspace_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Update metrics for all chatbots (optionally filtered by workspace).

    Args:
        workspace_id: Optional workspace UUID string to filter

    Returns:
        Dict with results for all chatbots
    """
    from uuid import UUID

    db = SessionLocal()
    try:
        service = ChatbotMetricsService(db)
        ws_uuid = UUID(workspace_id) if workspace_id else None
        results = service.update_all_chatbot_metrics(ws_uuid)
        return {
            "status": "success",
            "workspace_id": workspace_id,
            "updated_count": len([r for r in results if r["status"] == "updated"]),
            "error_count": len([r for r in results if r["status"] == "error"]),
            "results": results
        }
    except Exception as e:
        print(f"Error updating all chatbot metrics: {e}")
        raise self.retry(exc=e)
    finally:
        db.close()


@shared_task(name="refresh_chatbot_metrics_scheduled")
def refresh_chatbot_metrics_scheduled() -> Dict[str, Any]:
    """
    Scheduled task to refresh all chatbot metrics.
    Called by Celery Beat every hour.

    Returns:
        Dict with summary of updates
    """
    db = SessionLocal()
    try:
        service = ChatbotMetricsService(db)
        results = service.update_all_chatbot_metrics()

        updated = len([r for r in results if r["status"] == "updated"])
        errors = len([r for r in results if r["status"] == "error"])

        print(f"Refreshed chatbot metrics: {updated} updated, {errors} errors")

        return {
            "status": "success",
            "updated_count": updated,
            "error_count": errors
        }
    except Exception as e:
        print(f"Error in scheduled metrics refresh: {e}")
        return {
            "status": "error",
            "error": str(e)
        }
    finally:
        db.close()
