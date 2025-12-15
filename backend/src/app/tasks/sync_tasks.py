"""
Sync Tasks - Celery tasks for cloud synchronization.

WHY:
- Sync with external services
- Notion pages/databases
- Google Docs/Sheets
- Scheduled sync jobs
- Keep content updated

HOW:
- Celery async tasks
- Use integration adapters
- OAuth2 for authentication
- Detect changes and update

PSEUDOCODE follows the existing codebase patterns.
"""

from celery import shared_task
from uuid import UUID
from sqlalchemy.orm import Session
from typing import Optional, List

from app.db.session import SessionLocal
from app.integrations.notion_adapter import notion_adapter
from app.integrations.google_adapter import google_adapter
from app.services.credential_service import credential_service


@shared_task(bind=True, name="sync_notion_page")
def sync_notion_page_task(
    self,
    kb_id: str,
    page_id: str,
    credential_id: str
):
    """
    Sync single Notion page.

    WHY: Import Notion content to KB
    HOW: Use Notion API, create/update document

    FLOW:
    1. Get credential
    2. Fetch Notion page content
    3. Create or update document
    4. Queue for processing

    ARGS:
        kb_id: Knowledge base UUID
        page_id: Notion page ID
        credential_id: Credential UUID for Notion

    RETURNS:
        {
            "kb_id": "uuid",
            "page_id": "notion_page_id",
            "document_id": "uuid",
            "status": "synced"
        }
    """

    db = SessionLocal()

    try:
        from app.models.knowledge_base import KnowledgeBase
        from app.models.document import Document
        from app.models.credential import Credential
        import asyncio

        # Get KB
        kb = db.query(KnowledgeBase).get(UUID(kb_id))
        if not kb:
            raise ValueError(f"KB not found: {kb_id}")

        # Get credential
        credential = db.query(Credential).get(UUID(credential_id))
        if not credential:
            raise ValueError(f"Credential not found: {credential_id}")

        # Get decrypted credential data
        cred_data = credential_service.get_decrypted_data(db, credential)

        # Fetch Notion page
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

        page_content = loop.run_until_complete(
            notion_adapter.fetch_page(
                db=db,
                page_id=page_id,
                access_token=cred_data["access_token"]
            )
        )

        loop.close()

        # Check if document already exists
        existing_doc = db.query(Document).filter(
            Document.kb_id == UUID(kb_id),
            Document.source_type == "notion",
            Document.metadata["notion_page_id"].astext == page_id
        ).first()

        if existing_doc:
            # Update existing document
            existing_doc.content = page_content["content"]
            existing_doc.title = page_content["title"]
            existing_doc.metadata = {
                **existing_doc.metadata,
                "last_synced_at": page_content["last_edited_time"],
                "notion_url": page_content["url"]
            }
            existing_doc.status = "pending"

            db.commit()

            # Queue for reindexing
            from app.tasks.document_tasks import reindex_document_task
            reindex_document_task.delay(
                document_id=str(existing_doc.id)
            )

            document_id = str(existing_doc.id)

        else:
            # Create new document
            document = Document(
                kb_id=UUID(kb_id),
                source_type="notion",
                source_url=page_content["url"],
                content=page_content["content"],
                title=page_content["title"],
                metadata={
                    "notion_page_id": page_id,
                    "notion_workspace_id": page_content.get("workspace_id"),
                    "last_edited_time": page_content["last_edited_time"],
                    "created_time": page_content.get("created_time"),
                    "notion_url": page_content["url"]
                },
                status="pending"
            )

            db.add(document)
            db.commit()

            document_id = str(document.id)

            # Queue for processing
            from app.tasks.document_tasks import process_document_task
            process_document_task.delay(
                document_id=document_id,
                kb_id=kb_id
            )

        return {
            "kb_id": kb_id,
            "page_id": page_id,
            "document_id": document_id,
            "status": "synced"
        }

    except Exception as e:
        raise

    finally:
        db.close()


@shared_task(bind=True, name="sync_notion_database")
def sync_notion_database_task(
    self,
    kb_id: str,
    database_id: str,
    credential_id: str
):
    """
    Sync all pages from Notion database.

    WHY: Bulk sync from Notion database
    HOW: Query database, sync each page

    ARGS:
        kb_id: Knowledge base UUID
        database_id: Notion database ID
        credential_id: Credential UUID

    RETURNS:
        {
            "kb_id": "uuid",
            "database_id": "notion_db_id",
            "pages_synced": 25,
            "status": "completed"
        }
    """

    db = SessionLocal()

    try:
        from app.models.credential import Credential
        import asyncio

        # Get credential
        credential = db.query(Credential).get(UUID(credential_id))
        if not credential:
            raise ValueError(f"Credential not found: {credential_id}")

        # Get decrypted credential data
        cred_data = credential_service.get_decrypted_data(db, credential)

        # Query Notion database
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

        pages = loop.run_until_complete(
            notion_adapter.query_database(
                db=db,
                database_id=database_id,
                access_token=cred_data["access_token"]
            )
        )

        loop.close()

        # Sync each page
        pages_synced = 0

        for page in pages:
            sync_notion_page_task.delay(
                kb_id=kb_id,
                page_id=page["id"],
                credential_id=credential_id
            )
            pages_synced += 1

        return {
            "kb_id": kb_id,
            "database_id": database_id,
            "pages_synced": pages_synced,
            "status": "completed"
        }

    except Exception as e:
        raise

    finally:
        db.close()


@shared_task(bind=True, name="sync_google_doc")
def sync_google_doc_task(
    self,
    kb_id: str,
    doc_id: str,
    credential_id: str
):
    """
    Sync single Google Doc.

    WHY: Import Google Docs content
    HOW: Use Google Docs API, create/update document

    ARGS:
        kb_id: Knowledge base UUID
        doc_id: Google Doc ID
        credential_id: Credential UUID for Google

    RETURNS:
        {
            "kb_id": "uuid",
            "doc_id": "google_doc_id",
            "document_id": "uuid",
            "status": "synced"
        }
    """

    db = SessionLocal()

    try:
        from app.models.knowledge_base import KnowledgeBase
        from app.models.document import Document
        from app.models.credential import Credential
        import asyncio

        # Get KB
        kb = db.query(KnowledgeBase).get(UUID(kb_id))
        if not kb:
            raise ValueError(f"KB not found: {kb_id}")

        # Get credential
        credential = db.query(Credential).get(UUID(credential_id))
        if not credential:
            raise ValueError(f"Credential not found: {credential_id}")

        # Get decrypted credential data
        cred_data = credential_service.get_decrypted_data(db, credential)

        # Fetch Google Doc
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

        doc_content = loop.run_until_complete(
            google_adapter.fetch_document(
                db=db,
                doc_id=doc_id,
                credentials=cred_data
            )
        )

        loop.close()

        # Check if document already exists
        existing_doc = db.query(Document).filter(
            Document.kb_id == UUID(kb_id),
            Document.source_type == "google_docs",
            Document.metadata["google_doc_id"].astext == doc_id
        ).first()

        if existing_doc:
            # Update existing document
            existing_doc.content = doc_content["content"]
            existing_doc.title = doc_content["title"]
            existing_doc.metadata = {
                **existing_doc.metadata,
                "last_synced_at": doc_content["modified_time"],
                "google_doc_url": doc_content["url"]
            }
            existing_doc.status = "pending"

            db.commit()

            # Queue for reindexing
            from app.tasks.document_tasks import reindex_document_task
            reindex_document_task.delay(
                document_id=str(existing_doc.id)
            )

            document_id = str(existing_doc.id)

        else:
            # Create new document
            document = Document(
                kb_id=UUID(kb_id),
                source_type="google_docs",
                source_url=doc_content["url"],
                content=doc_content["content"],
                title=doc_content["title"],
                metadata={
                    "google_doc_id": doc_id,
                    "created_time": doc_content.get("created_time"),
                    "modified_time": doc_content["modified_time"],
                    "google_doc_url": doc_content["url"],
                    "owner": doc_content.get("owner")
                },
                status="pending"
            )

            db.add(document)
            db.commit()

            document_id = str(document.id)

            # Queue for processing
            from app.tasks.document_tasks import process_document_task
            process_document_task.delay(
                document_id=document_id,
                kb_id=kb_id
            )

        return {
            "kb_id": kb_id,
            "doc_id": doc_id,
            "document_id": document_id,
            "status": "synced"
        }

    except Exception as e:
        raise

    finally:
        db.close()


@shared_task(bind=True, name="sync_google_folder")
def sync_google_folder_task(
    self,
    kb_id: str,
    folder_id: str,
    credential_id: str,
    recursive: bool = False
):
    """
    Sync all documents from Google Drive folder.

    WHY: Bulk sync from Google Drive
    HOW: List folder contents, sync each doc

    ARGS:
        kb_id: Knowledge base UUID
        folder_id: Google Drive folder ID
        credential_id: Credential UUID
        recursive: Include subfolders

    RETURNS:
        {
            "kb_id": "uuid",
            "folder_id": "google_folder_id",
            "docs_synced": 15,
            "status": "completed"
        }
    """

    db = SessionLocal()

    try:
        from app.models.credential import Credential
        import asyncio

        # Get credential
        credential = db.query(Credential).get(UUID(credential_id))
        if not credential:
            raise ValueError(f"Credential not found: {credential_id}")

        # Get decrypted credential data
        cred_data = credential_service.get_decrypted_data(db, credential)

        # List folder contents
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

        files = loop.run_until_complete(
            google_adapter.list_folder(
                db=db,
                folder_id=folder_id,
                credentials=cred_data,
                recursive=recursive
            )
        )

        loop.close()

        # Sync each Google Doc/Sheet
        docs_synced = 0

        for file in files:
            # Only sync Google Docs and Sheets
            mime_type = file.get("mimeType", "")
            if mime_type in [
                "application/vnd.google-apps.document",
                "application/vnd.google-apps.spreadsheet"
            ]:
                sync_google_doc_task.delay(
                    kb_id=kb_id,
                    doc_id=file["id"],
                    credential_id=credential_id
                )
                docs_synced += 1

        return {
            "kb_id": kb_id,
            "folder_id": folder_id,
            "docs_synced": docs_synced,
            "status": "completed"
        }

    except Exception as e:
        raise

    finally:
        db.close()


@shared_task(bind=True, name="scheduled_sync")
def scheduled_sync_task(self, kb_id: str):
    """
    Periodic sync of all connected sources.

    WHY: Keep KB content up to date
    HOW: Re-sync all connected integrations

    FLOW:
    1. Get KB sync configuration
    2. Get all synced documents (Notion, Google)
    3. Re-sync each source
    4. Update metadata

    ARGS:
        kb_id: Knowledge base UUID

    RETURNS:
        {
            "kb_id": "uuid",
            "sources_synced": 50,
            "errors": 2,
            "status": "completed"
        }
    """

    db = SessionLocal()

    try:
        from app.models.knowledge_base import KnowledgeBase
        from app.models.document import Document

        # Get KB
        kb = db.query(KnowledgeBase).get(UUID(kb_id))
        if not kb:
            raise ValueError(f"KB not found: {kb_id}")

        # Check if scheduled sync is enabled
        sync_config = kb.config.get("sync_config", {})
        if not sync_config.get("auto_sync", False):
            return {
                "kb_id": kb_id,
                "status": "skipped",
                "reason": "Auto-sync disabled"
            }

        # Get all synced documents
        documents = db.query(Document).filter(
            Document.kb_id == UUID(kb_id),
            Document.source_type.in_(["notion", "google_docs", "google_sheets"])
        ).all()

        sources_synced = 0
        errors = 0

        # Group by source type and credential
        notion_docs = [d for d in documents if d.source_type == "notion"]
        google_docs = [d for d in documents if d.source_type in ["google_docs", "google_sheets"]]

        # Sync Notion pages
        notion_credential_id = sync_config.get("notion_credential_id")
        if notion_credential_id:
            for doc in notion_docs:
                try:
                    page_id = doc.metadata.get("notion_page_id")
                    if page_id:
                        sync_notion_page_task.delay(
                            kb_id=kb_id,
                            page_id=page_id,
                            credential_id=notion_credential_id
                        )
                        sources_synced += 1
                except Exception as e:
                    errors += 1
                    print(f"Error syncing Notion page {doc.id}: {e}")

        # Sync Google Docs
        google_credential_id = sync_config.get("google_credential_id")
        if google_credential_id:
            for doc in google_docs:
                try:
                    doc_id = doc.metadata.get("google_doc_id")
                    if doc_id:
                        sync_google_doc_task.delay(
                            kb_id=kb_id,
                            doc_id=doc_id,
                            credential_id=google_credential_id
                        )
                        sources_synced += 1
                except Exception as e:
                    errors += 1
                    print(f"Error syncing Google Doc {doc.id}: {e}")

        # Update KB metadata
        if not kb.metadata:
            kb.metadata = {}
        kb.metadata["last_scheduled_sync"] = str(__import__("datetime").datetime.utcnow())
        kb.metadata["last_sync_stats"] = {
            "sources_synced": sources_synced,
            "errors": errors
        }
        db.commit()

        return {
            "kb_id": kb_id,
            "sources_synced": sources_synced,
            "errors": errors,
            "status": "completed"
        }

    except Exception as e:
        raise

    finally:
        db.close()
