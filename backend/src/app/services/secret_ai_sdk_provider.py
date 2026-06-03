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
            # built lazily in `_invoke_with_url_fallback` / `_build_client`.
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

    def _build_client(self, model: str, base_url: str):
        """Build a fresh ChatSecret instance pinned to a specific worker URL.
        Pinning is what makes user model selection actually reach the right
        worker — a single `ChatSecret` carries both `model` and `base_url`,
        and the underlying Ollama protocol won't route off either.
        """
        from secret_ai_sdk.secret_ai import ChatSecret

        return ChatSecret(
            base_url=base_url,
            model=model,
            temperature=self.temperature,
        )

    async def _invoke_with_url_fallback(
        self,
        model: str,
        sdk_messages: List[tuple],
        temperature: Optional[float],
        _depth: int = 0,
    ) -> tuple:
        """Try to invoke `model` against any worker URL the contract
        advertises. Returns ``(response, actual_model)`` — `actual_model`
        reflects the model that actually served the response (may differ
        from `model` after a fallback hop), so the caller can record the
        truthful value in its response payload.

        Handles three real-world failure modes:

        1. **Stale contract entry.** Secret Labs occasionally migrates a
           model between workers (e.g. `secretai-rytn` → `secretai-jedi`)
           before the smart-contract entry is updated. The old URL still
           appears in `get_urls(model)`, but the Ollama backend behind it
           returns 404 because the model is no longer loaded there.
        2. **Legacy / deprecated model id.** A chatbot config may carry a
           model id the contract no longer advertises any URL for at all
           (e.g. the legacy `"secret-ai-v1"` placeholder).
        3. **`models[0]` is broken.** The contract's enumeration order is
           not a health signal — `Secret().get_models()[0]` may be the
           one model whose worker is currently down. The old code coerced
           to that, hit the equality guard, and raised.

        For (1), (2), and (3) the recovery path is the same: iterate every
        chat-base model in the contract, try each one, return the first
        that serves successfully. Bounded by `_depth=1` to keep the
        recursion at most one hop deep.

        Caches the working ChatSecret on the first success so subsequent
        requests for the same model hit the fast path. Eviction happens
        on any invocation failure — the next call re-iterates URLs.
        """
        # Fast path: cached working client
        cached = self._clients.get(model)
        if cached is not None:
            if temperature is not None:
                cached.temperature = temperature
            try:
                response = await cached.ainvoke(sdk_messages)
                return response, model
            except Exception as e:
                logger.warning(
                    "[SecretAISDKProvider] Cached client failed for model=%r "
                    "(%s: %s); evicting and trying alternate workers.",
                    model, type(e).__name__, e,
                )
                self._clients.pop(model, None)

        # Slow path: iterate every worker URL the contract advertises
        self._ensure_secret_initialized()
        urls = self._secret.get_urls(model=model)
        if not urls:
            # No workers at all → try other chat-base models from the contract.
            logger.warning(
                "[SecretAISDKProvider] No workers advertised for model=%r — "
                "trying alternate chat-base models.",
                model,
            )
            return await self._iterate_candidates(
                model, sdk_messages, temperature, _depth,
            )

        last_error: Optional[Exception] = None
        for idx, base_url in enumerate(urls):
            client = self._build_client(model, base_url)
            if temperature is not None:
                client.temperature = temperature
            try:
                logger.info(
                    "[SecretAISDKProvider] Trying worker %d/%d for model=%s: %s",
                    idx + 1, len(urls), model, base_url,
                )
                response = await client.ainvoke(sdk_messages)
                # Latch the working URL for future requests on this model
                self._clients[model] = client
                return response, model
            except Exception as e:
                last_error = e
                logger.warning(
                    "[SecretAISDKProvider] Worker %d/%d (%s) failed for model=%s: "
                    "%s: %s",
                    idx + 1, len(urls), base_url, model, type(e).__name__, e,
                )
                continue

        # Every URL for this model failed. Try other chat-base models.
        return await self._iterate_candidates(
            model, sdk_messages, temperature, _depth, last_error=last_error,
        )

    async def _iterate_candidates(
        self,
        failed_model: str,
        sdk_messages: List[tuple],
        temperature: Optional[float],
        _depth: int,
        last_error: Optional[Exception] = None,
    ) -> tuple:
        """Iterate `Secret().get_models()` (chat-base only) skipping the
        model that just failed, recursing into `_invoke_with_url_fallback`
        with `_depth=1` so the fallback hop cannot recurse further.

        Returns the same ``(response, actual_model)`` tuple shape.
        Raises `last_error` (preserving the original failure signal) or
        a generic `RuntimeError` when every candidate has been tried.
        """
        # Recursion guard: at depth >= 1 we are already a fallback attempt;
        # don't try yet another model. Let the parent loop pick the next
        # candidate or raise.
        if _depth >= 1:
            if last_error is not None:
                raise last_error
            raise RuntimeError(
                f"No workers available for model {failed_model!r}."
            )

        # Import here (not at module top) — `app.core.secret_ai_models` is
        # leaf-level and free of cycles, but keeping this import inside the
        # method matches the rest of the file's lazy-import pattern for
        # anything not used at module load.
        from app.core.secret_ai_models import is_chat_capable

        last_inner_error: Optional[Exception] = last_error
        candidates = self._secret.get_models() or []
        attempted = 0
        for candidate in candidates:
            if candidate == failed_model or not is_chat_capable(candidate):
                continue
            attempted += 1
            try:
                logger.warning(
                    "[SecretAISDKProvider] %r failed; routing to fallback %r "
                    "(candidate %d).",
                    failed_model, candidate, attempted,
                )
                return await self._invoke_with_url_fallback(
                    candidate, sdk_messages, temperature, _depth=1,
                )
            except Exception as e:
                last_inner_error = e
                logger.warning(
                    "[SecretAISDKProvider] Fallback candidate %r also failed: "
                    "%s: %s",
                    candidate, type(e).__name__, e,
                )
                continue

        # Every chat-base candidate failed — surface the underlying error
        # so the caller can decide how to respond (REST transport fallback,
        # user-visible error, etc.).
        if last_inner_error is not None:
            raise last_inner_error
        raise RuntimeError(
            f"All {attempted} chat-base candidates exhausted for failed "
            f"model {failed_model!r}."
        )

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

        # Convert message format
        sdk_messages = self._convert_messages(messages)

        logger.debug(
            f"[SecretAISDKProvider] Invoking model={selected_model} "
            f"with {len(sdk_messages)} messages"
        )

        # Invoke via the URL-fallback helper. Tries the cached working
        # client first, then iterates every worker URL the smart contract
        # advertises for this model, then iterates other chat-base models
        # if no URL works. Returns (response, actual_model) — `actual_model`
        # may differ from `selected_model` when a fallback hop fired, and
        # is what we record in the response dict so the caller sees the
        # truthful model id. See `_invoke_with_url_fallback` for the full
        # failure-handling contract.
        response, actual_model = await self._invoke_with_url_fallback(
            selected_model, sdk_messages, temperature
        )
        if actual_model != selected_model:
            logger.warning(
                "[SecretAISDKProvider] Requested model=%r served by fallback=%r.",
                selected_model, actual_model,
            )

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
            "model": actual_model,
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
