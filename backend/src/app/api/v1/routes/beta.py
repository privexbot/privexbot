"""
Beta Access Routes - User-facing beta access endpoints.

WHY:
- Allow users to check their beta access status
- Enable invite code redemption for beta testers
- Control access to beta features like KB creation

HOW:
- /beta/status - Check if user has beta access
- /beta/redeem - Redeem an invite code to gain access
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.v1.dependencies import get_db, get_current_user
from app.models.user import User
from app.schemas.invite_code import (
    RedeemInviteCodeRequest,
    RedeemInviteCodeResponse,
    BetaStatusResponse,
)
from app.services.invite_code_service import invite_code_service

router = APIRouter(prefix="/beta", tags=["beta"])


@router.get("/status", response_model=BetaStatusResponse)
async def get_beta_status(
    current_user: User = Depends(get_current_user),
) -> BetaStatusResponse:
    """
    Check if current user has beta access.

    Beta access is granted if:
    - User is staff (is_staff = True), OR
    - User has redeemed an invite code (has_beta_access = True)

    Returns:
        BetaStatusResponse: Access status and whether user is staff
    """
    has_access = current_user.is_staff or current_user.has_beta_access

    if current_user.is_staff:
        message = "Staff members have automatic beta access"
    elif current_user.has_beta_access:
        message = "Beta access granted via invite code"
    else:
        message = "Enter an invite code to access beta features"

    return BetaStatusResponse(
        has_access=has_access,
        is_staff=current_user.is_staff,
        message=message
    )


@router.post("/redeem", response_model=RedeemInviteCodeResponse)
async def redeem_invite_code(
    request: RedeemInviteCodeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> RedeemInviteCodeResponse:
    """
    Redeem an invite code to gain beta access.

    If the code is valid and not already redeemed:
    - Marks the code as redeemed
    - Sets user.has_beta_access = True

    Args:
        request: The invite code to redeem

    Returns:
        RedeemInviteCodeResponse: Success status and message

    Note:
        - Staff members already have access but can still redeem codes
        - Each code can only be used once
    """
    # Check if user already has beta access
    if current_user.has_beta_access:
        return RedeemInviteCodeResponse(
            success=True,
            message="You already have beta access"
        )

    # Validate the code first
    code_data = invite_code_service.validate_code(request.code)
    if not code_data:
        return RedeemInviteCodeResponse(
            success=False,
            message="Invalid or expired invite code"
        )

    # Redeem the code
    success = invite_code_service.redeem_code(request.code, current_user.id)
    if not success:
        return RedeemInviteCodeResponse(
            success=False,
            message="Failed to redeem code. It may have already been used."
        )

    # Update user's beta access
    current_user.has_beta_access = True
    db.commit()

    return RedeemInviteCodeResponse(
        success=True,
        message="Invite code redeemed successfully! You now have beta access."
    )
