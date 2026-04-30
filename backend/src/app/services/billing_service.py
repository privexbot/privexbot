"""
Billing service — usage aggregation + plan limits enforcement.

WHY:
- Centralize the math the dashboard and quota-check call sites rely on.
- Read-only against existing tables (no new aggregation table this round).

The org-wide `subscription_tier` lives on `Organization` (already there at
`models/organization.py:89-95`). Plan *limits* live in `core/plans.py`. This
service joins them with live counts.
"""

from datetime import datetime, timezone
from typing import Literal, Optional
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.plans import PLAN_LIMITS, PLAN_METADATA, get_limits, is_unlimited
from app.models.chat_message import ChatMessage
from app.models.chat_session import ChatSession
from app.models.chatbot import Chatbot, ChatbotStatus
from app.models.chatflow import Chatflow
from app.models.document import Document
from app.models.knowledge_base import KnowledgeBase
from app.models.organization import Organization
from app.models.organization_member import OrganizationMember
from app.models.workspace import Workspace


ResourceKey = Literal[
    "chatbots",
    "chatflows",
    "kb_documents",
    "messages_per_month",
    "api_calls_per_month",
    "team_members",
]


def _start_of_month_utc() -> datetime:
    now = datetime.now(timezone.utc)
    return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


def _workspace_ids_for_org(db: Session, org_id: UUID) -> list[UUID]:
    return [
        row.id
        for row in db.query(Workspace.id)
        .filter(Workspace.organization_id == org_id)
        .all()
    ]


def get_current_usage(db: Session, org_id: UUID) -> dict[str, int]:
    """Live counts for the org. Cheap aggregations against existing tables.

    Counts are org-scoped (across every workspace the org owns) because
    plan limits are billed at the org level (`Organization.subscription_tier`).
    """
    workspace_ids = _workspace_ids_for_org(db, org_id)
    if not workspace_ids:
        return {
            "chatbots": 0,
            "chatflows": 0,
            "kb_documents": 0,
            "messages_this_month": 0,
            "api_calls_this_month": 0,
            "team_members": 0,
        }

    # Chatbots have a `status` enum (no `is_deleted`) — count anything that
    # isn't archived. Chatflows do have `is_deleted`.
    chatbots = (
        db.query(func.count(Chatbot.id))
        .filter(
            Chatbot.workspace_id.in_(workspace_ids),
            Chatbot.status != ChatbotStatus.ARCHIVED,
        )
        .scalar()
        or 0
    )
    chatflows = (
        db.query(func.count(Chatflow.id))
        .filter(Chatflow.workspace_id.in_(workspace_ids), Chatflow.is_deleted == False)  # noqa: E712
        .scalar()
        or 0
    )
    kb_documents = (
        db.query(func.count(Document.id))
        .join(KnowledgeBase, Document.kb_id == KnowledgeBase.id)
        .filter(KnowledgeBase.workspace_id.in_(workspace_ids))
        .scalar()
        or 0
    )

    month_start = _start_of_month_utc()
    messages_this_month = (
        db.query(func.count(ChatMessage.id))
        .filter(
            ChatMessage.workspace_id.in_(workspace_ids),
            ChatMessage.created_at >= month_start,
        )
        .scalar()
        or 0
    )

    # API calls = chat sessions opened this month is the closest cheap signal.
    # Replace with a dedicated counter if/when we add one.
    api_calls_this_month = (
        db.query(func.count(ChatSession.id))
        .filter(
            ChatSession.workspace_id.in_(workspace_ids),
            ChatSession.created_at >= month_start,
        )
        .scalar()
        or 0
    )

    team_members = (
        db.query(func.count(OrganizationMember.id))
        .filter(OrganizationMember.organization_id == org_id)
        .scalar()
        or 0
    )

    return {
        "chatbots": int(chatbots),
        "chatflows": int(chatflows),
        "kb_documents": int(kb_documents),
        "messages_this_month": int(messages_this_month),
        "api_calls_this_month": int(api_calls_this_month),
        "team_members": int(team_members),
    }


def _percent_used(usage: int, limit: int) -> Optional[float]:
    if is_unlimited(limit):
        return None
    if limit == 0:
        return 100.0
    return round(min(usage / limit, 1.0) * 100, 1)


def get_plan_status(db: Session, org_id: UUID) -> dict:
    """Plan + usage roll-up for the dashboard."""
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise ValueError(f"Organization not found: {org_id}")

    tier = (org.subscription_tier or "free").lower()
    limits = get_limits(tier)
    usage = get_current_usage(db, org_id)

    # Map usage keys -> limit keys (some names differ for clarity).
    usage_for_limits = {
        "chatbots": usage["chatbots"],
        "chatflows": usage["chatflows"],
        "kb_documents": usage["kb_documents"],
        "messages_per_month": usage["messages_this_month"],
        "api_calls_per_month": usage["api_calls_this_month"],
        "team_members": usage["team_members"],
    }

    breakdown = {
        key: {
            "usage": usage_for_limits[key],
            "limit": limits[key],
            "unlimited": is_unlimited(limits[key]),
            "percent_used": _percent_used(usage_for_limits[key], limits[key]),
        }
        for key in limits.keys()
    }

    # Free is free forever — never advertise a trial expiry on a free org,
    # even if `trial_ends_at` was stamped at creation time. Higher tiers
    # report whatever the org row says.
    is_free = tier == "free"
    status_value = "active" if is_free else (org.subscription_status or "active")
    trial_ends_at = None if is_free else (
        org.trial_ends_at.isoformat() if org.trial_ends_at else None
    )

    return {
        "tier": tier,
        "label": PLAN_METADATA.get(tier, {}).get("label", tier.title()),
        "status": status_value,
        "trial_ends_at": trial_ends_at,
        "subscription_starts_at": org.subscription_starts_at.isoformat() if org.subscription_starts_at else None,
        "subscription_ends_at": org.subscription_ends_at.isoformat() if org.subscription_ends_at else None,
        "limits": limits,
        "usage": usage,
        "breakdown": breakdown,
    }


def list_plans() -> list[dict]:
    """All plan tiers with limits + display metadata for the upgrade UI."""
    return [
        {
            "tier": tier,
            **PLAN_METADATA.get(tier, {}),
            "limits": limits,
        }
        for tier, limits in PLAN_LIMITS.items()
    ]


def check_quota(
    db: Session,
    org_id: UUID,
    resource: ResourceKey,
) -> tuple[bool, int]:
    """Return (allowed, remaining_or_minus_one).

    `remaining` is the count of further resources the org may create. -1
    means unlimited.
    """
    status = get_plan_status(db, org_id)
    breakdown = status["breakdown"][resource]
    if breakdown["unlimited"]:
        return True, -1
    remaining = max(0, breakdown["limit"] - breakdown["usage"])
    return remaining > 0, remaining


def upgrade_org_to_tier(db: Session, org_id: UUID, tier: str) -> Organization:
    """Move the org to a new tier (admin / staff path; no Stripe yet)."""
    if tier not in PLAN_LIMITS:
        raise ValueError(f"Unknown tier: {tier}")
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise ValueError(f"Organization not found: {org_id}")
    org.subscription_tier = tier
    org.subscription_status = "active"
    org.subscription_starts_at = datetime.utcnow()
    db.commit()
    db.refresh(org)
    return org
