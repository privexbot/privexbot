"""
Local Embedding Service - Self-hosted embedding generation using sentence-transformers.

WHY:
- Privacy-focused (no external API calls)
- Cost-effective (no per-token charges)
- CPU-optimized for production use
- Fully local processing

HOW:
- Uses sentence-transformers library
- Configurable model selection (default: all-MiniLM-L6-v2)
- CPU-optimized with PyTorch
- Batch processing for efficiency

KEY FEATURES:
- Self-hosted embedding generation
- Configurable model selection
- ~100 chunks/second on 4-core CPU
- Model cached after first load
- Batch processing support
- Normalized embeddings for cosine similarity

CONFIGURATION:
- Model can be set via EMBEDDING_MODEL env var or config
- See SUPPORTED_MODELS for available options
- All models use same library (no additional dependencies)

IMPORTANT - MODEL CONSISTENCY:
- Once a KB is indexed with a model, queries MUST use the same model
- Store model name in KB config for reference
- Default model is recommended for new deployments
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from sentence_transformers import SentenceTransformer
import torch
import numpy as np
from datetime import datetime
import os


# ============================================================================
# SUPPORTED MODELS
# ============================================================================
# All models are from sentence-transformers (same library, no new deps)
# Choose based on quality vs speed tradeoff

SUPPORTED_MODELS: Dict[str, Dict[str, Any]] = {
    # DEFAULT - Best balance of speed and quality
    "all-MiniLM-L6-v2": {
        "dimensions": 384,
        "max_sequence_length": 256,
        "speed": "fast",
        "quality": "good",
        "size_mb": 90,
        "description": "Fast, good quality - recommended for most use cases"
    },
    # HIGHER QUALITY - Slower but better semantic understanding
    "all-MiniLM-L12-v2": {
        "dimensions": 384,
        "max_sequence_length": 256,
        "speed": "medium",
        "quality": "better",
        "size_mb": 120,
        "description": "Medium speed, better quality than L6"
    },
    # HIGHEST QUALITY - Best quality but slower
    "all-mpnet-base-v2": {
        "dimensions": 768,
        "max_sequence_length": 384,
        "speed": "slow",
        "quality": "best",
        "size_mb": 420,
        "description": "Slower but highest quality - for quality-critical applications"
    },
    # MULTILINGUAL - For non-English content
    "paraphrase-multilingual-MiniLM-L12-v2": {
        "dimensions": 384,
        "max_sequence_length": 128,
        "speed": "medium",
        "quality": "good",
        "size_mb": 470,
        "description": "Multilingual support - 50+ languages"
    }
}

# Default model (can be overridden via env var)
DEFAULT_MODEL = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")


class EmbeddingConfig(BaseModel):
    """Configuration for local embedding generation"""

    model_name: str = Field(
        default=DEFAULT_MODEL,
        description="SentenceTransformer model name (see SUPPORTED_MODELS)"
    )
    device: str = Field(
        default="cpu",
        description="Device to run model on: 'cpu' or 'cuda'"
    )
    batch_size: int = Field(
        default=32,
        description="Batch size for encoding"
    )
    normalize_embeddings: bool = Field(
        default=True,
        description="Normalize embeddings for cosine similarity"
    )
    show_progress: bool = Field(
        default=False,
        description="Show progress bar during encoding"
    )
    num_threads: int = Field(
        default=4,
        description="Number of CPU threads for inference"
    )

    def to_dict(self) -> Dict[str, Any]:
        """Convert config to dictionary for serialization."""
        return {
            "model_name": self.model_name,
            "device": self.device,
            "batch_size": self.batch_size,
            "normalize_embeddings": self.normalize_embeddings,
            "show_progress": self.show_progress,
            "num_threads": self.num_threads
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "EmbeddingConfig":
        """Create config from dictionary."""
        return cls(
            model_name=data.get("model_name", DEFAULT_MODEL),
            device=data.get("device", "cpu"),
            batch_size=data.get("batch_size", 32),
            normalize_embeddings=data.get("normalize_embeddings", True),
            show_progress=data.get("show_progress", False),
            num_threads=data.get("num_threads", 4)
        )


class LocalEmbeddingService:
    """
    Self-hosted embedding generation using sentence-transformers.

    PRIVACY: Model runs locally, no API calls.
    PERFORMANCE: Configurable (default ~100 chunks/second on 4-core CPU).
    COST: Free (model cached after first load).

    CONFIGURATION:
    - Model selection via config or EMBEDDING_MODEL env var
    - See SUPPORTED_MODELS for available options
    - All models from same library (no additional dependencies)

    IMPORTANT:
    - KBs indexed with one model MUST be queried with the same model
    - Store model name in KB config for consistency
    """

    def __init__(self, config: Optional[EmbeddingConfig] = None):
        """
        Initialize local embedding service.

        Args:
            config: Embedding configuration (optional)
        """
        self.config = config or EmbeddingConfig()
        self.model: Optional[SentenceTransformer] = None
        self._validate_model_name()
        # Model loads on first use, not at import time (prevents OOM during startup)

    def _ensure_model_loaded(self):
        """Load model on first use (lazy initialization)."""
        if self.model is not None:
            return
        self._initialize_model()

    def _validate_model_name(self):
        """Validate model name and warn if unsupported."""
        model_name = self.config.model_name
        if model_name not in SUPPORTED_MODELS:
            print(f"[EmbeddingService] WARNING: Model '{model_name}' not in SUPPORTED_MODELS list.")
            print(f"[EmbeddingService] Supported models: {list(SUPPORTED_MODELS.keys())}")
            print(f"[EmbeddingService] Will attempt to load anyway (sentence-transformers may support it).")

    def _initialize_model(self):
        """Load and configure the embedding model"""

        print(f"[EmbeddingService] Loading model: {self.config.model_name}")
        print(f"[EmbeddingService] Device: {self.config.device}")

        # Log model info if available
        if self.config.model_name in SUPPORTED_MODELS:
            model_info = SUPPORTED_MODELS[self.config.model_name]
            print(f"[EmbeddingService] Model info: {model_info['description']}")
            print(f"[EmbeddingService] Expected dimensions: {model_info['dimensions']}")

        # Load model (cached in ~/.cache/torch/sentence_transformers/)
        self.model = SentenceTransformer(
            self.config.model_name,
            device=self.config.device
        )

        # Set to evaluation mode (no training)
        self.model.eval()

        # Optimize for CPU if using CPU
        if self.config.device == "cpu":
            # Use configurable thread count for better CPU performance
            torch.set_num_threads(self.config.num_threads)
            print(f"[EmbeddingService] CPU threads: {self.config.num_threads}")

        print(f"[EmbeddingService] Model loaded successfully")
        print(f"[EmbeddingService] Embedding dimension: {self.get_embedding_dimension()}")

    def get_embedding_dimension(self) -> int:
        """
        Get the embedding dimension for this model.

        Returns:
            int: Embedding dimension (e.g., 384 for all-MiniLM-L6-v2)
        """
        self._ensure_model_loaded()

        return self.model.get_sentence_embedding_dimension()

    def get_max_sequence_length(self) -> int:
        """
        Get the maximum sequence length (tokens) for this model.

        Returns:
            int: Maximum sequence length
        """
        self._ensure_model_loaded()

        return self.model.max_seq_length

    async def generate_embeddings(
        self,
        texts: List[str],
        show_progress: Optional[bool] = None,
        batch_size: Optional[int] = None
    ) -> List[List[float]]:
        """
        Generate embeddings for a list of texts.

        Args:
            texts: List of texts to embed
            show_progress: Show progress bar (overrides config)
            batch_size: Batch size (overrides config)

        Returns:
            List of embeddings (each embedding is a list of floats)

        Example:
            texts = ["How do I reset my password?", "What is the pricing?"]
            embeddings = await service.generate_embeddings(texts)
            # Returns: [[0.1, 0.2, ...], [0.3, 0.4, ...]]
        """

        if not texts:
            return []

        self._ensure_model_loaded()

        # Use provided params or config defaults
        show_progress_bar = show_progress if show_progress is not None else self.config.show_progress
        batch_size_value = batch_size if batch_size is not None else self.config.batch_size

        # Generate embeddings
        embeddings = self.model.encode(
            texts,
            batch_size=batch_size_value,
            show_progress_bar=show_progress_bar,
            convert_to_numpy=True,
            normalize_embeddings=self.config.normalize_embeddings
        )

        # Convert numpy arrays to lists of floats
        return embeddings.tolist()

    async def generate_embedding(self, text: str) -> List[float]:
        """
        Generate embedding for a single text.

        Args:
            text: Text to embed

        Returns:
            Embedding as list of floats

        Example:
            text = "How do I reset my password?"
            embedding = await service.generate_embedding(text)
            # Returns: [0.1, 0.2, 0.3, ...]
        """

        embeddings = await self.generate_embeddings([text], show_progress=False)
        return embeddings[0] if embeddings else []

    async def generate_query_embedding(self, query: str) -> List[float]:
        """
        Generate embedding for a search query.

        Note: For most sentence-transformer models, query and document
        embeddings are generated the same way. Some models have separate
        query/passage modes, but all-MiniLM-L6-v2 does not.

        Args:
            query: Search query text

        Returns:
            Query embedding as list of floats
        """

        return await self.generate_embedding(query)

    async def compute_similarity(
        self,
        embedding1: List[float],
        embedding2: List[float]
    ) -> float:
        """
        Compute cosine similarity between two embeddings.

        Args:
            embedding1: First embedding
            embedding2: Second embedding

        Returns:
            Similarity score (0-1, higher is more similar)

        Note: Only works with normalized embeddings.
        """

        if not self.config.normalize_embeddings:
            raise ValueError("Similarity computation requires normalized embeddings")

        # Cosine similarity for normalized vectors is just dot product
        return float(np.dot(embedding1, embedding2))

    def get_model_info(self) -> dict:
        """
        Get information about the loaded model.

        Returns:
            Dict with model information (suitable for storing in KB config)
        """

        self._ensure_model_loaded()

        info = {
            "model_name": self.config.model_name,
            "device": self.config.device,
            "embedding_dimension": self.get_embedding_dimension(),
            "max_sequence_length": self.get_max_sequence_length(),
            "batch_size": self.config.batch_size,
            "normalize_embeddings": self.config.normalize_embeddings,
            "num_threads": self.config.num_threads
        }

        # Add model details from SUPPORTED_MODELS if available
        if self.config.model_name in SUPPORTED_MODELS:
            model_details = SUPPORTED_MODELS[self.config.model_name]
            info["speed"] = model_details.get("speed")
            info["quality"] = model_details.get("quality")
            info["description"] = model_details.get("description")

        return info

    @staticmethod
    def get_supported_models() -> Dict[str, Dict[str, Any]]:
        """
        Get list of supported embedding models.

        Returns:
            Dict of model names to their specifications
        """
        return SUPPORTED_MODELS.copy()

    @staticmethod
    def get_model_for_kb_config() -> Dict[str, Any]:
        """
        Get minimal model info for storing in KB config.

        Use this to record which model was used for indexing,
        ensuring query embeddings use the same model.

        Returns:
            Dict with model_name and embedding_dimension
        """
        return {
            "model_name": DEFAULT_MODEL,
            "embedding_dimension": SUPPORTED_MODELS.get(DEFAULT_MODEL, {}).get("dimensions", 384)
        }

    @staticmethod
    def validate_embedding_config(config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validate and sanitize embedding configuration values.

        WHY: Prevent invalid configurations from causing errors
        HOW: Check types, ranges, and allowed values; return sanitized config

        ARGS:
            config: Raw embedding_config from KB or caller

        RETURNS:
            Sanitized config with invalid values corrected to defaults

        VALIDATION RULES:
            - model_name: str, must be in SUPPORTED_MODELS (warns if not)
            - device: str, must be 'cpu' or 'cuda'
            - batch_size: int, 1-256 (default: 32)
            - normalize_embeddings: bool (default: True)
            - num_threads: int, 1-32 (default: 4)
        """
        if not config:
            return {}

        # Define validation constraints
        constraints = {
            "model_name": {
                "type": str,
                "allowed": list(SUPPORTED_MODELS.keys()),
                "warn_only": True  # Allow unknown models (they might still work)
            },
            "device": {
                "type": str,
                "allowed": ["cpu", "cuda"]
            },
            "batch_size": {"type": int, "min": 1, "max": 256},
            "normalize_embeddings": {"type": bool},
            "num_threads": {"type": int, "min": 1, "max": 32},
            "show_progress": {"type": bool},
        }

        validated = {}
        warnings = []

        for key, value in config.items():
            if key not in constraints:
                # Unknown key - pass through (forward compatibility)
                validated[key] = value
                continue

            constraint = constraints[key]
            expected_type = constraint.get("type")

            # Type check
            if expected_type and not isinstance(value, expected_type):
                warnings.append(f"{key}: expected {expected_type.__name__}, got {type(value).__name__}")
                continue  # Skip invalid type

            # Range check for numeric values
            if "min" in constraint and value < constraint["min"]:
                warnings.append(f"{key}: {value} < min {constraint['min']}, using min")
                value = constraint["min"]
            if "max" in constraint and value > constraint["max"]:
                warnings.append(f"{key}: {value} > max {constraint['max']}, using max")
                value = constraint["max"]

            # Allowed values check
            if "allowed" in constraint and value not in constraint["allowed"]:
                if constraint.get("warn_only"):
                    warnings.append(f"{key}: '{value}' not in known values, proceeding anyway")
                    validated[key] = value
                else:
                    warnings.append(f"{key}: '{value}' not in allowed values, skipping")
                continue

            validated[key] = value

        if warnings:
            print(f"[EmbeddingService] Config validation warnings: {warnings}")

        return validated


class MultiModelEmbeddingService:
    """
    Multi-model embedding service with model caching.

    WHY: Different KBs may use different embedding models.
    HOW: Lazy-load and cache models as needed.

    IMPORTANT:
    - Models are cached in memory after first load
    - Each model uses ~100-400MB RAM
    - Loading a new model takes 1-5 seconds
    """

    def __init__(self):
        """Initialize multi-model service with empty cache."""
        self._model_cache: Dict[str, SentenceTransformer] = {}
        self._model_dimensions: Dict[str, int] = {}
        self._default_model = DEFAULT_MODEL
        # Model loads on first use (every public method already calls _ensure_model_loaded)

    def _ensure_model_loaded(self, model_name: str) -> SentenceTransformer:
        """
        Ensure a model is loaded in the cache.

        Args:
            model_name: Name of the model to load

        Returns:
            Loaded SentenceTransformer model
        """
        if model_name not in self._model_cache:
            print(f"[MultiModelEmbedding] Loading model: {model_name}")

            # Validate model name
            if model_name not in SUPPORTED_MODELS:
                print(f"[MultiModelEmbedding] WARNING: Model '{model_name}' not in SUPPORTED_MODELS")
                print(f"[MultiModelEmbedding] Will attempt to load anyway...")

            # Load model
            model = SentenceTransformer(model_name, device="cpu")
            model.eval()

            # Cache model and dimension
            self._model_cache[model_name] = model
            self._model_dimensions[model_name] = model.get_sentence_embedding_dimension()

            print(f"[MultiModelEmbedding] Model '{model_name}' loaded (dim: {self._model_dimensions[model_name]})")

        return self._model_cache[model_name]

    def get_embedding_dimension(self, model_name: Optional[str] = None) -> int:
        """
        Get embedding dimension for a model.

        Args:
            model_name: Model name (None = default model)

        Returns:
            Embedding dimension
        """
        model_name = model_name or self._default_model
        self._ensure_model_loaded(model_name)
        return self._model_dimensions[model_name]

    async def generate_embeddings(
        self,
        texts: List[str],
        model_name: Optional[str] = None,
        batch_size: int = 32,
        normalize: bool = True
    ) -> List[List[float]]:
        """
        Generate embeddings using a specific model.

        Args:
            texts: List of texts to embed
            model_name: Model to use (None = default)
            batch_size: Batch size for encoding
            normalize: Normalize embeddings for cosine similarity

        Returns:
            List of embeddings
        """
        if not texts:
            return []

        model_name = model_name or self._default_model
        model = self._ensure_model_loaded(model_name)

        # Generate embeddings
        embeddings = model.encode(
            texts,
            batch_size=batch_size,
            show_progress_bar=False,
            convert_to_numpy=True,
            normalize_embeddings=normalize
        )

        return embeddings.tolist()

    async def generate_embedding(
        self,
        text: str,
        model_name: Optional[str] = None
    ) -> List[float]:
        """Generate embedding for a single text."""
        embeddings = await self.generate_embeddings([text], model_name=model_name)
        return embeddings[0] if embeddings else []

    def get_loaded_models(self) -> List[str]:
        """Get list of currently loaded models."""
        return list(self._model_cache.keys())

    def unload_model(self, model_name: str) -> bool:
        """
        Unload a model from cache to free memory.

        Args:
            model_name: Model to unload

        Returns:
            True if model was unloaded, False if not in cache
        """
        if model_name in self._model_cache:
            del self._model_cache[model_name]
            del self._model_dimensions[model_name]
            print(f"[MultiModelEmbedding] Model '{model_name}' unloaded")
            return True
        return False


# Global instance (singleton pattern)
# Model is loaded once and reused across the application
embedding_service = LocalEmbeddingService()

# Multi-model service for KB-specific models
multi_model_embedding_service = MultiModelEmbeddingService()
