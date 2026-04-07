"""
Secret AI SDK Provider

Wraps the native secret-ai-sdk for use with existing chatbot architecture.
Handles message format conversion and maintains API consistency with OpenAI provider.

WHY: Provides an alternative to the OpenAI-compatible API using the native SDK
HOW: Converts OpenAI message format to LangChain tuple format, uses native async ainvoke
"""

from typing import List, Dict, Optional
import logging

logger = logging.getLogger(__name__)


class SecretAISDKProvider:
    """
    Native Secret AI SDK provider.

    Provides the same interface as the OpenAI-compatible provider but uses
    the native secret-ai-sdk under the hood.
    """

    def __init__(self, temperature: float = 0.7):
        self.temperature = temperature
        self._client = None
        self._model = None
        self._initialized = False

    def _ensure_client(self):
        """Lazy initialization of SDK client."""
        if self._initialized:
            return

        try:
            from secret_ai_sdk.secret_ai import ChatSecret
            from secret_ai_sdk.secret import Secret

            logger.info("[SecretAISDKProvider] Initializing native SDK client...")

            secret_client = Secret()
            models = secret_client.get_models()

            if not models:
                raise RuntimeError("No models available from Secret AI SDK")

            urls = secret_client.get_urls(model=models[0])

            if not urls:
                raise RuntimeError(f"No URLs available for model {models[0]}")

            self._model = models[0]
            self._client = ChatSecret(
                base_url=urls[0],
                model=self._model,
                temperature=self.temperature
            )
            self._initialized = True

            logger.info(f"[SecretAISDKProvider] Initialized with model: {self._model}")

        except ImportError as e:
            raise ImportError(
                "secret-ai-sdk is not installed. Install it with: uv add secret-ai-sdk"
            ) from e
        except Exception as e:
            logger.error(f"[SecretAISDKProvider] Failed to initialize: {e}")
            raise

    def _convert_messages(self, messages: List[Dict[str, str]]) -> List[tuple]:
        """
        Convert OpenAI format to LangChain tuple format.

        OpenAI format:
            [{"role": "system", "content": "..."}, {"role": "user", "content": "..."}]

        LangChain tuple format (used by secret-ai-sdk):
            [("system", "..."), ("human", "...")]

        Role mapping:
            - "system" -> "system"
            - "user" -> "human"
            - "assistant" -> "ai"
        """
        converted = []
        for msg in messages:
            role = msg.get("role", "user")
            content = msg.get("content", "")

            # Map OpenAI roles to LangChain roles
            if role == "system":
                converted.append(("system", content))
            elif role == "user":
                converted.append(("human", content))
            elif role == "assistant":
                converted.append(("ai", content))
            else:
                # Unknown role - treat as human
                logger.warning(f"[SecretAISDKProvider] Unknown role '{role}', treating as human")
                converted.append(("human", content))

        return converted

    async def generate_chat(
        self,
        messages: List[Dict[str, str]],
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        **kwargs
    ) -> Dict:
        """
        Generate chat response using native SDK.

        Args:
            messages: List of messages in OpenAI format
            temperature: Optional temperature override
            max_tokens: Optional max tokens (may not be supported by SDK)

        Returns:
            Dict with same structure as OpenAI provider:
            {
                "text": str,
                "usage": {"prompt_tokens": int, "completion_tokens": int, "total_tokens": int},
                "model": str,
                "provider": "secret_ai_sdk"
            }
        """
        self._ensure_client()

        # Update temperature if specified
        if temperature is not None:
            self._client.temperature = temperature

        # Convert message format
        sdk_messages = self._convert_messages(messages)

        logger.debug(f"[SecretAISDKProvider] Invoking with {len(sdk_messages)} messages")

        # Call SDK using native async method (ainvoke)
        # WHY: Using ainvoke directly instead of wrapping invoke in run_in_executor
        # HOW: LangChain's ainvoke is the proper async interface, avoiding event loop conflicts
        # Retry once on transient failures (SDK sometimes returns empty errors)
        last_error = None
        for attempt in range(2):
            try:
                response = await self._client.ainvoke(sdk_messages)
                break
            except Exception as e:
                last_error = e
                logger.error(
                    f"[SecretAISDKProvider] SDK ainvoke failed (attempt {attempt + 1}/2): "
                    f"{type(e).__name__}: {e}",
                    exc_info=True
                )
                if attempt == 0:
                    # Reset client on first failure — URL may have gone stale
                    self._initialized = False
                    self._ensure_client()
                    continue
                raise

        # Extract text from response
        # SDK returns AIMessage with .content attribute
        if hasattr(response, 'content'):
            response_text = response.content
        else:
            response_text = str(response)

        logger.debug(f"[SecretAISDKProvider] Response length: {len(response_text)} chars")

        # Extract token usage from LangChain AIMessage metadata
        prompt_tokens = 0
        completion_tokens = 0

        # Try 1: usage_metadata (LangChain's standard token tracking)
        if hasattr(response, 'usage_metadata') and response.usage_metadata:
            um = response.usage_metadata
            if isinstance(um, dict):
                prompt_tokens = um.get('input_tokens', 0) or um.get('prompt_tokens', 0) or 0
                completion_tokens = um.get('output_tokens', 0) or um.get('completion_tokens', 0) or 0
            else:
                prompt_tokens = getattr(um, 'input_tokens', 0) or getattr(um, 'prompt_tokens', 0) or 0
                completion_tokens = getattr(um, 'output_tokens', 0) or getattr(um, 'completion_tokens', 0) or 0

        # Try 2: response_metadata.token_usage or response_metadata.usage
        if not (prompt_tokens or completion_tokens):
            if hasattr(response, 'response_metadata') and response.response_metadata:
                rm = response.response_metadata
                usage = rm.get('token_usage', rm.get('usage', {}))
                if isinstance(usage, dict):
                    prompt_tokens = usage.get('prompt_tokens', 0) or usage.get('input_tokens', 0) or 0
                    completion_tokens = usage.get('completion_tokens', 0) or usage.get('output_tokens', 0) or 0

        # Try 3: Estimate with tiktoken if metadata unavailable
        if not (prompt_tokens or completion_tokens):
            prompt_tokens, completion_tokens = self._estimate_tokens(sdk_messages, response_text)
            logger.info("[SecretAISDKProvider] Token counts estimated via tiktoken (no metadata from provider)")

        total_tokens = prompt_tokens + completion_tokens

        logger.debug(f"[SecretAISDKProvider] Tokens - prompt: {prompt_tokens}, completion: {completion_tokens}, total: {total_tokens}")

        return {
            "text": response_text,
            "usage": {
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens,
                "total_tokens": total_tokens
            },
            "model": self._model,
            "provider": "secret_ai_sdk"
        }

    def _estimate_tokens(self, messages: list, response_text: str) -> tuple:
        """Estimate token counts using tiktoken when provider doesn't return usage data."""
        try:
            import tiktoken
            enc = tiktoken.get_encoding("cl100k_base")

            # Estimate prompt tokens from all input messages
            prompt_text = " ".join(content for _, content in messages)
            prompt_tokens = len(enc.encode(prompt_text))

            # Estimate completion tokens from response
            completion_tokens = len(enc.encode(response_text))

            return prompt_tokens, completion_tokens
        except Exception:
            # Last resort: rough char/4 heuristic
            prompt_text = " ".join(content for _, content in messages)
            return len(prompt_text) // 4, len(response_text) // 4


# Singleton instance
_sdk_provider: Optional[SecretAISDKProvider] = None


def get_secret_ai_sdk_provider(temperature: float = 0.7) -> SecretAISDKProvider:
    """
    Get or create SDK provider singleton.

    Args:
        temperature: Default temperature for responses

    Returns:
        SecretAISDKProvider instance
    """
    global _sdk_provider
    if _sdk_provider is None:
        _sdk_provider = SecretAISDKProvider(temperature=temperature)
    return _sdk_provider


def reset_sdk_provider():
    """Reset the singleton provider (useful for testing)."""
    global _sdk_provider
    _sdk_provider = None
