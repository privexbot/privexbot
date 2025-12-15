"""
Indexing Service - Generate embeddings and index chunks in vector store.

WHY:
- Convert chunks to embeddings for semantic search
- Store embeddings in vector database
- Enable fast similarity search
- Support batch processing

HOW:
- Generate embeddings using embedding_service
- Store in vector store (Pinecone, Qdrant, etc.)
- Handle batch operations efficiently
- Track indexing status

PSEUDOCODE follows the existing codebase patterns.
"""

from uuid import UUID
from typing import List, Optional

from sqlalchemy.orm import Session

from app.services.embedding_service import embedding_service
from app.services.vector_store_service import vector_store_service


class IndexingService:
    """
    Chunk embedding and vector store indexing.

    WHY: Enable semantic search over knowledge bases
    HOW: Generate embeddings, store in vector DB
    """

    def __init__(self):
        """
        Initialize indexing service.

        WHY: Load dependencies
        HOW: Use global service instances
        """
        self.embedding_service = embedding_service
        self.vector_store_service = vector_store_service


    async def index_chunk(
        self,
        db: Session,
        chunk_id: UUID,
        kb_id: UUID,
        embedding_model: str = "text-embedding-ada-002"
    ) -> dict:
        """
        Generate embedding and index single chunk.

        WHY: Index individual chunk
        HOW: Generate embedding, store in vector DB

        ARGS:
            db: Database session
            chunk_id: Chunk to index
            kb_id: Knowledge base ID
            embedding_model: Model to use for embedding

        RETURNS:
            {
                "chunk_id": "uuid",
                "embedding_id": "vector_id",
                "dimensions": 1536
            }
        """

        from app.models.chunk import Chunk

        # Get chunk
        chunk = db.query(Chunk).get(chunk_id)
        if not chunk:
            raise ValueError("Chunk not found")

        # Generate embedding
        embedding = await self.embedding_service.generate_embedding(
            text=chunk.content,
            model=embedding_model
        )

        # Store in vector database
        collection_name = f"kb_{kb_id}"
        vector_id = await self.vector_store_service.upsert(
            collection_name=collection_name,
            vectors=[{
                "id": str(chunk_id),
                "values": embedding,
                "metadata": {
                    "chunk_id": str(chunk_id),
                    "document_id": str(chunk.document_id),
                    "kb_id": str(kb_id),
                    "content_preview": chunk.content[:200]
                }
            }]
        )

        # Update chunk with embedding status
        chunk.embedding = embedding  # Store embedding if column exists
        chunk.metadata = {
            **chunk.metadata,
            "indexed": True,
            "embedding_model": embedding_model,
            "dimensions": len(embedding)
        }

        db.commit()

        return {
            "chunk_id": str(chunk_id),
            "embedding_id": vector_id,
            "dimensions": len(embedding)
        }


    async def index_document(
        self,
        db: Session,
        document_id: UUID,
        embedding_model: str = "text-embedding-ada-002",
        batch_size: int = 10
    ) -> dict:
        """
        Index all chunks for a document.

        WHY: Index entire document at once
        HOW: Batch process all chunks

        ARGS:
            db: Database session
            document_id: Document to index
            embedding_model: Model to use
            batch_size: Chunks per batch

        RETURNS:
            {
                "document_id": "uuid",
                "chunks_indexed": 42,
                "success": True
            }
        """

        from app.models.document import Document
        from app.models.chunk import Chunk

        # Get document
        document = db.query(Document).get(document_id)
        if not document:
            raise ValueError("Document not found")

        # Get all chunks
        chunks = db.query(Chunk).filter(
            Chunk.document_id == document_id
        ).all()

        # Process in batches
        total_indexed = 0
        for i in range(0, len(chunks), batch_size):
            batch = chunks[i:i + batch_size]

            await self._index_chunk_batch(
                db=db,
                chunks=batch,
                kb_id=document.kb_id,
                embedding_model=embedding_model
            )

            total_indexed += len(batch)

        # Update document status
        document.status = "indexed"
        db.commit()

        return {
            "document_id": str(document_id),
            "chunks_indexed": total_indexed,
            "success": True
        }


    async def _index_chunk_batch(
        self,
        db: Session,
        chunks: List,
        kb_id: UUID,
        embedding_model: str
    ):
        """
        Index batch of chunks.

        WHY: Efficient batch processing
        HOW: Generate embeddings in batch, bulk upsert
        """

        # Generate embeddings for batch
        texts = [chunk.content for chunk in chunks]
        embeddings = await self.embedding_service.generate_embeddings_batch(
            texts=texts,
            model=embedding_model
        )

        # Prepare vectors for upsert
        vectors = []
        for chunk, embedding in zip(chunks, embeddings):
            vectors.append({
                "id": str(chunk.id),
                "values": embedding,
                "metadata": {
                    "chunk_id": str(chunk.id),
                    "document_id": str(chunk.document_id),
                    "kb_id": str(kb_id),
                    "content_preview": chunk.content[:200]
                }
            })

        # Bulk upsert to vector store
        collection_name = f"kb_{kb_id}"
        await self.vector_store_service.upsert(
            collection_name=collection_name,
            vectors=vectors
        )

        # Update chunks
        for chunk, embedding in zip(chunks, embeddings):
            chunk.metadata = {
                **chunk.metadata,
                "indexed": True,
                "embedding_model": embedding_model,
                "dimensions": len(embedding)
            }

        db.commit()


    async def index_knowledge_base(
        self,
        db: Session,
        kb_id: UUID,
        embedding_model: Optional[str] = None,
        batch_size: int = 10
    ) -> dict:
        """
        Index entire knowledge base.

        WHY: Index all documents in KB
        HOW: Process all documents sequentially

        ARGS:
            db: Database session
            kb_id: Knowledge base ID
            embedding_model: Model to use (or use KB config)
            batch_size: Chunks per batch

        RETURNS:
            {
                "kb_id": "uuid",
                "documents_indexed": 10,
                "chunks_indexed": 420,
                "success": True
            }
        """

        from app.models.knowledge_base import KnowledgeBase
        from app.models.document import Document

        # Get KB
        kb = db.query(KnowledgeBase).get(kb_id)
        if not kb:
            raise ValueError("Knowledge base not found")

        # Get embedding model from config or use provided
        if not embedding_model:
            embedding_model = kb.config.get("embedding_model", "text-embedding-ada-002")

        # Create collection in vector store
        collection_name = f"kb_{kb_id}"
        dimensions = 1536  # Default for OpenAI ada-002

        await self.vector_store_service.create_collection(
            collection_name=collection_name,
            dimensions=dimensions
        )

        # Get all documents
        documents = db.query(Document).filter(
            Document.kb_id == kb_id,
            Document.status != "indexed"
        ).all()

        # Index each document
        total_chunks = 0
        for document in documents:
            result = await self.index_document(
                db=db,
                document_id=document.id,
                embedding_model=embedding_model,
                batch_size=batch_size
            )
            total_chunks += result["chunks_indexed"]

        # Update KB status
        kb.status = "ready"
        db.commit()

        return {
            "kb_id": str(kb_id),
            "documents_indexed": len(documents),
            "chunks_indexed": total_chunks,
            "success": True
        }


    async def delete_document_from_index(
        self,
        db: Session,
        document_id: UUID
    ):
        """
        Remove document chunks from vector store.

        WHY: Delete indexed document
        HOW: Delete all chunk vectors
        """

        from app.models.document import Document
        from app.models.chunk import Chunk

        # Get document
        document = db.query(Document).get(document_id)
        if not document:
            raise ValueError("Document not found")

        # Get all chunk IDs
        chunks = db.query(Chunk).filter(
            Chunk.document_id == document_id
        ).all()

        chunk_ids = [str(chunk.id) for chunk in chunks]

        # Delete from vector store
        collection_name = f"kb_{document.kb_id}"
        await self.vector_store_service.delete(
            collection_name=collection_name,
            ids=chunk_ids
        )


# Global instance
indexing_service = IndexingService()
