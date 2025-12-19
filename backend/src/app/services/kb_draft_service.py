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

    async def add_file_source_to_draft(
        self,
        draft_id: str,
        file_stream: Any,
        filename: str,
        file_size: int,
        mime_type: str
    ) -> Dict[str, Any]:
        """
        Add file upload to KB draft with Tika parsing.

        WHY: Support PDF, DOCX, CSV, TXT, and 15+ file formats
        HOW: Parse with Tika, store extracted content in Redis draft

        PHASE: 1 (Draft Mode - Redis Only)

        IMPORTANT: File content is stored ONLY in Redis draft
                   When finalized, content goes ONLY to Qdrant (not PostgreSQL)
                   PostgreSQL stores ONLY metadata

        Args:
            draft_id: KB draft ID
            file_stream: File binary stream
            filename: Original filename
            file_size: File size in bytes
            mime_type: MIME type (detected from file)

        Returns:
            {
                "source_id": str,
                "filename": str,
                "file_size": int,
                "mime_type": str,
                "page_count": int,
                "char_count": int,
                "word_count": int,
                "parsing_time_ms": int
            }

        Raises:
            ValueError: If draft not found or file invalid
            ConnectionError: If Tika service unavailable
            RuntimeError: If parsing fails
        """

        from app.services.tika_service import tika_service

        # Get draft
        draft = draft_service.get_draft(DraftType.KB, draft_id)
        if not draft:
            raise ValueError("KB draft not found")

        print(f"[KB Draft] Parsing file upload: {filename} ({file_size / 1024:.1f} KB)")

        # Parse file with Tika
        parsed_file = await tika_service.parse_file(
            file_stream=file_stream,
            filename=filename,
            metadata_only=False  # Extract full content
        )

        print(f"[KB Draft] Parsed {len(parsed_file.content)} characters from {filename}")

        # Create source entry
        source_id = str(uuid4())
        content = parsed_file.content

        # CRITICAL: Normalize content to remove leading/trailing whitespace and excessive blank lines
        # This prevents empty space appearing before content in preview
        import re

        def normalize_content(text: str) -> str:
            """Normalize content by removing excessive whitespace and blank lines."""
            if not text:
                return ""
            # Strip leading/trailing whitespace
            text = text.strip()
            # Replace 3+ consecutive newlines with 2
            text = re.sub(r'\n{3,}', '\n\n', text)
            return text

        # Apply normalization to main content
        content = normalize_content(content)

        # CRITICAL: Create preview_pages BEFORE storing source in Redis
        # This ensures preview_pages persist and are available for Content Approval
        preview_pages = []

        # For files with page count, split by page markers or use full content
        if parsed_file.page_count and parsed_file.page_count > 1:
            # Try to split by page markers (common in PDFs parsed by Tika)
            page_splits = content.split('\x0c')  # Form feed character
            if len(page_splits) > 1:
                for i, page_content in enumerate(page_splits):
                    # CRITICAL: Normalize each page's content to remove whitespace
                    page_content = normalize_content(page_content)
                    if page_content:
                        preview_pages.append({
                            "url": f"file:///{filename}#page={i+1}",
                            "title": f"{filename} - Page {i+1}",
                            "content": page_content,
                            "word_count": len(page_content.split()),
                            "char_count": len(page_content),
                            "source_id": source_id,
                            "page_index": i
                        })
            else:
                # No page markers, use full content as single page
                preview_pages.append({
                    "url": f"file:///{filename}",
                    "title": filename,
                    "content": content,
                    "word_count": len(content.split()),
                    "char_count": len(content),
                    "source_id": source_id,
                    "page_index": 0
                })
        else:
            # Single page or unknown page count
            preview_pages.append({
                "url": f"file:///{filename}",
                "title": filename,
                "content": content,
                "word_count": len(content.split()),
                "char_count": len(content),
                "source_id": source_id,
                "page_index": 0
            })

        print(f"[KB Draft] Created {len(preview_pages)} preview pages for {filename}")

        # Create source entry with preview_pages included
        source = {
            "id": source_id,
            "type": "file_upload",
            "filename": filename,
            "file_size": file_size,
            "mime_type": mime_type,
            "parsed_content": content,  # CRITICAL: Store in Redis draft only
            "file_metadata": parsed_file.metadata,
            "page_count": parsed_file.page_count or len(preview_pages),
            "char_count": len(content),
            "word_count": len(content.split()),
            "parsing_time_ms": parsed_file.parsing_time_ms,
            "added_at": datetime.utcnow().isoformat(),
            "parsed_at": datetime.utcnow().isoformat(),
            # CRITICAL: Store preview_pages in Redis for Content Approval step
            "preview_pages": preview_pages
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

        print(f"[KB Draft] Added file source {source_id} to draft {draft_id} with {len(preview_pages)} preview pages")

        return {
            "source_id": source_id,
            "filename": filename,
            "file_size": file_size,
            "mime_type": mime_type,
            "page_count": parsed_file.page_count or len(preview_pages),
            "char_count": len(content),
            "word_count": len(content.split()),
            "parsing_time_ms": parsed_file.parsing_time_ms,
            "preview_pages": preview_pages  # Include for content approval step
        }

    async def add_bulk_file_sources_to_draft(
        self,
        draft_id: str,
        files: List[tuple[Any, str, int, str]]  # [(stream, filename, size, mime_type)]
    ) -> Dict[str, Any]:
        """
        Add multiple file uploads to KB draft in batch.

        WHY: Efficient bulk file upload processing
        HOW: Parse all files with Tika concurrently, add atomically

        PHASE: 1 (Draft Mode - Redis Only)

        Args:
            draft_id: KB draft ID
            files: List of (file_stream, filename, file_size, mime_type) tuples

        Returns:
            {
                "sources_added": int,
                "source_ids": List[str],
                "total_chars": int,
                "total_pages": int,
                "failed_files": List[dict],
                "total_sources_after": int
            }

        Raises:
            ValueError: If draft not found
        """

        from app.services.tika_service import tika_service

        # Get draft
        draft = draft_service.get_draft(DraftType.KB, draft_id)
        if not draft:
            raise ValueError("KB draft not found")

        print(f"[KB Draft] Bulk parsing {len(files)} files")

        # Parse all files concurrently
        sources_added = []
        source_ids = []
        failed_files = []
        total_chars = 0
        total_pages = 0

        for file_stream, filename, file_size, mime_type in files:
            try:
                # Parse file
                parsed_file = await tika_service.parse_file(
                    file_stream=file_stream,
                    filename=filename,
                    metadata_only=False
                )

                # Create source entry
                source_id = str(uuid4())
                source = {
                    "id": source_id,
                    "type": "file_upload",
                    "filename": filename,
                    "file_size": file_size,
                    "mime_type": mime_type,
                    "parsed_content": parsed_file.content,
                    "file_metadata": parsed_file.metadata,
                    "page_count": parsed_file.page_count,
                    "char_count": len(parsed_file.content),
                    "word_count": len(parsed_file.content.split()),
                    "parsing_time_ms": parsed_file.parsing_time_ms,
                    "added_at": datetime.utcnow().isoformat(),
                    "added_via": "bulk_operation"
                }

                sources_added.append(source)
                source_ids.append(source_id)
                total_chars += len(parsed_file.content)
                total_pages += parsed_file.page_count or 0

                print(f"[KB Draft] Parsed {filename}: {len(parsed_file.content)} chars")

            except Exception as e:
                print(f"[KB Draft] Failed to parse {filename}: {e}")
                failed_files.append({
                    "filename": filename,
                    "error": str(e)
                })

        # Add all valid sources atomically
        if sources_added:
            data = draft.get("data", {})
            existing_sources = data.get("sources", [])
            all_sources = existing_sources + sources_added
            data["sources"] = all_sources

            draft_service.update_draft(
                draft_type=DraftType.KB,
                draft_id=draft_id,
                updates={"data": data}
            )

            print(f"[KB Draft] Added {len(sources_added)} file sources to draft {draft_id}")

        return {
            "sources_added": len(sources_added),
            "source_ids": source_ids,
            "total_chars": total_chars,
            "total_pages": total_pages,
            "failed_files": failed_files,
            "total_sources_after": len(draft.get("data", {}).get("sources", [])) + len(sources_added)
        }

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
        # Supported source types: web_scraping, file_upload, text_input, approved_content
        SUPPORTED_SOURCE_TYPES = {"web_scraping", "file_upload", "text_input", "approved_content"}

        for i, source in enumerate(sources):
            source_type = source.get("type")

            if source_type not in SUPPORTED_SOURCE_TYPES:
                errors.append(f"Source {i}: Unsupported source type '{source_type}'")
                continue

            # Validate web_scraping sources require URL
            if source_type == "web_scraping":
                url = source.get("url")
                if not url or not url.startswith(("http://", "https://")):
                    errors.append(f"Source {i}: Invalid URL")

            # Validate file_upload sources require parsed_content
            elif source_type == "file_upload":
                if not source.get("parsed_content"):
                    errors.append(f"Source {i}: File upload missing parsed content")

            # Validate text_input sources
            elif source_type == "text_input":
                if not source.get("content"):
                    errors.append(f"Source {i}: Text input missing content")

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

        from app.models.knowledge_base import KnowledgeBase
        from app.models.document import Document
        import time

        # Get and validate draft
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
            final_config.update(config_override)

        # WIRING FIX: Merge retrieval_config into context_settings
        # The model-config endpoint saves retrieval_config at data["retrieval_config"]
        # But retrieval_service reads from kb.context_settings.retrieval_config
        # So we need to wire them together during finalization
        # Priority: config_override > data (draft)
        final_context_settings = data.get("context_settings", {})
        retrieval_config = (config_override or {}).get("retrieval_config") or data.get("retrieval_config")
        if retrieval_config:
            final_context_settings["retrieval_config"] = retrieval_config

        # Get context value for KB creation
        context_value = data.get("context", "both")

        # Resolve embedding_config and vector_store_config (priority: config_override > data)
        final_embedding_config = (config_override or {}).get("embedding_config") or data.get("embedding_config", {
            "model": "all-MiniLM-L6-v2",
            "device": "cpu"
        })
        final_vector_store_config = (config_override or {}).get("vector_store_config") or data.get("vector_store_config", {
            "provider": "qdrant",
            "collection_name_prefix": "kb"
        })

        # Create KB record (status="processing")
        kb = KnowledgeBase(
            workspace_id=UUID(draft["workspace_id"]),
            name=data["name"],
            description=data.get("description"),
            config=final_config,  # Use merged config including chunking
            context=context_value,  # chatbot, chatflow, or both (use traced value)
            context_settings=final_context_settings,  # NOW includes retrieval_config!
            embedding_config=final_embedding_config,
            vector_store_config=final_vector_store_config,
            indexing_method=final_config.get("indexing_method", "high_quality"),
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

                    # CRITICAL FIX: Collect ALL approved pages from this source
                    all_approved_sources_from_this_source = []
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
                            all_approved_sources_from_this_source.append(approved_page)

                    print(f"📋 [FINALIZE_INDIVIDUAL] Collected {len(all_approved_sources_from_this_source)} approved pages from source {source.get('url', 'Unknown')}")

                    # CRITICAL FIX: Create ONE document per approved PAGE for individual processing
                    # But store ALL approved pages from the source in each document's metadata
                    for page in approved_pages:
                        content = page.get("content", "")
                        if content.strip():
                            # Each page gets its own document placeholder
                            page_url = page.get("url", source.get("url", ""))
                            page_title = page.get("title", "")

                            # Create metadata for this page's document with ALL approved sources from the source
                            page_metadata = {
                                **source.get("metadata", {}),
                                "approved_sources": all_approved_sources_from_this_source,  # ALL pages, not just this one
                                "source_name": source.get("name"),
                                "source_id": source.get("id"),
                                "page_index": page.get("index"),
                                "is_approved_content": True,
                                "total_approved_pages": len(all_approved_sources_from_this_source)  # For debugging
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

                    # CRITICAL FIX: Collect ALL approved pages from this source FIRST
                    all_approved_sources_from_this_source = []
                    for page in preview_pages:
                        if not page.get("is_approved", False):
                            continue  # Skip non-approved pages

                        # Get the content (edited or original)
                        content = page.get("edited_content") or page.get("content", "")
                        if not content.strip():
                            continue

                        approved_page = {
                            "url": page.get("url", source.get("url", "")),
                            "title": page.get("title", ""),
                            "content": content,  # User approved content
                            "markdown": content,
                            "is_edited": page.get("is_edited", False),
                            "source": "user_approved",
                            "metadata": page.get("metadata", {}),
                            "approved_at": page.get("approved_at"),
                            "approved_by": page.get("approved_by")
                        }
                        all_approved_sources_from_this_source.append(approved_page)

                    print(f"📋 [FINALIZE_INDIVIDUAL] Collected {len(all_approved_sources_from_this_source)} approved pages from source {source.get('url', 'Unknown')}")

                    # Process each approved page to create individual documents
                    for page in preview_pages:
                        if not page.get("is_approved", False):
                            continue  # Skip non-approved pages

                        # Get the content (edited or original)
                        content = page.get("edited_content") or page.get("content", "")
                        if not content.strip():
                            continue

                        page_url = page.get("url", source.get("url", ""))
                        page_title = page.get("title", "")

                        # Create metadata for this page's document with ALL approved sources from the source
                        page_metadata = {
                            **metadata,
                            "approved_sources": all_approved_sources_from_this_source,  # ALL pages, not just this one
                            "source_name": source.get("name", source.get("url", "")),
                            "source_id": source.get("id"),
                            "page_index": page.get("index"),
                            "is_approved_content": True,
                            "approval_method": "approve-sources",  # Mark how it was approved
                            "total_approved_pages": len(all_approved_sources_from_this_source)  # For debugging
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
                # Also handles file_upload and text_input sources
                print(f"🔄 [FINALIZE_LEGACY] Processing {len(sources)} sources (file_upload, text_input, or legacy web)")
                for source in sources:
                    source_type = source.get("type", "unknown")
                    source_metadata = dict(source)  # Copy the original source metadata

                    # Handle file_upload sources
                    if source_type == "file_upload":
                        parsed_content = source.get("parsed_content", "")
                        if not parsed_content.strip():
                            print(f"⚠️ [FINALIZE_FILE] Skipping empty file upload: {source.get('filename')}")
                            continue

                        # Create approved_sources structure for file uploads
                        approved_sources = [{
                            "url": f"file://{source.get('filename', 'unknown')}",
                            "title": source.get("filename", "Uploaded File"),
                            "content": parsed_content,
                            "markdown": parsed_content,
                            "is_edited": False,
                            "source": "file_upload",
                            "metadata": source.get("file_metadata", {}),
                            "approved_at": source.get("parsed_at"),
                            "approved_by": draft.get("created_by")
                        }]
                        source_metadata["approved_sources"] = approved_sources
                        print(f"✅ [FINALIZE_FILE] Created document for file: {source.get('filename')}")

                        document = Document(
                            kb_id=kb.id,
                            workspace_id=kb.workspace_id,
                            name=source.get("filename", "Uploaded File"),
                            source_type="file_upload",
                            source_url=f"file:///{source.get('filename', 'unknown')}",  # Triple slash to match pipeline tasks
                            source_metadata=source_metadata,
                            content_full=None,  # OPTION A: Metadata-only storage for file uploads (content in Qdrant only)
                            status="pending",
                            created_by=UUID(draft["created_by"]),
                            created_at=datetime.utcnow()
                        )
                        db.add(document)
                        documents.append(document)

                    # Handle text_input sources
                    elif source_type == "text_input":
                        content = source.get("content", "")
                        if not content.strip():
                            print(f"⚠️ [FINALIZE_TEXT] Skipping empty text input")
                            continue

                        approved_sources = [{
                            "url": "text://direct-input",
                            "title": source.get("name", "Direct Text Input"),
                            "content": content,
                            "markdown": content,
                            "is_edited": False,
                            "source": "text_input",
                            "metadata": {},
                            "approved_at": source.get("added_at"),
                            "approved_by": draft.get("created_by")
                        }]
                        source_metadata["approved_sources"] = approved_sources

                        document = Document(
                            kb_id=kb.id,
                            workspace_id=kb.workspace_id,
                            name=source.get("name", "Direct Text Input"),
                            source_type="text_input",
                            source_url="text://direct-input",
                            source_metadata=source_metadata,
                            content_full=content,
                            status="pending",
                            created_by=UUID(draft["created_by"]),
                            created_at=datetime.utcnow()
                        )
                        db.add(document)
                        documents.append(document)

                    # Handle web_scraping sources (legacy)
                    else:
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

        # Store Celery task ID in pipeline status for cancellation support
        pipeline_data["celery_task_id"] = task.id
        draft_service.redis_client.setex(
            f"pipeline:{pipeline_id}:status",
            86400,  # 24 hour TTL
            json.dumps(pipeline_data)
        )

        # Delete draft from Redis (cleanup)
        draft_service.delete_draft(DraftType.KB, draft_id)

        # Return finalization result
        return {
            "kb_id": str(kb.id),
            "pipeline_id": pipeline_id,
            "celery_task_id": task.id,  # Include for frontend reference
            "status": "processing",
            "message": "KB created successfully. Processing in background.",
            "tracking_url": f"/api/v1/pipelines/{pipeline_id}/status",
            "estimated_completion_minutes": validation.get("estimated_duration", 3)
        }

# Global instance
kb_draft_service = KBDraftService()
