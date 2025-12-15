"""
Crawling Tasks - Celery tasks for website crawling.

WHY:
- Long-running website crawling
- Sitemap processing
- Scheduled re-crawling
- Queue management

HOW:
- Celery async tasks
- Process after KB finalized
- Use crawling adapters
- Update status in database

PSEUDOCODE follows the existing codebase patterns.
"""

from celery import shared_task
from uuid import UUID
from sqlalchemy.orm import Session
from typing import Optional

from app.db.session import SessionLocal
from app.integrations.crawl4ai_adapter import crawl4ai_adapter
from app.integrations.firecrawl_adapter import firecrawl_adapter
from app.integrations.jina_adapter import jina_adapter
from app.services.chunking_service import chunking_service
from app.services.indexing_service import indexing_service


@shared_task(bind=True, name="crawl_website")
def crawl_website_task(
    self,
    kb_id: str,
    url: str,
    max_pages: int = 10,
    adapter: str = "crawl4ai"
):
    """
    Crawl website and create documents.

    WHY: Async website scraping
    HOW: Use crawling adapters, create documents

    FLOW:
    1. Select adapter (crawl4ai, firecrawl, jina)
    2. Crawl website (follow links up to max_pages)
    3. Create document for each page
    4. Queue documents for processing
    5. Update KB status

    ARGS:
        kb_id: Knowledge base UUID
        url: Starting URL
        max_pages: Maximum pages to crawl
        adapter: "crawl4ai" | "firecrawl" | "jina"

    RETURNS:
        {
            "kb_id": "uuid",
            "pages_crawled": 42,
            "documents_created": 42,
            "status": "completed"
        }
    """

    db = SessionLocal()

    try:
        from app.models.knowledge_base import KnowledgeBase
        from app.models.document import Document
        import asyncio

        # Get KB
        kb = db.query(KnowledgeBase).get(UUID(kb_id))
        if not kb:
            raise ValueError(f"KB not found: {kb_id}")

        # Update KB status
        if not kb.metadata:
            kb.metadata = {}
        kb.metadata["crawl_status"] = "crawling"
        kb.metadata["crawl_started_at"] = str(__import__("datetime").datetime.utcnow())
        db.commit()

        # Select adapter
        if adapter == "crawl4ai":
            crawler = crawl4ai_adapter
        elif adapter == "firecrawl":
            crawler = firecrawl_adapter
        elif adapter == "jina":
            crawler = jina_adapter
        else:
            raise ValueError(f"Unknown adapter: {adapter}")

        # Run async crawling
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

        pages = loop.run_until_complete(
            crawler.crawl_website(
                db=db,
                url=url,
                max_pages=max_pages
            )
        )

        loop.close()

        # Create documents for each page
        documents_created = 0

        for page in pages:
            # Create document
            document = Document(
                kb_id=UUID(kb_id),
                source_type="web",
                source_url=page["url"],
                content=page["content"],
                title=page.get("title", page["url"]),
                metadata={
                    "crawled_at": page.get("crawled_at"),
                    "status_code": page.get("status_code", 200),
                    "content_type": page.get("content_type", "text/html"),
                    "word_count": len(page["content"].split()),
                    "adapter": adapter
                },
                status="pending"
            )

            db.add(document)
            documents_created += 1

        db.commit()

        # Queue documents for processing
        from app.tasks.document_tasks import process_document_task

        documents = db.query(Document).filter(
            Document.kb_id == UUID(kb_id),
            Document.status == "pending"
        ).all()

        for document in documents:
            process_document_task.delay(
                document_id=str(document.id),
                kb_id=kb_id
            )

        # Update KB status
        kb.metadata["crawl_status"] = "completed"
        kb.metadata["crawl_completed_at"] = str(__import__("datetime").datetime.utcnow())
        kb.metadata["pages_crawled"] = len(pages)
        kb.metadata["documents_created"] = documents_created
        db.commit()

        return {
            "kb_id": kb_id,
            "pages_crawled": len(pages),
            "documents_created": documents_created,
            "status": "completed"
        }

    except Exception as e:
        # Update KB with error
        try:
            kb = db.query(KnowledgeBase).get(UUID(kb_id))
            if kb:
                if not kb.metadata:
                    kb.metadata = {}
                kb.metadata["crawl_status"] = "error"
                kb.metadata["crawl_error"] = str(e)
                db.commit()
        except:
            pass

        raise

    finally:
        db.close()


@shared_task(bind=True, name="crawl_sitemap")
def crawl_sitemap_task(
    self,
    kb_id: str,
    sitemap_url: str,
    adapter: str = "crawl4ai"
):
    """
    Process sitemap.xml URLs.

    WHY: Crawl all pages from sitemap
    HOW: Parse sitemap, crawl each URL

    ARGS:
        kb_id: Knowledge base UUID
        sitemap_url: URL to sitemap.xml
        adapter: Crawling adapter to use

    RETURNS:
        {
            "kb_id": "uuid",
            "urls_found": 100,
            "pages_crawled": 100,
            "status": "completed"
        }
    """

    db = SessionLocal()

    try:
        from app.models.knowledge_base import KnowledgeBase
        from app.models.document import Document
        import asyncio

        # Get KB
        kb = db.query(KnowledgeBase).get(UUID(kb_id))
        if not kb:
            raise ValueError(f"KB not found: {kb_id}")

        # Update KB status
        if not kb.metadata:
            kb.metadata = {}
        kb.metadata["sitemap_status"] = "processing"
        db.commit()

        # Select adapter
        if adapter == "crawl4ai":
            crawler = crawl4ai_adapter
        elif adapter == "firecrawl":
            crawler = firecrawl_adapter
        elif adapter == "jina":
            crawler = jina_adapter
        else:
            raise ValueError(f"Unknown adapter: {adapter}")

        # Parse sitemap
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

        urls = loop.run_until_complete(
            crawler.parse_sitemap(db=db, sitemap_url=sitemap_url)
        )

        # Crawl each URL
        documents_created = 0

        for url in urls:
            try:
                page = loop.run_until_complete(
                    crawler.crawl_single_page(db=db, url=url)
                )

                # Create document
                document = Document(
                    kb_id=UUID(kb_id),
                    source_type="web",
                    source_url=page["url"],
                    content=page["content"],
                    title=page.get("title", page["url"]),
                    metadata={
                        "crawled_at": page.get("crawled_at"),
                        "from_sitemap": True,
                        "sitemap_url": sitemap_url,
                        "adapter": adapter
                    },
                    status="pending"
                )

                db.add(document)
                documents_created += 1

            except Exception as e:
                # Log error but continue
                print(f"Error crawling {url}: {e}")
                continue

        db.commit()
        loop.close()

        # Queue documents for processing
        from app.tasks.document_tasks import process_document_task

        documents = db.query(Document).filter(
            Document.kb_id == UUID(kb_id),
            Document.status == "pending"
        ).all()

        for document in documents:
            process_document_task.delay(
                document_id=str(document.id),
                kb_id=kb_id
            )

        # Update KB status
        kb.metadata["sitemap_status"] = "completed"
        kb.metadata["urls_found"] = len(urls)
        kb.metadata["pages_crawled"] = documents_created
        db.commit()

        return {
            "kb_id": kb_id,
            "urls_found": len(urls),
            "pages_crawled": documents_created,
            "status": "completed"
        }

    except Exception as e:
        # Update KB with error
        try:
            kb = db.query(KnowledgeBase).get(UUID(kb_id))
            if kb:
                if not kb.metadata:
                    kb.metadata = {}
                kb.metadata["sitemap_status"] = "error"
                kb.metadata["sitemap_error"] = str(e)
                db.commit()
        except:
            pass

        raise

    finally:
        db.close()


@shared_task(bind=True, name="scheduled_crawl")
def scheduled_crawl_task(self, kb_id: str):
    """
    Periodic re-crawling of website.

    WHY: Keep KB content up to date
    HOW: Re-crawl, detect changes, update

    FLOW:
    1. Get KB crawl configuration
    2. Get all web documents
    3. Re-crawl each URL
    4. Compare content with existing
    5. Update if changed
    6. Reindex if updated

    ARGS:
        kb_id: Knowledge base UUID

    RETURNS:
        {
            "kb_id": "uuid",
            "urls_checked": 50,
            "urls_updated": 5,
            "urls_unchanged": 45,
            "status": "completed"
        }
    """

    db = SessionLocal()

    try:
        from app.models.knowledge_base import KnowledgeBase
        from app.models.document import Document
        import asyncio

        # Get KB
        kb = db.query(KnowledgeBase).get(UUID(kb_id))
        if not kb:
            raise ValueError(f"KB not found: {kb_id}")

        # Check if scheduled crawling is enabled
        crawl_config = kb.config.get("crawl_config", {})
        if not crawl_config.get("auto_refresh", False):
            return {
                "kb_id": kb_id,
                "status": "skipped",
                "reason": "Auto-refresh disabled"
            }

        # Get adapter
        adapter = crawl_config.get("adapter", "crawl4ai")
        if adapter == "crawl4ai":
            crawler = crawl4ai_adapter
        elif adapter == "firecrawl":
            crawler = firecrawl_adapter
        elif adapter == "jina":
            crawler = jina_adapter
        else:
            crawler = crawl4ai_adapter

        # Get all web documents
        documents = db.query(Document).filter(
            Document.kb_id == UUID(kb_id),
            Document.source_type == "web"
        ).all()

        urls_checked = 0
        urls_updated = 0
        urls_unchanged = 0

        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

        for document in documents:
            try:
                # Re-crawl URL
                page = loop.run_until_complete(
                    crawler.crawl_single_page(
                        db=db,
                        url=document.source_url
                    )
                )

                urls_checked += 1

                # Compare content
                new_content = page["content"]
                old_content = document.content

                # Simple content comparison (could use diff/hash)
                if new_content != old_content:
                    # Content changed - update document
                    document.content = new_content
                    document.title = page.get("title", document.title)
                    document.metadata["last_crawled_at"] = page.get("crawled_at")
                    document.metadata["updated_by_scheduled_crawl"] = True
                    document.status = "pending"  # Will be reindexed

                    urls_updated += 1

                    # Queue for reindexing
                    from app.tasks.document_tasks import reindex_document_task
                    reindex_document_task.delay(
                        document_id=str(document.id)
                    )
                else:
                    urls_unchanged += 1

            except Exception as e:
                # Log error but continue
                print(f"Error re-crawling {document.source_url}: {e}")
                continue

        loop.close()
        db.commit()

        # Update KB metadata
        if not kb.metadata:
            kb.metadata = {}
        kb.metadata["last_scheduled_crawl"] = str(__import__("datetime").datetime.utcnow())
        kb.metadata["last_crawl_stats"] = {
            "urls_checked": urls_checked,
            "urls_updated": urls_updated,
            "urls_unchanged": urls_unchanged
        }
        db.commit()

        return {
            "kb_id": kb_id,
            "urls_checked": urls_checked,
            "urls_updated": urls_updated,
            "urls_unchanged": urls_unchanged,
            "status": "completed"
        }

    except Exception as e:
        raise

    finally:
        db.close()
