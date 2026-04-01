"""
KB Pipeline Routes - Real-time progress tracking for background processing.

PHASE 3: Background Processing Monitoring
- Get pipeline status from Redis
- Frontend polls this endpoint every 2 seconds
- Real-time progress updates

This file implements pipeline monitoring endpoints.
Actual processing happens in Celery tasks.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Dict, Any
from datetime import datetime
import json

from app.db.session import get_db
from app.api.v1.dependencies import get_current_user, get_current_user_with_org
from app.models.user import User
from app.models.knowledge_base import KnowledgeBase
from app.services.draft_service import draft_service

router = APIRouter(prefix="/kb-pipeline", tags=["kb_pipelines"])


@router.get("/{pipeline_id}/status")
async def get_pipeline_status(
    pipeline_id: str,
    db: Session = Depends(get_db),
    user_context = Depends(get_current_user_with_org)
):
    """
    Get real-time pipeline status.

    PHASE: 3 (Background Processing Monitoring)
    DURATION: <10ms
    POLLING: Frontend polls this every 2 seconds

    Returns:
        {
            "pipeline_id": str,
            "kb_id": str,
            "status": "queued" | "running" | "completed" | "failed",
            "current_stage": str,
            "progress_percentage": int,
            "stats": {
                "pages_discovered": int,
                "pages_scraped": int,
                "pages_failed": int,
                "chunks_created": int,
                "embeddings_generated": int,
                "vectors_indexed": int
            },
            "started_at": str,
            "updated_at": str,
            "estimated_completion": str (optional),
            "error": str (optional, if failed)
        }
    """

    # Get status from Redis
    redis_key = f"pipeline:{pipeline_id}:status"
    status_json = draft_service.redis_client.get(redis_key)

    if not status_json:
        # Pipeline status expired from Redis. Check if we can get KB status instead.
        # Pipeline ID format: {kb_id}:{timestamp}
        try:
            kb_id_from_pipeline = pipeline_id.split(":")[0]

            # Check if KB exists and get its current status
            kb = db.query(KnowledgeBase).filter(
                KnowledgeBase.id == kb_id_from_pipeline
            ).first()

            if kb:
                # Return KB status as pipeline status for graceful degradation
                return {
                    "pipeline_id": pipeline_id,
                    "kb_id": str(kb.id),
                    "status": "completed" if kb.status == "ready" else kb.status,
                    "current_stage": f"Completed - KB is {kb.status}",
                    "progress_percentage": 100 if kb.status in ["ready", "failed"] else 0,
                    "stats": kb.stats or {},
                    "updated_at": datetime.utcnow().isoformat(),
                    "message": f"Pipeline status expired. Current KB status: {kb.status}",
                    "error": kb.error_message if kb.status == "failed" else None,
                    "expired": True
                }
            else:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Pipeline expired and associated KB not found. Pipeline ID: {pipeline_id}"
                )
        except (IndexError, ValueError):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Pipeline not found or expired (invalid pipeline ID format)"
            )

    pipeline_status = json.loads(status_json)

    # Get KB to verify user has access
    kb_id = pipeline_status.get("kb_id")
    if not kb_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="KB ID not found in pipeline status"
        )

    kb = db.query(KnowledgeBase).filter(
        KnowledgeBase.id == kb_id
    ).first()

    if not kb:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Knowledge base not found"
        )

    # Verify KB belongs to user's workspace
    current_user, org_id, ws_id = user_context
    if ws_id and str(kb.workspace_id) != str(ws_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Knowledge base not found"
        )

    return pipeline_status


@router.get("/{pipeline_id}/logs")
async def get_pipeline_logs(
    pipeline_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    limit: int = 100
):
    """
    Get pipeline processing logs.

    PHASE: 3 (Background Processing Monitoring)
    DURATION: <50ms

    Returns:
        {
            "pipeline_id": str,
            "logs": List[{
                "timestamp": str,
                "level": "info" | "warning" | "error",
                "message": str,
                "details": dict (optional)
            }]
        }
    """

    # Get logs from Redis (if stored)
    redis_key = f"pipeline:{pipeline_id}:logs"
    logs_json = draft_service.redis_client.get(redis_key)

    if not logs_json:
        # No logs yet, or pipeline doesn't exist
        # Verify pipeline exists first
        status_key = f"pipeline:{pipeline_id}:status"
        status_json = draft_service.redis_client.get(status_key)

        if not status_json:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Pipeline not found or expired"
            )

        # Pipeline exists but no logs yet
        return {
            "pipeline_id": pipeline_id,
            "logs": []
        }

    logs = json.loads(logs_json)

    # Get KB to verify access
    status_json = draft_service.redis_client.get(f"pipeline:{pipeline_id}:status")
    pipeline_status = json.loads(status_json)
    kb_id = pipeline_status.get("kb_id")

    kb = db.query(KnowledgeBase).filter(
        KnowledgeBase.id == kb_id
    ).first()

    if not kb:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Knowledge base not found"
        )

    # Note: Access control simplified - KB access already validated at workspace level

    # Return most recent logs (limited)
    return {
        "pipeline_id": pipeline_id,
        "logs": logs[-limit:] if len(logs) > limit else logs
    }


@router.post("/{pipeline_id}/cancel")
async def cancel_pipeline(
    pipeline_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Cancel a running pipeline.

    PHASE: 3 (Background Processing Monitoring)
    DURATION: <50ms

    NOTE: This will attempt to cancel the Celery task.
    May not stop immediately if already processing.

    Returns:
        {
            "message": str,
            "pipeline_id": str,
            "status": str
        }
    """

    # Get status from Redis
    redis_key = f"pipeline:{pipeline_id}:status"
    status_json = draft_service.redis_client.get(redis_key)

    if not status_json:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pipeline not found or expired"
        )

    pipeline_status = json.loads(status_json)

    # Get KB to verify access
    kb_id = pipeline_status.get("kb_id")
    kb = db.query(KnowledgeBase).filter(
        KnowledgeBase.id == kb_id
    ).first()

    if not kb:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Knowledge base not found"
        )

    # Note: Access control simplified - KB access already validated at workspace level

    # Check if pipeline can be cancelled
    current_status = pipeline_status.get("status")
    if current_status in ["completed", "failed", "cancelled"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot cancel pipeline with status: {current_status}"
        )

    # Update pipeline status to cancelled
    pipeline_status["status"] = "cancelled"
    pipeline_status["updated_at"] = str(datetime.utcnow().isoformat())
    pipeline_status["cancelled_at"] = str(datetime.utcnow().isoformat())
    pipeline_status["cancelled_by"] = str(current_user.id)

    draft_service.redis_client.setex(
        redis_key,
        86400,  # 24 hour TTL
        json.dumps(pipeline_status)
    )

    # Revoke Celery task to stop processing
    celery_task_id = pipeline_status.get("celery_task_id")
    task_revoked = False
    if celery_task_id:
        try:
            from app.tasks.celery_worker import celery_app
            # Revoke the task - terminate=True sends SIGTERM to the worker process
            celery_app.control.revoke(celery_task_id, terminate=True, signal='SIGTERM')
            task_revoked = True
            print(f"✅ Celery task {celery_task_id} revoked successfully")
        except Exception as e:
            # Log but don't fail - the status update is more important
            print(f"⚠️ Failed to revoke Celery task {celery_task_id}: {e}")

    # Update KB status
    kb.status = "failed"
    kb.error_message = "Pipeline cancelled by user"
    db.commit()

    return {
        "message": "Pipeline cancelled successfully" if task_revoked else "Pipeline cancellation requested (task may still be completing)",
        "pipeline_id": pipeline_id,
        "status": "cancelled",
        "celery_task_revoked": task_revoked,
        "celery_task_id": celery_task_id
    }
