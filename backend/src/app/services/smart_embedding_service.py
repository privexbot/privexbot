"""
Smart Embedding Service - Multi-level embedding strategy for optimal retrieval.

WHY:
- Small documents: Single embedding preserves full context
- Medium documents: Both document + chunk embeddings for best of both worlds
- Large documents: Chunk-only to avoid overwhelming embeddings
- Optimized for chatbot (precise answers) vs chatflow (contextual reasoning)

HOW:
- Analyze content size and determine embedding approach
- Store both document-level and chunk-level embeddings
- Route search queries to appropriate embedding level
- Self-hosted using existing embedding_service_local.py
"""

from typing import List, Dict, Optional
from uuid import UUID
from sqlalchemy.orm import Session
from app.services.embedding_service_local import embedding_service
from app.services.chunking_service import chunking_service
from app.services.qdrant_service import qdrant_service, QdrantChunk
from app.models.document import Document
from app.models.chunk import Chunk
import hashlib
import json


class SmartEmbeddingService:
    """
    Multi-level embedding strategy that combines:
    1. Document-level embeddings (full context)
    2. Chunk-level embeddings (precise retrieval)
    3. Intelligent routing based on query type and content size
    """

    def determine_embedding_strategy(self, content: str, bot_type: str = "chatbot") -> str:
        """
        Determine optimal embedding strategy based on content size and bot type.

        Args:
            content: Document content to analyze
            bot_type: "chatbot" (precise answers) or "chatflow" (contextual reasoning)

        Returns:
            "single_only": Only document-level embedding
            "hierarchical": Both document + chunk embeddings
            "chunks_only": Only chunk-level embeddings
        """
        content_size = len(content)

        # Adjust thresholds based on bot type
        if bot_type == "chatbot":
            # Chatbots prefer smaller, more precise chunks
            small_threshold = 1500
            medium_threshold = 15000
        else:  # chatflow
            # Chatflows benefit from more context
            small_threshold = 2500
            medium_threshold = 25000

        if content_size < small_threshold:
            return "single_only"      # Preserve full context
        elif content_size < medium_threshold:
            return "hierarchical"     # Best of both worlds
        else:
            return "chunks_only"      # Avoid overwhelming single embedding

    async def embed_document_smart(
        self,
        document: Document,
        content: str,
        kb_config: Dict,
        bot_type: str = "chatbot"
    ) -> Dict:
        """
        Intelligently embed document using multi-level strategy.

        Returns:
            {
                "strategy": "hierarchical",
                "document_embedding": [...],  # Optional
                "chunks": [ChunkData...],
                "total_chunks": 15,
                "qdrant_points": [QdrantChunk...]
            }
        """

        strategy = self.determine_embedding_strategy(content, bot_type)

        result = {
            "strategy": strategy,
            "document_embedding": None,
            "chunks": [],
            "qdrant_points": []
        }

        # STEP 1: Document-level embedding (if needed)
        if strategy in ["single_only", "hierarchical"]:
            # Create document summary for embedding (if content is long)
            if len(content) > 8000:  # Embedding model limit
                doc_summary = self._create_document_summary(content)
            else:
                doc_summary = content

            doc_embedding = await embedding_service.generate_embeddings([doc_summary])
            result["document_embedding"] = doc_embedding[0] if doc_embedding else None

            # Store document-level embedding in Qdrant with special metadata
            if result["document_embedding"]:
                doc_chunk = QdrantChunk(
                    id=f"doc_{document.id}",  # Special ID for document-level
                    embedding=result["document_embedding"],
                    content=doc_summary,
                    metadata={
                        "type": "document",           # Mark as document-level
                        "document_id": str(document.id),
                        "kb_id": str(document.kb_id),
                        "workspace_id": str(document.workspace_id),
                        "page_url": document.source_url,
                        "is_full_document": True
                    }
                )
                result["qdrant_points"].append(doc_chunk)

        # STEP 2: Chunk-level embeddings (if needed)
        if strategy in ["hierarchical", "chunks_only"]:

            # Determine chunking config based on bot type and strategy
            chunk_config = self._get_chunking_config(strategy, bot_type, kb_config)

            # Create chunks
            chunks_data = chunking_service.chunk_document(
                text=content,
                strategy=chunk_config["strategy"],
                chunk_size=chunk_config["chunk_size"],
                chunk_overlap=chunk_config["chunk_overlap"]
            )

            if chunks_data:
                # Generate embeddings for chunks
                chunk_texts = [chunk["content"] for chunk in chunks_data]
                chunk_embeddings = await embedding_service.generate_embeddings(chunk_texts)

                # Create chunk records and Qdrant points
                for idx, (chunk_data, embedding) in enumerate(zip(chunks_data, chunk_embeddings)):

                    # PostgreSQL Chunk record
                    chunk_record = {
                        "document_id": document.id,
                        "kb_id": document.kb_id,
                        "content": chunk_data["content"],
                        "chunk_index": idx,
                        "position": idx,
                        "embedding": embedding,
                        "chunk_metadata": {
                            "strategy": strategy,
                            "embedding_approach": chunk_config["strategy"],
                            "token_count": chunk_data.get("token_count", 0),
                            "bot_type": bot_type
                        }
                    }
                    result["chunks"].append(chunk_record)

                    # Qdrant point
                    qdrant_chunk = QdrantChunk(
                        id=f"chunk_{document.id}_{idx}",
                        embedding=embedding,
                        content=chunk_data["content"],
                        metadata={
                            "type": "chunk",              # Mark as chunk-level
                            "document_id": str(document.id),
                            "kb_id": str(document.kb_id),
                            "workspace_id": str(document.workspace_id),
                            "chunk_index": idx,
                            "page_url": document.source_url,
                            "strategy": strategy,
                            "is_full_document": False
                        }
                    )
                    result["qdrant_points"].append(qdrant_chunk)

        result["total_chunks"] = len(result["chunks"])
        return result

    def _get_chunking_config(self, strategy: str, bot_type: str, kb_config: Dict) -> Dict:
        """Get optimal chunking configuration based on strategy and bot type."""

        base_configs = {
            "chatbot": {
                "strategy": "semantic",
                "chunk_size": 800,
                "chunk_overlap": 200
            },
            "chatflow": {
                "strategy": "by_heading",
                "chunk_size": 1500,
                "chunk_overlap": 400
            }
        }

        config = base_configs[bot_type].copy()

        # Adjust based on embedding strategy
        if strategy == "hierarchical":
            # Smaller chunks since we also have document-level context
            config["chunk_size"] = int(config["chunk_size"] * 0.8)
            config["chunk_overlap"] = int(config["chunk_overlap"] * 0.6)
        elif strategy == "chunks_only":
            # Larger chunks to compensate for no document-level embedding
            config["chunk_size"] = int(config["chunk_size"] * 1.3)
            config["chunk_overlap"] = int(config["chunk_overlap"] * 1.2)

        # Override with user configuration if provided
        config.update(kb_config.get("chunking_config", {}))

        return config

    def _create_document_summary(self, content: str, max_length: int = 6000) -> str:
        """
        Create a summary of the document for document-level embedding.

        For very large documents, we need a representative summary rather than
        trying to embed the entire content.
        """

        if len(content) <= max_length:
            return content

        # Simple extractive summarization
        # Take first paragraph + key headings + last paragraph
        paragraphs = content.split('\n\n')

        summary_parts = []

        # First paragraph (usually intro/title)
        if paragraphs:
            summary_parts.append(paragraphs[0])

        # Extract headings (lines starting with # or short lines in caps)
        headings = []
        for para in paragraphs[1:-1]:
            lines = para.split('\n')
            for line in lines:
                if (line.strip().startswith('#') or
                    (len(line) < 100 and line.strip().isupper()) or
                    (len(line) < 80 and ':' in line)):
                    headings.append(line.strip())

        # Add key headings
        if headings:
            summary_parts.append("Key sections: " + " | ".join(headings[:10]))

        # Last paragraph (usually conclusion)
        if len(paragraphs) > 1:
            summary_parts.append(paragraphs[-1])

        summary = "\n\n".join(summary_parts)

        # Truncate if still too long
        if len(summary) > max_length:
            summary = summary[:max_length] + "..."

        return summary

    async def smart_search(
        self,
        kb_id: UUID,
        workspace_id: UUID,
        query: str,
        bot_type: str = "chatbot",
        top_k: int = 5
    ) -> List[Dict]:
        """
        Intelligent search that queries appropriate embedding levels.

        Strategy:
        1. Try document-level search first (broader context)
        2. Fall back to chunk-level search (precise answers)
        3. Combine and rank results
        """

        # Generate query embedding
        query_embedding = await embedding_service.generate_embeddings([query])
        if not query_embedding:
            return []

        # Search both document and chunk levels
        all_results = []

        # 1. Document-level search
        doc_results = await qdrant_service.search(
            kb_id=kb_id,
            query_embedding=query_embedding[0],
            top_k=top_k,
            filters={"type": "document", "workspace_id": str(workspace_id)}
        )

        for result in doc_results:
            result.metadata["search_level"] = "document"
            result.metadata["relevance_boost"] = 1.2  # Boost document-level results
            all_results.append(result)

        # 2. Chunk-level search
        chunk_results = await qdrant_service.search(
            kb_id=kb_id,
            query_embedding=query_embedding[0],
            top_k=top_k * 2,  # Get more chunks to compensate
            filters={"type": "chunk", "workspace_id": str(workspace_id)}
        )

        for result in chunk_results:
            result.metadata["search_level"] = "chunk"
            result.metadata["relevance_boost"] = 1.0
            all_results.append(result)

        # 3. Deduplicate and rank
        return self._deduplicate_and_rank_results(all_results, top_k)

    def _deduplicate_and_rank_results(self, results: List, top_k: int) -> List:
        """Remove duplicate documents and rank by boosted score."""

        # Group by document_id to avoid duplicates
        doc_groups = {}
        for result in results:
            doc_id = result.metadata.get("document_id")

            if doc_id not in doc_groups:
                doc_groups[doc_id] = []
            doc_groups[doc_id].append(result)

        # Select best result per document
        final_results = []
        for doc_id, group in doc_groups.items():
            # Sort by boosted score
            group.sort(key=lambda x: x.score * x.metadata.get("relevance_boost", 1.0), reverse=True)
            final_results.append(group[0])  # Take best result for this document

        # Final ranking and limit
        final_results.sort(key=lambda x: x.score * x.metadata.get("relevance_boost", 1.0), reverse=True)

        return final_results[:top_k]


# Global instance
smart_embedding_service = SmartEmbeddingService()