"""
Document Processing Tasks - Celery tasks for individual document processing.

WHY:
- Handle manual document creation and updates
- Process documents outside of web scraping pipeline
- Support CRUD operations with proper chunk/embedding management

HOW:
- Celery async tasks for background processing
- Chunk → Embed → Index pipeline
- Handle reprocessing with cleanup
- Sync with Qdrant vector store

This file implements document-level processing for:
1. Creating new documents (POST /kbs/{kb_id}/documents)
2. Updating documents with content changes (PUT /kbs/{kb_id}/documents/{doc_id})
"""

from celery import shared_task
from uuid import UUID
from sqlalchemy.orm import Session
from typing import Dict, Any, List
from datetime import datetime
import asyncio
import traceback

from app.db.session import SessionLocal
from app.services.chunking_service import chunking_service
from app.services.enhanced_chunking_service import enhanced_chunking_service, EnhancedChunkConfig
from app.services.embedding_service_local import embedding_service
from app.services.qdrant_service import qdrant_service, QdrantChunk
from app.models.document import Document
from app.models.chunk import Chunk
from app.models.knowledge_base import KnowledgeBase


@shared_task(bind=True, name="process_document")
def process_document_task(
    self,
    document_id: str,
    content: str,
    kb_config: Dict[str, Any]
):
    """
    Process a single document: Chunk → Embed → Index.

    FLOW:
    1. Get document and KB from database
    2. Chunk the content using KB's chunking config
    3. Generate embeddings for chunks
    4. Create Chunk records in PostgreSQL
    5. Index chunks in Qdrant
    6. Update document status to "completed"

    Args:
        document_id: Document UUID string
        content: Raw document content (markdown/text)
        kb_config: KB configuration dict with chunking_config, embedding_config

    Returns:
        {
            "document_id": str,
            "chunks_created": int,
            "status": "completed"
        }

    Raises:
        ValueError: If document or KB not found
        Exception: On processing errors (updates document status to "failed")
    """

    db = SessionLocal()
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    try:
        print(f"[DEBUG] Starting process_document_task for document {document_id}")

        # ========================================
        # STEP 1: GET DOCUMENT AND KB
        # ========================================

        document = db.query(Document).filter(Document.id == UUID(document_id)).first()
        if not document:
            raise ValueError(f"Document not found: {document_id}")

        kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == document.kb_id).first()
        if not kb:
            raise ValueError(f"KB not found: {document.kb_id}")

        # Update status to processing
        document.status = "processing"
        document.processing_progress = 10
        db.commit()

        print(f"[DEBUG] Document {document_id} status updated to processing")

        # ========================================
        # STEP 2: EXTRACT CHUNKING CONFIG (INHERIT FROM KB)
        # ========================================

        chunking_config = kb_config.get("chunking_config", {})
        chunk_strategy = chunking_config.get("strategy", "recursive")
        chunk_size = chunking_config.get("chunk_size", 1000)
        chunk_overlap = chunking_config.get("chunk_overlap", 200)

        # CRITICAL: Inherit enable_enhanced_metadata from user's KB config
        enable_enhanced_metadata = chunking_config.get("enable_enhanced_metadata", False)

        # CRITICAL: Inherit preserve_code_blocks from user's KB config (default: True)
        preserve_code_blocks = chunking_config.get("preserve_code_blocks", True)

        print(f"[DEBUG] Chunking config: strategy={chunk_strategy}, size={chunk_size}, overlap={chunk_overlap}, enhanced_metadata={enable_enhanced_metadata}, preserve_code_blocks={preserve_code_blocks}")

        # Validate content
        if not content or len(content.strip()) < 50:
            raise ValueError("Content too short (minimum 50 characters)")

        # ========================================
        # STEP 3: CHUNK CONTENT (RESPECTS USER CONFIG)
        # ========================================

        document.processing_progress = 20
        db.commit()

        # CRITICAL: Use enhanced_chunking_service when user enabled enhanced metadata
        # This ensures consistent behavior with initial KB processing via smart_kb_service
        if enable_enhanced_metadata:
            print(f"[DEBUG] Using enhanced_chunking_service with rich metadata")
            enhanced_config = EnhancedChunkConfig(
                strategy=chunk_strategy,
                chunk_size=chunk_size,
                chunk_overlap=chunk_overlap,
                include_context=True,
                include_metadata=True,
                analyze_structure=True
            )
            enhanced_chunks = enhanced_chunking_service.chunk_document_enhanced(content, enhanced_config)
            # Convert to standard format for pipeline compatibility
            chunks_data = [chunk.to_dict() for chunk in enhanced_chunks]
        else:
            # Standard chunking with code block preservation (inherits from user's KB config)
            chunks_data = chunking_service.chunk_document(
                text=content,
                strategy=chunk_strategy,
                chunk_size=chunk_size,
                chunk_overlap=chunk_overlap,
                preserve_code_blocks=preserve_code_blocks
            )

        if not chunks_data:
            raise ValueError("No chunks created from content")

        print(f"[DEBUG] Created {len(chunks_data)} chunks for document {document_id}")

        # ========================================
        # STEP 4: GENERATE EMBEDDINGS
        # ========================================

        document.processing_progress = 40
        db.commit()

        chunk_texts = [chunk["content"] for chunk in chunks_data]

        embeddings = loop.run_until_complete(
            embedding_service.generate_embeddings(chunk_texts)
        )

        print(f"[DEBUG] Generated {len(embeddings)} embeddings for document {document_id}")

        # ========================================
        # STEP 5: CREATE CHUNK RECORDS (WITH ENHANCED METADATA SUPPORT)
        # ========================================

        document.processing_progress = 60
        db.commit()

        qdrant_chunks = []

        for chunk_idx, (chunk_data, embedding) in enumerate(zip(chunks_data, embeddings)):
            chunk_content = chunk_data["content"]
            word_count = len(chunk_content.split())
            character_count = len(chunk_content)

            # Extract enhanced metadata from chunk_data when available
            chunk_metadata_from_data = chunk_data.get("metadata", {})

            # Build PostgreSQL chunk metadata
            postgres_chunk_metadata = {
                "token_count": chunk_data.get("token_count", 0),
                "strategy": chunk_strategy,
                "chunk_size": chunk_size,
                "document_name": document.name,
                "source_type": document.source_type,
                "workspace_id": str(kb.workspace_id)
            }

            # CRITICAL: Include enhanced metadata from user's KB config when enabled
            if enable_enhanced_metadata and chunk_metadata_from_data:
                enhanced_fields = [
                    "context_before", "context_after",
                    "parent_heading", "section_title",
                    "document_analysis", "structure_score"
                ]
                for field in enhanced_fields:
                    if field in chunk_metadata_from_data:
                        postgres_chunk_metadata[field] = chunk_metadata_from_data[field]
                postgres_chunk_metadata["enhanced_metadata_enabled"] = True

            # Create Chunk in PostgreSQL
            chunk = Chunk(
                document_id=document.id,
                kb_id=document.kb_id,
                content=chunk_content,
                chunk_index=chunk_idx,
                position=chunk_idx,
                embedding=embedding,  # pgvector field
                word_count=word_count,
                character_count=character_count,
                chunk_metadata=postgres_chunk_metadata,
                created_at=datetime.utcnow()
            )
            db.add(chunk)
            db.flush()  # Get chunk.id

            # Build Qdrant metadata
            qdrant_metadata = {
                "document_id": str(document.id),
                "kb_id": str(document.kb_id),
                "workspace_id": str(kb.workspace_id),
                "kb_context": kb.context,  # Enable context-based filtering
                "chunk_index": chunk_idx,
                "document_name": document.name,
                "source_type": document.source_type,
                "source_url": document.source_url or "",
                "token_count": chunk_data.get("token_count", 0),
                "word_count": word_count,
                "character_count": character_count,
                "chunking_strategy": chunk_strategy,
                "storage_location": "postgresql_and_qdrant"
            }

            # CRITICAL: Include enhanced metadata in Qdrant when user enabled it
            if enable_enhanced_metadata and chunk_metadata_from_data:
                if "context_before" in chunk_metadata_from_data:
                    qdrant_metadata["context_before"] = chunk_metadata_from_data["context_before"]
                if "context_after" in chunk_metadata_from_data:
                    qdrant_metadata["context_after"] = chunk_metadata_from_data["context_after"]
                if "parent_heading" in chunk_metadata_from_data:
                    qdrant_metadata["parent_heading"] = chunk_metadata_from_data["parent_heading"]
                if "section_title" in chunk_metadata_from_data:
                    qdrant_metadata["section_title"] = chunk_metadata_from_data["section_title"]
                qdrant_metadata["enhanced_metadata_enabled"] = True

            # Prepare for Qdrant
            qdrant_chunks.append(
                QdrantChunk(
                    id=str(chunk.id),
                    embedding=embedding,
                    content=chunk_content,
                    metadata=qdrant_metadata
                )
            )

        db.commit()
        print(f"[DEBUG] Created {len(qdrant_chunks)} chunk records in PostgreSQL")

        # ========================================
        # STEP 6: INDEX IN QDRANT
        # ========================================

        document.processing_progress = 80
        db.commit()

        try:
            loop.run_until_complete(
                qdrant_service.upsert_chunks(
                    kb_id=document.kb_id,
                    chunks=qdrant_chunks
                )
            )
            print(f"[DEBUG] Indexed {len(qdrant_chunks)} chunks in Qdrant")
        except Exception as qdrant_error:
            print(f"[ERROR] Qdrant indexing failed: {str(qdrant_error)}")
            print(f"[ERROR] Traceback:\n{traceback.format_exc()}")
            raise

        # ========================================
        # STEP 7: UPDATE DOCUMENT STATUS
        # ========================================

        document.status = "completed"
        document.processing_progress = 100
        document.chunk_count = len(chunks_data)
        document.error_message = None
        db.commit()

        print(f"[DEBUG] Document {document_id} processing completed successfully")

        return {
            "document_id": document_id,
            "chunks_created": len(chunks_data),
            "chunks_indexed": len(qdrant_chunks),
            "status": "completed"
        }

    except Exception as e:
        # Update document with error
        print(f"[ERROR] Document processing failed: {str(e)}")
        print(f"[ERROR] Traceback:\n{traceback.format_exc()}")

        try:
            document = db.query(Document).filter(Document.id == UUID(document_id)).first()
            if document:
                document.status = "failed"
                document.processing_progress = 0
                document.error_message = str(e)
                db.commit()
        except Exception as update_error:
            print(f"[ERROR] Failed to update document status: {str(update_error)}")

        raise

    finally:
        loop.close()
        db.close()


@shared_task(bind=True, name="reprocess_document")
def reprocess_document_task(
    self,
    document_id: str,
    new_content: str,
    kb_config: Dict[str, Any]
):
    """
    Reprocess document with new content: Delete old chunks → Re-chunk → Re-embed → Re-index.

    CRITICAL: Qdrant-first deletion strategy
    - Delete from Qdrant FIRST (external system)
    - Then delete from PostgreSQL
    - This allows retry if Qdrant deletion fails

    FLOW:
    1. Get document and KB
    2. Delete old chunks from Qdrant (FIRST)
    3. Delete old chunks from PostgreSQL
    4. Call process_document_task to recreate chunks

    Args:
        document_id: Document UUID string
        new_content: Updated document content
        kb_config: KB configuration dict

    Returns:
        {
            "document_id": str,
            "old_chunks_deleted": int,
            "status": "reprocessing"
        }

    Raises:
        ValueError: If document not found
        Exception: On Qdrant deletion failure (marks document for retry)
    """

    db = SessionLocal()
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    try:
        print(f"[DEBUG] Starting reprocess_document_task for document {document_id}")

        # ========================================
        # STEP 1: GET DOCUMENT AND KB
        # ========================================

        document = db.query(Document).filter(Document.id == UUID(document_id)).first()
        if not document:
            raise ValueError(f"Document not found: {document_id}")

        kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == document.kb_id).first()
        if not kb:
            raise ValueError(f"KB not found: {document.kb_id}")

        # Update status
        document.status = "reprocessing"
        document.processing_progress = 5
        db.commit()

        # ========================================
        # STEP 2: GET OLD CHUNKS COUNT
        # ========================================

        old_chunks = db.query(Chunk).filter(Chunk.document_id == UUID(document_id)).all()
        old_chunk_count = len(old_chunks)
        old_chunk_ids = [str(chunk.id) for chunk in old_chunks]

        print(f"[DEBUG] Found {old_chunk_count} old chunks to delete")

        # ========================================
        # STEP 3: DELETE FROM QDRANT FIRST
        # ========================================

        document.processing_progress = 10
        db.commit()

        try:
            if old_chunk_ids:
                print(f"[DEBUG] Deleting {len(old_chunk_ids)} chunks from Qdrant")

                loop.run_until_complete(
                    qdrant_service.delete_chunks(
                        kb_id=document.kb_id,
                        chunk_ids=old_chunk_ids
                    )
                )

                print(f"[DEBUG] Successfully deleted chunks from Qdrant")

        except Exception as qdrant_error:
            # CRITICAL: Qdrant deletion failed - mark for retry
            print(f"[ERROR] Qdrant deletion failed: {str(qdrant_error)}")
            print(f"[ERROR] Traceback:\n{traceback.format_exc()}")

            document.status = "pending_deletion"
            document.error_message = f"Qdrant sync failed during reprocessing: {str(qdrant_error)}"
            db.commit()

            raise Exception(
                f"Failed to delete old chunks from Qdrant. Document marked for retry. Error: {str(qdrant_error)}"
            )

        # ========================================
        # STEP 4: DELETE FROM POSTGRESQL
        # ========================================

        document.processing_progress = 20
        db.commit()

        # Safe to delete from PostgreSQL now that Qdrant succeeded
        db.query(Chunk).filter(Chunk.document_id == UUID(document_id)).delete()
        db.commit()

        print(f"[DEBUG] Deleted {old_chunk_count} old chunks from PostgreSQL")

        # ========================================
        # STEP 5: CALL PROCESS TASK FOR NEW CONTENT
        # ========================================

        document.processing_progress = 30
        db.commit()

        print(f"[DEBUG] Queuing process_document_task for new content")

        # Queue processing task (will run in background)
        process_document_task.apply_async(
            kwargs={
                "document_id": document_id,
                "content": new_content,
                "kb_config": kb_config
            },
            queue="default"
        )

        return {
            "document_id": document_id,
            "old_chunks_deleted": old_chunk_count,
            "status": "reprocessing",
            "message": "Old chunks deleted, new processing queued"
        }

    except Exception as e:
        print(f"[ERROR] Document reprocessing failed: {str(e)}")
        print(f"[ERROR] Traceback:\n{traceback.format_exc()}")

        # Update document with error (if not already set as pending_deletion)
        try:
            document = db.query(Document).filter(Document.id == UUID(document_id)).first()
            if document and document.status != "pending_deletion":
                document.status = "failed"
                document.error_message = f"Reprocessing failed: {str(e)}"
                db.commit()
        except Exception as update_error:
            print(f"[ERROR] Failed to update document status: {str(update_error)}")

        raise

    finally:
        loop.close()
        db.close()


@shared_task(bind=True, name="process_file_upload_document")
def process_file_upload_document_task(
    self,
    document_id: str,
    content: str,
    kb_config: Dict[str, Any],
    chunking_config: Dict[str, Any] = None,
    embedding_config: Dict[str, Any] = None,
    skip_postgres_chunks: bool = True  # Default True for file uploads
):
    """
    Process a file upload document with Qdrant-only storage.

    CRITICAL: This task follows the file upload storage pattern:
    - Chunks are stored ONLY in Qdrant (not PostgreSQL)
    - PostgreSQL stores only metadata
    - Inherits KB configuration for chunking/embedding

    FLOW:
    1. Get document and KB from database
    2. Chunk content using KB's chunking config
    3. Generate embeddings using KB's embedding config
    4. Store chunks ONLY in Qdrant (skip PostgreSQL chunks)
    5. Update document status with processing metadata

    Args:
        document_id: Document UUID string
        content: Raw document content (from approved_sources)
        kb_config: KB configuration dict
        chunking_config: Chunking configuration (inherited from KB)
        embedding_config: Embedding configuration (inherited from KB)
        skip_postgres_chunks: If True, skip PostgreSQL chunk storage (default: True)

    Returns:
        {
            "document_id": str,
            "chunks_created": int,
            "storage_location": "qdrant_only" | "postgresql_and_qdrant",
            "status": "completed"
        }
    """

    db = SessionLocal()
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    try:
        print(f"[DEBUG] Starting process_file_upload_document_task for document {document_id}")
        print(f"[DEBUG] skip_postgres_chunks={skip_postgres_chunks}")

        # ========================================
        # STEP 1: GET DOCUMENT AND KB
        # ========================================

        document = db.query(Document).filter(Document.id == UUID(document_id)).first()
        if not document:
            raise ValueError(f"Document not found: {document_id}")

        kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == document.kb_id).first()
        if not kb:
            raise ValueError(f"KB not found: {document.kb_id}")

        # Update status to processing
        document.status = "processing"
        document.processing_progress = 10
        db.commit()

        print(f"[DEBUG] Document {document_id} status updated to processing")

        # ========================================
        # STEP 2: EXTRACT CONFIG (INHERIT FROM KB)
        # ========================================

        # Use provided config or fall back to KB config
        _chunking_config = chunking_config or kb_config.get("chunking_config", {})
        _embedding_config = embedding_config or kb.embedding_config or {}

        chunk_strategy = _chunking_config.get("strategy", "recursive")
        chunk_size = _chunking_config.get("chunk_size", 1000)
        chunk_overlap = _chunking_config.get("chunk_overlap", 200)

        # CRITICAL: Inherit enable_enhanced_metadata from user's KB config
        enable_enhanced_metadata = _chunking_config.get("enable_enhanced_metadata", False)

        # CRITICAL: Inherit preserve_code_blocks from user's KB config (default: True)
        preserve_code_blocks = _chunking_config.get("preserve_code_blocks", True)

        print(f"[DEBUG] Chunking config: strategy={chunk_strategy}, size={chunk_size}, overlap={chunk_overlap}, enhanced_metadata={enable_enhanced_metadata}, preserve_code_blocks={preserve_code_blocks}")

        # Validate content
        if not content or len(content.strip()) < 50:
            raise ValueError("Content too short (minimum 50 characters)")

        # ========================================
        # STEP 3: CHUNK CONTENT (RESPECTS USER CONFIG)
        # ========================================

        document.processing_progress = 20
        db.commit()

        # CRITICAL: Use enhanced_chunking_service when user enabled enhanced metadata
        # This ensures consistent behavior with initial KB processing via smart_kb_service
        if enable_enhanced_metadata:
            print(f"[DEBUG] Using enhanced_chunking_service with rich metadata")
            enhanced_config = EnhancedChunkConfig(
                strategy=chunk_strategy,
                chunk_size=chunk_size,
                chunk_overlap=chunk_overlap,
                include_context=True,
                include_metadata=True,
                analyze_structure=True
            )
            enhanced_chunks = enhanced_chunking_service.chunk_document_enhanced(content, enhanced_config)
            # Convert to standard format for pipeline compatibility
            chunks_data = [chunk.to_dict() for chunk in enhanced_chunks]
        else:
            # Standard chunking with code block preservation (inherits from user's KB config)
            chunks_data = chunking_service.chunk_document(
                text=content,
                strategy=chunk_strategy,
                chunk_size=chunk_size,
                chunk_overlap=chunk_overlap,
                preserve_code_blocks=preserve_code_blocks
            )

        if not chunks_data:
            raise ValueError("No chunks created from content")

        print(f"[DEBUG] Created {len(chunks_data)} chunks for document {document_id}")

        # ========================================
        # STEP 4: GENERATE EMBEDDINGS
        # ========================================

        document.processing_progress = 40
        db.commit()

        chunk_texts = [chunk["content"] for chunk in chunks_data]

        embeddings = loop.run_until_complete(
            embedding_service.generate_embeddings(chunk_texts)
        )

        print(f"[DEBUG] Generated {len(embeddings)} embeddings for document {document_id}")

        # ========================================
        # STEP 5: PREPARE QDRANT CHUNKS (WITH ENHANCED METADATA SUPPORT)
        # ========================================

        document.processing_progress = 60
        db.commit()

        qdrant_chunks = []
        postgres_chunks_created = 0

        for chunk_idx, (chunk_data, embedding) in enumerate(zip(chunks_data, embeddings)):
            chunk_content = chunk_data["content"]
            word_count = len(chunk_content.split())
            character_count = len(chunk_content)

            # Extract enhanced metadata from chunk_data when available
            chunk_metadata = chunk_data.get("metadata", {})

            # CRITICAL: Conditionally create PostgreSQL chunks based on skip_postgres_chunks
            if not skip_postgres_chunks:
                # Build PostgreSQL chunk metadata
                postgres_chunk_metadata = {
                    "token_count": chunk_data.get("token_count", 0),
                    "strategy": chunk_strategy,
                    "chunk_size": chunk_size,
                    "document_name": document.name,
                    "source_type": document.source_type,
                    "workspace_id": str(kb.workspace_id)
                }

                # CRITICAL: Include enhanced metadata from user's KB config when enabled
                if enable_enhanced_metadata and chunk_metadata:
                    enhanced_fields = [
                        "context_before", "context_after",
                        "parent_heading", "section_title",
                        "document_analysis", "structure_score"
                    ]
                    for field in enhanced_fields:
                        if field in chunk_metadata:
                            postgres_chunk_metadata[field] = chunk_metadata[field]
                    postgres_chunk_metadata["enhanced_metadata_enabled"] = True

                # Create Chunk in PostgreSQL (only for non-file-upload KBs)
                chunk = Chunk(
                    document_id=document.id,
                    kb_id=document.kb_id,
                    content=chunk_content,
                    chunk_index=chunk_idx,
                    position=chunk_idx,
                    embedding=embedding,  # pgvector field
                    word_count=word_count,
                    character_count=character_count,
                    chunk_metadata=postgres_chunk_metadata,
                    created_at=datetime.utcnow()
                )
                db.add(chunk)
                db.flush()  # Get chunk.id
                chunk_id = str(chunk.id)
                postgres_chunks_created += 1
            else:
                # For file uploads, generate UUID without PostgreSQL storage
                import uuid
                chunk_id = str(uuid.uuid4())

            # Build Qdrant metadata
            qdrant_metadata = {
                "document_id": str(document.id),
                "kb_id": str(document.kb_id),
                "workspace_id": str(kb.workspace_id),
                "kb_context": kb.context,  # Enable context-based filtering
                "chunk_index": chunk_idx,
                "document_name": document.name,
                "source_type": document.source_type,
                "source_url": document.source_url or "",
                "token_count": chunk_data.get("token_count", 0),
                "word_count": word_count,
                "character_count": character_count,
                "chunking_strategy": chunk_strategy,
                "storage_location": "qdrant_only" if skip_postgres_chunks else "postgresql_and_qdrant"
            }

            # CRITICAL: Include enhanced metadata in Qdrant when user enabled it
            if enable_enhanced_metadata and chunk_metadata:
                if "context_before" in chunk_metadata:
                    qdrant_metadata["context_before"] = chunk_metadata["context_before"]
                if "context_after" in chunk_metadata:
                    qdrant_metadata["context_after"] = chunk_metadata["context_after"]
                if "parent_heading" in chunk_metadata:
                    qdrant_metadata["parent_heading"] = chunk_metadata["parent_heading"]
                if "section_title" in chunk_metadata:
                    qdrant_metadata["section_title"] = chunk_metadata["section_title"]
                qdrant_metadata["enhanced_metadata_enabled"] = True

            # Prepare for Qdrant (always)
            qdrant_chunks.append(
                QdrantChunk(
                    id=chunk_id,
                    embedding=embedding,
                    content=chunk_content,
                    metadata=qdrant_metadata
                )
            )

        db.commit()
        storage_location = "qdrant_only" if skip_postgres_chunks else "postgresql_and_qdrant"
        print(f"[DEBUG] Storage: {storage_location}, PostgreSQL chunks: {postgres_chunks_created}, Qdrant chunks: {len(qdrant_chunks)}")

        # ========================================
        # STEP 6: INDEX IN QDRANT
        # ========================================

        document.processing_progress = 80
        db.commit()

        try:
            loop.run_until_complete(
                qdrant_service.upsert_chunks(
                    kb_id=document.kb_id,
                    chunks=qdrant_chunks
                )
            )
            print(f"[DEBUG] Indexed {len(qdrant_chunks)} chunks in Qdrant")
        except Exception as qdrant_error:
            print(f"[ERROR] Qdrant indexing failed: {str(qdrant_error)}")
            print(f"[ERROR] Traceback:\n{traceback.format_exc()}")
            raise

        # ========================================
        # STEP 7: UPDATE DOCUMENT STATUS
        # ========================================

        document.status = "processed"
        document.processing_progress = 100
        document.chunk_count = len(chunks_data)
        document.error_message = None

        # Add processing metadata for frontend display
        document.processing_metadata = {
            "processed_at": datetime.utcnow().isoformat(),
            "chunks_created": len(chunks_data),
            "embeddings_generated": len(embeddings),
            "storage_strategy": "qdrant_only" if skip_postgres_chunks else "dual_storage",
            "chunk_storage_location": storage_location,
            "postgres_chunks_created": postgres_chunks_created,
            "qdrant_chunks_created": len(qdrant_chunks),
            "chunking_strategy": chunk_strategy,
            "chunk_size": chunk_size,
            "chunk_overlap": chunk_overlap,
            # CRITICAL: Record whether enhanced metadata was used (inherited from KB config)
            "enhanced_metadata_enabled": enable_enhanced_metadata,
        }

        db.commit()

        print(f"[DEBUG] Document {document_id} processing completed successfully")

        # Update KB total_chunks (add to existing count)
        kb.total_chunks = (kb.total_chunks or 0) + len(chunks_data)
        db.commit()

        return {
            "document_id": document_id,
            "chunks_created": len(chunks_data),
            "chunks_indexed": len(qdrant_chunks),
            "postgres_chunks": postgres_chunks_created,
            "storage_location": storage_location,
            "status": "completed"
        }

    except Exception as e:
        # Update document with error
        print(f"[ERROR] Document processing failed: {str(e)}")
        print(f"[ERROR] Traceback:\n{traceback.format_exc()}")

        try:
            document = db.query(Document).filter(Document.id == UUID(document_id)).first()
            if document:
                document.status = "failed"
                document.processing_progress = 0
                document.error_message = str(e)
                db.commit()
        except Exception as update_error:
            print(f"[ERROR] Failed to update document status: {str(update_error)}")

        raise

    finally:
        loop.close()
        db.close()