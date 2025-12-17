"""
Configuration Schemas - Pydantic models for chunking and embedding configuration.

WHY:
- Validate user-provided configuration options
- Expose configurable parameters with sensible defaults
- Type safety and documentation
- Consistent configuration across API boundaries

HOW:
- Pydantic BaseModel with Field validators
- Default values match service layer defaults
- Validation ensures values are within valid ranges

USAGE:
    # In API routes
    from app.schemas.config import ChunkingConfigSchema, EmbeddingConfigSchema

    class UpdateKBConfigRequest(BaseModel):
        chunking_config: Optional[ChunkingConfigSchema] = None
        embedding_config: Optional[EmbeddingConfigSchema] = None
"""

from typing import Optional, Dict, Any, List, Literal
from pydantic import BaseModel, Field, field_validator
from enum import Enum


# ============================================================================
# ENUMS
# ============================================================================

class ChunkingStrategy(str, Enum):
    """Available chunking strategies."""
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


class EmbeddingModel(str, Enum):
    """
    Supported embedding models.

    All from sentence-transformers (same library, no additional dependencies).
    """
    # DEFAULT - Best balance of speed and quality
    ALL_MINILM_L6_V2 = "all-MiniLM-L6-v2"

    # HIGHER QUALITY - Slower but better semantic understanding
    ALL_MINILM_L12_V2 = "all-MiniLM-L12-v2"

    # HIGHEST QUALITY - Best quality but slower
    ALL_MPNET_BASE_V2 = "all-mpnet-base-v2"

    # MULTILINGUAL - For non-English content
    PARAPHRASE_MULTILINGUAL = "paraphrase-multilingual-MiniLM-L12-v2"


class RetrievalStrategy(str, Enum):
    """Available retrieval strategies."""
    SEMANTIC_SEARCH = "semantic_search"
    KEYWORD_SEARCH = "keyword_search"
    HYBRID_SEARCH = "hybrid_search"


# ============================================================================
# CHUNKING CONFIGURATION SCHEMA
# ============================================================================

class ChunkingConfigSchema(BaseModel):
    """
    Configuration schema for document chunking.

    WHY: Allow users to customize chunking behavior per KB
    HOW: Validate and provide defaults for all chunking parameters

    All parameters have sensible defaults - only override what you need.
    """

    # Core settings
    strategy: ChunkingStrategy = Field(
        default=ChunkingStrategy.ADAPTIVE,
        description="Chunking strategy to use"
    )

    chunk_size: int = Field(
        default=1000,
        ge=100,
        le=10000,
        description="Target chunk size in characters (100-10000)"
    )

    chunk_overlap: int = Field(
        default=200,
        ge=0,
        le=2000,
        description="Overlap between chunks in characters (0-2000)"
    )

    # Semantic chunking settings
    semantic_threshold: float = Field(
        default=0.65,
        ge=0.0,
        le=1.0,
        description="Similarity threshold for semantic chunking (0.0-1.0). "
                    "Higher values create more, smaller chunks. "
                    "Lower values create fewer, larger chunks."
    )

    semantic_min_paragraph_length: int = Field(
        default=20,
        ge=5,
        le=500,
        description="Minimum paragraph length for semantic chunking (5-500 chars)"
    )

    # Adaptive chunking thresholds
    adaptive_heading_density_threshold: float = Field(
        default=0.05,
        ge=0.0,
        le=1.0,
        description="Heading density threshold for adaptive strategy. "
                    "Above this, by_heading strategy is used."
    )

    adaptive_paragraph_count_threshold: int = Field(
        default=10,
        ge=1,
        le=100,
        description="Paragraph count threshold for adaptive strategy. "
                    "Above this, paragraph_based strategy is used."
    )

    # General settings
    min_chunk_size: int = Field(
        default=50,
        ge=10,
        le=500,
        description="Minimum chunk size in characters (10-500)"
    )

    max_chunk_size_multiplier: float = Field(
        default=1.5,
        ge=1.0,
        le=3.0,
        description="Maximum chunk size as multiplier of chunk_size (1.0-3.0)"
    )

    chars_per_token: int = Field(
        default=4,
        ge=2,
        le=10,
        description="Average characters per token for token estimation (2-10)"
    )

    @field_validator('chunk_overlap')
    @classmethod
    def validate_overlap(cls, v, info):
        """Ensure overlap is less than chunk size."""
        chunk_size = info.data.get('chunk_size', 1000)
        if v >= chunk_size:
            raise ValueError('chunk_overlap must be less than chunk_size')
        return v

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for service layer."""
        return {
            "strategy": self.strategy.value if isinstance(self.strategy, ChunkingStrategy) else self.strategy,
            "chunk_size": self.chunk_size,
            "chunk_overlap": self.chunk_overlap,
            "semantic_threshold": self.semantic_threshold,
            "semantic_min_paragraph_length": self.semantic_min_paragraph_length,
            "adaptive_heading_density_threshold": self.adaptive_heading_density_threshold,
            "adaptive_paragraph_count_threshold": self.adaptive_paragraph_count_threshold,
            "min_chunk_size": self.min_chunk_size,
            "max_chunk_size_multiplier": self.max_chunk_size_multiplier,
            "chars_per_token": self.chars_per_token
        }

    class Config:
        json_schema_extra = {
            "example": {
                "strategy": "semantic",
                "chunk_size": 1000,
                "chunk_overlap": 200,
                "semantic_threshold": 0.65
            }
        }


# ============================================================================
# EMBEDDING CONFIGURATION SCHEMA
# ============================================================================

class EmbeddingConfigSchema(BaseModel):
    """
    Configuration schema for embedding generation.

    WHY: Allow users to customize embedding model per KB
    HOW: Validate model selection and inference settings

    IMPORTANT: Once a KB is indexed with a model, queries MUST use the same model.
    Store model name in KB config for reference.
    """

    model_name: EmbeddingModel = Field(
        default=EmbeddingModel.ALL_MINILM_L6_V2,
        description="Embedding model to use. all-MiniLM-L6-v2 recommended for most use cases."
    )

    device: Literal["cpu", "cuda"] = Field(
        default="cpu",
        description="Device for model inference (cpu or cuda)"
    )

    batch_size: int = Field(
        default=32,
        ge=1,
        le=256,
        description="Batch size for encoding (1-256)"
    )

    normalize_embeddings: bool = Field(
        default=True,
        description="Normalize embeddings for cosine similarity"
    )

    num_threads: int = Field(
        default=4,
        ge=1,
        le=32,
        description="Number of CPU threads for inference (1-32)"
    )

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for service layer."""
        return {
            "model_name": self.model_name.value if isinstance(self.model_name, EmbeddingModel) else self.model_name,
            "device": self.device,
            "batch_size": self.batch_size,
            "normalize_embeddings": self.normalize_embeddings,
            "num_threads": self.num_threads
        }

    def get_model_info(self) -> Dict[str, Any]:
        """
        Get model specifications.

        Returns:
            Dict with dimensions, max_sequence_length, and quality info
        """
        model_specs = {
            "all-MiniLM-L6-v2": {
                "dimensions": 384,
                "max_sequence_length": 256,
                "speed": "fast",
                "quality": "good",
                "size_mb": 90,
                "description": "Fast, good quality - recommended for most use cases"
            },
            "all-MiniLM-L12-v2": {
                "dimensions": 384,
                "max_sequence_length": 256,
                "speed": "medium",
                "quality": "better",
                "size_mb": 120,
                "description": "Medium speed, better quality than L6"
            },
            "all-mpnet-base-v2": {
                "dimensions": 768,
                "max_sequence_length": 384,
                "speed": "slow",
                "quality": "best",
                "size_mb": 420,
                "description": "Slower but highest quality"
            },
            "paraphrase-multilingual-MiniLM-L12-v2": {
                "dimensions": 384,
                "max_sequence_length": 128,
                "speed": "medium",
                "quality": "good",
                "size_mb": 470,
                "description": "Multilingual support - 50+ languages"
            }
        }

        model_key = self.model_name.value if isinstance(self.model_name, EmbeddingModel) else self.model_name
        return model_specs.get(model_key, model_specs["all-MiniLM-L6-v2"])

    class Config:
        json_schema_extra = {
            "example": {
                "model_name": "all-MiniLM-L6-v2",
                "device": "cpu",
                "batch_size": 32,
                "normalize_embeddings": True,
                "num_threads": 4
            }
        }


# ============================================================================
# RETRIEVAL CONFIGURATION SCHEMA
# ============================================================================

class RetrievalConfigSchema(BaseModel):
    """
    Configuration schema for retrieval settings.

    WHY: Allow users to customize retrieval behavior per KB
    HOW: Validate search parameters and thresholds
    """

    top_k: int = Field(
        default=5,
        ge=1,
        le=100,
        description="Number of results to retrieve (1-100)"
    )

    strategy: RetrievalStrategy = Field(
        default=RetrievalStrategy.SEMANTIC_SEARCH,
        description="Search strategy to use"
    )

    score_threshold: float = Field(
        default=0.5,
        ge=0.0,
        le=1.0,
        description="Minimum similarity score to include in results (0.0-1.0)"
    )

    rerank_enabled: bool = Field(
        default=False,
        description="Enable re-ranking of results for better relevance"
    )

    include_metadata: bool = Field(
        default=True,
        description="Include chunk metadata in results"
    )

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for service layer."""
        return {
            "top_k": self.top_k,
            "strategy": self.strategy.value if isinstance(self.strategy, RetrievalStrategy) else self.strategy,
            "score_threshold": self.score_threshold,
            "rerank_enabled": self.rerank_enabled,
            "include_metadata": self.include_metadata
        }

    class Config:
        json_schema_extra = {
            "example": {
                "top_k": 5,
                "strategy": "hybrid_search",
                "score_threshold": 0.7,
                "rerank_enabled": False
            }
        }


# ============================================================================
# COMBINED KB CONFIGURATION SCHEMA
# ============================================================================

class KBConfigSchema(BaseModel):
    """
    Combined configuration schema for Knowledge Base.

    WHY: Single schema for all KB configuration options
    HOW: Compose chunking, embedding, and retrieval configs
    """

    chunking_config: Optional[ChunkingConfigSchema] = Field(
        default=None,
        description="Chunking configuration (optional, uses defaults if not provided)"
    )

    embedding_config: Optional[EmbeddingConfigSchema] = Field(
        default=None,
        description="Embedding configuration (optional, uses defaults if not provided)"
    )

    retrieval_config: Optional[RetrievalConfigSchema] = Field(
        default=None,
        description="Retrieval configuration (optional, uses defaults if not provided)"
    )

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for storage."""
        result = {}

        if self.chunking_config:
            result["chunking_config"] = self.chunking_config.to_dict()

        if self.embedding_config:
            result["embedding_config"] = self.embedding_config.to_dict()

        if self.retrieval_config:
            result["retrieval_config"] = self.retrieval_config.to_dict()

        return result

    class Config:
        json_schema_extra = {
            "example": {
                "chunking_config": {
                    "strategy": "semantic",
                    "chunk_size": 1000,
                    "semantic_threshold": 0.7
                },
                "embedding_config": {
                    "model_name": "all-MiniLM-L6-v2",
                    "device": "cpu"
                },
                "retrieval_config": {
                    "top_k": 5,
                    "strategy": "hybrid_search",
                    "score_threshold": 0.7
                }
            }
        }


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def get_available_chunking_strategies() -> List[Dict[str, Any]]:
    """
    Get list of available chunking strategies with descriptions.

    Returns:
        List of strategy info dicts
    """
    return [
        {
            "value": "recursive",
            "name": "Recursive",
            "description": "Split by separators recursively (paragraphs → lines → words)",
            "best_for": "General content, fallback strategy"
        },
        {
            "value": "semantic",
            "name": "Semantic",
            "description": "Split by semantic/topic boundaries using embeddings",
            "best_for": "Q&A, retrieval, unstructured content"
        },
        {
            "value": "by_heading",
            "name": "By Heading",
            "description": "Split at heading boundaries (markdown #)",
            "best_for": "Documentation, articles with clear structure"
        },
        {
            "value": "by_section",
            "name": "By Section",
            "description": "Group content into logical sections",
            "best_for": "Technical guides, long documentation"
        },
        {
            "value": "adaptive",
            "name": "Adaptive",
            "description": "Auto-select strategy based on document analysis",
            "best_for": "Unknown/mixed content types"
        },
        {
            "value": "sentence_based",
            "name": "Sentence-Based",
            "description": "Split at sentence boundaries",
            "best_for": "Conversational content, chat logs"
        },
        {
            "value": "paragraph_based",
            "name": "Paragraph-Based",
            "description": "Split at paragraph boundaries",
            "best_for": "Blogs, articles, content with clear paragraphs"
        },
        {
            "value": "hybrid",
            "name": "Hybrid",
            "description": "Combine heading + paragraph + recursive strategies",
            "best_for": "Complex documents with mixed structure"
        },
        {
            "value": "no_chunking",
            "name": "No Chunking",
            "description": "Keep document as single chunk",
            "best_for": "Short documents, FAQs"
        },
        {
            "value": "full_content",
            "name": "Full Content",
            "description": "Alias for no_chunking - keeps full document",
            "best_for": "Short documents, FAQs"
        },
        {
            "value": "token",
            "name": "Token-Based",
            "description": "Split by token count (LLM context aware)",
            "best_for": "LLM prompt fitting, context windows"
        }
    ]


def get_available_embedding_models() -> List[Dict[str, Any]]:
    """
    Get list of available embedding models with specifications.

    Returns:
        List of model info dicts
    """
    return [
        {
            "value": "all-MiniLM-L6-v2",
            "name": "all-MiniLM-L6-v2 (Recommended)",
            "dimensions": 384,
            "max_sequence_length": 256,
            "speed": "fast",
            "quality": "good",
            "size_mb": 90,
            "description": "Fast, good quality - recommended for most use cases"
        },
        {
            "value": "all-MiniLM-L12-v2",
            "name": "all-MiniLM-L12-v2",
            "dimensions": 384,
            "max_sequence_length": 256,
            "speed": "medium",
            "quality": "better",
            "size_mb": 120,
            "description": "Medium speed, better quality than L6"
        },
        {
            "value": "all-mpnet-base-v2",
            "name": "all-mpnet-base-v2",
            "dimensions": 768,
            "max_sequence_length": 384,
            "speed": "slow",
            "quality": "best",
            "size_mb": 420,
            "description": "Slower but highest quality - for quality-critical applications"
        },
        {
            "value": "paraphrase-multilingual-MiniLM-L12-v2",
            "name": "Multilingual MiniLM-L12-v2",
            "dimensions": 384,
            "max_sequence_length": 128,
            "speed": "medium",
            "quality": "good",
            "size_mb": 470,
            "description": "Multilingual support - 50+ languages"
        }
    ]


def get_available_retrieval_strategies() -> List[Dict[str, Any]]:
    """
    Get list of available retrieval strategies with descriptions.

    Returns:
        List of strategy info dicts
    """
    return [
        {
            "value": "semantic_search",
            "name": "Semantic Search",
            "description": "Vector similarity search using embeddings",
            "best_for": "Natural language queries, understanding intent"
        },
        {
            "value": "keyword_search",
            "name": "Keyword Search",
            "description": "Text-based keyword matching",
            "best_for": "Exact phrase matching, technical terms"
        },
        {
            "value": "hybrid_search",
            "name": "Hybrid Search",
            "description": "Combines semantic and keyword search",
            "best_for": "Best of both worlds - recommended for most use cases"
        }
    ]
