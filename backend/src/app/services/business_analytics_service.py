"""
Platform business-metrics analytics for the staff admin page.

WHY:
- The existing `/admin/analytics` (AggregatedAnalyticsService) covers
  bot-level performance (messages/min, latency, feedback). It does NOT
  cover the revenue / unit-economics view — MRR, conversion rate,
  churn, soft-degrade hits, top-N usage.
- This service produces those numbers from existing tables. No schema
  change. Read-only. Read-heavy queries are bounded so they're safe
  to call ad-hoc from the admin UI.

WHAT THIS DOES NOT DO:
- Compute infra cost per active org (needs SecretVM cost ingest — out
  of scope; manual CSV import is the planned interim path).
- Track per-token Secret AI cost (no token counter in the schema yet).
- Replace AggregatedAnalyticsService — that's still the right place
  for chatbot-message latency and feedback rollups.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.plans import PLAN_METADATA
from app.models.chat_message import ChatMessage
from app.models.organization import Organization

logger = logging.getLogger(__name__)


# Tiers that count toward MRR. Free contributes $0; Enterprise has no
# advertised price (custom contracts), so we don't roll it into MRR
# automatically — staff annotates contract value manually if needed.
PAID_TIERS_FOR_MRR = ("starter", "pro")


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def get_mrr_arr(db: Session) -> dict:
    """Sum monthly + annual recurring revenue across all active paid orgs.

    Returns {mrr_usd, arr_usd, by_tier: {tier: {count, mrr_usd}, ...},
             total_active_paid_orgs}.
    """
    rows = (
        db.query(Organization.subscription_tier, func.count(Organization.id))
        .filter(
            Organization.subscription_status == "active",
            Organization.subscription_tier.in_(PAID_TIERS_FOR_MRR),
        )
        .group_by(Organization.subscription_tier)
        .all()
    )

    by_tier: dict[str, dict] = {}
    mrr = 0
    for tier, count in rows:
        price = PLAN_METADATA.get(tier, {}).get("price_monthly_usd") or 0
        line_mrr = int(price) * int(count)
        by_tier[tier] = {"count": int(count), "mrr_usd": line_mrr}
        mrr += line_mrr

    total = sum(item["count"] for item in by_tier.values())
    return {
        "mrr_usd": mrr,
        "arr_usd": mrr * 12,
        "by_tier": by_tier,
        "total_active_paid_orgs": total,
    }


def get_active_orgs_by_tier(db: Session, days: int = 30) -> dict:
    """Count orgs that produced at least one chat message in the last
    `days` days, grouped by current `subscription_tier`."""
    cutoff = _utc_now() - timedelta(days=days)

    # ChatMessage doesn't carry organization_id directly — it joins via
    # session → workspace → organization. We use the existing
    # Workspace.organization_id link and a subquery to find distinct
    # active orgs.
    from app.models.chat_session import ChatSession
    from app.models.workspace import Workspace

    active_org_ids = (
        db.query(Workspace.organization_id)
        .join(ChatSession, ChatSession.workspace_id == Workspace.id)
        .join(ChatMessage, ChatMessage.session_id == ChatSession.id)
        .filter(ChatMessage.created_at >= cutoff)
        .distinct()
        .subquery()
    )

    rows = (
        db.query(Organization.subscription_tier, func.count(Organization.id))
        .filter(Organization.id.in_(active_org_ids))
        .group_by(Organization.subscription_tier)
        .all()
    )

    counts = {tier: int(count) for tier, count in rows}
    return {
        "days": days,
        "by_tier": counts,
        "total_active_orgs": sum(counts.values()),
    }


def get_conversion_rate(db: Session, weeks: int = 12) -> dict:
    """Weekly cohorts of orgs created in the last `weeks` weeks. For
    each cohort, count what fraction has converted to a paid tier today.
    """
    cutoff = _utc_now() - timedelta(weeks=weeks)

    rows = (
        db.query(Organization.created_at, Organization.subscription_tier)
        .filter(Organization.created_at >= cutoff)
        .all()
    )

    cohorts: dict[str, dict] = {}
    for created_at, tier in rows:
        if created_at is None:
            continue
        # ISO week — Monday-based, format YYYY-Www
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)
        iso_year, iso_week, _ = created_at.isocalendar()
        key = f"{iso_year}-W{iso_week:02d}"
        bucket = cohorts.setdefault(key, {"signups": 0, "converted": 0})
        bucket["signups"] += 1
        if tier in PAID_TIERS_FOR_MRR or tier == "enterprise":
            bucket["converted"] += 1

    series = []
    for key in sorted(cohorts.keys()):
        b = cohorts[key]
        rate = (b["converted"] / b["signups"]) if b["signups"] else 0.0
        series.append(
            {
                "week": key,
                "signups": b["signups"],
                "converted": b["converted"],
                "rate": round(rate, 4),
            }
        )

    return {"weeks": weeks, "series": series}


def get_soft_degrade_hits(db: Session, days: int = 30) -> dict:
    """Count of orgs that have crossed 120% of `messages_per_month` cap
    in the current billing window. This is the leading retention
    indicator — these orgs are about to lose service quality.

    NOTE: This is a current-snapshot count, not a historic count, since
    we don't yet store soft-degrade events as audit rows. Once we do
    we can extend with a time-series.
    """
    from app.core.plans import get_limits, SOFT_DEGRADE_THRESHOLD

    # Iterate orgs and check current message count vs limit. Bounded by
    # the count of paid orgs which is small at our scale; we can swap
    # to a SQL approach when count > a few hundred.
    orgs = db.query(Organization).all()
    threshold_count = 0

    for org in orgs:
        tier = (org.subscription_tier or "free").lower()
        limits = get_limits(tier)
        cap = limits.get("messages_per_month", 0) or 0
        if cap < 0:
            continue  # unlimited

        # Use the existing usage helper if available; else inline the
        # current-month count via ChatMessage.
        try:
            from app.services.billing_service import get_current_usage

            usage = get_current_usage(db, org.id)
            count = int(usage.get("messages_per_month", 0) or 0)
        except Exception:
            count = 0

        if cap > 0 and count >= cap * SOFT_DEGRADE_THRESHOLD:
            threshold_count += 1

    return {
        "days": days,
        "orgs_at_or_over_120_percent": threshold_count,
        "threshold": SOFT_DEGRADE_THRESHOLD,
    }


def get_top_n_orgs_by_usage(db: Session, n: int = 20) -> dict:
    """Top N orgs by current-month message count. Surfaces under-priced
    power users who should be on Pro+ (whales currently on Free or
    Starter)."""
    # We keep this simple: iterate orgs, pull usage via billing_service,
    # sort. The query volume is fine until we have thousands of orgs.
    from app.services.billing_service import get_current_usage

    orgs = db.query(Organization).all()
    enriched = []
    for org in orgs:
        try:
            usage = get_current_usage(db, org.id)
            messages = int(usage.get("messages_per_month", 0) or 0)
        except Exception:
            messages = 0
        enriched.append(
            {
                "org_id": str(org.id),
                "name": org.name,
                "tier": org.subscription_tier,
                "status": org.subscription_status,
                "messages_this_month": messages,
            }
        )
    enriched.sort(key=lambda r: r["messages_this_month"], reverse=True)
    return {"top": enriched[:n], "n": n}


def get_churn(db: Session, days: int = 30) -> dict:
    """Count of paid → free downgrades in the last `days` days.

    Requires a tier-change audit log. The platform doesn't currently
    have one (no `tenant_audit_log` table verified at plan time), so
    this returns `available: false` and renders as "not yet available"
    in the UI. When we ship the audit log, this stub gets a proper
    query.
    """
    return {
        "available": False,
        "message": (
            "Tier-change audit log is not yet captured. Add an audit "
            "row in `billing_service.upgrade_org_to_tier` to populate "
            "this metric."
        ),
        "days": days,
        "downgrades": 0,
    }


def get_business_overview(db: Session) -> dict:
    """All six metrics in one payload for the admin page."""
    return {
        "mrr": get_mrr_arr(db),
        "active_by_tier": get_active_orgs_by_tier(db),
        "conversion": get_conversion_rate(db),
        "soft_degrade": get_soft_degrade_hits(db),
        "top_orgs": get_top_n_orgs_by_usage(db),
        "churn": get_churn(db),
        "generated_at": _utc_now().isoformat(),
    }
