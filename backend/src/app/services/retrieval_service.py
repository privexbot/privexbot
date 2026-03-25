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

CONFIGURATION PRIORITY:
    1. Caller Override (explicit parameter) - highest priority
    2. KB-Level Config (kb.context_settings.retrieval_config)
    3. Service Defaults - lowest priority

STORAGE COMPATIBILITY:
    - Hybrid (web scraping): PostgreSQL + Qdrant, all search methods work
    - Option A (file uploads): Qdrant-only, uses Qdrant text search for keywords

PSEUDOCODE follows the existing codebase patterns.
"""

from uuid import UUID
from typing import Optional, List, Dict, Any

from sqlalchemy.orm import Session

from app.services.embedding_service_local import embedding_service, multi_model_embedding_service
from app.services.qdrant_service import qdrant_service


# Service defaults (lowest priority)
# Note: threshold 0.35 is appropriate for sentence-transformers models
# (all-MiniLM-L6-v2 etc.) which produce scores in 0.3-0.7 range for good matches
SERVICE_DEFAULTS = {
    "top_k": 5,
    "search_method": "hybrid",
    "threshold": 0.35
}

# Validation constraints for retrieval_config
RETRIEVAL_CONFIG_CONSTRAINTS = {
    "top_k": {"min": 1, "max": 100, "type": int},
    "score_threshold": {"min": 0.0, "max": 1.0, "type": float},
    "similarity_threshold": {"min": 0.0, "max": 1.0, "type": float},  # Alias
    "strategy": {
        "allowed": ["semantic_search", "hybrid_search", "keyword_search", "mmr", "similarity_score_threshold"],
        "type": str
    },
    "rerank_enabled": {"type": bool},
    "metadata_filters": {"type": dict}
}

# Strategy name mapping (frontend uses different naming than internal)
STRATEGY_TO_METHOD_MAP = {
    "semantic_search": "vector",
    "hybrid_search": "hybrid",
    "keyword_search": "keyword",
    "mmr": "mmr",  # Maximum Marginal Relevance (diversity-aware search)
    "similarity_score_threshold": "threshold",  # Strict threshold filtering
    # Direct method names (passthrough)
    "vector": "vector",
    "hybrid": "hybrid",
    "keyword": "keyword",
    "threshold": "threshold"
}


class RetrievalService:
    """
    Vector search and retrieval for RAG.

    WHY: Retrieve relevant context from knowledge bases
    HOW: Embedding-based search with annotation boosting

    CONFIG PRIORITY:
    - Caller Override > KB Config > Service Defaults
    """

    def __init__(self):
        """
        Initialize retrieval service.

        WHY: Load dependencies
        HOW: Use global service instances
        """
        self.embedding_service = embedding_service
        self.qdrant_service = qdrant_service

    def validate_retrieval_config(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validate and sanitize retrieval_config values.

        WHY: Prevent invalid configurations from causing errors
        HOW: Check types, ranges, and allowed values; return sanitized config

        ARGS:
            config: Raw retrieval_config from KB or caller

        RETURNS:
            Sanitized config with invalid values corrected to defaults

        VALIDATION RULES:
            - top_k: int, 1-100 (default: 5)
            - score_threshold: float, 0.0-1.0 (default: 0.7)
            - strategy: str, must be in allowed list (default: hybrid_search)
            - rerank_enabled: bool (default: False)
            - metadata_filters: dict (default: {})
        """
        if not config:
            return {}

        validated = {}
        warnings = []

        for key, value in config.items():
            if key not in RETRIEVAL_CONFIG_CONSTRAINTS:
                # Unknown key - pass through (forward compatibility)
                validated[key] = value
                continue

            constraints = RETRIEVAL_CONFIG_CONSTRAINTS[key]
            expected_type = constraints.get("type")

            # Type check
            if expected_type and not isinstance(value, expected_type):
                warnings.append(f"{key}: expected {expected_type.__name__}, got {type(value).__name__}")
                continue  # Skip invalid type

            # Range check for numeric values
            if "min" in constraints and value < constraints["min"]:
                warnings.append(f"{key}: {value} < min {constraints['min']}, using min")
                value = constraints["min"]
            if "max" in constraints and value > constraints["max"]:
                warnings.append(f"{key}: {value} > max {constraints['max']}, using max")
                value = constraints["max"]

            # Allowed values check
            if "allowed" in constraints and value not in constraints["allowed"]:
                warnings.append(f"{key}: '{value}' not in allowed values, using default")
                continue  # Skip invalid value

            validated[key] = value

        if warnings:
            print(f"[RetrievalService] Config validation warnings: {warnings}")

        return validated

    async def _validate_embedding_model(self, kb, query_model: str) -> None:
        """
        Validate embedding model compatibility between query and indexed KB.

        WHY: Dimension mismatch between query and indexed embeddings causes search failure
        HOW: Compare query model dimensions with KB's configured/indexed model dimensions

        ARGS:
            kb: KnowledgeBase model instance
            query_model: Model name being used for query embedding

        LOGS:
            - Warning if query model differs from KB's configured model
            - Error if dimensions don't match (search will fail)
            - Info about the model being used for queries
        """
        # Get KB's configured embedding model
        kb_embedding_config = kb.embedding_config or {}
        kb_model = kb_embedding_config.get("model") or kb_embedding_config.get("model_name", "all-MiniLM-L6-v2")
        kb_dimensions = kb_embedding_config.get("dimensions")

        # Get query model dimensions
        query_dimensions = multi_model_embedding_service.get_embedding_dimension(query_model)

        # Check if models match
        if query_model != kb_model:
            print(f"[RetrievalService] ⚠️  EMBEDDING MODEL WARNING for KB {kb.id}:")
            print(f"  → KB was indexed with: {kb_model}")
            print(f"  → Query using: {query_model}")
            print(f"  → This may cause search quality degradation or dimension mismatch!")

        # Check dimensions if we know the KB's dimensions
        if kb_dimensions and kb_dimensions != query_dimensions:
            print(f"[RetrievalService] 🚨 DIMENSION MISMATCH ERROR for KB {kb.id}:")
            print(f"  → KB indexed dimensions: {kb_dimensions}")
            print(f"  → Query model dimensions: {query_dimensions}")
            print(f"  → Search will FAIL! Reindex KB with correct model or fix embedding config.")
            # Raise error to make the problem obvious instead of silently returning 0 results
            raise ValueError(
                f"Embedding dimension mismatch for KB {kb.id}: "
                f"KB expects {kb_dimensions} dimensions but query model '{query_model}' produces {query_dimensions}. "
                f"Either reindex the KB with '{query_model}' or fix kb.embedding_config to match the indexed model."
            )
        else:
            print(f"[RetrievalService] ✓ Embedding model: {query_model} (dimensions: {query_dimensions})")

    def _is_qdrant_only_storage(self, kb) -> bool:
        """
        Check if KB uses Qdrant-only storage (Option A).

        WHY: Different search strategies for different storage types
        HOW: Check KB stats.storage_type or fall back to checking if chunks exist

        ARGS:
            kb: KnowledgeBase model instance

        RETURNS:
            True if KB uses Qdrant-only storage (no PostgreSQL chunks)
        """
        # Check explicit storage_type in stats
        if kb.stats:
            storage_type = kb.stats.get("storage_type")
            if storage_type:
                return storage_type == "qdrant_only"

        # Fall back: If total_chunks is 0 but total_vectors > 0, it's Qdrant-only
        if kb.stats:
            total_chunks = kb.stats.get("total_chunks", 0)
            total_vectors = kb.stats.get("total_vectors", 0)
            if total_vectors > 0 and total_chunks == 0:
                return True

        # Default: assume hybrid storage
        return False

    def _map_strategy_to_method(self, strategy: str) -> str:
        """
        Map frontend strategy names to internal search methods.

        WHY: Frontend uses different naming convention (semantic_search vs vector)
        HOW: Lookup table with fallback to hybrid

        ARGS:
            strategy: Frontend strategy name (e.g., "semantic_search", "hybrid_search")

        RETURNS:
            Internal search method (e.g., "vector", "hybrid", "keyword")
        """
        return STRATEGY_TO_METHOD_MAP.get(strategy, "hybrid")

    def _get_effective_config(
        self,
        kb_retrieval_config: Dict[str, Any],
        caller_top_k: Optional[int],
        caller_search_method: Optional[str],
        caller_threshold: Optional[float]
    ) -> Dict[str, Any]:
        """
        Compute effective configuration using priority chain.

        PRIORITY: Caller Override > KB Config > Service Defaults

        ARGS:
            kb_retrieval_config: KB-level retrieval_config from context_settings
            caller_top_k: Caller-specified top_k (None = use KB config)
            caller_search_method: Caller-specified method (None = use KB config)
            caller_threshold: Caller-specified threshold (None = use KB config)

        RETURNS:
            {
                "top_k": int,
                "search_method": str,
                "threshold": float,
                "config_source": str  # For debugging: "caller" | "kb_config" | "default"
            }
        """
        config_sources = {}

        # Validate KB config before using
        validated_kb_config = self.validate_retrieval_config(kb_retrieval_config)

        # Top K (use validated config)
        if caller_top_k is not None:
            effective_top_k = caller_top_k
            config_sources["top_k"] = "caller"
        elif validated_kb_config.get("top_k") is not None:
            effective_top_k = validated_kb_config["top_k"]
            config_sources["top_k"] = "kb_config"
        else:
            effective_top_k = SERVICE_DEFAULTS["top_k"]
            config_sources["top_k"] = "default"

        # Search Method (requires strategy mapping, use validated config)
        if caller_search_method is not None:
            effective_search_method = self._map_strategy_to_method(caller_search_method)
            config_sources["search_method"] = "caller"
        elif validated_kb_config.get("strategy") is not None:
            effective_search_method = self._map_strategy_to_method(validated_kb_config["strategy"])
            config_sources["search_method"] = "kb_config"
        elif validated_kb_config.get("search_method") is not None:
            # Backward compatibility: also check search_method directly
            effective_search_method = self._map_strategy_to_method(validated_kb_config["search_method"])
            config_sources["search_method"] = "kb_config"
        else:
            effective_search_method = SERVICE_DEFAULTS["search_method"]
            config_sources["search_method"] = "default"

        # Threshold (frontend uses score_threshold, backend uses threshold, use validated config)
        if caller_threshold is not None:
            effective_threshold = caller_threshold
            config_sources["threshold"] = "caller"
        elif validated_kb_config.get("score_threshold") is not None:
            effective_threshold = validated_kb_config["score_threshold"]
            config_sources["threshold"] = "kb_config"
        elif validated_kb_config.get("similarity_threshold") is not None:
            # Backward compatibility
            effective_threshold = validated_kb_config["similarity_threshold"]
            config_sources["threshold"] = "kb_config"
        else:
            effective_threshold = SERVICE_DEFAULTS["threshold"]
            config_sources["threshold"] = "default"

        return {
            "top_k": effective_top_k,
            "search_method": effective_search_method,
            "threshold": effective_threshold,
            "config_sources": config_sources
        }

    async def search(
        self,
        db: Session,
        kb_id: UUID,
        query: str,
        top_k: Optional[int] = None,
        search_method: Optional[str] = None,
        threshold: Optional[float] = None,
        apply_annotation_boost: bool = True,
        context_filter: str = None  # Filter by context (chatbot, chatflow, both)
    ) -> List[dict]:
        """
        Search knowledge base for relevant chunks.

        WHY: RAG - find relevant context for AI response
        HOW: Embed query, search vector store, boost annotations

        CONFIG PRIORITY:
            1. Caller Override (explicit parameter) - highest
            2. KB-Level Config (kb.context_settings.retrieval_config)
            3. Service Defaults (top_k=5, threshold=0.7, method=hybrid) - lowest

        ARGS:
            db: Database session
            kb_id: Knowledge base ID
            query: User's search query
            top_k: Number of results (None = use KB config or default 5)
            search_method: "vector" | "keyword" | "hybrid" (None = use KB config)
            threshold: Minimum similarity score 0.0-1.0 (None = use KB config)
            apply_annotation_boost: Whether to boost annotated chunks

        RETURNS:
            [
                {
                    "chunk_id": "uuid",
                    "document_id": "uuid",
                    "document_title": "FAQ.pdf",
                    "document_url": "https://example.com/faq",  # For web sources, null for file uploads
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

        # NEW: Get KB-level retrieval config from context_settings
        kb_retrieval_config = {}
        if kb.context_settings:
            kb_retrieval_config = kb.context_settings.get("retrieval_config", {})

        # Apply configuration priority chain
        effective_config = self._get_effective_config(
            kb_retrieval_config=kb_retrieval_config,
            caller_top_k=top_k,
            caller_search_method=search_method,
            caller_threshold=threshold
        )

        # Extract effective values
        effective_top_k = effective_config["top_k"]
        effective_search_method = effective_config["search_method"]
        effective_threshold = effective_config["threshold"]

        # Log config resolution for debugging
        print(f"[RetrievalService] KB {kb_id} - Config resolution:")
        print(f"  top_k: {effective_top_k} (from {effective_config['config_sources']['top_k']})")
        print(f"  search_method: {effective_search_method} (from {effective_config['config_sources']['search_method']})")
        print(f"  threshold: {effective_threshold} (from {effective_config['config_sources']['threshold']})")

        # Get embedding model from KB config (CRITICAL: must match indexing model)
        embedding_config = kb.embedding_config or {} if kb else {}
        embedding_model = embedding_config.get("model") or embedding_config.get("model_name", "all-MiniLM-L6-v2")

        # Validate embedding model compatibility
        await self._validate_embedding_model(kb, embedding_model)

        # Generate query embedding using the KB's configured model
        query_embedding = await multi_model_embedding_service.generate_embedding(
            text=query,
            model_name=embedding_model
        )

        # Search vector store using EFFECTIVE config values
        if effective_search_method == "vector":
            results = await self._vector_search(
                db=db,
                kb_id=kb_id,
                query_embedding=query_embedding,
                top_k=effective_top_k * 2 if apply_annotation_boost else effective_top_k,  # Get more for boosting
                threshold=effective_threshold
            )

        elif effective_search_method == "keyword":
            results = await self._keyword_search(
                db=db,
                kb_id=kb_id,
                query=query,
                top_k=effective_top_k * 2 if apply_annotation_boost else effective_top_k,
                kb=kb  # Pass KB for Qdrant text search fallback (Option A)
            )

        elif effective_search_method == "mmr":
            # Maximum Marginal Relevance: diversity-aware search
            results = await self._mmr_search(
                db=db,
                kb_id=kb_id,
                query_embedding=query_embedding,
                top_k=effective_top_k * 2 if apply_annotation_boost else effective_top_k,
                threshold=effective_threshold,
                lambda_param=0.7  # 70% relevance, 30% diversity
            )

        elif effective_search_method == "threshold":
            # Strict threshold filtering: quality over quantity
            results = await self._threshold_search(
                db=db,
                kb_id=kb_id,
                query_embedding=query_embedding,
                top_k=effective_top_k * 2 if apply_annotation_boost else effective_top_k,
                threshold=effective_threshold
            )

        else:  # hybrid (default)
            results = await self._hybrid_search(
                db=db,
                kb_id=kb_id,
                query=query,
                query_embedding=query_embedding,
                top_k=effective_top_k * 2 if apply_annotation_boost else effective_top_k,
                threshold=effective_threshold,
                kb=kb  # Pass KB for Qdrant text search fallback (Option A)
            )

        # Apply annotation boosting
        if apply_annotation_boost:
            results = self._apply_annotation_boost(results)

        # Re-rank and limit using EFFECTIVE top_k
        results = sorted(results, key=lambda x: x["score"], reverse=True)[:effective_top_k]

        # Debug logging before filter
        print(f"[RetrievalService] Before final filter: {len(results)} results (method={effective_search_method})")

        # Filter by threshold
        if effective_search_method != "hybrid":
            results = [r for r in results if r["score"] >= effective_threshold]
            print(f"[RetrievalService] After threshold filter ({effective_threshold}): {len(results)} results")
        else:
            # Hybrid search: apply minimum threshold to filter truly irrelevant results
            # WHY: Keyword-only results get 0.85 * 0.3 = 0.255 score after weighting.
            # Using 0.20 threshold allows:
            # - Keyword-only results (0.85 * 0.3 = 0.255 > 0.20) ✓
            # - Vector-only results (0.35+ * 0.7 = 0.245+) ✓
            # - Combined results (higher scores) ✓
            min_hybrid_threshold = 0.20
            original_count = len(results)
            results = [r for r in results if r["score"] >= min_hybrid_threshold]
            print(f"[RetrievalService] Hybrid threshold filter ({min_hybrid_threshold}): {original_count} → {len(results)} results")

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
        HOW: Query Qdrant with embedding

        STORAGE COMPATIBILITY:
        - Option A (file uploads): Uses Qdrant payload metadata (no PostgreSQL chunks)
        - Hybrid (web scraping): Can use either Qdrant payload or PostgreSQL
        - Fallback: If Qdrant metadata missing, try PostgreSQL
        """

        # Search Qdrant vector store
        vector_results = await self.qdrant_service.search(
            kb_id=kb_id,
            query_embedding=query_embedding,
            top_k=top_k,
            score_threshold=threshold
        )

        # Build results using Qdrant metadata (primary) with PostgreSQL fallback
        results = []
        for result in vector_results:
            # SearchResult has .id, .score, .content, .metadata
            result_content = result.content

            # If Qdrant has content, use it (Option A: Qdrant-only storage)
            if result_content:
                results.append({
                    "chunk_id": result.id,
                    "document_id": result.metadata.get("document_id", ""),
                    "document_title": result.metadata.get("document_name", result.metadata.get("original_filename", "Unknown")),
                    "document_url": result.metadata.get("source_url"),  # Source URL for web sources
                    "content": result_content,
                    "score": result.score,
                    "page": result.metadata.get("page_number", result.metadata.get("chunk_index")),
                    "annotations": result.metadata.get("annotations"),
                    "boosted": False,
                    "storage_type": result.metadata.get("storage_location", "qdrant_only")
                })
            else:
                # Fallback: Query PostgreSQL for chunk metadata (hybrid storage)
                chunk = self._get_chunk_metadata(db, result.id)
                if chunk:
                    results.append({
                        "chunk_id": result.id,
                        "document_id": str(chunk.document_id) if chunk.document_id else "",
                        "document_title": chunk.document.name if chunk.document else "Unknown",
                        "document_url": chunk.document.source_url if chunk.document else None,  # Source URL for web sources
                        "content": chunk.content,
                        "score": result.score,
                        "page": chunk.chunk_metadata.get("page") if chunk.chunk_metadata else None,
                        "annotations": chunk.chunk_metadata.get("annotations") if chunk.chunk_metadata else None,
                        "boosted": False,
                        "storage_type": "postgres_fallback"
                    })
                else:
                    # Last resort: Include result with metadata warning
                    # This helps debugging and ensures results flow through even if content storage is inconsistent
                    print(f"[RetrievalService] Warning: No content found for chunk {result.id}, including with placeholder")
                    results.append({
                        "chunk_id": result.id,
                        "document_id": result.metadata.get("document_id", ""),
                        "document_title": result.metadata.get("document_name", result.metadata.get("original_filename", "Unknown")),
                        "document_url": result.metadata.get("source_url"),  # Source URL for web sources
                        "content": f"[Content unavailable for chunk {result.id}]",
                        "score": result.score,
                        "page": result.metadata.get("page_number", result.metadata.get("chunk_index")),
                        "annotations": result.metadata.get("annotations"),
                        "boosted": False,
                        "storage_type": "missing_content"
                    })

        # Debug logging
        print(f"[RetrievalService] Vector search: Qdrant returned {len(vector_results)}, after content filter: {len(results)}")

        return results


    async def _keyword_search(
        self,
        db: Session,
        kb_id: UUID,
        query: str,
        top_k: int,
        kb=None  # Optional: Pass KB to check storage type
    ) -> List[dict]:
        """
        Keyword-based search (full-text search).

        WHY: Find exact matches
        HOW: PostgreSQL full-text search OR Qdrant text search

        STORAGE COMPATIBILITY:
        - Hybrid (web scraping): PostgreSQL full-text search (chunks table)
        - Option A (file uploads): Qdrant MatchText search (payload content)

        STRATEGY:
        1. Try PostgreSQL full-text search first
        2. If no results AND KB is Qdrant-only, use Qdrant text search
        """

        from app.models.chunk import Chunk
        from sqlalchemy import func

        results = []

        # STEP 1: Try PostgreSQL full-text search
        try:
            # Use @@ operator directly with plainto_tsquery to properly convert user query
            # NOTE: .match() already wraps in plainto_tsquery, so we use op('@@') to avoid double-wrapping
            # This handles multi-word queries, removes stop words, and creates proper boolean query
            chunks = db.query(Chunk).filter(
                Chunk.kb_id == kb_id,
                func.to_tsvector('english', Chunk.content).op('@@')(
                    func.plainto_tsquery('english', query)
                )
            ).limit(top_k).all()

            for chunk in chunks:
                results.append({
                    "chunk_id": str(chunk.id),
                    "document_id": str(chunk.document_id),
                    "document_title": chunk.document.name if chunk.document else "Unknown",
                    "document_url": chunk.document.source_url if chunk.document else None,  # Source URL for web sources
                    "content": chunk.content,
                    "score": 0.85,  # Must be > 0.833 to pass 0.25 threshold after 0.3 weight
                    "page": chunk.chunk_metadata.get("page") if chunk.chunk_metadata else None,
                    "annotations": chunk.chunk_metadata.get("annotations") if chunk.chunk_metadata else None,
                    "boosted": False,
                    "storage_type": "postgres"
                })
        except Exception as e:
            print(f"[RetrievalService] PostgreSQL keyword search error: {e}")
            # CRITICAL: Reset transaction state so subsequent queries work
            # Without this, the transaction stays in "aborted" state and ALL
            # subsequent queries (including history retrieval) return empty results
            try:
                db.rollback()
                print(f"[RetrievalService] Transaction rolled back after FTS error")
            except Exception as rollback_error:
                print(f"[RetrievalService] Rollback failed: {rollback_error}")

        # STEP 2: If no PostgreSQL results, try Qdrant text search (for Option A)
        if not results:
            # Check if KB uses Qdrant-only storage
            is_qdrant_only = kb and self._is_qdrant_only_storage(kb)

            if is_qdrant_only:
                print(f"[RetrievalService] No PostgreSQL chunks, using Qdrant text search for KB {kb_id}")
                try:
                    # Use Qdrant text search
                    qdrant_results = await self.qdrant_service.text_search(
                        kb_id=kb_id,
                        query_text=query,
                        top_k=top_k
                    )

                    for result in qdrant_results:
                        results.append({
                            "chunk_id": result.id,
                            "document_id": result.metadata.get("document_id", ""),
                            "document_title": result.metadata.get("document_name", result.metadata.get("original_filename", "Unknown")),
                            "document_url": result.metadata.get("source_url"),  # Source URL for web sources
                            "content": result.content,
                            "score": result.score,
                            "page": result.metadata.get("page_number", result.metadata.get("chunk_index")),
                            "annotations": result.metadata.get("annotations"),
                            "boosted": False,
                            "storage_type": "qdrant_text_search"
                        })

                    print(f"[RetrievalService] Qdrant text search returned {len(results)} results")
                except Exception as e:
                    print(f"[RetrievalService] Qdrant text search error: {e}")
            else:
                print(f"[RetrievalService] Keyword search returned 0 results for KB {kb_id}")
                if not kb:
                    print(f"  → Pass KB object to enable Qdrant text search fallback")

        return results


    async def _hybrid_search(
        self,
        db: Session,
        kb_id: UUID,
        query: str,
        query_embedding: List[float],
        top_k: int,
        threshold: float,
        kb=None  # Optional: Pass KB to enable Qdrant text search fallback for Option A
    ) -> List[dict]:
        """
        Hybrid search (vector + keyword).

        WHY: Best of both worlds - semantic + exact matches
        HOW: Combine vector and keyword results with weighted scores

        STORAGE COMPATIBILITY:
        - Hybrid (web scraping): Both vector + keyword work, scores combined
        - Option A (file uploads): Vector results + Qdrant text search for keyword
          → Now supports both! Qdrant text search provides keyword matching for Option A
        """

        # Get vector results
        vector_results = await self._vector_search(
            db=db,
            kb_id=kb_id,
            query_embedding=query_embedding,
            top_k=top_k,
            threshold=threshold * 0.8  # Lower threshold for hybrid
        )

        # Get keyword results (uses Qdrant text search fallback for Option A)
        keyword_results = await self._keyword_search(
            db=db,
            kb_id=kb_id,
            query=query,
            top_k=top_k,
            kb=kb  # Pass KB for Qdrant text search fallback
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

        # Debug logging
        print(f"[RetrievalService] Hybrid search: vector={len(vector_results)}, keyword={len(keyword_results)}, combined={len(combined)}")

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


    def _cosine_similarity(self, result1: dict, result2: dict) -> float:
        """
        Calculate similarity between two search results.

        WHY: MMR needs to measure diversity between selected results
        HOW: Content-based Jaccard similarity (embedding comparison requires storage)

        ARGS:
            result1: First search result with content
            result2: Second search result with content

        RETURNS:
            Similarity score between 0.0 and 1.0
        """
        # Use content-based Jaccard similarity (word overlap)
        # Note: For true cosine similarity on embeddings, we'd need to store embeddings
        content1 = result1.get("content", "").lower()
        content2 = result2.get("content", "").lower()

        if not content1 or not content2:
            return 0.0

        words1 = set(content1.split())
        words2 = set(content2.split())

        if not words1 or not words2:
            return 0.0

        intersection = len(words1 & words2)
        union = len(words1 | words2)

        return intersection / union if union > 0 else 0.0


    async def _mmr_search(
        self,
        db: Session,
        kb_id: UUID,
        query_embedding: List[float],
        top_k: int,
        threshold: float,
        lambda_param: float = 0.7
    ) -> List[dict]:
        """
        Maximum Marginal Relevance search - balance relevance with diversity.

        WHY: Avoid redundant results, get diverse information coverage
        HOW: Iteratively select results that balance query relevance with novelty

        ALGORITHM:
            MMR = λ * sim(doc, query) - (1-λ) * max(sim(doc, selected_docs))

            Where:
            - λ = 1.0: Pure relevance (same as vector search)
            - λ = 0.0: Pure diversity (most different from already selected)
            - λ = 0.7: Recommended balance (70% relevance, 30% diversity)

        ARGS:
            db: Database session
            kb_id: Knowledge base ID
            query_embedding: Query embedding vector
            top_k: Number of results to return
            threshold: Minimum similarity threshold
            lambda_param: Balance between relevance and diversity (default 0.7)

        RETURNS:
            Diverse results with MMR-adjusted scores
        """
        # Fetch more candidates than needed for MMR reranking
        fetch_k = min(top_k * 3, 50)  # Get 3x candidates, max 50

        # Get initial candidates via vector search
        candidates = await self._vector_search(
            db=db,
            kb_id=kb_id,
            query_embedding=query_embedding,
            top_k=fetch_k,
            threshold=threshold * 0.5  # Lower threshold to get more candidates
        )

        if not candidates:
            return []

        if len(candidates) <= top_k:
            # Not enough candidates for MMR, return as-is
            return candidates

        # MMR selection
        selected = []
        remaining = candidates.copy()

        while len(selected) < top_k and remaining:
            if not selected:
                # First selection: highest relevance to query
                best = max(remaining, key=lambda x: x["score"])
                best_idx = remaining.index(best)
            else:
                # Subsequent selections: MMR formula
                best_mmr_score = float('-inf')
                best_idx = 0

                for i, candidate in enumerate(remaining):
                    # Relevance to query (already computed as score)
                    relevance = candidate["score"]

                    # Maximum similarity to already selected results (diversity penalty)
                    max_sim_to_selected = max(
                        self._cosine_similarity(candidate, sel)
                        for sel in selected
                    )

                    # MMR score: balance relevance and diversity
                    mmr_score = (lambda_param * relevance) - ((1 - lambda_param) * max_sim_to_selected)

                    if mmr_score > best_mmr_score:
                        best_mmr_score = mmr_score
                        best_idx = i

                best = remaining[best_idx]
                # Update score to reflect MMR ranking
                best["mmr_score"] = best_mmr_score

            # Add to selected, remove from remaining
            selected.append(best)
            remaining.pop(best_idx)

        # Mark results as MMR-selected
        for result in selected:
            result["search_method"] = "mmr"

        return selected


    async def _threshold_search(
        self,
        db: Session,
        kb_id: UUID,
        query_embedding: List[float],
        top_k: int,
        threshold: float
    ) -> List[dict]:
        """
        Strict threshold-based search - quality over quantity.

        WHY: High-precision applications where only high-quality matches matter
        HOW: Vector search with strict threshold, may return fewer than top_k

        DIFFERENCE FROM SEMANTIC SEARCH:
            - Semantic: Returns top_k results, then filters by threshold
            - Threshold: Strictly returns ONLY results above threshold, may return 0

        USE CASES:
            - Legal/compliance: Only high-confidence answers
            - Technical support: Avoid misleading low-confidence responses
            - Mission-critical: Better no answer than wrong answer

        ARGS:
            db: Database session
            kb_id: Knowledge base ID
            query_embedding: Query embedding vector
            top_k: Maximum results (may return fewer)
            threshold: Strict minimum threshold (0.0-1.0)

        RETURNS:
            Only results strictly above threshold (may be empty)
        """
        # Get more candidates to filter strictly
        fetch_k = top_k * 2

        # Vector search with lower threshold to get candidates
        candidates = await self._vector_search(
            db=db,
            kb_id=kb_id,
            query_embedding=query_embedding,
            top_k=fetch_k,
            threshold=threshold * 0.8  # Get slightly more, filter strictly
        )

        # Strict threshold filtering - the key difference
        # Unlike semantic search, this does NOT pad results below threshold
        strict_results = [
            result for result in candidates
            if result["score"] >= threshold
        ]

        # Mark results as threshold-filtered
        for result in strict_results:
            result["search_method"] = "threshold"
            result["threshold_applied"] = threshold

        # Return up to top_k (may be fewer or zero)
        return strict_results[:top_k]


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
        top_k: Optional[int] = None,
        search_method: Optional[str] = None,
        threshold: Optional[float] = None
    ) -> List[dict]:
        """
        Search across multiple knowledge bases.

        WHY: Chatbots can use multiple KBs
        HOW: Search each KB, combine and re-rank results

        CONFIG PRIORITY (per KB):
            1. Caller Override (explicit parameter)
            2. Each KB's own context_settings.retrieval_config
            3. Service Defaults

        ARGS:
            db: Database session
            kb_ids: List of knowledge base IDs
            query: Search query
            top_k: Total results to return (None = each KB uses its config)
            search_method: Search method (None = each KB uses its config)
            threshold: Score threshold (None = each KB uses its config)

        RETURNS:
            Combined results from all KBs
        """

        all_results = []

        # Use effective top_k for distribution (default if not specified)
        effective_total_top_k = top_k if top_k is not None else SERVICE_DEFAULTS["top_k"]
        per_kb_top_k = max(effective_total_top_k // len(kb_ids), 3)  # Distribute evenly

        for kb_id in kb_ids:
            try:
                # Pass None for parameters to let each KB use its own config
                # Or pass caller values if explicitly provided
                results = await self.search(
                    db=db,
                    kb_id=kb_id,
                    query=query,
                    top_k=per_kb_top_k if top_k is not None else None,  # Let KB decide if caller didn't specify
                    search_method=search_method,  # None = KB decides
                    threshold=threshold  # None = KB decides
                )
                all_results.extend(results)
            except Exception as e:
                # Log error but continue with other KBs
                print(f"Error searching KB {kb_id}: {e}")

        # Re-rank and limit
        all_results = sorted(all_results, key=lambda x: x["score"], reverse=True)[:effective_total_top_k]

        return all_results


# Global instance
retrieval_service = RetrievalService()
