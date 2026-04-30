"""
Referral — tracks each use of a user's referral code.

WHY:
- One row per signup that came in through someone's code.
- Codes themselves live on `User.referral_code` (one per user).
- Status progresses: pending (invite emailed) → registered (account created)
  → converted (org becomes paying / `subscription_status="active"`).
"""

import enum

from sqlalchemy import Column, String, ForeignKey, DateTime, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.base_class import Base


class ReferralStatus(str, enum.Enum):
    PENDING = "pending"
    REGISTERED = "registered"
    CONVERTED = "converted"


class Referral(Base):
    __tablename__ = "referrals"

    # Who shared the code
    referrer_user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # The code that was used (denormalized so the row is self-describing
    # even if the referrer rotates their code in the future).
    referral_code = Column(String(32), nullable=False, index=True)

    # Who used it (null while in `pending` — e.g., an emailed invite that
    # hasn't been accepted yet).
    referred_user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Email of the invitee (used for `pending` rows where there's no user yet).
    email = Column(String(255), nullable=True, index=True)

    status = Column(String(20), nullable=False, default=ReferralStatus.PENDING.value)

    converted_at = Column(DateTime, nullable=True)

    referrer = relationship("User", foreign_keys=[referrer_user_id])
    referred = relationship("User", foreign_keys=[referred_user_id])

    __table_args__ = (
        Index("idx_referrals_referrer_status", "referrer_user_id", "status"),
    )
