"""
KB Pipeline Tasks - Celery background task for web KB processing.

PHASE 3: Background Processing (Celery Task)
- Scrape → Parse → Chunk → Embed → Index
- Real-time progress updates to Redis
- Update KB status on completion

This file implements the complete KB web URL processing pipeline.
Triggered after finalization (Phase 2) from kb_draft_service.
"""

from celery import shared_task
from uuid import UUID
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from datetime import datetime
import json
import asyncio
import traceback

from app.db.session import SessionLocal
from app.services.crawl4ai_service import crawl4ai_service, CrawlConfig
from app.services.embedding_service_local import embedding_service
from app.services.qdrant_service import qdrant_service, QdrantChunk
from app.services.chunking_service import chunking_service
from app.services.draft_service import draft_service
from app.models.knowledge_base import KnowledgeBase
from app.models.document import Document
from app.models.chunk import Chunk


def serialize_metadata(obj: Any) -> Any:
    """
    Recursively serialize metadata objects to JSON-compatible types.

    WHY: PostgreSQL JSONB fields can't store datetime objects directly.
    HOW: Convert datetime to ISO format strings recursively.

    Args:
        obj: Any Python object (dict, list, datetime, etc.)

    Returns:
        JSON-serializable version of the object
    """
    if isinstance(obj, datetime):
        return obj.isoformat()
    elif isinstance(obj, dict):
        return {key: serialize_metadata(value) for key, value in obj.items()}
    elif isinstance(obj, list):
        return [serialize_metadata(item) for item in obj]
    elif isinstance(obj, (str, int, float, bool, type(None))):
        return obj
    else:
        # For other types, try to convert to string
        return str(obj)


class PipelineProgressTracker:
    """
    Track pipeline progress in Redis.

    WHY: Real-time progress updates for frontend polling
    HOW: Update Redis key with current stage, stats, timestamps
    """

    def __init__(self, pipeline_id: str, kb_id: str):
        self.pipeline_id = pipeline_id
        self.kb_id = kb_id
        self.redis_key = f"pipeline:{pipeline_id}:status"

        # Initialize stats
        self.stats = {
            "pages_discovered": 0,
            "pages_scraped": 0,
            "pages_failed": 0,
            "chunks_created": 0,
            "embeddings_generated": 0,
            "vectors_indexed": 0
        }

    def update_status(
        self,
        status: str,
        current_stage: str,
        progress_percentage: int,
        error: Optional[str] = None
    ):
        """
        Update pipeline status in Redis.

        Args:
            status: "queued" | "running" | "completed" | "failed" | "cancelled"
            current_stage: Human-readable current stage
            progress_percentage: 0-100
            error: Error message if failed
        """

        # Get existing pipeline data
        existing_json = draft_service.redis_client.get(self.redis_key)
        if existing_json:
            pipeline_data = json.loads(existing_json)
        else:
            pipeline_data = {
                "pipeline_id": self.pipeline_id,
                "kb_id": self.kb_id,
                "started_at": datetime.utcnow().isoformat()
            }

        # Update status
        pipeline_data.update({
            "status": status,
            "current_stage": current_stage,
            "progress_percentage": progress_percentage,
            "stats": self.stats,
            "updated_at": datetime.utcnow().isoformat()
        })

        if error:
            pipeline_data["error"] = error

        # Save to Redis with SMART TTL management
        # WHY: Don't extend TTL for completed pipelines to avoid infinite retention
        if status in ["completed", "failed", "cancelled"]:
            # For completed pipelines, set shorter TTL (2 hours) and don't extend existing TTL
            current_ttl = draft_service.redis_client.ttl(self.redis_key)
            if current_ttl > 0:
                # If key exists with TTL, keep existing TTL but cap at 2 hours max
                new_ttl = min(current_ttl, 7200)  # 2 hours max
            else:
                # If no TTL or key doesn't exist, set 2 hours
                new_ttl = 7200  # 2 hours

            draft_service.redis_client.setex(
                self.redis_key,
                new_ttl,
                json.dumps(pipeline_data)
            )
            print(f"🔒 Pipeline {self.pipeline_id} completed - TTL set to {new_ttl/3600:.1f} hours")

        else:
            # For active pipelines (running, queued), use 6 hour TTL
            draft_service.redis_client.setex(
                self.redis_key,
                21600,  # 6 hours
                json.dumps(pipeline_data)
            )

    def update_stats(self, **kwargs):
        """Update specific stats counters."""
        self.stats.update(kwargs)

    def add_log(self, level: str, message: str, details: Optional[Dict] = None):
        """
        Add log entry to Redis.

        Args:
            level: "info" | "warning" | "error"
            message: Log message
            details: Optional additional details
        """

        logs_key = f"pipeline:{self.pipeline_id}:logs"

        # Get existing logs
        logs_json = draft_service.redis_client.get(logs_key)
        logs = json.loads(logs_json) if logs_json else []

        # Add new log
        log_entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "level": level,
            "message": message
        }
        if details:
            log_entry["details"] = details

        logs.append(log_entry)

        # Save logs (keep last 1000 entries, 24 hour TTL)
        draft_service.redis_client.setex(
            logs_key,
            86400,
            json.dumps(logs[-1000:])
        )


@shared_task(bind=True, name="process_web_kb")
def process_web_kb_task(
    self,
    kb_id: str,
    pipeline_id: str,
    sources: List[Dict[str, Any]],
    config: Dict[str, Any],
    preview_data: Optional[Dict[str, Any]] = None
):
    """
    Process web KB: Scrape → Parse → Chunk → Embed → Index.

    PHASE: 3 (Background Processing)
    DURATION: 2-30 minutes (depends on pages)

    FLOW:
    1. Initialize progress tracker
    2. Create Qdrant collection
    3. For each source:
       a. Scrape web pages (single or crawl)
       b. Parse markdown content
       c. Chunk content
       d. Generate embeddings
       e. Index in Qdrant
       f. Create Document + Chunk records
    4. Update KB status to "ready"
    5. Clean up progress tracking

    Args:
        kb_id: Knowledge base UUID
        pipeline_id: Pipeline tracking ID
        sources: List of web sources with configs
        config: KB configuration (chunking, embedding)

    Returns:
        {
            "kb_id": str,
            "status": "completed",
            "stats": {...},
            "duration_seconds": int
        }
    """

    db = SessionLocal()
    start_time = datetime.utcnow()
    tracker = PipelineProgressTracker(pipeline_id, kb_id)

    # Import smart KB service at function level to avoid scoping issues
    from app.services.smart_kb_service import smart_kb_service

    try:
        # ========================================
        # STEP 0: INITIALIZATION
        # ========================================

        tracker.update_status(
            status="running",
            current_stage="Initializing pipeline",
            progress_percentage=0
        )
        tracker.add_log("info", f"Starting KB processing pipeline for KB {kb_id}")

        # Get KB from database
        kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == UUID(kb_id)).first()
        if not kb:
            raise ValueError(f"KB not found: {kb_id}")

        # Check if pipeline was cancelled
        pipeline_status_json = draft_service.redis_client.get(f"pipeline:{pipeline_id}:status")
        if pipeline_status_json:
            pipeline_status = json.loads(pipeline_status_json)
            if pipeline_status.get("status") == "cancelled":
                tracker.add_log("warning", "Pipeline cancelled by user")
                kb.status = "failed"
                kb.error_message = "Pipeline cancelled by user"
                db.commit()
                return {
                    "kb_id": kb_id,
                    "status": "cancelled",
                    "message": "Pipeline cancelled by user"
                }

        # Extract config
        chunking_config = config.get("chunking_config", {})
        embedding_config = config.get("embedding_config", {})

        chunk_strategy = chunking_config.get("strategy", "by_heading")
        chunk_size = chunking_config.get("chunk_size", 1000)
        chunk_overlap = chunking_config.get("chunk_overlap", 200)

        # ========================================
        # STEP 1: CREATE QDRANT COLLECTION
        # ========================================

        tracker.update_status(
            status="running",
            current_stage="Creating vector store collection",
            progress_percentage=5
        )
        tracker.add_log("info", f"Creating Qdrant collection for KB {kb_id}")

        # Create collection in Qdrant
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

        try:
            loop.run_until_complete(
                qdrant_service.create_kb_collection(
                    kb_id=UUID(kb_id),
                    vector_size=embedding_service.get_embedding_dimension()
                )
            )
            tracker.add_log("info", "Qdrant collection created successfully")
        except Exception as e:
            tracker.add_log("warning", f"Qdrant collection creation warning: {str(e)}")
            # Collection might already exist, continue

        # ========================================
        # STEP 2: PROCESS EACH SOURCE
        # ========================================

        total_sources = len(sources)
        tracker.update_stats(pages_discovered=total_sources)

        all_failed = True  # Track if ALL sources fail

        for source_idx, source in enumerate(sources):
            source_url = source.get("url")
            source_config = source.get("config", {})

            tracker.update_status(
                status="running",
                current_stage=f"Processing source {source_idx + 1}/{total_sources}: {source_url}",
                progress_percentage=10 + int((source_idx / total_sources) * 80)
            )
            tracker.add_log("info", f"Processing source: {source_url}")

            try:
                # ========================================
                # STEP 2a: CHECK FOR EDITED CONTENT OR SCRAPE
                # ========================================

                # Check if this is an approved source with content (Phase 1C architecture)
                scraped_pages = None
                if source.get("type") == "approved_content" and source.get("status") == "approved":
                    # Use approved content from sources (Phase 1C)
                    approved_pages = source.get("approved_pages", [])
                    scraped_pages = []

                    for page in approved_pages:
                        # Use final approved content (edited or original)
                        content = page.get("content", "")

                        # Create scraped_page format expected by processing logic
                        scraped_page = {
                            "url": page.get("url", source_url),
                            "title": page.get("title", ""),
                            "content": content,
                            "markdown": content,  # Content is already processed
                            "is_edited": page.get("is_edited", False),
                            "source": "approved_content",  # Flag to indicate this came from approved sources
                            "approved_at": page.get("approved_at"),
                            "original_content": page.get("original_content", ""),
                            "metadata": page.get("metadata", {})
                        }
                        scraped_pages.append(scraped_page)

                    tracker.add_log("info", f"Using {len(scraped_pages)} approved pages from source: {source.get('name')}")
                    print(f"[DEBUG] Using {len(scraped_pages)} approved pages from source (no scraping needed)")

                elif preview_data and preview_data.get("pages"):
                    # Fallback: Use preview_data if no approved sources (legacy support)
                    preview_pages = preview_data.get("pages", [])
                    scraped_pages = []

                    for page in preview_pages:
                        # Use edited content if available, otherwise original content
                        content = page.get("edited_content") or page.get("content", "")

                        scraped_page = {
                            "url": page.get("url", source_url),
                            "title": page.get("title", ""),
                            "content": content,
                            "markdown": content,
                            "is_edited": page.get("is_edited", False),
                            "source": "preview_data",
                            "metadata": page.get("metadata", {})
                        }
                        scraped_pages.append(scraped_page)

                    tracker.add_log("info", f"Using {len(scraped_pages)} pages from preview data (fallback mode)")
                    print(f"[DEBUG] Using {len(scraped_pages)} pages from preview_data (fallback)")

                if not scraped_pages:
                    # No preview data available, proceed with normal scraping
                    tracker.add_log("info", f"Scraping {source_url}")

                    # Build crawl config
                    crawl_config = CrawlConfig(
                        max_pages=source_config.get("max_pages", 50),
                        max_depth=source_config.get("max_depth", 3),
                        include_patterns=source_config.get("include_patterns", []),
                        exclude_patterns=source_config.get("exclude_patterns", []),
                        stealth_mode=source_config.get("stealth_mode", True)
                    )

                    # Scrape (single or crawl)
                    method = source_config.get("method", "single")

                    print(f"[DEBUG] About to scrape: {source_url}, method={method}")
                    tracker.add_log("info", f"Starting scrape: {source_url} (method={method})")

                    if method == "crawl":
                        print(f"[DEBUG] Calling crawl_website for {source_url}")
                        scraped_pages = loop.run_until_complete(
                            crawl4ai_service.crawl_website(
                                start_url=source_url,
                                config=crawl_config
                            )
                        )
                        print(f"[DEBUG] Crawl completed, got {len(scraped_pages)} pages")
                    else:
                        # Single page scrape
                        print(f"[DEBUG] Calling scrape_single_url for {source_url}")
                        scraped_page = loop.run_until_complete(
                            crawl4ai_service.scrape_single_url(
                                url=source_url,
                                config=crawl_config
                            )
                        )
                        scraped_pages = [scraped_page]
                        print(f"[DEBUG] Single page scrape completed")

                tracker.update_stats(pages_scraped=tracker.stats["pages_scraped"] + len(scraped_pages))
                pages_source = "preview data with edits" if preview_data and preview_data.get("pages") else "live scraping"
                tracker.add_log("info", f"Processed {len(scraped_pages)} pages from {source_url} using {pages_source}")

                # ========================================
                # STEP 2b: PROCESS PAGES (INDIVIDUAL OR COMBINED)
                # ========================================

                # Check if we should combine pages into single document for no_chunking strategy
                # Note: Even single pages should use this path for consistency
                should_combine_pages = chunk_strategy in ("no_chunking", "full_content")

                if should_combine_pages:
                    # COMBINE ALL PAGES INTO SINGLE DOCUMENT
                    print(f"[DEBUG] Combining {len(scraped_pages)} pages into single document (no_chunking strategy)")

                    # Combine all page contents
                    combined_content = []
                    combined_metadata = {
                        "source_url": source_url,
                        "source_type": "web_crawl_combined",
                        "total_pages": len(scraped_pages),
                        "pages": []
                    }

                    for page_idx, scraped_page in enumerate(scraped_pages):
                        page_url = scraped_page.get("url") if isinstance(scraped_page, dict) else scraped_page.url
                        page_content = scraped_page.get("content") if isinstance(scraped_page, dict) else scraped_page.content
                        page_title = scraped_page.get("title") if isinstance(scraped_page, dict) else scraped_page.title

                        if page_content and len(page_content.strip()) >= 50:
                            # Add page separator and content
                            page_separator = f"\n\n=== PAGE {page_idx + 1}: {page_title or page_url} ===\n\n"
                            combined_content.append(page_separator + page_content.strip())

                            # Track page metadata
                            combined_metadata["pages"].append({
                                "page_number": page_idx + 1,
                                "url": page_url,
                                "title": page_title or "",
                                "content_length": len(page_content.strip())
                            })

                    # Process combined content as single document
                    final_combined_content = "\n\n".join(combined_content)

                    if final_combined_content.strip():
                        try:
                            # Create single document for all pages
                            print(f"[DEBUG] Creating combined Document record for {len(scraped_pages)} pages from: {source_url}")

                            document = Document(
                                kb_id=UUID(kb_id),
                                workspace_id=kb.workspace_id,
                                name=f"{source.get('name', 'Web Source')} (Combined {len(scraped_pages)} pages)",
                                source_type="web_scraping",
                                source_url=source_url,
                                source_metadata=serialize_metadata(combined_metadata),
                                status="processing",
                                created_by=kb.created_by,
                                created_at=datetime.utcnow()
                            )
                            db.add(document)
                            db.flush()

                            # Process with smart KB service
                            print(f"[DEBUG] About to call smart_kb_service.process_document_with_proper_storage")
                            print(f"[DEBUG] Smart KB Service - user_config: {config.get('chunking_config', {})}")

                            processing_result = loop.run_until_complete(
                                smart_kb_service.process_document_with_proper_storage(
                                    document=document,
                                    content=final_combined_content,
                                    kb=kb,
                                    user_config=config.get("chunking_config", {})
                                )
                            )

                            print(f"[DEBUG] smart_kb_service call completed successfully")
                            print(f"[DEBUG] processing_result keys: {list(processing_result.keys())}")

                            if "error" in processing_result:
                                print(f"[ERROR] Processing failed: {processing_result['error']}")
                                document.status = "failed"
                                document.processing_error = processing_result["error"]
                            else:
                                postgres_chunks = processing_result.get("postgres_chunks", [])
                                qdrant_chunks = processing_result.get("qdrant_chunks", [])

                                # Update document metadata
                                current_metadata = document.source_metadata or {}
                                current_metadata.update({
                                    "chunking_decision": processing_result.get("chunking_decision").__dict__ if hasattr(processing_result.get("chunking_decision"), '__dict__') else str(processing_result.get("chunking_decision")),
                                    "chunks_created": len(postgres_chunks),
                                    "processing_completed_at": datetime.utcnow().isoformat()
                                })
                                document.source_metadata = current_metadata
                                document.status = "processed"

                                # Update Qdrant chunks with document metadata
                                for qdrant_chunk in qdrant_chunks:
                                    qdrant_chunk.metadata["document_id"] = str(document.id)
                                    qdrant_chunk.metadata["page_url"] = source_url
                                    qdrant_chunk.metadata["page_title"] = f"Combined {len(scraped_pages)} pages"

                                db.commit()
                                print(f"[DEBUG] Database commit successful, created {len(postgres_chunks)} chunks for combined document: {source_url}")

                                # Index in Qdrant
                                print(f"[DEBUG] About to upsert {len(qdrant_chunks)} chunks to Qdrant for combined document: {source_url}")

                                try:
                                    loop.run_until_complete(
                                        qdrant_service.upsert_chunks(
                                            kb_id=UUID(kb_id),
                                            chunks=qdrant_chunks
                                        )
                                    )
                                    print(f"[DEBUG] Qdrant upsert successful for {len(qdrant_chunks)} chunks")

                                    # Update stats
                                    tracker.update_stats(
                                        chunks_created=tracker.stats["chunks_created"] + len(postgres_chunks),
                                        embeddings_generated=tracker.stats["embeddings_generated"] + len(qdrant_chunks),
                                        vectors_indexed=tracker.stats["vectors_indexed"] + len(qdrant_chunks)
                                    )

                                    all_failed = False

                                except Exception as qdrant_error:
                                    print(f"[ERROR] Qdrant upsert failed: {str(qdrant_error)}")
                                    document.status = "failed"
                                    document.processing_error = f"Vector indexing failed: {str(qdrant_error)}"
                                    db.commit()
                                    tracker.add_log("error", f"Vector indexing failed for {source_url}: {str(qdrant_error)}")

                        except Exception as e:
                            print(f"[ERROR] Combined document processing failed: {str(e)}")
                            tracker.add_log("error", f"Combined processing failed for {source_url}: {str(e)}")

                    else:
                        print(f"[WARNING] No valid content after combining pages from {source_url}")
                        tracker.add_log("warning", f"No valid content after combining pages: {source_url}")

                else:
                    # PROCESS EACH PAGE INDIVIDUALLY (EXISTING BEHAVIOR)
                    for page_idx, scraped_page in enumerate(scraped_pages):
                        try:
                            # Check for cancellation
                            pipeline_status_json = draft_service.redis_client.get(f"pipeline:{pipeline_id}:status")
                            if pipeline_status_json:
                                pipeline_status = json.loads(pipeline_status_json)
                                if pipeline_status.get("status") == "cancelled":
                                    raise Exception("Pipeline cancelled by user")

                            page_url = scraped_page.get("url") if isinstance(scraped_page, dict) else scraped_page.url
                            page_content = scraped_page.get("content") if isinstance(scraped_page, dict) else scraped_page.content

                            # Skip if no content
                            if not page_content or len(page_content.strip()) < 50:
                                tracker.add_log("warning", f"Skipping page with insufficient content: {page_url}")
                                continue

                            # ========================================
                            # STEP 2c: CREATE DOCUMENT RECORD (BASIC)
                            # ========================================

                            print(f"[DEBUG] Creating Document record for page: {page_url}")
                            # Create basic Document record first (will be updated with chunking decision later)
                            page_metadata = scraped_page.get("metadata") if isinstance(scraped_page, dict) else scraped_page.metadata
                            serialized_metadata = serialize_metadata(page_metadata) if page_metadata else {}

                            # Handle both dict and object formats for scraped_page
                            title = scraped_page.get("title") if isinstance(scraped_page, dict) else scraped_page.title
                            scraped_at = scraped_page.get("scraped_at") if isinstance(scraped_page, dict) else scraped_page.scraped_at

                            document = Document(
                                kb_id=UUID(kb_id),
                                workspace_id=kb.workspace_id,
                                name=title or page_url,
                                source_type="web_scraping",
                                source_url=page_url,
                                content_full=page_content,  # ALWAYS store full content
                                content_preview=page_content[:500] if page_content else None,
                                word_count=len(page_content.split()) if page_content else 0,
                                character_count=len(page_content) if page_content else 0,
                                source_metadata={
                                    "scraped_at": scraped_at.isoformat() if scraped_at else None,
                                    "content_length": len(page_content),
                                    "metadata": serialized_metadata
                                },
                                status="processing",
                                created_by=kb.created_by,
                                created_at=datetime.utcnow()
                            )
                            db.add(document)
                            db.flush()  # Get document.id

                            # ========================================
                            # STEP 2d: SMART PROCESSING (USER CHOICE FIRST)
                            # ========================================

                            # Use smart KB service that respects user preferences
                            # DEBUG: Log chunking config
                            user_chunking_config = config.get("chunking_config")
                            print(f"[DEBUG] Pipeline chunking config: {user_chunking_config}")
                            print(f"[DEBUG] Full config passed to pipeline: {config}")
                            print(f"[DEBUG] About to call smart_kb_service.process_document_with_proper_storage")

                            try:
                                # Process document with proper storage strategy and user choice respect
                                processing_result = loop.run_until_complete(
                                    smart_kb_service.process_document_with_proper_storage(
                                        document=document,
                                        content=page_content,
                                        kb=kb,
                                        user_config=user_chunking_config  # User's explicit preferences
                                    )
                                )
                                print(f"[DEBUG] smart_kb_service call completed successfully")
                                print(f"[DEBUG] processing_result keys: {list(processing_result.keys()) if processing_result else 'None'}")

                                if "error" in processing_result:
                                    print(f"[DEBUG] smart_kb_service returned error: {processing_result['error']}")
                                    tracker.add_log("warning", f"Processing failed for page {page_url}: {processing_result['error']}")
                                    continue

                            except Exception as smart_service_error:
                                print(f"[ERROR] smart_kb_service call failed with exception: {str(smart_service_error)}")
                                print(f"[ERROR] Exception type: {type(smart_service_error).__name__}")
                                print(f"[ERROR] Full traceback:\n{traceback.format_exc()}")

                                # FALLBACK: Use legacy chunking as emergency fallback
                                print(f"[DEBUG] Using LEGACY CHUNKING as fallback for page: {page_url}")
                                tracker.add_log("warning", f"Smart KB service failed, using legacy chunking for {page_url}: {str(smart_service_error)}")

                                # Use chunking_service as fallback
                                fallback_strategy = user_chunking_config.get("strategy", "adaptive") if user_chunking_config else "adaptive"
                                fallback_chunk_size = user_chunking_config.get("chunk_size", 1200) if user_chunking_config else 1200
                                fallback_chunk_overlap = user_chunking_config.get("chunk_overlap", 200) if user_chunking_config else 200

                                print(f"[DEBUG] Fallback config: strategy={fallback_strategy}, size={fallback_chunk_size}, overlap={fallback_chunk_overlap}")

                                # Use legacy chunking service
                                chunks_data = chunking_service.chunk_document(
                                    text=page_content,
                                    strategy=fallback_strategy,
                                    chunk_size=fallback_chunk_size,
                                    chunk_overlap=fallback_chunk_overlap
                                )

                                # Generate embeddings
                                chunk_texts = [chunk["content"] for chunk in chunks_data]
                                embeddings = loop.run_until_complete(
                                    embedding_service.generate_embeddings(chunk_texts)
                                )

                                print(f"[DEBUG] LEGACY FALLBACK: Created {len(chunks_data)} chunks, {len(embeddings)} embeddings")

                                # Create processing_result compatible with main flow
                                processing_result = {
                                    "chunking_decision": type('obj', (object,), {
                                        'strategy': fallback_strategy,
                                        'chunk_size': fallback_chunk_size,
                                        'chunk_overlap': fallback_chunk_overlap,
                                        'user_preference': True,
                                        'reasoning': f"Legacy fallback due to smart_kb_service error: {str(smart_service_error)}"
                                    })(),
                                    "postgres_chunks": [],
                                    "qdrant_chunks": [],
                                    "chunks_created": len(chunks_data),
                                    "embeddings_generated": len(embeddings)
                                }

                                # Build postgres and qdrant chunks manually
                                for idx, (chunk_data, embedding) in enumerate(zip(chunks_data, embeddings)):
                                    import uuid
                                    chunk_id = str(uuid.uuid4())

                                    # PostgreSQL chunk
                                    postgres_chunk_data = {
                                        "id": chunk_id,
                                        "document_id": document.id,
                                        "kb_id": document.kb_id,
                                        "content": chunk_data["content"],
                                        "chunk_index": idx,
                                        "position": idx,
                                        "chunk_metadata": {
                                            "token_count": chunk_data.get("token_count", 0),
                                            "strategy": fallback_strategy,
                                            "chunk_size": fallback_chunk_size,
                                            "user_preference": True,
                                            "fallback_reason": str(smart_service_error),
                                            "workspace_id": str(document.workspace_id),
                                            "created_at": datetime.utcnow().isoformat()
                                        }
                                    }
                                    processing_result["postgres_chunks"].append(postgres_chunk_data)

                                    # Qdrant chunk
                                    from app.services.qdrant_service import QdrantChunk
                                    qdrant_chunk = QdrantChunk(
                                        id=chunk_id,
                                        embedding=embedding,
                                        content=chunk_data["content"],
                                        metadata={
                                            "document_id": str(document.id),
                                            "kb_id": str(document.kb_id),
                                            "workspace_id": str(document.workspace_id),
                                            "chunk_index": idx,
                                            "strategy_used": fallback_strategy,
                                            "fallback_processing": True
                                        }
                                    )
                                    processing_result["qdrant_chunks"].append(qdrant_chunk)

                            # Extract results
                            chunking_decision = processing_result["chunking_decision"]
                            postgres_chunks = processing_result["postgres_chunks"]
                            qdrant_chunks = processing_result["qdrant_chunks"]

                            tracker.add_log("info",
                                f"Processed {page_url}: {len(postgres_chunks)} chunks using {chunking_decision.strategy} strategy. "
                                f"Reasoning: {chunking_decision.reasoning}"
                            )
                            tracker.update_stats(chunks_created=tracker.stats["chunks_created"] + len(postgres_chunks))

                            # ========================================
                            # STEP 2d: SAVE TO POSTGRESQL (NO REDUNDANT EMBEDDINGS)
                            # ========================================

                            # Create PostgreSQL Chunk records (NO EMBEDDING FIELD - avoid redundancy)
                            for postgres_chunk_data in postgres_chunks:
                                chunk = Chunk(
                                    id=UUID(postgres_chunk_data["id"]),  # Use the UUID from smart_kb_service
                                    document_id=postgres_chunk_data["document_id"],
                                    kb_id=postgres_chunk_data["kb_id"],
                                    content=postgres_chunk_data["content"],
                                    chunk_index=postgres_chunk_data["chunk_index"],
                                    position=postgres_chunk_data["position"],
                                    # NO embedding field - stored only in Qdrant
                                    chunk_metadata=postgres_chunk_data["chunk_metadata"]
                                )
                                db.add(chunk)

                            # Update tracking stats
                            tracker.update_stats(
                                embeddings_generated=tracker.stats["embeddings_generated"] + processing_result["embeddings_generated"]
                            )

                            # ========================================
                            # STEP 2e: UPDATE DOCUMENT WITH CHUNKING DECISION
                            # ========================================

                            print(f"[DEBUG] Updating Document record with chunking decision: {page_url}")
                            # Update document with chunking decision metadata
                            current_metadata = document.source_metadata or {}
                            current_metadata["chunking_decision"] = {
                                "strategy": chunking_decision.strategy,
                                "chunk_size": chunking_decision.chunk_size,
                                "user_preference": chunking_decision.user_preference,
                                "reasoning": chunking_decision.reasoning
                            }
                            document.source_metadata = current_metadata
                            document.status = "processed"

                            # Update Qdrant chunks with correct document ID
                            for qdrant_chunk in qdrant_chunks:
                                qdrant_chunk.metadata["document_id"] = str(document.id)
                                qdrant_chunk.metadata["page_url"] = page_url
                                qdrant_chunk.metadata["page_title"] = (scraped_page.get("title") if isinstance(scraped_page, dict) else scraped_page.title) or ""

                            db.commit()
                            print(f"[DEBUG] Database commit successful, created {len(qdrant_chunks)} chunks for page: {page_url}")

                            # ========================================
                            # STEP 2f: INDEX IN QDRANT
                            # ========================================

                            print(f"[DEBUG] About to upsert {len(qdrant_chunks)} chunks to Qdrant for page: {page_url}")

                            try:
                                loop.run_until_complete(
                                    qdrant_service.upsert_chunks(
                                        kb_id=UUID(kb_id),
                                        chunks=qdrant_chunks
                                    )
                                )
                                print(f"[DEBUG] Qdrant upsert successful for {len(qdrant_chunks)} chunks")
                            except Exception as qdrant_error:
                                print(f"[ERROR] Qdrant upsert failed: {str(qdrant_error)}")
                                print(f"[ERROR] Qdrant error type: {type(qdrant_error).__name__}")
                                print(f"[ERROR] Traceback:\n{traceback.format_exc()}")
                                raise  # Re-raise to be caught by outer exception handler

                            tracker.update_stats(
                                vectors_indexed=tracker.stats["vectors_indexed"] + len(qdrant_chunks)
                            )

                            tracker.add_log(
                                "info",
                                f"Processed page: {page_url}",
                                {
                                    "chunks": len(qdrant_chunks),
                                    "embeddings": processing_result.get("embeddings_generated", 0)
                                }
                            )

                            # Mark that we successfully processed at least one page
                            all_failed = False

                        except Exception as page_error:
                            tracker.update_stats(pages_failed=tracker.stats["pages_failed"] + 1)
                            page_url_for_error = scraped_page.get("url") if isinstance(scraped_page, dict) else scraped_page.url
                            tracker.add_log(
                                "error",
                                f"Failed to process page: {page_url_for_error}",
                                {"error": str(page_error)}
                            )
                            # Also print to stdout for debugging
                            print(f"[ERROR] Failed to process page: {page_url_for_error}")
                            print(f"[ERROR] Error: {str(page_error)}")
                            print(f"[ERROR] Error type: {type(page_error).__name__}")
                            print(f"[ERROR] Traceback:\n{traceback.format_exc()}")
                            # Continue with next page
                            continue

            except Exception as source_error:
                tracker.update_stats(pages_failed=tracker.stats["pages_failed"] + 1)
                error_msg = f"Failed to process source: {source_url}"
                error_details = {"error": str(source_error), "traceback": traceback.format_exc()}

                # Log to both tracker and stdout for debugging
                tracker.add_log("error", error_msg, error_details)
                print(f"[ERROR] {error_msg}")
                print(f"[ERROR] Error details: {str(source_error)}")
                print(f"[ERROR] Traceback:\n{traceback.format_exc()}")

                # Continue with next source
                continue

        # ========================================
        # STEP 3: UPDATE KB STATUS
        # ========================================

        duration = (datetime.utcnow() - start_time).total_seconds()

        # Determine final status
        if all_failed:
            # ALL sources failed
            kb.status = "failed"
            kb.error_message = "All sources failed to process"
            tracker.update_status(
                status="failed",
                current_stage="Completed with all failures",
                progress_percentage=100,
                error="All sources failed to process"
            )
            tracker.add_log("error", "Pipeline failed: All sources failed to process")

        elif tracker.stats["pages_failed"] > 0:
            # Some pages failed, but some succeeded
            kb.status = "ready_with_warnings"
            kb.error_message = f"{tracker.stats['pages_failed']} pages failed to process"
            tracker.update_status(
                status="completed",
                current_stage="Completed with warnings",
                progress_percentage=100
            )
            tracker.add_log(
                "warning",
                f"Pipeline completed with warnings: {tracker.stats['pages_failed']} pages failed"
            )

        else:
            # All succeeded
            kb.status = "ready"
            kb.error_message = None
            tracker.update_status(
                status="completed",
                current_stage="Completed successfully",
                progress_percentage=100
            )
            tracker.add_log("info", "Pipeline completed successfully")

        # Update KB metadata
        kb.stats = {
            "total_documents": tracker.stats["pages_scraped"] - tracker.stats["pages_failed"],
            "total_chunks": tracker.stats["chunks_created"],
            "total_vectors": tracker.stats["vectors_indexed"],
            "processing_duration_seconds": int(duration)
        }

        # Also update integer columns for compatibility
        # Note: These are legacy fields but still used by API responses and queries
        kb.total_documents = tracker.stats["pages_scraped"] - tracker.stats["pages_failed"]
        kb.total_chunks = tracker.stats["chunks_created"]

        db.commit()

        # Return result
        return {
            "kb_id": kb_id,
            "status": kb.status,
            "stats": tracker.stats,
            "duration_seconds": int(duration)
        }

    except Exception as e:
        # ========================================
        # ERROR HANDLING
        # ========================================

        error_message = str(e)
        error_traceback = traceback.format_exc()

        tracker.update_status(
            status="failed",
            current_stage="Failed with error",
            progress_percentage=100,
            error=error_message
        )
        tracker.add_log(
            "error",
            f"Pipeline failed with error: {error_message}",
            {"traceback": error_traceback}
        )

        # Update KB status
        kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == UUID(kb_id)).first()
        if kb:
            kb.status = "failed"
            kb.error_message = error_message
            db.commit()

        # Re-raise for Celery
        raise

    finally:
        db.close()
        loop.close()


@shared_task(bind=True, name="reindex_kb")
def reindex_kb_task(self, kb_id: str, new_config: dict = None):
    """
    Re-index an existing KB (refresh embeddings and Qdrant vectors) with optional configuration updates.

    QUEUE: high_priority
    DURATION: Variable (depends on KB size)

    WHY: Keep embeddings fresh for frequently changing websites OR apply new chunking configuration
    HOW: Re-fetch sources, regenerate embeddings with new config, update Qdrant

    Args:
        kb_id: Knowledge base UUID
        new_config: Optional dict containing chunking_config, embedding_config, vector_store_config

    Returns:
        {
            "kb_id": str,
            "status": str,
            "stats": dict,
            "configuration_applied": bool
        }
    """

    db = SessionLocal()
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    try:
        # Get KB
        kb = db.query(KnowledgeBase).filter(
            KnowledgeBase.id == UUID(kb_id)
        ).first()

        if not kb:
            raise ValueError(f"KB not found: {kb_id}")

        # Determine chunking configuration to use
        configuration_applied = bool(new_config)

        if new_config and new_config.get('chunking_config'):
            # Use new chunking configuration
            chunking_config = new_config['chunking_config']
        else:
            # Use existing KB chunking configuration or defaults
            chunking_config = kb.chunking_config or {
                "strategy": "recursive",
                "chunk_size": 1000,
                "chunk_overlap": 200
            }

        # Extract chunking parameters
        strategy = chunking_config.get('strategy', 'recursive')
        chunk_size = chunking_config.get('chunk_size', 1000)
        chunk_overlap = chunking_config.get('chunk_overlap', 200)

        # Update KB status
        kb.status = "reindexing"
        db.commit()

        # Get all documents for this KB
        documents = db.query(Document).filter(
            Document.kb_id == UUID(kb_id)
        ).all()

        # Delete old chunks and vectors
        db.query(Chunk).filter(
            Chunk.kb_id == UUID(kb_id)
        ).delete()
        db.commit()

        # Delete and recreate Qdrant collection
        loop.run_until_complete(
            qdrant_service.delete_kb_collection(UUID(kb_id))
        )
        loop.run_until_complete(
            qdrant_service.create_kb_collection(
                kb_id=UUID(kb_id),
                vector_size=embedding_service.get_embedding_dimension()
            )
        )

        # Re-process each document
        total_chunks = 0
        total_vectors = 0

        for document in documents:
            if not document.content:
                continue

            # Chunk content using determined configuration
            chunks_data = chunking_service.chunk_document(
                text=document.content,
                strategy=strategy,
                chunk_size=chunk_size,
                chunk_overlap=chunk_overlap
            )

            # Generate embeddings
            chunk_texts = [chunk["content"] for chunk in chunks_data]
            embeddings = loop.run_until_complete(
                embedding_service.generate_embeddings(chunk_texts)
            )

            # Create chunks and index in Qdrant
            qdrant_chunks = []

            for chunk_idx, (chunk_data, embedding) in enumerate(zip(chunks_data, embeddings)):
                # Create Chunk in PostgreSQL
                chunk = Chunk(
                    document_id=document.id,
                    kb_id=UUID(kb_id),
                    workspace_id=kb.workspace_id,
                    content=chunk_data["content"],
                    chunk_index=chunk_idx,
                    embedding=embedding,
                    chunk_metadata={
                        "token_count": chunk_data.get("token_count", 0),
                        "strategy": strategy,
                        "chunk_size": chunk_size,
                        "chunk_overlap": chunk_overlap,
                        "reindexed_at": datetime.utcnow().isoformat()
                    },
                    created_at=datetime.utcnow()
                )
                db.add(chunk)
                db.flush()

                # Prepare for Qdrant
                qdrant_chunks.append(
                    QdrantChunk(
                        id=str(chunk.id),
                        embedding=embedding,
                        content=chunk_data["content"],
                        metadata={
                            "document_id": str(document.id),
                            "kb_id": kb_id,
                            "workspace_id": str(kb.workspace_id),
                            "chunk_index": chunk_idx
                        }
                    )
                )

            db.commit()

            # Index in Qdrant
            loop.run_until_complete(
                qdrant_service.upsert_chunks(
                    kb_id=UUID(kb_id),
                    chunks=qdrant_chunks
                )
            )

            total_chunks += len(chunks_data)
            total_vectors += len(qdrant_chunks)

        # Update KB status
        kb.status = "ready"
        kb.updated_at = datetime.utcnow()
        kb.stats = {
            "total_documents": len(documents),
            "total_chunks": total_chunks,
            "total_vectors": total_vectors,
            "reindexed_at": datetime.utcnow().isoformat()
        }

        # Also update integer columns for compatibility
        # Note: These are legacy fields but still used by API responses and queries
        kb.total_documents = len(documents)
        kb.total_chunks = total_chunks

        db.commit()

        return {
            "kb_id": kb_id,
            "status": "completed",
            "configuration_applied": configuration_applied,
            "stats": {
                "documents": len(documents),
                "chunks": total_chunks,
                "vectors": total_vectors,
                "chunking_config": {
                    "strategy": strategy,
                    "chunk_size": chunk_size,
                    "chunk_overlap": chunk_overlap
                }
            }
        }

    except Exception as e:
        # Update KB status
        kb = db.query(KnowledgeBase).filter(
            KnowledgeBase.id == UUID(kb_id)
        ).first()
        if kb:
            kb.status = "failed"
            kb.error_message = f"Re-indexing failed: {str(e)}"
            db.commit()

        raise

    finally:
        db.close()
        loop.close()
