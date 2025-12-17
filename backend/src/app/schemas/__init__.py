"""
Pydantic schemas for API validation and serialization.

Note: Imports are done lazily to avoid circular imports.
Use direct imports from submodules when needed:
    from app.schemas.config import ChunkingConfigSchema
    from app.schemas.draft import DraftCreate
"""

# Only export config schemas by default (most commonly used)
from app.schemas.config import (
    ChunkingStrategy,
    EmbeddingModel,
    RetrievalStrategy,
    ChunkingConfigSchema,
    EmbeddingConfigSchema,
    RetrievalConfigSchema,
    KBConfigSchema,
    get_available_chunking_strategies,
    get_available_embedding_models,
    get_available_retrieval_strategies
)

__all__ = [
    # Config enums
    "ChunkingStrategy",
    "EmbeddingModel",
    "RetrievalStrategy",
    # Config schemas
    "ChunkingConfigSchema",
    "EmbeddingConfigSchema",
    "RetrievalConfigSchema",
    "KBConfigSchema",
    # Config helpers
    "get_available_chunking_strategies",
    "get_available_embedding_models",
    "get_available_retrieval_strategies",
]
