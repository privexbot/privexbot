#!/usr/bin/env python3
"""
Test Secret AI SDK - Run in Python 3.12 environment.

Usage (local):
    export SECRET_AI_API_KEY='your_key'
    python3.12 scripts/test_secret_ai.py

Usage (docker):
    docker run --rm -e SECRET_AI_API_KEY=$SECRET_AI_API_KEY \
        -v $(pwd):/app python:3.12-slim bash -c \
        "pip install secret-ai-sdk && python /app/scripts/test_secret_ai.py"
"""

import os
import sys
import json
from datetime import datetime

# Configuration
LCD_URLS = [
    'https://lcd.secret.express/',
    'https://lcd.mainnet.secretsaturn.net/',
    'https://secretnetwork-api.lavenderfive.com:443/',
    'https://secret-4.api.trivium.network:1317/',
    'https://scrt-lcd.stakingcabin.com/',
]

SMART_CONTRACT = 'secret1xv90yettghx8uv6ug23knaf5mjqwlsghau6aqa'
CHAIN_ID = 'secret-4'


def test_secret_ai():
    """Test Secret AI SDK with different models."""

    print("=" * 60)
    print("Secret AI SDK Test")
    print(f"Started: {datetime.now().isoformat()}")
    print("=" * 60)

    # Check API key
    api_key = os.environ.get("SECRET_AI_API_KEY")
    if not api_key:
        print("ERROR: SECRET_AI_API_KEY environment variable not set")
        sys.exit(1)

    print(f"API Key: {api_key[:10]}...{api_key[-4:]}")
    print(f"Smart Contract: {SMART_CONTRACT}")
    print(f"Chain ID: {CHAIN_ID}")

    try:
        from secret_ai_sdk.secret_ai import ChatSecret
        from secret_ai_sdk.secret import Secret

        # Find working LCD URL
        print("\n1. Finding working LCD node...")
        secret_client = None
        working_url = None

        for url in LCD_URLS:
            try:
                print(f"   Trying: {url}")
                os.environ['SECRET_NODE_URL'] = url
                os.environ['SECRET_CHAIN_ID'] = CHAIN_ID
                os.environ['SECRET_WORKER_SMART_CONTRACT'] = SMART_CONTRACT

                client = Secret(
                    node_url=url,
                    chain_id=CHAIN_ID,
                    smart_contract=SMART_CONTRACT
                )
                # Quick test - try to get models
                models = client.get_models()
                print(f"   ✅ SUCCESS: {url}")
                secret_client = client
                working_url = url
                break
            except Exception as e:
                print(f"   ❌ FAILED: {type(e).__name__}: {str(e)[:50]}...")
                continue

        if not secret_client:
            print("\nERROR: No working LCD node found!")
            print("Trying with environment variables only...")

            # Last resort - let SDK use defaults
            secret_client = Secret()
            models = secret_client.get_models()

        print(f"\n2. Available models: {len(models)}")
        for i, model in enumerate(models):
            print(f"   [{i}] {model}")

        # Test each model
        results = {}
        test_message = [
            ("system", "You are a helpful assistant. Be concise."),
            ("human", "What is 2 + 2? Answer in one word."),
        ]

        for model_name in models:
            print(f"\n3. Testing model: {model_name}")
            print("-" * 40)

            try:
                # Get URLs for this model
                print(f"   Fetching service URLs...")
                urls = secret_client.get_urls(model=model_name)
                print(f"   Available service URLs: {len(urls)}")

                if not urls:
                    print(f"   ERROR: No service URLs available for {model_name}")
                    results[model_name] = {"status": "error", "error": "No service URLs"}
                    continue

                # Create ChatSecret instance
                service_url = urls[0]
                print(f"   Service URL: {service_url}")

                secret_ai_llm = ChatSecret(
                    base_url=service_url,
                    model=model_name,
                    temperature=0.7
                )

                # Send test message
                print(f"   Sending test message...")
                response = secret_ai_llm.invoke(test_message)

                # Extract response
                response_text = str(response.content) if hasattr(response, 'content') else str(response)
                print(f"   ✅ Response: {response_text[:100]}...")

                results[model_name] = {
                    "status": "success",
                    "service_url": service_url,
                    "response": response_text
                }

            except Exception as e:
                print(f"   ❌ ERROR: {type(e).__name__}: {e}")
                results[model_name] = {"status": "error", "error": str(e)}

        # Summary
        print("\n" + "=" * 60)
        print("SUMMARY")
        print("=" * 60)

        successful = 0
        for model, result in results.items():
            status = "✓" if result["status"] == "success" else "✗"
            print(f"{status} {model}: {result['status']}")
            if result["status"] == "success":
                print(f"    Service URL: {result.get('service_url', 'N/A')}")
                successful += 1

        print(f"\nTotal: {successful}/{len(results)} models working")

        # Output JSON for parsing
        print("\n" + "=" * 60)
        print("JSON OUTPUT (for parsing):")
        print(json.dumps({
            "working_lcd_url": working_url,
            "models": results
        }, indent=2))

        return results

    except ImportError as e:
        print(f"ERROR: Failed to import Secret AI SDK: {e}")
        print("Make sure to install: pip install secret-ai-sdk")
        sys.exit(1)
    except Exception as e:
        print(f"ERROR: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    test_secret_ai()
