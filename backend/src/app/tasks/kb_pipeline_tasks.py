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
from app.services.embedding_service_local import embedding_service, multi_model_embedding_service
from app.services.qdrant_service import qdrant_service, QdrantChunk
from app.services.chunking_service import chunking_service
from app.services.draft_service import draft_service
from app.models.knowledge_base import KnowledgeBase
from app.models.document import Document
from app.models.chunk import Chunk


def _get_processing_quality_settings(indexing_method: str) -> Dict[str, Any]:
    """
    Map indexing_method to processing quality settings.

    WHY: User controls processing quality vs speed trade-off
    HOW: Different settings for embedding batch size, parsing strategy, etc.

    Args:
        indexing_method: "high_quality", "balanced", or "fast"

    Returns:
        Dict with processing settings
    """

    if indexing_method == "fast":
        return {
            "embedding_batch_size": 64,  # Larger batches for speed
            "parsing_strategy": "fast",   # Quick content extraction
            "content_analysis_depth": "basic",
            "concurrent_limit": 8,       # More concurrent processing
            "quality_level": "fast"
        }
    elif indexing_method == "balanced":
        return {
            "embedding_batch_size": 32,  # Balanced batches
            "parsing_strategy": "auto",   # Automatic strategy selection
            "content_analysis_depth": "moderate",
            "concurrent_limit": 4,       # Moderate concurrency
            "quality_level": "balanced"
        }
    else:  # "high_quality"
        return {
            "embedding_batch_size": 16,  # Smaller batches for accuracy
            "parsing_strategy": "hi_res", # High-resolution parsing
            "content_analysis_depth": "thorough",
            "concurrent_limit": 2,       # Less concurrency for quality
            "quality_level": "high_quality"
        }


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

    SOURCE-TYPE AWARE METRICS:
    - For web sources: "pages_discovered", "pages_scraped"
    - For file uploads: "documents_discovered", "documents_parsed"
    - Frontend uses source_type to display appropriate labels
    """

    def __init__(self, pipeline_id: str, kb_id: str, source_type: str = "web_scraping"):
        self.pipeline_id = pipeline_id
        self.kb_id = kb_id
        self.redis_key = f"pipeline:{pipeline_id}:status"
        self.source_type = source_type  # "web_scraping" | "file_upload" | "mixed"

        # Initialize stats with source-type aware metrics
        # IMPORTANT: Backend uses generic names, frontend interprets based on source_type
        self.stats = {
            "pages_discovered": 0,      # For web: pages found; For files: documents added
            "pages_scraped": 0,         # For web: pages scraped; For files: documents parsed
            "pages_failed": 0,          # For web: pages failed; For files: documents failed
            "chunks_created": 0,
            "embeddings_generated": 0,
            "vectors_indexed": 0,
            # NEW: Source type info for frontend to display appropriate labels
            "source_type": source_type,
            "total_sources": 0,
            "file_sources": 0,
            "web_sources": 0
        }

    def set_source_type(self, source_type: str):
        """Update source type (call after analyzing sources)."""
        self.source_type = source_type
        self.stats["source_type"] = source_type

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

    # ========================================
    # EARLY SOURCE TYPE DETECTION (before tracker initialization)
    # ========================================
    # Count file uploads vs web sources to determine appropriate metric labels
    file_sources_count = sum(1 for s in sources if s.get("type") == "file_upload")
    web_sources_count = sum(1 for s in sources if s.get("type") in ("web_scraping", "approved_content"))

    # Determine overall source type for metrics display
    if file_sources_count > 0 and web_sources_count > 0:
        source_type_for_metrics = "mixed"
    elif file_sources_count > 0:
        source_type_for_metrics = "file_upload"
    else:
        source_type_for_metrics = "web_scraping"

    print(f"📊 [SOURCE TYPES EARLY] {file_sources_count} file uploads, {web_sources_count} web sources → {source_type_for_metrics}")

    # Initialize tracker WITH correct source type from the start
    tracker = PipelineProgressTracker(pipeline_id, kb_id, source_type=source_type_for_metrics)
    tracker.update_stats(
        total_sources=len(sources),
        file_sources=file_sources_count,
        web_sources=web_sources_count
    )

    # Import smart KB service at function level to avoid scoping issues
    from app.services.smart_kb_service import smart_kb_service

    # CRITICAL FIX: Initialize user_chunking_config at function level to avoid UnboundLocalError
    # This ensures the variable is always defined before any usage
    user_chunking_config = config.get("chunking_config", {})

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
        embedding_config = config.get("embedding_config", {}) or kb.embedding_config or {}
        indexing_method = config.get("indexing_method", "high_quality")

        # Extract embedding model (CRITICAL: user-configured model selection)
        embedding_model = embedding_config.get("model") or embedding_config.get("model_name", "all-MiniLM-L6-v2")
        embedding_batch_size = embedding_config.get("batch_size", 32)
        print(f"🔧 [EMBEDDING] Using model: {embedding_model}, batch_size: {embedding_batch_size}")

        # Extract vector_store_config from config or KB record
        vector_store_config = config.get("vector_store_config", {}) or kb.vector_store_config or {}
        # Handle nested "settings" structure from frontend
        if "settings" in vector_store_config:
            settings = vector_store_config.get("settings", {})
            distance_metric = settings.get("distance_metric", "cosine")
            hnsw_m = settings.get("hnsw_m", 16)
            qdrant_batch_size = settings.get("batch_size", 100)
        else:
            # Flat structure (from model-config endpoint)
            distance_metric = vector_store_config.get("distance_metric", "cosine")
            hnsw_m = vector_store_config.get("hnsw_m", 16)
            qdrant_batch_size = vector_store_config.get("batch_size", 100)

        chunk_strategy = chunking_config.get("strategy", "by_heading")
        chunk_size = chunking_config.get("chunk_size", 1000)
        chunk_overlap = chunking_config.get("chunk_overlap", 200)
        custom_separators = chunking_config.get("custom_separators", None)  # For "custom" strategy
        enable_enhanced_metadata = chunking_config.get("enable_enhanced_metadata", False)  # Rich metadata option
        preserve_code_blocks = chunking_config.get("preserve_code_blocks", True)  # Keep code blocks intact (default: True)

        # Map indexing_method to processing quality settings
        processing_quality = _get_processing_quality_settings(indexing_method)

        # NOTE: Source type detection moved to early initialization (before tracker creation)
        # This ensures correct source_type is set from the very first update_status() call

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
            # Map distance_metric to Qdrant format (cosine -> Cosine, euclidean -> Euclid, dot -> Dot)
            qdrant_distance_map = {
                "cosine": "Cosine",
                "euclidean": "Euclid",
                "dot": "Dot",
                "dot_product": "Dot"
            }
            qdrant_distance = qdrant_distance_map.get(distance_metric.lower(), "Cosine")

            # Get vector dimension for the configured embedding model
            vector_dimension = multi_model_embedding_service.get_embedding_dimension(embedding_model)

            loop.run_until_complete(
                qdrant_service.create_kb_collection(
                    kb_id=UUID(kb_id),
                    vector_size=vector_dimension,
                    distance_metric=qdrant_distance,
                    hnsw_m=int(hnsw_m)
                )
            )
            tracker.add_log("info", f"Qdrant collection created (model: {embedding_model}, dim: {vector_dimension}, distance: {qdrant_distance}, hnsw_m: {hnsw_m})")
        except Exception as e:
            tracker.add_log("warning", f"Qdrant collection creation warning: {str(e)}")
            # Collection might already exist, continue

        # ========================================
        # STEP 2: PROCESS SOURCES (STRATEGY-DEPENDENT)
        # ========================================

        total_sources = len(sources)
        tracker.update_stats(pages_discovered=total_sources)

        all_failed = True  # Track if ALL sources fail

        # CRITICAL FIX: For no_chunking strategy, process ALL sources together into ONE document
        should_combine_all_sources = chunk_strategy in ("no_chunking", "full_content")

        if should_combine_all_sources:

            # Collect ALL pages from ALL sources
            all_scraped_pages = []
            combined_source_metadata = {
                "total_sources": len(sources),
                "source_urls": [],
                "source_names": [],
                "processing_strategy": "all_sources_combined"
            }

            # Process each source to collect pages
            for source_idx, source in enumerate(sources):
                source_url = source.get("url")
                source_config = source.get("config", {})

                tracker.update_status(
                    status="running",
                    current_stage=f"Collecting from source {source_idx + 1}/{total_sources}: {source_url}",
                    progress_percentage=10 + int((source_idx / total_sources) * 40)
                )

                try:
                    # Use the same source processing logic
                    scraped_pages = None

                    # Check for approved content first (same logic as individual processing)
                    # FIXED: Query for documents that belong to this source (handle both base URL and individual page URLs)
                    doc_with_approved = db.query(Document).filter(
                        Document.kb_id == UUID(kb_id),
                        Document.status == "pending"
                    ).filter(
                        # Match either exact URL or documents that contain source_url as base
                        (Document.source_url == source_url) |
                        (Document.source_url.like(f"{source_url}%"))
                    ).first()

                    if doc_with_approved and doc_with_approved.source_metadata:
                        approved_sources_in_doc = doc_with_approved.source_metadata.get("approved_sources", [])
                        if approved_sources_in_doc:
                            scraped_pages = []
                            for approved_page in approved_sources_in_doc:
                                content = approved_page.get("content", "")
                                if content.strip():
                                    scraped_page = {
                                        "url": approved_page.get("url", source_url),
                                        "title": approved_page.get("title", ""),
                                        "content": content,
                                        "markdown": content,
                                        "is_edited": approved_page.get("is_edited", False),
                                        "source": "user_approved",
                                        "source_name": source.get("name", f"Source {source_idx + 1}"),
                                        "metadata": approved_page.get("metadata", {})
                                    }
                                    scraped_pages.append(scraped_page)

                    # CRITICAL: Check for FILE UPLOAD source type (combined processing)
                    if not scraped_pages and source.get("type") == "file_upload":
                        # File was already parsed by Tika in draft phase
                        filename = source.get("filename", "Uploaded File")
                        parsed_content = source.get("parsed_content", "")
                        file_metadata = source.get("file_metadata", {})

                        print(f"📄 [ALL_SOURCES FILE] Processing file: {filename}")

                        if parsed_content.strip():
                            scraped_page = {
                                "url": f"file:///{filename}",
                                "title": file_metadata.get("title", filename),
                                "content": parsed_content,
                                "markdown": parsed_content,
                                "is_edited": False,
                                "source": "file_upload",
                                "source_name": filename,
                                "metadata": {
                                    "filename": filename,
                                    "file_size": source.get("file_size"),
                                    "mime_type": source.get("mime_type"),
                                    "page_count": source.get("page_count"),
                                    **file_metadata
                                }
                            }
                            scraped_pages = [scraped_page]
                            print(f"✅ [ALL_SOURCES FILE] Added {len(parsed_content)} chars from {filename}")

                    # Check approved_content sources
                    elif not scraped_pages and source.get("type") == "approved_content" and source.get("status") == "approved":
                        approved_pages = source.get("approved_pages", [])
                        scraped_pages = []
                        for page in approved_pages:
                            content = page.get("content", "")
                            scraped_page = {
                                "url": page.get("url", source_url),
                                "title": page.get("title", ""),
                                "content": content,
                                "markdown": content,
                                "is_edited": page.get("is_edited", False),
                                "source": "approved_content",
                                "source_name": source.get("name", f"Source {source_idx + 1}"),
                                "metadata": page.get("metadata", {})
                            }
                            scraped_pages.append(scraped_page)

                    # Fallback to preview_data
                    elif not scraped_pages and preview_data and preview_data.get("pages"):
                        preview_pages = preview_data.get("pages", [])
                        scraped_pages = []
                        for page in preview_pages:
                            content = page.get("edited_content") or page.get("content", "")
                            scraped_page = {
                                "url": page.get("url", source_url),
                                "title": page.get("title", ""),
                                "content": content,
                                "markdown": content,
                                "is_edited": page.get("is_edited", False),
                                "source": "preview_data",
                                "source_name": source.get("name", f"Source {source_idx + 1}"),
                                "metadata": page.get("metadata", {})
                            }
                            scraped_pages.append(scraped_page)

                    # Last resort: scrape if no preview data
                    if not scraped_pages:
                        # Build crawl config and scrape
                        crawl_config = CrawlConfig(
                            max_pages=source_config.get("max_pages", 50),
                            max_depth=source_config.get("max_depth", 3),
                            include_patterns=source_config.get("include_patterns", []),
                            exclude_patterns=source_config.get("exclude_patterns", []),
                            stealth_mode=source_config.get("stealth_mode", True)
                        )
                        method = source_config.get("method", "single")

                        if method == "crawl":
                            scraped_pages = loop.run_until_complete(
                                crawl4ai_service.crawl_website(start_url=source_url, config=crawl_config)
                            )
                        else:
                            scraped_page = loop.run_until_complete(
                                crawl4ai_service.scrape_single_url(url=source_url, config=crawl_config)
                            )
                            scraped_pages = [scraped_page]

                        # Add source metadata to scraped pages
                        for page in scraped_pages:
                            if isinstance(page, dict):
                                page["source_name"] = source.get("name", f"Source {source_idx + 1}")
                            else:
                                page.source_name = source.get("name", f"Source {source_idx + 1}")

                    # Add pages to combined collection
                    if scraped_pages:
                        all_scraped_pages.extend(scraped_pages)
                        combined_source_metadata["source_urls"].append(source_url)
                        combined_source_metadata["source_names"].append(source.get("name", f"Source {source_idx + 1}"))
                        print(f"✅ [ALL_SOURCES] Collected {len(scraped_pages)} pages from {source.get('name', source_url)}")
                    else:
                        print(f"⚠️ [ALL_SOURCES] No pages collected from {source_url}")

                except Exception as source_error:
                    print(f"❌ [ALL_SOURCES] Failed to collect from {source_url}: {str(source_error)}")
                    tracker.add_log("error", f"Failed to collect from {source_url}: {str(source_error)}")
                    continue

            # Now process ALL collected pages as a single combined document
            if all_scraped_pages:
                print(f"🎯 [ALL_SOURCES] Processing {len(all_scraped_pages)} total pages from {len(sources)} sources as ONE document")

                # Look for or create the single combined document
                combined_doc = db.query(Document).filter(
                    Document.kb_id == UUID(kb_id),
                    Document.source_type == "web_scraping_combined",
                    Document.status == "pending"
                ).first()

                if not combined_doc:
                    print(f"❌ [ALL_SOURCES] No combined document placeholder found - this should not happen!")
                    tracker.add_log("error", "No combined document placeholder found for all sources")
                    # Continue to individual processing fallback
                else:
                    # Combine all content
                    combined_content = []
                    combined_metadata = {**combined_source_metadata}
                    combined_metadata["total_pages"] = len(all_scraped_pages)
                    combined_metadata["pages"] = []

                    for page_idx, page in enumerate(all_scraped_pages):
                        page_url = page.get("url") if isinstance(page, dict) else page.url
                        page_content = page.get("content") if isinstance(page, dict) else page.content
                        page_title = page.get("title") if isinstance(page, dict) else page.title
                        source_name = page.get("source_name", f"Source {page_idx + 1}")

                        # CRITICAL FIX: Process ALL approved content, even if short
                        # User explicitly approved this content, so we MUST process it
                        if page_content and page_content.strip():
                            # Add source and page separator
                            page_separator = f"\n\n=== {source_name} - PAGE {page_idx + 1}: {page_title or page_url} ===\n\n"
                            combined_content.append(page_separator + page_content.strip())

                            # Track page metadata
                            combined_metadata["pages"].append({
                                "page_number": page_idx + 1,
                                "url": page_url,
                                "title": page_title or "",
                                "source_name": source_name,
                                "content_length": len(page_content.strip())
                            })

                    final_combined_content = "\n\n".join(combined_content)

                    if final_combined_content.strip():
                        # OPTION A: Check if ALL sources are file uploads for metadata-only storage
                        all_file_uploads = all(s.get("type") == "file_upload" for s in sources)

                        # Update the combined document
                        combined_doc.name = f"Combined Knowledge Base ({len(sources)} sources, {len(all_scraped_pages)} pages)"

                        # OPTION A: Skip content_full for file uploads (Qdrant-only storage)
                        if all_file_uploads:
                            print(f"📁 [FILE_UPLOAD] All sources are file uploads - using metadata-only PostgreSQL storage")
                            combined_doc.content_full = None  # Skip content storage for file uploads
                            combined_doc.content_preview = None  # Skip preview storage for file uploads
                            combined_doc.source_type = "file_upload"  # Update source type
                        else:
                            combined_doc.content_full = final_combined_content  # Store content for web scraping
                            combined_doc.content_preview = final_combined_content[:500] if len(final_combined_content) > 500 else final_combined_content
                        combined_doc.word_count = len(final_combined_content.split())
                        combined_doc.character_count = len(final_combined_content)
                        combined_doc.page_count = len(all_scraped_pages)
                        combined_doc.status = "processing"
                        combined_doc.source_metadata = serialize_metadata(combined_metadata)

                        db.flush()

                        # Process the combined document
                        tracker.update_status(
                            status="running",
                            current_stage="Processing combined document",
                            progress_percentage=60
                        )

                        print(f"🔧 [ALL_SOURCES] Processing combined document with {len(final_combined_content)} characters")

                        user_chunking_config = config.get("chunking_config", {})
                        processing_result = loop.run_until_complete(
                            smart_kb_service.process_document_with_proper_storage(
                                document=combined_doc,
                                content=final_combined_content,
                                kb=kb,
                                user_config=user_chunking_config,
                                skip_postgres_chunks=all_file_uploads  # OPTION A: Skip PostgreSQL chunks for file uploads
                            )
                        )

                        if "error" in processing_result:
                            print(f"❌ [ALL_SOURCES] Processing failed: {processing_result['error']}")
                            combined_doc.status = "failed"
                            combined_doc.processing_error = processing_result["error"]
                            tracker.add_log("error", f"Combined processing failed: {processing_result['error']}")
                        else:
                            postgres_chunks = processing_result.get("postgres_chunks", [])
                            qdrant_chunks = processing_result.get("qdrant_chunks", [])
                            # CRITICAL FIX: Extract chunking_decision from processing_result
                            chunking_decision = processing_result.get("chunking_decision")

                            # OPTION A: Log different storage strategies
                            if all_file_uploads:
                                print(f"📁 [FILE_UPLOAD] Qdrant-only storage: 0 postgres chunks, {len(qdrant_chunks)} qdrant chunks")
                            else:
                                print(f"📊 [ALL_SOURCES] Created {len(postgres_chunks)} postgres chunks, {len(qdrant_chunks)} qdrant chunks")

                            # Save postgres chunks (only for web scraping, skipped for file uploads)
                            if postgres_chunks:
                                for postgres_chunk_data in postgres_chunks:
                                    chunk = Chunk(
                                        id=UUID(postgres_chunk_data["id"]),
                                        document_id=postgres_chunk_data["document_id"],
                                        kb_id=postgres_chunk_data["kb_id"],
                                        content=postgres_chunk_data["content"],
                                        chunk_index=postgres_chunk_data["chunk_index"],
                                        position=postgres_chunk_data["position"],
                                        page_number=postgres_chunk_data.get("page_number"),
                                        word_count=postgres_chunk_data.get("word_count", 0),
                                        character_count=postgres_chunk_data.get("character_count", 0),
                                        chunk_metadata=postgres_chunk_data["chunk_metadata"]
                                    )
                                    db.add(chunk)
                                db.flush()
                                print(f"✅ [ALL_SOURCES] Added {len(postgres_chunks)} chunks to database session")
                            else:
                                print(f"📁 [FILE_UPLOAD] Skipped PostgreSQL chunks (metadata-only storage)")

                            # Calculate document statistics - use qdrant_chunks for file uploads, postgres for web
                            if all_file_uploads and qdrant_chunks:
                                # File uploads: get stats from Qdrant chunk metadata
                                total_doc_word_count = sum(
                                    chunk.metadata.get("word_count", 0) for chunk in qdrant_chunks
                                )
                                total_doc_char_count = sum(
                                    chunk.metadata.get("character_count", 0) for chunk in qdrant_chunks
                                )
                                chunk_count = len(qdrant_chunks)
                            else:
                                # Web scraping: get stats from postgres chunks
                                total_doc_word_count = sum(chunk_data.get("word_count", 0) for chunk_data in postgres_chunks)
                                total_doc_char_count = sum(chunk_data.get("character_count", 0) for chunk_data in postgres_chunks)
                                chunk_count = len(postgres_chunks)

                            # Update document status and statistics
                            combined_doc.status = "processed"
                            combined_doc.chunk_count = chunk_count
                            combined_doc.word_count = total_doc_word_count
                            combined_doc.character_count = total_doc_char_count

                            # ========================================
                            # CRITICAL: Update processing_metadata with storage info
                            # This allows frontend to know where chunks are stored
                            # ========================================
                            storage_strategy = processing_result.get("storage_strategy", "dual_storage")
                            skip_postgres = processing_result.get("skip_postgres_chunks", False) or all_file_uploads

                            combined_doc.processing_metadata = {
                                "processed_at": datetime.utcnow().isoformat(),
                                "chunks_created": chunk_count,
                                "embeddings_generated": len(qdrant_chunks),
                                # CRITICAL: Storage location info for frontend
                                "storage_strategy": storage_strategy,
                                "chunk_storage_location": "qdrant_only" if skip_postgres else "postgresql_and_qdrant",
                                "postgres_chunks_created": 0 if skip_postgres else chunk_count,
                                "qdrant_chunks_created": chunk_count,
                                # Enhanced metadata flags
                                "enhanced_metadata_enabled": enable_enhanced_metadata,
                                # Chunking decision summary
                                "chunking_strategy": chunking_decision.strategy if chunking_decision else "no_chunking",
                                "chunk_size": chunking_decision.chunk_size if chunking_decision else 0,
                                "chunk_overlap": chunking_decision.chunk_overlap if chunking_decision else 0,
                                # Combined document info
                                "is_combined_document": True,
                                "sources_count": len(sources),
                                "pages_count": len(all_scraped_pages),
                            }

                            # Update Qdrant chunks with metadata
                            for qdrant_chunk in qdrant_chunks:
                                qdrant_chunk.metadata["document_id"] = str(combined_doc.id)
                                qdrant_chunk.metadata["page_url"] = "combined_sources"
                                qdrant_chunk.metadata["page_title"] = f"Combined {len(all_scraped_pages)} pages from {len(sources)} sources"

                            # CRITICAL FIX: Save document ID before any session operations
                            combined_doc_id = combined_doc.id

                            # Commit everything
                            db.commit()
                            print(f"✅ [ALL_SOURCES] Database commit successful for combined document")

                            # VERIFICATION: Verify chunks were committed (skip for file uploads)
                            if postgres_chunks:
                                verification_chunks = db.query(Chunk).filter(
                                    Chunk.document_id == combined_doc_id
                                ).count()
                                print(f"🔍 [VERIFICATION] {verification_chunks} chunks confirmed in PostgreSQL after commit")

                                if verification_chunks != len(postgres_chunks):
                                    print(f"❌ [VERIFICATION] CRITICAL: Expected {len(postgres_chunks)} chunks, found {verification_chunks}")
                            else:
                                print(f"📁 [FILE_UPLOAD] PostgreSQL chunk verification skipped (Qdrant-only storage)")

                            # Index in Qdrant
                            try:
                                loop.run_until_complete(
                                    qdrant_service.upsert_chunks(
                                        kb_id=UUID(kb_id),
                                        chunks=qdrant_chunks
                                    )
                                )
                                print(f"✅ [ALL_SOURCES] Qdrant indexing successful")

                                # Update stats (use chunk_count for consistency)
                                tracker.update_stats(
                                    pages_scraped=len(all_scraped_pages),
                                    chunks_created=chunk_count,
                                    embeddings_generated=len(qdrant_chunks),
                                    vectors_indexed=len(qdrant_chunks)
                                )

                                all_failed = False

                            except Exception as qdrant_error:
                                print(f"❌ [ALL_SOURCES] Qdrant indexing failed: {str(qdrant_error)}")
                                combined_doc.status = "failed"
                                combined_doc.processing_error = f"Vector indexing failed: {str(qdrant_error)}"
                                db.commit()
                                tracker.add_log("error", f"Vector indexing failed: {str(qdrant_error)}")

                tracker.update_status(
                    status="running",
                    current_stage="Completed combined processing",
                    progress_percentage=95
                )

        else:
            # EXISTING INDIVIDUAL SOURCE PROCESSING
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

                    # CRITICAL FIX: First check if a document exists with approved_sources for this source
                    scraped_pages = None
                    found_approved_content = False

                    # FIXED: Query for documents that belong to this source (handle both base URL and individual page URLs)
                    print(f"🔍 [INDIVIDUAL QUERY DEBUG] Looking for approved documents for source: {source_url}")
                    doc_with_approved = db.query(Document).filter(
                        Document.kb_id == UUID(kb_id),
                        Document.status == "pending"
                    ).filter(
                        # Match either exact URL or documents that contain source_url as base
                        (Document.source_url == source_url) |
                        (Document.source_url.like(f"{source_url}%"))
                    ).first()

                    if doc_with_approved and doc_with_approved.source_metadata:
                        approved_sources_in_doc = doc_with_approved.source_metadata.get("approved_sources", [])
                        if approved_sources_in_doc:
                            scraped_pages = []
                            found_approved_content = True

                            for approved_page in approved_sources_in_doc:
                                # Use approved/edited content EXACTLY as user approved
                                content = approved_page.get("content", "")

                                if content.strip():
                                    # Ensure source identification metadata is preserved
                                    page_metadata = approved_page.get("metadata", {}).copy()

                                    # Add source identification if not already present
                                    if "source_id" not in page_metadata:
                                        # Extract from current source context
                                        page_metadata["source_id"] = source.get("id")
                                    if "page_index" not in page_metadata and "index" not in page_metadata:
                                        # Try to determine page index from URL or position
                                        page_url = approved_page.get("url", source_url)
                                        for idx, other_page in enumerate(approved_sources_in_doc):
                                            if other_page.get("url") == page_url:
                                                page_metadata["page_index"] = idx
                                                break

                                    # OPTION A: Preserve original source type for file uploads
                                    # This allows downstream processing to detect file uploads and apply metadata-only storage
                                    original_source = approved_page.get("source", "user_approved")

                                    scraped_page = {
                                        "url": approved_page.get("url", source_url),
                                        "title": approved_page.get("title", ""),
                                        "content": content,
                                        "markdown": content,
                                        "is_edited": approved_page.get("is_edited", False),
                                        "source": original_source,  # Preserve file_upload source type for Option A
                                        "metadata": page_metadata
                                    }
                                    scraped_pages.append(scraped_page)

                            tracker.add_log("info", f"Using {len(scraped_pages)} APPROVED pages from document for {source_url}")

                    # CRITICAL: Check for FILE UPLOAD source type
                    if scraped_pages is None and source.get("type") == "file_upload":
                        # File was already parsed by Tika in draft phase
                        # Content is stored in source["parsed_content"]

                        filename = source.get("filename", "Uploaded File")
                        parsed_content = source.get("parsed_content", "")
                        file_metadata = source.get("file_metadata", {})

                        if not parsed_content.strip():
                            raise ValueError(f"File {filename} has no extractable content")

                        # Create scraped_pages format (single "page" = entire file)
                        scraped_pages = [{
                            "url": f"file:///{filename}",  # Pseudo-URL for file
                            "title": file_metadata.get("title", filename),
                            "content": parsed_content,
                            "markdown": parsed_content,
                            "is_edited": False,
                            "source": "file_upload",
                            "metadata": {
                                "filename": filename,
                                "file_size": source.get("file_size"),
                                "mime_type": source.get("mime_type"),
                                "page_count": source.get("page_count"),
                                "char_count": source.get("char_count"),
                                "word_count": source.get("word_count"),
                                "parsed_at": source.get("parsed_at"),
                                **file_metadata  # Include Tika metadata
                            }
                        }]

                        found_approved_content = True  # Skip web scraping
                        tracker.add_log("info", f"Processing file upload: {filename} ({len(parsed_content)} chars)")
                        print(f"✅ [FILE UPLOAD] File ready for chunking and embedding")

                    # Check if this is an approved source with content (Phase 1C architecture)
                    elif scraped_pages is None and source.get("type") == "approved_content" and source.get("status") == "approved":
                        # Use approved content from sources (Phase 1C)
                        approved_pages = source.get("approved_pages", [])
                        scraped_pages = []
                        found_approved_content = True

                        for page_idx, page in enumerate(approved_pages):
                            # Use final approved content (edited or original)
                            content = page.get("content", "")

                            # Ensure source identification metadata is preserved
                            page_metadata = page.get("metadata", {}).copy()

                            # Add source identification for reliable document matching
                            page_metadata["source_id"] = source.get("id")
                            page_metadata["page_index"] = page_idx  # Use enumeration index

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
                                "metadata": page_metadata
                            }
                            scraped_pages.append(scraped_page)

                        tracker.add_log("info", f"Using {len(scraped_pages)} approved pages from source: {source.get('name')}")

                    elif not found_approved_content and scraped_pages is None and preview_data and preview_data.get("pages"):
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

                    if not found_approved_content and not scraped_pages:
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
                        tracker.add_log("info", f"Starting scrape: {source_url} (method={method})")

                        if method == "crawl":
                            scraped_pages = loop.run_until_complete(
                                crawl4ai_service.crawl_website(
                                    start_url=source_url,
                                    config=crawl_config
                                )
                            )
                        else:
                            # Single page scrape
                            scraped_page = loop.run_until_complete(
                                crawl4ai_service.scrape_single_url(
                                    url=source_url,
                                    config=crawl_config
                                )
                            )
                            scraped_pages = [scraped_page]

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

                            # CRITICAL FIX: Process ALL scraped content, even if short
                            # Scraped content should be processed without artificial limits
                            if page_content and page_content.strip():
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

                        # CRITICAL FIX: Check for approved sources early for fallback handling
                        approved_sources_from_doc = []
                        if not final_combined_content.strip():
                            # Look for placeholder document to check for approved sources
                            placeholder_check = db.query(Document).filter(
                                Document.kb_id == UUID(kb_id),
                                Document.source_type == "web_scraping_combined",
                                Document.status == "pending"
                            ).first()
                            if placeholder_check and placeholder_check.source_metadata:
                                approved_sources_from_doc = placeholder_check.source_metadata.get("approved_sources", [])

                        # Handle empty content case for approved sources
                        # If content is empty but we have approved sources, create minimal content to avoid no chunks
                        if not final_combined_content.strip() and approved_sources_from_doc:
                            print(f"⚠️ [NO_CHUNKING] All approved content was empty or filtered. Creating minimal content.")
                            # Create minimal content from approved sources metadata
                            minimal_content = []
                            for idx, source in enumerate(approved_sources_from_doc):
                                title = source.get("title", f"Page {idx+1}")
                                url = source.get("url", "")
                                minimal_content.append(f"Page {idx+1}: {title}\nURL: {url}\n[Content was empty or too short]")
                            final_combined_content = "\n\n".join(minimal_content)
                            print(f"✅ [NO_CHUNKING] Created minimal content: {len(final_combined_content)} chars")

                        if final_combined_content.strip():
                            print(f"✅ [NO_CHUNKING] Processing combined content: {len(final_combined_content)} chars")
                            try:
                                # CRITICAL FIX: Look specifically for the placeholder document created by finalization
                                all_docs = db.query(Document).filter(Document.kb_id == UUID(kb_id)).all()
                                print(f"🔍 [NO_CHUNKING] Found {len(all_docs)} existing documents for KB {kb_id}")
                                for idx, doc in enumerate(all_docs):
                                    print(f"  Doc {idx}: id={doc.id}, name={doc.name}, source_type={doc.source_type}, status={doc.status}")

                                # Look for the placeholder document first (from finalization)
                                placeholder_doc = None
                                for doc in all_docs:
                                    if doc.source_type == "web_scraping_combined" and doc.status == "pending":
                                        placeholder_doc = doc
                                        print(f"✅ [NO_CHUNKING] Found placeholder document: {doc.id}")
                                        break

                                if placeholder_doc:
                                    # Use the placeholder document
                                    document = placeholder_doc
                                    print(f"✅ [NO_CHUNKING] Reusing placeholder document: {document.id}")

                                    # CRITICAL FIX: Check for approved_sources in placeholder document metadata
                                    existing_metadata = placeholder_doc.source_metadata or {}
                                    approved_sources_from_doc = existing_metadata.get("approved_sources", [])

                                    if approved_sources_from_doc:
                                        print(f"🎯 [NO_CHUNKING] Found {len(approved_sources_from_doc)} APPROVED pages in document metadata!")

                                        # OVERRIDE scraped_pages with approved content
                                        combined_content = []
                                        combined_metadata["content_source"] = "user_approved"

                                        for page_idx, approved_page in enumerate(approved_sources_from_doc):
                                            # Use the approved/edited content EXACTLY as user approved
                                            page_content = approved_page.get("content", "")
                                            page_url = approved_page.get("url", source_url)
                                            page_title = approved_page.get("title", f"Page {page_idx + 1}")

                                            # CRITICAL FIX: Process ALL approved content, even if short
                                            # User explicitly approved this content, so we MUST process it
                                            if page_content and page_content.strip():
                                                # Rebuild combined content with approved data
                                                page_separator = f"\n\n=== PAGE {page_idx + 1}: {page_title or page_url} ===\n\n"
                                                combined_content.append(page_separator + page_content.strip())

                                                # Update metadata
                                                combined_metadata["pages"].append({
                                                    "page_number": page_idx + 1,
                                                    "url": page_url,
                                                    "title": page_title,
                                                    "content_length": len(page_content.strip()),
                                                    "is_edited": approved_page.get("is_edited", False),
                                                    "source": "user_approved"
                                                })

                                        # Replace final_combined_content with approved content
                                        final_combined_content = "\n\n".join(combined_content)
                                        print(f"✅ [NO_CHUNKING] Using APPROVED content: {len(final_combined_content)} chars from {len(approved_sources_from_doc)} pages")
                                    else:
                                        print(f"⚠️ [NO_CHUNKING] No approved_sources found, using scraped content")

                                    # OPTION A: Check if this source is a file upload
                                    is_file_upload_source = source.get("type") == "file_upload"

                                    # Update the document with combined content and metadata (preserve approved_sources)
                                    document.name = f"{source.get('name', 'Web Source')} (Combined {len(scraped_pages)} pages)"
                                    # Merge metadata to preserve approved_sources
                                    merged_metadata = {**existing_metadata, **serialize_metadata(combined_metadata)}
                                    document.source_metadata = merged_metadata
                                    document.status = "processing"

                                    # OPTION A: Skip content_full for file uploads (Qdrant-only storage)
                                    if is_file_upload_source:
                                        print(f"📁 [NO_CHUNKING FILE_UPLOAD] Using metadata-only PostgreSQL storage")
                                        document.content_full = None
                                        document.content_preview = None  # Skip preview storage for file uploads
                                        document.source_type = "file_upload"
                                    else:
                                        document.content_full = final_combined_content
                                        document.content_preview = final_combined_content[:500] if len(final_combined_content) > 500 else final_combined_content

                                    # Update statistics
                                    document.word_count = len(final_combined_content.split())
                                    document.character_count = len(final_combined_content)
                                    document.page_count = len(scraped_pages)

                                    print(f"✅ [NO_CHUNKING] Updated placeholder with content: {document.word_count} words, {len(scraped_pages)} pages")
                                else:
                                    print(f"❌ [NO_CHUNKING] No placeholder found - this should not happen!")
                                    print(f"❌ [NO_CHUNKING] Will NOT create new document to prevent duplication")

                                    # CRITICAL: Do not create duplicate document - skip processing
                                    tracker.add_log("error", f"No placeholder document found for KB {kb_id} - skipping processing to prevent duplication")
                                    continue  # Skip this source

                                db.flush()

                                # CRITICAL FIX: Use correct chunking config for no_chunking strategy
                                user_chunking_config = config.get("chunking_config", {})
                                print(f"🔧 [NO_CHUNKING] About to call smart_kb_service.process_document_with_proper_storage")
                                print(f"🔧 [NO_CHUNKING] Document: {document.id}")
                                print(f"🔧 [NO_CHUNKING] Content length: {len(final_combined_content)}")
                                print(f"🔧 [NO_CHUNKING] User chunking config: {user_chunking_config}")
                                print(f"🔧 [NO_CHUNKING] Strategy: {user_chunking_config.get('strategy', 'unknown')}")

                                processing_result = loop.run_until_complete(
                                    smart_kb_service.process_document_with_proper_storage(
                                        document=document,
                                        content=final_combined_content,
                                        kb=kb,
                                        user_config=user_chunking_config,
                                        skip_postgres_chunks=is_file_upload_source  # OPTION A: Skip PostgreSQL chunks for file uploads
                                    )
                                )

                                print(f"✅ [NO_CHUNKING] smart_kb_service call completed successfully")
                                print(f"🔍 [NO_CHUNKING] processing_result keys: {list(processing_result.keys())}")

                                if "error" in processing_result:
                                    print(f"❌ [NO_CHUNKING] Processing failed: {processing_result['error']}")
                                    document.status = "failed"
                                    document.processing_error = processing_result["error"]
                                    tracker.add_log("error", f"Smart KB service failed: {processing_result['error']}")
                                else:
                                    postgres_chunks = processing_result.get("postgres_chunks", [])
                                    qdrant_chunks = processing_result.get("qdrant_chunks", [])

                                    # OPTION A: Log different storage strategies
                                    if is_file_upload_source:
                                        print(f"📁 [NO_CHUNKING FILE_UPLOAD] Qdrant-only storage: 0 postgres chunks, {len(qdrant_chunks)} qdrant chunks")
                                    else:
                                        print(f"📊 [NO_CHUNKING] Postgres chunks created: {len(postgres_chunks)}")
                                        print(f"📊 [NO_CHUNKING] Qdrant chunks created: {len(qdrant_chunks)}")

                                        if len(postgres_chunks) == 0:
                                            print(f"❌ [NO_CHUNKING] CRITICAL: No postgres chunks created despite success!")
                                            print(f"❌ [NO_CHUNKING] chunking_decision: {processing_result.get('chunking_decision')}")
                                            print(f"❌ [NO_CHUNKING] chunks_created: {processing_result.get('chunks_created', 0)}")
                                            print(f"❌ [NO_CHUNKING] embeddings_generated: {processing_result.get('embeddings_generated', 0)}")

                                    # Save postgres chunks (only for web scraping, skipped for file uploads)
                                    if postgres_chunks:
                                        for postgres_chunk_data in postgres_chunks:
                                            chunk = Chunk(
                                                id=UUID(postgres_chunk_data["id"]),
                                                document_id=postgres_chunk_data["document_id"],
                                                kb_id=postgres_chunk_data["kb_id"],
                                                content=postgres_chunk_data["content"],
                                                chunk_index=postgres_chunk_data["chunk_index"],
                                                position=postgres_chunk_data["position"],
                                                page_number=postgres_chunk_data.get("page_number"),
                                                word_count=postgres_chunk_data.get("word_count", 0),
                                                character_count=postgres_chunk_data.get("character_count", 0),
                                                chunk_metadata=postgres_chunk_data["chunk_metadata"]
                                            )
                                            db.add(chunk)
                                        print(f"✅ [NO_CHUNKING] Added {len(postgres_chunks)} chunks to database session")
                                    else:
                                        print(f"📁 [NO_CHUNKING FILE_UPLOAD] Skipped PostgreSQL chunks (metadata-only storage)")

                                    # Calculate document statistics - use qdrant_chunks for file uploads, postgres for web
                                    if is_file_upload_source and qdrant_chunks:
                                        # File uploads: get stats from Qdrant chunk metadata
                                        total_word_count = sum(
                                            chunk.metadata.get("word_count", 0) for chunk in qdrant_chunks
                                        )
                                        total_char_count = sum(
                                            chunk.metadata.get("character_count", 0) for chunk in qdrant_chunks
                                        )
                                        chunk_count = len(qdrant_chunks)
                                    else:
                                        # Web scraping: get stats from postgres chunks
                                        total_word_count = sum(chunk_data.get("word_count", 0) for chunk_data in postgres_chunks)
                                        total_char_count = sum(chunk_data.get("character_count", 0) for chunk_data in postgres_chunks)
                                        chunk_count = len(postgres_chunks)

                                    # CRITICAL FIX: Update document metadata while preserving approved_sources
                                    current_metadata = document.source_metadata or {}
                                    # Preserve approved_sources that were set during finalization
                                    approved_sources = current_metadata.get("approved_sources", [])
                                    current_metadata.update({
                                        "chunking_decision": processing_result.get("chunking_decision").__dict__ if hasattr(processing_result.get("chunking_decision"), '__dict__') else str(processing_result.get("chunking_decision")),
                                        "chunks_created": chunk_count,
                                        "processing_completed_at": datetime.utcnow().isoformat()
                                    })
                                    # Ensure approved_sources is preserved
                                    if approved_sources:
                                        current_metadata["approved_sources"] = approved_sources
                                        print(f"✅ [NO_CHUNKING] Preserved {len(approved_sources)} approved_sources in document metadata")

                                    document.source_metadata = current_metadata
                                    document.chunk_count = chunk_count
                                    document.word_count = total_word_count
                                    document.character_count = total_char_count
                                    document.status = "processed"

                                    # ========================================
                                    # CRITICAL: Update processing_metadata with storage info
                                    # This allows frontend to know where chunks are stored
                                    # ========================================
                                    storage_strategy = processing_result.get("storage_strategy", "dual_storage")
                                    skip_postgres = processing_result.get("skip_postgres_chunks", False) or is_file_upload_source

                                    document.processing_metadata = {
                                        "processed_at": datetime.utcnow().isoformat(),
                                        "chunks_created": chunk_count,
                                        "embeddings_generated": len(qdrant_chunks),
                                        # CRITICAL: Storage location info for frontend
                                        "storage_strategy": storage_strategy,
                                        "chunk_storage_location": "qdrant_only" if skip_postgres else "postgresql_and_qdrant",
                                        "postgres_chunks_created": 0 if skip_postgres else chunk_count,
                                        "qdrant_chunks_created": chunk_count,
                                        # Enhanced metadata flags
                                        "enhanced_metadata_enabled": enable_enhanced_metadata,
                                        # Chunking decision summary (from processing_result)
                                        "chunking_strategy": processing_result.get("chunking_decision").strategy if processing_result.get("chunking_decision") else "no_chunking",
                                        "chunk_size": processing_result.get("chunking_decision").chunk_size if processing_result.get("chunking_decision") else 0,
                                        "chunk_overlap": processing_result.get("chunking_decision").chunk_overlap if processing_result.get("chunking_decision") else 0,
                                    }

                                    # Update Qdrant chunks with document metadata
                                    for qdrant_chunk in qdrant_chunks:
                                        qdrant_chunk.metadata["document_id"] = str(document.id)
                                        qdrant_chunk.metadata["page_url"] = source_url
                                        qdrant_chunk.metadata["page_title"] = f"Combined {len(scraped_pages)} pages"

                                    # CRITICAL FIX: Save document ID before any session operations
                                    document_id = document.id

                                    # Commit everything
                                    db.commit()

                                    # Index in Qdrant

                                    try:
                                        loop.run_until_complete(
                                            qdrant_service.upsert_chunks(
                                                kb_id=UUID(kb_id),
                                                chunks=qdrant_chunks
                                            )
                                        )

                                        # Update stats (use chunk_count for consistency)
                                        tracker.update_stats(
                                            chunks_created=tracker.stats["chunks_created"] + chunk_count,
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
                            print(f"❌ [CRITICAL] No valid content after combining pages from {source_url}")

                            # CRITICAL FIX: Update document status to indicate failure
                            # Find and update the placeholder document
                            placeholder_doc = db.query(Document).filter(
                                Document.kb_id == UUID(kb_id),
                                Document.source_type == "web_scraping_combined",
                                Document.status == "pending"
                            ).first()

                            if placeholder_doc:
                                placeholder_doc.status = "failed"
                                placeholder_doc.processing_error = "No valid content found to create chunks"
                                db.commit()
                                print(f"✅ [NO_CHUNKING] Updated placeholder document status to 'failed' due to no content")

                            tracker.add_log("error", f"No valid content to create chunks for: {source_url}")
                            # Mark this as a critical failure
                            all_failed = True

                    else:
                        # PROCESS EACH PAGE INDIVIDUALLY (EXISTING BEHAVIOR)
                        # CRITICAL FIX: Define user_chunking_config for individual processing
                        user_chunking_config = config.get("chunking_config", {})
                        print(f"🔧 [INDIVIDUAL] User chunking config: {user_chunking_config}")
                        print(f"🔧 [INDIVIDUAL] Strategy: {user_chunking_config.get('strategy', 'unknown')}")

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

                                # CRITICAL DEBUG: Track content source
                                content_source = scraped_page.get("source", "unknown") if isinstance(scraped_page, dict) else "object_format"

                                # CRITICAL FIX: Apply no_chunking success pattern - GUARANTEE approved content usage
                                # If this scraped_page came from fallback but we have approved content available, use it instead
                                if content_source == "preview_data" and isinstance(scraped_page, dict):
                                    # Check if this page has approved/edited content available
                                    edited_content = scraped_page.get("edited_content")
                                    if edited_content and edited_content.strip():
                                        print(f"🔄 [CONTENT CORRECTION] Found edited_content in preview_data page, using it instead of original content")
                                        print(f"🔄 [CONTENT CORRECTION] Original content start: {page_content[:100] if page_content else 'None'}...")
                                        print(f"🔄 [CONTENT CORRECTION] Approved content start: {edited_content[:100] if edited_content else 'None'}...")
                                        page_content = edited_content  # Use approved content instead
                                        content_source = "corrected_to_approved"
                                    else:
                                        print(f"⚠️ [FALLBACK WARNING] Using preview_data fallback - no edited_content available!")
                                        print(f"⚠️ [FALLBACK WARNING] Content starts with: {page_content[:100] if page_content else 'None'}...")

                                # Log the final content source being used
                                if content_source in ("user_approved", "approved_content", "corrected_to_approved"):
                                    print(f"✅ [APPROVED CONTENT GUARANTEE] Using approved content from {content_source}")

                                else:
                                    print(f"ℹ️ [CONTENT SOURCE] Content starts with: {page_content[:100] if page_content else 'None'}...")
                                print(f"🔍 [CONTENT FLOW DEBUG] Page: {page_url}")


                                # Skip if no content
                                if not page_content or len(page_content.strip()) < 50:
                                    tracker.add_log("warning", f"Skipping page with insufficient content: {page_url}")
                                    continue

                                # ========================================
                                # STEP 2c: CHECK FOR PLACEHOLDER OR CREATE DOCUMENT
                                # ========================================

                                # CRITICAL FIX: Check if a placeholder document exists using metadata-based matching
                                # This is more reliable than URL matching for approved content
                                existing_doc = None

                                # Extract source identification from scraped_page metadata
                                if isinstance(scraped_page, dict):
                                    page_metadata = scraped_page.get("metadata", {})
                                    source_id = page_metadata.get("source_id")
                                    page_index = page_metadata.get("page_index") or page_metadata.get("index")

                                    if source_id is not None:
                                        # Use metadata-based matching (most reliable)
                                        existing_doc = db.query(Document).filter(
                                            Document.kb_id == UUID(kb_id),
                                            Document.status == "pending"
                                        ).filter(
                                            Document.source_metadata["source_id"].astext == str(source_id)
                                        ).filter(
                                            Document.source_metadata["page_index"].astext == str(page_index) if page_index is not None else True
                                        ).first()

                                # Fallback: URL-based matching for legacy compatibility
                                if not existing_doc:
                                    existing_doc = db.query(Document).filter(
                                        Document.kb_id == UUID(kb_id),
                                        Document.source_url == page_url,
                                        Document.status == "pending"
                                    ).first()

                                # OPTION A: Check if this scraped page is a file upload
                                is_file_upload_page = (
                                    isinstance(scraped_page, dict) and
                                    scraped_page.get("source") == "file_upload"
                                )

                                if existing_doc:
                                    # Use existing placeholder document (likely has approved_sources)
                                    document = existing_doc

                                    # OPTION A: Skip content_full for file uploads (Qdrant-only storage)
                                    if is_file_upload_page:
                                        document.content_full = None
                                        document.content_preview = None  # Skip preview storage for file uploads
                                        document.source_type = "file_upload"
                                    else:
                                        document.content_full = page_content  # Store the final content (should be approved if available)
                                        document.content_preview = page_content[:500] if page_content else None
                                    document.word_count = len(page_content.split()) if page_content else 0
                                    document.character_count = len(page_content) if page_content else 0
                                    document.status = "processing"

                                    db.flush()
                                else:
                                    # No placeholder exists, create new document (legacy behavior)

                                    # Create basic Document record first (will be updated with chunking decision later)
                                    page_metadata = scraped_page.get("metadata") if isinstance(scraped_page, dict) else scraped_page.metadata
                                    serialized_metadata = serialize_metadata(page_metadata) if page_metadata else {}

                                    # Handle both dict and object formats for scraped_page
                                    title = scraped_page.get("title") if isinstance(scraped_page, dict) else scraped_page.title
                                    scraped_at = scraped_page.get("scraped_at") if isinstance(scraped_page, dict) else scraped_page.scraped_at

                                    # OPTION A: Determine source type and content storage based on file upload
                                    doc_source_type = "file_upload" if is_file_upload_page else "web_scraping"
                                    doc_content_full = None if is_file_upload_page else page_content
                                    doc_content_preview = None if is_file_upload_page else (page_content[:500] if page_content else None)

                                    document = Document(
                                        kb_id=UUID(kb_id),
                                        workspace_id=kb.workspace_id,
                                        name=title or page_url,
                                        source_type=doc_source_type,
                                        source_url=page_url,
                                        content_full=doc_content_full,  # OPTION A: Skip for file uploads
                                        content_preview=doc_content_preview,  # OPTION A: Skip preview for file uploads too
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

                                try:
                                    # Process document with proper storage strategy and user choice respect
                                    processing_result = loop.run_until_complete(
                                        smart_kb_service.process_document_with_proper_storage(
                                            document=document,
                                            content=page_content,
                                            kb=kb,
                                            user_config=user_chunking_config,
                                            skip_postgres_chunks=is_file_upload_page  # OPTION A: Skip PostgreSQL chunks for file uploads
                                        )
                                    )

                                    if "error" in processing_result:
                                        tracker.add_log("warning", f"Processing failed for page {page_url}: {processing_result['error']}")
                                        continue

                                except Exception as smart_service_error:
                                    # FALLBACK: Use legacy chunking as emergency fallback
                                    tracker.add_log("warning", f"Smart KB service failed, using legacy chunking for {page_url}: {str(smart_service_error)}")

                                    # Use chunking_service as fallback
                                    # IMPORTANT: Use same defaults as preview (by_heading/1000/200) for consistency
                                    fallback_strategy = user_chunking_config.get("strategy", "by_heading") if user_chunking_config else "by_heading"
                                    fallback_chunk_size = user_chunking_config.get("chunk_size", 1000) if user_chunking_config else 1000
                                    fallback_chunk_overlap = user_chunking_config.get("chunk_overlap", 200) if user_chunking_config else 200
                                    fallback_separators = user_chunking_config.get("custom_separators", None) if user_chunking_config else None

                                    # Use legacy chunking service with code block preservation
                                    fallback_preserve_code_blocks = user_chunking_config.get("preserve_code_blocks", True) if user_chunking_config else True
                                    chunks_data = chunking_service.chunk_document(
                                        text=page_content,
                                        strategy=fallback_strategy,
                                        chunk_size=fallback_chunk_size,
                                        chunk_overlap=fallback_chunk_overlap,
                                        separators=fallback_separators,  # Pass custom separators
                                        preserve_code_blocks=fallback_preserve_code_blocks  # Pass user's config
                                    )

                                    # Generate embeddings using configured model
                                    chunk_texts = [chunk["content"] for chunk in chunks_data]
                                    # Apply processing quality settings to embedding generation
                                    embeddings = loop.run_until_complete(
                                        multi_model_embedding_service.generate_embeddings(
                                            chunk_texts,
                                            model_name=embedding_model,
                                            batch_size=embedding_batch_size or processing_quality["embedding_batch_size"]
                                        )
                                    )

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

                                        # Calculate word count and character count
                                        content = chunk_data["content"]
                                        word_count = len(content.split()) if content else 0
                                        character_count = len(content) if content else 0

                                        # PostgreSQL chunk
                                        postgres_chunk_data = {
                                            "id": chunk_id,
                                            "document_id": document.id,
                                            "kb_id": document.kb_id,
                                            "content": content,
                                            "chunk_index": idx,
                                            "position": idx,
                                            "word_count": word_count,
                                            "character_count": character_count,
                                            "chunk_metadata": {
                                                "token_count": chunk_data.get("token_count", 0),
                                                "strategy": fallback_strategy,
                                                "chunk_size": fallback_chunk_size,
                                                "user_preference": True,
                                                "fallback_reason": str(smart_service_error),
                                                "workspace_id": str(document.workspace_id),
                                                "created_at": datetime.utcnow().isoformat(),
                                                "word_count": word_count,
                                                "character_count": character_count
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
                                                "kb_context": kb.context,  # CRITICAL: Enable context-based filtering
                                                "source_type": document.source_type,  # Include source type
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

                                # OPTION A: Log different storage strategies
                                if is_file_upload_page:
                                    tracker.add_log("info",
                                        f"Processed {page_url}: {len(qdrant_chunks)} chunks (Qdrant-only) using {chunking_decision.strategy} strategy. "
                                        f"Reasoning: {chunking_decision.reasoning}"
                                    )
                                    chunk_count = len(qdrant_chunks)
                                else:
                                    tracker.add_log("info",
                                        f"Processed {page_url}: {len(postgres_chunks)} chunks using {chunking_decision.strategy} strategy. "
                                        f"Reasoning: {chunking_decision.reasoning}"
                                    )
                                    chunk_count = len(postgres_chunks)

                                tracker.update_stats(chunks_created=tracker.stats["chunks_created"] + chunk_count)

                                # ========================================
                                # STEP 2d: SAVE TO POSTGRESQL (NO REDUNDANT EMBEDDINGS)
                                # ========================================

                                # Save PostgreSQL chunks (only for web scraping, skipped for file uploads)
                                if postgres_chunks:
                                    for postgres_chunk_data in postgres_chunks:
                                        chunk = Chunk(
                                            id=UUID(postgres_chunk_data["id"]),  # Use the UUID from smart_kb_service
                                            document_id=postgres_chunk_data["document_id"],
                                            kb_id=postgres_chunk_data["kb_id"],
                                            content=postgres_chunk_data["content"],
                                            chunk_index=postgres_chunk_data["chunk_index"],
                                            position=postgres_chunk_data["position"],
                                            word_count=postgres_chunk_data.get("word_count", 0),
                                            character_count=postgres_chunk_data.get("character_count", 0),
                                            # NO embedding field - stored only in Qdrant
                                            chunk_metadata=postgres_chunk_data["chunk_metadata"]
                                        )
                                        db.add(chunk)
                                    print(f"✅ [INDIVIDUAL] Added {len(postgres_chunks)} chunks to database session")
                                else:
                                    print(f"📁 [INDIVIDUAL FILE_UPLOAD] Skipped PostgreSQL chunks (metadata-only storage)")

                                # Calculate document statistics - use qdrant_chunks for file uploads, postgres for web
                                if is_file_upload_page and qdrant_chunks:
                                    # File uploads: get stats from Qdrant chunk metadata
                                    total_word_count = sum(
                                        chunk.metadata.get("word_count", 0) for chunk in qdrant_chunks
                                    )
                                    total_char_count = sum(
                                        chunk.metadata.get("character_count", 0) for chunk in qdrant_chunks
                                    )
                                else:
                                    # Web scraping: get stats from postgres chunks
                                    total_word_count = sum(chunk_data.get("word_count", 0) for chunk_data in postgres_chunks)
                                    total_char_count = sum(chunk_data.get("character_count", 0) for chunk_data in postgres_chunks)

                                # CRITICAL: Update document statistics and status after processing
                                document.chunk_count = chunk_count
                                document.word_count = total_word_count
                                document.character_count = total_char_count
                                document.status = "processed"
                                print(f"✅ [INDIVIDUAL] Updated document {document.id}: {chunk_count} chunks, status=processed")

                                # ========================================
                                # CRITICAL: Update processing_metadata with storage info
                                # This allows frontend to know where chunks are stored
                                # ========================================
                                storage_strategy = processing_result.get("storage_strategy", "dual_storage")
                                skip_postgres = processing_result.get("skip_postgres_chunks", False)

                                document.processing_metadata = {
                                    "processed_at": datetime.utcnow().isoformat(),
                                    "chunks_created": chunk_count,
                                    "embeddings_generated": processing_result.get("embeddings_generated", 0),
                                    # CRITICAL: Storage location info for frontend
                                    "storage_strategy": storage_strategy,
                                    "chunk_storage_location": "qdrant_only" if skip_postgres else "postgresql_and_qdrant",
                                    "postgres_chunks_created": 0 if skip_postgres else chunk_count,
                                    "qdrant_chunks_created": chunk_count,
                                    # Enhanced metadata flags
                                    "enhanced_metadata_enabled": enable_enhanced_metadata,
                                    # Chunking decision summary
                                    "chunking_strategy": chunking_decision.strategy,
                                    "chunk_size": chunking_decision.chunk_size,
                                    "chunk_overlap": chunking_decision.chunk_overlap,
                                }

                                # Update tracking stats
                                tracker.update_stats(
                                    embeddings_generated=tracker.stats["embeddings_generated"] + processing_result["embeddings_generated"]
                                )

                                # ========================================
                                # STEP 2e: UPDATE DOCUMENT WITH CHUNKING DECISION
                                # ========================================

                                # CRITICAL FIX: Update document metadata while preserving approved_sources
                                current_metadata = document.source_metadata or {}
                                # Preserve approved_sources that were set during finalization
                                approved_sources = current_metadata.get("approved_sources", [])
                                current_metadata["chunking_decision"] = {
                                    "strategy": chunking_decision.strategy,
                                    "chunk_size": chunking_decision.chunk_size,
                                    "user_preference": chunking_decision.user_preference,
                                    "reasoning": chunking_decision.reasoning
                                }
                                # Ensure approved_sources is preserved
                                if approved_sources:
                                    current_metadata["approved_sources"] = approved_sources
                                document.source_metadata = current_metadata
                                document.status = "processed"

                                # Update Qdrant chunks with correct document ID
                                for qdrant_chunk in qdrant_chunks:
                                    qdrant_chunk.metadata["document_id"] = str(document.id)
                                    qdrant_chunk.metadata["page_url"] = page_url
                                    qdrant_chunk.metadata["page_title"] = (scraped_page.get("title") if isinstance(scraped_page, dict) else scraped_page.title) or ""

                                # CRITICAL FIX: Save document ID before any session operations
                                document_id = document.id

                                # Commit everything
                                db.commit()

                                # ========================================
                                # STEP 2f: INDEX IN QDRANT
                                # ========================================

                                try:
                                    loop.run_until_complete(
                                        qdrant_service.upsert_chunks(
                                            kb_id=UUID(kb_id),
                                            chunks=qdrant_chunks
                                        )
                                    )
                                except Exception as qdrant_error:
                                    tracker.add_log("error", f"Qdrant upsert failed: {str(qdrant_error)}")
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

        # CRITICAL FIX: Verify actual data in database AND vector store before reporting success
        actual_documents_count = db.query(Document).filter(Document.kb_id == UUID(kb_id)).count()
        actual_chunks_count = db.query(Chunk).filter(Chunk.kb_id == UUID(kb_id)).count()

        # Calculate total size in bytes from all documents
        from sqlalchemy import func
        total_size_result = db.query(func.sum(Document.character_count)).filter(
            Document.kb_id == UUID(kb_id)
        ).scalar()
        total_size_bytes = total_size_result or 0

        print(f"📊 [REALITY CHECK] Planned vs Actual:")

        # CRITICAL FIX: For no_chunking strategy, planned documents should be 1 (combined), not pages_scraped
        if chunk_strategy in ("no_chunking", "full_content"):
            planned_documents = 1  # ALL sources combined into 1 document
            print(f"    Documents: planned={planned_documents} (combined), actual_db={actual_documents_count}")
        else:
            planned_documents = tracker.stats.get('pages_scraped', 0)  # Individual documents
            print(f"    Documents: planned={planned_documents} (individual), actual_db={actual_documents_count}")

        print(f"    Chunks: planned={tracker.stats.get('chunks_created', 0)}, actual_db={actual_chunks_count}")
        print(f"    Vectors: planned={tracker.stats.get('vectors_indexed', 0)}")

        # CRITICAL: Verify vector store actually contains vectors
        actual_vectors_count = 0
        try:
            # Check if Qdrant collection exists and has vectors
            collection_stats = loop.run_until_complete(qdrant_service.get_collection_stats(UUID(kb_id)))
            actual_vectors_count = collection_stats.get("vectors_count", 0) if collection_stats else 0
            print(f"    Vectors: actual_qdrant={actual_vectors_count}")
        except Exception as e:
            print(f"⚠️ [WARNING] Could not verify Qdrant vectors: {str(e)}")
            actual_vectors_count = 0

        # OPTION A: Check if all sources were file uploads (Qdrant-only storage)
        all_sources_file_upload = all(s.get("type") == "file_upload" for s in sources) if sources else False

        # CRITICAL: Only report success if ALL data exists
        # For Option A (file uploads), chunks are stored ONLY in Qdrant, not PostgreSQL
        if all_sources_file_upload:
            # Option A: File uploads use Qdrant-only storage
            if actual_vectors_count == 0:
                print("❌ [CRITICAL ERROR] No vectors found in Qdrant for file upload!")
                kb.status = "failed"
                kb.error_message = "Processing failed: No vectors were indexed in vector store"
                tracker.update_status(
                    status="failed",
                    current_stage="Failed - No vectors in Qdrant",
                    progress_percentage=100,
                    error="No vectors were indexed in vector store"
                )
            else:
                print(f"✅ [SUCCESS] Option A (file upload) verified - {actual_vectors_count} vectors in Qdrant (no PostgreSQL chunks expected)")
        elif actual_chunks_count == 0:
            print("❌ [CRITICAL ERROR] No chunks found in database despite reported success!")
            kb.status = "failed"
            kb.error_message = "Processing failed: No chunks were created in database"
            tracker.update_status(
                status="failed",
                current_stage="Failed - No chunks in database",
                progress_percentage=100,
                error="No chunks were created in database"
            )
        elif actual_vectors_count == 0:
            print("❌ [CRITICAL ERROR] No vectors found in Qdrant despite reported success!")
            kb.status = "failed"
            kb.error_message = "Processing failed: No vectors were indexed in vector store"
            tracker.update_status(
                status="failed",
                current_stage="Failed - No vectors in Qdrant",
                progress_percentage=100,
                error="No vectors were indexed in vector store"
            )
        else:
            print("✅ [SUCCESS] Data consistency verified - using ACTUAL counts")

        # Update KB metadata with ACTUAL counts (not planned counts)
        # OPTION A: For file uploads, use vector count as chunk count (since chunks are only in Qdrant)
        effective_chunk_count = actual_vectors_count if all_sources_file_upload else actual_chunks_count

        kb.stats = {
            "total_documents": actual_documents_count,
            "total_chunks": effective_chunk_count,  # Use vectors for file uploads, chunks for web
            "total_vectors": actual_vectors_count,  # Use ACTUAL count from Qdrant
            "total_size_bytes": total_size_bytes,  # Total content size in bytes
            "processing_duration_seconds": int(duration),
            # Keep page stats for reference
            "pages_scraped": tracker.stats.get("pages_scraped", 0),
            "pages_failed": tracker.stats.get("pages_failed", 0),
            # OPTION A: Storage type indicator
            "storage_type": "qdrant_only" if all_sources_file_upload else "hybrid",
            # Add verification timestamp
            "verified_at": datetime.utcnow().isoformat()
        }

        # Also update integer columns for compatibility
        kb.total_documents = actual_documents_count
        kb.total_chunks = effective_chunk_count  # Use vectors for file uploads, chunks for web

        # Final commit
        db.commit()
        print(f"✅ [FINAL COMMIT] KB status and stats committed successfully")

        # VERIFICATION: Final verification of KB state (using kb_id string)
        final_kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == UUID(kb_id)).first()
        final_chunks_count = db.query(Chunk).filter(Chunk.kb_id == UUID(kb_id)).count()
        print(f"🔍 [FINAL VERIFICATION] KB status: {final_kb.status}, Chunks: {final_chunks_count}")

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
            # Use existing KB chunking configuration from kb.config (not kb.chunking_config)
            # The chunking config is stored inside the 'config' JSONB column
            kb_config = kb.config or {}
            chunking_config = kb_config.get('chunking_config') or {
                "strategy": "recursive",
                "chunk_size": 1000,
                "chunk_overlap": 200
            }

        # Extract chunking parameters
        strategy = chunking_config.get('strategy', 'recursive')
        chunk_size = chunking_config.get('chunk_size', 1000)
        chunk_overlap = chunking_config.get('chunk_overlap', 200)
        custom_separators = chunking_config.get('custom_separators', None)  # Support custom separators in reindex
        preserve_code_blocks = chunking_config.get('preserve_code_blocks', True)  # Keep code blocks intact (default: True)
        semantic_threshold = chunking_config.get('semantic_threshold', 0.65)  # For semantic chunking strategy

        # Extract embedding config from new_config or KB record
        if new_config and new_config.get('embedding_config'):
            embedding_config = new_config['embedding_config']
        else:
            embedding_config = kb.embedding_config or {}

        # Extract embedding model (CRITICAL: user-configured model selection)
        embedding_model = embedding_config.get("model") or embedding_config.get("model_name", "all-MiniLM-L6-v2")
        embedding_batch_size = embedding_config.get("batch_size", 32)
        print(f"🔧 [REINDEX] Using embedding model: {embedding_model}, batch_size: {embedding_batch_size}")

        # Extract vector_store_config from new_config or KB record
        if new_config and new_config.get('vector_store_config'):
            vector_store_config = new_config['vector_store_config']
        else:
            vector_store_config = kb.vector_store_config or {}

        # Handle nested "settings" structure from frontend
        if "settings" in vector_store_config:
            settings = vector_store_config.get("settings", {})
            distance_metric = settings.get("distance_metric", "Cosine")
            hnsw_m = settings.get("hnsw_m", 16)
            ef_construct = settings.get("ef_construct", 100)
        else:
            # Flat structure (from model-config endpoint or KBVectorStoreSettings)
            distance_metric = vector_store_config.get("distance_metric", "Cosine")
            hnsw_m = vector_store_config.get("hnsw_m", 16)
            ef_construct = vector_store_config.get("ef_construct", 100)

        # Map distance_metric to Qdrant format (handles both lowercase and capitalized)
        qdrant_distance_map = {
            "cosine": "Cosine",
            "euclidean": "Euclid",
            "euclid": "Euclid",
            "dot": "Dot",
            "dot_product": "Dot"
        }
        # If already in Qdrant format (capitalized), use as-is; otherwise map
        if distance_metric in ["Cosine", "Euclid", "Dot"]:
            qdrant_distance = distance_metric
        else:
            qdrant_distance = qdrant_distance_map.get(distance_metric.lower(), "Cosine")

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

        # Delete and recreate Qdrant collection with user-configured parameters
        loop.run_until_complete(
            qdrant_service.delete_kb_collection(UUID(kb_id))
        )

        # Get vector dimension for the configured embedding model
        vector_dimension = multi_model_embedding_service.get_embedding_dimension(embedding_model)

        loop.run_until_complete(
            qdrant_service.create_kb_collection(
                kb_id=UUID(kb_id),
                vector_size=vector_dimension,
                distance_metric=qdrant_distance,
                hnsw_m=int(hnsw_m),
                ef_construct=int(ef_construct)
            )
        )
        print(f"🔧 [REINDEX] Qdrant collection recreated (model: {embedding_model}, dim: {vector_dimension}, distance: {qdrant_distance}, hnsw_m: {hnsw_m}, ef_construct: {ef_construct})")

        # Re-process each document
        total_chunks = 0
        total_vectors = 0
        file_upload_skipped = 0

        for document in documents:
            # CRITICAL FIX: Use content_full instead of non-existent .content attribute
            # For file uploads, content_full is None - we cannot reindex these
            # File upload content is only in Qdrant, not PostgreSQL
            document_content = document.content_full

            # Skip file uploads - their content is in Qdrant only, not PostgreSQL
            # Reindexing file uploads would require re-parsing the original files
            if document.source_type == "file_upload":
                print(f"⏭️ [REINDEX] Skipping file upload document: {document.name} (content in Qdrant only)")
                file_upload_skipped += 1
                continue

            if not document_content:
                print(f"⏭️ [REINDEX] Skipping document with no content: {document.name}")
                continue

            # Chunk content using determined configuration with code block preservation
            chunks_data = chunking_service.chunk_document(
                text=document_content,
                strategy=strategy,
                chunk_size=chunk_size,
                chunk_overlap=chunk_overlap,
                separators=custom_separators,  # Pass custom separators for "custom" strategy
                config={"semantic_threshold": semantic_threshold},  # Pass semantic threshold for semantic strategy
                preserve_code_blocks=preserve_code_blocks  # Pass user's config
            )

            # Generate embeddings using configured model
            chunk_texts = [chunk["content"] for chunk in chunks_data]
            embeddings = loop.run_until_complete(
                multi_model_embedding_service.generate_embeddings(
                    chunk_texts,
                    model_name=embedding_model,
                    batch_size=embedding_batch_size or 32  # Default batch size if not configured
                )
            )

            # Create chunks and index in Qdrant
            qdrant_chunks = []

            for chunk_idx, (chunk_data, embedding) in enumerate(zip(chunks_data, embeddings)):
                # Calculate statistics for this chunk
                chunk_content = chunk_data["content"]
                chunk_word_count = len(chunk_content.split()) if chunk_content else 0
                chunk_character_count = len(chunk_content) if chunk_content else 0

                # Create Chunk in PostgreSQL
                # NOTE: Chunk model does NOT have workspace_id - it's inherited from KB via kb_id
                chunk = Chunk(
                    document_id=document.id,
                    kb_id=UUID(kb_id),
                    content=chunk_content,
                    chunk_index=chunk_idx,
                    position=chunk_idx,  # Position within document
                    word_count=chunk_word_count,
                    character_count=chunk_character_count,
                    embedding=embedding,
                    chunk_metadata={
                        "token_count": chunk_data.get("token_count", 0),
                        "strategy": strategy,
                        "chunk_size": chunk_size,
                        "chunk_overlap": chunk_overlap,
                        "reindexed_at": datetime.utcnow().isoformat(),
                        "word_count": chunk_word_count,
                        "character_count": chunk_character_count
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
                            "kb_context": kb.context,  # CRITICAL: Enable context-based filtering
                            "source_type": document.source_type,  # Include source type (web_scraping, file_upload, etc.)
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

        # Calculate total size in bytes from all documents
        from sqlalchemy import func
        total_size_result = db.query(func.sum(Document.character_count)).filter(
            Document.kb_id == UUID(kb_id)
        ).scalar()
        total_size_bytes = total_size_result or 0

        # Calculate processed documents (excluding file uploads)
        processed_documents = len(documents) - file_upload_skipped

        # Update KB status
        kb.status = "ready"
        kb.updated_at = datetime.utcnow()
        kb.stats = {
            "total_documents": len(documents),
            "total_chunks": total_chunks,
            "total_vectors": total_vectors,
            "total_size_bytes": total_size_bytes,
            "reindexed_at": datetime.utcnow().isoformat(),
            "file_upload_documents": file_upload_skipped,
            "reindexed_documents": processed_documents
        }

        # Also update integer columns for compatibility
        # Note: These are legacy fields but still used by API responses and queries
        kb.total_documents = len(documents)
        kb.total_chunks = total_chunks

        db.commit()

        # Log file upload warning if any were skipped
        if file_upload_skipped > 0:
            print(f"⚠️ [REINDEX] {file_upload_skipped} file upload document(s) skipped - their content is stored in Qdrant only")

        return {
            "kb_id": kb_id,
            "status": "completed",
            "configuration_applied": configuration_applied,
            "stats": {
                "documents": len(documents),
                "documents_reindexed": processed_documents,
                "file_uploads_skipped": file_upload_skipped,
                "chunks": total_chunks,
                "vectors": total_vectors,
                "chunking_config": {
                    "strategy": strategy,
                    "chunk_size": chunk_size,
                    "chunk_overlap": chunk_overlap
                }
            },
            "warnings": [
                f"{file_upload_skipped} file upload document(s) were skipped - their content is stored in Qdrant only and cannot be reindexed from PostgreSQL"
            ] if file_upload_skipped > 0 else []
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
