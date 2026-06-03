"""
Inference Routes - LLM model discovery for the frontend.

WHY:
- Frontend `<ModelSelector>` (chatflow LLM node, chatbot create/edit) needs
  to render a live dropdown of Secret AI models. The Secret AI SDK already
  exposes the list via `Secret().get_models()`; this route is the thin
  authenticated HTTP wrapper.

HOW:
- Single GET endpoint, auth via `get_current_user` only (not workspace-
  scoped — models are provider-global; same list for every workspace).
- Caching + fallback ladder lives in `inference_service.list_available_models`.
"""

import logging

from fastapi import APIRouter, Depends

from app.api.v1.dependencies import get_current_user
from app.models.user import User
from app.schemas.inference import ModelsResponse
from app.services.inference_service import inference_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/inference", tags=["inference"])


@router.get("/models", response_model=ModelsResponse)
async def list_models(
    current_user: User = Depends(get_current_user),
) -> ModelsResponse:
    """
    List Secret AI models available for chatbot / chatflow LLM nodes.

    Returns a (possibly empty) list of model IDs the user can pick from.
    The endpoint never 500s on SDK / Redis failure — it returns an empty
    list with `cached: false` so the frontend can render a clear
    "Models unavailable, retry" state rather than a broken page.
    """
    payload = await inference_service.list_available_models()
    return ModelsResponse(
        models=payload["models"],
        cached=payload["cached"],
        as_of=payload["as_of"],
    )
