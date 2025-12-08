"""
KB Draft Service - Knowledge base draft management for web URL creation.

WHY:
- KB creation in draft mode (Phase 1: Redis only)
- Add web URLs with crawl configuration
- Configure chunking, embedding settings
- Finalize and trigger background processing (Phase 2 & 3)

HOW:
- Store KB draft in Redis (24hr TTL)
- Track web sources with crawl configs
- Validate before finalization
- Create DB records and queue Celery task on finalize

FLOW:
- Phase 1 (Draft): User configures KB in Redis
- Phase 2 (Finalization): Create DB records, queue task
- Phase 3 (Background): Celery processes web pages
"""

from uuid import UUID, uuid4
from typing import Optional, Dict, List, Any
from datetime import datetime
import json

from sqlalchemy.orm import Session

from app.services.draft_service import draft_service, DraftType
from app.services.crawl4ai_service import CrawlConfig


class KBDraftService:
    """
    Knowledge Base draft-specific operations.

    WHY: Specialized draft handling for KB web URL creation
    HOW: Extends base draft service with KB-specific validation and finalization
    """

    def add_web_source_to_draft(
        self,
        draft_id: str,
        url: str,
        config: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Add web URL to KB draft.

        WHY: User can add multiple URLs to crawl
        HOW: Validate URL, store in Redis sources array

        PHASE: 1 (Draft Mode - Redis Only)

        Args:
            draft_id: KB draft ID
            url: Web URL to scrape/crawl
            config: Crawl configuration {
                "method": "single" | "crawl",
                "max_pages": 50,
                "max_depth": 3,
                "include_patterns": ["/docs/**"],
                "exclude_patterns": ["/admin/**"],
                "stealth_mode": true
            }

        Returns:
            source_id: Unique source identifier

        Raises:
            ValueError: If draft not found or URL invalid
        """

        # Get draft
        draft = draft_service.get_draft(DraftType.KB, draft_id)
        if not draft:
            raise ValueError("KB draft not found")

        # Validate URL
        if not url.startswith(("http://", "https://")):
            raise ValueError("Invalid URL - must start with http:// or https://")

        # Create source entry
        source_id = str(uuid4())
        source = {
            "id": source_id,
            "type": "web_scraping",
            "url": url,
            "config": config or {},
            "added_at": datetime.utcnow().isoformat()
        }

        # Add to sources
        data = draft.get("data", {})
        sources = data.get("sources", [])
        sources.append(source)
        data["sources"] = sources

        # Update draft
        draft_service.update_draft(
            draft_type=DraftType.KB,
            draft_id=draft_id,
            updates={"data": data}
        )

        return source_id

    def remove_source_from_draft(
        self,
        draft_id: str,
        source_id: str
    ) -> bool:
        """
        Remove source from KB draft.

        WHY: User can remove URLs before finalization
        HOW: Filter out source by ID from Redis

        PHASE: 1 (Draft Mode - Redis Only)

        Args:
            draft_id: KB draft ID
            source_id: Source ID to remove

        Returns:
            bool: True if removed, False if not found

        Raises:
            ValueError: If draft not found
        """

        # Get draft
        draft = draft_service.get_draft(DraftType.KB, draft_id)
        if not draft:
            raise ValueError("KB draft not found")

        # Remove source
        data = draft.get("data", {})
        sources = data.get("sources", [])
        original_count = len(sources)

        # Filter out the source
        sources = [s for s in sources if s.get("id") != source_id]
        data["sources"] = sources

        # Update draft
        draft_service.update_draft(
            draft_type=DraftType.KB,
            draft_id=draft_id,
            updates={"data": data}
        )

        return len(sources) < original_count

    def add_bulk_web_sources_to_draft(
        self,
        draft_id: str,
        sources: List[Dict[str, Any]],
        shared_config: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Add multiple web URLs to KB draft in one atomic operation.

        WHY: Enable efficient bulk operations for users adding many URLs
        HOW: Validate all URLs, check duplicates, apply configs, add atomically

        PHASE: 1 (Draft Mode - Redis Only)

        Args:
            draft_id: KB draft ID
            sources: List of source configs [
                {
                    "url": "https://example.com",
                    "config": {...}  # Optional per-URL config
                }
            ]
            shared_config: Shared configuration applied to all sources (can be overridden per source)

        Returns:
            {
                "sources_added": int,
                "source_ids": List[str],
                "duplicates_skipped": int,
                "invalid_urls": List[dict],
                "total_sources_after": int
            }

        Raises:
            ValueError: If draft not found or critical validation fails
        """

        # Get draft
        draft = draft_service.get_draft(DraftType.KB, draft_id)
        if not draft:
            raise ValueError("KB draft not found")

        # Get existing sources for duplicate checking
        data = draft.get("data", {})
        existing_sources = data.get("sources", [])
        existing_urls = {source.get("url") for source in existing_sources if source.get("url")}

        # Process each source
        sources_added = []
        source_ids = []
        duplicates_skipped = 0
        invalid_urls = []

        for idx, source_spec in enumerate(sources):
            url = source_spec.get("url", "")
            per_source_config = source_spec.get("config", {})

            # Validate URL
            if not url:
                invalid_urls.append({
                    "index": idx,
                    "url": url,
                    "error": "URL is required"
                })
                continue

            if not url.startswith(("http://", "https://")):
                invalid_urls.append({
                    "index": idx,
                    "url": url,
                    "error": "Invalid URL - must start with http:// or https://"
                })
                continue

            # Check for duplicates
            if url in existing_urls:
                duplicates_skipped += 1
                continue

            # Merge shared config with per-source config (per-source takes precedence)
            final_config = {}
            if shared_config:
                final_config.update(shared_config)
            if per_source_config:
                final_config.update(per_source_config)

            # Create source entry
            source_id = str(uuid4())
            source = {
                "id": source_id,
                "type": "web_scraping",
                "url": url,
                "config": final_config,
                "added_at": datetime.utcnow().isoformat(),
                "added_via": "bulk_operation"
            }

            sources_added.append(source)
            source_ids.append(source_id)
            existing_urls.add(url)  # Track for subsequent duplicate checking in this batch

        # If no sources were valid, report the issue
        if not sources_added and invalid_urls:
            raise ValueError(f"No valid sources to add. {len(invalid_urls)} invalid URLs found.")

        # Add all valid sources atomically
        if sources_added:
            all_sources = existing_sources + sources_added
            data["sources"] = all_sources

            # Update draft atomically
            draft_service.update_draft(
                draft_type=DraftType.KB,
                draft_id=draft_id,
                updates={"data": data}
            )

        return {
            "sources_added": len(sources_added),
            "source_ids": source_ids,
            "duplicates_skipped": duplicates_skipped,
            "invalid_urls": invalid_urls,
            "total_sources_after": len(existing_sources) + len(sources_added)
        }

    def update_chunking_config(
        self,
        draft_id: str,
        chunking_config: Dict[str, Any]
    ):
        """
        Update chunking configuration for KB draft.

        WHY: Configure how web pages are split into chunks
        HOW: Update chunking_config in Redis

        PHASE: 1 (Draft Mode - Redis Only)

        Args:
            draft_id: KB draft ID
            chunking_config: {
                "strategy": "by_heading" | "semantic" | "fixed_size",
                "chunk_size": 1000,
                "chunk_overlap": 200,
                "preserve_code_blocks": true
            }

        Raises:
            ValueError: If draft not found
        """

        # DEBUG: Log what we're saving

        draft = draft_service.get_draft(DraftType.KB, draft_id)
        if not draft:
            raise ValueError("KB draft not found")


        data = draft.get("data", {})
        data["chunking_config"] = chunking_config


        draft_service.update_draft(
            draft_type=DraftType.KB,
            draft_id=draft_id,
            updates={"data": data}
        )


    def update_embedding_config(
        self,
        draft_id: str,
        embedding_config: Dict[str, Any]
    ):
        """
        Update embedding configuration for KB draft.

        WHY: Configure embedding model (always local for privacy)
        HOW: Update embedding_config in Redis

        PHASE: 1 (Draft Mode - Redis Only)

        Args:
            draft_id: KB draft ID
            embedding_config: {
                "model": "all-MiniLM-L6-v2",
                "device": "cpu",
                "batch_size": 32,
                "normalize_embeddings": true
            }

        Raises:
            ValueError: If draft not found
        """

        draft = draft_service.get_draft(DraftType.KB, draft_id)
        if not draft:
            raise ValueError("KB draft not found")

        data = draft.get("data", {})
        data["embedding_config"] = embedding_config

        draft_service.update_draft(
            draft_type=DraftType.KB,
            draft_id=draft_id,
            updates={"data": data}
        )

    def validate_draft(self, draft_id: str) -> Dict[str, Any]:
        """
        Validate KB draft before finalization.

        WHY: Ensure draft is ready for processing
        HOW: Check required fields and source validity

        Args:
            draft_id: KB draft ID

        Returns:
            {
                "is_valid": bool,
                "errors": List[str],
                "warnings": List[str],
                "estimated_duration": int  # minutes
            }

        Raises:
            ValueError: If draft not found
        """

        draft = draft_service.get_draft(DraftType.KB, draft_id)
        if not draft:
            raise ValueError("KB draft not found")

        errors = []
        warnings = []
        data = draft.get("data", {})

        # Check required fields
        if not data.get("name"):
            errors.append("KB name is required")

        sources = data.get("sources", [])
        if not sources:
            errors.append("At least one source is required")

        # Validate sources
        for i, source in enumerate(sources):
            if source.get("type") != "web_scraping":
                errors.append(f"Source {i}: Unsupported source type")
                continue

            url = source.get("url")
            if not url or not url.startswith(("http://", "https://")):
                errors.append(f"Source {i}: Invalid URL")

        # Estimate processing duration
        total_pages = 0
        for source in sources:
            config = source.get("config", {})
            method = config.get("method", "single")
            if method == "crawl":
                max_pages = config.get("max_pages", 50)
                total_pages += max_pages
            else:
                total_pages += 1

        # Rough estimate: 2-4 seconds per page + embedding time
        estimated_duration = max(1, int(total_pages * 3 / 60))  # minutes

        return {
            "is_valid": len(errors) == 0,
            "errors": errors,
            "warnings": warnings,
            "estimated_duration": estimated_duration,
            "total_sources": len(sources),
            "estimated_pages": total_pages
        }

    async def finalize_draft(
        self,
        db: Session,
        draft_id: str,
        config_override: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Finalize KB draft: Create DB records and queue processing.

        WHY: Move from draft (Redis) to persistent storage (PostgreSQL)
        HOW: Create KB + Document placeholders, queue Celery task

        PHASE: 2 (Finalization - Create DB Records)

        FLOW:
        1. Validate draft
        2. Create KB record (status="processing")
        3. Create Document placeholders
        4. Create pipeline tracking in Redis
        5. Queue Celery background task
        6. Delete draft from Redis
        7. Return kb_id and pipeline_id

        Args:
            db: Database session
            draft_id: KB draft ID

        Returns:
            {
                "kb_id": str,
                "pipeline_id": str,
                "status": "processing",
                "message": str,
                "tracking_url": str,
                "estimated_completion_minutes": int
            }

        Raises:
            ValueError: If draft not found or validation fails
        """

        print(f"⭐ [FINALIZE_DRAFT] FUNCTION ENTRY - draft_id: {draft_id}")

        from app.models.knowledge_base import KnowledgeBase
        from app.models.document import Document
        import time

        # Get and validate draft
        print(f"⭐ [FINALIZE_DRAFT] Getting draft from Redis...")
        draft = draft_service.get_draft(DraftType.KB, draft_id)
        if not draft:
            raise ValueError("KB draft not found")

        validation = self.validate_draft(draft_id)
        if not validation["is_valid"]:
            raise ValueError(f"Invalid draft: {', '.join(validation['errors'])}")

        data = draft.get("data", {})

        # ========================================
        # PHASE 2: CREATE DATABASE RECORDS
        # ========================================

        # CRITICAL FIX: Merge draft config with config_override for finalization
        final_config = data.get("config", {})
        if config_override:
            print(f"🔧 [FINALIZE_DRAFT] Merging config_override: {config_override}")
            final_config.update(config_override)

        print(f"🔧 [FINALIZE_DRAFT] Final KB config: {final_config}")

        # Create KB record (status="processing")
        kb = KnowledgeBase(
            workspace_id=UUID(draft["workspace_id"]),
            name=data["name"],
            description=data.get("description"),
            config=final_config,  # Use merged config including chunking
            context=data.get("context", "both"),  # chatbot, chatflow, or both
            context_settings=data.get("context_settings", {}),
            embedding_config=data.get("embedding_config", {
                "model": "all-MiniLM-L6-v2",
                "device": "cpu"
            }),
            vector_store_config=data.get("vector_store_config", {
                "provider": "qdrant",
                "collection_name_prefix": "kb"
            }),
            indexing_method=data.get("indexing_method", "by_heading"),
            status="processing",  # Will be updated by background task
            created_by=UUID(draft["created_by"]),
            created_at=datetime.utcnow()
        )
        db.add(kb)
        db.flush()  # Get kb.id without committing

        # CRITICAL FIX: Create document placeholders based on chunking strategy to prevent duplication
        # For no_chunking strategy: Create single combined document
        # For other strategies: Create individual documents per source

        sources = data.get("sources", [])
        documents = []

        # Get chunking strategy from config_override (finalize request) or data
        final_config = config_override or {}
        chunking_config = final_config.get("chunking_config") or data.get("chunking_config", {})
        strategy = chunking_config.get("strategy", "by_heading")

        print(f"🔧 [FINALIZE_DRAFT] Document creation strategy check: chunking_strategy={strategy}")

        if strategy in ("no_chunking", "full_content") and len(sources) > 0:
            # Create single combined document for no_chunking strategy
            primary_source = sources[0]  # Use first source as primary reference

            # CRITICAL FIX: Use the SAME data source as chunk preview API for consistency
            approved_sources = []

            # PRIORITY 1: Check for approved_content sources (same as chunk preview API)
            approved_content_sources = [s for s in sources if s.get("status") == "approved" and s.get("type") == "approved_content"]
            if approved_content_sources:
                print(f"🎯 [FINALIZE_CONSISTENCY] Using approved_content sources (same as chunk preview)")
                for source in approved_content_sources:
                    approved_pages = source.get("approved_pages", [])
                    for page in approved_pages:
                        content = page.get("content", "")
                        if content.strip():
                            approved_page = {
                                "url": page.get("url", source.get("url", "")),
                                "title": page.get("title", ""),
                                "content": content,  # Exact same content as chunk preview
                                "markdown": content,
                                "is_edited": page.get("is_edited", False),
                                "source": "approved_content",
                                "metadata": page.get("metadata", {}),
                                "approved_at": page.get("approved_at"),
                                "approved_by": page.get("approved_by")
                            }
                            approved_sources.append(approved_page)
            else:
                # FALLBACK: Use original logic for legacy compatibility
                print(f"🔄 [FINALIZE_FALLBACK] Using metadata.previewPages (legacy compatibility)")
                for source in sources:
                    source_metadata = source.get("metadata", {})
                    preview_pages = source_metadata.get("previewPages", [])

                    # CRITICAL FIX: Extract content from APPROVED pages only (both edited and unedited)
                    for page in preview_pages:
                        # Only process pages that were actually approved by the user
                        if not page.get("is_approved", False):
                            continue  # Skip non-approved pages

                        # For approved pages, use edited_content if available, otherwise original content
                        approved_content = page.get("edited_content") or page.get("content", "")
                        if approved_content.strip():  # Only include non-empty content
                            approved_page = {
                                "url": page.get("url", source.get("url", "")),
                                "title": page.get("title", ""),
                                "content": approved_content,  # This is what user actually approved
                                "markdown": approved_content,
                                "is_edited": page.get("is_edited", False),
                                "source": "user_approved",
                                "metadata": page.get("metadata", {}),
                                "approved_at": page.get("approved_at"),
                                "approved_by": page.get("approved_by")
                            }
                            approved_sources.append(approved_page)

            combined_metadata = {
                "combined_sources": len(sources),
                "sources": [{"url": s.get("url"), "type": s.get("type")} for s in sources],
                "chunking_strategy": strategy,
                "document_type": "combined",
                "approved_sources": approved_sources  # CRITICAL: Include approved content for background task
            }

            print(f"✅ [FINALIZE_DRAFT] Extracted {len(approved_sources)} approved pages for combined document")

            document = Document(
                kb_id=kb.id,
                workspace_id=kb.workspace_id,
                name=f"{data['name']} (Combined {len(sources)} sources)",
                source_type="web_scraping_combined",
                source_url=primary_source.get("url"),
                source_metadata=combined_metadata,
                status="pending",  # Will be updated by background task
                created_by=UUID(draft["created_by"]),
                created_at=datetime.utcnow()
            )
            db.add(document)
            documents.append(document)
            print(f"✅ [FINALIZE_DRAFT] Created combined document placeholder for {len(sources)} sources")

        else:
            # Create individual document placeholders (normal behavior for chunked strategies)
            # CRITICAL FIX: For chunked strategies, check for BOTH approval methods
            # Method 1: New approved_content sources (from /approve-content endpoint)
            approved_content_sources = [s for s in sources if s.get("status") == "approved" and s.get("type") == "approved_content"]

            # Method 2: Sources with approved pages in metadata (from /approve-sources endpoint)
            sources_with_approved_pages = []
            for source in sources:
                metadata = source.get("metadata", {})
                preview_pages = metadata.get("previewPages", [])
                has_approved = any(page.get("is_approved", False) for page in preview_pages)
                if has_approved and source.get("type") != "approved_content":
                    sources_with_approved_pages.append(source)

            if approved_content_sources:
                print(f"🎯 [FINALIZE_INDIVIDUAL] Processing {len(approved_content_sources)} approved_content sources for chunked strategy")
                for source in approved_content_sources:
                    # Use the same data structure as chunk preview API
                    approved_pages = source.get("approved_pages", [])

                    # CRITICAL FIX: Create ONE document per approved PAGE for individual processing
                    # This ensures the placeholder documents match the page URLs during processing
                    for page in approved_pages:
                        content = page.get("content", "")
                        if content.strip():
                            # Each page gets its own document placeholder
                            page_url = page.get("url", source.get("url", ""))
                            page_title = page.get("title", "")

                            # Create approved_source for this specific page
                            approved_source_for_page = [{
                                "url": page_url,
                                "title": page_title,
                                "content": content,  # Exact same content as chunk preview
                                "markdown": content,
                                "is_edited": page.get("is_edited", False),
                                "source": "approved_content",
                                "metadata": page.get("metadata", {}),
                                "approved_at": page.get("approved_at"),
                                "approved_by": page.get("approved_by")
                            }]

                            # Create metadata for this page's document
                            page_metadata = {
                                **source.get("metadata", {}),
                                "approved_sources": approved_source_for_page,
                                "source_name": source.get("name"),
                                "source_id": source.get("id"),
                                "page_index": page.get("index"),
                                "is_approved_content": True
                            }

                            print(f"✅ [FINALIZE_INDIVIDUAL] Creating placeholder for page: {page_url}")

                            # Create individual document placeholder for this page
                            document = Document(
                                kb_id=kb.id,
                                workspace_id=kb.workspace_id,
                                name=page_title or page_url or f"Page from {source.get('name', 'Approved Content')}",
                                source_type="approved_content",
                                source_url=page_url,  # CRITICAL: Use the PAGE URL, not source URL
                                source_metadata=page_metadata,
                                status="pending",
                                created_by=UUID(draft["created_by"]),
                                created_at=datetime.utcnow()
                            )
                            db.add(document)
                            documents.append(document)

                    print(f"✅ [FINALIZE_INDIVIDUAL] Created {len(approved_pages)} placeholder documents for approved pages")
            elif sources_with_approved_pages:
                # Handle sources that have approved pages in metadata (from /approve-sources endpoint)
                print(f"🔄 [FINALIZE_INDIVIDUAL] Processing {len(sources_with_approved_pages)} sources with approved pages in metadata")
                for source in sources_with_approved_pages:
                    metadata = source.get("metadata", {})
                    preview_pages = metadata.get("previewPages", [])

                    # Process each approved page
                    for page in preview_pages:
                        if not page.get("is_approved", False):
                            continue  # Skip non-approved pages

                        # Get the content (edited or original)
                        content = page.get("edited_content") or page.get("content", "")
                        if not content.strip():
                            continue

                        page_url = page.get("url", source.get("url", ""))
                        page_title = page.get("title", "")

                        # Create approved_source for this specific page
                        approved_source_for_page = [{
                            "url": page_url,
                            "title": page_title,
                            "content": content,  # User approved content
                            "markdown": content,
                            "is_edited": page.get("is_edited", False),
                            "source": "user_approved",
                            "metadata": page.get("metadata", {}),
                            "approved_at": page.get("approved_at"),
                            "approved_by": page.get("approved_by")
                        }]

                        # Create metadata for this page's document
                        page_metadata = {
                            **metadata,
                            "approved_sources": approved_source_for_page,
                            "source_name": source.get("name", source.get("url", "")),
                            "source_id": source.get("id"),
                            "page_index": page.get("index"),
                            "is_approved_content": True,
                            "approval_method": "approve-sources"  # Mark how it was approved
                        }

                        print(f"✅ [FINALIZE_LEGACY_APPROVED] Creating placeholder for approved page: {page_url}")

                        # Create individual document placeholder for this page
                        document = Document(
                            kb_id=kb.id,
                            workspace_id=kb.workspace_id,
                            name=page_title or page_url or f"Page from {source.get('url', 'Source')}",
                            source_type=source.get("type", "web_scraping"),
                            source_url=page_url,  # Use the PAGE URL
                            source_metadata=page_metadata,
                            status="pending",
                            created_by=UUID(draft["created_by"]),
                            created_at=datetime.utcnow()
                        )
                        db.add(document)
                        documents.append(document)

                print(f"✅ [FINALIZE_LEGACY_APPROVED] Created placeholder documents for approved pages from {len(sources_with_approved_pages)} sources")
            else:
                # FALLBACK: Legacy compatibility for old draft format without approvals
                print(f"🔄 [FINALIZE_LEGACY] No approved_content sources found, using legacy previewPages logic")
                for source in sources:
                    # CRITICAL FIX: Extract approved content for each individual source
                    source_metadata = dict(source)  # Copy the original source metadata
                    preview_pages = source.get("metadata", {}).get("previewPages", [])

                    if preview_pages:
                        # CRITICAL FIX: Extract approved/edited content from APPROVED preview pages only
                        approved_sources = []
                        for page in preview_pages:
                            # Only process pages that were actually approved by the user
                            if not page.get("is_approved", False):
                                continue  # Skip non-approved pages

                            # For approved pages, use edited_content if available, otherwise original content
                            approved_content = page.get("edited_content") or page.get("content", "")
                            if approved_content.strip():
                                approved_page = {
                                    "url": page.get("url", source.get("url", "")),
                                    "title": page.get("title", ""),
                                    "content": approved_content,  # This is what user actually approved
                                    "markdown": approved_content,
                                    "is_edited": page.get("is_edited", False),
                                    "source": "user_approved",
                                    "metadata": page.get("metadata", {}),
                                    "approved_at": page.get("approved_at"),
                                    "approved_by": page.get("approved_by")
                                }
                                approved_sources.append(approved_page)

                        # Add approved content to source metadata
                        source_metadata["approved_sources"] = approved_sources
                        print(f"✅ [FINALIZE_LEGACY] Extracted {len(approved_sources)} approved pages for {source.get('url')}")

                    document = Document(
                        kb_id=kb.id,
                        workspace_id=kb.workspace_id,
                        name=source.get("url", "Unnamed source"),
                        source_type=source["type"],
                        source_url=source.get("url"),
                        source_metadata=source_metadata,  # Include approved content
                        status="pending",  # Will be updated by background task
                        created_by=UUID(draft["created_by"]),
                        created_at=datetime.utcnow()
                    )
                    db.add(document)
                    documents.append(document)
            print(f"✅ [FINALIZE_DRAFT] Created {len(documents)} individual document placeholders")

        # Commit to PostgreSQL
        db.commit()
        db.refresh(kb)

        # ========================================
        # PHASE 3: QUEUE BACKGROUND PROCESSING
        # ========================================

        # Create pipeline execution tracking in Redis
        # NOTE: pipeline_id format is "{kb_id}:{timestamp}" WITHOUT "pipeline:" prefix
        # The prefix is added when building Redis keys (e.g., f"pipeline:{pipeline_id}:status")
        pipeline_id = f"{str(kb.id)}:{int(time.time())}"

        # Store pipeline status in Redis WITH complete draft data for retry
        # CRITICAL: Store complete draft data to enable perfect retry without reconstruction
        pipeline_data = {
            "pipeline_id": pipeline_id,
            "kb_id": str(kb.id),
            "status": "queued",
            "created_at": datetime.utcnow().isoformat(),
            "sources": data.get("sources", []),
            "config": data,
            # RETRY ENHANCEMENT: Store complete draft data for retry
            "complete_draft_data": draft,  # This contains ALL original user data
            "finalized_at": datetime.utcnow().isoformat(),
            "retry_capable": True
        }

        draft_service.redis_client.setex(
            f"pipeline:{pipeline_id}:status",
            86400,  # 24 hour TTL
            json.dumps(pipeline_data)
        )

        # Queue background task
        from app.tasks.kb_pipeline_tasks import process_web_kb_task


        # CRITICAL FIX: Use configuration from frontend request instead of stale Redis data
        if config_override:

            # Merge the config_override with the draft data
            pipeline_config = {**data, **config_override}
            pipeline_preview_data = draft.get("preview_data")
        else:
            pipeline_config = data
            pipeline_preview_data = draft.get("preview_data")

        task = process_web_kb_task.apply_async(
            kwargs={
                "kb_id": str(kb.id),
                "pipeline_id": pipeline_id,
                "sources": pipeline_config.get("sources", []),
                "config": pipeline_config,  # Use fresh config with latest updates
                "preview_data": pipeline_preview_data
            },
            queue="default"  # Using default queue (web_scraping queue needs to be configured)
        )

        # Delete draft from Redis (cleanup)
        draft_service.delete_draft(DraftType.KB, draft_id)

        # Return finalization result
        return {
            "kb_id": str(kb.id),
            "pipeline_id": pipeline_id,
            "status": "processing",
            "message": "KB created successfully. Processing in background.",
            "tracking_url": f"/api/v1/pipelines/{pipeline_id}/status",
            "estimated_completion_minutes": validation.get("estimated_duration", 3)
        }

# Global instance
kb_draft_service = KBDraftService()
