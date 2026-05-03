"""
Celery Worker Configuration - Main Celery app instance.

WHY:
- Async task processing for long-running operations
- Background jobs for KB processing, crawling, embeddings
- Scheduled tasks for maintenance

HOW:
- Celery app with Redis broker
- Auto-discover tasks from app.tasks
- Result backend for tracking
- Task queues: high_priority, default, low_priority
- Scheduled tasks with Celery Beat
"""

from celery import Celery
from celery.schedules import crontab
from app.core.config import settings

# Create Celery app instance
celery_app = Celery(
    "privexbot",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND
)

# Celery configuration
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,

    # Task result expiration
    result_expires=3600,

    # Redis connection resilience (prevents TimeoutError during RDB saves)
    broker_transport_options={
        "socket_timeout": 30,
        "socket_connect_timeout": 15,
        "retry_on_timeout": True,
    },
    result_backend_transport_options={
        "socket_timeout": 30,
        "socket_connect_timeout": 15,
        "retry_on_timeout": True,
    },

    # Task execution settings
    task_acks_late=True,
    task_reject_on_worker_lost=True,

    # Worker settings
    worker_prefetch_multiplier=1,
    worker_max_tasks_per_child=100,

    # Task routing with multiple queues
    task_default_queue="default",
    task_default_exchange="default",
    task_default_routing_key="default",

    # Define task routes (route tasks to specific queues)
    task_routes={
        # High priority queue
        "app.tasks.kb_pipeline_tasks.process_web_kb": {"queue": "high_priority"},
        "app.tasks.kb_pipeline_tasks.reindex_kb": {"queue": "high_priority"},

        # Low priority queue
        "app.tasks.kb_maintenance_tasks.*": {"queue": "low_priority"},
        "app.tasks.session_tasks.*": {"queue": "low_priority"},
    },

    # Scheduled tasks (Celery Beat)
    beat_schedule={
        # Clean up expired pipeline tracking data every hour
        "cleanup-expired-pipelines": {
            "task": "cleanup_expired_pipelines",
            "schedule": crontab(minute=0),  # Every hour
        },

        # Re-index stale KBs every day at 2 AM
        "reindex-stale-kbs": {
            "task": "reindex_stale_kbs",
            "schedule": crontab(hour=2, minute=0),  # Daily at 2 AM
        },

        # Health check for Qdrant collections every 6 hours
        "health-check-qdrant": {
            "task": "health_check_qdrant_collections",
            "schedule": crontab(minute=0, hour="*/6"),  # Every 6 hours
        },

        # Refresh chatbot metrics every hour
        "refresh-chatbot-metrics": {
            "task": "refresh_chatbot_metrics_scheduled",
            "schedule": crontab(minute=30),  # Every hour at :30
        },

        # Clean up expired sessions daily at 3 AM
        "cleanup-expired-sessions": {
            "task": "cleanup_expired_sessions",
            "schedule": crontab(hour=3, minute=0),  # Daily at 3 AM
        },

        # Free-tier inactivity sweep daily at 2 AM. Warns at 23 days
        # idle, suspends at 30 days. Paid tiers are skipped.
        "suspend-inactive-free-orgs": {
            "task": "suspend_inactive_free_orgs",
            "schedule": crontab(hour=2, minute=0),
        },
    },
)

# Auto-discover tasks from app.tasks module
celery_app.autodiscover_tasks(["app.tasks"])
