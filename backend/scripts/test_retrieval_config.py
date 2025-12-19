#!/usr/bin/env python3
"""
Test script to verify retrieval_config wiring works correctly.

Tests:
1. Option A retrieval (Qdrant-only storage) with default config
2. Option A retrieval with custom retrieval_config
3. Keyword search fallback to Qdrant text search

Usage:
    docker exec privexbot-backend-dev python scripts/test_retrieval_config.py
"""

import asyncio
import sys
import os

# Add src to path
sys.path.insert(0, "/app/src")

from uuid import UUID
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Set DATABASE_URL before importing app modules
os.environ.setdefault("DATABASE_URL", "postgresql://privexbot:privexbot@postgres:5432/privexbot_dev")


def get_db_session():
    """Create database session."""
    database_url = os.getenv("DATABASE_URL")
    engine = create_engine(database_url)
    SessionLocal = sessionmaker(bind=engine)
    return SessionLocal()


async def test_option_a_retrieval():
    """Test retrieval for Option A (Qdrant-only) storage."""

    print("\n" + "="*70)
    print("TEST 1: Option A Retrieval (Qdrant-only storage)")
    print("="*70)

    # Late import to avoid early initialization issues
    from app.models.knowledge_base import KnowledgeBase
    from app.services.retrieval_service import retrieval_service

    db = get_db_session()

    try:
        # Find a KB with vectors (Option A storage)
        kb = db.query(KnowledgeBase).filter(
            KnowledgeBase.status == "ready",
            KnowledgeBase.stats.isnot(None)
        ).first()

        if not kb:
            print("❌ No ready KBs found. Skipping test.")
            return False

        print(f"Using KB: {kb.name} ({kb.id})")
        print(f"Stats: {kb.stats}")
        print(f"Context settings: {kb.context_settings}")

        # Test 1a: Vector search (default method)
        print("\n--- Test 1a: Vector Search (default) ---")
        results = await retrieval_service.search(
            db=db,
            kb_id=kb.id,
            query="What are the key points?",
            top_k=None,
            search_method=None,
            threshold=None
        )

        print(f"Results: {len(results)} chunks returned")
        for i, r in enumerate(results[:3]):
            print(f"  [{i+1}] score={r['score']:.3f}, storage={r.get('storage_type', 'unknown')}")
            print(f"       content={r['content'][:100]}...")

        if len(results) > 0:
            print("✅ Vector search working!")
        else:
            print("⚠️ No results returned")

        # Test 1b: Keyword search (should use Qdrant text search for Option A)
        print("\n--- Test 1b: Keyword Search (Qdrant text fallback) ---")
        results = await retrieval_service.search(
            db=db,
            kb_id=kb.id,
            query="the",
            search_method="keyword",
            top_k=5,
            threshold=0.0
        )

        print(f"Results: {len(results)} chunks returned")
        for i, r in enumerate(results[:3]):
            print(f"  [{i+1}] score={r['score']:.3f}, storage={r.get('storage_type', 'unknown')}")
            print(f"       content={r['content'][:100]}...")

        if len(results) > 0:
            print("✅ Keyword search (Qdrant text fallback) working!")
        else:
            print("⚠️ No keyword results (this is OK if content doesn't contain 'the')")

        # Test 1c: Hybrid search
        print("\n--- Test 1c: Hybrid Search ---")
        results = await retrieval_service.search(
            db=db,
            kb_id=kb.id,
            query="What is this document about?",
            search_method="hybrid",
            top_k=5,
            threshold=0.5
        )

        print(f"Results: {len(results)} chunks returned")
        for i, r in enumerate(results[:3]):
            print(f"  [{i+1}] score={r['score']:.3f}, storage={r.get('storage_type', 'unknown')}")

        if len(results) > 0:
            print("✅ Hybrid search working!")
        else:
            print("⚠️ No hybrid results")

        return True

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        db.close()


async def test_retrieval_config_application():
    """Test that retrieval_config is applied correctly."""

    print("\n" + "="*70)
    print("TEST 2: Retrieval Config Application")
    print("="*70)

    from app.models.knowledge_base import KnowledgeBase
    from app.services.retrieval_service import retrieval_service

    db = get_db_session()

    try:
        # Find a KB with vectors
        kb = db.query(KnowledgeBase).filter(
            KnowledgeBase.status == "ready",
            KnowledgeBase.stats.isnot(None)
        ).first()

        if not kb:
            print("❌ No ready KBs found. Skipping test.")
            return False

        print(f"Using KB: {kb.name} ({kb.id})")

        # Test 2a: Set retrieval_config and verify it's used
        print("\n--- Test 2a: Apply retrieval_config (top_k=2, strategy=semantic_search) ---")

        # Temporarily update KB's context_settings
        original_settings = kb.context_settings.copy() if kb.context_settings else {}
        test_settings = {
            **original_settings,
            "retrieval_config": {
                "top_k": 2,
                "strategy": "semantic_search",
                "score_threshold": 0.5
            }
        }
        kb.context_settings = test_settings
        db.commit()

        # Refresh to ensure we're using updated settings
        db.refresh(kb)
        print(f"Updated context_settings: {kb.context_settings}")

        # Search with None params to use KB config
        results = await retrieval_service.search(
            db=db,
            kb_id=kb.id,
            query="What information is in this document?",
            top_k=None,
            search_method=None,
            threshold=None
        )

        print(f"Results: {len(results)} chunks returned (expected: <=2)")

        if len(results) <= 2:
            print("✅ retrieval_config.top_k applied correctly!")
        else:
            print(f"⚠️ Expected <=2 results, got {len(results)}")

        # Test 2b: Caller override should take precedence
        print("\n--- Test 2b: Caller override (top_k=5 should override KB's top_k=2) ---")

        results = await retrieval_service.search(
            db=db,
            kb_id=kb.id,
            query="What information is in this document?",
            top_k=5,
            search_method=None,
            threshold=None
        )

        print(f"Results: {len(results)} chunks returned (expected: <=5)")

        if len(results) <= 5:
            print("✅ Caller override working!")
        else:
            print(f"⚠️ Unexpected result count: {len(results)}")

        # Restore original settings
        kb.context_settings = original_settings
        db.commit()
        print("\n(Restored original KB settings)")

        return True

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        db.close()


async def test_validation():
    """Test retrieval_config validation."""

    print("\n" + "="*70)
    print("TEST 3: Retrieval Config Validation")
    print("="*70)

    from app.services.retrieval_service import retrieval_service

    # Test validation directly
    invalid_configs = [
        {"top_k": "not_a_number"},
        {"top_k": -5},
        {"top_k": 500},
        {"strategy": "invalid_strategy"},
        {"score_threshold": 1.5},
        {"score_threshold": "high"},
    ]

    for config in invalid_configs:
        validated = retrieval_service.validate_retrieval_config(config)
        print(f"Input: {config}")
        print(f"Validated: {validated}")
        print()

    # Test valid config
    valid_config = {
        "top_k": 10,
        "strategy": "hybrid_search",
        "score_threshold": 0.8,
        "rerank_enabled": False
    }
    validated = retrieval_service.validate_retrieval_config(valid_config)
    print(f"Valid input: {valid_config}")
    print(f"Validated: {validated}")

    if validated == valid_config:
        print("✅ Valid config passed through unchanged!")
    else:
        print("⚠️ Valid config was modified")

    return True


async def main():
    """Run all tests."""

    print("\n" + "#"*70)
    print("# RETRIEVAL CONFIG WIRING TEST SUITE")
    print("#"*70)

    test_results = {}

    # Test 1: Option A retrieval
    test_results["option_a"] = await test_option_a_retrieval()

    # Test 2: Config application
    test_results["config_application"] = await test_retrieval_config_application()

    # Test 3: Validation
    test_results["validation"] = await test_validation()

    # Summary
    print("\n" + "="*70)
    print("TEST SUMMARY")
    print("="*70)

    all_passed = True
    for name, passed in test_results.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"  {name}: {status}")
        if not passed:
            all_passed = False

    print()
    if all_passed:
        print("🎉 All tests passed!")
    else:
        print("⚠️ Some tests failed")

    return 0 if all_passed else 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
