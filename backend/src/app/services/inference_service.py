"""
Inference Service - Decentralized AI inference for PrivexBot.

WHY:
- Centralized AI API calls using decentralized providers
- Used by both chatbots and chatflows
- Backend-only (never expose API keys to frontend)
- Error handling and retry logic
- Provider abstraction for flexibility

HOW:
- Abstract provider interface with concrete implementations
- OpenAI-compatible provider (Secret AI uses this)
- Automatic provider detection based on model prefix or config
- Structured message format internally, converted per-provider

SUPPORTED PROVIDERS:
- Secret AI (OpenAI-compatible) - PRIMARY, privacy-preserving via TEE

MESSAGE FORMAT:
All methods accept structured messages:
[
    {"role": "system", "content": "You are a helpful assistant..."},
    {"role": "user", "content": "Hello"},
    {"role": "assistant", "content": "Hi there!"},
    {"role": "user", "content": "How are you?"}
]

For backward compatibility, generate() accepts a single prompt string
and converts it to a user message internally.

NETWORK NOTES:
- Secret AI is the PRIMARY provider for PrivexBot (runs on SecretVM)
- In production (SecretVM), Secret AI should work without network issues
"""

import os
import re
import asyncio
from abc import ABC, abstractmethod
from typing import AsyncIterator, Optional, List, Dict, Any, Union


# Reasoning models (e.g. DeepSeek-R1, the default per llm_node.py:46) emit
# chain-of-thought wrapped in <think>...</think> before the answer. That is
# never appropriate to surface to end users via chat / live-test responses,
# so strip it at the inference boundary. The raw response is still kept on
# InferenceResponse.raw_response for callers that need it.
_THINK_BLOCK_RE = re.compile(r"<think>.*?</think>", re.DOTALL | re.IGNORECASE)


def _strip_thinking(text: str) -> str:
    if not text:
        return text
    return _THINK_BLOCK_RE.sub("", text).strip()
from enum import Enum
from dataclasses import dataclass

from app.core.config import settings


class InferenceProvider(str, Enum):
    """Supported inference providers - focused on decentralized AI."""
    SECRET_AI = "secret_ai"  # Primary - privacy-preserving via TEE
    CUSTOM = "custom"        # For custom OpenAI-compatible endpoints


class InferenceError(Exception):
    """Base exception for inference errors."""
    pass


class RateLimitError(InferenceError):
    """Rate limit exceeded."""
    pass


class AuthError(InferenceError):
    """Authentication failed."""
    pass


class NetworkError(InferenceError):
    """
    Network/connection error - often caused by local network restrictions.

    Common causes:
    - Firewall blocking Secret AI endpoints
    - VPN interference
    - DNS issues
    - Corporate network restrictions

    Solution: Use fallback providers or check network configuration.
    """
    pass


class ModelNotFoundError(InferenceError):
    """Requested model not available."""
    pass


class ProviderUnavailableError(InferenceError):
    """Provider is not available (no API key, service down, etc.)."""
    pass


@dataclass
class InferenceResponse:
    """Standardized response from any provider."""
    text: str
    usage: Dict[str, int]  # prompt_tokens, completion_tokens, total_tokens
    model: str
    provider: str
    raw_response: Any = None  # Original response for debugging

    def to_dict(self) -> dict:
        """Convert to dictionary for backward compatibility."""
        return {
            "text": self.text,
            "usage": self.usage,
            "model": self.model,
            "provider": self.provider
        }


# Provider configurations - Decentralized AI only
# SECRET_AI is the primary (and only) provider
PROVIDER_CONFIGS = {
    InferenceProvider.SECRET_AI: {
        "base_url": os.getenv("SECRET_AI_BASE_URL", "https://secretai-api-url.scrtlabs.com:443/v1"),
        "api_key_env": "SECRET_AI_API_KEY",
        "default_model": "DeepSeek-R1-Distill-Llama-70B",
        "model_prefixes": ["secret-", "secretai-", "secret_ai-"],
        "timeout": 120.0,  # Longer timeout for TEE processing
        "description": "Secret AI - Privacy-preserving inference via Trusted Execution Environment",
    },
}

# Fallback order when primary provider (Secret AI) fails
# Currently empty - Secret AI is the only provider
FALLBACK_ORDER = []


class BaseProvider(ABC):
    """Abstract base class for inference providers."""

    @abstractmethod
    async def generate_chat(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        stop: Optional[List[str]] = None,
        **kwargs
    ) -> InferenceResponse:
        """Generate chat completion (async)."""
        pass

    @abstractmethod
    def generate_chat_sync(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        stop: Optional[List[str]] = None,
        **kwargs
    ) -> InferenceResponse:
        """Generate chat completion (sync)."""
        pass

    @abstractmethod
    async def generate_chat_stream(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        **kwargs
    ) -> AsyncIterator[str]:
        """Generate streaming chat completion."""
        pass

    @abstractmethod
    def list_models(self) -> List[str]:
        """List available models."""
        pass

    @abstractmethod
    def health_check(self) -> dict:
        """Check provider health."""
        pass


class OpenAICompatibleProvider(BaseProvider):
    """
    Provider for OpenAI-compatible APIs.

    Works with: OpenAI, Ollama, DeepSeek, Secret AI, Azure OpenAI, etc.
    """

    def __init__(
        self,
        base_url: str,
        api_key: str,
        default_model: str = "llama3.1",
        provider_name: str = "openai_compatible",
        timeout: float = 60.0
    ):
        from openai import OpenAI, AsyncOpenAI

        self.base_url = base_url
        self.api_key = api_key
        self.default_model = default_model
        self.provider_name = provider_name
        self.timeout = timeout

        self.client = OpenAI(
            base_url=base_url,
            api_key=api_key or "placeholder",  # Some providers don't need key
            timeout=timeout
        )

        self.async_client = AsyncOpenAI(
            base_url=base_url,
            api_key=api_key or "placeholder",
            timeout=timeout
        )

    def _handle_error(self, e: Exception) -> None:
        """Convert OpenAI errors to our error types with helpful messages."""
        from openai import (
            APIError, APIConnectionError,
            RateLimitError as OpenAIRateLimitError,
            AuthenticationError,
            APITimeoutError
        )
        import httpx

        error_str = str(e).lower()

        # Network/connection errors
        if isinstance(e, (APIConnectionError, APITimeoutError)):
            raise NetworkError(
                f"Failed to connect to {self.provider_name} at {self.base_url}. "
                f"This may be caused by network restrictions, firewall, or VPN. "
                f"If using Secret AI locally, your network may be blocking the endpoint. "
                f"The service will work correctly when deployed on SecretVM. "
                f"Original error: {e}"
            )

        # Check for httpx connection errors (wrapped)
        if isinstance(e, Exception) and "connect" in error_str:
            raise NetworkError(
                f"Connection failed to {self.provider_name}. "
                f"Check your network configuration or use a fallback provider. "
                f"Original error: {e}"
            )

        if isinstance(e, OpenAIRateLimitError):
            raise RateLimitError(f"Rate limit exceeded for {self.provider_name}: {e}")
        elif isinstance(e, AuthenticationError):
            raise AuthError(f"Authentication failed for {self.provider_name}: {e}")
        elif isinstance(e, APIError):
            if "rate" in error_str or "quota" in error_str:
                raise RateLimitError(f"Rate limit exceeded for {self.provider_name}: {e}")
            raise InferenceError(f"API error from {self.provider_name}: {e}")
        else:
            # Check for network-related keywords
            if any(keyword in error_str for keyword in ["connect", "timeout", "refused", "unreachable", "network"]):
                raise NetworkError(
                    f"Network error with {self.provider_name}: {e}. "
                    f"Try a different provider or check your network."
                )
            raise InferenceError(f"Unexpected error from {self.provider_name}: {e}")

    async def generate_chat(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        stop: Optional[List[str]] = None,
        **kwargs
    ) -> InferenceResponse:
        try:
            # Build request params, only include if specified
            params = {
                "model": model or self.default_model,
                "messages": messages,
            }
            if temperature is not None:
                params["temperature"] = temperature
            if max_tokens is not None:
                params["max_tokens"] = max_tokens
            if stop:
                params["stop"] = stop

            response = await self.async_client.chat.completions.create(**params)

            return InferenceResponse(
                text=_strip_thinking(response.choices[0].message.content or ""),
                usage={
                    "prompt_tokens": response.usage.prompt_tokens if response.usage else 0,
                    "completion_tokens": response.usage.completion_tokens if response.usage else 0,
                    "total_tokens": response.usage.total_tokens if response.usage else 0,
                },
                model=response.model,
                provider=self.provider_name,
                raw_response=response
            )
        except Exception as e:
            self._handle_error(e)

    def generate_chat_sync(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        stop: Optional[List[str]] = None,
        **kwargs
    ) -> InferenceResponse:
        try:
            params = {
                "model": model or self.default_model,
                "messages": messages,
            }
            if temperature is not None:
                params["temperature"] = temperature
            if max_tokens is not None:
                params["max_tokens"] = max_tokens
            if stop:
                params["stop"] = stop

            response = self.client.chat.completions.create(**params)

            return InferenceResponse(
                text=_strip_thinking(response.choices[0].message.content or ""),
                usage={
                    "prompt_tokens": response.usage.prompt_tokens if response.usage else 0,
                    "completion_tokens": response.usage.completion_tokens if response.usage else 0,
                    "total_tokens": response.usage.total_tokens if response.usage else 0,
                },
                model=response.model,
                provider=self.provider_name,
                raw_response=response
            )
        except Exception as e:
            self._handle_error(e)

    async def generate_chat_stream(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        **kwargs
    ) -> AsyncIterator[str]:
        try:
            params = {
                "model": model or self.default_model,
                "messages": messages,
                "stream": True,
            }
            if temperature is not None:
                params["temperature"] = temperature
            if max_tokens is not None:
                params["max_tokens"] = max_tokens

            stream = await self.async_client.chat.completions.create(**params)

            async for chunk in stream:
                if chunk.choices and chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content

        except Exception as e:
            self._handle_error(e)

    def list_models(self) -> List[str]:
        try:
            models = self.client.models.list()
            return [model.id for model in models.data]
        except Exception as e:
            print(f"[{self.provider_name}] Failed to list models: {e}")
            return []

    def health_check(self) -> dict:
        try:
            self.client.models.list()
            return {
                "healthy": True,
                "provider": self.provider_name,
                "base_url": self.base_url,
                "default_model": self.default_model,
                "error": None
            }
        except Exception as e:
            return {
                "healthy": False,
                "provider": self.provider_name,
                "base_url": self.base_url,
                "default_model": self.default_model,
                "error": str(e)
            }


class InferenceService:
    """
    Unified inference service for decentralized AI providers.

    SECRET AI IS THE DEFAULT (AND ONLY) PROVIDER for PrivexBot.

    This design ensures:
    - Privacy-preserving inference via Secret AI TEE when deployed
    - Automatic provider detection based on model name prefix
    - Explicit provider selection when needed

    Usage:
        # Use default (Secret AI)
        response = await inference_service.generate_chat(
            messages=[{"role": "user", "content": "Hello"}]
        )

        # With explicit model
        response = await inference_service.generate_chat(
            messages=[...],
            model="DeepSeek-R1-Distill-Llama-70B"
        )
    """

    def __init__(
        self,
        default_provider: Optional[InferenceProvider] = None,
        default_model: Optional[str] = None,
        enable_fallback: bool = True
    ):
        """
        Initialize inference service.

        Args:
            default_provider: Default provider (defaults to SECRET_AI)
            default_model: Default model when not specified
            enable_fallback: Enable automatic fallback to other providers on failure
        """
        # SECRET AI is ALWAYS the default for PrivexBot
        # This ensures privacy-preserving inference in production
        self.default_provider = default_provider or InferenceProvider.SECRET_AI
        self.default_model = default_model or self._get_default_model(self.default_provider)
        self.enable_fallback = enable_fallback
        self._providers: Dict[InferenceProvider, BaseProvider] = {}

        # Environment detection
        self.environment = os.getenv("ENVIRONMENT", "development")
        self.is_production = self.environment == "production"
        self.is_secretvm = os.getenv("SECRETVM", "false").lower() == "true"

        print(f"[InferenceService] Initialized")
        print(f"[InferenceService] Default provider: {self.default_provider.value}")
        print(f"[InferenceService] Default model: {self.default_model}")
        print(f"[InferenceService] Environment: {self.environment}")
        print(f"[InferenceService] Fallback enabled: {self.enable_fallback}")

    def _get_default_model(self, provider: InferenceProvider) -> str:
        """Get default model for a provider."""
        config = PROVIDER_CONFIGS.get(provider, {})
        return config.get("default_model", "DeepSeek-R1-Distill-Llama-70B")

    def _detect_provider_from_model(self, model: str) -> Optional[InferenceProvider]:
        """Detect provider from model name prefix."""
        model_lower = model.lower()

        for provider, config in PROVIDER_CONFIGS.items():
            for prefix in config.get("model_prefixes", []):
                if model_lower.startswith(prefix.lower()):
                    return provider

        return None

    def _is_provider_available(self, provider: InferenceProvider) -> bool:
        """Check if a provider has credentials configured."""
        config = PROVIDER_CONFIGS.get(provider, {})
        api_key_env = config.get("api_key_env")

        if api_key_env is None:
            # No API key needed (e.g., Ollama)
            return True

        api_key = os.getenv(api_key_env, "")
        return bool(api_key and api_key.strip())

    def _get_available_fallbacks(self) -> List[InferenceProvider]:
        """Get list of available fallback providers in order of preference."""
        available = []
        for provider in FALLBACK_ORDER:
            if self._is_provider_available(provider):
                available.append(provider)
        return available

    def _get_provider(self, provider: InferenceProvider) -> BaseProvider:
        """Get or create a provider instance."""
        if provider in self._providers:
            return self._providers[provider]

        # Create OpenAI-compatible provider
        config = PROVIDER_CONFIGS.get(provider, {})
        api_key_env = config.get("api_key_env")
        api_key = os.getenv(api_key_env, "") if api_key_env else "placeholder"
        base_url = config.get("base_url", "http://localhost:11434/v1")
        timeout = config.get("timeout", 60.0)

        instance = OpenAICompatibleProvider(
            base_url=base_url,
            api_key=api_key,
            default_model=config.get("default_model", "DeepSeek-R1-Distill-Llama-70B"),
            provider_name=provider.value,
            timeout=timeout
        )

        self._providers[provider] = instance
        return instance

    def _resolve_provider_and_model(
        self,
        model: Optional[str],
        provider: Optional[InferenceProvider]
    ) -> tuple:
        """Resolve which provider and model to use."""
        # If model specified, try to detect provider from it
        if model:
            detected = self._detect_provider_from_model(model)
            if detected:
                return detected, model

        # Use explicit provider or default
        use_provider = provider or self.default_provider
        use_model = model or self._get_default_model(use_provider)

        return use_provider, use_model

    async def _try_with_fallback(
        self,
        operation: str,
        primary_provider: InferenceProvider,
        primary_model: str,
        generate_fn,
        **kwargs
    ) -> InferenceResponse:
        """
        Try operation with primary provider, fallback on network errors.

        Args:
            operation: Description of operation for logging
            primary_provider: Primary provider to try
            primary_model: Model to use
            generate_fn: Async function that takes provider instance and returns response
            **kwargs: Additional kwargs for generate_fn
        """
        errors = []

        # Try primary provider first
        try:
            provider_instance = self._get_provider(primary_provider)
            return await generate_fn(provider_instance, primary_model, **kwargs)
        except NetworkError as e:
            errors.append(f"{primary_provider.value}: {str(e)[:100]}")
            print(f"[InferenceService] {primary_provider.value} network error: {e}")

            if not self.enable_fallback:
                raise NetworkError(
                    f"Failed to connect to {primary_provider.value}. "
                    f"Fallback is disabled. Enable with INFERENCE_FALLBACK_ENABLED=true. "
                    f"Error: {e}"
                )
        except (AuthError, ProviderUnavailableError) as e:
            errors.append(f"{primary_provider.value}: {str(e)[:100]}")
            print(f"[InferenceService] {primary_provider.value} auth/availability error: {e}")

            if not self.enable_fallback:
                raise
        except RateLimitError:
            # Don't fallback for rate limits - just propagate
            raise
        except InferenceError as e:
            # Check if it's a network-like error
            if "connect" in str(e).lower() or "network" in str(e).lower():
                errors.append(f"{primary_provider.value}: {str(e)[:100]}")
                print(f"[InferenceService] {primary_provider.value} connection error: {e}")
                if not self.enable_fallback:
                    raise
            else:
                raise

        # Try fallback providers
        fallbacks = self._get_available_fallbacks()
        for fallback_provider in fallbacks:
            if fallback_provider == primary_provider:
                continue

            try:
                print(f"[InferenceService] Trying fallback: {fallback_provider.value}")
                fallback_model = self._get_default_model(fallback_provider)
                provider_instance = self._get_provider(fallback_provider)
                response = await generate_fn(provider_instance, fallback_model, **kwargs)
                print(f"[InferenceService] Fallback {fallback_provider.value} succeeded")
                return response
            except (NetworkError, AuthError, ProviderUnavailableError) as e:
                errors.append(f"{fallback_provider.value}: {str(e)[:100]}")
                print(f"[InferenceService] Fallback {fallback_provider.value} failed: {e}")
                continue
            except RateLimitError:
                errors.append(f"{fallback_provider.value}: rate limited")
                print(f"[InferenceService] Fallback {fallback_provider.value} rate limited")
                continue
            except Exception as e:
                errors.append(f"{fallback_provider.value}: {str(e)[:100]}")
                print(f"[InferenceService] Fallback {fallback_provider.value} error: {e}")
                continue

        # All providers failed
        raise InferenceError(
            f"All inference providers failed. Errors: {'; '.join(errors)}. "
            f"Please check your network configuration and API keys."
        )

    # =========================================================================
    # PUBLIC INTERFACE - Structured Messages (Recommended)
    # =========================================================================

    async def generate_chat(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        stop: Optional[List[str]] = None,
        provider: Optional[InferenceProvider] = None,
        **kwargs
    ) -> dict:
        """
        Generate chat completion from structured messages (async).

        This is the RECOMMENDED method for chatbots and chatflows.

        Args:
            messages: List of message dicts with 'role' and 'content'
                [
                    {"role": "system", "content": "You are a helpful assistant."},
                    {"role": "user", "content": "Hello"},
                    {"role": "assistant", "content": "Hi there!"},
                    {"role": "user", "content": "How are you?"}
                ]
            model: Model name (auto-detects provider if prefixed)
            temperature: Optional temperature (0.0-2.0)
            max_tokens: Optional max response tokens
            stop: Optional stop sequences
            provider: Explicit provider override

        Returns:
            {
                "text": "AI response",
                "usage": {"prompt_tokens": 10, "completion_tokens": 20, "total_tokens": 30},
                "model": "DeepSeek-R1-Distill-Llama-70B",
                "provider": "secret_ai"
            }
        """
        # Check if native Secret AI SDK should be used
        if settings.USE_SECRET_AI_SDK:
            print("[InferenceService] Using native secret-ai-sdk")
            from app.services.secret_ai_sdk_provider import get_secret_ai_sdk_provider
            sdk_provider = get_secret_ai_sdk_provider(
                temperature=temperature or 0.7
            )
            return await sdk_provider.generate_chat(
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens
            )

        # Use OpenAI-compatible provider (default)
        use_provider, use_model = self._resolve_provider_and_model(model, provider)

        async def _generate(provider_instance: BaseProvider, model_to_use: str, **kw) -> InferenceResponse:
            return await provider_instance.generate_chat(
                messages=messages,
                model=model_to_use,
                temperature=temperature,
                max_tokens=max_tokens,
                stop=stop,
                **kwargs
            )

        response = await self._try_with_fallback(
            operation="generate_chat",
            primary_provider=use_provider,
            primary_model=use_model,
            generate_fn=_generate
        )

        return response.to_dict()

    def generate_chat_sync(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        stop: Optional[List[str]] = None,
        provider: Optional[InferenceProvider] = None,
        **kwargs
    ) -> dict:
        """Generate chat completion (sync version)."""
        use_provider, use_model = self._resolve_provider_and_model(model, provider)
        provider_instance = self._get_provider(use_provider)

        response = provider_instance.generate_chat_sync(
            messages=messages,
            model=use_model,
            temperature=temperature,
            max_tokens=max_tokens,
            stop=stop,
            **kwargs
        )

        return response.to_dict()

    async def generate_chat_stream(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        provider: Optional[InferenceProvider] = None,
        **kwargs
    ) -> AsyncIterator[str]:
        """Generate streaming chat completion."""
        use_provider, use_model = self._resolve_provider_and_model(model, provider)
        provider_instance = self._get_provider(use_provider)

        async for chunk in provider_instance.generate_chat_stream(
            messages=messages,
            model=use_model,
            temperature=temperature,
            max_tokens=max_tokens,
            **kwargs
        ):
            yield chunk

    # =========================================================================
    # BACKWARD COMPATIBLE INTERFACE - Single Prompt
    # =========================================================================

    async def generate(
        self,
        prompt: str,
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 2000,
        stop: Optional[List[str]] = None,
        provider: Optional[InferenceProvider] = None
    ) -> dict:
        """
        Generate from single prompt (backward compatible).

        DEPRECATED: Use generate_chat() with structured messages instead.

        Converts prompt to: [{"role": "user", "content": prompt}]
        """
        messages = [{"role": "user", "content": prompt}]
        return await self.generate_chat(
            messages=messages,
            model=model,
            temperature=temperature,
            max_tokens=max_tokens,
            stop=stop,
            provider=provider
        )

    def generate_sync(
        self,
        prompt: str,
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 2000,
        stop: Optional[List[str]] = None,
        provider: Optional[InferenceProvider] = None
    ) -> dict:
        """Generate from single prompt (sync, backward compatible)."""
        messages = [{"role": "user", "content": prompt}]
        return self.generate_chat_sync(
            messages=messages,
            model=model,
            temperature=temperature,
            max_tokens=max_tokens,
            stop=stop,
            provider=provider
        )

    async def generate_stream(
        self,
        prompt: str,
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 2000,
        provider: Optional[InferenceProvider] = None
    ) -> AsyncIterator[str]:
        """Generate streaming from single prompt (backward compatible)."""
        messages = [{"role": "user", "content": prompt}]
        async for chunk in self.generate_chat_stream(
            messages=messages,
            model=model,
            temperature=temperature,
            max_tokens=max_tokens,
            provider=provider
        ):
            yield chunk

    # =========================================================================
    # UTILITY METHODS
    # =========================================================================

    def list_models(self, provider: Optional[InferenceProvider] = None) -> List[str]:
        """List available models for a provider."""
        use_provider = provider or self.default_provider
        provider_instance = self._get_provider(use_provider)
        return provider_instance.list_models()

    def health_check(self, provider: Optional[InferenceProvider] = None) -> dict:
        """Check provider health."""
        use_provider = provider or self.default_provider
        provider_instance = self._get_provider(use_provider)
        return provider_instance.health_check()

    def get_available_providers(self) -> List[dict]:
        """List all providers with their availability status."""
        results = []
        for provider in InferenceProvider:
            if provider == InferenceProvider.CUSTOM:
                continue

            config = PROVIDER_CONFIGS.get(provider, {})
            api_key_env = config.get("api_key_env")

            available = False
            if api_key_env:
                available = bool(os.getenv(api_key_env))

            results.append({
                "provider": provider.value,
                "available": available,
                "default_model": config.get("default_model"),
                "requires_api_key": api_key_env is not None,
                "description": config.get("description", ""),
                "is_default": provider == self.default_provider
            })

        return results


# Factory function for creating custom configured services
def create_inference_service(
    provider: Optional[InferenceProvider] = None,
    model: Optional[str] = None,
    enable_fallback: bool = True
) -> InferenceService:
    """
    Factory to create inference service with custom configuration.

    Examples:
        # Auto-detect (uses Secret AI by default)
        service = create_inference_service()

        # Specific provider
        service = create_inference_service(provider=InferenceProvider.SECRET_AI)

        # With fallback disabled
        service = create_inference_service(enable_fallback=False)
    """
    return InferenceService(
        default_provider=provider,
        default_model=model,
        enable_fallback=enable_fallback
    )


# Global instance (Secret AI as default, fallback enabled)
inference_service = InferenceService()
