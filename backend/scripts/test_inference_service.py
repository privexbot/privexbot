#!/usr/bin/env python3
"""
Test Inference Service - Verify provider connectivity and response generation.

Tests all supported providers:
- Secret AI (OpenAI-compatible)
- Ollama (local inference)
- OpenAI
- DeepSeek
- Gemini (Google AI)

Usage:
    # From backend directory
    docker compose -f docker-compose.dev.yml exec backend-dev python scripts/test_inference_service.py

    # Or locally with virtual environment
    cd backend && python scripts/test_inference_service.py

    # Test specific provider
    python scripts/test_inference_service.py --provider gemini
"""

import os
import sys
import asyncio
import argparse
from datetime import datetime

# Add src to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from app.services.inference_service import (
    InferenceService,
    InferenceProvider,
    create_inference_service,
    inference_service
)


def print_header(title: str):
    """Print section header."""
    print("\n" + "=" * 60)
    print(title)
    print("=" * 60)


def print_result(label: str, value: str, status: str = "info"):
    """Print result with color coding."""
    icons = {"success": "✅", "error": "❌", "info": "ℹ️", "warning": "⚠️"}
    icon = icons.get(status, "•")
    print(f"  {icon} {label}: {value}")


async def test_provider(provider: InferenceProvider) -> dict:
    """
    Test a specific provider.

    Returns:
        {
            "provider": "name",
            "healthy": True/False,
            "models": [...],
            "response": "...",
            "error": None or error message
        }
    """
    result = {
        "provider": provider.value,
        "healthy": False,
        "models": [],
        "response": None,
        "error": None
    }

    try:
        print(f"\n  Testing {provider.value}...")

        # Create service for this provider
        service = create_inference_service(provider=provider)

        # Health check
        health = service.health_check()
        result["healthy"] = health.get("healthy", False)

        if "base_url" in health:
            print_result("Base URL", health["base_url"])
        print_result("Default Model", health.get("default_model", "unknown"))

        if not health["healthy"]:
            result["error"] = health.get("error")
            print_result("Health Check", "FAILED", "error")
            print_result("Error", str(health.get("error", "Unknown"))[:100], "error")
            return result

        print_result("Health Check", "PASSED", "success")

        # List models
        models = service.list_models()
        result["models"] = models[:5]  # First 5 models
        print_result(
            "Available Models",
            f"{len(models)} found" if models else "Unable to list",
            "success" if models else "warning"
        )

        if models:
            for model in models[:3]:
                print(f"      - {model}")
            if len(models) > 3:
                print(f"      ... and {len(models) - 3} more")

        # Test generation with structured messages
        print(f"\n  Testing chat completion...")
        test_messages = [
            {"role": "system", "content": "You are a helpful assistant. Be concise."},
            {"role": "user", "content": "What is 2 + 2? Answer in one word."}
        ]

        response = await service.generate_chat(
            messages=test_messages,
            temperature=0.1,
            max_tokens=50
        )

        result["response"] = response["text"]
        print_result("Response", response["text"][:100], "success")
        print_result("Provider", response.get("provider", "unknown"))
        print_result("Model", response.get("model", "unknown"))
        print_result("Tokens Used", str(response.get("usage", {})))

        return result

    except Exception as e:
        result["error"] = str(e)
        print_result("Error", str(e)[:100], "error")
        return result


async def test_global_instance():
    """Test the global inference_service instance."""
    print_header("Testing Global Instance (Auto-detected Provider)")

    health = inference_service.health_check()
    print_result("Provider", health.get("provider", "unknown"))
    if "base_url" in health:
        print_result("Base URL", health["base_url"])
    print_result("Default Model", health.get("default_model", "unknown"))
    print_result("Healthy", str(health.get("healthy", False)), "success" if health.get("healthy") else "error")

    if health.get("error"):
        print_result("Error", str(health["error"])[:100], "error")

    return health


async def test_model_routing():
    """Test automatic provider routing based on model prefix."""
    print_header("Testing Model-Based Provider Routing")

    test_cases = [
        ("gemini-2.0-flash", "gemini"),
        ("gpt-4o-mini", "openai"),
        ("deepseek-chat", "deepseek"),
        ("ollama/llama3", "ollama"),
        ("llama3.1", None),  # Should use default
    ]

    for model, expected_provider in test_cases:
        detected = inference_service._detect_provider_from_model(model)
        actual = detected.value if detected else "default"
        expected = expected_provider or "default"
        status = "success" if actual == expected else "warning"
        print_result(f"Model '{model}'", f"-> {actual}", status)


async def main(specific_provider: str = None):
    """Run all tests."""
    print_header("Inference Service Test Suite")
    print(f"Started: {datetime.now().isoformat()}")

    # Check environment
    print("\n  Environment Variables:")
    env_vars = [
        ("SECRET_AI_API_KEY", "Secret AI"),
        ("GEMINI_API_KEY", "Google Gemini"),
        ("OPENAI_API_KEY", "OpenAI"),
        ("DEEPSEEK_API_KEY", "DeepSeek"),
        ("OLLAMA_BASE_URL", "Ollama"),
    ]

    for env_var, name in env_vars:
        value = os.getenv(env_var)
        if value:
            # Mask API keys
            if "KEY" in env_var:
                display = f"set ({value[:8]}...{value[-4:]})"
            else:
                display = value
        else:
            display = "not set"
        print_result(name, display)

    # Test global instance
    await test_global_instance()

    # Test model routing
    await test_model_routing()

    # Test providers
    results = {}

    print_header("Testing Individual Providers")

    providers_to_test = [
        (InferenceProvider.OLLAMA, None),  # Always test
        (InferenceProvider.SECRET_AI, "SECRET_AI_API_KEY"),
        (InferenceProvider.GEMINI, "GEMINI_API_KEY"),
        (InferenceProvider.OPENAI, "OPENAI_API_KEY"),
        (InferenceProvider.DEEPSEEK, "DEEPSEEK_API_KEY"),
    ]

    for i, (provider, required_env) in enumerate(providers_to_test, 1):
        # If specific provider requested, skip others
        if specific_provider and provider.value != specific_provider:
            continue

        print(f"\n[{i}/{len(providers_to_test)}] {provider.value.upper()}")

        # Check if we should skip
        if required_env and not os.getenv(required_env):
            print_result("Skipped", f"{required_env} not set", "warning")
            results[provider.value] = {
                "provider": provider.value,
                "healthy": False,
                "error": f"{required_env} not set"
            }
            continue

        results[provider.value] = await test_provider(provider)

    # Summary
    print_header("SUMMARY")

    working_providers = []
    for name, result in results.items():
        status = "success" if result.get("healthy") else "error"
        status_text = "WORKING" if result.get("healthy") else "NOT AVAILABLE"
        print_result(name.upper(), status_text, status)
        if result.get("healthy"):
            working_providers.append(name)

    print(f"\n  Working providers: {len(working_providers)}/{len(results)}")

    if working_providers:
        print(f"\n  ✅ Inference service ready with: {', '.join(working_providers)}")
        print(f"\n  Default provider: {inference_service.default_provider.value}")
    else:
        print("\n  ⚠️ No providers available. Configure one of:")
        print("     - GEMINI_API_KEY (Google Gemini - free tier available)")
        print("     - SECRET_AI_API_KEY (Secret AI)")
        print("     - OPENAI_API_KEY (OpenAI)")
        print("     - DEEPSEEK_API_KEY (DeepSeek)")
        print("     - Install Ollama locally: https://ollama.com/download")

    return results


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Test inference service providers")
    parser.add_argument(
        "--provider", "-p",
        choices=["secret_ai", "ollama", "openai", "deepseek", "gemini"],
        help="Test specific provider only"
    )
    args = parser.parse_args()

    asyncio.run(main(args.provider))
