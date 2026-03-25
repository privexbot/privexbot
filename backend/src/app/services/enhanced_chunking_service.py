"""
Enhanced Chunking Service - Structure-aware chunking with rich metadata.

WHY:
- Add structure-aware metadata to chunks
- Preserve context between chunks
- Provide document analysis for better strategy selection
- Maintain backward compatibility with existing chunking_service

HOW:
- Wraps existing chunking_service.py (no duplication)
- Adds DocumentChunk dataclass with rich metadata
- Adds context preservation (before/after chunk summaries)
- Adds document structure analysis

USAGE:
    # Simple usage (delegates to chunking_service)
    service = EnhancedChunkingService()
    chunks = service.chunk_document(content, strategy="adaptive", chunk_size=1000)

    # With enhanced features
    chunks = service.chunk_document_with_context(content, strategy="semantic")

BACKWARD COMPATIBILITY:
- All methods return standard format compatible with existing pipeline
- Can be used as drop-in replacement for chunking_service
"""

from typing import List, Optional, Dict, Any
from dataclasses import dataclass, field
from enum import Enum
import re

from app.services.chunking_service import (
    chunking_service,
    ChunkingService,
    ChunkingConfig,
    DEFAULT_CHUNKING_CONFIG
)


# ============================================================================
# ENUMS AND DATACLASSES
# ============================================================================

class ChunkingStrategy(Enum):
    """Available chunking strategies (maps to chunking_service)."""
    RECURSIVE = "recursive"
    SEMANTIC = "semantic"
    BY_HEADING = "by_heading"
    BY_SECTION = "by_section"
    ADAPTIVE = "adaptive"
    SENTENCE_BASED = "sentence_based"
    PARAGRAPH_BASED = "paragraph_based"
    HYBRID = "hybrid"
    NO_CHUNKING = "no_chunking"
    FULL_CONTENT = "full_content"
    TOKEN = "token"


@dataclass
class EnhancedChunkConfig:
    """
    Enhanced chunking configuration.

    Extends ChunkingConfig with additional options for context and metadata.
    """
    # Core settings (passed to chunking_service)
    strategy: str = "adaptive"
    chunk_size: int = 1000
    chunk_overlap: int = 200

    # Enhanced features
    include_context: bool = True  # Add context_before/context_after
    context_chars: int = 100  # Characters of context to include
    include_metadata: bool = True  # Add rich metadata
    analyze_structure: bool = True  # Analyze document structure

    # Passed through to chunking_service config
    semantic_threshold: float = 0.65
    min_chunk_size: int = 50

    def to_chunking_config_dict(self) -> Dict[str, Any]:
        """Convert to dict for chunking_service."""
        return {
            "semantic_threshold": self.semantic_threshold,
            "min_chunk_size": self.min_chunk_size,
            "default_chunk_size": self.chunk_size,
            "default_chunk_overlap": self.chunk_overlap
        }


@dataclass
class DocumentChunk:
    """
    Enhanced chunk with structure and context information.

    Designed for rich retrieval and context preservation.
    """
    content: str
    index: int
    metadata: Dict[str, Any] = field(default_factory=dict)

    # Context fields (optional)
    context_before: Optional[str] = None
    context_after: Optional[str] = None

    # Structure fields (optional)
    parent_heading: Optional[str] = None
    section_title: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to standard chunk dict format for pipeline compatibility."""
        result = {
            "content": self.content,
            "index": self.index,
            "token_count": len(self.content) // 4,  # Estimate
            "metadata": self.metadata.copy()
        }

        # Add optional fields to metadata
        if self.context_before:
            result["metadata"]["context_before"] = self.context_before
        if self.context_after:
            result["metadata"]["context_after"] = self.context_after
        if self.parent_heading:
            result["metadata"]["parent_heading"] = self.parent_heading
        if self.section_title:
            result["metadata"]["section_title"] = self.section_title

        return result

    @classmethod
    def from_chunk_dict(cls, chunk_dict: Dict[str, Any]) -> "DocumentChunk":
        """Create from standard chunk dict."""
        return cls(
            content=chunk_dict.get("content", ""),
            index=chunk_dict.get("index", 0),
            metadata=chunk_dict.get("metadata", {})
        )


@dataclass
class DocumentAnalysis:
    """Analysis of document structure for strategy selection."""
    total_chars: int = 0
    total_lines: int = 0
    heading_count: int = 0
    heading_density: float = 0.0
    paragraph_count: int = 0
    avg_paragraph_length: float = 0.0
    code_block_count: int = 0
    list_item_count: int = 0
    recommended_strategy: str = "adaptive"
    reasoning: str = ""

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "total_chars": self.total_chars,
            "total_lines": self.total_lines,
            "heading_count": self.heading_count,
            "heading_density": self.heading_density,
            "paragraph_count": self.paragraph_count,
            "avg_paragraph_length": self.avg_paragraph_length,
            "code_block_count": self.code_block_count,
            "list_item_count": self.list_item_count,
            "recommended_strategy": self.recommended_strategy,
            "reasoning": self.reasoning
        }


# ============================================================================
# ENHANCED CHUNKING SERVICE
# ============================================================================

class EnhancedChunkingService:
    """
    Structure-aware document chunking with rich metadata.

    WRAPS: chunking_service.py (delegates actual chunking)
    ADDS: Rich metadata, context preservation, document analysis

    BACKWARD COMPATIBLE: Returns same format as chunking_service
    """

    def __init__(self, config: Optional[ChunkingConfig] = None):
        """
        Initialize enhanced chunking service.

        Args:
            config: Base chunking configuration (optional)
        """
        self._chunking_service = ChunkingService(config)

    def chunk_document(
        self,
        text: str,
        strategy: str = "adaptive",
        chunk_size: int = None,
        chunk_overlap: int = None,
        config: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """
        Chunk document using specified strategy.

        DELEGATES TO: chunking_service.chunk_document()
        BACKWARD COMPATIBLE: Same signature and return format

        Args:
            text: Document text to chunk
            strategy: Chunking strategy name
            chunk_size: Target chunk size (None = use default)
            chunk_overlap: Overlap between chunks (None = use default)
            config: Additional config options

        Returns:
            List of chunk dicts (standard format)
        """
        return self._chunking_service.chunk_document(
            text=text,
            strategy=strategy,
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            config=config
        )

    def chunk_document_enhanced(
        self,
        text: str,
        config: Optional[EnhancedChunkConfig] = None
    ) -> List[DocumentChunk]:
        """
        Chunk document with enhanced features (metadata, context).

        Args:
            text: Document text to chunk
            config: Enhanced chunking configuration

        Returns:
            List of DocumentChunk objects with rich metadata
        """
        config = config or EnhancedChunkConfig()

        # Get basic chunks from underlying service
        basic_chunks = self._chunking_service.chunk_document(
            text=text,
            strategy=config.strategy,
            chunk_size=config.chunk_size,
            chunk_overlap=config.chunk_overlap,
            config=config.to_chunking_config_dict()
        )

        # Analyze document structure if requested
        doc_analysis = None
        if config.analyze_structure:
            doc_analysis = self.analyze_document(text)

        # Convert to enhanced chunks with metadata
        enhanced_chunks = []
        for i, chunk_dict in enumerate(basic_chunks):
            enhanced_chunk = DocumentChunk.from_chunk_dict(chunk_dict)
            enhanced_chunk.index = i

            # Add rich metadata
            if config.include_metadata:
                enhanced_chunk.metadata.update({
                    "chunk_index": i,
                    "total_chunks": len(basic_chunks),
                    "chunk_length": len(enhanced_chunk.content),
                    "word_count": len(enhanced_chunk.content.split()),
                    "strategy_used": config.strategy
                })

                if doc_analysis:
                    enhanced_chunk.metadata["document_analysis"] = doc_analysis.to_dict()

            # Add context from surrounding chunks
            if config.include_context:
                enhanced_chunk.context_before = self._get_context_before(
                    basic_chunks, i, config.context_chars
                )
                enhanced_chunk.context_after = self._get_context_after(
                    basic_chunks, i, config.context_chars
                )

            # Extract parent heading from content
            enhanced_chunk.parent_heading = self._extract_parent_heading(
                enhanced_chunk.content
            )

            enhanced_chunks.append(enhanced_chunk)

        return enhanced_chunks

    def chunk_document_with_context(
        self,
        text: str,
        strategy: str = "adaptive",
        chunk_size: int = 1000,
        chunk_overlap: int = 200,
        context_chars: int = 100
    ) -> List[Dict[str, Any]]:
        """
        Chunk document and add context to each chunk.

        Convenience method that returns standard dict format with context added.

        Args:
            text: Document text
            strategy: Chunking strategy
            chunk_size: Target chunk size
            chunk_overlap: Overlap between chunks
            context_chars: Characters of context to include

        Returns:
            List of chunk dicts with context_before/context_after in metadata
        """
        config = EnhancedChunkConfig(
            strategy=strategy,
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            include_context=True,
            context_chars=context_chars
        )

        enhanced_chunks = self.chunk_document_enhanced(text, config)
        return [chunk.to_dict() for chunk in enhanced_chunks]

    def analyze_document(self, text: str) -> DocumentAnalysis:
        """
        Analyze document structure for strategy selection.

        Args:
            text: Document text to analyze

        Returns:
            DocumentAnalysis with structure metrics and recommended strategy
        """
        if not text:
            return DocumentAnalysis()

        lines = text.split("\n")
        paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]

        # Count structural elements
        heading_count = len([line for line in lines if line.strip().startswith("#")])
        code_blocks = len(re.findall(r'```[\s\S]*?```', text))
        list_items = len([line for line in lines if re.match(r'^\s*[-*•]\s', line)])

        total_lines = len(lines)
        heading_density = heading_count / total_lines if total_lines > 0 else 0

        paragraph_lengths = [len(p) for p in paragraphs]
        avg_para_length = sum(paragraph_lengths) / len(paragraph_lengths) if paragraph_lengths else 0

        # Determine recommended strategy with reasoning
        strategy, reasoning = self._recommend_strategy(
            heading_density=heading_density,
            paragraph_count=len(paragraphs),
            avg_paragraph_length=avg_para_length,
            code_block_count=code_blocks,
            total_chars=len(text)
        )

        return DocumentAnalysis(
            total_chars=len(text),
            total_lines=total_lines,
            heading_count=heading_count,
            heading_density=heading_density,
            paragraph_count=len(paragraphs),
            avg_paragraph_length=avg_para_length,
            code_block_count=code_blocks,
            list_item_count=list_items,
            recommended_strategy=strategy,
            reasoning=reasoning
        )

    def _recommend_strategy(
        self,
        heading_density: float,
        paragraph_count: int,
        avg_paragraph_length: float,
        code_block_count: int,
        total_chars: int
    ) -> tuple:
        """
        Recommend chunking strategy based on document characteristics.

        Returns:
            Tuple of (strategy_name, reasoning)
        """
        # Use adaptive thresholds from config
        config = self._chunking_service.config

        if heading_density > config.adaptive_heading_density_threshold:
            return ("by_heading", f"High heading density ({heading_density:.2%})")

        if paragraph_count > config.adaptive_paragraph_count_threshold:
            return ("paragraph_based", f"Many paragraphs ({paragraph_count})")

        if code_block_count > 3:
            return ("paragraph_based", f"Contains code blocks ({code_block_count})")

        if avg_paragraph_length > 500:
            return ("semantic", f"Long paragraphs (avg {avg_paragraph_length:.0f} chars)")

        if total_chars < 2000:
            return ("no_chunking", f"Short document ({total_chars} chars)")

        return ("recursive", "Default strategy for general content")

    def _get_context_before(
        self,
        chunks: List[Dict],
        index: int,
        max_chars: int
    ) -> Optional[str]:
        """Get context from previous chunk."""
        if index <= 0 or not chunks:
            return None

        prev_content = chunks[index - 1].get("content", "")
        if len(prev_content) <= max_chars:
            return prev_content

        # Get last max_chars characters
        return "..." + prev_content[-max_chars:]

    def _get_context_after(
        self,
        chunks: List[Dict],
        index: int,
        max_chars: int
    ) -> Optional[str]:
        """Get context from next chunk."""
        if index >= len(chunks) - 1:
            return None

        next_content = chunks[index + 1].get("content", "")
        if len(next_content) <= max_chars:
            return next_content

        # Get first max_chars characters
        return next_content[:max_chars] + "..."

    def _extract_parent_heading(self, content: str) -> Optional[str]:
        """Extract first heading from chunk content."""
        lines = content.split("\n")
        for line in lines:
            if line.strip().startswith("#"):
                # Remove markdown heading markers
                heading = re.sub(r'^#+\s*', '', line.strip())
                return heading[:100] if heading else None
        return None


# ============================================================================
# GLOBAL INSTANCE
# ============================================================================

# Global instance for convenience (backward compatible)
enhanced_chunking_service = EnhancedChunkingService()


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def get_chunking_strategies() -> List[Dict[str, Any]]:
    """
    Get list of available chunking strategies with descriptions.

    Returns:
        List of strategy info dicts
    """
    return [
        {
            "name": "recursive",
            "description": "Split by separators recursively (paragraphs → lines → words)",
            "best_for": "General content, fallback strategy"
        },
        {
            "name": "semantic",
            "description": "Split by semantic/topic boundaries using embeddings",
            "best_for": "Q&A, retrieval, unstructured content"
        },
        {
            "name": "by_heading",
            "description": "Split at heading boundaries (markdown #)",
            "best_for": "Documentation, articles with clear structure"
        },
        {
            "name": "by_section",
            "description": "Group content into logical sections",
            "best_for": "Technical guides, long documentation"
        },
        {
            "name": "adaptive",
            "description": "Auto-select strategy based on document analysis",
            "best_for": "Unknown/mixed content types"
        },
        {
            "name": "sentence_based",
            "description": "Split at sentence boundaries",
            "best_for": "Conversational content, chat logs"
        },
        {
            "name": "paragraph_based",
            "description": "Split at paragraph boundaries",
            "best_for": "Blogs, articles, content with clear paragraphs"
        },
        {
            "name": "hybrid",
            "description": "Combine heading + paragraph + recursive strategies",
            "best_for": "Complex documents with mixed structure"
        },
        {
            "name": "no_chunking",
            "description": "Keep document as single chunk",
            "best_for": "Short documents, FAQs"
        },
        {
            "name": "token",
            "description": "Split by token count (LLM context aware)",
            "best_for": "LLM prompt fitting, context windows"
        }
    ]
