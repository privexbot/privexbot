"""
KB Maintenance Tasks - Scheduled and manual maintenance tasks for KB management.

WHY:
- Periodic cleanup of expired pipeline data
- Re-indexing of stale/outdated KBs
- Health checks for vector store
- Manual re-indexing support

HOW:
- Celery Beat scheduled tasks
- Low priority queue
- Database and Redis operations
"""

from celery import shared_task
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import List, Dict, Any
import json
import asyncio

from app.db.session import SessionLocal
from app.services.draft_service import draft_service
from app.services.qdrant_service import qdrant_service
from app.models.knowledge_base import KnowledgeBase
from app.models.document import Document
from app.models.chunk import Chunk
from uuid import UUID


@shared_task(bind=True, name="cleanup_expired_pipelines")
def cleanup_expired_pipelines_task(self):
    """
    Enhanced cleanup of expired pipeline tracking data from Redis.

    SCHEDULE: Every hour
    QUEUE: low_priority
    DURATION: <1 minute

    WHY: Pipeline status data has 24hr TTL, but we can clean up completed ones sooner
    HOW: Find completed pipelines older than 1 hour, delete ALL related keys from Redis

    ENHANCED: Now cleans up retry-related data (complete_draft_data) and retry metadata

    Returns:
        {
            "cleaned": int,
            "retry_data_cleaned": int,
            "message": str
        }
    """

    try:
        # Get all pipeline keys from Redis
        pipeline_keys = draft_service.redis_client.keys("pipeline:*:status")

        cleaned = 0
        retry_data_cleaned = 0
        now = datetime.utcnow()

        for key in pipeline_keys:
            try:
                data_json = draft_service.redis_client.get(key)
                if not data_json:
                    continue

                data = json.loads(data_json)
                status = data.get("status")
                updated_at = data.get("updated_at")

                # Clean up if completed/failed and older than 1 hour
                if status in ["completed", "failed", "cancelled"] and updated_at:
                    updated_time = datetime.fromisoformat(updated_at)
                    age = (now - updated_time).total_seconds()

                    if age > 3600:  # 1 hour
                        # ENHANCED: Extract pipeline ID for comprehensive cleanup
                        pipeline_id = key.split(":")[1]  # Extract from "pipeline:{id}:status"

                        # Delete primary pipeline data
                        draft_service.redis_client.delete(key)
                        logs_key = key.replace(":status", ":logs")
                        draft_service.redis_client.delete(logs_key)

                        # ENHANCED: Clean up retry-related data
                        # 1. Check if this pipeline has complete_draft_data (for retry capability)
                        if data.get("retry_capable") and "complete_draft_data" in data:
                            retry_data_cleaned += 1
                            print(f"🧹 Cleaning retry-capable pipeline: {pipeline_id}")

                        # 2. Clean up any retry backup keys for this pipeline's KB
                        kb_id = data.get("kb_id")
                        if kb_id:
                            retry_backup_pattern = f"retry_backup:{kb_id}:*"
                            retry_backup_keys = draft_service.redis_client.keys(retry_backup_pattern)
                            for backup_key in retry_backup_keys:
                                # Only delete old backups (older than 6 hours)
                                try:
                                    backup_json = draft_service.redis_client.get(backup_key)
                                    if backup_json:
                                        backup_data = json.loads(backup_json)
                                        backup_time = datetime.fromisoformat(backup_data.get("created_at", ""))
                                        backup_age = (now - backup_time).total_seconds()
                                        if backup_age > 21600:  # 6 hours
                                            draft_service.redis_client.delete(backup_key)
                                            print(f"🗑️ Cleaned old retry backup: {backup_key}")
                                except Exception as e:
                                    print(f"Error cleaning retry backup {backup_key}: {e}")

                        cleaned += 1
                        print(f"✅ Cleaned pipeline {pipeline_id} (age: {int(age/60)} minutes)")

            except Exception as e:
                print(f"Error cleaning pipeline {key}: {e}")
                continue

        return {
            "cleaned": cleaned,
            "retry_data_cleaned": retry_data_cleaned,
            "message": f"Cleaned {cleaned} expired pipeline(s), {retry_data_cleaned} with retry data"
        }

    except Exception as e:
        print(f"Error in cleanup_expired_pipelines: {e}")
        return {
            "cleaned": 0,
            "retry_data_cleaned": 0,
            "message": f"Error: {str(e)}"
        }


@shared_task(bind=True, name="reindex_stale_kbs")
def reindex_stale_kbs_task(self):
    """
    Re-index KBs that haven't been updated in a while.

    SCHEDULE: Daily at 2 AM
    QUEUE: low_priority
    DURATION: Variable (depends on number of KBs)

    WHY: Keep embeddings fresh for frequently changing websites
    HOW: Find KBs older than 30 days, queue re-indexing tasks

    Returns:
        {
            "queued": int,
            "message": str
        }
    """

    db = SessionLocal()

    try:
        # Find KBs that haven't been updated in 30 days
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)

        stale_kbs = db.query(KnowledgeBase).filter(
            KnowledgeBase.status == "ready",
            KnowledgeBase.updated_at < thirty_days_ago
        ).all()

        queued = 0

        for kb in stale_kbs:
            try:
                # Queue re-indexing task
                from app.tasks.kb_pipeline_tasks import reindex_kb_task

                reindex_kb_task.apply_async(
                    kwargs={"kb_id": str(kb.id)},
                    queue="high_priority"
                )

                queued += 1

            except Exception as e:
                print(f"Error queuing re-index for KB {kb.id}: {e}")
                continue

        return {
            "queued": queued,
            "message": f"Queued {queued} KB(s) for re-indexing"
        }

    except Exception as e:
        print(f"Error in reindex_stale_kbs: {e}")
        return {
            "queued": 0,
            "message": f"Error: {str(e)}"
        }

    finally:
        db.close()


@shared_task(bind=True, name="health_check_qdrant_collections")
def health_check_qdrant_collections_task(self):
    """
    Health check for Qdrant collections.

    SCHEDULE: Every 6 hours
    QUEUE: low_priority
    DURATION: <1 minute

    WHY: Ensure vector store collections are healthy
    HOW: Check collection existence and stats for all active KBs

    Returns:
        {
            "total_kbs": int,
            "healthy": int,
            "unhealthy": int,
            "issues": List[str]
        }
    """

    db = SessionLocal()
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    try:
        # Get all ready KBs
        kbs = db.query(KnowledgeBase).filter(
            KnowledgeBase.status.in_(["ready", "ready_with_warnings"])
        ).all()

        total_kbs = len(kbs)
        healthy = 0
        unhealthy = 0
        issues = []

        for kb in kbs:
            try:
                # Check if collection exists
                collection_exists = loop.run_until_complete(
                    qdrant_service.check_collection_exists(kb.id)
                )

                if collection_exists:
                    # Get collection stats
                    stats = loop.run_until_complete(
                        qdrant_service.get_collection_stats(kb.id)
                    )

                    # Verify point count matches chunk count
                    chunk_count = db.query(Chunk).filter(
                        Chunk.kb_id == kb.id
                    ).count()

                    if stats.get("vectors_count", 0) == chunk_count:
                        healthy += 1
                    else:
                        unhealthy += 1
                        issues.append(
                            f"KB {kb.id}: Vector count mismatch "
                            f"(Qdrant: {stats.get('vectors_count', 0)}, DB: {chunk_count})"
                        )

                else:
                    unhealthy += 1
                    issues.append(f"KB {kb.id}: Collection not found in Qdrant")

            except Exception as e:
                unhealthy += 1
                issues.append(f"KB {kb.id}: Health check error - {str(e)}")

        return {
            "total_kbs": total_kbs,
            "healthy": healthy,
            "unhealthy": unhealthy,
            "issues": issues[:10]  # Limit to first 10 issues
        }

    except Exception as e:
        print(f"Error in health_check_qdrant_collections: {e}")
        return {
            "total_kbs": 0,
            "healthy": 0,
            "unhealthy": 0,
            "issues": [f"Health check error: {str(e)}"]
        }

    finally:
        db.close()
        loop.close()


@shared_task(bind=True, name="manual_cleanup_kb")
def manual_cleanup_kb_task(
    self,
    kb_id: str,
    initiated_by: str = "system",
    deleted_at: str = None
):
    """
    Enhanced KB cleanup - handles soft-deleted KBs with complete external cleanup.

    ENHANCED IMPLEMENTATION:
    - Works with soft-deleted KBs (status="deleting")
    - Complete Qdrant collection cleanup
    - Hard database deletion with CASCADE
    - Enhanced logging and error handling
    - Rollback capabilities

    QUEUE: low_priority
    DURATION: Variable (5-30 seconds depending on KB size)

    WHY: Complete cleanup after immediate soft deletion for optimal UX
    HOW: Qdrant cleanup → Hard database deletion → Audit logging

    Args:
        kb_id: Knowledge base UUID string
        initiated_by: User email who triggered deletion
        deleted_at: ISO timestamp when deletion was initiated

    Returns:
        {
            "kb_id": str,
            "status": "success" | "error" | "warning",
            "message": str,
            "cleanup_details": dict
        }
    """

    db = SessionLocal()
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    cleanup_details = {
        "initiated_by": initiated_by,
        "deleted_at": deleted_at,
        "qdrant_cleanup": "pending",
        "database_cleanup": "pending",
        "documents_count": 0,
        "chunks_count": 0
    }

    try:
        print(f"🗑️ Starting enhanced cleanup for KB {kb_id} (initiated by: {initiated_by})")

        # Get KB (including soft-deleted ones)
        kb = db.query(KnowledgeBase).filter(
            KnowledgeBase.id == UUID(kb_id)
        ).first()

        if not kb:
            print(f"⚠️ KB {kb_id} not found - may have been already hard deleted")
            return {
                "kb_id": kb_id,
                "status": "warning",
                "message": "KB not found - may have been already deleted",
                "cleanup_details": cleanup_details
            }

        # Validate this is a soft-deleted KB
        if kb.status != "deleting":
            print(f"⚠️ KB {kb_id} status is '{kb.status}', not 'deleting'. Proceeding anyway.")

        # Record statistics before deletion
        cleanup_details["documents_count"] = kb.total_documents or 0
        cleanup_details["chunks_count"] = kb.total_chunks or 0
        kb_name = kb.name

        print(f"📊 KB '{kb_name}' stats: {cleanup_details['documents_count']} docs, {cleanup_details['chunks_count']} chunks")

        # STEP 1: Delete Qdrant collection (external system first)
        try:
            print(f"🔍 Deleting Qdrant collection for KB {kb_id}...")
            loop.run_until_complete(
                qdrant_service.delete_kb_collection(UUID(kb_id))
            )
            cleanup_details["qdrant_cleanup"] = "success"
            print(f"✅ Qdrant collection deleted successfully for KB {kb_id}")

        except Exception as e:
            cleanup_details["qdrant_cleanup"] = f"failed: {str(e)}"
            print(f"⚠️ Warning: Failed to delete Qdrant collection for KB {kb_id}: {e}")
            # Continue with database cleanup even if Qdrant fails

        # STEP 2: Hard delete from PostgreSQL (CASCADE handles all related data)
        try:
            print(f"🗄️ Hard deleting KB {kb_id} from PostgreSQL...")

            # Delete triggers CASCADE to:
            # - documents table (Document.knowledge_base_id FK)
            # - chunks table (Chunk.document_id FK → Document.knowledge_base_id)
            # - kb_members table (KBMember.kb_id FK)
            db.delete(kb)
            db.commit()

            cleanup_details["database_cleanup"] = "success"
            print(f"✅ KB '{kb_name}' and all related data deleted from PostgreSQL")

        except Exception as e:
            cleanup_details["database_cleanup"] = f"failed: {str(e)}"
            db.rollback()
            print(f"❌ Critical: Failed to delete KB {kb_id} from PostgreSQL: {e}")

            # This is serious - KB is stuck in deleting state
            raise Exception(f"Database deletion failed: {str(e)}")

        # SUCCESS: Complete cleanup
        success_message = f"KB '{kb_name}' completely deleted"
        print(f"🎉 {success_message} (initiated by: {initiated_by})")

        return {
            "kb_id": kb_id,
            "status": "success",
            "message": success_message,
            "cleanup_details": cleanup_details
        }

    except Exception as e:
        cleanup_details["error"] = str(e)
        error_message = f"Enhanced cleanup failed for KB {kb_id}: {str(e)}"
        print(f"❌ {error_message}")

        # If database rollback already happened, don't do it again
        try:
            db.rollback()
        except:
            pass

        return {
            "kb_id": kb_id,
            "status": "error",
            "message": error_message,
            "cleanup_details": cleanup_details
        }

    finally:
        try:
            db.close()
        except:
            pass
        try:
            loop.close()
        except:
            pass


@shared_task(bind=True, name="cleanup_successful_retry_data")
def cleanup_successful_retry_data_task(self):
    """
    Clean up retry-related data after successful retry operations.

    SCHEDULE: Every 30 minutes
    QUEUE: low_priority
    DURATION: <30 seconds

    WHY: Successful retries no longer need their complete_draft_data preserved
    HOW: Find successful KBs that had recent retry, clean up their retry artifacts

    Returns:
        {
            "kbs_checked": int,
            "cleanup_performed": int,
            "message": str
        }
    """

    db = SessionLocal()

    try:
        # Find KBs that are now ready/ready_with_warnings and were recently updated
        recent_time = datetime.utcnow() - timedelta(hours=2)

        recently_successful_kbs = db.query(KnowledgeBase).filter(
            KnowledgeBase.status.in_(["ready", "ready_with_warnings"]),
            KnowledgeBase.updated_at > recent_time
        ).all()

        kbs_checked = len(recently_successful_kbs)
        cleanup_performed = 0

        for kb in recently_successful_kbs:
            try:
                kb_id = str(kb.id)

                # Look for retry backup keys for this KB
                retry_backup_pattern = f"retry_backup:{kb_id}:*"
                retry_backup_keys = draft_service.redis_client.keys(retry_backup_pattern)

                if retry_backup_keys:
                    # Check if there are any active pipelines for this KB
                    pipeline_keys = draft_service.redis_client.keys("pipeline:*:status")
                    kb_has_active_pipeline = False

                    for pipeline_key in pipeline_keys:
                        try:
                            pipeline_json = draft_service.redis_client.get(pipeline_key)
                            if pipeline_json:
                                pipeline_data = json.loads(pipeline_json)
                                if (pipeline_data.get("kb_id") == kb_id and
                                    pipeline_data.get("status") in ["running", "queued"]):
                                    kb_has_active_pipeline = True
                                    break
                        except Exception:
                            continue

                    # If no active pipeline, safe to clean up retry data
                    if not kb_has_active_pipeline:
                        for backup_key in retry_backup_keys:
                            draft_service.redis_client.delete(backup_key)

                        # Clean up any retry metadata for drafts of this KB
                        retry_meta_pattern = f"draft:kb:*:retry_meta"
                        retry_meta_keys = draft_service.redis_client.keys(retry_meta_pattern)

                        for meta_key in retry_meta_keys:
                            try:
                                meta_json = draft_service.redis_client.get(meta_key)
                                if meta_json:
                                    meta_data = json.loads(meta_json)
                                    if meta_data.get("original_kb_id") == kb_id:
                                        draft_service.redis_client.delete(meta_key)
                            except Exception:
                                continue

                        cleanup_performed += 1
                        print(f"✅ Cleaned retry data for successful KB: {kb_id} ({kb.name})")

            except Exception as e:
                print(f"Error cleaning retry data for KB {kb.id}: {e}")
                continue

        return {
            "kbs_checked": kbs_checked,
            "cleanup_performed": cleanup_performed,
            "message": f"Checked {kbs_checked} recent KBs, cleaned retry data for {cleanup_performed}"
        }

    except Exception as e:
        print(f"Error in cleanup_successful_retry_data: {e}")
        return {
            "kbs_checked": 0,
            "cleanup_performed": 0,
            "message": f"Error: {str(e)}"
        }

    finally:
        db.close()


@shared_task(bind=True, name="fix_pipeline_ttl_reset")
def fix_pipeline_ttl_reset_task(self):
    """
    Fix TTL reset issue for completed pipelines.

    SCHEDULE: Every 15 minutes
    QUEUE: low_priority
    DURATION: <30 seconds

    WHY: Completed pipelines shouldn't have their TTL extended indefinitely
    HOW: Set shorter TTL (2 hours) for completed pipelines, preserve longer TTL for active ones

    Returns:
        {
            "pipelines_processed": int,
            "ttl_fixed": int,
            "message": str
        }
    """

    try:
        pipeline_keys = draft_service.redis_client.keys("pipeline:*:status")

        pipelines_processed = len(pipeline_keys)
        ttl_fixed = 0

        for key in pipeline_keys:
            try:
                data_json = draft_service.redis_client.get(key)
                if not data_json:
                    continue

                data = json.loads(data_json)
                status = data.get("status")
                current_ttl = draft_service.redis_client.ttl(key)

                # For completed/failed/cancelled pipelines, set shorter TTL (2 hours)
                if status in ["completed", "failed", "cancelled"]:
                    if current_ttl > 7200:  # If TTL is more than 2 hours
                        draft_service.redis_client.expire(key, 7200)  # Set to 2 hours

                        # Also fix TTL for logs key
                        logs_key = key.replace(":status", ":logs")
                        if draft_service.redis_client.exists(logs_key):
                            draft_service.redis_client.expire(logs_key, 7200)

                        ttl_fixed += 1

                # For active pipelines, ensure reasonable TTL (max 6 hours)
                elif status in ["running", "queued"]:
                    if current_ttl > 21600:  # If TTL is more than 6 hours
                        draft_service.redis_client.expire(key, 21600)  # Set to 6 hours

                        logs_key = key.replace(":status", ":logs")
                        if draft_service.redis_client.exists(logs_key):
                            draft_service.redis_client.expire(logs_key, 21600)

                        ttl_fixed += 1

            except Exception as e:
                print(f"Error fixing TTL for pipeline {key}: {e}")
                continue

        return {
            "pipelines_processed": pipelines_processed,
            "ttl_fixed": ttl_fixed,
            "message": f"Processed {pipelines_processed} pipelines, fixed TTL for {ttl_fixed}"
        }

    except Exception as e:
        print(f"Error in fix_pipeline_ttl_reset: {e}")
        return {
            "pipelines_processed": 0,
            "ttl_fixed": 0,
            "message": f"Error: {str(e)}"
        }
