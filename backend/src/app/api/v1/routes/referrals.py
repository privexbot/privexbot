"""
Referral routes.

WHY:
- Each user gets a unique referral code (lazily generated on first read).
- The dashboard shows their stats and a copyable share link.
- Signup paths accept an optional `referral_code` to record the conversion;
  see `routes/auth.py` for the wiring.
"""

import secrets
import string
from typing import Tuple
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.v1.dependencies import get_current_user, get_current_user_with_org
from app.core.config import settings
from app.db.session import get_db
from app.models.referral import Referral, ReferralStatus
from app.models.user import User


router = APIRouter(prefix="/referrals", tags=["referrals"])

UserContext = Tuple[User, str, str]

# 8-char codes give us ~218 trillion possibilities — plenty for any
# foreseeable scale. Letters + digits only (no ambiguous chars).
_CODE_ALPHABET = string.ascii_uppercase + string.digits
_CODE_LENGTH = 8


def _generate_unique_code(db: Session) -> str:
    """Pick a random code that is not already in use. Retries on collision."""
    for _ in range(10):
        candidate = "".join(secrets.choice(_CODE_ALPHABET) for _ in range(_CODE_LENGTH))
        existing = db.query(User).filter(User.referral_code == candidate).first()
        if not existing:
            return candidate
    # Astronomically unlikely after 10 tries, but be defensive.
    raise HTTPException(status_code=500, detail="Could not generate unique referral code.")


def _ensure_referral_code(db: Session, user: User) -> str:
    """Lazy-generate a referral code on first access. Idempotent.

    NOTE: `current_user` from `get_current_user` is loaded in a separate
    SQLAlchemy session (auth dep) and is detached from the request session
    here. We re-fetch the row in the request session before mutating, then
    return the freshly fetched code.
    """
    if user.referral_code:
        return user.referral_code

    db_user = db.query(User).filter(User.id == user.id).first()
    if db_user is None:
        # Highly unlikely — the auth dep already validated the user exists.
        raise HTTPException(status_code=404, detail="User not found")

    if db_user.referral_code:
        return db_user.referral_code

    db_user.referral_code = _generate_unique_code(db)
    db.commit()
    db.refresh(db_user)
    return db_user.referral_code


def _share_url(code: str) -> str:
    base = (settings.FRONTEND_URL or "").rstrip("/")
    return f"{base}/signup?ref={code}" if base else f"/signup?ref={code}"


@router.get("/me")
async def get_my_referral(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return the current user's referral code, share link, and counts."""
    code = _ensure_referral_code(db, current_user)

    rows = (
        db.query(Referral)
        .filter(Referral.referrer_user_id == current_user.id)
        .all()
    )
    total = len(rows)
    pending = sum(1 for r in rows if r.status == ReferralStatus.PENDING.value)
    registered = sum(1 for r in rows if r.status == ReferralStatus.REGISTERED.value)
    converted = sum(1 for r in rows if r.status == ReferralStatus.CONVERTED.value)

    return {
        "code": code,
        "share_url": _share_url(code),
        "total_invites": total,
        "pending": pending,
        "registered": registered,
        "converted": converted,
    }


@router.get("/list")
async def list_my_referrals(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List the current user's referrals (most recent first)."""
    rows = (
        db.query(Referral)
        .filter(Referral.referrer_user_id == current_user.id)
        .order_by(Referral.created_at.desc())
        .all()
    )

    out: list[dict] = []
    for r in rows:
        referred_username = None
        if r.referred_user_id:
            ref = db.query(User).filter(User.id == r.referred_user_id).first()
            referred_username = ref.username if ref else None
        out.append({
            "id": str(r.id),
            "status": r.status,
            "email": r.email,
            "referred_username": referred_username,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "converted_at": r.converted_at.isoformat() if r.converted_at else None,
        })
    return {"items": out, "total": len(out)}


def record_referral_signup(
    db: Session,
    referral_code: str,
    new_user_id: UUID,
    email: str | None = None,
) -> Referral | None:
    """Helper called from the signup paths in `routes/auth.py`.

    Looks up the referrer by code, writes a `registered` row, and notifies
    the referrer. No-op (returns None) if the code does not match a user.
    """
    if not referral_code:
        return None

    referrer = db.query(User).filter(User.referral_code == referral_code).first()
    if not referrer:
        return None
    if referrer.id == new_user_id:
        # No self-referrals.
        return None

    referral = Referral(
        referrer_user_id=referrer.id,
        referral_code=referral_code,
        referred_user_id=new_user_id,
        email=email,
        status=ReferralStatus.REGISTERED.value,
    )
    db.add(referral)
    db.commit()
    db.refresh(referral)

    # Best-effort notification. Don't break signup if this fails.
    try:
        from app.services import notification_service
        notification_service.create_notification(
            db=db,
            user_id=referrer.id,
            event="referral.registered",
            title="Someone joined via your referral link",
            body=f"{email or 'A new user'} signed up using your code.",
            link="/referrals",
            resource_type="referral",
            resource_id=referral.id,
        )
    except Exception:
        pass

    return referral
