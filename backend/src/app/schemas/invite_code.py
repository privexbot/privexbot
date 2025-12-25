"""
Pydantic schemas for Invite Code API requests and responses.

WHY:
- Validate invite code API input data
- Serialize invite code data to JSON responses
- Type safety for staff-generated beta tester codes
"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class GenerateInviteCodeRequest(BaseModel):
    """
    Schema for generating an invite code.

    WHY: Allow optional TTL customization
    """
    ttl_days: int = Field(
        default=7,
        ge=1,
        le=30,
        description="Code validity period in days (default: 7)"
    )


class GenerateInviteCodeResponse(BaseModel):
    """
    Schema for invite code generation response.

    WHY: Return the generated code with expiration info
    """
    code: str = Field(..., description="The generated invite code (e.g., PRIV-A1B2)")
    created_at: str = Field(..., description="When the code was created")
    expires_at: str = Field(..., description="When the code expires")
    message: str = Field(
        default="Invite code generated successfully",
        description="Status message"
    )


class RedeemInviteCodeRequest(BaseModel):
    """
    Schema for redeeming an invite code.

    WHY: Validate code format on redemption
    """
    code: str = Field(
        ...,
        min_length=4,
        max_length=20,
        description="The invite code to redeem"
    )


class RedeemInviteCodeResponse(BaseModel):
    """
    Schema for invite code redemption response.

    WHY: Indicate success/failure of redemption
    """
    success: bool = Field(..., description="Whether the code was successfully redeemed")
    message: str = Field(..., description="Status message explaining the result")


class InviteCodeInfo(BaseModel):
    """
    Schema for invite code details.

    WHY: Return full code information to staff
    """
    code: str = Field(..., description="The invite code")
    created_by: str = Field(..., description="UUID of staff who created the code")
    created_at: str = Field(..., description="When the code was created")
    expires_at: str = Field(..., description="When the code expires")
    ttl_seconds: int = Field(..., description="Remaining time to live in seconds")
    is_redeemed: bool = Field(..., description="Whether the code has been used")
    redeemed_by: Optional[str] = Field(None, description="UUID of user who redeemed (if any)")
    redeemed_at: Optional[str] = Field(None, description="When the code was redeemed (if any)")


class BetaStatusResponse(BaseModel):
    """
    Schema for beta access status check.

    WHY: Let frontend know if user has beta access
    """
    has_access: bool = Field(
        ...,
        description="Whether user has beta access (staff or redeemed code)"
    )
    is_staff: bool = Field(
        ...,
        description="Whether user is staff (automatic access)"
    )
    message: str = Field(
        default="",
        description="Optional message about access status"
    )
