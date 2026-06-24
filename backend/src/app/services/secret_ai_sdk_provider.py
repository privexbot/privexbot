"""Secret AI provider — OpenAI-compatible transport to Secret AI's vLLM workers.

Secret AI migrated its model park from Ollama to a **vLLM** backend that speaks
the OpenAI API at `{worker}/v1`. We therefore:

  * use `secret_ai_sdk.secret.Secret` only to enumerate worker HOST urls
    (on-chain discovery — the only non-hardcoded source of worker addresses);
  * discover what each worker actually serves from its own `GET /v1/models`
    (the contract's model names are stale — see `core/secret_ai_models`);
  * run inference with the OpenAI SDK (`AsyncOpenAI`) against `{worker}/v1`.

All traffic still terminates inside Secret AI's TEE-protected infrastructure;
this is purely the transport the workers now expose. No data ever routes
through OpenAI / Akash / any non-TEE provider.
"""

import asyncio
import logging
import re
import time
from typing import Dict, List, Optional

from app.core.config import settings
from app.core.secret_ai_models import discover_served_chat_models

logger = logging.getLogger(__name__)


# Reasoning models (e.g. DeepSeek-R1) emit chain-of-thought wrapped in
# <think>...</think> before the answer. Strip it at the inference boundary so
# it never reaches end users. Mirrors `_strip_thinking` in inference_service.py
# (kept inline to avoid a circular import).
_THINK_BLOCK_RE = re.compile(r"<think>.*?</think>", re.DOTALL | re.IGNORECASE)

# How long a discovered worker registry stays fresh before we re-probe.
_REGISTRY_TTL_SECONDS = 60 * 60  # 1 hour


def _strip_thinking(text: str) -> str:
    if not text:
        return text
    return _THINK_BLOCK_RE.sub("", text).strip()


def _pick_default(registry: Dict[str, str]) -> Optional[str]:
    """Pick the preferred default model from the live registry.

    Prefer a `gpt-oss*` model (Secret Labs' recommended vLLM model) but read
    the EXACT served id from the registry — never hardcode the colon-tagged
    string, which would break if Secret Labs renames the alias.
    """
    if not registry:
        return None
    for model_id in registry:
        if model_id.lower().startswith("gpt-oss"):
            return model_id
    return next(iter(registry))


class SecretAISDKProvider:
    """OpenAI-transport Secret AI provider.

    Public `generate_chat` returns the same dict shape callers already consume
    (`chatbot_service` reads `["text"]` / `["usage"]`).
    """

    def __init__(self, temperature: float = 0.7):
        self.temperature = temperature
        self._secret = None  # secret_ai_sdk.secret.Secret — worker host discovery
        self._initialized = False

        # Live {served_model_id: worker_url} registry, probed from each
        # worker's /v1/models. Rebuilt when older than _REGISTRY_TTL_SECONDS.
        self._registry: Dict[str, str] = {}
        self._registry_ts: float = 0.0
        self._default_model: Optional[str] = None
        self._registry_lock = asyncio.Lock()

        # One AsyncOpenAI client per worker url (reused across models on that
        # worker — the model id is a per-request arg, not bound to the client).
        self._clients: Dict[str, object] = {}

    # ------------------------------------------------------------------ #
    # Discovery
    # ------------------------------------------------------------------ #
    def _ensure_secret_initialized(self):
        """Construct the Secret() worker-registry client once."""
        if self._initialized:
            return
        try:
            from secret_ai_sdk.secret import Secret

            logger.info("[SecretAIProvider] Initializing Secret() worker discovery...")
            self._secret = Secret()
            self._initialized = True
        except ImportError as e:
            logger.error(
                "[SecretAIProvider] secret-ai-sdk import failed — wheel missing/broken: %r. "
                "Rebuild the image (the Dockerfile verifies the import at build time).",
                e,
            )
            raise
        except Exception as e:
            logger.exception(
                "[SecretAIProvider] Secret() init failed (node URL unreachable / SSL / "
                "contract query). Underlying error: %s",
                e,
            )
            raise

    def _registry_fresh(self) -> bool:
        return bool(self._registry) and (time.monotonic() - self._registry_ts) < _REGISTRY_TTL_SECONDS

    def _build_registry(self):
        """Probe workers and rebuild the served-chat-model registry (sync)."""
        self._ensure_secret_initialized()
        registry = discover_served_chat_models(self._secret)
        if not registry:
            raise RuntimeError(
                "No chat models served by any Secret AI worker. The contract may be "
                "mid-migration or all workers are unreachable."
            )
        self._registry = registry
        self._registry_ts = time.monotonic()
        self._default_model = _pick_default(registry)
        logger.info(
            "[SecretAIProvider] Registry built: %d chat model(s) served; default=%r",
            len(registry), self._default_model,
        )

    async def _ensure_registry(self):
        """Refresh the registry if stale, serializing concurrent rebuilds."""
        if self._registry_fresh():
            return
        async with self._registry_lock:
            if self._registry_fresh():
                return
            self._build_registry()

    def list_models(self) -> List[str]:
        """Live list of served chat model ids (used by /inference/models)."""
        if not self._registry_fresh():
            self._build_registry()
        return list(self._registry.keys())

    # ------------------------------------------------------------------ #
    # Transport
    # ------------------------------------------------------------------ #
    def _client_for_worker(self, worker_url: str):
        """Get/create the AsyncOpenAI client pinned to a worker's /v1 endpoint."""
        client = self._clients.get(worker_url)
        if client is None:
            from openai import AsyncOpenAI

            client = AsyncOpenAI(
                base_url=f"{worker_url}/v1",
                api_key=settings.SECRET_AI_API_KEY or "not-needed",
                # Generous timeout: large reasoning models (gpt-oss:120b) plus a
                # cold start can take tens of seconds. If a worker is genuinely
                # slow/down the request still bounds out and generate_chat falls
                # back to the next served model.
                timeout=60.0,
            )
            self._clients[worker_url] = client
        return client

    async def generate_chat(
        self,
        messages: List[Dict[str, str]],
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        model: Optional[str] = None,
        **kwargs,
    ) -> Dict:
        """Run a chat completion against Secret AI's OpenAI-compatible workers.

        Resolves the requested model to the worker that actually serves it.
        On a registry miss (e.g. a saved chatbot still pinned to a now-removed
        model id) coerces to the default served model. If the chosen model's
        worker call fails, tries the other served chat models once (bounded).

        Returns: {"text", "usage", "model", "provider"} — unchanged shape.
        """
        await self._ensure_registry()

        # Build the attempt order: requested model first (if served), else the
        # default, then every other served chat model as bounded fallback.
        requested = model
        primary = requested if (requested and requested in self._registry) else self._default_model
        if requested and requested not in self._registry:
            logger.warning(
                "[SecretAIProvider] Requested model=%r is not served; coercing to %r.",
                requested, primary,
            )
        if not primary:
            raise RuntimeError("No served Secret AI chat model available.")

        attempt_order = [primary] + [m for m in self._registry if m != primary]

        temp = temperature if temperature is not None else self.temperature
        last_error: Optional[Exception] = None

        for candidate in attempt_order:
            worker_url = self._registry.get(candidate)
            if not worker_url:
                continue
            client = self._client_for_worker(worker_url)
            params = {
                "model": candidate,
                "messages": messages,
                "temperature": temp,
            }
            if max_tokens is not None:
                params["max_tokens"] = max_tokens
            try:
                logger.info(
                    "[SecretAIProvider] Inference model=%s @ %s/v1", candidate, worker_url
                )
                resp = await client.chat.completions.create(**params)
                if candidate != primary:
                    logger.warning(
                        "[SecretAIProvider] Requested=%r served by fallback=%r.",
                        requested or primary, candidate,
                    )
                return self._to_response(resp, candidate)
            except Exception as e:
                last_error = e
                logger.warning(
                    "[SecretAIProvider] model=%s @ %s failed: %s: %s",
                    candidate, worker_url, type(e).__name__, e,
                )
                # A failing worker may have a stale cached client; drop it.
                self._clients.pop(worker_url, None)
                continue

        if last_error is not None:
            raise last_error
        raise RuntimeError("All served Secret AI chat models failed.")

    def _to_response(self, resp, model_id: str) -> Dict:
        """Map an OpenAI ChatCompletion to our response dict."""
        choice = resp.choices[0] if resp.choices else None
        content = (choice.message.content if choice and choice.message else "") or ""
        text = _strip_thinking(content)

        usage = getattr(resp, "usage", None)
        prompt_tokens = getattr(usage, "prompt_tokens", 0) or 0 if usage else 0
        completion_tokens = getattr(usage, "completion_tokens", 0) or 0 if usage else 0
        total_tokens = getattr(usage, "total_tokens", 0) or (prompt_tokens + completion_tokens) if usage else 0

        return {
            "text": text,
            "usage": {
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens,
                "total_tokens": total_tokens,
            },
            "model": model_id,
            "provider": "secret_ai_sdk",
        }


# Singleton
_sdk_provider: Optional[SecretAISDKProvider] = None


def get_secret_ai_sdk_provider(temperature: float = 0.7) -> SecretAISDKProvider:
    global _sdk_provider
    if _sdk_provider is None:
        _sdk_provider = SecretAISDKProvider(temperature=temperature)
    return _sdk_provider


def reset_sdk_provider():
    """Reset the singleton (useful for tests)."""
    global _sdk_provider
    _sdk_provider = None
