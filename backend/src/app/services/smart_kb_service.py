"""
Smart KB Service - Proper architecture for content storage and embedding.

FIXES IDENTIFIED ISSUES:
1. Storage Architecture: Clear separation of concerns
2. Access Control: KB-level, not processing-level
3. User Choice: User preferences override adaptive suggestions
4. Storage Conditions: Well-defined storage strategy

WHY:
- Eliminate redundant embedding storage
- Respect user's explicit configuration choices
- KB access control via context_settings
- Clear storage responsibilities

HOW:
- PostgreSQL: Content storage + chunk management
- Qdrant: ONLY vector embeddings + search metadata
- User config overrides adaptive suggestions
- KB context_settings controls access, not processing type
"""

from typing import List, Dict, Optional, Tuple, Any
from uuid import UUID
from dataclasses import dataclass
from enum import Enum
import asyncio
import json
from datetime import datetime

from app.services.chunking_service import chunking_service
from app.services.embedding_service_local import embedding_service
from app.services.qdrant_service import qdrant_service, QdrantChunk
from app.models.document import Document
from app.models.knowledge_base import KnowledgeBase
from app.models.chunk import Chunk


@dataclass
class StorageStrategy:
    """Defines what gets stored where and when"""
    store_full_content: bool = True          # Always store full content in PostgreSQL
    store_chunk_text: bool = True            # Always store chunks in PostgreSQL
    store_embeddings_in_postgres: bool = False  # NO redundant storage
    store_embeddings_in_qdrant: bool = True    # Primary vector storage
    enable_content_compression: bool = False   # For very large content


@dataclass
class ChunkingDecision:
    """Final chunking decision combining user preferences and adaptive analysis"""
    strategy: str               # Final strategy to use
    chunk_size: int            # Final chunk size
    chunk_overlap: int         # Final overlap
    user_preference: bool      # True if user explicitly set this
    adaptive_suggestion: str   # What adaptive analysis suggested
    reasoning: str            # Why this decision was made


@dataclass
class AccessControlInfo:
    """Access control information extracted from KB context_settings"""
    accessible_by_chatbots: bool
    accessible_by_chatflows: bool
    specific_chatbot_ids: List[UUID]
    specific_chatflow_ids: List[UUID]
    retrieval_config: Dict[str, Any]


class SmartKBService:
    """
    Smart KB service with proper architecture and user choice respect.

    CORE PRINCIPLES:
    1. User explicit choices ALWAYS override adaptive suggestions
    2. KB access control via context_settings, not processing decisions
    3. Clear storage separation: PostgreSQL for content, Qdrant for vectors
    4. No redundant embedding storage
    """

    def __init__(self):
        self.storage_strategy = StorageStrategy()

    def analyze_kb_access_control(self, kb: KnowledgeBase) -> AccessControlInfo:
        """
        Extract access control information from KB context_settings.

        This replaces the wrong approach of making access decisions during processing.
        """
        context_settings = kb.context_settings or {}

        access_mode = context_settings.get("access_mode", "all")
        allowed_chatbots = context_settings.get("allowed_chatbots", [])
        allowed_chatflows = context_settings.get("allowed_chatflows", [])
        retrieval_config = context_settings.get("retrieval_config", {})

        if access_mode == "all":
            # KB accessible by all bots in workspace
            accessible_by_chatbots = True
            accessible_by_chatflows = True
            specific_chatbot_ids = []
            specific_chatflow_ids = []

        elif access_mode == "specific":
            # KB accessible only by specified bots
            accessible_by_chatbots = len(allowed_chatbots) > 0
            accessible_by_chatflows = len(allowed_chatflows) > 0
            specific_chatbot_ids = [UUID(id) for id in allowed_chatbots]
            specific_chatflow_ids = [UUID(id) for id in allowed_chatflows]

        elif access_mode == "none":
            # KB not accessible by any bots (manual linking required)
            accessible_by_chatbots = False
            accessible_by_chatflows = False
            specific_chatbot_ids = []
            specific_chatflow_ids = []

        else:
            # Default to all access
            accessible_by_chatbots = True
            accessible_by_chatflows = True
            specific_chatbot_ids = []
            specific_chatflow_ids = []

        return AccessControlInfo(
            accessible_by_chatbots=accessible_by_chatbots,
            accessible_by_chatflows=accessible_by_chatflows,
            specific_chatbot_ids=specific_chatbot_ids,
            specific_chatflow_ids=specific_chatflow_ids,
            retrieval_config=retrieval_config
        )

    def make_chunking_decision(
        self,
        content: str,
        title: str,
        kb: KnowledgeBase,
        user_config: Optional[Dict] = None
    ) -> ChunkingDecision:
        """
        Make chunking decision respecting user preferences over adaptive suggestions.

        PRIORITY ORDER:
        1. User's explicit configuration in KB config
        2. User's explicit parameters in user_config
        3. Adaptive analysis suggestions
        4. System defaults
        """

        # Get user's explicit configuration from KB
        kb_config = kb.config or {}
        chunking_config = kb_config.get("chunking", {})

        # Get user's explicit parameters (from API call, etc.)
        user_config = user_config or {}

        # DEBUG: Log user config processing
        print(f"[DEBUG] Smart KB Service - user_config: {user_config}")
        print(f"[DEBUG] Smart KB Service - kb.config: {kb_config}")
        print(f"[DEBUG] Smart KB Service - chunking_config from KB: {chunking_config}")

        # Check for explicit user preferences (highest priority)
        user_strategy = (
            user_config.get("strategy") or
            chunking_config.get("strategy")
        )
        user_chunk_size = (
            user_config.get("chunk_size") or
            chunking_config.get("chunk_size")
        )
        user_chunk_overlap = (
            user_config.get("chunk_overlap") or
            chunking_config.get("chunk_overlap")
        )

        # DEBUG: Log extracted user preferences
        print(f"[DEBUG] Smart KB Service - user_strategy: {user_strategy}")
        print(f"[DEBUG] Smart KB Service - user_chunk_size: {user_chunk_size}")
        print(f"[DEBUG] Smart KB Service - user_chunk_overlap: {user_chunk_overlap}")

        # Special handling for no_chunking strategies - size/overlap are irrelevant
        if user_strategy in ("no_chunking", "full_content"):
            print(f"[DEBUG] Smart KB Service - Using NO_CHUNKING strategy: {user_strategy}")
            return ChunkingDecision(
                strategy=user_strategy,
                chunk_size=len(content),  # Full content size
                chunk_overlap=0,  # No overlap for single chunk
                user_preference=True,
                adaptive_suggestion="N/A - no chunking strategy",
                reasoning=f"No chunking strategy selected: {user_strategy}"
            )

        # If user has explicit preferences for other strategies, use them
        if user_strategy and user_chunk_size and user_chunk_overlap:
            print(f"[DEBUG] Smart KB Service - Using FULL user preferences: strategy={user_strategy}, size={user_chunk_size}, overlap={user_chunk_overlap}")
            return ChunkingDecision(
                strategy=user_strategy,
                chunk_size=user_chunk_size,
                chunk_overlap=user_chunk_overlap,
                user_preference=True,
                adaptive_suggestion="N/A - user preference used",
                reasoning=f"User explicitly configured: strategy={user_strategy}, size={user_chunk_size}, overlap={user_chunk_overlap}"
            )

        # If partial user preferences, get adaptive suggestions for missing parts
        print(f"[DEBUG] Smart KB Service - Using PARTIAL/ADAPTIVE preferences, analyzing content...")
        adaptive_analysis = self._analyze_content_for_adaptive_suggestions(content, title, kb)
        print(f"[DEBUG] Smart KB Service - Adaptive analysis: {adaptive_analysis}")

        final_strategy = user_strategy or adaptive_analysis["recommended_strategy"]
        final_chunk_size = user_chunk_size or adaptive_analysis["recommended_chunk_size"]
        final_chunk_overlap = user_chunk_overlap or adaptive_analysis["recommended_overlap"]

        user_preference = bool(user_strategy or user_chunk_size or user_chunk_overlap)

        print(f"[DEBUG] Smart KB Service - Final decision: strategy={final_strategy}, size={final_chunk_size}, overlap={final_chunk_overlap}, user_preference={user_preference}")

        reasoning_parts = []
        if user_strategy:
            reasoning_parts.append(f"strategy: user choice ({user_strategy})")
        else:
            reasoning_parts.append(f"strategy: adaptive suggestion ({final_strategy})")

        if user_chunk_size:
            reasoning_parts.append(f"size: user choice ({user_chunk_size})")
        else:
            reasoning_parts.append(f"size: adaptive suggestion ({final_chunk_size})")

        if user_chunk_overlap:
            reasoning_parts.append(f"overlap: user choice ({user_chunk_overlap})")
        else:
            reasoning_parts.append(f"overlap: adaptive suggestion ({final_chunk_overlap})")

        return ChunkingDecision(
            strategy=final_strategy,
            chunk_size=final_chunk_size,
            chunk_overlap=final_chunk_overlap,
            user_preference=user_preference,
            adaptive_suggestion=adaptive_analysis["recommended_strategy"],
            reasoning="; ".join(reasoning_parts)
        )

    def _analyze_content_for_adaptive_suggestions(
        self,
        content: str,
        title: str,
        kb: KnowledgeBase
    ) -> Dict[str, Any]:
        """
        Analyze content for adaptive suggestions.

        This provides suggestions but does NOT override user choices.
        """

        # Analyze content structure
        content_size = len(content)
        lines = content.split('\n')

        # Detect content type
        content_type = self._detect_content_type(content, title)

        # Analyze structure
        structure_score = self._analyze_structure(content)

        # Get access control info to understand intended use
        access_info = self.analyze_kb_access_control(kb)

        # Recommend strategy based on content analysis
        if structure_score > 0.4:
            recommended_strategy = "by_heading"
        elif content_type == "code":
            recommended_strategy = "semantic"
        elif content_type == "faq":
            recommended_strategy = "by_section"
        elif content_size > 50000:
            recommended_strategy = "semantic"
        else:
            recommended_strategy = "adaptive"

        # Recommend chunk size based on intended use and content
        if access_info.accessible_by_chatbots and not access_info.accessible_by_chatflows:
            # Chatbot-only: smaller chunks for precise answers
            base_chunk_size = 800
        elif access_info.accessible_by_chatflows and not access_info.accessible_by_chatbots:
            # Chatflow-only: larger chunks for context
            base_chunk_size = 1500
        else:
            # Both or unspecified: balanced approach
            base_chunk_size = 1200

        # Adjust based on content type
        if content_type == "faq":
            base_chunk_size = int(base_chunk_size * 0.7)  # Smaller for Q&A
        elif content_type == "documentation":
            base_chunk_size = int(base_chunk_size * 1.2)  # Larger for explanations

        # Recommend overlap
        recommended_overlap = int(base_chunk_size * 0.2)  # 20% overlap

        return {
            "content_type": content_type,
            "structure_score": structure_score,
            "recommended_strategy": recommended_strategy,
            "recommended_chunk_size": base_chunk_size,
            "recommended_overlap": recommended_overlap,
            "analysis_reasoning": f"Content type: {content_type}, structure score: {structure_score:.2f}, access pattern: chatbots={access_info.accessible_by_chatbots}, chatflows={access_info.accessible_by_chatflows}"
        }

    def _detect_content_type(self, content: str, title: str) -> str:
        """Simple content type detection"""
        content_lower = content.lower()
        title_lower = title.lower()

        if any(indicator in content_lower for indicator in ['question', 'answer', 'faq', 'how to']):
            return "faq"
        elif any(indicator in content_lower for indicator in ['function', 'class', 'def ', '```', '<code>']):
            return "code"
        elif any(indicator in content_lower for indicator in ['install', 'configure', 'setup', 'guide']):
            return "documentation"
        elif len(content.split('\n\n')) > 5:
            return "article"
        else:
            return "mixed"

    def _analyze_structure(self, content: str) -> float:
        """Analyze content structure score (0-1)"""
        lines = content.split('\n')
        total_lines = len(lines)

        if total_lines == 0:
            return 0.0

        headings = sum(1 for line in lines if line.strip().startswith('#'))
        lists = sum(1 for line in lines if line.strip().startswith(('- ', '* ', '1. ')))

        structure_score = min(1.0, (headings / total_lines * 10) + (lists / total_lines * 5))
        return structure_score

    async def process_document_with_proper_storage(
        self,
        document: Document,
        content: str,
        kb: KnowledgeBase,
        user_config: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """
        Process document with proper storage strategy.

        STORAGE STRATEGY:
        1. PostgreSQL Documents: Full content (always)
        2. PostgreSQL Chunks: Chunk text + metadata (always)
        3. Qdrant: ONLY vector embeddings + minimal metadata (never redundant)
        4. No embedding duplication
        """

        # Make chunking decision respecting user preferences
        chunking_decision = self.make_chunking_decision(
            content=content,
            title=document.name,
            kb=kb,
            user_config=user_config
        )

        # Use existing chunking service with decided parameters (BACKWARD COMPATIBLE)
        chunks_data = chunking_service.chunk_document(
            text=content,
            strategy=chunking_decision.strategy,
            chunk_size=chunking_decision.chunk_size,
            chunk_overlap=chunking_decision.chunk_overlap
        )

        if not chunks_data:
            return {
                "error": "No chunks created",
                "chunking_decision": chunking_decision,
                "chunks_created": 0
            }

        # Generate embeddings using existing service (BACKWARD COMPATIBLE)
        chunk_texts = [chunk["content"] for chunk in chunks_data]
        embeddings = await embedding_service.generate_embeddings(chunk_texts)

        if not embeddings or len(embeddings) != len(chunks_data):
            return {
                "error": "Embedding generation failed",
                "chunking_decision": chunking_decision,
                "chunks_created": len(chunks_data)
            }

        # Prepare PostgreSQL chunks (NO EMBEDDING STORAGE - avoid redundancy)
        postgres_chunks = []
        qdrant_chunks = []

        for idx, (chunk_data, embedding) in enumerate(zip(chunks_data, embeddings)):
            # Generate a proper UUID for each chunk
            import uuid
            chunk_id = str(uuid.uuid4())

            # PostgreSQL chunk (content + metadata, NO EMBEDDING)
            postgres_chunk_data = {
                "id": chunk_id,  # Add the UUID to postgres chunk data
                "document_id": document.id,
                "kb_id": document.kb_id,
                "content": chunk_data["content"],
                "chunk_index": idx,
                "position": idx,
                # NO embedding field - avoid redundancy
                "chunk_metadata": {
                    "token_count": chunk_data.get("token_count", 0),
                    "strategy": chunking_decision.strategy,
                    "chunk_size": chunking_decision.chunk_size,
                    "user_preference": chunking_decision.user_preference,
                    "adaptive_suggestion": chunking_decision.adaptive_suggestion,
                    "reasoning": chunking_decision.reasoning,
                    "workspace_id": str(document.workspace_id),
                    "created_at": datetime.utcnow().isoformat()
                }
            }
            postgres_chunks.append(postgres_chunk_data)

            # Qdrant chunk (ONLY embedding + enhanced metadata for search and filtering)
            qdrant_chunk = QdrantChunk(
                id=chunk_id,
                embedding=embedding,
                content=chunk_data["content"],  # Store content in Qdrant for search results
                metadata={
                    "document_id": str(document.id),
                    "kb_id": str(kb.id),
                    "workspace_id": str(kb.workspace_id),
                    "context": kb.context,  # CRITICAL: Enable context-based filtering
                    "chunk_index": idx,
                    "content_type": chunking_decision.adaptive_suggestion,
                    "strategy_used": chunking_decision.strategy,
                    "user_configured": chunking_decision.user_preference
                }
            )
            qdrant_chunks.append(qdrant_chunk)

        return {
            "chunking_decision": chunking_decision,
            "postgres_chunks": postgres_chunks,
            "qdrant_chunks": qdrant_chunks,
            "chunks_created": len(chunks_data),
            "embeddings_generated": len(embeddings),
            "storage_strategy": "separated_storage_no_redundancy"
        }

    def validate_storage_conditions(self, document: Document, content: str) -> Dict[str, Any]:
        """
        Validate storage conditions and provide clear information about what gets stored where.
        """

        content_size = len(content.encode('utf-8'))

        conditions = {
            "document_content_storage": {
                "store_full_content": self.storage_strategy.store_full_content,
                "storage_location": "postgresql_documents.content_full",
                "condition": "Always (for complete context retrieval)",
                "size_bytes": content_size
            },
            "chunk_text_storage": {
                "store_chunk_text": self.storage_strategy.store_chunk_text,
                "storage_location": "postgresql_chunks.content",
                "condition": "Always (for chunk management and display)",
                "estimated_chunks": max(1, content_size // 1000)  # Rough estimate
            },
            "embedding_storage": {
                "postgresql": {
                    "store": self.storage_strategy.store_embeddings_in_postgres,
                    "reason": "Avoided to prevent redundancy"
                },
                "qdrant": {
                    "store": self.storage_strategy.store_embeddings_in_qdrant,
                    "reason": "Primary vector storage for similarity search"
                }
            },
            "content_compression": {
                "enabled": self.storage_strategy.enable_content_compression,
                "condition": f"Content size: {content_size} bytes",
                "recommendation": "Enable if content > 100KB" if content_size > 100_000 else "Not needed"
            }
        }

        return conditions


# Global service instance
smart_kb_service = SmartKBService()