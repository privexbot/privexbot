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

import os
import threading
from typing import List, Optional, Dict, Any
from uuid import UUID
from pydantic import BaseModel, Field
from qdrant_client import QdrantClient, models
from qdrant_client.http.exceptions import UnexpectedResponse


class _ResilientQdrantClient:
    """
    Thin wrapper around qdrant_client.QdrantClient that recovers from a
    closed underlying httpx client.

    The sync QdrantClient is a long-lived singleton inside the Celery worker.
    After a Qdrant restart or a long idle, its httpx.Client can transition
    to ClientState.CLOSED, after which every call raises
    'Cannot send a request, as the client has been closed.' until the worker
    is restarted.

    This wrapper intercepts method calls, and on detection of that exact error
    rebuilds the underlying client once and retries. Generic connection errors
    (ConnectError, RemoteProtocolError, etc.) are NOT retried here — they
    deserve a different policy (backoff) and propagate as-is.
    """

    def __init__(self, factory):
        self._factory = factory
        self._client = factory()
        self._lock = threading.Lock()

    def _reconnect(self) -> None:
        # Best-effort close; ignore errors from already-broken state.
        try:
            self._client.close()
        except Exception:
            pass
        self._client = self._factory()

    def __getattr__(self, name):
        attr = getattr(self._client, name)
        if not callable(attr):
            return attr

        def wrapped(*args, **kwargs):
            try:
                return attr(*args, **kwargs)
            except Exception as e:
                if "client has been closed" in str(e).lower():
                    with self._lock:
                        self._reconnect()
                        return getattr(self._client, name)(*args, **kwargs)
                raise

        return wrapped


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

        # Initialize client through a resilient wrapper so the long-lived
        # singleton can self-heal after a Qdrant restart (see
        # _ResilientQdrantClient docstring above).
        cfg = self.config

        def _make_client() -> QdrantClient:
            return QdrantClient(
                url=cfg.url,
                api_key=cfg.api_key,
                timeout=cfg.timeout,
            )

        self.client = _ResilientQdrantClient(_make_client)

        print(f"[QdrantService] Connected to Qdrant at {self.config.url}")

    def _get_collection_name(self, kb_id: UUID) -> str:
        """Get collection name for a knowledge base"""
        return f"kb_{str(kb_id).replace('-', '_')}"

    async def create_kb_collection(
        self,
        kb_id: UUID,
        vector_size: int = 384,
        distance_metric: str = "Cosine",
        hnsw_m: int = 16,
        ef_construct: int = 100
    ) -> bool:
        """
        Create a collection for a knowledge base.

        Args:
            kb_id: Knowledge base UUID
            vector_size: Embedding dimension (default 384 for all-MiniLM-L6-v2)
            distance_metric: Distance metric (Cosine, Dot, Euclid)
            hnsw_m: HNSW M parameter - connections per node (default 16, higher = better recall, more memory)
            ef_construct: HNSW ef_construct - construction accuracy (default 100)

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

            # Create collection with user-configurable HNSW parameters
            self.client.create_collection(
                collection_name=collection_name,
                vectors_config=models.VectorParams(
                    size=vector_size,
                    distance=getattr(models.Distance, distance_metric.upper())
                ),
                # Optimize for search speed with configurable parameters
                hnsw_config=models.HnswConfigDiff(
                    m=hnsw_m,  # Number of connections per node (user configurable)
                    ef_construct=ef_construct,  # Construction accuracy
                ),
                # Enable metadata indexing for filtering
                optimizers_config=models.OptimizersConfigDiff(
                    indexing_threshold=10000,  # Start indexing after 10k vectors
                )
            )

            print(f"[QdrantService] Created collection: {collection_name}")
            print(f"[QdrantService] Vector size: {vector_size}, Distance: {distance_metric}, HNSW M: {hnsw_m}")

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

    async def search_with_context(
        self,
        kb_id: UUID,
        query_embedding: List[float],
        context: str,
        top_k: int = 5,
        score_threshold: Optional[float] = None,
        additional_filters: Optional[Dict[str, Any]] = None
    ) -> List[SearchResult]:
        """
        Search with context filtering (chatbot, chatflow, or both).

        WHY: Chatbots and chatflows need different retrieval strategies
        HOW: Filter by kb_context in Qdrant payload

        CRITICAL: This is the primary search method for production use

        Args:
            kb_id: Knowledge base UUID
            query_embedding: Query vector
            context: "chatbot", "chatflow", or "both"
            top_k: Number of results to return
            score_threshold: Minimum similarity score (0-1)
            additional_filters: Additional metadata filters

        Returns:
            List of SearchResult objects filtered by context

        Context Filtering:
            - "chatbot": Returns only chunks with kb_context = "chatbot" or "both"
            - "chatflow": Returns only chunks with kb_context = "chatflow" or "both"
            - "both": Returns all chunks (no context filtering)

        Example:
            # Search for chatbot use
            results = await qdrant_service.search_with_context(
                kb_id=kb_id,
                query_embedding=embedding,
                context="chatbot",
                top_k=3,
                score_threshold=0.75
            )
        """

        collection_name = self._get_collection_name(kb_id)

        try:
            # Build context filter
            must_conditions = []

            # CRITICAL: Context filtering
            if context in ["chatbot", "chatflow"]:
                # Match kb_context = {context} OR kb_context = "both"
                must_conditions.append({
                    "key": "kb_context",
                    "match": {"any": [context, "both"]}
                })
                print(f"[QdrantService] Filtering by context: {context} or 'both'")
            else:
                print(f"[QdrantService] No context filtering (context={context})")

            # Add additional filters
            if additional_filters:
                for field, condition in additional_filters.items():
                    if isinstance(condition, dict):
                        for operator, value in condition.items():
                            if operator == "$eq":
                                must_conditions.append({
                                    "key": field,
                                    "match": {"value": value}
                                })
                            elif operator == "$in":
                                must_conditions.append({
                                    "key": field,
                                    "match": {"any": value}
                                })
                            elif operator == "$gte":
                                must_conditions.append({
                                    "key": field,
                                    "range": {"gte": value}
                                })
                            elif operator == "$lte":
                                must_conditions.append({
                                    "key": field,
                                    "range": {"lte": value}
                                })
                    else:
                        # Direct equality
                        must_conditions.append({
                            "key": field,
                            "match": {"value": condition}
                        })

            # Build Qdrant filter
            qdrant_filter = None
            if must_conditions:
                # Convert our filter format to Qdrant's models
                qdrant_conditions = []
                for cond in must_conditions:
                    if "match" in cond:
                        if "value" in cond["match"]:
                            qdrant_conditions.append(
                                models.FieldCondition(
                                    key=cond["key"],
                                    match=models.MatchValue(value=cond["match"]["value"])
                                )
                            )
                        elif "any" in cond["match"]:
                            qdrant_conditions.append(
                                models.FieldCondition(
                                    key=cond["key"],
                                    match=models.MatchAny(any=cond["match"]["any"])
                                )
                            )
                    elif "range" in cond:
                        range_params = {}
                        if "gte" in cond["range"]:
                            range_params["gte"] = cond["range"]["gte"]
                        if "lte" in cond["range"]:
                            range_params["lte"] = cond["range"]["lte"]
                        qdrant_conditions.append(
                            models.FieldCondition(
                                key=cond["key"],
                                range=models.Range(**range_params)
                            )
                        )

                qdrant_filter = models.Filter(must=qdrant_conditions)

            # Search with context filter
            search_results = self.client.query_points(
                collection_name=collection_name,
                query=query_embedding,
                limit=top_k,
                score_threshold=score_threshold,
                query_filter=qdrant_filter,
                with_payload=True,
                with_vectors=False
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

            print(f"[QdrantService] Context-filtered search returned {len(results)} results")
            return results

        except Exception as e:
            print(f"[QdrantService] Error in context search {collection_name}: {e}")
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

    async def text_search(
        self,
        kb_id: UUID,
        query_text: str,
        top_k: int = 5,
        field: str = "content"
    ) -> List[SearchResult]:
        """
        Full-text search on payload content using Qdrant's MatchText.

        WHY: Enable keyword search for Option A (Qdrant-only storage)
        HOW: Use Qdrant's scroll with MatchText filter

        IMPORTANT: This is NOT vector similarity search - it's text matching.
        Results are not ranked by relevance, just filtered by text match.

        Args:
            kb_id: Knowledge base UUID
            query_text: Text to search for (supports basic keyword matching)
            top_k: Maximum number of results to return
            field: Payload field to search in (default: "content")

        Returns:
            List of SearchResult objects matching the query text

        Limitations:
            - No relevance ranking (all matches have score=0.8)
            - Case-insensitive substring matching
            - For better keyword search, consider creating a text index
        """

        collection_name = self._get_collection_name(kb_id)

        try:
            # Build text match filter
            # MatchText does case-insensitive substring matching
            text_filter = models.Filter(
                must=[
                    models.FieldCondition(
                        key=field,
                        match=models.MatchText(text=query_text)
                    )
                ]
            )

            # Use scroll to get matching points (since we're filtering, not vector searching)
            scroll_result = self.client.scroll(
                collection_name=collection_name,
                scroll_filter=text_filter,
                limit=top_k,
                with_payload=True,
                with_vectors=False
            )

            # Convert to SearchResult objects
            results = []
            points = scroll_result[0]  # scroll returns (points, next_page_offset)

            for point in points:
                results.append(SearchResult(
                    id=str(point.id),
                    score=0.8,  # Fixed score for text matches (no ranking)
                    content=point.payload.get("content", ""),
                    metadata={k: v for k, v in point.payload.items() if k != "content"}
                ))

            print(f"[QdrantService] Text search returned {len(results)} results for query '{query_text[:50]}...'")
            return results

        except Exception as e:
            print(f"[QdrantService] Error in text search {collection_name}: {e}")
            # Return empty list instead of raising - graceful degradation
            return []

    async def hybrid_text_vector_search(
        self,
        kb_id: UUID,
        query_text: str,
        query_embedding: List[float],
        top_k: int = 5,
        score_threshold: Optional[float] = None,
        vector_weight: float = 0.7,
        text_weight: float = 0.3
    ) -> List[SearchResult]:
        """
        Hybrid search combining vector similarity AND text matching.

        WHY: Best of both worlds for Option A storage
        HOW: Vector search + text search, then weighted score fusion

        Args:
            kb_id: Knowledge base UUID
            query_text: Text query for keyword matching
            query_embedding: Query vector for similarity search
            top_k: Number of results to return
            score_threshold: Minimum vector similarity score
            vector_weight: Weight for vector search results (default 0.7)
            text_weight: Weight for text search results (default 0.3)

        Returns:
            List of SearchResult objects with combined scores
        """

        # Get vector results
        vector_results = await self.search(
            kb_id=kb_id,
            query_embedding=query_embedding,
            top_k=top_k * 2,  # Get more for fusion
            score_threshold=score_threshold
        )

        # Get text results
        text_results = await self.text_search(
            kb_id=kb_id,
            query_text=query_text,
            top_k=top_k * 2
        )

        # Combine results with weighted scores
        combined = {}

        for result in vector_results:
            combined[result.id] = SearchResult(
                id=result.id,
                score=result.score * vector_weight,
                content=result.content,
                metadata=result.metadata
            )

        for result in text_results:
            if result.id in combined:
                # Boost score if appears in both
                combined[result.id].score += result.score * text_weight
            else:
                combined[result.id] = SearchResult(
                    id=result.id,
                    score=result.score * text_weight,
                    content=result.content,
                    metadata=result.metadata
                )

        # Sort by score and limit
        sorted_results = sorted(combined.values(), key=lambda x: x.score, reverse=True)[:top_k]

        print(f"[QdrantService] Hybrid text+vector search returned {len(sorted_results)} results")
        return sorted_results


# Global instance (singleton pattern)
qdrant_service = QdrantService()
