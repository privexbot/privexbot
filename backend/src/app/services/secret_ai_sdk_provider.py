"""
Secret AI SDK Provider — native gRPC + LangChain transport for Secret AI.

This is one of two transports to the SAME Secret AI TEE-protected nodes (the
other is the REST transport in inference_service.py — `SecretAIRestProvider`).
Both terminate inside Secret AI infrastructure; switching between them never
routes data through OpenAI / Akash / any non-TEE provider.

WHY: The native SDK gives us the most direct access to Secret AI's confidential
inference (dynamic node discovery, gRPC streaming, LangChain ergonomics).
HOW: Convert OpenAI-shaped messages to LangChain tuples; call `ainvoke` async.
"""

from typing import List, Dict, Optional
import logging
import re

logger = logging.getLogger(__name__)


# Reasoning models (e.g. DeepSeek-R1, the default per llm_node.py:46) emit
# chain-of-thought wrapped in <think>...</think> before the answer. Strip it
# at the inference boundary so it never reaches end users via chat / live-test.
# Mirrors `_strip_thinking` in inference_service.py — kept inline to avoid a
# circular import (inference_service lazily imports this module).
_THINK_BLOCK_RE = re.compile(r"<think>.*?</think>", re.DOTALL | re.IGNORECASE)


def _strip_thinking(text: str) -> str:
    if not text:
        return text
    return _THINK_BLOCK_RE.sub("", text).strip()


class SecretAISDKProvider:
    """
    Native Secret AI SDK provider (gRPC + LangChain transport).

    Same `generate_chat` interface as `SecretAIRestProvider` (REST transport)
    so callers can swap between them without code changes. Both call the same
    Secret AI TEE nodes — this is purely a transport-level distinction.
    """

    def __init__(self, temperature: float = 0.7):
        self.temperature = temperature
        self._secret = None  # secret_ai_sdk.secret.Secret instance (worker registry)
        # Per-model ChatSecret client cache. Building one ChatSecret per
        # requested model is necessary because each model's worker URL is
        # resolved via `Secret().get_urls(model=...)` — routing a request
        # for model B through a client pinned to model A's URL would
        # silently hit the wrong worker.
        self._clients: Dict[str, object] = {}
        self._default_model: Optional[str] = None
        self._initialized = False

    def _ensure_secret_initialized(self):
        """Initialize the Secret() worker-registry client and resolve the
        default model. Safe to call repeatedly; only the first call does work.
        """
        if self._initialized:
            return

        try:
            # Validate the ChatSecret import here too so callers get a single
            # consolidated error path; the actual ChatSecret instances are
            # built lazily in `_get_client_for_model`.
            from secret_ai_sdk.secret_ai import ChatSecret  # noqa: F401
            from secret_ai_sdk.secret import Secret

            logger.info("[SecretAISDKProvider] Initializing native SDK worker registry...")

            self._secret = Secret()
            models = self._secret.get_models()

            if not models:
                raise RuntimeError("No models available from Secret AI SDK")

            self._default_model = models[0]
            self._initialized = True

            logger.info(
                f"[SecretAISDKProvider] Worker registry ready; default model: {self._default_model}"
            )

        except ImportError as e:
            # Surface the underlying import failure so operators can see WHICH
            # sub-module is missing (the SDK has several optional dependencies
            # that can fail independently — betterproto, grpcio, langchain).
            logger.error(
                "[SecretAISDKProvider] Native SDK import failed — wheel missing or broken. "
                "Underlying error: %r. The Dockerfile should have caught this at build "
                "time (it now runs `python -c 'import secret_ai_sdk.secret_ai'`); if you "
                "see this in production the running image was built before that check "
                "was added. Rebuild the image to fix. The REST transport will pick up "
                "this request — see inference_service.generate_chat fallback.",
                e,
            )
            raise ImportError(
                f"secret-ai-sdk import failed: {e}. The REST transport will be used as "
                f"fallback (still TEE-protected, still inside Secret AI)."
            ) from e
        except Exception as e:
            # Network / SSL / no-models / Secret() init failure. Log the full
            # traceback so operators can triage from prod logs.
            logger.exception(
                "[SecretAISDKProvider] Native SDK init failed at runtime — "
                "common causes: Secret AI node URL unreachable, SSL cert mismatch, "
                "no models returned by Secret().get_models(). The REST transport "
                "will pick up this request. Underlying error: %s",
                e,
            )
            raise

    def list_models(self) -> List[str]:
        """Return the live list of model IDs available on Secret AI.

        Thin wrapper around `Secret().get_models()` that reuses the cached
        worker-registry client. Callers (e.g. `inference_service.list_available_models`)
        are responsible for any further caching layer.
        """
        self._ensure_secret_initialized()
        return self._secret.get_models()

    def _get_client_for_model(self, model: str):
        """Lazily build (and memoize) a ChatSecret client bound to a specific
        model + its worker URL. This is the routing primitive — pinning a
        client to the right base_url is what makes user model selection
        actually reach the right worker.
        """
        cached = self._clients.get(model)
        if cached is not None:
            return cached

        self._ensure_secret_initialized()
        from secret_ai_sdk.secret_ai import ChatSecret

        urls = self._secret.get_urls(model=model)
        if not urls:
            raise RuntimeError(f"No URLs available for model {model}")

        client = ChatSecret(
            base_url=urls[0],
            model=model,
            temperature=self.temperature,
        )
        self._clients[model] = client
        logger.info(
            f"[SecretAISDKProvider] Built ChatSecret for model={model} base_url={urls[0]}"
        )
        return client

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
        model: Optional[str] = None,
        **kwargs
    ) -> Dict:
        """
        Generate chat response using native SDK.

        Args:
            messages: List of messages in OpenAI format
            temperature: Optional temperature override
            max_tokens: Optional max tokens (may not be supported by SDK)
            model: Specific model ID to use. When omitted, falls back to
                Secret AI's first available model (typically the default
                listed by `Secret().get_models()`).

        Returns:
            Dict with same structure as OpenAI provider:
            {
                "text": str,
                "usage": {"prompt_tokens": int, "completion_tokens": int, "total_tokens": int},
                "model": str,
                "provider": "secret_ai_sdk"
            }
        """
        self._ensure_secret_initialized()

        # Resolve which model to route to. Explicit > registry default.
        selected_model = model or self._default_model
        if not selected_model:
            raise RuntimeError("No model available from Secret AI SDK and none specified")

        client = self._get_client_for_model(selected_model)

        # Update temperature if specified
        if temperature is not None:
            client.temperature = temperature

        # Convert message format
        sdk_messages = self._convert_messages(messages)

        logger.debug(
            f"[SecretAISDKProvider] Invoking model={selected_model} "
            f"with {len(sdk_messages)} messages"
        )

        # Call SDK using native async method (ainvoke)
        # WHY: Using ainvoke directly instead of wrapping invoke in run_in_executor
        # HOW: LangChain's ainvoke is the proper async interface, avoiding event loop conflicts
        # Retry once on transient failures (SDK sometimes returns empty errors).
        # On the retry, evict this model's cached client so a fresh `get_urls`
        # lookup happens — covers the case where a worker URL has rotated.
        for attempt in range(2):
            try:
                response = await client.ainvoke(sdk_messages)
                break
            except Exception as e:
                logger.error(
                    f"[SecretAISDKProvider] SDK ainvoke failed for model={selected_model} "
                    f"(attempt {attempt + 1}/2): {type(e).__name__}: {e}",
                    exc_info=True
                )
                if attempt == 0:
                    # Drop the cached client for this model so the next call
                    # re-resolves its URL. The Secret() worker-registry
                    # client itself stays alive.
                    self._clients.pop(selected_model, None)
                    client = self._get_client_for_model(selected_model)
                    if temperature is not None:
                        client.temperature = temperature
                    continue
                raise

        # Extract text from response
        # SDK returns AIMessage with .content attribute
        if hasattr(response, 'content'):
            response_text = response.content
        else:
            response_text = str(response)

        # Drop chain-of-thought (<think>...</think>) from reasoning models.
        response_text = _strip_thinking(response_text)

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
            "model": selected_model,
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
