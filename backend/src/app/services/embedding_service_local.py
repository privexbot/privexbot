"""
Local Embedding Service - Self-hosted embedding generation using sentence-transformers.

WHY:
- Privacy-focused (no external API calls)
- Cost-effective (no per-token charges)
- CPU-optimized for production use
- Fully local processing

HOW:
- Uses sentence-transformers library
- all-MiniLM-L6-v2 model (384 dimensions)
- CPU-optimized with PyTorch
- Batch processing for efficiency

KEY FEATURES:
- Self-hosted embedding generation
- ~100 chunks/second on 4-core CPU
- Model cached after first load (~90MB)
- Batch processing support
- Normalized embeddings for cosine similarity

PERFORMANCE:
- Model size: ~90MB (cached in Docker volume)
- Speed: ~100 chunks/second on 4-core CPU
- Memory: ~2GB during embedding generation
- Dimensions: 384 (all-MiniLM-L6-v2)
"""

from typing import List, Optional
from pydantic import BaseModel, Field
from sentence_transformers import SentenceTransformer
import torch
import numpy as np
from datetime import datetime


class EmbeddingConfig(BaseModel):
    """Configuration for local embedding generation"""

    model_name: str = Field(
        default="all-MiniLM-L6-v2",
        description="SentenceTransformer model name"
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


class LocalEmbeddingService:
    """
    Self-hosted embedding generation using sentence-transformers.

    PRIVACY: Model runs locally, no API calls.
    PERFORMANCE: ~100 chunks/second on 4-core CPU.
    COST: Free (model cached after first load).

    Architecture:
    - Uses sentence-transformers library
    - all-MiniLM-L6-v2 model (good quality, fast on CPU)
    - Batch processing for efficiency
    - PyTorch CPU optimization

    Supported Models:
    - all-MiniLM-L6-v2: 384 dims, fast, good quality (default)
    - all-mpnet-base-v2: 768 dims, slower, better quality
    - all-MiniLM-L12-v2: 384 dims, medium speed, better quality
    """

    def __init__(self, config: Optional[EmbeddingConfig] = None):
        """
        Initialize local embedding service.

        Args:
            config: Embedding configuration (optional)
        """
        self.config = config or EmbeddingConfig()
        self.model: Optional[SentenceTransformer] = None
        self._initialize_model()

    def _initialize_model(self):
        """Load and configure the embedding model"""

        print(f"[EmbeddingService] Loading model: {self.config.model_name}")
        print(f"[EmbeddingService] Device: {self.config.device}")

        # Load model (cached in ~/.cache/torch/sentence_transformers/)
        self.model = SentenceTransformer(
            self.config.model_name,
            device=self.config.device
        )

        # Set to evaluation mode (no training)
        self.model.eval()

        # Optimize for CPU if using CPU
        if self.config.device == "cpu":
            # Use multiple threads for better CPU performance
            torch.set_num_threads(4)
            print(f"[EmbeddingService] CPU threads: 4")

        print(f"[EmbeddingService] Model loaded successfully")
        print(f"[EmbeddingService] Embedding dimension: {self.get_embedding_dimension()}")

    def get_embedding_dimension(self) -> int:
        """
        Get the embedding dimension for this model.

        Returns:
            int: Embedding dimension (e.g., 384 for all-MiniLM-L6-v2)
        """
        if not self.model:
            raise RuntimeError("Model not initialized")

        return self.model.get_sentence_embedding_dimension()

    def get_max_sequence_length(self) -> int:
        """
        Get the maximum sequence length (tokens) for this model.

        Returns:
            int: Maximum sequence length
        """
        if not self.model:
            raise RuntimeError("Model not initialized")

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

        if not self.model:
            raise RuntimeError("Model not initialized")

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
            Dict with model information
        """

        if not self.model:
            raise RuntimeError("Model not initialized")

        return {
            "model_name": self.config.model_name,
            "device": self.config.device,
            "embedding_dimension": self.get_embedding_dimension(),
            "max_sequence_length": self.get_max_sequence_length(),
            "batch_size": self.config.batch_size,
            "normalize_embeddings": self.config.normalize_embeddings,
        }


# Global instance (singleton pattern)
# Model is loaded once and reused across the application
embedding_service = LocalEmbeddingService()
