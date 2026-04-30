"""
Chatflow Template (Marketplace) routes.

WHY:
- Surface global, public chatflow blueprints any workspace can clone.
- Cloning produces a draft owned by the caller's workspace; from there the
  builder edits + finalizes it like any other chatflow.

Auth: every endpoint resolves the active org via `get_current_user_with_org`.
Templates themselves are global (no workspace_id filter); the workspace
referenced in `clone` must belong to the active org.
"""

from typing import Optional, Tuple
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.v1.dependencies import get_current_user_with_org
from app.db.session import get_db
from app.models.chatflow_template import ChatflowTemplate
from app.models.user import User
from app.models.workspace import Workspace
from app.services.draft_service import DraftType, draft_service


router = APIRouter(prefix="/templates", tags=["templates"])

UserContext = Tuple[User, str, str]


class TemplateResponse(BaseModel):
    id: str
    name: str
    slug: str
    description: Optional[str] = None
    category: Optional[str] = None
    icon: Optional[str] = None
    tags: list[str] = []
    use_count: int
    node_count: int
    edge_count: int


class TemplateDetailResponse(TemplateResponse):
    # Full config returned on detail; the list endpoint omits it for size.
    config: dict


class CloneRequest(BaseModel):
    workspace_id: UUID


class CloneResponse(BaseModel):
    draft_id: str
    template_id: str
    template_name: str


def _to_response(t: ChatflowTemplate, *, include_config: bool = False) -> dict:
    cfg = t.config or {}
    nodes = cfg.get("nodes") if isinstance(cfg, dict) else None
    edges = cfg.get("edges") if isinstance(cfg, dict) else None
    payload = {
        "id": str(t.id),
        "name": t.name,
        "slug": t.slug,
        "description": t.description,
        "category": t.category,
        "icon": t.icon,
        "tags": t.tags or [],
        "use_count": t.use_count,
        "node_count": len(nodes) if isinstance(nodes, list) else 0,
        "edge_count": len(edges) if isinstance(edges, list) else 0,
    }
    if include_config:
        payload["config"] = cfg
    return payload


@router.get("", response_model=list[TemplateResponse])
async def list_templates(
    category: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _user_context: UserContext = Depends(get_current_user_with_org),
):
    """List public templates (optionally filtered by category)."""
    query = db.query(ChatflowTemplate).filter(ChatflowTemplate.is_public == True)  # noqa: E712
    if category:
        query = query.filter(ChatflowTemplate.category == category)
    rows = query.order_by(ChatflowTemplate.use_count.desc(), ChatflowTemplate.name.asc()).all()
    return [_to_response(t) for t in rows]


@router.get("/{template_id}", response_model=TemplateDetailResponse)
async def get_template(
    template_id: UUID,
    db: Session = Depends(get_db),
    _user_context: UserContext = Depends(get_current_user_with_org),
):
    template = db.query(ChatflowTemplate).filter(
        ChatflowTemplate.id == template_id,
        ChatflowTemplate.is_public == True,  # noqa: E712
    ).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return _to_response(template, include_config=True)


@router.post("/{template_id}/clone", response_model=CloneResponse)
async def clone_template(
    template_id: UUID,
    request: CloneRequest,
    db: Session = Depends(get_db),
    user_context: UserContext = Depends(get_current_user_with_org),
):
    """Materialize a template into a chatflow draft owned by the workspace."""
    current_user, org_id, _ = user_context

    template = db.query(ChatflowTemplate).filter(
        ChatflowTemplate.id == template_id,
        ChatflowTemplate.is_public == True,  # noqa: E712
    ).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    # Workspace must belong to the active org.
    workspace = db.query(Workspace).filter(
        Workspace.id == request.workspace_id,
        Workspace.organization_id == org_id,
    ).first()
    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this workspace.",
        )

    # Build the draft data — copy the template config + give it a starter
    # name. The user can rename in the builder.
    draft_data = dict(template.config or {})
    draft_data.setdefault("name", template.name)
    draft_data.setdefault("description", template.description or "")

    draft_id = draft_service.create_draft(
        draft_type=DraftType.CHATFLOW,
        workspace_id=request.workspace_id,
        created_by=current_user.id,
        initial_data=draft_data,
    )

    # Soft analytics: bump after a successful clone.
    template.use_count = (template.use_count or 0) + 1
    db.commit()

    return CloneResponse(
        draft_id=draft_id,
        template_id=str(template.id),
        template_name=template.name,
    )
