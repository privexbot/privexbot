"""
Free-tier inactivity suspension.

WHY:
- Free orgs that haven't been touched in 30 days are abandoned. Keeping
  their bots live consumes vector-store storage, indexed credentials, and
  scheduled-job slots indefinitely.
- A 30-day grace with a 7-day warning is a forgiving balance between
  reclaiming resources and not surprising real but quiet indie users.

WHAT THIS DOES:
- Computes `last_activity_at` for every Free-tier org.
- At 23 days idle: send a one-time warning email "Your account will be
  paused in 7 days unless you log in or send a message."
- At 30 days idle: set `Organization.subscription_status = 'suspended'`.
  The dependency `get_current_user_with_org` already pays attention to
  status, so suspended orgs see a banner; their public bots return a
  fixed "owner inactive" reply via `chatbot_service` / `chatflow_service`.

WHAT THIS DOES NOT DO:
- Delete data. Suspension is reversible — any user activity (login or
  inbound message) sets status back to 'active' and resets the clock.
- Touch paid tiers. Starter/Pro/Enterprise have `inactivity_suspend_days
  = -1`, which we treat as "never auto-suspend."

CRON:
- Runs daily at 02:00 UTC (off-peak). Wired in `tasks/celery_worker.py`.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

from celery import shared_task
from sqlalchemy import func

from app.core.plans import get_features
from app.db.session import SessionLocal
from app.models.chat_message import ChatMessage
from app.models.organization import Organization
from app.models.user import User
from app.models.organization_member import OrganizationMember
from app.models.workspace import Workspace

logger = logging.getLogger(__name__)


WARNING_DAYS = 23   # email at 23 days idle (7 days before suspension)
SUSPEND_DAYS = 30   # suspend at 30 days idle


def _last_activity_at(db, org_id: UUID) -> Optional[datetime]:
    """Most recent of: a member's last_login_at, or any chat message in
    any workspace owned by this org. None means we have no activity
    record at all (fresh org or pre-cleanup data)."""
    member_ids = [
        row[0]
        for row in db.query(OrganizationMember.user_id)
        .filter(OrganizationMember.organization_id == org_id)
        .all()
    ]
    last_login = None
    if member_ids:
        last_login = (
            db.query(func.max(User.last_login_at))
            .filter(User.id.in_(member_ids))
            .scalar()
        )

    workspace_ids = [
        row[0]
        for row in db.query(Workspace.id)
        .filter(Workspace.organization_id == org_id)
        .all()
    ]
    last_message = None
    if workspace_ids:
        last_message = (
            db.query(func.max(ChatMessage.created_at))
            .filter(ChatMessage.workspace_id.in_(workspace_ids))
            .scalar()
        )

    candidates = [t for t in (last_login, last_message) if t is not None]
    if not candidates:
        # Fall back to org creation time so we don't suspend brand-new
        # orgs whose only "activity" is signup itself.
        return None
    return max(candidates)


def _send_warning_email(org: Organization, days_idle: int) -> None:
    """Best-effort email warning. Notification service does the actual
    delivery; we just record the intent so we don't double-send."""
    try:
        from app.services import notification_service

        # Email the org owner (first member with role=owner, fallback to
        # creator). Subject is short — anything more verbose lands in spam.
        notification_service.notify_org_inactivity_warning(
            org_id=org.id,
            org_name=org.name,
            days_idle=days_idle,
            days_until_suspend=SUSPEND_DAYS - days_idle,
        )
    except Exception as exc:
        logger.warning(
            "Inactivity warning email failed for org %s: %s",
            org.id,
            exc,
        )


@shared_task(name="suspend_inactive_free_orgs")
def suspend_inactive_free_orgs() -> dict:
    """Daily sweep. Returns a small dict for log/observability."""
    db = SessionLocal()
    warned = 0
    suspended = 0
    try:
        now = datetime.now(timezone.utc)
        warning_cutoff = now - timedelta(days=WARNING_DAYS)
        suspend_cutoff = now - timedelta(days=SUSPEND_DAYS)

        # Free-tier orgs that aren't already suspended.
        orgs = (
            db.query(Organization)
            .filter(
                Organization.subscription_tier == "free",
                Organization.subscription_status != "suspended",
            )
            .all()
        )

        for org in orgs:
            tier = (org.subscription_tier or "free").lower()
            inactivity_days = get_features(tier).get(
                "inactivity_suspend_days", -1
            )
            if not isinstance(inactivity_days, int) or inactivity_days < 0:
                continue

            last_activity = _last_activity_at(db, org.id)
            if last_activity is None:
                # No real activity yet — use created_at as the floor.
                last_activity = org.created_at
            if last_activity is None:
                continue

            # Normalize to UTC-aware for safe comparison.
            if last_activity.tzinfo is None:
                last_activity = last_activity.replace(tzinfo=timezone.utc)

            if last_activity <= suspend_cutoff:
                org.subscription_status = "suspended"
                suspended += 1
                logger.info(
                    "Suspended free-tier org %s (last_activity=%s)",
                    org.id,
                    last_activity.isoformat(),
                )
            elif last_activity <= warning_cutoff:
                # 7 days before suspension — warn once. Dedupe via the
                # `org.settings.last_inactivity_warning_at` JSONB field.
                settings = dict(org.settings or {})
                last_warned = settings.get("last_inactivity_warning_at")
                if not last_warned or datetime.fromisoformat(
                    last_warned.replace("Z", "+00:00")
                ) < warning_cutoff:
                    days_idle = (now - last_activity).days
                    _send_warning_email(org, days_idle)
                    settings["last_inactivity_warning_at"] = now.isoformat()
                    org.settings = settings
                    warned += 1

        db.commit()
        result = {"warned": warned, "suspended": suspended}
        logger.info("Inactivity sweep complete: %s", result)
        return result
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
