"""
Tasks package - Celery background tasks.

WHY:
- Async processing of long-running operations
- Document parsing and embedding
- Website crawling
- Cloud synchronization
- Scheduled jobs

HOW:
- Celery workers
- Redis as broker
- Task queues by priority
- Result storage
"""

# Import tasks to register them with Celery
from app.tasks.kb_pipeline_tasks import process_web_kb_task  # noqa: F401
from app.tasks.document_processing_tasks import (  # noqa: F401
    process_document_task,
    reprocess_document_task
)
from app.tasks.kb_maintenance_tasks import (  # noqa: F401
    cleanup_expired_pipelines_task,
    reindex_stale_kbs_task,
    health_check_qdrant_collections_task,
    manual_cleanup_kb_task
)
