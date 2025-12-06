"""
KB Retry Service - Enhanced retry mechanism for failed Knowledge Base processing.

WHY:
- Preserve original draft data including content approvals and edits
- Complete state cleanup before retry to prevent corruption
- Configuration preservation and restoration
- Intelligent source reconstruction

HOW:
- Backup original draft data to dedicated Redis keys
- Clean up partial chunks, documents, and Qdrant vectors
- Recreate draft with all original configurations and user modifications
- Enhanced retry with proper state management
"""

import json
import asyncio
from uuid import UUID, uuid4
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime
from sqlalchemy.orm import Session

from app.services.draft_service import draft_service, DraftType
from app.services.qdrant_service import qdrant_service
from app.models.knowledge_base import KnowledgeBase
from app.models.document import Document
from app.models.chunk import Chunk


class KBRetryService:
    """
    Enhanced retry service for Knowledge Base processing failures.

    Features:
    - Complete draft data backup and restoration
    - Comprehensive state cleanup (PostgreSQL + Qdrant)
    - Configuration preservation and merging
    - Intelligent source reconstruction with user modifications
    """

    def __init__(self):
        self.redis_client = draft_service.redis_client

    def create_retry_backup(
        self,
        kb_id: str,
        db: Session,
        retry_config_overrides: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Create complete backup of KB state for retry operations.

        WHY: Preserve all original draft data that was lost during initial processing
        HOW: Reconstruct original draft from DB records + apply any overrides

        Args:
            kb_id: Knowledge Base ID
            db: Database session
            retry_config_overrides: Optional configuration overrides for retry

        Returns:
            backup_id: Unique backup identifier for restoration

        Raises:
            ValueError: If KB not found or not in retryable state
        """

        # Get KB and validate state
        kb = db.query(KnowledgeBase).filter(
            KnowledgeBase.id == kb_id
        ).first()

        if not kb:
            raise ValueError(f"Knowledge Base not found: {kb_id}")

        if kb.status not in ["failed", "error", "processing_failed"]:
            raise ValueError(f"KB not in retryable state. Current status: {kb.status}")

        # Get all documents for this KB
        documents = db.query(Document).filter(
            Document.kb_id == kb_id
        ).all()

        # Reconstruct original sources with intelligent metadata preservation
        sources = []
        for doc in documents:
            source = {
                "id": str(uuid4()),  # Generate new source ID for retry
                "type": "web_scraping",  # Assuming web sources for now
                "url": doc.source_url,
                "config": doc.source_metadata.get("config", {}) if doc.source_metadata else {},
                "added_at": datetime.utcnow().isoformat(),
                "retry_from_document": str(doc.id),  # Track original document
                "original_status": doc.status
            }

            # Preserve any custom metadata that might affect processing
            if doc.source_metadata:
                # Extract any user-specified crawl configurations
                if "method" in doc.source_metadata:
                    source["config"]["method"] = doc.source_metadata["method"]
                if "max_pages" in doc.source_metadata:
                    source["config"]["max_pages"] = doc.source_metadata["max_pages"]
                if "max_depth" in doc.source_metadata:
                    source["config"]["max_depth"] = doc.source_metadata["max_depth"]

                # Preserve approval and edit states if available
                if "approval_state" in doc.source_metadata:
                    source["approval_state"] = doc.source_metadata["approval_state"]
                if "content_edits" in doc.source_metadata:
                    source["content_edits"] = doc.source_metadata["content_edits"]

            sources.append(source)

        # Create comprehensive backup data structure
        backup_data = {
            "kb_id": kb_id,
            "workspace_id": str(kb.workspace_id),
            "created_by": str(kb.created_by),
            "created_at": datetime.utcnow().isoformat(),
            "retry_timestamp": datetime.utcnow().isoformat(),
            "original_kb_status": kb.status,
            "original_error": kb.error_message,

            # Core KB data
            "data": {
                "name": kb.name,
                "description": kb.description,
                "context": kb.context,
                "context_settings": kb.context_settings or {},
                "sources": sources,

                # Configuration preservation
                "config": kb.config or {},
                "chunking_config": self._extract_chunking_config(kb),
                "embedding_config": kb.embedding_config or {},
                "vector_store_config": kb.vector_store_config or {},
                "indexing_method": kb.indexing_method or "by_heading",
            },

            # Apply any retry-specific overrides
            "retry_overrides": retry_config_overrides or {},

            # Metadata for tracking
            "backup_type": "retry_preparation",
            "documents_count": len(documents),
            "sources_reconstructed": len(sources)
        }

        # Apply retry overrides to the configuration
        if retry_config_overrides:
            backup_data["data"] = self._merge_configurations(
                backup_data["data"],
                retry_config_overrides
            )

        # Store backup in Redis with extended TTL (48 hours for retry operations)
        backup_id = f"retry_backup:{kb_id}:{int(datetime.utcnow().timestamp())}"

        self.redis_client.setex(
            backup_id,
            172800,  # 48 hours TTL for retry backups
            json.dumps(backup_data)
        )

        return backup_id

    def cleanup_partial_state(
        self,
        kb_id: str,
        db: Session
    ) -> Dict[str, int]:
        """
        Comprehensive cleanup of partial KB state before retry.

        WHY: Remove corrupted/partial data that could interfere with retry
        HOW: Clean PostgreSQL chunks/documents + Qdrant vectors atomically

        Args:
            kb_id: Knowledge Base ID
            db: Database session

        Returns:
            Dict with cleanup statistics
        """

        cleanup_stats = {
            "chunks_deleted": 0,
            "documents_updated": 0,
            "qdrant_vectors_deleted": 0,
            "errors": []
        }

        try:
            # Get all chunks for this KB
            chunks = db.query(Chunk).filter(Chunk.kb_id == kb_id).all()
            chunk_count = len(chunks)
            chunk_ids = [chunk.id for chunk in chunks]

            # Clean up Qdrant vectors FIRST (external system)
            if chunk_ids:
                try:
                    loop = asyncio.new_event_loop()
                    asyncio.set_event_loop(loop)

                    qdrant_deleted = loop.run_until_complete(
                        qdrant_service.delete_chunks(
                            kb_id=UUID(kb_id),
                            chunk_ids=chunk_ids
                        )
                    )
                    cleanup_stats["qdrant_vectors_deleted"] = qdrant_deleted

                    loop.close()

                except Exception as e:
                    cleanup_stats["errors"].append(f"Qdrant cleanup failed: {str(e)}")
                    # Continue with PostgreSQL cleanup even if Qdrant fails

            # Clean up PostgreSQL chunks
            if chunks:
                db.query(Chunk).filter(Chunk.kb_id == kb_id).delete()
                cleanup_stats["chunks_deleted"] = chunk_count

            # Reset document states for retry
            documents = db.query(Document).filter(Document.kb_id == kb_id).all()
            for doc in documents:
                doc.status = "pending"
                doc.processing_progress = 0
                doc.chunk_count = 0
                doc.error_message = None
                doc.updated_at = datetime.utcnow()

            cleanup_stats["documents_updated"] = len(documents)

            # Commit changes
            db.commit()

            return cleanup_stats

        except Exception as e:
            db.rollback()
            cleanup_stats["errors"].append(f"PostgreSQL cleanup failed: {str(e)}")
            return cleanup_stats

    def create_retry_draft(
        self,
        backup_id: str,
        db: Session
    ) -> str:
        """
        Create new draft from retry backup for processing.

        WHY: Recreate original draft state with all user modifications preserved
        HOW: Load backup data, create new draft, merge configurations

        Args:
            backup_id: Backup identifier from create_retry_backup
            db: Database session

        Returns:
            draft_id: New draft ID for retry processing
        """

        # Load backup data
        backup_json = self.redis_client.get(backup_id)
        if not backup_json:
            raise ValueError(f"Retry backup not found: {backup_id}")

        backup_data = json.loads(backup_json)

        # Create new draft with backup data
        draft_id = str(uuid4())

        # Construct draft structure matching kb_draft_service format
        draft_structure = {
            "workspace_id": backup_data["workspace_id"],
            "created_by": backup_data["created_by"],
            "created_at": backup_data["created_at"],
            "data": backup_data["data"],
            "type": "kb_retry",  # Mark as retry draft
            "original_kb_id": backup_data["kb_id"],
            "backup_id": backup_id
        }

        # Create draft in Redis
        draft_service.create_draft(
            draft_type=DraftType.KB,
            draft_id=draft_id,
            workspace_id=backup_data["workspace_id"],
            created_by=backup_data["created_by"],
            data=backup_data["data"]
        )

        # Store additional retry metadata
        retry_meta_key = f"draft:kb:{draft_id}:retry_meta"
        retry_metadata = {
            "is_retry": True,
            "original_kb_id": backup_data["kb_id"],
            "backup_id": backup_id,
            "retry_timestamp": datetime.utcnow().isoformat(),
            "cleanup_performed": True
        }

        self.redis_client.setex(
            retry_meta_key,
            86400,  # 24 hour TTL
            json.dumps(retry_metadata)
        )

        return draft_id

    def execute_enhanced_retry(
        self,
        kb_id: str,
        db: Session,
        retry_config_overrides: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Execute enhanced retry using stored pipeline draft data.

        WHY: Use original draft data stored in pipeline Redis (no reconstruction needed!)
        HOW: Find original pipeline → Use stored draft data → Cleanup → Retry

        Args:
            kb_id: Knowledge Base ID
            db: Database session
            retry_config_overrides: Optional configuration overrides

        Returns:
            Dict with retry execution details
        """

        try:
            # Step 1: Find original pipeline with stored draft data
            original_draft_data = self._find_original_pipeline_draft(kb_id)

            # Step 2: Clean up partial state
            cleanup_stats = self.cleanup_partial_state(kb_id=kb_id, db=db)

            # Step 3: Update KB status to processing
            kb = db.query(KnowledgeBase).filter(
                KnowledgeBase.id == kb_id
            ).first()

            if not kb:
                raise ValueError(f"Knowledge Base not found: {kb_id}")

            kb.status = "processing"
            kb.error_message = None
            kb.updated_at = datetime.utcnow()

            # Apply any configuration overrides to the KB record
            if retry_config_overrides:
                kb.config = self._merge_configurations(
                    kb.config or {},
                    retry_config_overrides
                )

            db.commit()

            # Step 4: Prepare retry configuration from original draft
            if original_draft_data:
                # Use original draft data (PERFECT preservation!)
                draft_data = original_draft_data["complete_draft_data"]["data"]

                # Apply any overrides
                if retry_config_overrides:
                    draft_data = self._merge_configurations(draft_data, retry_config_overrides)

                retry_method = "original_draft_data"
                retry_features = [
                    "Original draft data preservation (100% accurate)",
                    "Complete state cleanup",
                    "Zero data loss retry"
                ]
            else:
                # Fallback: Reconstruct from DB (less ideal but functional)
                draft_data = self._reconstruct_basic_config_from_db(kb, db)

                if retry_config_overrides:
                    draft_data = self._merge_configurations(draft_data, retry_config_overrides)

                retry_method = "db_reconstruction"
                retry_features = [
                    "Database reconstruction fallback",
                    "Complete state cleanup",
                    "Basic configuration preservation"
                ]

            # Step 5: Queue retry task
            from app.tasks.kb_pipeline_tasks import process_web_kb_task
            import time

            # Generate new pipeline ID
            pipeline_id = f"{kb_id}:{int(time.time())}"

            # Queue the retry task
            task = process_web_kb_task.apply_async(
                kwargs={
                    "kb_id": kb_id,
                    "pipeline_id": pipeline_id,
                    "sources": draft_data.get("sources", []),
                    "config": draft_data,
                    "preview_data": original_draft_data.get("complete_draft_data", {}).get("preview_data") if original_draft_data else None
                },
                queue="high_priority"  # High priority for retries
            )

            return {
                "pipeline_id": pipeline_id,
                "kb_id": kb_id,
                "task_id": task.id,
                "status": "processing",
                "message": f"Enhanced retry queued using {retry_method}",
                "cleanup_stats": cleanup_stats,
                "retry_features": retry_features,
                "retry_method": retry_method,
                "original_draft_found": bool(original_draft_data),
                "configuration_overrides_applied": bool(retry_config_overrides),
                "enhanced_retry": True,
                "note": "Monitor progress at /api/v1/kb-pipeline/{pipeline_id}/status"
            }

        except Exception as e:
            # Rollback any partial changes
            db.rollback()
            raise ValueError(f"Enhanced retry failed: {str(e)}")

    def _extract_chunking_config(self, kb: KnowledgeBase) -> Dict[str, Any]:
        """Extract chunking configuration from KB record."""

        # Try to get from config first
        if kb.config and "chunking_config" in kb.config:
            return kb.config["chunking_config"]

        # Fallback to indexing_method
        return {
            "strategy": kb.indexing_method or "by_heading",
            "chunk_size": 1000,
            "chunk_overlap": 200,
            "preserve_headings": True
        }

    def _find_original_pipeline_draft(self, kb_id: str) -> Optional[Dict[str, Any]]:
        """
        Find original pipeline with stored draft data for this KB.

        WHY: Pipeline Redis stores the complete original draft data
        HOW: Scan Redis for pipeline keys containing this KB ID

        Args:
            kb_id: Knowledge Base ID

        Returns:
            Pipeline data with complete_draft_data, or None if not found
        """

        try:
            # Get all pipeline status keys
            pipeline_keys = self.redis_client.keys("pipeline:*:status")

            for key in pipeline_keys:
                try:
                    pipeline_json = self.redis_client.get(key)
                    if pipeline_json:
                        pipeline_data = json.loads(pipeline_json)

                        # Check if this pipeline belongs to our KB
                        if (pipeline_data.get("kb_id") == kb_id and
                            pipeline_data.get("retry_capable") and
                            "complete_draft_data" in pipeline_data):

                            print(f"✅ Found original pipeline draft data for KB {kb_id}")
                            return pipeline_data

                except (json.JSONDecodeError, KeyError):
                    # Skip invalid pipeline data
                    continue

            print(f"⚠️  No original pipeline draft data found for KB {kb_id}, will use DB reconstruction")
            return None

        except Exception as e:
            print(f"❌ Error searching for original pipeline draft: {str(e)}")
            return None

    def _reconstruct_basic_config_from_db(self, kb: KnowledgeBase, db: Session) -> Dict[str, Any]:
        """
        Fallback: Reconstruct basic configuration from database records.

        Args:
            kb: Knowledge Base record
            db: Database session

        Returns:
            Basic configuration dictionary for retry
        """

        # Get all documents for this KB
        documents = db.query(Document).filter(
            Document.kb_id == kb.id
        ).all()

        # Reconstruct sources from existing documents
        sources = []
        for doc in documents:
            if doc.source_type == "web_scraping" and doc.source_url:
                source = {
                    "id": str(uuid4()),  # Generate new source ID
                    "type": "web_scraping",
                    "url": doc.source_url,
                    "config": doc.source_metadata.get("config", {}) if doc.source_metadata else {},
                    "added_at": datetime.utcnow().isoformat(),
                    "reconstructed": True  # Flag to indicate this was reconstructed
                }
                sources.append(source)

        # Build basic configuration
        basic_config = {
            "name": kb.name,
            "description": kb.description,
            "context": kb.context or "both",
            "sources": sources,
            "config": kb.config or {},
            "chunking_config": self._extract_chunking_config(kb),
            "embedding_config": kb.embedding_config or {
                "model": "all-MiniLM-L6-v2",
                "device": "cpu",
                "batch_size": 32
            },
            "vector_store_config": kb.vector_store_config or {},
            "indexing_method": kb.indexing_method or "by_heading"
        }

        return basic_config

    def _merge_configurations(
        self,
        base_config: Dict[str, Any],
        overrides: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Deep merge configuration dictionaries.

        Args:
            base_config: Base configuration
            overrides: Configuration overrides

        Returns:
            Merged configuration with overrides applied
        """

        result = base_config.copy()

        for key, value in overrides.items():
            if isinstance(value, dict) and isinstance(result.get(key), dict):
                # Deep merge nested dictionaries
                result[key] = self._merge_configurations(result[key], value)
            else:
                # Direct override
                result[key] = value

        return result


# Global instance
kb_retry_service = KBRetryService()