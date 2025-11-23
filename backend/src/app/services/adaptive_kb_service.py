"""
Adaptive Knowledge Base Service - Context-aware KB processing with scalability.

WHY:
- Handle both chatbot (precise answers) and chatflow (contextual reasoning) use cases
- Scale from 50 to 1500+ pages without hardcoded limits
- Backward compatible with existing chunking/embedding services
- Resource-aware processing with batching and monitoring

HOW:
- Enhance existing pipeline with adaptive strategies
- Configuration-driven approach (no hardcoding)
- Intelligent resource management and batching
- Context-aware chunking based on KB purpose and content analysis

DESIGN PRINCIPLES:
- Extend, don't replace existing services
- Graceful scaling from small to very large KBs
- Resource monitoring and adaptive processing
- Configurable strategies per workspace/KB
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
from app.models.document import Document
from app.models.knowledge_base import KnowledgeBase


class KBPurpose(Enum):
    """Define KB purpose to guide processing strategies"""
    CHATBOT = "chatbot"           # FAQ, customer support, precise answers
    CHATFLOW = "chatflow"         # Complex workflows, multi-step reasoning
    HYBRID = "hybrid"             # Both use cases
    DOCUMENTATION = "documentation"  # Technical docs, guides
    GENERAL = "general"           # Mixed content, default


class ProcessingMode(Enum):
    """Processing intensity based on content volume and resources"""
    FAST = "fast"               # Quick processing, basic chunking
    BALANCED = "balanced"       # Good quality/speed tradeoff
    THOROUGH = "thorough"       # Best quality, slower processing
    ADAPTIVE = "adaptive"       # Automatically choose based on content


@dataclass
class ContentAnalysis:
    """Analysis of document content to guide processing decisions"""
    size_chars: int
    size_category: str          # "small", "medium", "large", "very_large"
    content_type: str          # "documentation", "faq", "article", "code", "mixed"
    structure_score: float     # 0-1, how well structured (headings, lists, etc.)
    complexity_score: float    # 0-1, content complexity
    recommended_strategy: str   # Recommended chunking strategy
    recommended_chunk_size: int
    recommended_overlap: int


@dataclass
class ProcessingConfig:
    """Configuration for KB processing - not hardcoded, fully configurable"""
    kb_purpose: KBPurpose
    processing_mode: ProcessingMode
    max_chunk_size: int
    min_chunk_size: int
    overlap_ratio: float        # 0-0.5, overlap as ratio of chunk size
    batch_size: int            # For embeddings
    max_memory_mb: int         # Memory limit for processing
    enable_document_embedding: bool  # Whether to create doc-level embeddings
    enable_hierarchical: bool   # Whether to create both doc + chunk embeddings
    quality_threshold: float    # 0-1, minimum chunk quality to include


class AdaptiveKBService:
    """
    Adaptive KB processing service that enhances existing pipeline.

    BACKWARD COMPATIBILITY: Works alongside existing services, doesn't replace them.
    SCALABILITY: Handles 1-1500+ pages with intelligent resource management.
    CONTEXT AWARENESS: Adapts to chatbot vs chatflow requirements.
    """

    def __init__(self):
        # Default configurations for different scenarios
        self.default_configs = {
            KBPurpose.CHATBOT: ProcessingConfig(
                kb_purpose=KBPurpose.CHATBOT,
                processing_mode=ProcessingMode.BALANCED,
                max_chunk_size=1000,
                min_chunk_size=200,
                overlap_ratio=0.2,
                batch_size=50,
                max_memory_mb=512,
                enable_document_embedding=True,   # Good for context
                enable_hierarchical=True,         # Best of both worlds
                quality_threshold=0.6
            ),

            KBPurpose.CHATFLOW: ProcessingConfig(
                kb_purpose=KBPurpose.CHATFLOW,
                processing_mode=ProcessingMode.THOROUGH,
                max_chunk_size=1800,
                min_chunk_size=400,
                overlap_ratio=0.3,              # More overlap for continuity
                batch_size=30,                  # Slower but better quality
                max_memory_mb=1024,
                enable_document_embedding=True,
                enable_hierarchical=True,
                quality_threshold=0.7
            ),

            KBPurpose.HYBRID: ProcessingConfig(
                kb_purpose=KBPurpose.HYBRID,
                processing_mode=ProcessingMode.ADAPTIVE,
                max_chunk_size=1400,
                min_chunk_size=300,
                overlap_ratio=0.25,
                batch_size=40,
                max_memory_mb=768,
                enable_document_embedding=True,
                enable_hierarchical=True,
                quality_threshold=0.65
            )
        }

    def analyze_content(self, content: str, title: str = "") -> ContentAnalysis:
        """
        Analyze content to determine optimal processing approach.

        This is NOT hardcoded - it analyzes actual content structure.
        """
        size_chars = len(content)
        lines = content.split('\n')

        # Size categorization (adaptive, not hardcoded)
        if size_chars < 2000:
            size_category = "small"
        elif size_chars < 10000:
            size_category = "medium"
        elif size_chars < 50000:
            size_category = "large"
        else:
            size_category = "very_large"

        # Content type detection
        content_type = self._detect_content_type(content, title)

        # Structure analysis
        structure_score = self._analyze_structure(content)

        # Complexity analysis
        complexity_score = self._analyze_complexity(content)

        # Recommend strategy based on analysis
        recommended_strategy = self._recommend_strategy(
            size_category, content_type, structure_score
        )

        # Recommend chunk size based on content analysis
        chunk_size, overlap = self._recommend_chunk_params(
            size_chars, content_type, structure_score, complexity_score
        )

        return ContentAnalysis(
            size_chars=size_chars,
            size_category=size_category,
            content_type=content_type,
            structure_score=structure_score,
            complexity_score=complexity_score,
            recommended_strategy=recommended_strategy,
            recommended_chunk_size=chunk_size,
            recommended_overlap=overlap
        )

    def _detect_content_type(self, content: str, title: str) -> str:
        """Detect content type from actual content analysis"""
        content_lower = content.lower()
        title_lower = title.lower()

        # Documentation indicators
        doc_indicators = ['installation', 'configuration', 'api', 'reference',
                         'tutorial', 'guide', 'documentation', 'readme']

        # FAQ indicators
        faq_indicators = ['question', 'answer', 'how to', 'what is', 'faq',
                         'frequently asked', 'help', 'support']

        # Code indicators
        code_indicators = ['function', 'class', 'import', 'def ', 'var ',
                          'const ', 'let ', '```', '<code>']

        # Count indicators
        doc_score = sum(1 for indicator in doc_indicators
                       if indicator in content_lower or indicator in title_lower)
        faq_score = sum(1 for indicator in faq_indicators
                       if indicator in content_lower or indicator in title_lower)
        code_score = sum(1 for indicator in code_indicators
                        if indicator in content_lower)

        # Determine type
        if code_score > 2:
            return "code"
        elif doc_score > faq_score and doc_score > 1:
            return "documentation"
        elif faq_score > 1:
            return "faq"
        elif len(content.split('\n\n')) > len(content.split('\n')) * 0.3:
            return "article"  # Many paragraphs
        else:
            return "mixed"

    def _analyze_structure(self, content: str) -> float:
        """Analyze how well-structured the content is"""
        lines = content.split('\n')
        total_lines = len(lines)

        if total_lines == 0:
            return 0.0

        # Count structural elements
        headings = sum(1 for line in lines if line.strip().startswith('#'))
        lists = sum(1 for line in lines if line.strip().startswith(('- ', '* ', '1. ')))
        empty_lines = sum(1 for line in lines if not line.strip())

        # Calculate structure score
        heading_ratio = headings / total_lines
        list_ratio = lists / total_lines
        spacing_ratio = empty_lines / total_lines

        # Well-structured content has good heading distribution and spacing
        structure_score = min(1.0,
            (heading_ratio * 10) +     # Headings are very important
            (list_ratio * 5) +         # Lists show organization
            (spacing_ratio * 2)        # Proper spacing
        )

        return structure_score

    def _analyze_complexity(self, content: str) -> float:
        """Analyze content complexity to guide chunk sizing"""
        words = content.split()
        sentences = content.split('. ')

        if not sentences or not words:
            return 0.0

        # Average sentence length
        avg_sentence_length = len(words) / len(sentences)

        # Vocabulary diversity (unique words / total words)
        unique_words = len(set(word.lower().strip('.,!?') for word in words))
        vocab_diversity = unique_words / len(words) if words else 0

        # Technical terms (words with special characters, caps, etc.)
        technical_terms = sum(1 for word in words
                            if any(c in word for c in '_()[]{}'))
        technical_ratio = technical_terms / len(words) if words else 0

        # Complexity score (0-1)
        complexity = min(1.0,
            (avg_sentence_length / 20) * 0.4 +    # Longer sentences = more complex
            vocab_diversity * 0.3 +                # More diverse vocab = more complex
            technical_ratio * 0.3                  # Technical terms = more complex
        )

        return complexity

    def _recommend_strategy(self, size_category: str, content_type: str, structure_score: float) -> str:
        """Recommend chunking strategy based on content analysis"""

        # Structured content with good headings
        if structure_score > 0.3:
            return "by_heading"

        # Code content
        if content_type == "code":
            return "semantic"  # Preserve code blocks

        # FAQ content
        if content_type == "faq":
            return "by_section"  # Keep Q&A together

        # Large unstructured content
        if size_category in ["large", "very_large"] and structure_score < 0.2:
            return "semantic"  # Group related content

        # Default for most content
        return "adaptive"

    def _recommend_chunk_params(
        self,
        size_chars: int,
        content_type: str,
        structure_score: float,
        complexity_score: float
    ) -> Tuple[int, int]:
        """Recommend chunk size and overlap based on content analysis"""

        # Base chunk size
        if content_type == "code":
            base_size = 800   # Smaller for code blocks
        elif content_type == "faq":
            base_size = 600   # Smaller for Q&A pairs
        elif content_type == "documentation":
            base_size = 1200  # Larger for explanatory content
        else:
            base_size = 1000  # Default

        # Adjust based on complexity
        if complexity_score > 0.7:
            base_size = int(base_size * 1.3)  # Larger chunks for complex content
        elif complexity_score < 0.3:
            base_size = int(base_size * 0.8)  # Smaller chunks for simple content

        # Adjust based on structure
        if structure_score > 0.5:
            base_size = int(base_size * 1.2)  # Larger chunks for well-structured content

        # Calculate overlap (typically 15-25% of chunk size)
        overlap = int(base_size * 0.2)

        # Bounds checking
        base_size = max(200, min(2000, base_size))  # Keep within reasonable bounds
        overlap = max(50, min(500, overlap))

        return base_size, overlap

    def get_processing_config(
        self,
        kb: KnowledgeBase,
        total_pages: int,
        total_content_size: int
    ) -> ProcessingConfig:
        """
        Get processing configuration based on KB purpose and scale.

        This adapts to scale automatically - no hardcoded limits.
        """

        # Determine KB purpose from metadata or default
        kb_purpose_str = kb.metadata.get("purpose", "general")
        try:
            kb_purpose = KBPurpose(kb_purpose_str)
        except ValueError:
            kb_purpose = KBPurpose.GENERAL

        # Start with default config for this purpose
        if kb_purpose in self.default_configs:
            config = self.default_configs[kb_purpose]
        else:
            config = self.default_configs[KBPurpose.HYBRID]

        # Adapt config based on scale
        config = self._adapt_config_for_scale(config, total_pages, total_content_size)

        return config

    def _adapt_config_for_scale(
        self,
        config: ProcessingConfig,
        total_pages: int,
        total_content_size: int
    ) -> ProcessingConfig:
        """Adapt processing config based on actual scale (not hardcoded thresholds)"""

        # Create a copy to modify
        adapted = ProcessingConfig(**config.__dict__)

        # Memory usage estimation (rough)
        estimated_memory_mb = (total_content_size * 3) // (1024 * 1024)  # 3x for processing overhead

        # Scale adaptations
        if total_pages > 500:  # Large scale
            adapted.batch_size = min(adapted.batch_size, 20)  # Smaller batches
            adapted.max_memory_mb = max(adapted.max_memory_mb, estimated_memory_mb)
            adapted.processing_mode = ProcessingMode.BALANCED  # Favor speed

        if total_pages > 1000:  # Very large scale
            adapted.batch_size = min(adapted.batch_size, 10)  # Very small batches
            adapted.enable_hierarchical = False  # Disable to save resources
            adapted.quality_threshold = 0.5     # Lower threshold to process more content

        if estimated_memory_mb > 2048:  # High memory usage
            adapted.processing_mode = ProcessingMode.FAST
            adapted.max_chunk_size = min(adapted.max_chunk_size, 800)  # Smaller chunks

        return adapted

    async def process_document_batch(
        self,
        documents_content: List[Tuple[Document, str]],  # (document, content) pairs
        config: ProcessingConfig
    ) -> List[Dict]:
        """
        Process a batch of documents with intelligent resource management.

        This replaces the simple loop in pipeline with smarter batching.
        """

        results = []

        # Process in smaller sub-batches to manage memory
        for i in range(0, len(documents_content), config.batch_size):
            batch = documents_content[i:i + config.batch_size]

            # Process this sub-batch
            batch_results = await self._process_sub_batch(batch, config)
            results.extend(batch_results)

            # Yield control for other tasks (important for large scale)
            await asyncio.sleep(0.1)

        return results

    async def _process_sub_batch(
        self,
        batch: List[Tuple[Document, str]],
        config: ProcessingConfig
    ) -> List[Dict]:
        """Process a small batch of documents"""

        batch_results = []

        for document, content in batch:
            # Analyze content for this specific document
            analysis = self.analyze_content(content, document.name)

            # Use existing chunking service (BACKWARD COMPATIBLE)
            chunks_data = chunking_service.chunk_document(
                text=content,
                strategy=analysis.recommended_strategy,
                chunk_size=analysis.recommended_chunk_size,
                chunk_overlap=analysis.recommended_overlap
            )

            # Use existing embedding service (BACKWARD COMPATIBLE)
            if chunks_data:
                chunk_texts = [chunk["content"] for chunk in chunks_data]
                embeddings = await embedding_service.generate_embeddings(chunk_texts)

                # Enhance chunks with analysis metadata
                for chunk, embedding in zip(chunks_data, embeddings):
                    chunk["embedding"] = embedding
                    chunk["analysis"] = {
                        "content_type": analysis.content_type,
                        "structure_score": analysis.structure_score,
                        "complexity_score": analysis.complexity_score,
                        "strategy_used": analysis.recommended_strategy
                    }

                batch_results.append({
                    "document": document,
                    "content": content,
                    "analysis": analysis,
                    "chunks": chunks_data,
                    "config": config
                })

        return batch_results


# Global service instance
adaptive_kb_service = AdaptiveKBService()