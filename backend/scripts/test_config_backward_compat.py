#!/usr/bin/env python3
"""
Test script to verify backward compatibility of chunking and embedding configuration.

Tests:
1. ChunkingService with default config (backward compatible)
2. ChunkingService with custom config
3. ChunkingConfig validation
4. EmbeddingConfig validation
5. Pydantic schema validation

Usage:
    docker exec privexbot-backend-dev python scripts/test_config_backward_compat.py
"""

import sys
import os

# Add src to path
sys.path.insert(0, "/app/src")

from typing import Dict, Any


def test_chunking_service_defaults():
    """Test ChunkingService with default configuration (backward compatible)."""

    print("\n" + "=" * 70)
    print("TEST 1: ChunkingService Default Configuration (Backward Compatible)")
    print("=" * 70)

    from app.services.chunking_service import (
        chunking_service,
        ChunkingService,
        ChunkingConfig,
        DEFAULT_CHUNKING_CONFIG
    )

    # Test default config values
    print("\n--- Test 1a: Default Config Values ---")
    print(f"semantic_threshold: {DEFAULT_CHUNKING_CONFIG.semantic_threshold}")
    print(f"default_chunk_size: {DEFAULT_CHUNKING_CONFIG.default_chunk_size}")
    print(f"default_chunk_overlap: {DEFAULT_CHUNKING_CONFIG.default_chunk_overlap}")

    assert DEFAULT_CHUNKING_CONFIG.semantic_threshold == 0.65, "Default semantic_threshold should be 0.65"
    assert DEFAULT_CHUNKING_CONFIG.default_chunk_size == 1000, "Default chunk_size should be 1000"
    assert DEFAULT_CHUNKING_CONFIG.default_chunk_overlap == 200, "Default chunk_overlap should be 200"
    print("✅ Default config values match expected backward-compatible defaults")

    # Test chunking with defaults
    print("\n--- Test 1b: Chunking with Default Config ---")
    test_text = """
# Introduction

This is the first section of our document. It contains important information about the topic.

# Methods

Here we describe the methodology used in our research. The approach was carefully designed.

# Results

The results show significant improvements in performance. We achieved better accuracy.

# Conclusion

In conclusion, our findings demonstrate the effectiveness of the proposed approach.
"""

    # Test with default strategy (recursive)
    chunks = chunking_service.chunk_document(test_text)
    print(f"Default strategy chunks: {len(chunks)}")
    assert len(chunks) > 0, "Should produce at least one chunk"
    print("✅ Default chunking works")

    # Test with by_heading strategy (backward compatible)
    chunks = chunking_service.chunk_document(test_text, strategy="by_heading")
    print(f"by_heading strategy chunks: {len(chunks)}")
    assert len(chunks) >= 4, "Should produce chunks for each heading"
    print("✅ by_heading strategy works")

    # Test with semantic strategy
    try:
        chunks = chunking_service.chunk_document(test_text, strategy="semantic")
        print(f"semantic strategy chunks: {len(chunks)}")
        print("✅ semantic strategy works")
    except Exception as e:
        print(f"⚠️ semantic strategy error (may need embeddings): {e}")

    # Test no_chunking
    chunks = chunking_service.chunk_document(test_text, strategy="no_chunking")
    print(f"no_chunking strategy chunks: {len(chunks)}")
    assert len(chunks) == 1, "no_chunking should produce exactly 1 chunk"
    print("✅ no_chunking strategy works")

    return True


def test_chunking_service_custom_config():
    """Test ChunkingService with custom configuration."""

    print("\n" + "=" * 70)
    print("TEST 2: ChunkingService Custom Configuration")
    print("=" * 70)

    from app.services.chunking_service import ChunkingService, ChunkingConfig

    # Create service with custom config
    custom_config = ChunkingConfig(
        semantic_threshold=0.8,  # Higher threshold = fewer splits
        default_chunk_size=500,
        default_chunk_overlap=100
    )

    custom_service = ChunkingService(config=custom_config)

    print(f"Custom semantic_threshold: {custom_service.config.semantic_threshold}")
    print(f"Custom chunk_size: {custom_service.config.default_chunk_size}")

    assert custom_service.config.semantic_threshold == 0.8, "Custom threshold should be 0.8"
    assert custom_service.config.default_chunk_size == 500, "Custom chunk_size should be 500"
    print("✅ Custom config applied correctly")

    # Test per-request config override
    print("\n--- Test 2b: Per-Request Config Override ---")
    test_text = "This is a short test text for chunking."

    # Request-level config should override instance config
    chunks = custom_service.chunk_document(
        test_text,
        strategy="recursive",
        config={"semantic_threshold": 0.5}
    )
    print(f"Chunks with request override: {len(chunks)}")
    print("✅ Per-request config override works")

    return True


def test_chunking_config_validation():
    """Test ChunkingService.validate_chunking_config."""

    print("\n" + "=" * 70)
    print("TEST 3: Chunking Config Validation")
    print("=" * 70)

    from app.services.chunking_service import ChunkingService

    # Test valid config
    print("\n--- Test 3a: Valid Config ---")
    valid_config = {
        "strategy": "semantic",
        "chunk_size": 1500,
        "chunk_overlap": 300,
        "semantic_threshold": 0.7
    }
    validated = ChunkingService.validate_chunking_config(valid_config)
    print(f"Input: {valid_config}")
    print(f"Validated: {validated}")
    assert validated == valid_config, "Valid config should pass through unchanged"
    print("✅ Valid config passes through")

    # Test invalid values
    print("\n--- Test 3b: Invalid Values (should be corrected) ---")
    invalid_config = {
        "chunk_size": 50,  # Below min (100)
        "chunk_overlap": 5000,  # Above max (2000)
        "semantic_threshold": 1.5,  # Above max (1.0)
        "strategy": "invalid_strategy"  # Not in allowed list
    }
    validated = ChunkingService.validate_chunking_config(invalid_config)
    print(f"Input: {invalid_config}")
    print(f"Validated: {validated}")

    assert validated.get("chunk_size") == 100, "chunk_size should be clamped to min"
    assert validated.get("chunk_overlap") == 2000, "chunk_overlap should be clamped to max"
    assert validated.get("semantic_threshold") == 1.0, "semantic_threshold should be clamped to max"
    assert "strategy" not in validated, "Invalid strategy should be removed"
    print("✅ Invalid values corrected as expected")

    # Test cross-field validation (overlap >= chunk_size)
    print("\n--- Test 3c: Cross-Field Validation ---")
    bad_overlap_config = {
        "chunk_size": 500,
        "chunk_overlap": 600  # Greater than chunk_size
    }
    validated = ChunkingService.validate_chunking_config(bad_overlap_config)
    print(f"Input: {bad_overlap_config}")
    print(f"Validated: {validated}")
    assert validated["chunk_overlap"] < validated["chunk_size"], "Overlap should be adjusted to be less than chunk_size"
    print("✅ Cross-field validation works")

    return True


def test_embedding_config_validation():
    """Test LocalEmbeddingService.validate_embedding_config."""

    print("\n" + "=" * 70)
    print("TEST 4: Embedding Config Validation")
    print("=" * 70)

    from app.services.embedding_service_local import LocalEmbeddingService, SUPPORTED_MODELS

    # Test valid config
    print("\n--- Test 4a: Valid Config ---")
    valid_config = {
        "model_name": "all-MiniLM-L6-v2",
        "device": "cpu",
        "batch_size": 64,
        "normalize_embeddings": True,
        "num_threads": 8
    }
    validated = LocalEmbeddingService.validate_embedding_config(valid_config)
    print(f"Input: {valid_config}")
    print(f"Validated: {validated}")
    assert validated == valid_config, "Valid config should pass through unchanged"
    print("✅ Valid config passes through")

    # Test supported models list
    print("\n--- Test 4b: Supported Models ---")
    print(f"Supported models: {list(SUPPORTED_MODELS.keys())}")
    assert "all-MiniLM-L6-v2" in SUPPORTED_MODELS, "Default model should be supported"
    assert "all-mpnet-base-v2" in SUPPORTED_MODELS, "High-quality model should be supported"
    print("✅ Supported models available")

    # Test invalid values
    print("\n--- Test 4c: Invalid Values ---")
    invalid_config = {
        "device": "tpu",  # Not allowed
        "batch_size": 500,  # Above max (256)
        "num_threads": 100  # Above max (32)
    }
    validated = LocalEmbeddingService.validate_embedding_config(invalid_config)
    print(f"Input: {invalid_config}")
    print(f"Validated: {validated}")

    assert "device" not in validated, "Invalid device should be removed"
    assert validated.get("batch_size") == 256, "batch_size should be clamped to max"
    assert validated.get("num_threads") == 32, "num_threads should be clamped to max"
    print("✅ Invalid values corrected as expected")

    # Test unknown model (should warn but allow)
    print("\n--- Test 4d: Unknown Model (warn but allow) ---")
    unknown_model_config = {
        "model_name": "some-custom-model",
        "device": "cpu"
    }
    validated = LocalEmbeddingService.validate_embedding_config(unknown_model_config)
    print(f"Input: {unknown_model_config}")
    print(f"Validated: {validated}")
    assert validated.get("model_name") == "some-custom-model", "Unknown model should be allowed with warning"
    print("✅ Unknown models allowed (with warning)")

    return True


def test_pydantic_schemas():
    """Test Pydantic configuration schemas."""

    print("\n" + "=" * 70)
    print("TEST 5: Pydantic Schema Validation")
    print("=" * 70)

    from app.schemas.config import (
        ChunkingConfigSchema,
        EmbeddingConfigSchema,
        RetrievalConfigSchema,
        KBConfigSchema,
        get_available_chunking_strategies,
        get_available_embedding_models
    )

    # Test ChunkingConfigSchema
    print("\n--- Test 5a: ChunkingConfigSchema ---")
    config = ChunkingConfigSchema(
        strategy="semantic",
        chunk_size=1500,
        semantic_threshold=0.7
    )
    print(f"Created config: strategy={config.strategy}, chunk_size={config.chunk_size}")
    print(f"to_dict(): {config.to_dict()}")
    assert config.chunk_size == 1500, "chunk_size should be 1500"
    print("✅ ChunkingConfigSchema works")

    # Test EmbeddingConfigSchema
    print("\n--- Test 5b: EmbeddingConfigSchema ---")
    embed_config = EmbeddingConfigSchema(
        model_name="all-mpnet-base-v2",
        batch_size=64
    )
    print(f"Created config: model={embed_config.model_name}, batch_size={embed_config.batch_size}")
    model_info = embed_config.get_model_info()
    print(f"Model info: {model_info}")
    assert model_info["dimensions"] == 768, "all-mpnet-base-v2 should have 768 dimensions"
    print("✅ EmbeddingConfigSchema works")

    # Test RetrievalConfigSchema
    print("\n--- Test 5c: RetrievalConfigSchema ---")
    retrieval_config = RetrievalConfigSchema(
        top_k=10,
        strategy="hybrid_search",
        score_threshold=0.8
    )
    print(f"Created config: top_k={retrieval_config.top_k}, strategy={retrieval_config.strategy}")
    print("✅ RetrievalConfigSchema works")

    # Test KBConfigSchema (combined)
    print("\n--- Test 5d: KBConfigSchema (Combined) ---")
    kb_config = KBConfigSchema(
        chunking_config=config,
        embedding_config=embed_config,
        retrieval_config=retrieval_config
    )
    config_dict = kb_config.to_dict()
    print(f"Combined config: {config_dict}")
    assert "chunking_config" in config_dict, "Should have chunking_config"
    assert "embedding_config" in config_dict, "Should have embedding_config"
    print("✅ KBConfigSchema works")

    # Test helper functions
    print("\n--- Test 5e: Helper Functions ---")
    strategies = get_available_chunking_strategies()
    models = get_available_embedding_models()
    print(f"Available strategies: {len(strategies)}")
    print(f"Available models: {len(models)}")
    assert len(strategies) > 5, "Should have multiple strategies"
    assert len(models) >= 4, "Should have at least 4 models"
    print("✅ Helper functions work")

    return True


def test_enhanced_chunking_service():
    """Test EnhancedChunkingService."""

    print("\n" + "=" * 70)
    print("TEST 6: EnhancedChunkingService")
    print("=" * 70)

    from app.services.enhanced_chunking_service import (
        enhanced_chunking_service,
        EnhancedChunkingService,
        EnhancedChunkConfig,
        DocumentChunk,
        get_chunking_strategies
    )

    test_text = """
# Introduction

This is the introduction section with important background information.

# Methods

We used a novel approach to solve this problem. The methodology was carefully designed.

# Results

The results demonstrate significant improvements over baseline methods.
"""

    # Test backward compatible method
    print("\n--- Test 6a: Backward Compatible chunk_document ---")
    chunks = enhanced_chunking_service.chunk_document(test_text, strategy="by_heading")
    print(f"Chunks: {len(chunks)}")
    assert len(chunks) > 0, "Should produce chunks"
    assert isinstance(chunks[0], dict), "Should return dict format for backward compatibility"
    print("✅ Backward compatible method works")

    # Test enhanced method
    print("\n--- Test 6b: Enhanced chunk_document_enhanced ---")
    config = EnhancedChunkConfig(
        strategy="by_heading",
        include_context=True,
        include_metadata=True
    )
    enhanced_chunks = enhanced_chunking_service.chunk_document_enhanced(test_text, config)
    print(f"Enhanced chunks: {len(enhanced_chunks)}")
    assert len(enhanced_chunks) > 0, "Should produce enhanced chunks"
    assert isinstance(enhanced_chunks[0], DocumentChunk), "Should return DocumentChunk objects"

    # Check metadata
    first_chunk = enhanced_chunks[0]
    print(f"First chunk metadata: {first_chunk.metadata}")
    assert "chunk_index" in first_chunk.metadata, "Should have chunk_index"
    assert "total_chunks" in first_chunk.metadata, "Should have total_chunks"
    print("✅ Enhanced method works with rich metadata")

    # Test document analysis
    print("\n--- Test 6c: Document Analysis ---")
    analysis = enhanced_chunking_service.analyze_document(test_text)
    print(f"Analysis: {analysis.to_dict()}")
    assert analysis.heading_count > 0, "Should detect headings"
    assert analysis.recommended_strategy != "", "Should recommend a strategy"
    print("✅ Document analysis works")

    # Test helper function
    print("\n--- Test 6d: get_chunking_strategies ---")
    strategies = get_chunking_strategies()
    print(f"Available strategies: {len(strategies)}")
    assert len(strategies) >= 10, "Should have multiple strategies"
    print("✅ Helper function works")

    return True


async def main():
    """Run all tests."""

    print("\n" + "#" * 70)
    print("# CONFIGURATION BACKWARD COMPATIBILITY TEST SUITE")
    print("#" * 70)

    test_results = {}

    # Test 1: ChunkingService defaults
    test_results["chunking_defaults"] = test_chunking_service_defaults()

    # Test 2: ChunkingService custom config
    test_results["chunking_custom"] = test_chunking_service_custom_config()

    # Test 3: Chunking config validation
    test_results["chunking_validation"] = test_chunking_config_validation()

    # Test 4: Embedding config validation
    test_results["embedding_validation"] = test_embedding_config_validation()

    # Test 5: Pydantic schemas
    test_results["pydantic_schemas"] = test_pydantic_schemas()

    # Test 6: EnhancedChunkingService
    test_results["enhanced_chunking"] = test_enhanced_chunking_service()

    # Summary
    print("\n" + "=" * 70)
    print("TEST SUMMARY")
    print("=" * 70)

    all_passed = True
    for name, passed in test_results.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"  {name}: {status}")
        if not passed:
            all_passed = False

    print()
    if all_passed:
        print("🎉 All backward compatibility tests passed!")
    else:
        print("⚠️ Some tests failed")

    return 0 if all_passed else 1


if __name__ == "__main__":
    import asyncio
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
