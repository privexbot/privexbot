"""
Billing & Usage routes.

WHY:
- Surface plan limits + live usage for the dashboard.
- Provide a manual upgrade path (staff-only) until Stripe is wired up.

Auth: every endpoint resolves the active org via `get_current_user_with_org`
and returns data scoped to that org.
"""

from typing import Tuple
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.v1.dependencies import get_current_user_with_org
from app.core.plans import PLAN_LIMITS
from app.db.session import get_db
from app.models.user import User
from app.services import billing_service


router = APIRouter(prefix="/billing", tags=["billing"])

UserContext = Tuple[User, str, str]


class UpgradeRequest(BaseModel):
    tier: str


@router.get("/plan")
async def get_plan(
    db: Session = Depends(get_db),
    user_context: UserContext = Depends(get_current_user_with_org),
):
    """Plan + live usage for the active org."""
    _user, org_id, _ = user_context
    try:
        return billing_service.get_plan_status(db, UUID(org_id))
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/plans")
async def list_plans(
    _user_context: UserContext = Depends(get_current_user_with_org),
):
    """All plan tiers with limits + pricing metadata (for the upgrade UI)."""
    return billing_service.list_plans()


@router.get("/public-plans")
async def list_public_plans():
    """Public plan tiers — same payload as /plans but no auth required.

    Used by the marketing pricing page so it stays in sync with
    `core/plans.py` without hardcoding. Safe to expose: the response
    contains only static tier metadata (label, price, limits, tagline).
    """
    return billing_service.list_plans()


@router.get("/usage")
async def get_usage(
    db: Session = Depends(get_db),
    user_context: UserContext = Depends(get_current_user_with_org),
):
    """Lighter endpoint: just the usage numbers, no plan info."""
    _user, org_id, _ = user_context
    return billing_service.get_current_usage(db, UUID(org_id))


@router.post("/upgrade")
async def upgrade_plan(
    request: UpgradeRequest,
    db: Session = Depends(get_db),
    user_context: UserContext = Depends(get_current_user_with_org),
):
    """Manual upgrade — staff-only until Stripe self-serve lands.

    Non-staff callers get a 402-ish response pointing to support.
    """
    current_user, org_id, _ = user_context

    if request.tier not in PLAN_LIMITS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown tier: {request.tier}",
        )

    if not getattr(current_user, "is_staff", False):
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=(
                "Self-serve checkout is not yet enabled. Please contact "
                "privexbot@gmail.com to upgrade your plan."
            ),
        )

    try:
        billing_service.upgrade_org_to_tier(db, UUID(org_id), request.tier)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return billing_service.get_plan_status(db, UUID(org_id))
