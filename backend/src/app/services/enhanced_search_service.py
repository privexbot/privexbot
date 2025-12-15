"""
Enhanced Search Service - Context-aware search for chatbots and chatflows.

WHY:
- Leverage adaptive chunking metadata for better search results
- Different search strategies for chatbot vs chatflow use cases
- Backward compatible with existing search functionality
- Handle large-scale KBs (1500+ pages) efficiently

HOW:
- Use chunk metadata to route queries to optimal content types
- Implement hybrid search combining vector + metadata filtering
- Adaptive result ranking based on KB purpose
- Fallback to existing search if enhanced features unavailable
"""

from typing import List, Dict, Optional, Any, Tuple
from uuid import UUID
from dataclasses import dataclass
from enum import Enum

from app.services.qdrant_service import qdrant_service, SearchResult
from app.services.embedding_service_local import embedding_service
from app.services.adaptive_kb_service import KBPurpose
from app.models.knowledge_base import KnowledgeBase
from app.models.document import Document
from app.models.chunk import Chunk
from sqlalchemy.orm import Session


@dataclass
class EnhancedSearchResult:
    """Enhanced search result with context and reasoning"""
    chunk_id: str
    content: str
    score: float
    document_id: str
    page_url: str
    page_title: str
    content_type: str
    strategy_used: str
    confidence: float         # 0-1, confidence in result relevance
    context_type: str        # "precise", "contextual", "related"
    reasoning: str           # Why this result was selected


class SearchStrategy(Enum):
    """Search strategy based on query type and KB purpose"""
    PRECISE = "precise"          # Direct answer lookup (good for chatbots)
    CONTEXTUAL = "contextual"    # Broader context search (good for chatflows)
    HYBRID = "hybrid"           # Combination approach
    ADAPTIVE = "adaptive"       # Automatically choose best strategy


class EnhancedSearchService:
    """
    Enhanced search service that leverages adaptive chunking metadata.

    BACKWARD COMPATIBLE: Falls back to standard search if metadata unavailable.
    CONTEXT AWARE: Different strategies for chatbot vs chatflow.
    SCALABLE: Efficient even with 1500+ pages.
    """

    def __init__(self):
        self.content_type_weights = {
            "faq": 1.3,           # Boost FAQ content for direct questions
            "documentation": 1.1,  # Good for detailed explanations
            "code": 1.2,          # Boost code examples
            "article": 1.0,       # Neutral weight
            "mixed": 0.9          # Lower weight for mixed content
        }

        self.strategy_weights = {
            "by_heading": 1.2,    # Well-structured content
            "semantic": 1.1,      # Related content grouping
            "by_section": 1.0,    # Standard sectioning
            "adaptive": 1.0,      # Neutral
            "recursive": 0.9      # Basic chunking
        }

    async def enhanced_search(
        self,
        kb: KnowledgeBase,
        query: str,
        search_strategy: SearchStrategy = SearchStrategy.ADAPTIVE,
        top_k: int = 5,
        context_type: str = "chatbot"  # "chatbot" or "chatflow"
    ) -> List[EnhancedSearchResult]:
        """
        Perform enhanced search with adaptive strategies.

        Args:
            kb: Knowledge base to search
            query: Search query
            search_strategy: Search strategy to use
            top_k: Number of results to return
            context_type: "chatbot" (precise) or "chatflow" (contextual)

        Returns:
            List of enhanced search results with reasoning
        """

        # Generate query embedding using existing service (BACKWARD COMPATIBLE)
        query_embedding = await embedding_service.generate_embeddings([query])
        if not query_embedding:
            return []

        # Determine search strategy if adaptive
        if search_strategy == SearchStrategy.ADAPTIVE:
            search_strategy = self._determine_search_strategy(kb, query, context_type)

        # Perform base vector search using existing Qdrant service (BACKWARD COMPATIBLE)
        base_results = await qdrant_service.search(
            kb_id=kb.id,
            query_embedding=query_embedding[0],
            top_k=top_k * 3,  # Get more results for filtering/reranking
            filters={"workspace_id": str(kb.workspace_id)}
        )

        if not base_results:
            return []

        # Enhance results with metadata analysis and adaptive ranking
        enhanced_results = self._enhance_search_results(
            base_results,
            query,
            search_strategy,
            context_type,
            kb
        )

        # Apply adaptive ranking
        ranked_results = self._rank_results_adaptively(
            enhanced_results,
            search_strategy,
            context_type
        )

        return ranked_results[:top_k]

    def _determine_search_strategy(
        self,
        kb: KnowledgeBase,
        query: str,
        context_type: str
    ) -> SearchStrategy:
        """Automatically determine the best search strategy"""

        # Analyze query characteristics
        query_lower = query.lower()

        # Question words indicate need for precise answers
        question_words = ['what', 'how', 'why', 'when', 'where', 'who', 'which']
        has_question_words = any(word in query_lower for word in question_words)

        # Get KB purpose from metadata
        kb_purpose_str = kb.metadata.get("purpose", "general")
        try:
            kb_purpose = KBPurpose(kb_purpose_str)
        except ValueError:
            kb_purpose = KBPurpose.GENERAL

        # Decision logic
        if context_type == "chatbot" and has_question_words:
            return SearchStrategy.PRECISE
        elif context_type == "chatflow":
            return SearchStrategy.CONTEXTUAL
        elif kb_purpose == KBPurpose.CHATBOT:
            return SearchStrategy.PRECISE
        elif kb_purpose == KBPurpose.CHATFLOW:
            return SearchStrategy.CONTEXTUAL
        else:
            return SearchStrategy.HYBRID

    def _enhance_search_results(
        self,
        base_results: List[SearchResult],
        query: str,
        search_strategy: SearchStrategy,
        context_type: str,
        kb: KnowledgeBase
    ) -> List[EnhancedSearchResult]:
        """Enhance basic search results with metadata analysis"""

        enhanced_results = []

        for result in base_results:
            metadata = result.metadata

            # Extract adaptive metadata (fallback to defaults if not available)
            content_type = metadata.get("content_type", "mixed")
            strategy_used = metadata.get("strategy_used", "recursive")
            kb_purpose = metadata.get("kb_purpose", "general")

            # Calculate confidence score based on multiple factors
            confidence = self._calculate_confidence(
                result.score,
                content_type,
                strategy_used,
                query,
                search_strategy
            )

            # Determine context type for this result
            result_context_type = self._determine_result_context_type(
                content_type,
                strategy_used,
                search_strategy
            )

            # Generate reasoning for result selection
            reasoning = self._generate_reasoning(
                content_type,
                strategy_used,
                result.score,
                confidence,
                context_type
            )

            enhanced_result = EnhancedSearchResult(
                chunk_id=result.id,
                content=result.content,
                score=result.score,
                document_id=metadata.get("document_id", ""),
                page_url=metadata.get("page_url", ""),
                page_title=metadata.get("page_title", ""),
                content_type=content_type,
                strategy_used=strategy_used,
                confidence=confidence,
                context_type=result_context_type,
                reasoning=reasoning
            )

            enhanced_results.append(enhanced_result)

        return enhanced_results

    def _calculate_confidence(
        self,
        vector_score: float,
        content_type: str,
        strategy_used: str,
        query: str,
        search_strategy: SearchStrategy
    ) -> float:
        """Calculate confidence score for a search result"""

        # Base confidence from vector similarity
        base_confidence = min(1.0, vector_score)

        # Apply content type weighting
        content_weight = self.content_type_weights.get(content_type, 1.0)

        # Apply strategy weighting
        strategy_weight = self.strategy_weights.get(strategy_used, 1.0)

        # Boost based on query-content alignment
        alignment_boost = self._calculate_query_alignment(query, content_type)

        # Strategy-specific adjustments
        strategy_boost = self._calculate_strategy_boost(search_strategy, content_type)

        # Combined confidence (capped at 1.0)
        confidence = min(1.0,
            base_confidence * content_weight * strategy_weight * alignment_boost * strategy_boost
        )

        return confidence

    def _calculate_query_alignment(self, query: str, content_type: str) -> float:
        """Calculate how well the query aligns with content type"""

        query_lower = query.lower()

        # FAQ alignment
        if content_type == "faq":
            faq_indicators = ['how', 'what', 'why', 'can i', 'do i', '?']
            if any(indicator in query_lower for indicator in faq_indicators):
                return 1.2

        # Documentation alignment
        elif content_type == "documentation":
            doc_indicators = ['install', 'configure', 'setup', 'guide', 'tutorial']
            if any(indicator in query_lower for indicator in doc_indicators):
                return 1.2

        # Code alignment
        elif content_type == "code":
            code_indicators = ['function', 'method', 'class', 'example', 'code']
            if any(indicator in query_lower for indicator in code_indicators):
                return 1.2

        return 1.0  # Neutral alignment

    def _calculate_strategy_boost(
        self,
        search_strategy: SearchStrategy,
        content_type: str
    ) -> float:
        """Calculate boost based on search strategy and content type alignment"""

        if search_strategy == SearchStrategy.PRECISE:
            # Precise search favors FAQ and well-structured content
            if content_type in ["faq", "documentation"]:
                return 1.1

        elif search_strategy == SearchStrategy.CONTEXTUAL:
            # Contextual search favors articles and mixed content
            if content_type in ["article", "mixed", "documentation"]:
                return 1.1

        return 1.0

    def _determine_result_context_type(
        self,
        content_type: str,
        strategy_used: str,
        search_strategy: SearchStrategy
    ) -> str:
        """Determine the context type of this result"""

        if content_type == "faq" and search_strategy == SearchStrategy.PRECISE:
            return "precise"
        elif content_type in ["documentation", "article"] and search_strategy == SearchStrategy.CONTEXTUAL:
            return "contextual"
        elif strategy_used in ["semantic", "by_heading"]:
            return "contextual"
        else:
            return "related"

    def _generate_reasoning(
        self,
        content_type: str,
        strategy_used: str,
        vector_score: float,
        confidence: float,
        context_type: str
    ) -> str:
        """Generate human-readable reasoning for result selection"""

        reasons = []

        # Content type reasoning
        if content_type == "faq":
            reasons.append("FAQ content optimized for direct answers")
        elif content_type == "documentation":
            reasons.append("documentation provides detailed explanations")
        elif content_type == "code":
            reasons.append("code examples and implementation details")

        # Strategy reasoning
        if strategy_used == "by_heading":
            reasons.append("well-structured content with clear headings")
        elif strategy_used == "semantic":
            reasons.append("semantically related content grouped together")

        # Confidence reasoning
        if confidence > 0.8:
            reasons.append("high confidence match")
        elif confidence > 0.6:
            reasons.append("good match")
        else:
            reasons.append("potential match")

        return "; ".join(reasons)

    def _rank_results_adaptively(
        self,
        enhanced_results: List[EnhancedSearchResult],
        search_strategy: SearchStrategy,
        context_type: str
    ) -> List[EnhancedSearchResult]:
        """Rank results using adaptive algorithm"""

        # Different ranking strategies
        if search_strategy == SearchStrategy.PRECISE:
            # For precise search, prioritize confidence and FAQ content
            key_func = lambda r: (r.confidence * 2 + r.score,
                                 1.0 if r.content_type == "faq" else 0.8)

        elif search_strategy == SearchStrategy.CONTEXTUAL:
            # For contextual search, balance confidence with content diversity
            key_func = lambda r: (r.confidence + r.score,
                                 1.0 if r.content_type in ["documentation", "article"] else 0.9)

        else:  # HYBRID
            # Balanced approach
            key_func = lambda r: (r.confidence + r.score, r.confidence)

        # Sort by ranking key (descending)
        ranked_results = sorted(
            enhanced_results,
            key=key_func,
            reverse=True
        )

        return ranked_results

    async def search_with_fallback(
        self,
        kb: KnowledgeBase,
        query: str,
        top_k: int = 5,
        context_type: str = "chatbot"
    ) -> List[Dict[str, Any]]:
        """
        Search with fallback to basic search if enhanced features fail.

        BACKWARD COMPATIBLE: Guarantees to return results.
        """

        try:
            # Try enhanced search first
            enhanced_results = await self.enhanced_search(
                kb=kb,
                query=query,
                search_strategy=SearchStrategy.ADAPTIVE,
                top_k=top_k,
                context_type=context_type
            )

            if enhanced_results:
                # Convert to standard format for backward compatibility
                return [
                    {
                        "chunk_id": result.chunk_id,
                        "content": result.content,
                        "score": result.score,
                        "metadata": {
                            "document_id": result.document_id,
                            "page_url": result.page_url,
                            "page_title": result.page_title,
                            "content_type": result.content_type,
                            "confidence": result.confidence,
                            "reasoning": result.reasoning
                        }
                    }
                    for result in enhanced_results
                ]

        except Exception as e:
            print(f"[EnhancedSearchService] Enhanced search failed: {e}, falling back to basic search")

        # Fallback to basic search using existing Qdrant service (BACKWARD COMPATIBLE)
        try:
            query_embedding = await embedding_service.generate_embeddings([query])
            if query_embedding:
                basic_results = await qdrant_service.search(
                    kb_id=kb.id,
                    query_embedding=query_embedding[0],
                    top_k=top_k,
                    filters={"workspace_id": str(kb.workspace_id)}
                )

                return [
                    {
                        "chunk_id": result.id,
                        "content": result.content,
                        "score": result.score,
                        "metadata": result.metadata
                    }
                    for result in basic_results
                ]

        except Exception as e:
            print(f"[EnhancedSearchService] Fallback search also failed: {e}")

        return []  # Return empty list if all searches fail


# Global service instance
enhanced_search_service = EnhancedSearchService()