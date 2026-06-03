"""
Inference Service - Confidential TEE inference via Secret AI.

ARCHITECTURAL CONSTRAINT (do not relax):
Secret AI is the ONLY supported inference provider for PrivexBot. TEE-protected
confidential inference is the headline differentiator and must not be
circumvented by silent fallbacks to other providers (OpenAI, Akash, Gemini,
etc.). The architecture supports two TRANSPORTS to the same Secret AI TEE
nodes — that is the only "fallback" allowed:

    1. Native SDK transport (gRPC + LangChain via secret_ai_sdk package)
    2. REST transport (HTTPS to Secret AI's OpenAI-compatible API endpoint)

Both terminate at `https://secretai-api-url.scrtlabs.com:443/v1` (TEE-protected).
The `openai` Python package is used as a generic HTTP client for the REST
transport — `base_url` always points to Secret AI; never to OpenAI.

HOW:
- Abstract provider interface with one concrete implementation
- Native SDK is preferred when available; REST is the recovery path if the
  SDK fails to import or initialize. Both stay inside Secret AI infrastructure.

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
- In production (SecretVM), Secret AI should work without network issues.
- If the prod build is missing the `secret-ai-sdk` wheel, the SDK transport
  will surface the underlying ImportError with full context (see
  `secret_ai_sdk_provider.py:_ensure_client`). The REST transport fallback
  in `generate_chat` keeps chat working until the SDK is reinstalled.
"""

import json
import logging
import os
import re
import asyncio
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import AsyncIterator, Optional, List, Dict, Any, Union

import redis

logger = logging.getLogger(__name__)

# One-shot flag so the SDK→REST fallback warning is logged at most once per
# process. Repeating it on every chat would spam logs without adding signal.
_sdk_fallback_logged = False

# Redis cache for the live Secret AI model list. The SDK call is synchronous
# and walks a smart-contract query path; one hour is the right cadence —
# models on Secret Network rotate rarely, and frontend `<ModelSelector>` is
# rendered many times across builder / edit / create surfaces.
MODELS_CACHE_KEY = "inference:secret_ai:models"
MODELS_CACHE_TTL = 60 * 60  # 1 hour

# Final fallback model name used ONLY when:
# (a) The user did not specify a model in their chatbot / chatflow config, AND
# (b) `Secret().get_models()` is unreachable (SDK import failure or network).
# Otherwise the SDK's first available model is used. This constant exists so
# that REST-transport requests (when the SDK is unavailable) still have *some*
# string to send; the underlying Secret AI REST endpoint will reject it if
# the model isn't currently served, which is the right failure mode.
LAST_RESORT_MODEL = "DeepSeek-R1-Distill-Llama-70B"

# Chat-family allow-list and the SDK ping helper live in
# `app/core/secret_ai_models` so both this service and
# `secret_ai_sdk_provider.py` can share them without a circular import
# (this service lazy-imports the SDK provider; reversing that direction
# at module top-level deadlocks Python's import machinery).
from app.core.secret_ai_models import (
    CHAT_MODEL_FAMILY_PATTERN,  # noqa: F401 — re-exported for back-compat
    is_chat_capable as _is_chat_capable,
)


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
    """The single supported inference provider — Secret AI (TEE-protected)."""
    SECRET_AI = "secret_ai"


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
        "default_model": LAST_RESORT_MODEL,
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


class SecretAIRestProvider(BaseProvider):
    """
    REST transport for Secret AI's TEE-protected API endpoint.

    Secret AI exposes an OpenAI-compatible HTTP protocol at
    `https://secretai-api-url.scrtlabs.com:443/v1`. We use the `openai`
    Python package purely as a generic HTTP client for that protocol —
    `base_url` is set from PROVIDER_CONFIGS, never to OpenAI's servers,
    and no other providers are wired up. All inference stays inside Secret
    AI's TEE.
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
        return config.get("default_model", LAST_RESORT_MODEL)

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

        # Create the Secret AI REST transport instance. `base_url` resolves
        # from PROVIDER_CONFIGS (Secret AI only); the localhost default is
        # legacy and never reached because PROVIDER_CONFIGS always supplies
        # the Secret AI URL via SECRET_AI_BASE_URL.
        config = PROVIDER_CONFIGS.get(provider, {})
        api_key_env = config.get("api_key_env")
        api_key = os.getenv(api_key_env, "") if api_key_env else "placeholder"
        base_url = config.get("base_url")
        timeout = config.get("timeout", 60.0)

        instance = SecretAIRestProvider(
            base_url=base_url,
            api_key=api_key,
            default_model=config.get("default_model", LAST_RESORT_MODEL),
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
        # Try the native Secret AI SDK transport first (gRPC + LangChain),
        # falling back to the Secret AI REST transport if the SDK is missing
        # or fails to initialize.
        #
        # CRITICAL: BOTH transports terminate at Secret AI's TEE-protected
        # nodes (https://secretai-api-url.scrtlabs.com:443/v1). This is NOT
        # a cross-provider fallback — no data ever leaves Secret AI
        # infrastructure. See module docstring + memory/feedback_secret_ai_only.
        if settings.USE_SECRET_AI_SDK:
            try:
                from app.services.secret_ai_sdk_provider import get_secret_ai_sdk_provider
                sdk_provider = get_secret_ai_sdk_provider(
                    temperature=temperature or 0.7
                )
                return await sdk_provider.generate_chat(
                    messages=messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    model=model,
                )
            except ImportError as exc:
                global _sdk_fallback_logged
                if not _sdk_fallback_logged:
                    logger.warning(
                        "Secret AI native SDK transport unavailable (ImportError: %s). "
                        "Switching to Secret AI REST transport — still TEE-protected, "
                        "still inside Secret AI infrastructure. Reinstall the wheel "
                        "to restore the native transport: rebuild the image (the "
                        "Dockerfile now verifies the import at build time).",
                        exc,
                    )
                    _sdk_fallback_logged = True
            except Exception as exc:
                # gRPC handshake / SSL / no-models / Secret() init failure.
                # The REST transport tolerates many of these because it uses
                # plain HTTPS to a fixed endpoint. Log full traceback once so
                # operators can triage; then fall through.
                if not _sdk_fallback_logged:
                    logger.exception(
                        "Secret AI native SDK transport init failed: %s. "
                        "Switching to Secret AI REST transport — still TEE-protected, "
                        "still inside Secret AI infrastructure.",
                        exc,
                    )
                    _sdk_fallback_logged = True

        # REST transport — Secret AI's OpenAI-compatible HTTPS endpoint.
        # Also the path used when USE_SECRET_AI_SDK=false (operator-set env).
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

    async def list_available_models(self) -> Dict[str, Any]:
        """
        Return the live list of Secret AI models for the frontend `<ModelSelector>`.

        Surface (dict, not Pydantic — kept loose so the route layer owns the
        response schema):
            {"models": [...], "cached": bool, "as_of": datetime}

        Fallback ladder:
        1. Redis cache (`MODELS_CACHE_KEY`, 1-hour TTL).
        2. Live SDK call via `SecretAISDKProvider.list_models()` (already
           retry-wrapped at the SDK layer).
        3. If both fail, return whatever stale value is in Redis (even past
           TTL is better than nothing). The route layer will surface an
           empty list to the frontend rather than a 500.

        Logs every cache hit/miss/error so operators can triage model
        rotation issues without re-deploying.
        """
        now = datetime.now(timezone.utc)

        # Step 1: try Redis (warm path)
        client = self._get_redis_client()
        if client is not None:
            try:
                cached = client.get(MODELS_CACHE_KEY)
            except Exception as exc:
                logger.warning(
                    "[InferenceService] Redis GET failed for models cache: %s", exc
                )
                cached = None

            if cached:
                try:
                    payload = json.loads(cached)
                    logger.info(
                        "[InferenceService] models cache HIT (n=%d, as_of=%s)",
                        len(payload.get("models", [])),
                        payload.get("as_of"),
                    )
                    return {
                        "models": payload.get("models", []),
                        "cached": True,
                        "as_of": datetime.fromisoformat(payload["as_of"]),
                    }
                except (json.JSONDecodeError, KeyError, ValueError) as exc:
                    logger.warning(
                        "[InferenceService] models cache payload malformed (%s) — refreshing",
                        exc,
                    )

        # Step 2: cold path — call the SDK
        try:
            from app.services.secret_ai_sdk_provider import get_secret_ai_sdk_provider

            sdk_provider = get_secret_ai_sdk_provider()
            # Synchronous call inside the async function. We don't push this
            # onto run_in_executor because the SDK's underlying LCDClient
            # calls `nest_asyncio.apply(get_event_loop())` during
            # `Secret().__init__`, and worker threads have no event loop —
            # which raises `RuntimeError: There is no current event loop`
            # before the contract query ever fires. The running loop in this
            # async context satisfies the SDK; the ~200–500ms cost is paid
            # once per Redis cache miss (1h TTL).
            raw_models = sdk_provider.list_models()
            if not isinstance(raw_models, list):
                raw_models = []
            # Filter to known chat-base families. The smart contract
            # advertises every Secret AI worker, including STT/TTS workers
            # that don't speak the chat protocol — picking one would break
            # the user's chat at inference time. See CHAT_MODEL_FAMILY_PATTERN.
            models = [m for m in raw_models if _is_chat_capable(m)]
            logger.info(
                "[InferenceService] models cache MISS — fetched %d from SDK, "
                "%d after chat-family filter",
                len(raw_models),
                len(models),
            )
        except Exception as exc:
            logger.error(
                "[InferenceService] SDK list_models failed: %s — returning empty list",
                exc,
            )
            # Step 3 (deep fallback): return stale cached value if available
            if client is not None:
                try:
                    stale = client.get(MODELS_CACHE_KEY)
                    if stale:
                        payload = json.loads(stale)
                        return {
                            "models": payload.get("models", []),
                            "cached": True,
                            "as_of": datetime.fromisoformat(payload["as_of"]),
                        }
                except Exception:
                    pass
            return {"models": [], "cached": False, "as_of": now}

        # Write through to Redis for the next caller
        if client is not None:
            try:
                client.setex(
                    MODELS_CACHE_KEY,
                    MODELS_CACHE_TTL,
                    json.dumps({"models": models, "as_of": now.isoformat()}),
                )
            except Exception as exc:
                logger.warning(
                    "[InferenceService] Redis SETEX failed for models cache: %s", exc
                )

        return {"models": models, "cached": False, "as_of": now}

    def _get_redis_client(self):
        """Lazy Redis client for the models cache.

        Cached on the service instance after first successful build. Returns
        None when Redis is unconfigured / unreachable — callers must handle
        the None case (we don't crash inference for a cache miss).
        """
        cached = getattr(self, "_redis", None)
        if cached is not None:
            return cached
        try:
            cached = redis.from_url(settings.REDIS_URL, decode_responses=True)
            # Cheap connectivity check; avoids surfacing a confusing error
            # on the actual GET/SETEX call later.
            cached.ping()
            self._redis = cached
            return cached
        except Exception as exc:
            logger.warning(
                "[InferenceService] Redis unavailable for models cache: %s. "
                "Falling back to direct SDK calls per request.",
                exc,
            )
            self._redis = None
            return None

    def health_check(self, provider: Optional[InferenceProvider] = None) -> dict:
        """Check provider health."""
        use_provider = provider or self.default_provider
        provider_instance = self._get_provider(use_provider)
        return provider_instance.health_check()

    def get_available_providers(self) -> List[dict]:
        """List all providers with their availability status."""
        results = []
        for provider in InferenceProvider:
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
