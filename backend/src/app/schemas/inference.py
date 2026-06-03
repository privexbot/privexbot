"""
Inference schemas — Pydantic shapes for the LLM-model listing endpoint.

WHY:
- Frontend `<ModelSelector>` (chatflow LLM node, chatbot create/edit) needs to
  fetch the live list of Secret AI models from `Secret().get_models()` instead
  of using a hardcoded dropdown that didn't match what the backend actually
  called at inference time.

HOW:
- One response shape only. Kept deliberately small — the SDK currently returns
  only model IDs (no metadata). If Secret AI ever exposes context window /
  capability / deprecation per model, add optional fields here rather than
  introducing a new endpoint shape.
"""

from datetime import datetime
from typing import List

from pydantic import BaseModel, Field


class ModelsResponse(BaseModel):
    """List of inference models available right now."""

    models: List[str] = Field(
        ...,
        description=(
            "Model IDs available for chatbots / chatflow LLM nodes. Sourced "
            "live from `Secret().get_models()` and cached for ~1 hour. May be "
            "empty when the SDK is unreachable and there is no cached value."
        ),
    )
    cached: bool = Field(
        ...,
        description=(
            "True when the response came from Redis (warm path); False when "
            "the SDK was called directly (cold path or refresh)."
        ),
    )
    as_of: datetime = Field(
        ...,
        description=(
            "When the underlying list was fetched from the SDK. Lets the "
            "client surface staleness if needed."
        ),
    )
