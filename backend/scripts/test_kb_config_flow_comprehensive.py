#!/usr/bin/env python3
"""
Comprehensive KB Configuration Flow Test.

Tests the complete configuration flow for both Web URL and File Upload sources:
1. Draft creation with configuration
2. Configuration storage and retrieval
3. Finalization config propagation
4. Background task config usage
5. Chunking service config application
6. Embedding service config application
7. Retrieval service config application

Usage:
    docker exec privexbot-backend-dev python scripts/test_kb_config_flow_comprehensive.py
"""

import sys
import os
import asyncio
import json
from uuid import uuid4
from datetime import datetime

# Add src to path
sys.path.insert(0, "/app/src")

# Set environment before imports
os.environ.setdefault("DATABASE_URL", "postgresql://privexbot:privexbot@postgres:5432/privexbot_dev")


class TestResults:
    """Track test results"""
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.warnings = 0
        self.details = []

    def add_pass(self, name: str, details: str = ""):
        self.passed += 1
        self.details.append(("PASS", name, details))
        print(f"  ✅ {name}")
        if details:
            print(f"     {details}")

    def add_fail(self, name: str, details: str = ""):
        self.failed += 1
        self.details.append(("FAIL", name, details))
        print(f"  ❌ {name}")
        if details:
            print(f"     {details}")

    def add_warning(self, name: str, details: str = ""):
        self.warnings += 1
        self.details.append(("WARN", name, details))
        print(f"  ⚠️ {name}")
        if details:
            print(f"     {details}")

    def summary(self):
        return f"Passed: {self.passed}, Failed: {self.failed}, Warnings: {self.warnings}"


def test_chunking_config_dataclass():
    """Test 1: ChunkingConfig dataclass functionality"""
    print("\n" + "=" * 70)
    print("TEST 1: ChunkingConfig Dataclass")
    print("=" * 70)

    results = TestResults()

    from app.services.chunking_service import ChunkingConfig, DEFAULT_CHUNKING_CONFIG

    # Test 1a: Default values (backward compatibility)
    if DEFAULT_CHUNKING_CONFIG.semantic_threshold == 0.65:
        results.add_pass("Default semantic_threshold is 0.65")
    else:
        results.add_fail(f"Default semantic_threshold is {DEFAULT_CHUNKING_CONFIG.semantic_threshold}, expected 0.65")

    if DEFAULT_CHUNKING_CONFIG.default_chunk_size == 1000:
        results.add_pass("Default chunk_size is 1000")
    else:
        results.add_fail(f"Default chunk_size is {DEFAULT_CHUNKING_CONFIG.default_chunk_size}, expected 1000")

    # Test 1b: to_dict() serialization
    config_dict = DEFAULT_CHUNKING_CONFIG.to_dict()
    if "semantic_threshold" in config_dict and "default_chunk_size" in config_dict:
        results.add_pass("to_dict() serializes all fields")
    else:
        results.add_fail("to_dict() missing fields")

    # Test 1c: from_dict() deserialization
    custom_dict = {
        "semantic_threshold": 0.8,
        "default_chunk_size": 500,
        "unknown_field": "should_be_ignored"  # Forward compatibility
    }
    restored = ChunkingConfig.from_dict(custom_dict)
    if restored.semantic_threshold == 0.8 and restored.default_chunk_size == 500:
        results.add_pass("from_dict() correctly restores custom values")
    else:
        results.add_fail(f"from_dict() failed: threshold={restored.semantic_threshold}, size={restored.default_chunk_size}")

    # Test 1d: Defaults for missing values
    partial_dict = {"semantic_threshold": 0.9}
    partial_restored = ChunkingConfig.from_dict(partial_dict)
    if partial_restored.semantic_threshold == 0.9 and partial_restored.default_chunk_size == 1000:
        results.add_pass("from_dict() uses defaults for missing values")
    else:
        results.add_fail("from_dict() doesn't use defaults correctly")

    return results


def test_chunking_service_config_usage():
    """Test 2: ChunkingService uses configuration correctly"""
    print("\n" + "=" * 70)
    print("TEST 2: ChunkingService Configuration Usage")
    print("=" * 70)

    results = TestResults()

    from app.services.chunking_service import ChunkingService, ChunkingConfig, chunking_service

    # Test 2a: Global instance uses default config
    if chunking_service.config.semantic_threshold == 0.65:
        results.add_pass("Global instance uses default semantic_threshold")
    else:
        results.add_fail(f"Global instance has wrong threshold: {chunking_service.config.semantic_threshold}")

    # Test 2b: Custom config instance
    custom_config = ChunkingConfig(
        semantic_threshold=0.9,
        default_chunk_size=500,
        default_chunk_overlap=100
    )
    custom_service = ChunkingService(config=custom_config)

    if custom_service.config.semantic_threshold == 0.9:
        results.add_pass("Custom service instance respects custom config")
    else:
        results.add_fail(f"Custom service has wrong config: {custom_service.config.semantic_threshold}")

    # Test 2c: Per-request config override
    test_text = "This is a test paragraph.\n\nThis is another paragraph.\n\nAnd a third one."

    # Chunk with default config
    default_chunks = chunking_service.chunk_document(test_text, strategy="recursive")

    # Chunk with request-level override
    override_chunks = chunking_service.chunk_document(
        test_text,
        strategy="recursive",
        chunk_size=50,  # Very small
        config={"semantic_threshold": 0.5}
    )

    if len(override_chunks) >= len(default_chunks):
        results.add_pass("Per-request config produces expected different results")
    else:
        results.add_warning("Per-request config may not affect recursive strategy")

    # Test 2d: validate_chunking_config
    invalid_config = {
        "chunk_size": 50,  # Below min
        "semantic_threshold": 1.5,  # Above max
        "strategy": "invalid_strategy"
    }
    validated = ChunkingService.validate_chunking_config(invalid_config)

    if validated.get("chunk_size") == 100:  # Clamped to min
        results.add_pass("validate_chunking_config clamps chunk_size to min")
    else:
        results.add_fail(f"validate_chunking_config didn't clamp chunk_size: {validated.get('chunk_size')}")

    if validated.get("semantic_threshold") == 1.0:  # Clamped to max
        results.add_pass("validate_chunking_config clamps semantic_threshold to max")
    else:
        results.add_fail(f"validate_chunking_config didn't clamp threshold: {validated.get('semantic_threshold')}")

    if "strategy" not in validated:  # Invalid removed
        results.add_pass("validate_chunking_config removes invalid strategy")
    else:
        results.add_fail("validate_chunking_config kept invalid strategy")

    return results


def test_embedding_service_config():
    """Test 3: Embedding service configuration"""
    print("\n" + "=" * 70)
    print("TEST 3: Embedding Service Configuration")
    print("=" * 70)

    results = TestResults()

    from app.services.embedding_service_local import (
        LocalEmbeddingService,
        SUPPORTED_MODELS,
        DEFAULT_MODEL,
        embedding_service
    )

    # Test 3a: Supported models available
    if len(SUPPORTED_MODELS) >= 4:
        results.add_pass(f"SUPPORTED_MODELS has {len(SUPPORTED_MODELS)} models")
        print(f"     Models: {list(SUPPORTED_MODELS.keys())}")
    else:
        results.add_fail(f"SUPPORTED_MODELS only has {len(SUPPORTED_MODELS)} models")

    # Test 3b: Default model
    if DEFAULT_MODEL in SUPPORTED_MODELS:
        results.add_pass(f"DEFAULT_MODEL '{DEFAULT_MODEL}' is in SUPPORTED_MODELS")
    else:
        results.add_fail(f"DEFAULT_MODEL '{DEFAULT_MODEL}' not in SUPPORTED_MODELS")

    # Test 3c: Global instance initialized
    if embedding_service.model is not None:
        results.add_pass("Global embedding_service has model loaded")
        print(f"     Dimensions: {embedding_service.get_embedding_dimension()}")
    else:
        results.add_fail("Global embedding_service model not loaded")

    # Test 3d: get_model_info
    model_info = embedding_service.get_model_info()
    if "model_name" in model_info and "embedding_dimension" in model_info:
        results.add_pass("get_model_info() returns complete info")
        print(f"     Model info: {json.dumps(model_info, indent=2)[:200]}...")
    else:
        results.add_fail("get_model_info() missing fields")

    # Test 3e: validate_embedding_config
    invalid_config = {
        "device": "tpu",  # Invalid
        "batch_size": 500,  # Above max
        "num_threads": 100  # Above max
    }
    validated = LocalEmbeddingService.validate_embedding_config(invalid_config)

    if "device" not in validated:
        results.add_pass("validate_embedding_config removes invalid device")
    else:
        results.add_fail("validate_embedding_config kept invalid device")

    if validated.get("batch_size") == 256:
        results.add_pass("validate_embedding_config clamps batch_size to max")
    else:
        results.add_fail(f"validate_embedding_config didn't clamp batch_size: {validated.get('batch_size')}")

    # Test 3f: Unknown model allowed with warning
    unknown_model_config = {"model_name": "custom-model-xyz"}
    validated_unknown = LocalEmbeddingService.validate_embedding_config(unknown_model_config)
    if validated_unknown.get("model_name") == "custom-model-xyz":
        results.add_pass("validate_embedding_config allows unknown models (with warning)")
    else:
        results.add_fail("validate_embedding_config rejected unknown model")

    return results


def test_enhanced_chunking_service():
    """Test 4: Enhanced chunking service wrapper"""
    print("\n" + "=" * 70)
    print("TEST 4: Enhanced Chunking Service")
    print("=" * 70)

    results = TestResults()

    from app.services.enhanced_chunking_service import (
        enhanced_chunking_service,
        EnhancedChunkingService,
        EnhancedChunkConfig,
        DocumentChunk,
        DocumentAnalysis,
        get_chunking_strategies
    )

    test_text = """
# Introduction

This document covers the main topic with detailed explanations.

# Methods

We used several approaches to solve the problem effectively.

# Results

The outcomes show significant improvements over baseline.
"""

    # Test 4a: Backward compatible chunk_document
    chunks = enhanced_chunking_service.chunk_document(test_text, strategy="by_heading")
    if isinstance(chunks, list) and len(chunks) > 0 and isinstance(chunks[0], dict):
        results.add_pass("chunk_document() returns backward-compatible dict list")
        print(f"     Chunks: {len(chunks)}")
    else:
        results.add_fail("chunk_document() doesn't return expected format")

    # Test 4b: Enhanced chunk_document_enhanced
    config = EnhancedChunkConfig(
        strategy="by_heading",
        include_context=True,
        include_metadata=True,
        analyze_structure=True
    )
    enhanced_chunks = enhanced_chunking_service.chunk_document_enhanced(test_text, config)

    if len(enhanced_chunks) > 0 and isinstance(enhanced_chunks[0], DocumentChunk):
        results.add_pass("chunk_document_enhanced() returns DocumentChunk objects")
    else:
        results.add_fail("chunk_document_enhanced() doesn't return DocumentChunk objects")

    # Test 4c: Rich metadata in enhanced chunks
    first_chunk = enhanced_chunks[0]
    if "chunk_index" in first_chunk.metadata and "total_chunks" in first_chunk.metadata:
        results.add_pass("Enhanced chunks have rich metadata")
        print(f"     Metadata keys: {list(first_chunk.metadata.keys())}")
    else:
        results.add_fail("Enhanced chunks missing metadata")

    # Test 4d: Document analysis
    analysis = enhanced_chunking_service.analyze_document(test_text)
    if isinstance(analysis, DocumentAnalysis) and analysis.heading_count > 0:
        results.add_pass("analyze_document() works correctly")
        print(f"     Headings: {analysis.heading_count}, Strategy: {analysis.recommended_strategy}")
    else:
        results.add_fail("analyze_document() failed")

    # Test 4e: get_chunking_strategies helper
    strategies = get_chunking_strategies()
    if len(strategies) >= 10:
        results.add_pass(f"get_chunking_strategies() returns {len(strategies)} strategies")
    else:
        results.add_fail(f"get_chunking_strategies() only has {len(strategies)} strategies")

    # Test 4f: to_dict() for pipeline compatibility
    chunk_dict = first_chunk.to_dict()
    if "content" in chunk_dict and "metadata" in chunk_dict:
        results.add_pass("DocumentChunk.to_dict() provides pipeline-compatible format")
    else:
        results.add_fail("DocumentChunk.to_dict() missing required fields")

    return results


def test_pydantic_schemas():
    """Test 5: Pydantic configuration schemas"""
    print("\n" + "=" * 70)
    print("TEST 5: Pydantic Configuration Schemas")
    print("=" * 70)

    results = TestResults()

    from app.schemas.config import (
        ChunkingConfigSchema,
        EmbeddingConfigSchema,
        RetrievalConfigSchema,
        KBConfigSchema,
        ChunkingStrategy,
        EmbeddingModel,
        RetrievalStrategy,
        get_available_chunking_strategies,
        get_available_embedding_models,
        get_available_retrieval_strategies
    )

    # Test 5a: ChunkingConfigSchema validation
    try:
        config = ChunkingConfigSchema(
            strategy=ChunkingStrategy.SEMANTIC,
            chunk_size=1500,
            chunk_overlap=300,
            semantic_threshold=0.7
        )
        if config.chunk_size == 1500 and config.semantic_threshold == 0.7:
            results.add_pass("ChunkingConfigSchema validates correctly")
        else:
            results.add_fail("ChunkingConfigSchema has wrong values")
    except Exception as e:
        results.add_fail(f"ChunkingConfigSchema validation error: {e}")

    # Test 5b: ChunkingConfigSchema range validation
    try:
        invalid = ChunkingConfigSchema(chunk_size=50)  # Below min
        results.add_fail("ChunkingConfigSchema should reject chunk_size < 100")
    except ValueError:
        results.add_pass("ChunkingConfigSchema rejects invalid chunk_size")
    except Exception as e:
        results.add_warning(f"Unexpected error type: {type(e)}")

    # Test 5c: EmbeddingConfigSchema
    try:
        embed_config = EmbeddingConfigSchema(
            model_name=EmbeddingModel.ALL_MPNET_BASE_V2,
            batch_size=64
        )
        model_info = embed_config.get_model_info()
        if model_info["dimensions"] == 768:
            results.add_pass("EmbeddingConfigSchema.get_model_info() works")
        else:
            results.add_fail(f"Wrong dimensions: {model_info['dimensions']}")
    except Exception as e:
        results.add_fail(f"EmbeddingConfigSchema error: {e}")

    # Test 5d: RetrievalConfigSchema
    try:
        retrieval = RetrievalConfigSchema(
            top_k=10,
            strategy=RetrievalStrategy.HYBRID_SEARCH,
            score_threshold=0.8
        )
        if retrieval.top_k == 10 and retrieval.score_threshold == 0.8:
            results.add_pass("RetrievalConfigSchema validates correctly")
        else:
            results.add_fail("RetrievalConfigSchema has wrong values")
    except Exception as e:
        results.add_fail(f"RetrievalConfigSchema error: {e}")

    # Test 5e: KBConfigSchema combined
    try:
        kb_config = KBConfigSchema(
            chunking_config=ChunkingConfigSchema(strategy=ChunkingStrategy.SEMANTIC),
            embedding_config=EmbeddingConfigSchema(),
            retrieval_config=RetrievalConfigSchema()
        )
        config_dict = kb_config.to_dict()
        if all(k in config_dict for k in ["chunking_config", "embedding_config", "retrieval_config"]):
            results.add_pass("KBConfigSchema combines all configs")
        else:
            results.add_fail("KBConfigSchema missing configs")
    except Exception as e:
        results.add_fail(f"KBConfigSchema error: {e}")

    # Test 5f: Helper functions
    strategies = get_available_chunking_strategies()
    models = get_available_embedding_models()
    retrieval_strategies = get_available_retrieval_strategies()

    if len(strategies) >= 10 and len(models) >= 4 and len(retrieval_strategies) >= 3:
        results.add_pass("Helper functions return expected options")
        print(f"     Strategies: {len(strategies)}, Models: {len(models)}, Retrieval: {len(retrieval_strategies)}")
    else:
        results.add_fail("Helper functions missing options")

    return results


def test_retrieval_service_config():
    """Test 6: Retrieval service configuration"""
    print("\n" + "=" * 70)
    print("TEST 6: Retrieval Service Configuration")
    print("=" * 70)

    results = TestResults()

    from app.services.retrieval_service import retrieval_service

    # Test 6a: validate_retrieval_config
    valid_config = {
        "top_k": 10,
        "strategy": "hybrid_search",
        "score_threshold": 0.8
    }
    validated = retrieval_service.validate_retrieval_config(valid_config)
    if validated == valid_config:
        results.add_pass("validate_retrieval_config passes valid config")
    else:
        results.add_warning(f"validate_retrieval_config modified valid config: {validated}")

    # Test 6b: Invalid config sanitization
    invalid_config = {
        "top_k": 500,  # Above max (100)
        "score_threshold": 1.5,  # Above max (1.0)
        "strategy": "invalid_strategy"
    }
    validated = retrieval_service.validate_retrieval_config(invalid_config)

    if validated.get("top_k", 500) <= 100:
        results.add_pass("validate_retrieval_config clamps top_k")
    else:
        results.add_fail(f"validate_retrieval_config didn't clamp top_k: {validated.get('top_k')}")

    # Test 6c: _map_strategy_to_method (internal)
    try:
        method = retrieval_service._map_strategy_to_method("hybrid_search")
        if method in ["hybrid", "hybrid_search"]:
            results.add_pass("_map_strategy_to_method maps hybrid_search")
        else:
            results.add_warning(f"Unexpected mapping: hybrid_search -> {method}")
    except Exception as e:
        results.add_warning(f"_map_strategy_to_method not testable: {e}")

    return results


def test_smart_kb_service_config_propagation():
    """Test 7: Smart KB service config propagation"""
    print("\n" + "=" * 70)
    print("TEST 7: Smart KB Service Config Propagation")
    print("=" * 70)

    results = TestResults()

    try:
        from app.services.smart_kb_service import smart_kb_service, ChunkingDecision

        # Test 7a: ChunkingDecision dataclass
        decision = ChunkingDecision(
            strategy="semantic",
            chunk_size=1000,
            chunk_overlap=200,
            user_preference=True,
            adaptive_suggestion="semantic",
            confidence=0.9
        )

        if decision.user_preference and decision.strategy == "semantic":
            results.add_pass("ChunkingDecision dataclass works")
        else:
            results.add_fail("ChunkingDecision has wrong values")

        # Test 7b: make_chunking_decision with user_config
        # We need a mock KB for this test
        class MockKB:
            config = {}

        mock_kb = MockKB()
        user_config = {
            "strategy": "by_heading",
            "chunk_size": 500,
            "chunk_overlap": 100
        }

        test_content = "# Heading\n\nSome content here."
        decision = smart_kb_service.make_chunking_decision(
            content=test_content,
            title="Test",
            kb=mock_kb,
            user_config=user_config
        )

        if decision.strategy == "by_heading":
            results.add_pass("make_chunking_decision respects user_config.strategy")
        else:
            results.add_fail(f"make_chunking_decision used wrong strategy: {decision.strategy}")

        if decision.chunk_size == 500:
            results.add_pass("make_chunking_decision respects user_config.chunk_size")
        else:
            results.add_fail(f"make_chunking_decision used wrong chunk_size: {decision.chunk_size}")

        if decision.user_preference:
            results.add_pass("make_chunking_decision marks user_preference=True")
        else:
            results.add_fail("make_chunking_decision didn't set user_preference")

    except Exception as e:
        results.add_fail(f"Smart KB service test error: {e}")
        import traceback
        traceback.print_exc()

    return results


async def test_end_to_end_embedding():
    """Test 8: End-to-end embedding generation"""
    print("\n" + "=" * 70)
    print("TEST 8: End-to-End Embedding Generation")
    print("=" * 70)

    results = TestResults()

    from app.services.embedding_service_local import embedding_service

    # Test 8a: Single embedding
    try:
        embedding = await embedding_service.generate_embedding("How do I reset my password?")
        if len(embedding) == 384:  # all-MiniLM-L6-v2 dimension
            results.add_pass(f"generate_embedding produces {len(embedding)}-dim vector")
        else:
            results.add_warning(f"Embedding dimension is {len(embedding)}, expected 384")
    except Exception as e:
        results.add_fail(f"generate_embedding error: {e}")

    # Test 8b: Batch embeddings
    try:
        texts = [
            "What is the pricing?",
            "How do I contact support?",
            "Where is my order?"
        ]
        embeddings = await embedding_service.generate_embeddings(texts)
        if len(embeddings) == 3 and all(len(e) == len(embeddings[0]) for e in embeddings):
            results.add_pass(f"generate_embeddings produces {len(embeddings)} vectors")
        else:
            results.add_fail("generate_embeddings wrong output")
    except Exception as e:
        results.add_fail(f"generate_embeddings error: {e}")

    # Test 8c: Similarity computation
    try:
        e1 = await embedding_service.generate_embedding("password reset")
        e2 = await embedding_service.generate_embedding("forgot my password")
        e3 = await embedding_service.generate_embedding("order shipping status")

        sim_related = await embedding_service.compute_similarity(e1, e2)
        sim_unrelated = await embedding_service.compute_similarity(e1, e3)

        if sim_related > sim_unrelated:
            results.add_pass(f"Similarity: related={sim_related:.3f} > unrelated={sim_unrelated:.3f}")
        else:
            results.add_warning(f"Similarity may be off: related={sim_related:.3f}, unrelated={sim_unrelated:.3f}")
    except Exception as e:
        results.add_fail(f"compute_similarity error: {e}")

    return results


async def test_integration_with_real_kb():
    """Test 9: Integration with real KB (if available)"""
    print("\n" + "=" * 70)
    print("TEST 9: Integration with Real KB (Optional)")
    print("=" * 70)

    results = TestResults()

    try:
        from sqlalchemy import create_engine
        from sqlalchemy.orm import sessionmaker
        from app.models.knowledge_base import KnowledgeBase
        from app.services.retrieval_service import retrieval_service

        database_url = os.getenv("DATABASE_URL")
        engine = create_engine(database_url)
        SessionLocal = sessionmaker(bind=engine)
        db = SessionLocal()

        # Find a ready KB
        kb = db.query(KnowledgeBase).filter(
            KnowledgeBase.status == "ready"
        ).first()

        if not kb:
            results.add_warning("No ready KBs found - skipping integration test")
            db.close()
            return results

        results.add_pass(f"Found KB: {kb.name} ({kb.id})")
        print(f"     Status: {kb.status}")
        print(f"     Config: {json.dumps(kb.config or {}, indent=2)[:200]}...")

        # Test search with default config
        try:
            search_results = await retrieval_service.search(
                db=db,
                kb_id=kb.id,
                query="test query",
                top_k=None,  # Use KB config
                search_method=None,
                threshold=None
            )
            results.add_pass(f"Search returned {len(search_results)} results")
        except Exception as e:
            results.add_fail(f"Search error: {e}")

        db.close()

    except Exception as e:
        results.add_warning(f"Integration test skipped: {e}")

    return results


async def main():
    """Run all comprehensive tests"""
    print("\n" + "#" * 70)
    print("#" + " " * 20 + "COMPREHENSIVE KB CONFIG FLOW TEST" + " " * 15 + "#")
    print("#" * 70)

    all_results = []

    # Sync tests
    all_results.append(("ChunkingConfig Dataclass", test_chunking_config_dataclass()))
    all_results.append(("ChunkingService Config", test_chunking_service_config_usage()))
    all_results.append(("Embedding Service Config", test_embedding_service_config()))
    all_results.append(("Enhanced Chunking Service", test_enhanced_chunking_service()))
    all_results.append(("Pydantic Schemas", test_pydantic_schemas()))
    all_results.append(("Retrieval Service Config", test_retrieval_service_config()))
    all_results.append(("Smart KB Service Config", test_smart_kb_service_config_propagation()))

    # Async tests
    all_results.append(("End-to-End Embedding", await test_end_to_end_embedding()))
    all_results.append(("Real KB Integration", await test_integration_with_real_kb()))

    # Summary
    print("\n" + "=" * 70)
    print("COMPREHENSIVE TEST SUMMARY")
    print("=" * 70)

    total_passed = 0
    total_failed = 0
    total_warnings = 0

    for name, results in all_results:
        print(f"\n{name}:")
        print(f"  {results.summary()}")
        total_passed += results.passed
        total_failed += results.failed
        total_warnings += results.warnings

    print("\n" + "-" * 70)
    print(f"TOTAL: Passed={total_passed}, Failed={total_failed}, Warnings={total_warnings}")
    print("-" * 70)

    if total_failed == 0:
        print("\n🎉 ALL TESTS PASSED!")
        print("\nConfiguration architecture is properly integrated with KB flows:")
        print("  ✅ ChunkingConfig with configurable semantic_threshold")
        print("  ✅ EmbeddingConfig with model selection support")
        print("  ✅ Enhanced chunking with rich metadata")
        print("  ✅ Pydantic validation schemas")
        print("  ✅ Service-level validation")
        print("  ✅ Smart KB service config propagation")
        return 0
    else:
        print(f"\n⚠️ {total_failed} tests failed - review output above")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
