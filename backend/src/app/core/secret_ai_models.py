"""Shared utilities for Secret AI model identification and worker discovery.

Kept separate from `inference_service.py` and `secret_ai_sdk_provider.py`
to avoid the circular import that would result from either side importing
the other (`inference_service` lazily imports the SDK provider; reversing
that direction at module top-level deadlocks Python's import machinery).

Secret AI moved its model park from Ollama to a vLLM backend that speaks the
**OpenAI API** at `{worker}/v1`. The on-chain contract (`Secret().get_models()`
/ `get_urls()`) is stale on both model names and url mappings, so the only
reliable source of truth for what a worker actually serves is that worker's
own `GET /v1/models` response. `discover_served_chat_models` builds a live
`{model_id: worker_url}` registry from those probes.
"""

import os
import re
from typing import Any, Dict

import httpx


# Non-chat model families. A served model whose id matches any of these is a
# speech/embedding endpoint (TTS, STT, embeddings), not a chat-completions
# model — exclude it from the chat registry and the /inference/models dropdown.
#
# Deny-list (not allow-list) on purpose: the worker is the source of truth for
# what exists, so we only need to subtract the few non-chat families. An
# allow-list of name prefixes goes stale every time Secret Labs ships a new
# chat model with an unfamiliar name (e.g. `qwq:32b`, which has no `qwen`
# prefix yet is a real chat model).
NON_CHAT_PATTERN = re.compile(r"(tts|whisper|stt|kokoro|embed)", re.IGNORECASE)


def is_chat_capable(model_id: Any) -> bool:
    """True when the model id is NOT a known non-chat (TTS/STT/embedding) family."""
    return (
        isinstance(model_id, str)
        and bool(model_id)
        and not NON_CHAT_PATTERN.search(model_id)
    )


def _bearer_headers() -> Dict[str, str]:
    headers = {"Accept": "application/json"}
    api_key = os.environ.get("SECRET_AI_API_KEY", "")
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    return headers


def _worker_served_models(worker_url: str, timeout: float = 3.0) -> list:
    """Return the model ids a worker actually serves via `GET {worker}/v1/models`.

    Returns [] on any non-200 / error (TTS/STT ports 404 here, dead ports
    refuse the connection) — a single unreachable or non-OpenAI worker must
    never crash registry discovery.
    """
    try:
        resp = httpx.get(
            f"{worker_url}/v1/models",
            headers=_bearer_headers(),
            timeout=timeout,
        )
        if resp.status_code != 200:
            return []
        data = resp.json().get("data") or []
        return [item.get("id") for item in data if isinstance(item, dict) and item.get("id")]
    except Exception:
        return []


def discover_served_chat_models(secret, timeout: float = 3.0) -> Dict[str, str]:
    """Build a live `{served_model_id: worker_url}` registry of chat models.

    `secret` is a `secret_ai_sdk.secret.Secret` instance. We use it only to
    enumerate worker HOST urls (the contract's model names are stale); the
    authoritative served-model list for each worker comes from that worker's
    `GET /v1/models`.

    Steps:
      1. Collect the distinct worker urls the contract advertises across all
         `secret.get_models()` (via `get_urls(model)`).
      2. Probe each worker's `/v1/models` (3s timeout, skip on error).
      3. Keep served ids that pass `is_chat_capable`, mapping each to its
         worker url. If two workers serve the same id, last-wins (rare;
         either works).

    Never raises for a single bad worker. Raises only if `secret` itself
    can't enumerate anything (caller handles that as "Secret AI unavailable").
    """
    models = secret.get_models() or []

    # Distinct worker urls (the contract maps each model to a url; many models
    # share a url, and the names are stale, so we only want the url set).
    worker_urls = []
    seen = set()
    for model in models:
        try:
            for url in (secret.get_urls(model=model) or []):
                if url not in seen:
                    seen.add(url)
                    worker_urls.append(url)
        except Exception:
            continue

    registry: Dict[str, str] = {}
    for url in worker_urls:
        for served_id in _worker_served_models(url, timeout=timeout):
            if is_chat_capable(served_id):
                registry[served_id] = url
    return registry
