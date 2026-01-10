# PrivexBot Secret AI Inference

## Overview

PrivexBot uses **Secret AI** as its primary AI inference provider. Secret AI runs in a Trusted Execution Environment (TEE) on Secret VM, ensuring that user conversations and prompts remain private and encrypted during processing.

## Privacy-First Architecture

### Why Secret AI?

1. **TEE Protection**: Processing happens in isolated, encrypted memory
2. **No Data Leakage**: Prompts never leave the secure environment
3. **Self-Hosted**: Complete control over infrastructure
4. **Decentralized Fallback**: Akash ML as backup provider

### Provider Hierarchy

```
Primary: Secret AI (privacy-preserving via TEE)
    ↓ (on network error)
Fallback: Akash ML (decentralized inference)
```

## Supported Providers

### Secret AI (Primary)

```python
PROVIDER_CONFIG = {
    "base_url": "https://secretai-api-url.scrtlabs.com:443/v1",
    "api_key_env": "SECRET_AI_API_KEY",
    "default_model": "DeepSeek-R1-Distill-Llama-70B",
    "timeout": 120.0,
    "description": "Secret AI - Privacy-preserving inference via TEE"
}
```

**Supported Models**:
- DeepSeek-R1-Distill-Llama-70B (default)
- Other models as available from Secret Network

### Akash ML (Fallback)

```python
PROVIDER_CONFIG = {
    "base_url": "https://api.akashml.com/v1",
    "api_key_env": "AKASHML_API_KEY",
    "default_model": "deepseek-ai/DeepSeek-V3.1",
    "timeout": 90.0,
    "description": "Akash ML - Decentralized AI inference"
}
```

**Features**:
- Decentralized compute network
- Automatic failover from Secret AI
- OpenAI-compatible API

## API Integration

### OpenAI-Compatible Interface

Both providers use OpenAI-compatible API format:

```python
class OpenAICompatibleProvider:
    async def generate_chat(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        stop: Optional[List[str]] = None
    ) -> InferenceResponse:

        params = {
            "model": model or self.default_model,
            "messages": messages,
        }
        if temperature is not None:
            params["temperature"] = temperature
        if max_tokens is not None:
            params["max_tokens"] = max_tokens

        # Call OpenAI-compatible API
        response = await self.async_client.chat.completions.create(**params)

        return InferenceResponse(
            text=response.choices[0].message.content,
            usage={
                "prompt_tokens": response.usage.prompt_tokens,
                "completion_tokens": response.usage.completion_tokens,
                "total_tokens": response.usage.total_tokens
            },
            model=response.model,
            provider=self.provider_name
        )
```

### Inference Service

High-level service with automatic provider selection and fallback:

```python
async def generate_chat(
    messages: List[Dict[str, str]],
    model: Optional[str] = None,
    temperature: Optional[float] = None,
    max_tokens: Optional[int] = None,
    provider: Optional[InferenceProvider] = None
) -> dict:
    """
    Generate chat completion with automatic fallback.

    1. Resolve provider from model name prefix
    2. Try primary provider (Secret AI)
    3. On network error, try fallback (Akash ML)
    4. Return response or raise error
    """

    # Resolve provider and model
    use_provider, use_model = _resolve_provider_and_model(model, provider)

    # Try with fallback support
    response = await _try_with_fallback(
        primary_provider=use_provider,
        primary_model=use_model,
        generate_fn=_generate
    )

    return response.to_dict()
```

## Model Auto-Detection

Provider selected based on model name prefix:

```python
def _resolve_provider_and_model(model: str, provider: Optional[str]):
    if model:
        model_lower = model.lower()

        # Secret AI prefixes
        if model_lower.startswith(("secret-", "secretai-", "secret_ai-")):
            return InferenceProvider.SECRET_AI, model

        # Akash ML prefixes
        if model_lower.startswith(("akash-", "akashml-")):
            return InferenceProvider.AKASH_ML, model

    # Default to Secret AI
    return InferenceProvider.SECRET_AI, PROVIDER_CONFIGS[InferenceProvider.SECRET_AI]["default_model"]
```

## Automatic Fallback

When Secret AI fails (network error, timeout), automatically tries Akash ML:

```python
async def _try_with_fallback(
    primary_provider: InferenceProvider,
    primary_model: str,
    generate_fn
) -> InferenceResponse:
    """
    Try primary provider, fallback on network errors.
    """

    errors = []

    # Try primary (Secret AI)
    try:
        provider_instance = _get_provider(primary_provider)
        return await generate_fn(provider_instance, primary_model)

    except NetworkError as e:
        errors.append(f"{primary_provider.value}: {str(e)[:100]}")
        print(f"[InferenceService] Primary provider network error")

        if not self.enable_fallback:
            raise NetworkError("Primary provider failed, fallback disabled")

    except RateLimitError:
        # Don't fallback for rate limits - propagate
        raise

    # Try fallbacks
    for fallback_provider in FALLBACK_ORDER:  # [Akash ML]
        try:
            print(f"[InferenceService] Trying fallback: {fallback_provider.value}")
            fallback_model = _get_default_model(fallback_provider)
            provider_instance = _get_provider(fallback_provider)

            response = await generate_fn(provider_instance, fallback_model)
            print(f"[InferenceService] Fallback succeeded")
            return response

        except NetworkError:
            errors.append(f"{fallback_provider.value}: network error")
            continue

    # All providers failed
    raise InferenceError(f"All providers failed: {'; '.join(errors)}")
```

## Error Handling

### Error Types

```python
class NetworkError(InferenceError):
    """Connection failed - firewall, VPN, DNS issues"""

class RateLimitError(InferenceError):
    """API rate limit exceeded"""

class AuthError(InferenceError):
    """Invalid or missing API key"""

class ModelNotFoundError(InferenceError):
    """Model not available on provider"""

class ProviderUnavailableError(InferenceError):
    """Provider down or misconfigured"""
```

### Error Conversion

```python
def _handle_error(e: Exception):
    from openai import (
        APIConnectionError, RateLimitError, AuthenticationError, APITimeoutError
    )

    if isinstance(e, (APIConnectionError, APITimeoutError)):
        raise NetworkError(
            f"Failed to connect to {provider}. "
            "Check network, firewall, or VPN settings."
        )

    if isinstance(e, RateLimitError):
        raise RateLimitError(f"Rate limit exceeded: {e}")

    if isinstance(e, AuthenticationError):
        raise AuthError(f"Authentication failed: {e}")
```

## Streaming Support

The inference service supports streaming responses:

```python
async def generate_chat_stream(
    messages: List[Dict[str, str]],
    model: Optional[str] = None,
    temperature: Optional[float] = None,
    max_tokens: Optional[int] = None
) -> AsyncIterator[str]:
    """
    Generate streaming chat completion.
    Yields tokens as they're generated.
    """

    provider_instance = _get_provider(provider)

    async for chunk in provider_instance.generate_chat_stream(
        messages=messages,
        model=model,
        temperature=temperature,
        max_tokens=max_tokens
    ):
        yield chunk
```

**Note**: Streaming is implemented at the inference layer but not currently exposed in the public chat API (buffered responses used).

## Configuration

### Environment Variables

```bash
# Secret AI
SECRET_AI_API_KEY=your_secret_ai_key
SECRET_AI_BASE_URL=https://secretai-api-url.scrtlabs.com:443/v1

# Akash ML (fallback)
AKASHML_API_KEY=your_akash_key

# Fallback settings
INFERENCE_FALLBACK_ENABLED=true
```

### Chatbot AI Config

```python
ai_config = {
    "provider": "secret_ai",           # Default provider
    "model": "DeepSeek-R1-Distill-Llama-70B",
    "temperature": 0.7,
    "max_tokens": 2000,
    "top_p": 0.9
}
```

## Usage in RAG Pipeline

### Context Injection

```python
# After retrieving KB context
messages = [
    {
        "role": "system",
        "content": f"""
{system_prompt}

KNOWLEDGE BASE CONTEXT:
{retrieved_context}
"""
    },
    {"role": "user", "content": user_message}
]

# Call Secret AI
response = await inference_service.generate_chat(
    messages=messages,
    model=chatbot.ai_config.get("model"),
    temperature=chatbot.ai_config.get("temperature")
)
```

### Token Tracking

```python
response = await inference_service.generate_chat(messages=messages)

# Usage tracked
tokens_used = response["usage"]
# {
#     "prompt_tokens": 1500,
#     "completion_tokens": 350,
#     "total_tokens": 1850
# }

# Saved with message
save_message(
    session_id=session.id,
    content=response["text"],
    prompt_tokens=tokens_used["prompt_tokens"],
    completion_tokens=tokens_used["completion_tokens"]
)
```

## Performance

### Timeouts

| Provider | Timeout |
|----------|---------|
| Secret AI | 120 seconds |
| Akash ML | 90 seconds |

### Typical Latencies

| Operation | Latency |
|-----------|---------|
| Small response (~100 tokens) | 1-3 seconds |
| Medium response (~500 tokens) | 3-8 seconds |
| Large response (~2000 tokens) | 8-15 seconds |

## Security Benefits

### Secret AI TEE Features

1. **Encrypted Memory**: Prompts encrypted during processing
2. **Attestation**: Verifiable execution environment
3. **No Logging**: Prompts not logged or stored by provider
4. **Isolation**: Processing isolated from other workloads

### Data Flow

```
User Message
    ↓
PrivexBot Backend (Secret VM)
    ↓ (HTTPS + API Key)
Secret AI TEE
    ↓ (Encrypted processing)
Response
    ↓
User (via PrivexBot)
```

## Summary

PrivexBot's inference architecture provides:

1. **Privacy-First**: Secret AI TEE for encrypted processing
2. **Reliable**: Automatic fallback to Akash ML
3. **Flexible**: OpenAI-compatible API for easy integration
4. **Observable**: Token tracking and usage metrics
5. **Secure**: API key authentication, no data logging
6. **Self-Hosted**: Complete infrastructure control
