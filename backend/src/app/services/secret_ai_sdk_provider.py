"""
Secret AI SDK Provider

Wraps the native secret-ai-sdk for use with existing chatbot architecture.
Handles message format conversion and maintains API consistency with OpenAI provider.

WHY: Provides an alternative to the OpenAI-compatible API using the native SDK
HOW: Converts OpenAI message format to LangChain tuple format, wraps sync SDK in async
"""

from typing import List, Dict, Optional
import asyncio
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

        # Call SDK (synchronous - wrap in executor for async compatibility)
        loop = asyncio.get_event_loop()
        try:
            response = await loop.run_in_executor(
                None,
                self._client.invoke,
                sdk_messages
            )
        except Exception as e:
            logger.error(f"[SecretAISDKProvider] SDK invoke failed: {e}")
            raise

        # Extract text from response
        # SDK returns AIMessage with .content attribute
        if hasattr(response, 'content'):
            response_text = response.content
        else:
            response_text = str(response)

        logger.debug(f"[SecretAISDKProvider] Response length: {len(response_text)} chars")

        return {
            "text": response_text,
            "usage": {
                "prompt_tokens": 0,  # SDK doesn't provide token counts
                "completion_tokens": 0,
                "total_tokens": 0
            },
            "model": self._model,
            "provider": "secret_ai_sdk"
        }


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
