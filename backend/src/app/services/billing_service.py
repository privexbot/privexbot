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

from app.core.plans import (
    PLAN_LIMITS,
    PLAN_METADATA,
    PLAN_FEATURES,
    ANNUAL_DISCOUNT,
    SOFT_DEGRADE_THRESHOLD,
    ENFORCEMENT_POLICY,
    get_limits,
    get_features,
    is_unlimited,
)
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
    "knowledge_bases",
    "kb_documents",
    "web_pages_per_month",
    "messages_per_month",
    "api_calls_per_month",
    "team_members",
    "workspaces",
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
            "knowledge_bases": 0,
            "kb_documents": 0,
            "web_pages_this_month": 0,
            "messages_this_month": 0,
            "api_calls_this_month": 0,
            "team_members": 0,
            "workspaces": 0,
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
    knowledge_bases = (
        db.query(func.count(KnowledgeBase.id))
        .filter(KnowledgeBase.workspace_id.in_(workspace_ids))
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

    # Web pages scraped this month — count documents whose source_type is
    # `web_scraping` and were created this month. The count is per-page,
    # not per-crawl-job, since each scraped page becomes one Document row.
    web_pages_this_month = (
        db.query(func.count(Document.id))
        .join(KnowledgeBase, Document.kb_id == KnowledgeBase.id)
        .filter(
            KnowledgeBase.workspace_id.in_(workspace_ids),
            Document.source_type == "web_scraping",
            Document.created_at >= month_start,
        )
        .scalar()
        or 0
    )

    workspaces = len(workspace_ids)

    return {
        "chatbots": int(chatbots),
        "chatflows": int(chatflows),
        "knowledge_bases": int(knowledge_bases),
        "kb_documents": int(kb_documents),
        "web_pages_this_month": int(web_pages_this_month),
        "messages_this_month": int(messages_this_month),
        "api_calls_this_month": int(api_calls_this_month),
        "team_members": int(team_members),
        "workspaces": int(workspaces),
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
        "knowledge_bases": usage["knowledge_bases"],
        "kb_documents": usage["kb_documents"],
        "web_pages_per_month": usage["web_pages_this_month"],
        "messages_per_month": usage["messages_this_month"],
        "api_calls_per_month": usage["api_calls_this_month"],
        "team_members": usage["team_members"],
        "workspaces": usage["workspaces"],
    }

    # `owned_orgs` is a per-USER cap (counted across all orgs they own),
    # not a per-org metric — the per-org `get_plan_status` doesn't have a
    # meaningful "usage" for it. Skip it here; enforcement lives in
    # `tenant_service.create_organization` via `require_owned_orgs_quota`,
    # which derives usage from the creator's user id directly.
    breakdown = {
        key: {
            "usage": usage_for_limits[key],
            "limit": limits[key],
            "unlimited": is_unlimited(limits[key]),
            "percent_used": _percent_used(usage_for_limits[key], limits[key]),
        }
        for key in limits.keys()
        if key in usage_for_limits
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
    """All plan tiers with limits + features + display metadata for the
    upgrade UI and the public Pricing page comparison table."""
    return [
        {
            "tier": tier,
            **PLAN_METADATA.get(tier, {}),
            "limits": limits,
            "features": PLAN_FEATURES.get(tier, {}),
            "annual_discount": ANNUAL_DISCOUNT,
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


def require_quota(
    db: Session,
    org_id: UUID,
    resource: ResourceKey,
) -> None:
    """Raise HTTP 402 (Payment Required) when the org is at-or-over the
    quota for `resource`. Use this at the entry point of any "create"
    handler to short-circuit before any DB writes.

    The 402 detail payload is structured so the frontend's api-client can
    auto-render the upgrade modal:

        {
            "error": "quota_exceeded",
            "resource": "chatbots",
            "tier": "free",
            "limit": 1,
            "usage": 1,
            "upgrade_url": "/billings"
        }

    Soft-degrade resources (messages_per_month, api_calls_per_month) are
    NOT enforced here — those route through `is_over_soft_degrade()` in
    chatbot/chatflow services, which keep the conversation alive but
    return a fixed reply once over 120% of cap.
    """
    from fastapi import HTTPException, status

    policy = ENFORCEMENT_POLICY.get(resource, "hard")
    if policy != "hard":
        # Soft-degrade resources are checked separately at message time.
        return

    plan_status = get_plan_status(db, org_id)
    breakdown = plan_status["breakdown"][resource]

    if breakdown["unlimited"] or breakdown["usage"] < breakdown["limit"]:
        return

    raise HTTPException(
        status_code=status.HTTP_402_PAYMENT_REQUIRED,
        detail={
            "error": "quota_exceeded",
            "resource": resource,
            "tier": plan_status["tier"],
            "limit": breakdown["limit"],
            "usage": breakdown["usage"],
            "upgrade_url": "/billings",
        },
    )


def require_feature(
    db: Session,
    org_id: UUID,
    feature: str,
) -> None:
    """Raise HTTP 402 when the feature is not enabled for the org's tier.

    Same payload shape as `require_quota` so the frontend handler is shared.
    """
    from fastapi import HTTPException, status

    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found",
        )
    tier = (org.subscription_tier or "free").lower()
    if bool(get_features(tier).get(feature)):
        return

    raise HTTPException(
        status_code=status.HTTP_402_PAYMENT_REQUIRED,
        detail={
            "error": "feature_locked",
            "feature": feature,
            "tier": tier,
            "upgrade_url": "/billings",
        },
    )


def is_over_soft_degrade(
    db: Session,
    org_id: UUID,
    resource: ResourceKey,
) -> bool:
    """For soft-degrade resources (messages, api_calls), return True when
    usage is >= 120% of the cap.

    Soft-degrade is the "stop running inference but still save the
    message" state. We don't kill a live conversation at exactly 100%
    because monthly cycle timing creates false-positive overruns; a 20%
    buffer absorbs that.

    PERFORMANCE: this is on the message hot-path. `get_plan_status` does
    a multi-table aggregation we don't want to run per-message at scale.
    Cache the boolean in Redis with a 60-second TTL — at the 120%
    threshold, a 60s stale window is acceptable. Redis failures are
    non-fatal; we fall back to the live query.
    """
    cache_key = f"billing:soft_degrade:{resource}:{org_id}"
    redis_client = None
    try:
        import redis as _redis
        from app.core.config import settings as _settings

        redis_client = _redis.from_url(_settings.REDIS_URL)
        cached = redis_client.get(cache_key)
        if cached is not None:
            value = cached.decode() if isinstance(cached, bytes) else cached
            return value == "1"
    except Exception:
        redis_client = None

    plan_status = get_plan_status(db, org_id)
    breakdown = plan_status["breakdown"].get(resource)
    if not breakdown or breakdown["unlimited"]:
        result = False
    else:
        limit = breakdown["limit"]
        if limit <= 0:
            result = False
        else:
            result = breakdown["usage"] >= int(limit * SOFT_DEGRADE_THRESHOLD)

    # Write-through cache so subsequent calls within 60s skip the
    # multi-table aggregation. Best-effort — never let cache write fail
    # the request path.
    if redis_client is not None:
        try:
            redis_client.setex(cache_key, 60, "1" if result else "0")
        except Exception:
            pass

    return result


def get_user_owned_orgs_count(db: Session, user_id: UUID) -> int:
    """Count orgs where this user is a member with role=owner.

    Used by the per-USER `owned_orgs` cap that prevents Free users from
    spawning unlimited free orgs to bypass per-org quotas.
    """
    return (
        db.query(func.count(OrganizationMember.organization_id))
        .filter(
            OrganizationMember.user_id == user_id,
            OrganizationMember.role == "owner",
        )
        .scalar()
        or 0
    )


# Tier ordering — higher index = higher tier. Used to compute the "best"
# tier across a user's owned orgs so an upgrade in any one org unlocks
# more `owned_orgs` headroom.
_TIER_RANK: dict[str, int] = {
    "free": 0,
    "starter": 1,
    "pro": 2,
    "enterprise": 3,
}


def get_user_effective_tier(db: Session, user_id: UUID) -> str:
    """Return the highest tier among orgs the user OWNS, or "free" if
    they own none yet (e.g. brand-new account during signup).
    """
    rows = (
        db.query(Organization.subscription_tier)
        .join(
            OrganizationMember,
            OrganizationMember.organization_id == Organization.id,
        )
        .filter(
            OrganizationMember.user_id == user_id,
            OrganizationMember.role == "owner",
        )
        .all()
    )
    tiers = [(r[0] or "free").lower() for r in rows]
    if not tiers:
        return "free"
    # Sort by rank; pick the highest. Unknown tiers fall to free (rank 0).
    return max(tiers, key=lambda t: _TIER_RANK.get(t, 0))


def require_owned_orgs_quota(db: Session, user_id: UUID) -> None:
    """Raise HTTP 402 if the user already owns the maximum number of
    orgs allowed by their effective tier.

    Called from `tenant_service.create_organization` BEFORE the org row
    is written so we never leave an orphan org or default workspace if
    the cap is hit.
    """
    from fastapi import HTTPException, status as _status

    tier = get_user_effective_tier(db, user_id)
    cap = get_limits(tier).get("owned_orgs", 1)
    if is_unlimited(cap):
        return

    count = get_user_owned_orgs_count(db, user_id)
    if count < cap:
        return

    raise HTTPException(
        status_code=_status.HTTP_402_PAYMENT_REQUIRED,
        detail={
            "error": "quota_exceeded",
            "resource": "owned_orgs",
            "tier": tier,
            "limit": cap,
            "usage": count,
            "upgrade_url": "/billings",
        },
    )


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
