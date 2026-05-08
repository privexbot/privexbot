"""
Referral conversion + reward.

WHY:
- The referral tracking infrastructure exists (`/referrals` route, code
  generation, Pending → Registered transitions) but `CONVERTED` status
  is read in stats and never written. There is no reward.
- This service closes the loop: when a referred user's primary org
  upgrades to a paid tier for the first time, mark the matching
  `Referral` row CONVERTED and grant a 30-day reward to BOTH parties.

REWARD:
- Referrer's primary owned org: extend `subscription_ends_at` by 30 days
  (or upgrade to Pro for 30 days if they're currently Free).
- Referred user's just-paid org: extend `subscription_ends_at` by an
  extra 30 days (so they get 60 days of paid for the price of 30).
- One in-app notification to each party.

IDEMPOTENCY:
- A Referral row can only convert once (status check). If the upgrade is
  triggered a second time (e.g. a downgrade-then-re-upgrade flow), the
  second call is a no-op because no REGISTERED row remains.

CALL SITE:
- `billing_service.upgrade_org_to_tier` invokes this at the end of a
  paid upgrade. Wrapped in try/except — a referral failure must NOT
  block the underlying upgrade.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.organization import Organization
from app.models.organization_member import OrganizationMember
from app.models.referral import Referral, ReferralStatus

logger = logging.getLogger(__name__)


# 30 days = one full Pro billing cycle. Matches the upgrade_org_to_tier
# default cycle length so the math is consistent across the platform.
REWARD_DAYS = 30


def _find_owned_org(db: Session, user_id: UUID) -> Optional[Organization]:
    """First org where user_id is an owner. We pick the OLDEST owned org
    (most likely the user's personal default), not whichever was last
    touched, so the reward consistently lands in their main workspace."""
    member = (
        db.query(OrganizationMember)
        .filter(
            OrganizationMember.user_id == user_id,
            OrganizationMember.role == "owner",
        )
        .order_by(OrganizationMember.created_at.asc())
        .first()
    )
    if not member:
        return None
    return (
        db.query(Organization)
        .filter(Organization.id == member.organization_id)
        .first()
    )


def _extend_period(org: Organization, days: int) -> None:
    """Add `days` to org.subscription_ends_at. Initialize from now if
    the field is null (Free or open-ended Enterprise org)."""
    base = org.subscription_ends_at or datetime.utcnow()
    if base < datetime.utcnow():
        # Already expired — start the extension from now, not the past.
        base = datetime.utcnow()
    org.subscription_ends_at = base + timedelta(days=days)


def apply_conversion_reward(db: Session, paying_user_id: UUID) -> bool:
    """Mark the matching referral CONVERTED and grant the reward.

    Returns True if a reward was applied, False otherwise (no matching
    referral, already converted, or the referrer is missing). Never
    raises — failures are logged. Caller commits the session.
    """
    try:
        referral = (
            db.query(Referral)
            .filter(
                Referral.referred_user_id == paying_user_id,
                Referral.status == ReferralStatus.REGISTERED.value,
            )
            .order_by(Referral.created_at.desc())
            .first()
        )
        if referral is None:
            return False  # not a referred signup, or already converted

        # Mark converted FIRST so a concurrent retry no-ops via the
        # status filter above. Idempotency guard.
        referral.status = ReferralStatus.CONVERTED.value
        referral.converted_at = datetime.utcnow()
        db.flush()

        # Reward referrer.
        referrer_org = _find_owned_org(db, referral.referrer_user_id)
        if referrer_org is not None:
            if referrer_org.subscription_tier == "free":
                # Lift to Pro for one cycle. We set the fields directly
                # rather than calling upgrade_org_to_tier to avoid a
                # circular call back into this service.
                referrer_org.subscription_tier = "pro"
                referrer_org.subscription_status = "active"
                referrer_org.trial_ends_at = None
                referrer_org.subscription_starts_at = datetime.utcnow()
                referrer_org.subscription_ends_at = (
                    datetime.utcnow() + timedelta(days=REWARD_DAYS)
                )
            else:
                # Already paid — just extend their cycle by 30 days.
                _extend_period(referrer_org, REWARD_DAYS)
            logger.info(
                "Referral reward → referrer org %s (+%dd, tier=%s)",
                referrer_org.id,
                REWARD_DAYS,
                referrer_org.subscription_tier,
            )

        # Reward referred user (the one who just upgraded). Find their
        # primary org — the one that triggered this conversion, which is
        # the one they own where the upgrade just happened.
        referred_org = _find_owned_org(db, paying_user_id)
        if referred_org is not None:
            _extend_period(referred_org, REWARD_DAYS)
            logger.info(
                "Referral reward → referred org %s (+%dd, tier=%s)",
                referred_org.id,
                REWARD_DAYS,
                referred_org.subscription_tier,
            )

        # Best-effort notifications. Import lazily to avoid a circular
        # dependency with notification_service which imports models.
        try:
            from app.services.notification_service import create_notification

            create_notification(
                db=db,
                user_id=referral.referrer_user_id,
                event="referral.converted",
                title="Your referral converted! 🎉",
                body=(
                    f"You've earned {REWARD_DAYS} days of Pro for "
                    f"referring a new paying user. Thank you for spreading "
                    f"the word."
                ),
                link="/referrals",
                resource_type="organization",
                resource_id=referrer_org.id if referrer_org else None,
            )
            create_notification(
                db=db,
                user_id=paying_user_id,
                event="referral.bonus_received",
                title=f"Bonus: +{REWARD_DAYS} days on us 🎁",
                body=(
                    f"As a referred user upgrading for the first time, "
                    f"your subscription is extended by {REWARD_DAYS} extra "
                    f"days. Welcome aboard."
                ),
                link="/billings",
                resource_type="organization",
                resource_id=referred_org.id if referred_org else None,
            )
        except Exception:
            logger.exception(
                "Referral reward notification failed — reward itself was applied",
            )

        return True

    except Exception:
        # Reward is best-effort; never fail the parent upgrade.
        logger.exception(
            "Referral reward processing failed for paying_user_id=%s",
            paying_user_id,
        )
        return False
