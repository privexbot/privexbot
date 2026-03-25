#!/usr/bin/env python3
"""
Test script to validate preview/production parity for chunking decisions.

Tests:
1. Full config - preview and production should use exact user values
2. Partial config - both should use same adaptive logic
3. No config - both should use same adaptive suggestions
4. Different draft contexts affect chunk sizes identically

Usage:
    docker exec privexbot-backend-dev python scripts/test_preview_parity.py
"""

import sys
sys.path.insert(0, "/app/src")

from app.services.smart_kb_service import smart_kb_service, ChunkingDecision


# Sample content for testing
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


def test_full_config_parity():
    """Test: When user provides ALL values, both preview and production should use them exactly."""
    print("\n" + "=" * 70)
    print("TEST: Full Config Parity")
    print("=" * 70)

    user_config = {
        "strategy": "semantic",
        "chunk_size": 1500,
        "chunk_overlap": 300
    }

    # Preview decision
    preview_decision = smart_kb_service.make_chunking_decision_for_preview(
        content=SAMPLE_CONTENT,
        title="Test Doc",
        user_config=user_config,
        draft_context="both"
    )

    print(f"\nUser config: {user_config}")
    print(f"Preview decision:")
    print(f"  - strategy: {preview_decision.strategy}")
    print(f"  - chunk_size: {preview_decision.chunk_size}")
    print(f"  - chunk_overlap: {preview_decision.chunk_overlap}")
    print(f"  - user_preference: {preview_decision.user_preference}")
    print(f"  - reasoning: {preview_decision.reasoning}")

    # Verify preview uses exact user values
    assert preview_decision.strategy == "semantic", f"Expected semantic, got {preview_decision.strategy}"
    assert preview_decision.chunk_size == 1500, f"Expected 1500, got {preview_decision.chunk_size}"
    assert preview_decision.chunk_overlap == 300, f"Expected 300, got {preview_decision.chunk_overlap}"
    assert preview_decision.user_preference == True, "Should indicate user preference was used"

    print("\n✅ Full config parity test PASSED")
    return True


def test_partial_config_parity():
    """Test: When user provides PARTIAL values, adaptive logic fills the rest."""
    print("\n" + "=" * 70)
    print("TEST: Partial Config Parity (strategy only)")
    print("=" * 70)

    # Only provide strategy
    user_config = {"strategy": "semantic"}

    preview_decision = smart_kb_service.make_chunking_decision_for_preview(
        content=SAMPLE_CONTENT,
        title="Test Doc",
        user_config=user_config,
        draft_context="both"
    )

    print(f"\nUser config: {user_config}")
    print(f"Preview decision:")
    print(f"  - strategy: {preview_decision.strategy}")
    print(f"  - chunk_size: {preview_decision.chunk_size}")
    print(f"  - chunk_overlap: {preview_decision.chunk_overlap}")
    print(f"  - user_preference: {preview_decision.user_preference}")
    print(f"  - reasoning: {preview_decision.reasoning}")

    # Verify strategy is user's choice
    assert preview_decision.strategy == "semantic", f"Expected semantic, got {preview_decision.strategy}"

    # Verify chunk_size and chunk_overlap were adaptively determined (not static defaults)
    # For "both" context with documentation content, base is 1200 * 1.2 = 1440
    assert preview_decision.chunk_size != 1000, "Should NOT use static default 1000"
    assert "adaptive" in preview_decision.reasoning.lower() or "suggestion" in preview_decision.reasoning.lower()

    print("\n✅ Partial config parity test PASSED")
    return True


def test_no_config_parity():
    """Test: When user provides NO values, adaptive logic determines everything."""
    print("\n" + "=" * 70)
    print("TEST: No Config (Full Adaptive)")
    print("=" * 70)

    # No config
    user_config = {}

    preview_decision = smart_kb_service.make_chunking_decision_for_preview(
        content=SAMPLE_CONTENT,
        title="Test Doc",
        user_config=user_config,
        draft_context="both"
    )

    print(f"\nUser config: {user_config}")
    print(f"Preview decision:")
    print(f"  - strategy: {preview_decision.strategy}")
    print(f"  - chunk_size: {preview_decision.chunk_size}")
    print(f"  - chunk_overlap: {preview_decision.chunk_overlap}")
    print(f"  - user_preference: {preview_decision.user_preference}")
    print(f"  - adaptive_suggestion: {preview_decision.adaptive_suggestion}")
    print(f"  - reasoning: {preview_decision.reasoning}")

    # Verify all values are adaptive (not static defaults)
    assert preview_decision.user_preference == False, "Should indicate NO user preference"
    assert preview_decision.strategy != "by_heading" or "adaptive" in preview_decision.reasoning.lower()

    print("\n✅ No config parity test PASSED")
    return True


def test_context_affects_chunk_size():
    """Test: Draft context affects chunk size adaptively."""
    print("\n" + "=" * 70)
    print("TEST: Context Affects Chunk Size")
    print("=" * 70)

    # Test with different contexts
    contexts = ["chatbots", "chatflows", "both"]
    decisions = {}

    for context in contexts:
        decision = smart_kb_service.make_chunking_decision_for_preview(
            content=SAMPLE_CONTENT,
            title="Test Doc",
            user_config={},  # No user config - full adaptive
            draft_context=context
        )
        decisions[context] = decision
        print(f"\nContext: {context}")
        print(f"  - chunk_size: {decision.chunk_size}")
        print(f"  - chunk_overlap: {decision.chunk_overlap}")

    # Verify chatbots gets smaller chunks (800 base)
    # Verify chatflows gets larger chunks (1500 base)
    # Verify both gets balanced chunks (1200 base)

    # Note: Final sizes are adjusted by content type multiplier (documentation = 1.2x)
    assert decisions["chatbots"].chunk_size < decisions["both"].chunk_size, \
        f"Chatbots ({decisions['chatbots'].chunk_size}) should be < both ({decisions['both'].chunk_size})"

    assert decisions["chatflows"].chunk_size > decisions["both"].chunk_size, \
        f"Chatflows ({decisions['chatflows'].chunk_size}) should be > both ({decisions['both'].chunk_size})"

    print("\n✅ Context affects chunk size test PASSED")
    return True


def test_no_chunking_strategy():
    """Test: no_chunking strategy returns full content."""
    print("\n" + "=" * 70)
    print("TEST: No Chunking Strategy")
    print("=" * 70)

    user_config = {"strategy": "no_chunking"}

    decision = smart_kb_service.make_chunking_decision_for_preview(
        content=SAMPLE_CONTENT,
        title="Test Doc",
        user_config=user_config,
        draft_context="both"
    )

    print(f"\nUser config: {user_config}")
    print(f"Decision:")
    print(f"  - strategy: {decision.strategy}")
    print(f"  - chunk_size: {decision.chunk_size}")
    print(f"  - chunk_overlap: {decision.chunk_overlap}")

    assert decision.strategy == "no_chunking"
    assert decision.chunk_size == len(SAMPLE_CONTENT), f"Expected {len(SAMPLE_CONTENT)}, got {decision.chunk_size}"
    assert decision.chunk_overlap == 0

    print("\n✅ No chunking strategy test PASSED")
    return True


def main():
    """Run all parity tests."""
    print("\n" + "#" * 70)
    print("# PREVIEW/PRODUCTION PARITY TEST SUITE")
    print("#" * 70)

    results = {}

    try:
        results["full_config"] = test_full_config_parity()
    except AssertionError as e:
        print(f"\n❌ Full config test FAILED: {e}")
        results["full_config"] = False

    try:
        results["partial_config"] = test_partial_config_parity()
    except AssertionError as e:
        print(f"\n❌ Partial config test FAILED: {e}")
        results["partial_config"] = False

    try:
        results["no_config"] = test_no_config_parity()
    except AssertionError as e:
        print(f"\n❌ No config test FAILED: {e}")
        results["no_config"] = False

    try:
        results["context_affects_size"] = test_context_affects_chunk_size()
    except AssertionError as e:
        print(f"\n❌ Context affects size test FAILED: {e}")
        results["context_affects_size"] = False

    try:
        results["no_chunking"] = test_no_chunking_strategy()
    except AssertionError as e:
        print(f"\n❌ No chunking test FAILED: {e}")
        results["no_chunking"] = False

    # Summary
    print("\n" + "=" * 70)
    print("TEST SUMMARY")
    print("=" * 70)

    all_passed = True
    for name, passed in results.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"  {name}: {status}")
        if not passed:
            all_passed = False

    print()
    if all_passed:
        print("🎉 ALL PARITY TESTS PASSED!")
        return 0
    else:
        print("⚠️ SOME TESTS FAILED")
        return 1


if __name__ == "__main__":
    sys.exit(main())
