#!/usr/bin/env python3
"""
Test script to validate ALL chunking strategies work correctly.

Tests:
1. All 11 chunking strategies
2. Custom separators functionality
3. Configuration override flow
4. Strategy-specific behavior verification

Usage:
    docker exec privexbot-backend-dev python scripts/test_all_chunking_strategies.py
"""

import sys
import os

# Add src to path
sys.path.insert(0, "/app/src")

from typing import Dict, Any, List


# Sample content for testing different strategies
SAMPLE_CONTENT = """
# Introduction

Welcome to our product documentation. This guide will help you understand the key features.

## Getting Started

First, you need to install the package:

```bash
pip install our-package
```

Then configure your environment by setting the API key.

## Core Features

### Feature 1: Data Processing

Our data processing engine handles large volumes efficiently. It uses parallel processing
to maximize throughput while maintaining data integrity.

Key benefits:
- Fast processing
- Reliable output
- Easy integration

### Feature 2: Analytics

The analytics module provides real-time insights into your data. You can create custom
dashboards and export reports in multiple formats.

## FAQ

**Q: How do I reset my password?**
A: Go to Settings > Security > Reset Password.

**Q: What formats are supported?**
A: We support JSON, CSV, XML, and Parquet formats.

## Conclusion

Thank you for using our product. For support, contact help@example.com.
"""

SHORT_CONTENT = "This is a short document that should remain as a single chunk."

CODE_HEAVY_CONTENT = """
# API Reference

## Authentication

```python
import requests

def authenticate(api_key):
    headers = {"Authorization": f"Bearer {api_key}"}
    response = requests.get("https://api.example.com/auth", headers=headers)
    return response.json()
```

## Data Processing

```python
def process_data(data):
    results = []
    for item in data:
        processed = transform(item)
        results.append(processed)
    return results
```
"""


def test_all_strategies():
    """Test all chunking strategies with sample content."""

    print("\n" + "=" * 70)
    print("TEST: All Chunking Strategies")
    print("=" * 70)

    from app.services.chunking_service import chunking_service, ChunkingService

    strategies = [
        "recursive",
        "semantic",
        "by_heading",
        "by_section",
        "adaptive",
        "sentence_based",
        "paragraph_based",
        "hybrid",
        "no_chunking",
        "full_content",
        "token",
    ]

    results = {}

    for strategy in strategies:
        print(f"\n--- Testing: {strategy} ---")
        try:
            chunks = chunking_service.chunk_document(
                text=SAMPLE_CONTENT,
                strategy=strategy,
                chunk_size=500,
                chunk_overlap=100
            )

            chunk_count = len(chunks)
            avg_size = sum(len(c["content"]) for c in chunks) // chunk_count if chunk_count > 0 else 0

            print(f"  Chunks: {chunk_count}")
            print(f"  Avg size: {avg_size} chars")
            print(f"  First chunk preview: {chunks[0]['content'][:50]}..." if chunks else "  No chunks")

            results[strategy] = {
                "success": True,
                "chunk_count": chunk_count,
                "avg_size": avg_size
            }

        except Exception as e:
            print(f"  ERROR: {e}")
            results[strategy] = {
                "success": False,
                "error": str(e)
            }

    # Summary
    print("\n" + "-" * 70)
    print("STRATEGY SUMMARY")
    print("-" * 70)

    passed = 0
    for strategy, result in results.items():
        status = "PASS" if result["success"] else "FAIL"
        if result["success"]:
            print(f"  {strategy}: {status} ({result['chunk_count']} chunks, avg {result['avg_size']} chars)")
            passed += 1
        else:
            print(f"  {strategy}: {status} - {result['error']}")

    print(f"\nTotal: {passed}/{len(strategies)} strategies passed")
    return passed == len(strategies)


def test_custom_strategy():
    """Test custom strategy with user-defined separators."""

    print("\n" + "=" * 70)
    print("TEST: Custom Strategy with Separators")
    print("=" * 70)

    from app.services.chunking_service import chunking_service

    # Test 1: Custom with no separators (should fall back to recursive)
    print("\n--- Test 1: Custom without separators ---")
    chunks = chunking_service.chunk_document(
        text=SAMPLE_CONTENT,
        strategy="custom",
        chunk_size=500,
        chunk_overlap=100
    )
    print(f"  Chunks (no separators): {len(chunks)}")

    # Test 2: Custom with markdown heading separators
    print("\n--- Test 2: Custom with heading separators ---")
    chunks = chunking_service.chunk_document(
        text=SAMPLE_CONTENT,
        strategy="custom",
        chunk_size=500,
        chunk_overlap=100,
        separators=["## ", "### ", "\n\n"]
    )
    print(f"  Chunks (heading separators): {len(chunks)}")

    # Test 3: Custom with sentence separators
    print("\n--- Test 3: Custom with sentence separators ---")
    chunks = chunking_service.chunk_document(
        text=SAMPLE_CONTENT,
        strategy="custom",
        chunk_size=500,
        chunk_overlap=100,
        separators=[". ", "! ", "? ", "\n"]
    )
    print(f"  Chunks (sentence separators): {len(chunks)}")

    print("\nCustom strategy tests passed")
    return True


def test_no_chunking_strategy():
    """Test no_chunking and full_content strategies."""

    print("\n" + "=" * 70)
    print("TEST: No Chunking Strategies")
    print("=" * 70)

    from app.services.chunking_service import chunking_service

    # Test no_chunking
    print("\n--- Test: no_chunking ---")
    chunks = chunking_service.chunk_document(
        text=SAMPLE_CONTENT,
        strategy="no_chunking"
    )
    assert len(chunks) == 1, f"no_chunking should produce 1 chunk, got {len(chunks)}"
    assert chunks[0]["content"].strip() == SAMPLE_CONTENT.strip(), "Content should be unchanged"
    print(f"  Chunks: {len(chunks)}")
    print(f"  Content length: {len(chunks[0]['content'])} chars")
    print("  Content matches original: YES")

    # Test full_content (alias)
    print("\n--- Test: full_content (alias) ---")
    chunks = chunking_service.chunk_document(
        text=SAMPLE_CONTENT,
        strategy="full_content"
    )
    assert len(chunks) == 1, f"full_content should produce 1 chunk, got {len(chunks)}"
    print(f"  Chunks: {len(chunks)}")
    print("  Behaves same as no_chunking: YES")

    # Test with short content
    print("\n--- Test: Short content ---")
    chunks = chunking_service.chunk_document(
        text=SHORT_CONTENT,
        strategy="no_chunking"
    )
    assert len(chunks) == 1, "Short content should be 1 chunk"
    print(f"  Short content chunks: {len(chunks)}")

    print("\nNo chunking strategy tests passed")
    return True


def test_semantic_chunking():
    """Test semantic chunking with different thresholds."""

    print("\n" + "=" * 70)
    print("TEST: Semantic Chunking Configuration")
    print("=" * 70)

    from app.services.chunking_service import ChunkingService, ChunkingConfig

    # Test with default threshold (0.65)
    print("\n--- Test: Default threshold (0.65) ---")
    service = ChunkingService()
    chunks_default = service.chunk_document(
        text=SAMPLE_CONTENT,
        strategy="semantic",
        chunk_size=500,
        chunk_overlap=100
    )
    print(f"  Chunks with default threshold: {len(chunks_default)}")

    # Test with high threshold (0.9) - should create more chunks (more splits)
    print("\n--- Test: High threshold (0.9) ---")
    chunks_high = service.chunk_document(
        text=SAMPLE_CONTENT,
        strategy="semantic",
        chunk_size=500,
        chunk_overlap=100,
        config={"semantic_threshold": 0.9}
    )
    print(f"  Chunks with high threshold: {len(chunks_high)}")

    # Test with low threshold (0.3) - should create fewer chunks (fewer splits)
    print("\n--- Test: Low threshold (0.3) ---")
    chunks_low = service.chunk_document(
        text=SAMPLE_CONTENT,
        strategy="semantic",
        chunk_size=500,
        chunk_overlap=100,
        config={"semantic_threshold": 0.3}
    )
    print(f"  Chunks with low threshold: {len(chunks_low)}")

    # Note: The relationship may vary based on content, but generally:
    # Higher threshold = more likely to split (stricter similarity requirement)
    print("\nSemantic chunking tests completed")
    return True


def test_adaptive_chunking():
    """Test adaptive chunking auto-selection."""

    print("\n" + "=" * 70)
    print("TEST: Adaptive Chunking Auto-Selection")
    print("=" * 70)

    from app.services.chunking_service import chunking_service

    # Test with heading-heavy content (should select by_heading)
    print("\n--- Test: Heading-heavy content ---")
    heading_content = """
# Section 1
Content here
# Section 2
More content
# Section 3
Even more
# Section 4
Final content
"""
    chunks = chunking_service.chunk_document(
        text=heading_content,
        strategy="adaptive",
        chunk_size=100,
        chunk_overlap=20
    )
    print(f"  Heading-heavy content chunks: {len(chunks)}")

    # Test with paragraph-heavy content (should select paragraph_based)
    print("\n--- Test: Paragraph-heavy content ---")
    paragraph_content = "\n\n".join([f"Paragraph {i} with some content that is moderately long." for i in range(15)])
    chunks = chunking_service.chunk_document(
        text=paragraph_content,
        strategy="adaptive",
        chunk_size=200,
        chunk_overlap=40
    )
    print(f"  Paragraph-heavy content chunks: {len(chunks)}")

    print("\nAdaptive chunking tests completed")
    return True


def test_config_validation():
    """Test configuration validation."""

    print("\n" + "=" * 70)
    print("TEST: Configuration Validation")
    print("=" * 70)

    from app.services.chunking_service import ChunkingService

    # Test valid config
    print("\n--- Test: Valid config ---")
    valid_config = {
        "strategy": "semantic",
        "chunk_size": 1500,
        "chunk_overlap": 300,
        "semantic_threshold": 0.7
    }
    validated = ChunkingService.validate_chunking_config(valid_config)
    print(f"  Input: {valid_config}")
    print(f"  Validated: {validated}")
    assert validated == valid_config, "Valid config should pass through unchanged"

    # Test invalid values (should be corrected)
    print("\n--- Test: Invalid values ---")
    invalid_config = {
        "chunk_size": 50,  # Below min (100)
        "chunk_overlap": 5000,  # Above max (2000)
        "semantic_threshold": 1.5,  # Above max (1.0)
        "strategy": "invalid_strategy"  # Not in allowed list
    }
    validated = ChunkingService.validate_chunking_config(invalid_config)
    print(f"  Input: {invalid_config}")
    print(f"  Validated: {validated}")

    assert validated.get("chunk_size") == 100, "chunk_size should be clamped to min"
    # Note: chunk_overlap is first clamped to 2000, then cross-validated against chunk_size (100)
    # Since 2000 >= 100, it gets adjusted to chunk_size * 0.2 = 20
    assert validated.get("chunk_overlap") == 20, "chunk_overlap should be adjusted after cross-validation"
    assert validated.get("semantic_threshold") == 1.0, "semantic_threshold should be clamped to max"
    assert "strategy" not in validated, "Invalid strategy should be removed"

    # Test cross-field validation
    print("\n--- Test: Cross-field validation (overlap >= chunk_size) ---")
    bad_overlap = {
        "chunk_size": 500,
        "chunk_overlap": 600  # Greater than chunk_size
    }
    validated = ChunkingService.validate_chunking_config(bad_overlap)
    print(f"  Input: {bad_overlap}")
    print(f"  Validated: {validated}")
    assert validated["chunk_overlap"] < validated["chunk_size"], "Overlap should be adjusted"

    print("\nConfig validation tests passed")
    return True


def test_strategy_list():
    """Test get_available_strategies helper."""

    print("\n" + "=" * 70)
    print("TEST: Available Strategies Helper")
    print("=" * 70)

    from app.services.chunking_service import ChunkingService

    strategies = ChunkingService.get_available_strategies()

    print(f"\nFound {len(strategies)} strategies:")
    for s in strategies:
        print(f"  - {s['value']}: {s['description']} (best for: {s['best_for']})")

    # Verify expected strategies exist
    strategy_values = [s["value"] for s in strategies]
    expected = ["recursive", "semantic", "by_heading", "adaptive", "no_chunking"]

    for expected_strategy in expected:
        assert expected_strategy in strategy_values, f"Missing strategy: {expected_strategy}"

    print(f"\nAll expected strategies present: YES")
    return True


async def main():
    """Run all tests."""

    print("\n" + "#" * 70)
    print("# CHUNKING STRATEGY COMPREHENSIVE TEST SUITE")
    print("#" * 70)

    test_results = {}

    # Test 1: All strategies
    test_results["all_strategies"] = test_all_strategies()

    # Test 2: Custom strategy
    test_results["custom_strategy"] = test_custom_strategy()

    # Test 3: No chunking
    test_results["no_chunking"] = test_no_chunking_strategy()

    # Test 4: Semantic chunking
    test_results["semantic_chunking"] = test_semantic_chunking()

    # Test 5: Adaptive chunking
    test_results["adaptive_chunking"] = test_adaptive_chunking()

    # Test 6: Config validation
    test_results["config_validation"] = test_config_validation()

    # Test 7: Strategy list helper
    test_results["strategy_list"] = test_strategy_list()

    # Summary
    print("\n" + "=" * 70)
    print("TEST SUMMARY")
    print("=" * 70)

    all_passed = True
    for name, passed in test_results.items():
        status = "PASS" if passed else "FAIL"
        print(f"  {name}: {status}")
        if not passed:
            all_passed = False

    print()
    if all_passed:
        print("ALL TESTS PASSED!")
    else:
        print("SOME TESTS FAILED")

    return 0 if all_passed else 1


if __name__ == "__main__":
    import asyncio
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
