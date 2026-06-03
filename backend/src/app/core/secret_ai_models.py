"""Shared utilities for Secret AI model identification and health probing.

Kept separate from `inference_service.py` and `secret_ai_sdk_provider.py`
to avoid the circular import that would result from either side importing
the other (`inference_service` lazily imports the SDK provider; reversing
that direction at module top-level deadlocks Python's import machinery).
"""

import os
import re
from typing import Any

import httpx


# Allow-list of chat-base model families that we know speak the chat
# completions protocol via `ChatSecret.ainvoke()`. Workers outside these
# families (STT, TTS, niche code-only models, etc.) never reach the
# /inference/models dropdown.
#
# Anchored at start, case-insensitive. Extend when Secret Labs adds a new
# chat family that doesn't match an existing prefix.
CHAT_MODEL_FAMILY_PATTERN = re.compile(
    r"^(deepseek|llama|gemma|qwen|gpt-|mistral|mixtral|phi)",
    re.IGNORECASE,
)


def is_chat_capable(model_id: Any) -> bool:
    """True when the model ID belongs to a known chat-base family.

    Allow-list rather than deny-list because the project's policy is
    "we don't want anything to break for users, not even from their
    mistakes" — hiding a new model until vetted is preferred over
    risking a user picking a non-chat worker.
    """
    return (
        isinstance(model_id, str)
        and bool(model_id)
        and bool(CHAT_MODEL_FAMILY_PATTERN.match(model_id))
    )


def ping_chat_model(url: str, model: str, timeout: float = 2.0) -> bool:
    """POST a minimal /api/chat request to verify the worker is currently
    serving this model.

    Sends the same `Authorization: Bearer {SECRET_AI_API_KEY}` header
    the SDK does (`secret_ai_sdk/_enhanced_client.py:61-82`). Without
    this header the worker returns `401 Unauthorized` regardless of
    whether the model is loaded — which would make the probe useless.

    Used by:
    - `scripts/migrate_legacy_model_field.py:resolve_working_chat_model`
      at boot to pick a target that will actually serve.
    - `services/secret_ai_sdk_provider._iterate_candidates` indirectly,
      through the SDK's `ainvoke` (no extra probe needed there since the
      real chat call IS the probe).

    Returns True on HTTP 200; False on any non-200 status or exception
    (network error, timeout, malformed JSON, auth failure, etc.). Never
    raises — the purpose is "can we use this combination right now?"
    not "tell me what went wrong."
    """
    headers = {"Content-Type": "application/json"}
    api_key = os.environ.get("SECRET_AI_API_KEY", "")
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    try:
        resp = httpx.post(
            f"{url}/api/chat",
            json={
                "model": model,
                "messages": [{"role": "user", "content": "."}],
                "stream": False,
            },
            headers=headers,
            timeout=timeout,
        )
        return resp.status_code == 200
    except Exception:
        return False
