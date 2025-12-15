"""
Retrieval Service - Vector search with annotation boosting.

WHY:
- Retrieve relevant context from knowledge bases (RAG)
- Support multiple search methods (vector, keyword, hybrid)
- Boost annotated chunks for better accuracy
- Handle multiple KBs in single query

HOW:
- Query vector store with embeddings
- Apply annotation boosting
- Combine results from multiple sources
- Return ranked chunks with metadata

PSEUDOCODE follows the existing codebase patterns.
"""

from uuid import UUID
from typing import Optional, List

from sqlalchemy.orm import Session

from app.services.embedding_service import embedding_service
from app.services.vector_store_service import vector_store_service


class RetrievalService:
    """
    Vector search and retrieval for RAG.

    WHY: Retrieve relevant context from knowledge bases
    HOW: Embedding-based search with annotation boosting
    """

    def __init__(self):
        """
        Initialize retrieval service.

        WHY: Load dependencies
        HOW: Use global service instances
        """
        self.embedding_service = embedding_service
        self.vector_store_service = vector_store_service


    async def search(
        self,
        db: Session,
        kb_id: UUID,
        query: str,
        top_k: int = 5,
        search_method: str = "hybrid",
        threshold: float = 0.7,
        apply_annotation_boost: bool = True,
        context_filter: str = None  # NEW: Filter by context (chatbot, chatflow, both)
    ) -> List[dict]:
        """
        Search knowledge base for relevant chunks.

        WHY: RAG - find relevant context for AI response
        HOW: Embed query, search vector store, boost annotations

        ARGS:
            db: Database session
            kb_id: Knowledge base ID
            query: User's search query
            top_k: Number of results to return
            search_method: "vector" | "keyword" | "hybrid"
            threshold: Minimum similarity score (0.0 - 1.0)
            apply_annotation_boost: Whether to boost annotated chunks

        RETURNS:
            [
                {
                    "chunk_id": "uuid",
                    "document_id": "uuid",
                    "document_name": "FAQ.pdf",
                    "content": "Chunk text...",
                    "score": 0.85,
                    "page": 12,
                    "annotations": {...},  # If annotated
                    "boosted": True  # If annotation boost applied
                }
            ]
        """

        from app.models.knowledge_base import KnowledgeBase

        # Get KB
        kb = db.query(KnowledgeBase).get(kb_id)
        if not kb:
            raise ValueError("Knowledge base not found")

        # Generate query embedding
        query_embedding = await self.embedding_service.generate_embedding(
            text=query,
            model=kb.config.get("embedding_model", "text-embedding-ada-002")
        )

        # Search vector store
        if search_method == "vector":
            results = await self._vector_search(
                db=db,
                kb_id=kb_id,
                query_embedding=query_embedding,
                top_k=top_k * 2 if apply_annotation_boost else top_k,  # Get more for boosting
                threshold=threshold
            )

        elif search_method == "keyword":
            results = await self._keyword_search(
                db=db,
                kb_id=kb_id,
                query=query,
                top_k=top_k * 2 if apply_annotation_boost else top_k
            )

        else:  # hybrid
            results = await self._hybrid_search(
                db=db,
                kb_id=kb_id,
                query=query,
                query_embedding=query_embedding,
                top_k=top_k * 2 if apply_annotation_boost else top_k,
                threshold=threshold
            )

        # Apply annotation boosting
        if apply_annotation_boost:
            results = self._apply_annotation_boost(results)

        # Re-rank and limit
        results = sorted(results, key=lambda x: x["score"], reverse=True)[:top_k]

        # Filter by threshold
        results = [r for r in results if r["score"] >= threshold]

        return results


    async def _vector_search(
        self,
        db: Session,
        kb_id: UUID,
        query_embedding: List[float],
        top_k: int,
        threshold: float
    ) -> List[dict]:
        """
        Pure vector similarity search.

        WHY: Semantic search using embeddings
        HOW: Query vector store with embedding
        """

        # Search vector store
        vector_results = await self.vector_store_service.search(
            collection_name=f"kb_{kb_id}",
            query_vector=query_embedding,
            top_k=top_k,
            filter=None
        )

        # Enrich with metadata
        results = []
        for result in vector_results:
            chunk = self._get_chunk_metadata(db, result["id"])
            if chunk:
                results.append({
                    "chunk_id": result["id"],
                    "document_id": chunk.document_id,
                    "document_name": chunk.document.name if chunk.document else "Unknown",
                    "content": chunk.content,
                    "score": result["score"],
                    "page": chunk.metadata.get("page"),
                    "annotations": chunk.annotations,
                    "boosted": False
                })

        return results


    async def _keyword_search(
        self,
        db: Session,
        kb_id: UUID,
        query: str,
        top_k: int
    ) -> List[dict]:
        """
        Keyword-based search (full-text search).

        WHY: Find exact matches
        HOW: PostgreSQL full-text search on chunk content
        """

        from app.models.chunk import Chunk
        from sqlalchemy import func

        # Full-text search using PostgreSQL
        chunks = db.query(Chunk).filter(
            Chunk.kb_id == kb_id,
            func.to_tsvector('english', Chunk.content).match(query)
        ).limit(top_k).all()

        results = []
        for chunk in chunks:
            results.append({
                "chunk_id": str(chunk.id),
                "document_id": str(chunk.document_id),
                "document_name": chunk.document.name if chunk.document else "Unknown",
                "content": chunk.content,
                "score": 0.8,  # Fixed score for keyword matches
                "page": chunk.metadata.get("page"),
                "annotations": chunk.annotations,
                "boosted": False
            })

        return results


    async def _hybrid_search(
        self,
        db: Session,
        kb_id: UUID,
        query: str,
        query_embedding: List[float],
        top_k: int,
        threshold: float
    ) -> List[dict]:
        """
        Hybrid search (vector + keyword).

        WHY: Best of both worlds - semantic + exact matches
        HOW: Combine vector and keyword results with weighted scores
        """

        # Get vector results
        vector_results = await self._vector_search(
            db=db,
            kb_id=kb_id,
            query_embedding=query_embedding,
            top_k=top_k,
            threshold=threshold * 0.8  # Lower threshold for hybrid
        )

        # Get keyword results
        keyword_results = await self._keyword_search(
            db=db,
            kb_id=kb_id,
            query=query,
            top_k=top_k
        )

        # Combine results (weighted fusion)
        combined = {}
        vector_weight = 0.7
        keyword_weight = 0.3

        for result in vector_results:
            chunk_id = result["chunk_id"]
            combined[chunk_id] = result.copy()
            combined[chunk_id]["score"] = result["score"] * vector_weight

        for result in keyword_results:
            chunk_id = result["chunk_id"]
            if chunk_id in combined:
                # Boost score if appears in both
                combined[chunk_id]["score"] += result["score"] * keyword_weight
            else:
                combined[chunk_id] = result.copy()
                combined[chunk_id]["score"] = result["score"] * keyword_weight

        return list(combined.values())


    def _apply_annotation_boost(self, results: List[dict]) -> List[dict]:
        """
        Boost chunks with AI annotations.

        WHY: Annotated chunks are higher quality
        HOW: Multiply score by annotation boost factor

        ANNOTATION BOOST:
        - If chunk has annotations: score *= 1.2
        - If chunk has high importance: score *= 1.5
        """

        for result in results:
            annotations = result.get("annotations")

            if annotations:
                # Base boost for having annotations
                result["score"] *= 1.2
                result["boosted"] = True

                # Additional boost for importance
                importance = annotations.get("importance", "medium")
                if importance == "high":
                    result["score"] *= 1.25
                elif importance == "critical":
                    result["score"] *= 1.5

        return results


    def _get_chunk_metadata(self, db: Session, chunk_id: str):
        """Get chunk with metadata from database."""

        from app.models.chunk import Chunk

        chunk = db.query(Chunk).filter(Chunk.id == UUID(chunk_id)).first()
        return chunk


    async def search_multiple_kbs(
        self,
        db: Session,
        kb_ids: List[UUID],
        query: str,
        top_k: int = 5,
        search_method: str = "hybrid"
    ) -> List[dict]:
        """
        Search across multiple knowledge bases.

        WHY: Chatbots can use multiple KBs
        HOW: Search each KB, combine and re-rank results

        ARGS:
            db: Database session
            kb_ids: List of knowledge base IDs
            query: Search query
            top_k: Total results to return (distributed across KBs)
            search_method: Search method to use

        RETURNS:
            Combined results from all KBs
        """

        all_results = []
        per_kb_top_k = max(top_k // len(kb_ids), 3)  # Distribute evenly

        for kb_id in kb_ids:
            try:
                results = await self.search(
                    db=db,
                    kb_id=kb_id,
                    query=query,
                    top_k=per_kb_top_k,
                    search_method=search_method
                )
                all_results.extend(results)
            except Exception as e:
                # Log error but continue with other KBs
                print(f"Error searching KB {kb_id}: {e}")

        # Re-rank and limit
        all_results = sorted(all_results, key=lambda x: x["score"], reverse=True)[:top_k]

        return all_results


# Global instance
retrieval_service = RetrievalService()
