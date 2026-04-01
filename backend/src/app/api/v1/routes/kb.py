"""
KB Management Routes - CRUD operations and management for Knowledge Bases.

WHY:
- List, view, delete KBs
- Manual re-indexing
- Statistics and health
- Access control

HOW:
- RESTful API endpoints
- Organization-based access control
- Integration with Celery tasks
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File, Form
from fastapi.responses import Response
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any, Literal
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, Field
import json

from app.db.session import get_db
from app.api.v1.dependencies import get_current_user, get_current_user_with_org
from app.models.user import User
from app.models.knowledge_base import KnowledgeBase
from app.models.document import Document
from app.models.chunk import Chunk
from app.services.draft_service import draft_service

router = APIRouter(prefix="/kbs", tags=["knowledge_bases"])


def verify_kb_workspace_access(kb: KnowledgeBase, workspace_id: str):
    """
    Verify a KB belongs to the user's current workspace.

    WHY: Prevent cross-workspace KB access within the same organization
    HOW: Compare KB's workspace_id with user's active workspace from JWT
    """
    if str(kb.workspace_id) != str(workspace_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Knowledge base not found"
        )


# ========================================
# STALE PIPELINE DETECTION
# ========================================

STALE_PIPELINE_THRESHOLD_SECONDS = 120  # 2 minutes - pipeline is considered stale if queued longer

def get_pipeline_status_for_kb(kb_id: str) -> Optional[Dict[str, Any]]:
    """
    Find the most recent pipeline status for a KB.

    WHY: Need to check pipeline status independently of KB status
    HOW: Scan Redis for pipeline keys matching this KB

    Returns:
        Pipeline status dict or None if not found
    """
    import json

    try:
        # Find all pipeline keys for this KB
        pattern = f"pipeline:{kb_id}:*:status"
        keys = list(draft_service.redis_client.scan_iter(match=pattern, count=100))

        if not keys:
            # Try alternative pattern (pipeline_id format is kb_id:timestamp)
            pattern = f"pipeline:{kb_id}*:status"
            keys = list(draft_service.redis_client.scan_iter(match=pattern, count=100))

        if not keys:
            return None

        # Get most recent pipeline (by timestamp in key)
        most_recent = None
        most_recent_time = 0

        for key in keys:
            key_str = key.decode() if isinstance(key, bytes) else key
            # Extract timestamp from key (format: pipeline:kb_id:timestamp:status)
            parts = key_str.split(":")
            if len(parts) >= 3:
                try:
                    timestamp = int(parts[2]) if parts[2].isdigit() else 0
                    if timestamp > most_recent_time:
                        most_recent_time = timestamp
                        most_recent = key
                except (ValueError, IndexError):
                    continue

        if most_recent:
            data = draft_service.redis_client.get(most_recent)
            if data:
                return json.loads(data)

        return None

    except Exception as e:
        print(f"[get_pipeline_status_for_kb] Error: {e}")
        return None


def is_pipeline_stale(pipeline_status: Dict[str, Any], threshold_seconds: int = STALE_PIPELINE_THRESHOLD_SECONDS) -> bool:
    """
    Check if a queued pipeline is stale (exceeded threshold).

    WHY: Detect pipelines that got stuck in queue due to worker issues
    HOW: Compare created_at timestamp with current time

    Args:
        pipeline_status: Pipeline status dict from Redis
        threshold_seconds: Seconds after which queued pipeline is stale

    Returns:
        True if pipeline is queued and stale, False otherwise
    """
    if pipeline_status.get("status") != "queued":
        return False

    created_at = pipeline_status.get("created_at")
    if not created_at:
        return True  # No timestamp = assume stale

    try:
        created_time = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
        age_seconds = (datetime.utcnow() - created_time.replace(tzinfo=None)).total_seconds()
        return age_seconds > threshold_seconds
    except (ValueError, TypeError):
        return True  # Invalid timestamp = assume stale


def get_pipeline_age_seconds(pipeline_status: Dict[str, Any]) -> Optional[float]:
    """Get age of pipeline in seconds since creation."""
    created_at = pipeline_status.get("created_at")
    if not created_at:
        return None

    try:
        created_time = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
        return (datetime.utcnow() - created_time.replace(tzinfo=None)).total_seconds()
    except (ValueError, TypeError):
        return None


# ========================================
# HELPER FUNCTIONS
# ========================================

def validate_kb_not_deleting(kb: KnowledgeBase) -> None:
    """
    Validate that KB is not in deleting state.

    WHY: Prevent operations on soft-deleted KBs to avoid race conditions
    HOW: Check status and raise HTTP 410 Gone if deleting

    Args:
        kb: KnowledgeBase instance

    Raises:
        HTTPException: 410 if KB is being deleted, 404 if KB is None
    """
    if not kb:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Knowledge base not found"
        )

    if kb.status == "deleting":
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail={
                "message": f"Knowledge base '{kb.name}' is being deleted",
                "kb_id": str(kb.id),
                "status": "deleting",
                "note": "This operation is not available during deletion"
            }
        )


def get_kb_with_deletion_check(kb_id: UUID, db: Session) -> KnowledgeBase:
    """
    Get KB and ensure it's not being deleted.

    Args:
        kb_id: KB UUID
        db: Database session

    Returns:
        KnowledgeBase instance

    Raises:
        HTTPException: 404 or 410 based on KB state
    """
    kb = db.query(KnowledgeBase).filter(
        KnowledgeBase.id == kb_id
    ).first()

    validate_kb_not_deleting(kb)
    return kb


# ========================================
# REQUEST/RESPONSE MODELS
# ========================================

class KBResponse(BaseModel):
    """KB summary response"""
    id: str
    name: str
    description: Optional[str]
    workspace_id: str
    status: str
    context: str = "both"  # chatbot, chatflow, or both
    stats: dict
    total_documents: int = 0  # Legacy field for frontend compatibility
    total_chunks: int = 0     # Legacy field for frontend compatibility
    total_size_bytes: int = 0  # Legacy field for frontend compatibility (size in bytes)
    created_at: str
    updated_at: Optional[str]
    created_by: str

    class Config:
        from_attributes = True


class KBDetailResponse(BaseModel):
    """Detailed KB response with configuration"""
    id: str
    name: str
    description: Optional[str]
    workspace_id: str
    status: str
    context: str = "both"  # chatbot, chatflow, or both
    config: dict
    embedding_config: dict
    vector_store_config: dict
    indexing_method: str
    stats: dict
    total_documents: int = 0  # Legacy field for backward compatibility
    total_chunks: int = 0     # Legacy field for backward compatibility
    error_message: Optional[str]
    created_at: str
    updated_at: Optional[str]
    created_by: str
    # Reindexing capability fields
    source_types: List[str] = []  # Unique source types in KB (file_upload, web_scraping, text_input)
    can_reindex: bool = True  # Whether KB can be reindexed (false if all file uploads)
    reindex_warning: Optional[str] = None  # Warning message if partial reindexing

    class Config:
        from_attributes = True


class ReindexRequest(BaseModel):
    """Optional request model for KB reindexing with chunking configuration"""
    chunking_config: Optional[dict] = Field(None, description="Optional new chunking configuration to apply")
    embedding_config: Optional[dict] = Field(None, description="Optional new embedding configuration")
    vector_store_config: Optional[dict] = Field(None, description="Optional new vector store configuration")


class UpdateKBRequest(BaseModel):
    """Request model for updating KB general settings"""
    name: Optional[str] = Field(None, min_length=1, max_length=255, description="KB name")
    description: Optional[str] = Field(None, max_length=2000, description="KB description")
    context: Optional[str] = Field(None, description="Usage context: chatbot, chatflow, or both")


# ========================================
# CRUD ENDPOINTS
# ========================================

@router.get("/", response_model=List[KBResponse])
async def list_kbs(
    workspace_id: Optional[UUID] = Query(None, description="Filter by specific workspace (if not provided, returns all KBs from all workspaces in user's org)"),
    status: Optional[str] = Query(None, description="Filter by status"),
    context: Optional[str] = Query(None, description="Filter by context: chatbot, chatflow, or both"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List KBs accessible to current user with workspace scoping.

    ACCESS CONTROL:
    - User must be in organization
    - If workspace_id provided: Returns KBs from that specific workspace only
    - If workspace_id not provided: Returns KBs from ALL workspaces in user's organization
    - Optionally filter by context (chatbot/chatflow/both)

    WORKSPACE SCOPING:
    - workspace_id=None → All workspaces in organization
    - workspace_id=<uuid> → Specific workspace only

    Returns:
        List of KB summaries
    """

    # Build base query
    # Note: Organization filtering simplified - access validated at workspace level
    query = db.query(KnowledgeBase).join(
        KnowledgeBase.workspace
    )

    # Apply workspace filter if provided (workspace-scoped access)
    if workspace_id:
        # Verify user has access to this workspace
        from app.models.workspace import Workspace
        workspace = db.query(Workspace).filter(
            Workspace.id == workspace_id
        ).first()

        if not workspace:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Workspace not found"
            )

        # Note: Organization access check simplified - validated at workspace level

        query = query.filter(KnowledgeBase.workspace_id == workspace_id)

    # Apply status filter
    if status:
        query = query.filter(KnowledgeBase.status == status)

    # Apply context filter
    if context:
        if context not in ["chatbot", "chatflow", "both"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid context. Must be 'chatbot', 'chatflow', or 'both'"
            )
        query = query.filter(KnowledgeBase.context == context)

    # SAFETY FILTER: Hide deleting KBs from user list (soft delete behavior)
    query = query.filter(KnowledgeBase.status != "deleting")

    # Order by most recent
    kbs = query.order_by(KnowledgeBase.created_at.desc()).all()

    # Convert to response model
    return [
        KBResponse(
            id=str(kb.id),
            name=kb.name,
            description=kb.description,
            workspace_id=str(kb.workspace_id),
            status=kb.status,
            context=kb.context or "both",  # Include context field
            stats=kb.stats or {},
            # CRITICAL FIX: Populate legacy fields from stats for frontend compatibility
            total_documents=(kb.stats or {}).get("total_documents", kb.total_documents or 0),
            total_chunks=(kb.stats or {}).get("total_chunks", kb.total_chunks or 0),
            total_size_bytes=(kb.stats or {}).get("total_size_bytes", 0),
            created_at=kb.created_at.isoformat(),
            updated_at=kb.updated_at.isoformat() if kb.updated_at else None,
            created_by=str(kb.created_by)
        )
        for kb in kbs
    ]


@router.get("/{kb_id}", response_model=KBDetailResponse)
async def get_kb(
    kb_id: UUID,
    db: Session = Depends(get_db),
    user_context = Depends(get_current_user_with_org)
):
    """
    Get detailed KB information.

    ENHANCED SAFETY:
    - Blocks access to deleting KBs (HTTP 410 Gone)
    - Prevents race conditions during deletion

    ACCESS CONTROL:
    - User must be in same workspace as KB

    Returns:
        Detailed KB information including configuration
    """
    current_user, org_id, ws_id = user_context

    # SAFETY CHECK: Prevent access to deleting KBs
    kb = get_kb_with_deletion_check(kb_id, db)

    # Verify KB belongs to user's workspace
    if ws_id:
        verify_kb_workspace_access(kb, ws_id)

    # Extract stats for both new stats field and legacy compatibility fields
    kb_stats = kb.stats or {}

    # Query document source types for reindexing capability
    documents = db.query(Document).filter(Document.kb_id == kb_id).all()
    source_types = list(set(doc.source_type for doc in documents if doc.source_type))

    # Determine reindexing capability based on source types
    # File uploads CAN be reindexed if originals are stored in MinIO (file_path set)
    file_upload_docs = [doc for doc in documents if doc.source_type == "file_upload"]
    file_uploads_without_original = [doc for doc in file_upload_docs if not doc.file_path]

    can_reindex = len(file_uploads_without_original) == 0
    reindex_warning = None
    if file_uploads_without_original:
        reindex_warning = (
            f"{len(file_uploads_without_original)} file upload(s) do not have original files "
            "stored. Reindexing is not available for these documents."
        )

    return KBDetailResponse(
        id=str(kb.id),
        name=kb.name,
        description=kb.description,
        workspace_id=str(kb.workspace_id),
        status=kb.status,
        context=kb.context or "both",  # Include context field
        config=kb.config or {},
        embedding_config=kb.embedding_config or {},
        vector_store_config=kb.vector_store_config or {},
        indexing_method=kb.indexing_method or "by_heading",
        stats=kb_stats,
        # CRITICAL FIX: Populate legacy fields from stats for frontend compatibility
        total_documents=kb_stats.get("total_documents", kb.total_documents or 0),
        total_chunks=kb_stats.get("total_chunks", kb.total_chunks or 0),
        error_message=kb.error_message,
        created_at=kb.created_at.isoformat(),
        updated_at=kb.updated_at.isoformat() if kb.updated_at else None,
        created_by=str(kb.created_by),
        # Reindexing capability
        source_types=source_types,
        can_reindex=can_reindex,
        reindex_warning=reindex_warning
    )


@router.delete("/{kb_id}")
async def delete_kb(
    kb_id: UUID,
    db: Session = Depends(get_db),
    user_context = Depends(get_current_user_with_org)
):
    """
    Delete a KB and all associated data.

    ENHANCED IMPLEMENTATION:
    - IMMEDIATE: Soft delete (mark as "deleting") for instant UI feedback
    - BACKGROUND: Full cleanup of Qdrant and hard database deletion

    ACCESS CONTROL:
    - User must be in same organization
    - Only creator or org admin can delete (future: add role check)

    FLOW:
    1. Validate KB exists and user has access
    2. IMMEDIATELY mark KB as "deleting" status
    3. Queue background task for complete cleanup
    4. Return success - user sees KB removed instantly

    Returns:
        Success message with immediate deletion confirmation
    """

    current_user, org_id, ws_id = user_context

    kb = db.query(KnowledgeBase).filter(
        KnowledgeBase.id == kb_id
    ).first()

    if not kb:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Knowledge base not found"
        )

    # Verify KB belongs to user's workspace
    if ws_id:
        verify_kb_workspace_access(kb, ws_id)

    # Prevent deletion of already deleting KBs
    if kb.status == "deleting":
        return {
            "message": f"KB '{kb.name}' is already being deleted",
            "kb_id": str(kb_id),
            "status": "already_deleting"
        }

    try:
        # STEP 1: IMMEDIATE SOFT DELETE
        # Mark KB as deleting so it disappears from user's view instantly
        kb.status = "deleting"
        kb.error_message = f"Deletion initiated by {current_user.username} (ID: {current_user.id}) at {datetime.utcnow().isoformat()}"
        kb.updated_at = datetime.utcnow()

        # Commit immediately - user sees deletion right away
        db.commit()

        print(f"✅ KB {kb_id} marked as deleting by user {current_user.username} (ID: {current_user.id})")

        # STEP 2: QUEUE BACKGROUND CLEANUP
        # Background task will handle Qdrant cleanup + hard database deletion
        from app.tasks.kb_maintenance_tasks import manual_cleanup_kb_task

        task = manual_cleanup_kb_task.apply_async(
            kwargs={
                "kb_id": str(kb_id),
                "initiated_by": current_user.username,
                "deleted_at": datetime.utcnow().isoformat()
            },
            queue="low_priority"
        )

        print(f"🚀 Queued background cleanup task {task.id} for KB {kb_id}")

        return {
            "message": f"KB '{kb.name}' has been deleted",
            "kb_id": str(kb_id),
            "status": "deleted",
            "cleanup_task_id": task.id,
            "note": "External resources are being cleaned up in the background"
        }

    except Exception as e:
        # Rollback soft delete if background task queuing fails
        db.rollback()
        print(f"❌ Failed to delete KB {kb_id}: {str(e)}")

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete KB: {str(e)}"
        )


@router.patch("/{kb_id}", response_model=KBDetailResponse)
async def update_kb(
    kb_id: UUID,
    request: UpdateKBRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update KB general settings (name, description, context).

    NOTE: This does NOT trigger reindexing. For configuration changes
    that require reprocessing (chunking, embedding, vector store),
    use the /reindex endpoint instead.

    Returns:
        Updated KB details
    """

    kb = db.query(KnowledgeBase).filter(
        KnowledgeBase.id == kb_id
    ).first()

    if not kb:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Knowledge base not found"
        )

    # Update fields if provided
    if request.name is not None:
        kb.name = request.name.strip()

    if request.description is not None:
        kb.description = request.description.strip() if request.description else None

    if request.context is not None:
        valid_contexts = ["chatbot", "chatflow", "both"]
        if request.context not in valid_contexts:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid context. Must be one of: {valid_contexts}"
            )
        kb.context = request.context

    kb.updated_at = datetime.utcnow()

    try:
        db.commit()
        db.refresh(kb)

        # Match GET endpoint response structure exactly
        kb_stats = kb.stats or {}

        # Query document source types for reindexing capability (same logic as GET)
        documents = db.query(Document).filter(Document.kb_id == kb_id).all()
        source_types = list(set(doc.source_type for doc in documents if doc.source_type))

        file_upload_docs = [doc for doc in documents if doc.source_type == "file_upload"]
        file_uploads_without_original = [doc for doc in file_upload_docs if not doc.file_path]

        can_reindex = len(file_uploads_without_original) == 0
        reindex_warning = None
        if file_uploads_without_original:
            reindex_warning = (
                f"{len(file_uploads_without_original)} file upload(s) do not have original files "
                "stored. Reindexing is not available for these documents."
            )

        return KBDetailResponse(
            id=str(kb.id),
            name=kb.name,
            description=kb.description,
            workspace_id=str(kb.workspace_id),
            status=kb.status,
            context=kb.context or "both",
            config=kb.config or {},
            embedding_config=kb.embedding_config or {},
            vector_store_config=kb.vector_store_config or {},
            indexing_method=kb.indexing_method or "by_heading",
            stats=kb_stats,
            total_documents=kb_stats.get("total_documents", kb.total_documents or 0),
            total_chunks=kb_stats.get("total_chunks", kb.total_chunks or 0),
            error_message=kb.error_message,
            created_at=kb.created_at.isoformat() if kb.created_at else None,
            updated_at=kb.updated_at.isoformat() if kb.updated_at else None,
            created_by=str(kb.created_by),
            source_types=source_types,
            can_reindex=can_reindex,
            reindex_warning=reindex_warning
        )

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update KB: {str(e)}"
        )


# ========================================
# MANAGEMENT ENDPOINTS
# ========================================

@router.post("/{kb_id}/reindex")
async def reindex_kb(
    kb_id: UUID,
    request: Optional[ReindexRequest] = None,
    db: Session = Depends(get_db),
    user_context = Depends(get_current_user_with_org)
):
    """
    Manually trigger KB re-indexing with optional configuration updates.

    WHY: Keep embeddings fresh for frequently changing websites OR apply new chunking configuration
    HOW: Queues high-priority Celery task with optional configuration

    REQUEST BODY (optional):
    {
        "chunking_config": {
            "strategy": "by_heading",
            "chunk_size": 1000,
            "chunk_overlap": 200,
            "preserve_headings": true,
            "min_chunk_size": 100,
            "max_chunk_size": 5000
        },
        "embedding_config": {...},
        "vector_store_config": {...}
    }

    ACCESS CONTROL:
    - User must be in same organization
    - Only creator or org admin can re-index (future: add role check)

    FLOW:
    1. Verify KB exists and user has access
    2. Check KB is in re-indexable state
    3. Update KB configuration if provided
    4. Queue reindex_kb_task (high priority)
    5. Return task ID for tracking

    Returns:
        {
            "message": str,
            "kb_id": str,
            "status": "queued",
            "configuration_updated": bool
        }
    """

    current_user, org_id, ws_id = user_context

    # SAFETY CHECK: Prevent reindexing of deleting KBs
    kb = get_kb_with_deletion_check(kb_id, db)

    # Verify KB belongs to user's workspace
    if ws_id:
        verify_kb_workspace_access(kb, ws_id)

    # Check if KB is in re-indexable state
    # Include "reindexing" to allow retry when tasks crash/fail silently
    if kb.status not in ["ready", "ready_with_warnings", "failed", "reindexing"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot re-index KB with status '{kb.status}'. Wait for current processing to complete."
        )

    # Check if KB has file uploads without originals stored in MinIO
    # File uploads with file_path (MinIO) CAN be reindexed; those without cannot
    documents = db.query(Document).filter(Document.kb_id == kb_id).all()
    file_upload_docs = [doc for doc in documents if doc.source_type == "file_upload"]
    file_uploads_without_original = [doc for doc in file_upload_docs if not doc.file_path]
    if file_uploads_without_original:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Cannot reindex KB: {len(file_uploads_without_original)} file upload(s) "
                "do not have original files stored. Only file uploads with originals in "
                "object storage can be rechunked."
            )
        )

    # Update configuration if provided
    # NOTE: chunking_config is stored inside kb.config, not as a direct attribute
    configuration_updated = False
    if request:
        if request.chunking_config:
            # Store chunking_config inside kb.config dict
            if kb.config is None:
                kb.config = {}
            kb.config = {**kb.config, "chunking_config": request.chunking_config}
            configuration_updated = True
        if request.embedding_config:
            kb.embedding_config = request.embedding_config
            configuration_updated = True
        if request.vector_store_config:
            kb.vector_store_config = request.vector_store_config
            configuration_updated = True

        if configuration_updated:
            db.commit()

    # Queue re-indexing task (high priority)
    from app.tasks.kb_pipeline_tasks import reindex_kb_task

    # Pass configuration to task if it was updated
    task_kwargs = {"kb_id": str(kb_id)}
    if configuration_updated:
        task_kwargs["new_config"] = {
            "chunking_config": request.chunking_config if request and request.chunking_config else None,
            "embedding_config": request.embedding_config if request and request.embedding_config else None,
            "vector_store_config": request.vector_store_config if request and request.vector_store_config else None
        }

    task = reindex_kb_task.apply_async(
        kwargs=task_kwargs,
        queue="high_priority"
    )

    message = f"Re-indexing queued for KB '{kb.name}'"
    if configuration_updated:
        message += " with new configuration"

    return {
        "message": message,
        "kb_id": str(kb_id),
        "task_id": task.id,
        "status": "queued",
        "configuration_updated": configuration_updated,
        "note": "Re-indexing will regenerate all embeddings and update Qdrant. This may take several minutes."
    }


class RetryRequest(BaseModel):
    """Optional request model for retry with configuration overrides"""
    config_overrides: Optional[Dict[str, Any]] = Field(None, description="Configuration overrides to apply during retry")
    preserve_existing_chunks: bool = Field(False, description="Whether to preserve existing chunks and only retry failed operations")
    retry_stages: Optional[List[str]] = Field(None, description="Specific stages to retry: ['scraping', 'chunking', 'embedding', 'indexing']")


@router.get("/{kb_id}/retry-status")
async def get_kb_retry_status(
    kb_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get the retry status for a KB - whether it can be retried and why.

    WHY: Frontend needs to know when to show retry button
    HOW: Check KB status and pipeline status for staleness

    Returns:
        {
            "can_retry": bool,
            "reason": str,
            "kb_status": str,
            "pipeline_status": str | null,
            "pipeline_age_seconds": int | null,
            "is_stale": bool,
            "stale_threshold_seconds": int,
            "retry_available_in_seconds": int | null
        }
    """
    kb = get_kb_with_deletion_check(kb_id, db)

    # Check KB status
    kb_status = kb.status
    pipeline_status = None
    pipeline_age = None
    is_stale = False
    can_retry = False
    reason = ""
    retry_available_in = None

    # Direct retry states
    if kb_status in ["failed", "error", "processing_failed"]:
        can_retry = True
        reason = f"KB failed with status: {kb_status}"
    elif kb_status == "ready":
        can_retry = False
        reason = "KB is ready - no retry needed"
    elif kb_status == "deleting":
        can_retry = False
        reason = "KB is being deleted"
    elif kb_status == "processing":
        # Check pipeline status
        pipeline_data = get_pipeline_status_for_kb(str(kb_id))
        if pipeline_data:
            pipeline_status = pipeline_data.get("status")
            pipeline_age = get_pipeline_age_seconds(pipeline_data)

            if pipeline_status == "queued":
                is_stale = is_pipeline_stale(pipeline_data)
                if is_stale:
                    can_retry = True
                    reason = f"Pipeline stuck in queue for {int(pipeline_age or 0)}s (threshold: {STALE_PIPELINE_THRESHOLD_SECONDS}s)"
                else:
                    can_retry = False
                    retry_available_in = max(0, STALE_PIPELINE_THRESHOLD_SECONDS - int(pipeline_age or 0))
                    reason = f"Pipeline queued for {int(pipeline_age or 0)}s - retry available in {retry_available_in}s"
            elif pipeline_status == "running":
                can_retry = False
                reason = "Pipeline is currently running"
            elif pipeline_status in ["completed", "failed"]:
                # Pipeline finished but KB not updated - stale state
                can_retry = True
                is_stale = True
                reason = f"Pipeline {pipeline_status} but KB status not updated"
            else:
                can_retry = False
                reason = f"Unknown pipeline status: {pipeline_status}"
        else:
            # No pipeline found - orphaned KB
            can_retry = True
            is_stale = True
            reason = "No pipeline found - orphaned KB in processing state"
    else:
        can_retry = False
        reason = f"Unknown KB status: {kb_status}"

    return {
        "can_retry": can_retry,
        "reason": reason,
        "kb_status": kb_status,
        "pipeline_status": pipeline_status,
        "pipeline_age_seconds": int(pipeline_age) if pipeline_age else None,
        "is_stale": is_stale,
        "stale_threshold_seconds": STALE_PIPELINE_THRESHOLD_SECONDS,
        "retry_available_in_seconds": retry_available_in
    }


@router.post("/{kb_id}/retry-processing")
async def retry_kb_processing(
    kb_id: UUID,
    retry_options: Optional[RetryRequest] = None,
    db: Session = Depends(get_db),
    user_context = Depends(get_current_user_with_org)
):
    """
    Enhanced retry for failed KB processing with complete state restoration.

    WHY:
    - Preserve original draft data including content approvals and edits
    - Complete state cleanup before retry to prevent corruption
    - Configuration preservation and restoration
    - Intelligent source reconstruction

    HOW:
    - Create backup of original KB state and configurations
    - Clean up all partial chunks, documents, and Qdrant vectors
    - Recreate draft with preserved user modifications
    - Execute retry with enhanced error recovery

    ACCESS CONTROL:
    - User must be in same organization as KB's workspace
    - Only retry KBs in failed/error state

    ENHANCED FLOW:
    1. Verify KB exists and user has access
    2. Check KB is in retryable state (failed/error)
    3. Create backup of current state with all configurations
    4. Clean up partial chunks, documents, and Qdrant vectors
    5. Recreate draft from backup with user modifications preserved
    6. Queue retry task with complete configuration restoration
    7. Return enhanced monitoring details

    FEATURES:
    - ✅ Draft data backup and restoration
    - ✅ Complete state cleanup (PostgreSQL + Qdrant)
    - ✅ Configuration preservation and merging
    - ✅ Source reconstruction with user modifications
    - ✅ Enhanced error recovery and logging

    Returns:
        {
            "pipeline_id": str,
            "kb_id": str,
            "status": "processing",
            "message": str,
            "backup_id": str,
            "cleanup_stats": dict,
            "retry_features": list,
            "enhanced_retry": true
        }
    """

    current_user, org_id, ws_id = user_context

    # SAFETY CHECK: Prevent retry on deleting KBs AND get KB safely
    kb = get_kb_with_deletion_check(kb_id, db)

    # Verify KB belongs to user's workspace
    if ws_id:
        verify_kb_workspace_access(kb, ws_id)

    # Check if KB is in a retryable state
    # ENHANCED: Also allow retry for stale queued pipelines (KB status "processing" but pipeline stuck in "queued")
    is_stale_queued = False
    pipeline_age = None

    if kb.status == "processing":
        # Check if pipeline is stale (queued for too long)
        pipeline_status = get_pipeline_status_for_kb(str(kb_id))
        if pipeline_status:
            is_stale_queued = is_pipeline_stale(pipeline_status)
            pipeline_age = get_pipeline_age_seconds(pipeline_status)

            if not is_stale_queued:
                # Pipeline exists and is not stale - check if it's still actively queued
                if pipeline_status.get("status") == "queued":
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail={
                            "message": f"Pipeline is still queued (age: {int(pipeline_age or 0)}s). Wait {STALE_PIPELINE_THRESHOLD_SECONDS}s before retry.",
                            "kb_status": kb.status,
                            "pipeline_status": pipeline_status.get("status"),
                            "pipeline_age_seconds": int(pipeline_age or 0),
                            "stale_threshold_seconds": STALE_PIPELINE_THRESHOLD_SECONDS,
                            "retry_available_in_seconds": max(0, STALE_PIPELINE_THRESHOLD_SECONDS - int(pipeline_age or 0))
                        }
                    )
                elif pipeline_status.get("status") == "running":
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Pipeline is currently running. Cannot retry while processing is in progress."
                    )
        else:
            # No pipeline found - KB is in processing state but no pipeline tracking
            # This is an orphaned KB - allow retry
            is_stale_queued = True
            print(f"[retry_kb_processing] KB {kb_id} has no pipeline tracking - treating as stale/orphaned")

    if kb.status not in ["failed", "error", "processing_failed"] and not is_stale_queued:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot retry KB with status '{kb.status}'. Only failed or stale KBs can be retried."
        )

    # Log retry reason
    if is_stale_queued:
        print(f"[retry_kb_processing] Retrying stale queued KB {kb_id} (age: {pipeline_age}s, status: {kb.status})")

    # Extract configuration overrides for enhanced retry
    config_overrides = None
    if retry_options and retry_options.config_overrides:
        config_overrides = retry_options.config_overrides

    try:
        # Execute enhanced retry with complete state management
        from app.services.kb_retry_service import kb_retry_service

        retry_result = kb_retry_service.execute_enhanced_retry(
            kb_id=str(kb_id),
            db=db,
            retry_config_overrides=config_overrides
        )

        # Add additional metadata from retry options
        if retry_options:
            retry_result.update({
                "retry_stages": retry_options.retry_stages or ["scraping", "chunking", "embedding", "indexing"],
                "preserve_existing_chunks": retry_options.preserve_existing_chunks,
                "original_retry_options": {
                    "config_overrides_provided": bool(retry_options.config_overrides),
                    "preserve_existing_chunks": retry_options.preserve_existing_chunks,
                    "retry_stages": retry_options.retry_stages
                }
            })

        # Mark as enhanced retry for frontend distinction
        retry_result["enhanced_retry"] = True
        retry_result["kb_name"] = kb.name

        return retry_result

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        # Log error for debugging
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Enhanced retry failed for KB {kb_id}: {str(e)}")

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Enhanced retry failed: {str(e)}"
        )


@router.get("/{kb_id}/stats")
async def get_kb_stats(
    kb_id: UUID,
    db: Session = Depends(get_db),
    user_context = Depends(get_current_user_with_org)
):
    """
    Get detailed KB statistics.

    Returns:
        {
            "kb_id": str,
            "name": str,
            "status": str,
            "documents": {
                "total": int,
                "by_status": {...}
            },
            "chunks": {
                "total": int,
                "avg_per_document": float
            },
            "storage": {
                "total_content_size": int (bytes),
                "avg_chunk_size": int (bytes)
            },
            "health": {
                "qdrant_healthy": bool,
                "vector_count_match": bool
            }
        }
    """

    current_user, org_id, ws_id = user_context

    kb = db.query(KnowledgeBase).filter(
        KnowledgeBase.id == kb_id
    ).first()

    if not kb:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Knowledge base not found"
        )

    # Verify KB belongs to user's workspace
    if ws_id:
        verify_kb_workspace_access(kb, ws_id)

    # Get document stats
    all_documents = db.query(Document).filter(
        Document.kb_id == kb_id
    ).all()

    # Get active documents (not disabled/archived) for consistency with listing endpoint
    active_documents = db.query(Document).filter(
        Document.kb_id == kb_id,
        Document.is_enabled == True,
        Document.is_archived == False
    ).all()

    doc_by_status = {}
    active_doc_by_status = {}

    for doc in all_documents:
        doc_by_status[doc.status] = doc_by_status.get(doc.status, 0) + 1

    for doc in active_documents:
        active_doc_by_status[doc.status] = active_doc_by_status.get(doc.status, 0) + 1

    # Get chunk stats
    chunks = db.query(Chunk).filter(
        Chunk.kb_id == kb_id
    ).all()

    total_content_size = sum(len(chunk.content or "") for chunk in chunks)
    avg_chunk_size = total_content_size / len(chunks) if chunks else 0

    # Health check (quick)
    try:
        from app.services.qdrant_service import qdrant_service
        import asyncio

        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

        collection_exists = loop.run_until_complete(
            qdrant_service.check_collection_exists(kb_id)
        )

        qdrant_stats = None
        if collection_exists:
            qdrant_stats = loop.run_until_complete(
                qdrant_service.get_collection_stats(kb_id)
            )

        loop.close()

        qdrant_healthy = collection_exists
        vector_count_match = (
            qdrant_stats.get("vectors_count", 0) == len(chunks)
            if qdrant_stats else False
        )

    except Exception as e:
        qdrant_healthy = False
        vector_count_match = False

    return {
        "kb_id": str(kb_id),
        "name": kb.name,
        "status": kb.status,
        "documents": {
            "total": len(all_documents),
            "active": len(active_documents),
            "by_status": doc_by_status,
            "active_by_status": active_doc_by_status
        },
        "chunks": {
            "total": len(chunks),
            "avg_per_document": len(chunks) / len(active_documents) if active_documents else 0
        },
        "storage": {
            "total_content_size": total_content_size,
            "avg_chunk_size": int(avg_chunk_size)
        },
        "health": {
            "qdrant_healthy": qdrant_healthy,
            "vector_count_match": vector_count_match
        }
    }


class RechunkPreviewRequest(BaseModel):
    """Request model for KB re-chunking preview"""
    strategy: str = Field(..., description="New chunking strategy to test")
    chunk_size: int = Field(default=1000, ge=100, le=5000, description="New chunk size")
    chunk_overlap: int = Field(default=200, ge=0, le=1000, description="New chunk overlap")
    sample_documents: int = Field(default=3, ge=1, le=10, description="Number of documents to sample for preview")


@router.post("/{kb_id}/preview-rechunk")
async def preview_kb_rechunking(
    kb_id: UUID,
    request: RechunkPreviewRequest,
    db: Session = Depends(get_db),
    user_context = Depends(get_current_user_with_org)
):
    """
    Preview re-chunking for existing KB with comparison.

    WHY: Users want to optimize chunking strategy for existing KB
    HOW: Re-chunk existing documents and compare with current state

    TYPE: KB Re-chunking Preview (Optimization)
    DURATION: 1-5 seconds (no scraping needed!)
    NON-BLOCKING: Does not modify KB or trigger re-indexing

    USE CASE:
    - KB already exists with scraped content
    - Want to optimize chunking strategy
    - Compare strategies before re-indexing
    - Test configuration changes

    BENEFITS:
    - Extremely fast (documents already scraped)
    - Direct comparison with current state
    - No re-scraping needed
    - Helps optimize existing KBs

    Returns:
        {
            "kb_id": str,
            "kb_name": str,
            "current_config": {...},
            "new_config": {...},
            "comparison": {
                "current": {
                    "total_chunks": int,
                    "avg_chunk_size": int,
                    "min_chunk_size": int,
                    "max_chunk_size": int
                },
                "new": {
                    "total_chunks": int,
                    "avg_chunk_size": int,
                    "min_chunk_size": int,
                    "max_chunk_size": int
                },
                "delta": {
                    "chunks_change": int,
                    "chunks_percent": float,
                    "avg_size_change": int,
                    "recommendation": str
                }
            },
            "sample_chunks": [...],
            "documents_analyzed": int,
            "total_documents": int,
            "note": str
        }
    """

    current_user, org_id, ws_id = user_context

    # Check KB exists
    kb = db.query(KnowledgeBase).filter(
        KnowledgeBase.id == kb_id
    ).first()

    if not kb:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Knowledge base not found"
        )

    # Verify KB belongs to user's workspace
    if ws_id:
        verify_kb_workspace_access(kb, ws_id)

    # KB must be in ready state (with documents)
    if kb.status not in ["ready", "ready_with_warnings"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"KB must be in 'ready' state for preview. Current status: {kb.status}"
        )

    # Validate strategy
    valid_strategies = [
        "recursive", "semantic", "by_heading", "by_section",
        "adaptive", "sentence_based", "paragraph_based", "hybrid"
    ]
    if request.strategy not in valid_strategies:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid strategy. Must be one of: {', '.join(valid_strategies)}"
        )

    try:
        from app.services.preview_service import preview_service

        preview_data = await preview_service.preview_rechunking_for_kb(
            db_session=db,
            kb_id=str(kb_id),
            strategy=request.strategy,
            chunk_size=request.chunk_size,
            chunk_overlap=request.chunk_overlap,
            sample_documents=request.sample_documents
        )

        if "error" in preview_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=preview_data.get("message", "Preview generation failed")
            )

        return preview_data

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Preview generation failed: {str(e)}"
        )


# ========================================
# KB INSPECTION ENDPOINTS (View Documents & Chunks)
# ========================================

class DocumentResponse(BaseModel):
    """Response model for document summary"""
    id: str
    name: str
    url: Optional[str]
    source_type: str
    status: str
    content_preview: Optional[str]
    word_count: int
    character_count: int
    chunk_count: int
    created_at: str
    updated_at: str
    created_by: str

    class Config:
        from_attributes = True


class DocumentDetailResponse(BaseModel):
    """Response model for detailed document"""
    id: str
    kb_id: str
    name: str
    url: Optional[str]
    source_type: str
    source_metadata: dict
    content: str
    content_preview: Optional[str]
    status: str
    processing_metadata: Optional[dict]
    word_count: int
    character_count: int
    chunk_count: int
    custom_metadata: dict
    annotations: Optional[dict]
    is_enabled: bool
    is_archived: bool
    created_at: str
    updated_at: str
    created_by: str

    class Config:
        from_attributes = True


class ChunkResponse(BaseModel):
    """Response model for chunk"""
    id: str
    document_id: str
    document_name: str
    document_url: Optional[str]
    content: str
    position: int
    page_number: Optional[int]
    word_count: int
    character_count: int
    is_enabled: bool
    created_at: str

    class Config:
        from_attributes = True


@router.get("/{kb_id}/documents")
async def list_kb_documents(
    kb_id: UUID,
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    status: Optional[str] = Query(None, description="Filter by status"),
    source_type: Optional[str] = Query(None, description="Filter by source type"),
    search: Optional[str] = Query(None, description="Search in document names/URLs"),
    include_disabled: bool = Query(False, description="Include disabled documents"),
    include_archived: bool = Query(False, description="Include archived documents"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List all documents in a knowledge base with filtering and pagination.

    WHY: Allow users to inspect what documents are in their KB
    HOW: Query PostgreSQL with filters, use RBAC for access control

    ACCESS CONTROL:
    - Requires "read" permission on KB (via kb_rbac_service)
    - KB creator, workspace admin, or KB members can access

    Query Parameters:
        - page: Page number (default: 1)
        - limit: Items per page (default: 20, max: 100)
        - status: Filter by status (pending, processing, completed, failed)
        - source_type: Filter by source (web_scraping, file_upload, text_input)
        - search: Search in document names/URLs
        - include_disabled: Show disabled documents (default: false)
        - include_archived: Show archived documents (default: false)

    Returns:
        {
            "kb_id": str,
            "total_documents": int,
            "page": int,
            "limit": int,
            "total_pages": int,
            "documents": [...]
        }
    """

    from app.services.kb_rbac_service import verify_kb_access

    # Verify user has read access
    kb = verify_kb_access(db, kb_id, current_user.id, "read")

    # Build query
    query = db.query(Document).filter(Document.kb_id == kb_id)

    # Apply filters
    if status:
        query = query.filter(Document.status == status)

    if source_type:
        query = query.filter(Document.source_type == source_type)

    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            (Document.name.ilike(search_pattern)) |
            (Document.source_url.ilike(search_pattern))
        )

    # Filter disabled/archived by default
    if not include_disabled:
        query = query.filter(Document.is_enabled == True)

    if not include_archived:
        query = query.filter(Document.is_archived == False)

    # Only admins can see disabled/archived
    if include_disabled or include_archived:
        from app.services.kb_rbac_service import has_kb_permission
        if not has_kb_permission(db, kb_id, current_user.id, "manage_members"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only KB admins can view disabled/archived documents"
            )

    # Get total count
    total_documents = query.count()

    # Apply pagination
    total_pages = (total_documents + limit - 1) // limit if total_documents > 0 else 0
    offset = (page - 1) * limit

    documents = query.order_by(Document.created_at.desc()).offset(offset).limit(limit).all()

    # Format response
    return {
        "kb_id": str(kb_id),
        "total_documents": total_documents,
        "page": page,
        "limit": limit,
        "total_pages": total_pages,
        "documents": [
            DocumentResponse(
                id=str(doc.id),
                name=doc.name,
                url=doc.source_url,
                source_type=doc.source_type,
                status=doc.status,
                content_preview=doc.content_preview,
                word_count=doc.word_count,
                character_count=doc.character_count,
                chunk_count=doc.chunk_count,
                created_at=doc.created_at.isoformat(),
                updated_at=doc.updated_at.isoformat(),
                created_by=str(doc.created_by)
            ).dict()
            for doc in documents
        ],
        "filters_applied": {
            "status": status,
            "source_type": source_type,
            "search": search,
            "include_disabled": include_disabled,
            "include_archived": include_archived
        }
    }


@router.get("/{kb_id}/documents/{doc_id}")
async def get_kb_document(
    kb_id: UUID,
    doc_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get full document details including complete content.

    WHY: Allow users to view complete document content for inspection
    HOW: Query PostgreSQL, use RBAC for access control

    ACCESS CONTROL:
    - Requires "read" permission on KB
    - Returns full markdown content

    Returns:
        {
            "id": str,
            "kb_id": str,
            "name": str,
            "content": str (full markdown),
            "status": str,
            ...
        }
    """

    from app.services.kb_rbac_service import verify_kb_access

    # Verify user has read access
    kb = verify_kb_access(db, kb_id, current_user.id, "read")

    # Get document
    document = db.query(Document).filter(
        Document.id == doc_id,
        Document.kb_id == kb_id
    ).first()

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found in this knowledge base"
        )

    # Return full document details
    return DocumentDetailResponse(
        id=str(document.id),
        kb_id=str(document.kb_id),
        name=document.name,
        url=document.source_url,
        source_type=document.source_type,
        source_metadata=document.source_metadata or {},
        content=document.content_full or document.content_preview or "",  # Use full content for document view/edit
        content_preview=document.content_preview,
        status=document.status,
        processing_metadata=document.processing_metadata,
        word_count=document.word_count,
        character_count=document.character_count,
        chunk_count=document.chunk_count,
        custom_metadata=document.custom_metadata or {},
        annotations=document.annotations,
        is_enabled=document.is_enabled,
        is_archived=document.is_archived,
        created_at=document.created_at.isoformat(),
        updated_at=document.updated_at.isoformat(),
        created_by=str(document.created_by)
    ).dict()


@router.get("/{kb_id}/chunks")
async def list_kb_chunks(
    kb_id: UUID,
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    document_id: Optional[UUID] = Query(None, description="Filter by document ID"),
    search: Optional[str] = Query(None, description="Search in chunk content"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List all chunks in a knowledge base with filtering and pagination.

    WHY: Allow users to inspect actual chunks being used for search/RAG
    HOW: Query PostgreSQL chunks table with joins

    ACCESS CONTROL:
    - Requires "read" permission on KB
    - Shows chunks from all documents user can access

    Query Parameters:
        - page: Page number (default: 1)
        - limit: Items per page (default: 20, max: 100)
        - document_id: Filter chunks from specific document
        - search: Search in chunk content

    Returns:
        {
            "kb_id": str,
            "total_chunks": int,
            "page": int,
            "limit": int,
            "total_pages": int,
            "chunks": [...]
        }
    """

    from app.services.kb_rbac_service import verify_kb_access

    # Verify user has read access
    kb = verify_kb_access(db, kb_id, current_user.id, "read")

    # Build query with document join
    query = db.query(Chunk).join(
        Document, Chunk.document_id == Document.id
    ).filter(Chunk.kb_id == kb_id)

    # Apply filters
    if document_id:
        # Verify document belongs to this KB
        doc_exists = db.query(Document).filter(
            Document.id == document_id,
            Document.kb_id == kb_id
        ).first()

        if not doc_exists:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Document not found in this knowledge base"
            )

        query = query.filter(Chunk.document_id == document_id)

    if search:
        search_pattern = f"%{search}%"
        query = query.filter(Chunk.content.ilike(search_pattern))

    # Get total count
    total_chunks = query.count()

    # Apply pagination
    total_pages = (total_chunks + limit - 1) // limit if total_chunks > 0 else 0
    offset = (page - 1) * limit

    chunks = query.order_by(Chunk.document_id, Chunk.position).offset(offset).limit(limit).all()

    # Format response
    return {
        "kb_id": str(kb_id),
        "total_chunks": total_chunks,
        "page": page,
        "limit": limit,
        "total_pages": total_pages,
        "chunks": [
            ChunkResponse(
                id=str(chunk.id),
                document_id=str(chunk.document_id),
                document_name=chunk.document.name,
                document_url=chunk.document.source_url,
                content=chunk.content,
                position=chunk.position,
                page_number=chunk.page_number,
                word_count=chunk.word_count,
                character_count=chunk.character_count,
                is_enabled=chunk.is_enabled,
                created_at=chunk.created_at.isoformat()
            ).dict()
            for chunk in chunks
        ],
        "filters_applied": {
            "document_id": str(document_id) if document_id else None,
            "search": search
        }
    }


# ========================================
# DOCUMENT CRUD OPERATIONS
# ========================================

class CreateDocumentRequest(BaseModel):
    """Request model for creating a document"""
    name: str = Field(..., min_length=1, max_length=500, description="Document name")
    content: str = Field(..., min_length=50, description="Document content (markdown)")
    source_type: str = Field(default="text_input", description="Source type")
    custom_metadata: Optional[dict] = Field(default=None, description="Custom metadata")
    annotations: Optional[dict] = Field(default=None, description="Document annotations")

    class Config:
        json_schema_extra = {
            "example": {
                "name": "API Integration Guide",
                "content": "# API Integration\n\n## Overview\n\nThis guide covers...",
                "source_type": "text_input",
                "custom_metadata": {
                    "category": "guide",
                    "importance": "high"
                },
                "annotations": {
                    "enabled": True,
                    "category": "guide",
                    "importance": "high",
                    "tags": ["api", "integration"]
                }
            }
        }


class UpdateDocumentRequest(BaseModel):
    """Request model for updating a document"""
    name: Optional[str] = Field(None, min_length=1, max_length=500)
    content: Optional[str] = Field(None, min_length=50)
    custom_metadata: Optional[dict] = None
    annotations: Optional[dict] = None
    is_enabled: Optional[bool] = None

    class Config:
        json_schema_extra = {
            "example": {
                "name": "Updated API Guide",
                "content": "# Updated Content\n\nNew information...",
                "custom_metadata": {
                    "version": "2.0"
                }
            }
        }


@router.post("/{kb_id}/documents", status_code=status.HTTP_201_CREATED)
async def create_kb_document(
    kb_id: UUID,
    request: CreateDocumentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Manually create a new document in the KB.

    WHY: Allow users to add custom content to KB without web scraping
    HOW: Create document, queue background processing for chunking/embedding

    ACCESS CONTROL:
    - Requires "edit" permission on KB
    - KB creator, workspace admin, KB admin, or KB editor can create

    PROCESSING FLOW:
    1. Validate input (content length, format)
    2. Create Document record (status: "processing")
    3. Queue background task: process_document_task
    4. Task does: chunk → embed → index in Qdrant
    5. Update status to "completed"

    Limits:
    - Content: 50 chars min, 10MB max
    - Name: 1-500 characters

    Returns:
        {
            "id": str,
            "kb_id": str,
            "name": str,
            "status": "processing",
            "message": str,
            "processing_job_id": str
        }
    """

    from app.services.kb_rbac_service import verify_kb_access

    # Verify user has edit access
    kb = verify_kb_access(db, kb_id, current_user.id, "edit")

    # Validation
    MAX_CONTENT_SIZE = 10 * 1024 * 1024  # 10MB
    if len(request.content) > MAX_CONTENT_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Content too large (max {MAX_CONTENT_SIZE / 1024 / 1024}MB)"
        )

    if len(request.content.strip()) < 50:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Content too short (min 50 characters)"
        )

    # Check document limit per KB (optional - can be configured)
    MAX_DOCUMENTS_PER_KB = 10000
    doc_count = db.query(Document).filter(Document.kb_id == kb_id).count()
    if doc_count >= MAX_DOCUMENTS_PER_KB:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"KB document limit reached ({MAX_DOCUMENTS_PER_KB})"
        )

    # CRITICAL: Check if this is a file-upload-only KB
    # File-upload KBs should only accept file uploads, not text documents
    existing_docs = db.query(Document).filter(Document.kb_id == kb_id).all()
    is_file_upload_kb = len(existing_docs) > 0 and all(
        doc.source_type == "file_upload" for doc in existing_docs
    )

    if is_file_upload_kb:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This knowledge base was created with file uploads. Text documents cannot be added. Please use the file upload feature instead."
        )

    # Create document record
    try:
        new_document = Document(
            kb_id=kb_id,
            workspace_id=kb.workspace_id,
            name=request.name,
            source_type=request.source_type,
            source_url=None,
            source_metadata={"created_via": "api", "method": "manual_creation"},
            content_full=request.content,  # Store full content
            content_preview=request.content[:500] if len(request.content) > 500 else request.content,
            status="processing",
            processing_progress=0,
            word_count=len(request.content.split()),
            character_count=len(request.content),
            chunk_count=0,
            custom_metadata=request.custom_metadata or {},
            annotations=request.annotations,
            is_enabled=True,
            is_archived=False,
            created_by=current_user.id
        )

        db.add(new_document)
        db.commit()
        db.refresh(new_document)

        # Store full content in a separate location or directly process it
        # For now, we'll pass it to the background task

        # Queue background processing task
        from app.tasks.document_processing_tasks import process_document_task

        task = process_document_task.apply_async(
            kwargs={
                "document_id": str(new_document.id),
                "content": request.content,
                "kb_config": kb.config or {}
            },
            queue="default"
        )

        # Return full document structure matching the GET endpoint
        return DocumentDetailResponse(
            id=str(new_document.id),
            kb_id=str(new_document.kb_id),
            name=new_document.name,
            url=new_document.source_url,
            source_type=new_document.source_type,
            source_metadata=new_document.source_metadata or {},
            content=new_document.content_full or new_document.content_preview or "",
            content_preview=new_document.content_preview,
            status=new_document.status,
            processing_metadata=new_document.processing_metadata,
            word_count=new_document.word_count,
            character_count=new_document.character_count,
            chunk_count=new_document.chunk_count,
            custom_metadata=new_document.custom_metadata or {},
            annotations=new_document.annotations,
            is_enabled=new_document.is_enabled,
            is_archived=new_document.is_archived,
            created_at=new_document.created_at.isoformat() if new_document.created_at else None,
            updated_at=new_document.updated_at.isoformat() if new_document.updated_at else None,
            created_by=str(new_document.created_by)
        ).dict()

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create document: {str(e)}"
        )


@router.post("/{kb_id}/documents/upload", status_code=status.HTTP_201_CREATED)
async def upload_kb_document(
    kb_id: UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Upload a file as a new document to the KB.

    WHY: Allow users to upload files (PDF, Word, Text, etc.) to KB
    HOW: Parse file content, create document, queue background processing

    ACCESS CONTROL:
    - Requires "edit" permission on KB
    - Same access control as text document creation

    PROCESSING FLOW:
    1. Validate file size and type
    2. Parse file content using document processing service
    3. Create Document record (status: "processing")
    4. Queue background task: process_document_task
    5. Task does: chunk → embed → index in Qdrant
    6. Update status to "completed"

    Supported formats:
    - PDF, Word (.doc, .docx)
    - Text (.txt, .md)
    - CSV, JSON

    Limits:
    - File size: 10MB max
    - Content: 50 chars min after parsing

    Returns:
        {
            "id": str,
            "kb_id": str,
            "name": str,
            "status": "processing",
            "message": str,
            "processing_job_id": str
        }
    """

    from app.services.kb_rbac_service import verify_kb_access

    # Verify user has edit access
    kb = verify_kb_access(db, kb_id, current_user.id, "edit")

    # File validation - basic checks
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No filename provided"
        )

    # Read file content first
    try:
        content = await file.read()

        if len(content) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Empty file"
            )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to read file: {str(e)}"
        )

    # Check document limit per KB
    MAX_DOCUMENTS_PER_KB = 10000
    doc_count = db.query(Document).filter(Document.kb_id == kb_id).count()
    if doc_count >= MAX_DOCUMENTS_PER_KB:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"KB document limit reached ({MAX_DOCUMENTS_PER_KB})"
        )

    # CRITICAL: Detect if this KB is a file-upload-only KB BEFORE parsing
    # This determines which parsing strategy and file size limit to use:
    # - File-upload KBs: Use Tika for robust parsing (PDF, Word, etc.), 50MB limit
    # - Web URL KBs: Use simple parsing (.txt, .md, .json, .csv), 10MB limit
    existing_docs = db.query(Document).filter(Document.kb_id == kb_id).all()
    is_file_upload_kb = len(existing_docs) > 0 and all(
        doc.source_type == "file_upload" for doc in existing_docs
    )

    # File size validation - different limits based on KB type
    MAX_FILE_SIZE_WEB_URL = 10 * 1024 * 1024   # 10MB for web URL KBs
    MAX_FILE_SIZE_FILE_UPLOAD = 50 * 1024 * 1024  # 50MB for file-upload KBs
    max_file_size = MAX_FILE_SIZE_FILE_UPLOAD if is_file_upload_kb else MAX_FILE_SIZE_WEB_URL

    if len(content) > max_file_size:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large (max {max_file_size / 1024 / 1024:.0f}MB for {'file upload' if is_file_upload_kb else 'web URL'} knowledge bases)"
        )

    file_extension = file.filename.lower().split('.')[-1] if '.' in file.filename else ''
    document_title = file.filename.rsplit('.', 1)[0] if '.' in file.filename else file.filename

    # Content extraction - strategy depends on KB type
    try:
        if is_file_upload_kb:
            # ROBUST PARSING: File-upload-only KBs use Tika for 15+ formats
            # This matches the original KB creation flow
            from app.services.tika_service import tika_service
            from io import BytesIO

            try:
                parsed_file = await tika_service.parse_file(
                    file_stream=BytesIO(content),
                    filename=file.filename,
                    metadata_only=False
                )
                parsed_content = parsed_file.content
                document_title = parsed_file.metadata.get("title", document_title) or document_title

                print(f"[KB Upload] Tika parsed file: {file.filename}, {len(parsed_content)} chars")
            except Exception as tika_error:
                print(f"[KB Upload] Tika parsing failed: {tika_error}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Failed to parse file with Tika: {str(tika_error)}"
                )
        else:
            # SIMPLE PARSING: Web URL KBs use simple text extraction
            # Only supports .txt, .md, .json, .csv
            if file_extension in ['txt', 'md']:
                # Plain text files
                parsed_content = content.decode('utf-8', errors='ignore')

            elif file_extension == 'json':
                # JSON files
                json_data = json.loads(content.decode('utf-8'))
                parsed_content = json.dumps(json_data, indent=2)

            elif file_extension == 'csv':
                # CSV files
                import csv
                import io

                csv_content = content.decode('utf-8', errors='ignore')
                csv_reader = csv.reader(io.StringIO(csv_content))
                parsed_content = "\n".join([", ".join(row) for row in csv_reader])

            else:
                # Unsupported file type for web URL KBs
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Unsupported file format for web URL knowledge bases: .{file_extension}. "
                           f"Supported formats: .txt, .md, .json, .csv. "
                           f"For more file formats (PDF, Word, etc.), create a new KB using file upload."
                )

        if len(parsed_content.strip()) < 50:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File content too short after parsing (min 50 characters)"
            )

    except HTTPException:
        raise
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid JSON format in file"
        )
    except UnicodeDecodeError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unable to decode file content. Please ensure file is in UTF-8 format"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to parse file: {str(e)}"
        )

    # Create approved_sources structure for file uploads (matches finalization flow)
    approved_sources = [{
        "url": f"file://{file.filename}",
        "title": document_title,
        "content": parsed_content,
        "markdown": parsed_content,
        "is_edited": False,
        "source": "file_upload",
        "metadata": {
            "filename": file.filename,
            "content_type": file.content_type,
            "file_size": len(content),
        },
        "approved_at": datetime.utcnow().isoformat(),
        "approved_by": str(current_user.id)
    }]

    # Create document record with proper storage pattern based on KB type
    # - Web URL KBs: Store content in PostgreSQL (consistent with text documents)
    # - File Upload KBs: No content in PostgreSQL (Qdrant-only for privacy)
    try:
        new_document = Document(
            kb_id=kb_id,
            workspace_id=kb.workspace_id,
            name=document_title,
            source_type="file_upload",
            source_url=f"file:///{file.filename}",  # Triple slash to match pipeline tasks
            source_metadata={
                "filename": file.filename,
                "content_type": file.content_type,
                "file_size": len(content),
                "uploaded_by": str(current_user.id),
                "created_via": "api",
                "method": "file_upload",
                "approved_sources": approved_sources  # Store content in metadata for processing
            },
            # Storage pattern based on KB type:
            # - Web URL KBs: Store content (like text documents) for consistency
            # - File Upload KBs: No content in PostgreSQL (Qdrant-only)
            content_full=parsed_content if not is_file_upload_kb else None,
            content_preview=(parsed_content[:500] if len(parsed_content) > 500 else parsed_content) if not is_file_upload_kb else None,
            status="processing",
            processing_progress=0,
            word_count=len(parsed_content.split()),
            character_count=len(parsed_content),
            chunk_count=0,
            custom_metadata={"original_filename": file.filename},
            annotations=None,
            is_enabled=True,
            is_archived=False,
            created_by=current_user.id
        )

        db.add(new_document)
        db.commit()
        db.refresh(new_document)

        # Queue background processing with file upload flow
        # Use the same task that handles file uploads with KB config inheritance
        from app.tasks.document_processing_tasks import process_file_upload_document_task

        task = process_file_upload_document_task.apply_async(
            kwargs={
                "document_id": str(new_document.id),
                "content": parsed_content,
                "kb_config": kb.config or {},
                "chunking_config": kb.config.get("chunking_config", {}) if kb.config else {},
                "embedding_config": kb.embedding_config or {},
                "skip_postgres_chunks": is_file_upload_kb  # Metadata-only storage for file upload KBs
            },
            queue="default"
        )

        # Return full document structure matching the GET endpoint
        return DocumentDetailResponse(
            id=str(new_document.id),
            kb_id=str(new_document.kb_id),
            name=new_document.name,
            url=new_document.source_url,
            source_type=new_document.source_type,
            source_metadata=new_document.source_metadata or {},
            content=new_document.content_full or new_document.content_preview or "",
            content_preview=new_document.content_preview,
            status=new_document.status,
            processing_metadata=new_document.processing_metadata,
            word_count=new_document.word_count,
            character_count=new_document.character_count,
            chunk_count=new_document.chunk_count,
            custom_metadata=new_document.custom_metadata or {},
            annotations=new_document.annotations,
            is_enabled=new_document.is_enabled,
            is_archived=new_document.is_archived,
            created_at=new_document.created_at.isoformat() if new_document.created_at else None,
            updated_at=new_document.updated_at.isoformat() if new_document.updated_at else None,
            created_by=str(new_document.created_by)
        ).dict()

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create document: {str(e)}"
        )


@router.put("/{kb_id}/documents/{doc_id}")
async def update_kb_document(
    kb_id: UUID,
    doc_id: UUID,
    request: UpdateDocumentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update document content (triggers re-processing).

    WHY: Allow users to edit document content
    HOW: Update document, delete old chunks, queue reprocessing

    ACCESS CONTROL:
    - Requires "edit" permission on KB

    CRITICAL FLOW (Edge Case Handling):
    1. Update document content in PostgreSQL
    2. Set status = "processing"
    3. Delete old chunks from PostgreSQL
    4. Delete old vectors from Qdrant
    5. Queue background task: reprocess_document_task
    6. Task does: re-chunk → re-embed → re-index

    IMPORTANT:
    - Old chunks MUST be deleted before new ones are created
    - Qdrant and PostgreSQL MUST stay in sync
    - If Qdrant delete fails, document is marked for retry

    Returns:
        {
            "id": str,
            "kb_id": str,
            "status": "processing",
            "message": str,
            "processing_job_id": str
        }
    """

    from app.services.kb_rbac_service import verify_kb_access

    # Verify user has edit access
    kb = verify_kb_access(db, kb_id, current_user.id, "edit")

    # Get document
    document = db.query(Document).filter(
        Document.id == doc_id,
        Document.kb_id == kb_id
    ).first()

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found in this knowledge base"
        )

    # Validate content if provided
    if request.content:
        MAX_CONTENT_SIZE = 10 * 1024 * 1024  # 10MB
        if len(request.content) > MAX_CONTENT_SIZE:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"Content too large (max {MAX_CONTENT_SIZE / 1024 / 1024}MB)"
            )

        if len(request.content.strip()) < 50:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Content too short (min 50 characters)"
            )

    try:
        # Determine if we need full reprocessing
        needs_reprocessing = request.content is not None

        # Update document fields
        if request.name:
            document.name = request.name

        if request.custom_metadata is not None:
            document.custom_metadata = request.custom_metadata

        if request.annotations is not None:
            document.annotations = request.annotations

        if request.is_enabled is not None:
            document.is_enabled = request.is_enabled
            # Update chunks' is_enabled status
            db.query(Chunk).filter(Chunk.document_id == doc_id).update(
                {"is_enabled": request.is_enabled}
            )

        if needs_reprocessing:
            # Update content fields
            document.content_full = request.content  # Store full content
            document.content_preview = request.content[:500] if len(request.content) > 500 else request.content
            document.word_count = len(request.content.split())
            document.character_count = len(request.content)
            document.status = "processing"
            document.processing_progress = 0
            document.error_message = None

            db.commit()

            # CRITICAL: Delete old chunks and Qdrant vectors
            # This is done in the background task to handle errors properly

            # Queue reprocessing task
            from app.tasks.document_processing_tasks import reprocess_document_task

            task = reprocess_document_task.apply_async(
                kwargs={
                    "document_id": str(doc_id),
                    "new_content": request.content,
                    "kb_config": kb.config or {}
                },
                queue="default"
            )

            # Return consistent document structure matching GET endpoint
            return DocumentDetailResponse(
                id=str(document.id),
                kb_id=str(document.kb_id),
                name=document.name,
                url=document.source_url,
                source_type=document.source_type,
                source_metadata=document.source_metadata or {},
                content=document.content_full or document.content_preview or "",
                content_preview=document.content_preview,
                status=document.status,
                processing_metadata=document.processing_metadata,
                word_count=document.word_count,
                character_count=document.character_count,
                chunk_count=document.chunk_count,
                custom_metadata=document.custom_metadata or {},
                annotations=document.annotations,
                is_enabled=document.is_enabled,
                is_archived=document.is_archived,
                created_at=document.created_at.isoformat() if document.created_at else None,
                updated_at=document.updated_at.isoformat() if document.updated_at else None,
                created_by=str(document.created_by)
            ).dict()
        else:
            # No reprocessing needed - just metadata update
            db.commit()

            # Return consistent document structure matching GET endpoint
            return DocumentDetailResponse(
                id=str(document.id),
                kb_id=str(document.kb_id),
                name=document.name,
                url=document.source_url,
                source_type=document.source_type,
                source_metadata=document.source_metadata or {},
                content=document.content_full or document.content_preview or "",
                content_preview=document.content_preview,
                status=document.status,
                processing_metadata=document.processing_metadata,
                word_count=document.word_count,
                character_count=document.character_count,
                chunk_count=document.chunk_count,
                custom_metadata=document.custom_metadata or {},
                annotations=document.annotations,
                is_enabled=document.is_enabled,
                is_archived=document.is_archived,
                created_at=document.created_at.isoformat() if document.created_at else None,
                updated_at=document.updated_at.isoformat() if document.updated_at else None,
                created_by=str(document.created_by)
            ).dict()

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update document: {str(e)}"
        )


@router.delete("/{kb_id}/documents/{doc_id}")
async def delete_kb_document(
    kb_id: UUID,
    doc_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete a document and all associated chunks/embeddings.

    WHY: Allow users to remove unwanted documents
    HOW: Delete from Qdrant first, then PostgreSQL (cascade)

    ACCESS CONTROL:
    - Requires "edit" or "delete" permission on KB
    - Editors can delete, admins have delete permission

    CRITICAL FLOW (Edge Case Handling):
    1. Verify document exists and user has access
    2. Delete from Qdrant FIRST (external system)
    3. If Qdrant delete succeeds, delete from PostgreSQL
    4. If Qdrant delete fails, mark document for cleanup
    5. Return deletion statistics

    WHY ORDER MATTERS:
    - Qdrant delete can fail (network issues)
    - Do it first before DB changes
    - If it fails, we can retry without data loss
    - PostgreSQL has CASCADE, so chunks auto-delete

    Returns:
        {
            "message": str,
            "deleted": {
                "document_id": str,
                "chunks_deleted": int,
                "qdrant_points_deleted": int
            }
        }
    """

    from app.services.kb_rbac_service import verify_kb_access, has_kb_permission

    # Verify user has edit or delete access
    kb = verify_kb_access(db, kb_id, current_user.id, "edit")

    # Check if user has delete permission (admins)
    is_admin = has_kb_permission(db, kb_id, current_user.id, "delete")

    # Get document
    document = db.query(Document).filter(
        Document.id == doc_id,
        Document.kb_id == kb_id
    ).first()

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found in this knowledge base"
        )

    # Check if user can delete this document
    # Editors can delete their own documents, admins can delete any
    if not is_admin and document.created_by != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete documents you created. Contact a KB admin to delete other documents."
        )

    # Count chunks before deletion
    chunk_count = db.query(Chunk).filter(Chunk.document_id == doc_id).count()

    try:
        # CRITICAL: Delete from Qdrant FIRST
        from app.services.qdrant_service import qdrant_service
        import asyncio

        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

        try:
            # Get chunk IDs for this document from database
            chunks = db.query(Chunk).filter(Chunk.document_id == doc_id).all()
            chunk_ids = [chunk.id for chunk in chunks]

            if chunk_ids:
                # Delete vectors from Qdrant using chunk IDs
                qdrant_deleted = await qdrant_service.delete_chunks(
                    kb_id=kb_id,
                    chunk_ids=chunk_ids
                )
            else:
                qdrant_deleted = 0

            qdrant_success = True

        except Exception as qdrant_error:
            # Qdrant delete failed - log and mark for retry
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Qdrant delete failed for document {doc_id}: {qdrant_error}")

            # Mark document for cleanup instead of deleting
            document.status = "pending_deletion"
            document.error_message = f"Qdrant sync failed: {str(qdrant_error)}"
            db.commit()

            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to delete from vector store: {str(qdrant_error)}. Document marked for retry."
            )

        finally:
            loop.close()

        if qdrant_success:
            # Qdrant delete successful - now safe to delete from PostgreSQL
            # Start transaction
            db.begin_nested()

            try:
                # Delete chunks (explicit, though CASCADE would do it)
                db.query(Chunk).filter(Chunk.document_id == doc_id).delete()

                # Delete document
                db.delete(document)

                # Commit transaction
                db.commit()

                return {
                    "message": f"Document '{document.name}' deleted successfully",
                    "deleted": {
                        "document_id": str(doc_id),
                        "document_name": document.name,
                        "chunks_deleted": chunk_count,
                        "qdrant_points_deleted": qdrant_deleted
                    }
                }

            except Exception as db_error:
                db.rollback()
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Database delete failed: {str(db_error)}"
                )

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete document: {str(e)}"
        )


@router.get("/{kb_id}/documents/{doc_id}/download")
async def download_kb_document(
    kb_id: UUID,
    doc_id: UUID,
    format: Literal["txt", "md", "json"] = Query("txt", description="Download format: txt, md (markdown), or json"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Download document content in specified format.

    WHY: Export document for backup or external use
    HOW: Return content with appropriate Content-Type headers

    FORMATS:
    - txt: Plain text content
    - md: Markdown with title and metadata
    - json: Structured JSON with all fields
    """
    from app.services.kb_rbac_service import verify_kb_access

    # Verify user has access to KB
    kb = verify_kb_access(db, kb_id, current_user.id, "view")

    # Get document
    document = db.query(Document).filter(
        Document.id == doc_id,
        Document.kb_id == kb_id
    ).first()

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )

    # Check if this is a file upload - content is in Qdrant only, not PostgreSQL
    # File uploads have: content_full=NULL, chunk_storage_location="qdrant_only"
    is_file_upload = document.source_type == "file_upload"
    storage_location = (document.processing_metadata or {}).get("chunk_storage_location", "")

    if is_file_upload or storage_location == "qdrant_only":
        # If original file is stored in MinIO, redirect to presigned download URL
        if document.file_path:
            from app.services.storage_service import BUCKET_KB_FILES, storage_service
            from starlette.responses import RedirectResponse
            presigned_url = storage_service.get_presigned_download_url(
                bucket=BUCKET_KB_FILES,
                object_key=document.file_path,
            )
            return RedirectResponse(url=presigned_url)

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Download not available for file uploads. File content is stored in vector database only and cannot be exported."
        )

    # Get document content
    # Priority: content_full > reconstructed from chunks (skip content_preview - it's truncated)
    content = document.content_full

    if not content:
        # Reconstruct from chunks (only works for web sources where chunks are in PostgreSQL)
        chunks = db.query(Chunk).filter(
            Chunk.document_id == doc_id
        ).order_by(Chunk.chunk_index).all()

        if chunks:
            content = "\n\n".join([c.content for c in chunks if c.content])
        else:
            content = "No content available for this document."

    # Generate safe filename
    safe_name = "".join(c for c in document.name if c.isalnum() or c in "._- ").strip()
    if not safe_name:
        safe_name = f"document_{doc_id}"

    # Format content based on requested format
    if format == "txt":
        # Plain text
        output = content
        content_type = "text/plain; charset=utf-8"
        filename = f"{safe_name}.txt"

    elif format == "md":
        # Markdown with metadata header
        output = f"""# {document.name}

**Source Type:** {document.source_type}
**Status:** {document.status}
**Created:** {document.created_at.isoformat() if document.created_at else 'N/A'}
**Word Count:** {document.word_count or 0}
**Chunks:** {document.chunk_count or 0}

---

{content}
"""
        content_type = "text/markdown; charset=utf-8"
        filename = f"{safe_name}.md"

    else:  # json
        # Structured JSON
        output_data = {
            "id": str(document.id),
            "name": document.name,
            "source_type": document.source_type,
            "source_url": document.source_url,
            "status": document.status,
            "content": content,
            "word_count": document.word_count or 0,
            "character_count": document.character_count or 0,
            "chunk_count": document.chunk_count or 0,
            "created_at": document.created_at.isoformat() if document.created_at else None,
            "updated_at": document.updated_at.isoformat() if document.updated_at else None,
            "source_metadata": document.source_metadata or {},
            "custom_metadata": document.custom_metadata or {},
        }
        output = json.dumps(output_data, indent=2, ensure_ascii=False)
        content_type = "application/json; charset=utf-8"
        filename = f"{safe_name}.json"

    return Response(
        content=output,
        media_type=content_type,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )


# ========================================
# HELPER FUNCTIONS
# ========================================

