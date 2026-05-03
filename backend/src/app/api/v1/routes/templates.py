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

import re
from typing import Optional, Tuple
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.v1.dependencies import get_current_user_with_org, get_staff_user
from app.db.session import get_db
from app.models.chatflow import Chatflow
from app.models.chatflow_template import ChatflowTemplate
from app.models.user import User
from app.models.workspace import Workspace
from app.services.draft_service import DraftType, draft_service
from app.services.slug_service import slug_service


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


# ─────────────────────────────────────────────────────────────────────────
# Admin (staff-only) endpoints
#
# CRITICAL ORDERING: literal /admin* routes MUST be declared BEFORE the
# parametric /{template_id} routes below. FastAPI matches routes in
# registration order, so a request to /admin would otherwise be parsed
# as `/{template_id}` with template_id="admin" and 422 on UUID parsing.
#
# Templates are global, marketplace-curated assets. Any staff can edit or
# delete any template (including seed templates with `created_by=NULL`) —
# `is_staff` is already a high bar; restricting to creator-only would block
# fixing typos in seeds. Staff curate; non-staff only consume via /clone.
# ─────────────────────────────────────────────────────────────────────────

_SLUG_RE = re.compile(r"[^a-z0-9]+")


def _slugify(value: str) -> str:
    s = _SLUG_RE.sub("-", value.lower()).strip("-")
    s = re.sub(r"-{2,}", "-", s)
    return s[:150] or "template"


def _ensure_unique_slug(
    db: Session,
    base: str,
    *,
    exclude_id: Optional[UUID] = None,
) -> str:
    base = base or "template"
    candidate = base
    n = 1
    while True:
        q = db.query(ChatflowTemplate).filter(ChatflowTemplate.slug == candidate)
        if exclude_id:
            q = q.filter(ChatflowTemplate.id != exclude_id)
        if not q.first():
            return candidate
        n += 1
        candidate = f"{base}-{n}"[:150]


def _sanitize_promoted_config(config: dict) -> dict:
    """Strip workspace-bound IDs from a chatflow config so a clone forces
    the new workspace owner to reselect them. Without this, promoted
    templates carry references to KBs and credentials that don't exist in
    the cloning workspace, and the chatflow silently breaks at runtime.
    """
    cfg = dict(config or {})
    nodes = cfg.get("nodes")
    if isinstance(nodes, list):
        cleaned = []
        for n in nodes:
            n2 = dict(n)
            data = dict(n2.get("data") or {})
            inner = dict(data.get("config") or {})
            for k in ("kb_id", "credential_id", "crm_credential_id"):
                if k in inner:
                    inner[k] = ""
            data["config"] = inner
            n2["data"] = data
            cleaned.append(n2)
        cfg["nodes"] = cleaned
    return cfg


def _to_admin_response(t: ChatflowTemplate) -> dict:
    base = _to_response(t, include_config=True)
    base.update({
        "is_public": t.is_public,
        "created_by": str(t.created_by) if t.created_by else None,
        "created_at": t.created_at.isoformat() if t.created_at else None,
        "updated_at": t.updated_at.isoformat() if t.updated_at else None,
    })
    return base


class AdminTemplateResponse(TemplateDetailResponse):
    is_public: bool
    created_by: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class TemplateCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=150)
    slug: Optional[str] = Field(None, max_length=150)
    description: Optional[str] = None
    category: Optional[str] = Field(None, max_length=50)
    icon: Optional[str] = Field(None, max_length=50)
    tags: list[str] = []
    config: dict
    is_public: bool = False


class TemplateUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=150)
    slug: Optional[str] = Field(None, max_length=150)
    description: Optional[str] = None
    category: Optional[str] = Field(None, max_length=50)
    icon: Optional[str] = Field(None, max_length=50)
    tags: Optional[list[str]] = None
    config: Optional[dict] = None
    is_public: Optional[bool] = None
    # use_count is intentionally NOT exposed.


class PromoteFromChatflowRequest(BaseModel):
    chatflow_id: UUID
    name: Optional[str] = None
    slug: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    icon: Optional[str] = None
    tags: list[str] = []
    is_public: bool = False


@router.get("/admin", response_model=list[AdminTemplateResponse])
async def admin_list_templates(
    db: Session = Depends(get_db),
    _staff: User = Depends(get_staff_user),
):
    """List ALL templates (public + unlisted) for staff curation."""
    rows = db.query(ChatflowTemplate).order_by(ChatflowTemplate.name.asc()).all()
    return [_to_admin_response(t) for t in rows]


@router.post("/admin", response_model=AdminTemplateResponse, status_code=status.HTTP_201_CREATED)
async def admin_create_template(
    request: TemplateCreateRequest,
    db: Session = Depends(get_db),
    staff: User = Depends(get_staff_user),
):
    """Create a template from scratch with raw config JSON."""
    base_slug = request.slug or _slugify(request.name)
    if request.slug:
        ok, err = slug_service.validate_slug_format(base_slug)
        if not ok:
            raise HTTPException(status_code=400, detail=err)
    final_slug = _ensure_unique_slug(db, base_slug)

    row = ChatflowTemplate(
        name=request.name,
        slug=final_slug,
        description=request.description,
        category=request.category,
        icon=request.icon,
        tags=request.tags or [],
        config=request.config or {},
        is_public=request.is_public,
        use_count=0,
        created_by=staff.id,
    )
    db.add(row)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Slug collision — try again.")
    db.refresh(row)
    return _to_admin_response(row)


@router.post(
    "/admin/from-chatflow",
    response_model=AdminTemplateResponse,
    status_code=status.HTTP_201_CREATED,
)
async def admin_promote_chatflow(
    request: PromoteFromChatflowRequest,
    db: Session = Depends(get_db),
    staff: User = Depends(get_staff_user),
):
    """Promote a deployed chatflow into a marketplace template.

    Drafts are rejected — their configs are unstable. Workspace-bound IDs
    (kb_id, credential_id, crm_credential_id) are sanitized to empty
    strings so cloners are forced to reselect them.
    """
    cf = db.query(Chatflow).filter(
        Chatflow.id == request.chatflow_id,
        Chatflow.is_deleted == False,  # noqa: E712
    ).first()
    if not cf:
        raise HTTPException(status_code=404, detail="Chatflow not found")
    if not cf.deployed_at:
        raise HTTPException(
            status_code=400,
            detail="Only deployed chatflows can be promoted to templates.",
        )

    name = request.name or cf.name
    base_slug = request.slug or _slugify(name)
    if request.slug:
        ok, err = slug_service.validate_slug_format(base_slug)
        if not ok:
            raise HTTPException(status_code=400, detail=err)
    final_slug = _ensure_unique_slug(db, base_slug)

    config = _sanitize_promoted_config(cf.config or {})

    row = ChatflowTemplate(
        name=name,
        slug=final_slug,
        description=request.description or cf.description,
        category=request.category,
        icon=request.icon,
        tags=request.tags or [],
        config=config,
        is_public=request.is_public,
        use_count=0,
        created_by=staff.id,
    )
    db.add(row)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Slug collision — try again.")
    db.refresh(row)
    return _to_admin_response(row)


@router.patch("/admin/{template_id}", response_model=AdminTemplateResponse)
async def admin_update_template(
    template_id: UUID,
    request: TemplateUpdateRequest,
    db: Session = Depends(get_db),
    _staff: User = Depends(get_staff_user),
):
    t = db.query(ChatflowTemplate).filter(ChatflowTemplate.id == template_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Template not found")

    data = request.model_dump(exclude_unset=True)
    if "slug" in data and data["slug"] is not None:
        ok, err = slug_service.validate_slug_format(data["slug"])
        if not ok:
            raise HTTPException(status_code=400, detail=err)
        data["slug"] = _ensure_unique_slug(db, data["slug"], exclude_id=t.id)

    for k, v in data.items():
        setattr(t, k, v)
    db.commit()
    db.refresh(t)
    return _to_admin_response(t)


@router.delete("/admin/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def admin_delete_template(
    template_id: UUID,
    db: Session = Depends(get_db),
    _staff: User = Depends(get_staff_user),
):
    t = db.query(ChatflowTemplate).filter(ChatflowTemplate.id == template_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Template not found")
    db.delete(t)
    db.commit()
    return None


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


# Admin endpoints are registered ABOVE @router.get("/{template_id}") to avoid
# FastAPI matching "admin" as a UUID for the parametric route. See discord
# webhook for the same pattern. End-of-file is intentionally minimal here.
