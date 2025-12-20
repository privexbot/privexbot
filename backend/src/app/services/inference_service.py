"""
Inference Service - Flexible LLM inference with multiple provider support.

WHY:
- Centralized AI API calls (Secret AI, Ollama, OpenAI, Gemini, DeepSeek, etc.)
- Used by both chatbots and chatflows
- Backend-only (never expose API keys to frontend)
- Error handling and retry logic
- Provider abstraction for flexibility

HOW:
- Abstract provider interface with concrete implementations
- OpenAI-compatible provider for most services
- Gemini provider using Google's genai SDK
- Automatic provider detection based on model prefix or config
- Structured message format internally, converted per-provider

SUPPORTED PROVIDERS:
- Secret AI (OpenAI-compatible endpoint)
- Ollama (local inference)
- OpenAI
- DeepSeek
- Gemini (Google AI)
- Any OpenAI-compatible API

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
"""

import os
from abc import ABC, abstractmethod
from typing import AsyncIterator, Optional, List, Dict, Any, Union
from enum import Enum
from dataclasses import dataclass

from app.core.config import settings


class InferenceProvider(str, Enum):
    """Supported inference providers."""
    SECRET_AI = "secret_ai"
    OLLAMA = "ollama"
    OPENAI = "openai"
    DEEPSEEK = "deepseek"
    GEMINI = "gemini"
    CUSTOM = "custom"


class InferenceError(Exception):
    """Base exception for inference errors."""
    pass


class RateLimitError(InferenceError):
    """Rate limit exceeded."""
    pass


class AuthError(InferenceError):
    """Authentication failed."""
    pass


class ConnectionError(InferenceError):
    """Connection to provider failed."""
    pass


class ModelNotFoundError(InferenceError):
    """Requested model not available."""
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


# Provider configurations
PROVIDER_CONFIGS = {
    InferenceProvider.SECRET_AI: {
        "base_url": os.getenv("SECRET_AI_BASE_URL", "https://api.secret.ai/v1"),
        "api_key_env": "SECRET_AI_API_KEY",
        "default_model": "llama3.1",
        "model_prefixes": [],  # No specific prefix, uses base_url
    },
    InferenceProvider.OLLAMA: {
        "base_url": os.getenv("OLLAMA_BASE_URL", "http://localhost:11434/v1"),
        "api_key_env": None,
        "default_model": "llama3.2",
        "model_prefixes": ["ollama/"],
    },
    InferenceProvider.OPENAI: {
        "base_url": "https://api.openai.com/v1",
        "api_key_env": "OPENAI_API_KEY",
        "default_model": "gpt-4o-mini",
        "model_prefixes": ["gpt-", "o1-", "o3-"],
    },
    InferenceProvider.DEEPSEEK: {
        "base_url": "https://api.deepseek.com/v1",
        "api_key_env": "DEEPSEEK_API_KEY",
        "default_model": "deepseek-chat",
        "model_prefixes": ["deepseek-"],
    },
    InferenceProvider.GEMINI: {
        "api_key_env": "GEMINI_API_KEY",
        "default_model": "gemini-2.0-flash",
        "model_prefixes": ["gemini-"],
    },
}


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
        provider_name: str = "openai_compatible"
    ):
        from openai import OpenAI, AsyncOpenAI

        self.base_url = base_url
        self.api_key = api_key
        self.default_model = default_model
        self.provider_name = provider_name

        self.client = OpenAI(
            base_url=base_url,
            api_key=api_key or "placeholder",  # Some providers don't need key
            timeout=60.0
        )

        self.async_client = AsyncOpenAI(
            base_url=base_url,
            api_key=api_key or "placeholder",
            timeout=60.0
        )

    def _handle_error(self, e: Exception) -> None:
        """Convert OpenAI errors to our error types."""
        from openai import (
            APIError, APIConnectionError,
            RateLimitError as OpenAIRateLimitError,
            AuthenticationError
        )

        if isinstance(e, OpenAIRateLimitError):
            raise RateLimitError(f"Rate limit exceeded: {e}")
        elif isinstance(e, AuthenticationError):
            raise AuthError(f"Authentication failed: {e}")
        elif isinstance(e, APIConnectionError):
            raise ConnectionError(f"Failed to connect: {e}")
        elif isinstance(e, APIError):
            raise InferenceError(f"API error: {e}")
        else:
            raise InferenceError(f"Unexpected error: {e}")

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
                text=response.choices[0].message.content or "",
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
                text=response.choices[0].message.content or "",
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
            print(f"[OpenAICompatibleProvider] Failed to list models: {e}")
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


class GeminiProvider(BaseProvider):
    """
    Provider for Google Gemini API.

    Uses the google-genai SDK with proper message conversion.
    Gemini uses "model" role instead of "assistant" and requires
    system_instruction in config rather than in messages.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        default_model: str = "gemini-2.0-flash"
    ):
        self.api_key = api_key or os.getenv("GEMINI_API_KEY", "")
        self.default_model = default_model
        self._client = None
        self._initialized = False

    def _ensure_initialized(self):
        """Lazy initialization of Gemini client."""
        if self._initialized:
            return

        try:
            from google import genai
            self._genai = genai
            self._client = genai.Client(api_key=self.api_key)
            self._initialized = True
        except ImportError:
            raise InferenceError(
                "google-genai package not installed. "
                "Install with: pip install google-genai"
            )
        except Exception as e:
            raise AuthError(f"Failed to initialize Gemini client: {e}")

    def _convert_messages_to_gemini(
        self,
        messages: List[Dict[str, str]]
    ) -> tuple:
        """
        Convert OpenAI-style messages to Gemini format.

        Returns:
            (system_instruction, contents)

        OpenAI format:
            [
                {"role": "system", "content": "You are..."},
                {"role": "user", "content": "Hello"},
                {"role": "assistant", "content": "Hi!"},
            ]

        Gemini format:
            system_instruction = "You are..."
            contents = [
                Content(role="user", parts=[Part(text="Hello")]),
                Content(role="model", parts=[Part(text="Hi!")]),
            ]
        """
        from google.genai import types

        system_instruction = None
        contents = []

        for msg in messages:
            role = msg.get("role", "user")
            content = msg.get("content", "")

            if role == "system":
                # Gemini uses system_instruction in config, not in contents
                system_instruction = content
            elif role == "user":
                contents.append(
                    types.Content(
                        role="user",
                        parts=[types.Part(text=content)]
                    )
                )
            elif role == "assistant":
                # Gemini uses "model" instead of "assistant"
                contents.append(
                    types.Content(
                        role="model",
                        parts=[types.Part(text=content)]
                    )
                )

        # If no contents, add a placeholder (shouldn't happen)
        if not contents:
            contents.append(
                types.Content(
                    role="user",
                    parts=[types.Part(text="Hello")]
                )
            )

        return system_instruction, contents

    async def generate_chat(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        stop: Optional[List[str]] = None,
        **kwargs
    ) -> InferenceResponse:
        self._ensure_initialized()
        from google.genai import types

        try:
            system_instruction, contents = self._convert_messages_to_gemini(messages)

            # Build config with optional parameters
            config_params = {}
            if system_instruction:
                config_params["system_instruction"] = system_instruction
            if temperature is not None:
                config_params["temperature"] = temperature
            if max_tokens is not None:
                config_params["max_output_tokens"] = max_tokens
            if stop:
                config_params["stop_sequences"] = stop

            config = types.GenerateContentConfig(**config_params) if config_params else None

            # Generate response
            use_model = model or self.default_model
            response = await self._client.aio.models.generate_content(
                model=use_model,
                contents=contents,
                config=config
            )

            # Extract text
            text = response.text if hasattr(response, 'text') else ""

            # Extract usage (Gemini provides this differently)
            usage = {
                "prompt_tokens": getattr(response.usage_metadata, 'prompt_token_count', 0) if hasattr(response, 'usage_metadata') else 0,
                "completion_tokens": getattr(response.usage_metadata, 'candidates_token_count', 0) if hasattr(response, 'usage_metadata') else 0,
                "total_tokens": getattr(response.usage_metadata, 'total_token_count', 0) if hasattr(response, 'usage_metadata') else 0,
            }

            return InferenceResponse(
                text=text,
                usage=usage,
                model=use_model,
                provider="gemini",
                raw_response=response
            )

        except Exception as e:
            if "quota" in str(e).lower() or "rate" in str(e).lower():
                raise RateLimitError(f"Gemini rate limit: {e}")
            elif "api key" in str(e).lower() or "auth" in str(e).lower():
                raise AuthError(f"Gemini auth error: {e}")
            else:
                raise InferenceError(f"Gemini error: {e}")

    def generate_chat_sync(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        stop: Optional[List[str]] = None,
        **kwargs
    ) -> InferenceResponse:
        self._ensure_initialized()
        from google.genai import types

        try:
            system_instruction, contents = self._convert_messages_to_gemini(messages)

            config_params = {}
            if system_instruction:
                config_params["system_instruction"] = system_instruction
            if temperature is not None:
                config_params["temperature"] = temperature
            if max_tokens is not None:
                config_params["max_output_tokens"] = max_tokens
            if stop:
                config_params["stop_sequences"] = stop

            config = types.GenerateContentConfig(**config_params) if config_params else None

            use_model = model or self.default_model
            response = self._client.models.generate_content(
                model=use_model,
                contents=contents,
                config=config
            )

            text = response.text if hasattr(response, 'text') else ""
            usage = {
                "prompt_tokens": getattr(response.usage_metadata, 'prompt_token_count', 0) if hasattr(response, 'usage_metadata') else 0,
                "completion_tokens": getattr(response.usage_metadata, 'candidates_token_count', 0) if hasattr(response, 'usage_metadata') else 0,
                "total_tokens": getattr(response.usage_metadata, 'total_token_count', 0) if hasattr(response, 'usage_metadata') else 0,
            }

            return InferenceResponse(
                text=text,
                usage=usage,
                model=use_model,
                provider="gemini",
                raw_response=response
            )

        except Exception as e:
            if "quota" in str(e).lower() or "rate" in str(e).lower():
                raise RateLimitError(f"Gemini rate limit: {e}")
            elif "api key" in str(e).lower() or "auth" in str(e).lower():
                raise AuthError(f"Gemini auth error: {e}")
            else:
                raise InferenceError(f"Gemini error: {e}")

    async def generate_chat_stream(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        **kwargs
    ) -> AsyncIterator[str]:
        self._ensure_initialized()
        from google.genai import types

        try:
            system_instruction, contents = self._convert_messages_to_gemini(messages)

            config_params = {}
            if system_instruction:
                config_params["system_instruction"] = system_instruction
            if temperature is not None:
                config_params["temperature"] = temperature
            if max_tokens is not None:
                config_params["max_output_tokens"] = max_tokens

            config = types.GenerateContentConfig(**config_params) if config_params else None

            use_model = model or self.default_model

            # Gemini streaming
            async for chunk in await self._client.aio.models.generate_content_stream(
                model=use_model,
                contents=contents,
                config=config
            ):
                if hasattr(chunk, 'text') and chunk.text:
                    yield chunk.text

        except Exception as e:
            raise InferenceError(f"Gemini streaming error: {e}")

    def list_models(self) -> List[str]:
        self._ensure_initialized()
        try:
            models = self._client.models.list()
            return [m.name for m in models if hasattr(m, 'name')]
        except Exception as e:
            print(f"[GeminiProvider] Failed to list models: {e}")
            return []

    def health_check(self) -> dict:
        try:
            self._ensure_initialized()
            # Try listing models as health check
            self._client.models.list()
            return {
                "healthy": True,
                "provider": "gemini",
                "default_model": self.default_model,
                "error": None
            }
        except Exception as e:
            return {
                "healthy": False,
                "provider": "gemini",
                "default_model": self.default_model,
                "error": str(e)
            }


class InferenceService:
    """
    Unified inference service that routes to appropriate providers.

    Supports:
    - Automatic provider detection based on model name prefix
    - Explicit provider selection
    - Fallback chain for resilience
    - Structured message format

    Usage:
        # Auto-detect provider from model
        response = await inference_service.generate_chat(
            messages=[{"role": "user", "content": "Hello"}],
            model="gemini-2.0-flash"  # Routes to Gemini
        )

        # Or with explicit provider
        response = await inference_service.generate_chat(
            messages=[...],
            model="custom-model",
            provider=InferenceProvider.OLLAMA
        )
    """

    def __init__(
        self,
        default_provider: Optional[InferenceProvider] = None,
        default_model: Optional[str] = None
    ):
        """
        Initialize inference service.

        Args:
            default_provider: Default provider when model doesn't indicate one
            default_model: Default model when not specified
        """
        self.default_provider = default_provider or self._detect_default_provider()
        self.default_model = default_model or self._get_default_model(self.default_provider)
        self._providers: Dict[InferenceProvider, BaseProvider] = {}

        print(f"[InferenceService] Initialized with default provider: {self.default_provider.value}")

    def _detect_default_provider(self) -> InferenceProvider:
        """Detect default provider based on available credentials."""
        # Priority order
        if os.getenv("SECRET_AI_API_KEY"):
            return InferenceProvider.SECRET_AI
        if os.getenv("GEMINI_API_KEY"):
            return InferenceProvider.GEMINI
        if os.getenv("OPENAI_API_KEY"):
            return InferenceProvider.OPENAI
        if os.getenv("DEEPSEEK_API_KEY"):
            return InferenceProvider.DEEPSEEK
        # Default to Ollama (local, no key needed)
        return InferenceProvider.OLLAMA

    def _get_default_model(self, provider: InferenceProvider) -> str:
        """Get default model for a provider."""
        config = PROVIDER_CONFIGS.get(provider, {})
        return config.get("default_model", "llama3.1")

    def _detect_provider_from_model(self, model: str) -> Optional[InferenceProvider]:
        """Detect provider from model name prefix."""
        model_lower = model.lower()

        for provider, config in PROVIDER_CONFIGS.items():
            for prefix in config.get("model_prefixes", []):
                if model_lower.startswith(prefix.lower()):
                    return provider

        return None

    def _get_provider(self, provider: InferenceProvider) -> BaseProvider:
        """Get or create a provider instance."""
        if provider in self._providers:
            return self._providers[provider]

        # Create provider based on type
        config = PROVIDER_CONFIGS.get(provider, {})

        if provider == InferenceProvider.GEMINI:
            api_key = os.getenv(config.get("api_key_env", ""))
            instance = GeminiProvider(
                api_key=api_key,
                default_model=config.get("default_model", "gemini-2.0-flash")
            )
        else:
            # OpenAI-compatible provider
            api_key_env = config.get("api_key_env")
            api_key = os.getenv(api_key_env, "") if api_key_env else "placeholder"
            base_url = config.get("base_url", "http://localhost:11434/v1")

            instance = OpenAICompatibleProvider(
                base_url=base_url,
                api_key=api_key,
                default_model=config.get("default_model", "llama3.1"),
                provider_name=provider.value
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
                "model": "gemini-2.0-flash",
                "provider": "gemini"
            }
        """
        use_provider, use_model = self._resolve_provider_and_model(model, provider)
        provider_instance = self._get_provider(use_provider)

        response = await provider_instance.generate_chat(
            messages=messages,
            model=use_model,
            temperature=temperature,
            max_tokens=max_tokens,
            stop=stop,
            **kwargs
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
            elif provider == InferenceProvider.OLLAMA:
                # Ollama doesn't need a key, check if accessible
                try:
                    instance = self._get_provider(provider)
                    health = instance.health_check()
                    available = health.get("healthy", False)
                except:
                    available = False

            results.append({
                "provider": provider.value,
                "available": available,
                "default_model": config.get("default_model"),
                "requires_api_key": api_key_env is not None
            })

        return results


# Factory function for creating custom configured services
def create_inference_service(
    provider: Optional[InferenceProvider] = None,
    model: Optional[str] = None,
    base_url: Optional[str] = None,
    api_key: Optional[str] = None
) -> InferenceService:
    """
    Factory to create inference service with custom configuration.

    Examples:
        # Auto-detect
        service = create_inference_service()

        # Specific provider
        service = create_inference_service(provider=InferenceProvider.GEMINI)

        # Custom endpoint
        service = create_inference_service(
            provider=InferenceProvider.CUSTOM,
            base_url="https://my-llm.com/v1",
            api_key="my-key"
        )
    """
    return InferenceService(
        default_provider=provider,
        default_model=model
    )


# Global instance (auto-detects provider)
inference_service = InferenceService()
