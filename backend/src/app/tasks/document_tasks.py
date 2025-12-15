"""
Document Tasks - Celery tasks for document processing.

WHY:
- Long-running document processing
- Parse, chunk, embed documents
- Process in background
- Queue management

HOW:
- Celery async tasks
- Process after KB finalized
- Chain tasks together
- Update status in database

PSEUDOCODE follows the existing codebase patterns.
"""

from celery import shared_task
from uuid import UUID
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.services.document_processing_service import document_processing_service
from app.services.chunking_service import chunking_service
from app.services.indexing_service import indexing_service


@shared_task(bind=True, name="process_document")
def process_document_task(self, document_id: str, kb_id: str):
    """
    Process single document: chunk and index.

    WHY: Async document processing
    HOW: Chain parsing, chunking, indexing

    FLOW:
    1. Parse document (extract text)
    2. Chunk document (split into pieces)
    3. Generate embeddings
    4. Index in vector store
    5. Update status

    ARGS:
        document_id: Document UUID
        kb_id: Knowledge base UUID

    RETURNS:
        {
            "document_id": "uuid",
            "chunks_created": 42,
            "status": "indexed"
        }
    """

    db = SessionLocal()

    try:
        from app.models.document import Document
        from app.models.knowledge_base import KnowledgeBase

        # Get document
        document = db.query(Document).get(UUID(document_id))
        if not document:
            raise ValueError(f"Document not found: {document_id}")

        # Get KB
        kb = db.query(KnowledgeBase).get(UUID(kb_id))
        if not kb:
            raise ValueError(f"KB not found: {kb_id}")

        # Update status
        document.status = "processing"
        db.commit()

        # Get chunking config from KB
        chunking_config = kb.config.get("chunking_config", {})
        chunk_size = chunking_config.get("chunk_size", 1000)
        chunk_overlap = chunking_config.get("chunk_overlap", 200)
        strategy = chunking_config.get("strategy", "recursive")

        # Step 1: Chunk document
        chunk_ids = chunking_service.create_chunks_for_document(
            db=db,
            document_id=UUID(document_id),
            strategy=strategy,
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap
        )

        # Step 2: Index chunks (generate embeddings)
        embedding_model = kb.config.get("embedding_model", "text-embedding-ada-002")

        # Run async indexing (this is actually sync in this context)
        import asyncio
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

        result = loop.run_until_complete(
            indexing_service.index_document(
                db=db,
                document_id=UUID(document_id),
                embedding_model=embedding_model,
                batch_size=10
            )
        )

        loop.close()

        # Update document status
        document.status = "indexed"
        db.commit()

        return {
            "document_id": document_id,
            "chunks_created": len(chunk_ids),
            "chunks_indexed": result["chunks_indexed"],
            "status": "indexed"
        }

    except Exception as e:
        # Update document with error
        try:
            document = db.query(Document).get(UUID(document_id))
            if document:
                document.status = "error"
                document.metadata = {
                    **document.metadata,
                    "error": str(e)
                }
                db.commit()
        except:
            pass

        raise

    finally:
        db.close()


@shared_task(bind=True, name="process_kb_documents")
def process_kb_documents_task(self, kb_id: str):
    """
    Process all documents in KB.

    WHY: Batch process after KB creation
    HOW: Queue document tasks

    ARGS:
        kb_id: Knowledge base UUID

    RETURNS:
        {
            "kb_id": "uuid",
            "documents_queued": 10
        }
    """

    db = SessionLocal()

    try:
        from app.models.document import Document

        # Get all documents for KB
        documents = db.query(Document).filter(
            Document.kb_id == UUID(kb_id),
            Document.status == "pending"
        ).all()

        # Queue each document for processing
        for document in documents:
            process_document_task.delay(
                document_id=str(document.id),
                kb_id=kb_id
            )

        return {
            "kb_id": kb_id,
            "documents_queued": len(documents)
        }

    finally:
        db.close()


@shared_task(bind=True, name="reindex_document")
def reindex_document_task(self, document_id: str):
    """
    Re-index existing document.

    WHY: Update embeddings after changes
    HOW: Delete old, create new

    ARGS:
        document_id: Document UUID
    """

    db = SessionLocal()

    try:
        from app.models.document import Document

        # Get document
        document = db.query(Document).get(UUID(document_id))
        if not document:
            raise ValueError(f"Document not found: {document_id}")

        # Delete from vector store
        import asyncio
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

        loop.run_until_complete(
            indexing_service.delete_document_from_index(
                db=db,
                document_id=UUID(document_id)
            )
        )

        # Delete existing chunks
        from app.models.chunk import Chunk
        db.query(Chunk).filter(
            Chunk.document_id == UUID(document_id)
        ).delete()
        db.commit()

        loop.close()

        # Re-process document
        process_document_task.delay(
            document_id=document_id,
            kb_id=str(document.kb_id)
        )

        return {
            "document_id": document_id,
            "status": "reindexing"
        }

    finally:
        db.close()


@shared_task(bind=True, name="delete_document")
def delete_document_task(self, document_id: str):
    """
    Delete document and cleanup.

    WHY: Remove document from KB
    HOW: Delete chunks, vectors, then document

    ARGS:
        document_id: Document UUID
    """

    db = SessionLocal()

    try:
        from app.models.document import Document
        from app.models.chunk import Chunk

        # Get document
        document = db.query(Document).get(UUID(document_id))
        if not document:
            return {"status": "not_found"}

        # Delete from vector store
        import asyncio
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

        loop.run_until_complete(
            indexing_service.delete_document_from_index(
                db=db,
                document_id=UUID(document_id)
            )
        )

        loop.close()

        # Delete chunks
        db.query(Chunk).filter(
            Chunk.document_id == UUID(document_id)
        ).delete()

        # Delete document
        db.delete(document)
        db.commit()

        return {
            "document_id": document_id,
            "status": "deleted"
        }

    finally:
        db.close()
