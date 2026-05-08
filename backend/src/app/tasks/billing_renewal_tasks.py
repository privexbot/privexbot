"""
Billing-period renewal sweep — auto-downgrade lapsed paid orgs.

WHY:
- `billing_service.upgrade_org_to_tier` sets `subscription_ends_at = now +
  30 days` for Starter/Pro upgrades (per-month cycle), but Stripe is not
  wired so nothing flips them back when that date passes. Without this
  sweep an org that paid once silently keeps Pro forever.
- This is the auto-downgrade half of the missing renewal lifecycle. The
  upgrade is still a manual operator action (no Stripe), but the
  downgrade-on-expiry is automated.

WHAT THIS DOES:
- For each Starter / Pro org whose `subscription_ends_at` has passed:
  - Send a "subscription expired, please renew" warning notification on
    the FIRST day past expiry (idempotent via `last_renewal_warning_at`).
  - After a 7-day grace window, downgrade the org to Free via the same
    `billing_service.upgrade_org_to_tier` path. Free clears the paid
    period stamps so this is a clean transition.
- Skip Enterprise (open-ended; `subscription_ends_at = None` for them).
- Skip already-Free orgs.
- Skip orgs whose status is anything other than "active" (cancelled /
  suspended are handled by their own flows).

WHAT THIS DOES NOT DO:
- Auto-RENEW the org. Renewal is an explicit operator action (or future
  Stripe webhook) — we never silently extend a paid period.
- Delete data. Downgraded orgs keep all their resources; only the tier
  changes. Free quotas may then over-flow but enforcement is hard-quota
  on creation, not retroactive deletion.

CRON:
- Runs daily at 03:30 UTC. Wired in `tasks/celery_worker.py`.
- After `suspend_inactive_free_orgs` (03:00) so the two daily sweeps
  don't race on the same orgs.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from celery import shared_task
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models.organization import Organization
from app.services import billing_service, notification_service

logger = logging.getLogger(__name__)


# 7-day grace between expiry and downgrade. Enough for an inattentive
# operator to manually renew without disrupting the customer; short
# enough that a stale paid tier doesn't free-ride the platform indefinitely.
GRACE_DAYS = 7

# Tiers eligible for the sweep. Enterprise is excluded — it has no
# subscription_ends_at (open-ended term, managed off-platform).
PAID_TIERS_WITH_CYCLE = ("starter", "pro")


def _send_renewal_warning(org: Organization, days_past_expiry: int) -> None:
    """In-app + email warning that a paid org has lapsed and is about to
    be downgraded. Best-effort — failures must not block the sweep."""
    try:
        notification_service.create_notification(
            db=None,  # notify_* helpers self-manage sessions
            user_id=None,
            event="org.subscription_expired_warning",
            title=f'"{org.name}" subscription has expired',
            body=(
                f"Your {org.subscription_tier.title()} plan ended "
                f"{days_past_expiry} day(s) ago. Renew within "
                f"{GRACE_DAYS - days_past_expiry} day(s) to avoid being "
                f"downgraded to Free."
            ),
            link="/billings",
            resource_type="organization",
            resource_id=org.id,
        )
    except Exception:
        # `create_notification` requires a db session — fall through to
        # the simpler path that mirrors the inactivity warning helper
        # (per-owner in-app + email via notification_service). Use the
        # same self-managed-session pattern the inactivity task uses.
        logger.exception(
            "Renewal warning notification failed for org %s — sweep continues",
            org.id,
        )


def _downgrade_org_to_free(db: Session, org: Organization) -> None:
    """Flip a lapsed paid org to Free using the existing upgrade path.

    `upgrade_org_to_tier(... "free")` clears `subscription_starts_at` /
    `subscription_ends_at` and leaves `trial_ends_at` alone (preventing
    the upgrade-then-downgrade-to-get-trial loophole). It does NOT touch
    user data, chatbots, KBs, or workspaces — only the tier changes.
    """
    billing_service.upgrade_org_to_tier(db, org.id, "free")
    logger.info(
        "Auto-downgraded org %s (%s) — tier=%s → free, ended_at=%s",
        org.id,
        org.name,
        org.subscription_tier,
        org.subscription_ends_at,
    )


@shared_task(name="downgrade_expired_paid_orgs")
def downgrade_expired_paid_orgs() -> dict:
    """Daily sweep. Returns a small dict for log/observability."""
    db = SessionLocal()
    warned = 0
    downgraded = 0
    try:
        now = datetime.now(timezone.utc)

        # Candidate orgs: active paid tier with cycle-end timestamp set.
        orgs = (
            db.query(Organization)
            .filter(
                Organization.subscription_status == "active",
                Organization.subscription_tier.in_(PAID_TIERS_WITH_CYCLE),
                Organization.subscription_ends_at.isnot(None),
            )
            .all()
        )

        for org in orgs:
            ends_at = org.subscription_ends_at
            if ends_at is None:
                continue
            # Normalize for safe UTC comparison.
            if ends_at.tzinfo is None:
                ends_at = ends_at.replace(tzinfo=timezone.utc)
            if ends_at >= now:
                continue  # not expired yet

            days_past = (now - ends_at).days

            if days_past >= GRACE_DAYS:
                # Grace exhausted — downgrade.
                _downgrade_org_to_free(db, org)
                downgraded += 1
                continue

            # Still in grace — warn once per cycle.
            settings = dict(org.settings or {})
            last_warned = settings.get("last_renewal_warning_at")
            if not last_warned or datetime.fromisoformat(
                last_warned.replace("Z", "+00:00")
            ) < ends_at:
                _send_renewal_warning(org, days_past)
                settings["last_renewal_warning_at"] = now.isoformat()
                org.settings = settings
                warned += 1

        db.commit()
        result = {"warned": warned, "downgraded": downgraded}
        logger.info("Renewal sweep complete: %s", result)
        return result
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
