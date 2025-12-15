"""
Qdrant Service - Self-hosted vector database for KB retrieval.

WHY:
- Privacy-focused vector storage (self-hosted)
- High-performance similarity search
- Metadata filtering support
- Easy Docker deployment

HOW:
- Uses Qdrant client library
- Creates collections per knowledge base
- Stores vectors with metadata
- Supports filtered search

KEY FEATURES:
- Self-hosted via Docker
- HNSW indexing for fast search
- Cosine similarity
- Metadata filtering
- Batch operations
- Collection management

PERFORMANCE:
- Search latency: ~10-50ms for <100k vectors
- Batch upsert: ~500-1000 vectors/second
- Memory: ~4GB for 100k vectors (384 dims)
"""

from typing import List, Optional, Dict, Any
from uuid import UUID
from pydantic import BaseModel, Field
from qdrant_client import QdrantClient, models
from qdrant_client.http.exceptions import UnexpectedResponse
import os


class QdrantConfig(BaseModel):
    """Configuration for Qdrant client"""

    url: str = Field(
        default="http://qdrant:6333",
        description="Qdrant server URL"
    )
    api_key: Optional[str] = Field(
        default=None,
        description="API key for authentication (optional)"
    )
    timeout: int = Field(
        default=30,
        description="Request timeout in seconds"
    )


class QdrantChunk(BaseModel):
    """Chunk data for Qdrant"""

    id: str  # Chunk UUID as string
    embedding: List[float]
    content: str
    metadata: Dict[str, Any] = Field(default_factory=dict)


class SearchResult(BaseModel):
    """Search result from Qdrant"""

    id: str  # Chunk ID
    score: float  # Similarity score (0-1)
    content: str
    metadata: Dict[str, Any]


class QdrantService:
    """
    Self-hosted vector database service using Qdrant.

    PRIVACY: All data stored locally in Docker container.
    PERFORMANCE: ~10-50ms search latency for <100k vectors.
    COST: Free (self-hosted).

    Architecture:
    - One collection per knowledge base (kb_{kb_id})
    - HNSW index for fast similarity search
    - Cosine similarity metric
    - Metadata stored alongside vectors

    Collection Naming:
    - kb_{kb_id} (e.g., kb_123e4567-e89b-12d3-a456-426614174000)
    """

    def __init__(self, config: Optional[QdrantConfig] = None):
        """
        Initialize Qdrant service.

        Args:
            config: Qdrant configuration (optional)
        """
        # Use config or load from environment
        if config:
            self.config = config
        else:
            qdrant_url = os.getenv("QDRANT_URL", "http://qdrant:6333")
            qdrant_api_key = os.getenv("QDRANT_API_KEY")
            self.config = QdrantConfig(url=qdrant_url, api_key=qdrant_api_key)

        # Initialize client
        self.client = QdrantClient(
            url=self.config.url,
            api_key=self.config.api_key,
            timeout=self.config.timeout
        )

        print(f"[QdrantService] Connected to Qdrant at {self.config.url}")

    def _get_collection_name(self, kb_id: UUID) -> str:
        """Get collection name for a knowledge base"""
        return f"kb_{str(kb_id).replace('-', '_')}"

    async def create_kb_collection(
        self,
        kb_id: UUID,
        vector_size: int = 384,
        distance_metric: str = "Cosine"
    ) -> bool:
        """
        Create a collection for a knowledge base.

        Args:
            kb_id: Knowledge base UUID
            vector_size: Embedding dimension (default 384 for all-MiniLM-L6-v2)
            distance_metric: Distance metric (Cosine, Dot, Euclid)

        Returns:
            bool: True if created successfully

        Raises:
            Exception: If creation fails
        """

        collection_name = self._get_collection_name(kb_id)

        try:
            # Check if collection already exists
            collections = self.client.get_collections().collections
            if any(c.name == collection_name for c in collections):
                print(f"[QdrantService] Collection {collection_name} already exists")
                return True

            # Create collection
            self.client.create_collection(
                collection_name=collection_name,
                vectors_config=models.VectorParams(
                    size=vector_size,
                    distance=getattr(models.Distance, distance_metric.upper())
                ),
                # Optimize for search speed
                hnsw_config=models.HnswConfigDiff(
                    m=16,  # Number of connections per node
                    ef_construct=100,  # Construction accuracy
                ),
                # Enable metadata indexing for filtering
                optimizers_config=models.OptimizersConfigDiff(
                    indexing_threshold=10000,  # Start indexing after 10k vectors
                )
            )

            print(f"[QdrantService] Created collection: {collection_name}")
            print(f"[QdrantService] Vector size: {vector_size}, Distance: {distance_metric}")

            return True

        except Exception as e:
            print(f"[QdrantService] Error creating collection {collection_name}: {e}")
            raise

    async def delete_kb_collection(self, kb_id: UUID) -> bool:
        """
        Delete a knowledge base collection.

        Args:
            kb_id: Knowledge base UUID

        Returns:
            bool: True if deleted successfully
        """

        collection_name = self._get_collection_name(kb_id)

        try:
            self.client.delete_collection(collection_name=collection_name)
            print(f"[QdrantService] Deleted collection: {collection_name}")
            return True

        except UnexpectedResponse as e:
            if e.status_code == 404:
                print(f"[QdrantService] Collection {collection_name} not found (already deleted)")
                return True
            raise

        except Exception as e:
            print(f"[QdrantService] Error deleting collection {collection_name}: {e}")
            raise

    async def upsert_chunks(
        self,
        kb_id: UUID,
        chunks: List[QdrantChunk],
        batch_size: int = 100
    ) -> int:
        """
        Upsert chunks to a knowledge base collection.

        Args:
            kb_id: Knowledge base UUID
            chunks: List of chunks to upsert
            batch_size: Batch size for upsert (default 100)

        Returns:
            int: Number of chunks upserted

        Raises:
            Exception: If upsert fails
        """

        if not chunks:
            return 0

        collection_name = self._get_collection_name(kb_id)

        try:
            # Prepare points for Qdrant
            points = []
            for chunk in chunks:
                # Store content and metadata in payload
                payload = {
                    "content": chunk.content,
                    **chunk.metadata  # Spread metadata
                }

                point = models.PointStruct(
                    id=chunk.id,
                    vector=chunk.embedding,
                    payload=payload
                )
                points.append(point)

            # Batch upsert
            total_upserted = 0
            for i in range(0, len(points), batch_size):
                batch = points[i:i + batch_size]

                self.client.upsert(
                    collection_name=collection_name,
                    points=batch,
                    wait=True  # Wait for indexing
                )

                total_upserted += len(batch)
                print(f"[QdrantService] Upserted batch {i // batch_size + 1}: {len(batch)} chunks")

            print(f"[QdrantService] Total upserted: {total_upserted} chunks to {collection_name}")
            return total_upserted

        except Exception as e:
            print(f"[QdrantService] Error upserting chunks to {collection_name}: {e}")
            raise

    async def search(
        self,
        kb_id: UUID,
        query_embedding: List[float],
        top_k: int = 5,
        score_threshold: Optional[float] = None,
        filters: Optional[Dict[str, Any]] = None
    ) -> List[SearchResult]:
        """
        Search for similar chunks in a knowledge base.

        Args:
            kb_id: Knowledge base UUID
            query_embedding: Query vector
            top_k: Number of results to return
            score_threshold: Minimum similarity score (0-1)
            filters: Metadata filters (Qdrant filter format)

        Returns:
            List of SearchResult objects

        Example filters:
            {
                "document_id": {"$eq": "uuid"},
                "page_number": {"$gte": 1, "$lte": 10}
            }
        """

        collection_name = self._get_collection_name(kb_id)

        try:
            # Build filter (if provided)
            qdrant_filter = None
            if filters:
                qdrant_filter = self._build_filter(filters)

            # Search using the new Qdrant API
            search_results = self.client.query_points(
                collection_name=collection_name,
                query=query_embedding,
                limit=top_k,
                score_threshold=score_threshold,
                query_filter=qdrant_filter,
                with_payload=True,
                with_vectors=False  # Don't return vectors (save bandwidth)
            ).points

            # Convert to SearchResult objects
            results = []
            for hit in search_results:
                results.append(SearchResult(
                    id=str(hit.id),
                    score=hit.score,
                    content=hit.payload.get("content", ""),
                    metadata={k: v for k, v in hit.payload.items() if k != "content"}
                ))

            print(f"[QdrantService] Search returned {len(results)} results from {collection_name}")
            return results

        except Exception as e:
            print(f"[QdrantService] Error searching {collection_name}: {e}")
            raise

    def _build_filter(self, filters: Dict[str, Any]) -> models.Filter:
        """
        Build Qdrant filter from dict.

        Simple implementation - can be extended for complex filters.
        """

        must_conditions = []

        for field, condition in filters.items():
            if isinstance(condition, dict):
                # Handle operators like $eq, $gte, $lte
                for operator, value in condition.items():
                    if operator == "$eq":
                        must_conditions.append(
                            models.FieldCondition(
                                key=field,
                                match=models.MatchValue(value=value)
                            )
                        )
                    elif operator == "$gte":
                        must_conditions.append(
                            models.FieldCondition(
                                key=field,
                                range=models.Range(gte=value)
                            )
                        )
                    elif operator == "$lte":
                        must_conditions.append(
                            models.FieldCondition(
                                key=field,
                                range=models.Range(lte=value)
                            )
                        )
            else:
                # Direct equality
                must_conditions.append(
                    models.FieldCondition(
                        key=field,
                        match=models.MatchValue(value=condition)
                    )
                )

        return models.Filter(must=must_conditions) if must_conditions else None

    async def delete_chunks(
        self,
        kb_id: UUID,
        chunk_ids: List[str]
    ) -> int:
        """
        Delete chunks from a knowledge base collection.

        Args:
            kb_id: Knowledge base UUID
            chunk_ids: List of chunk IDs to delete

        Returns:
            int: Number of chunks deleted
        """

        if not chunk_ids:
            return 0

        collection_name = self._get_collection_name(kb_id)

        try:
            self.client.delete(
                collection_name=collection_name,
                points_selector=models.PointIdsList(points=chunk_ids),
                wait=True
            )

            print(f"[QdrantService] Deleted {len(chunk_ids)} chunks from {collection_name}")
            return len(chunk_ids)

        except Exception as e:
            print(f"[QdrantService] Error deleting chunks from {collection_name}: {e}")
            raise

    async def check_collection_exists(self, kb_id: UUID) -> bool:
        """
        Check if a collection exists for a knowledge base.

        Args:
            kb_id: Knowledge base UUID

        Returns:
            True if collection exists, False otherwise
        """
        collection_name = self._get_collection_name(kb_id)

        try:
            self.client.get_collection(collection_name=collection_name)
            return True
        except UnexpectedResponse as e:
            if e.status_code == 404:
                return False
            raise
        except Exception as e:
            print(f"[QdrantService] Error checking collection {collection_name}: {e}")
            return False

    async def get_collection_stats(self, kb_id: UUID) -> Dict[str, Any]:
        """
        Get statistics about a knowledge base collection.

        Args:
            kb_id: Knowledge base UUID

        Returns:
            Dict with collection statistics
        """
        collection_name = self._get_collection_name(kb_id)

        try:
            info = self.client.get_collection(collection_name=collection_name)

            return {
                "vectors_count": info.points_count,  # Points are the vectors
                "points_count": info.points_count,
                "segments_count": info.segments_count,
                "status": info.status
            }
        except Exception as e:
            print(f"[QdrantService] Error getting collection stats for {collection_name}: {e}")
            raise

    async def get_collection_info(self, kb_id: UUID) -> Optional[Dict[str, Any]]:
        """
        Get information about a knowledge base collection.

        Args:
            kb_id: Knowledge base UUID

        Returns:
            Dict with collection info or None if not found
        """

        collection_name = self._get_collection_name(kb_id)

        try:
            info = self.client.get_collection(collection_name=collection_name)

            return {
                "name": collection_name,
                "vectors_count": info.points_count,  # Points are the vectors
                "points_count": info.points_count,
                "segments_count": info.segments_count,
                "status": info.status,
                "optimizer_status": info.optimizer_status,
                "config": {
                    "vector_size": info.config.params.vectors.size,
                    "distance": info.config.params.vectors.distance.name
                }
            }

        except UnexpectedResponse as e:
            if e.status_code == 404:
                return None
            raise

        except Exception as e:
            print(f"[QdrantService] Error getting collection info for {collection_name}: {e}")
            raise


# Global instance (singleton pattern)
qdrant_service = QdrantService()
