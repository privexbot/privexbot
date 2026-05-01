"""
Admin Routes - Staff-only backoffice endpoints.

WHY:
- Provide cross-tenant access for staff support
- Enable user lookup and troubleshooting
- System-wide statistics and monitoring

HOW:
- All routes protected by get_staff_user dependency
- Uses AdminService for cross-tenant queries
- No organization/workspace context required
"""

from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.v1.dependencies import get_db, get_staff_user
from app.models.user import User
from app.services.admin_service import AdminService
from app.services.aggregated_analytics_service import AggregatedAnalyticsService
from app.schemas.analytics import AggregatedAnalyticsResponse
from app.schemas.admin import (
    SystemStats,
    OrganizationListResponse,
    OrganizationDetail,
    UserListResponse,
    UserDetail,
    UserResources,
    UpdateStaffStatusRequest,
    UpdateStaffStatusResponse,
)
from app.schemas.invite_code import (
    GenerateInviteCodeRequest,
    GenerateInviteCodeResponse,
    InviteCodeInfo,
)
from app.services.invite_code_service import invite_code_service

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/stats", response_model=SystemStats)
async def get_system_stats(
    staff: User = Depends(get_staff_user),
    db: Session = Depends(get_db),
) -> SystemStats:
    """
    Get system-wide statistics for admin dashboard.

    Requires staff access.

    Returns:
        SystemStats: Total counts of users, orgs, chatbots, etc.
    """
    service = AdminService(db)
    stats = service.get_system_stats()
    return SystemStats(**stats)


@router.get("/organizations", response_model=OrganizationListResponse)
async def list_organizations(
    search: Optional[str] = Query(None, description="Search by organization name"),
    limit: int = Query(50, ge=1, le=100, description="Max results to return"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
    staff: User = Depends(get_staff_user),
    db: Session = Depends(get_db),
) -> OrganizationListResponse:
    """
    List all organizations with member and workspace counts.

    Requires staff access.

    Args:
        search: Optional search term for org name
        limit: Max results (1-100)
        offset: Pagination offset

    Returns:
        OrganizationListResponse: Paginated list of organizations
    """
    service = AdminService(db)
    result = service.list_organizations(search=search, limit=limit, offset=offset)
    return OrganizationListResponse(**result)


@router.get("/organizations/{org_id}", response_model=OrganizationDetail)
async def get_organization(
    org_id: UUID,
    staff: User = Depends(get_staff_user),
    db: Session = Depends(get_db),
) -> OrganizationDetail:
    """
    Get detailed information about an organization.

    Requires staff access.

    Args:
        org_id: Organization ID

    Returns:
        OrganizationDetail: Org details with workspaces and members

    Raises:
        HTTPException(404): If organization not found
    """
    service = AdminService(db)
    result = service.get_organization_details(org_id)

    if not result:
        raise HTTPException(status_code=404, detail="Organization not found")

    return OrganizationDetail(**result)


@router.get("/users", response_model=UserListResponse)
async def list_users(
    search: Optional[str] = Query(None, description="Search by username or email"),
    limit: int = Query(50, ge=1, le=100, description="Max results to return"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
    staff: User = Depends(get_staff_user),
    db: Session = Depends(get_db),
) -> UserListResponse:
    """
    Search and list users.

    Requires staff access.

    Args:
        search: Search term (matches username or email)
        limit: Max results (1-100)
        offset: Pagination offset

    Returns:
        UserListResponse: Paginated list of users
    """
    service = AdminService(db)
    result = service.search_users(query=search, limit=limit, offset=offset)
    return UserListResponse(**result)


@router.get("/users/{user_id}", response_model=UserDetail)
async def get_user(
    user_id: UUID,
    staff: User = Depends(get_staff_user),
    db: Session = Depends(get_db),
) -> UserDetail:
    """
    Get detailed information about a user.

    Requires staff access.

    Args:
        user_id: User ID

    Returns:
        UserDetail: User profile with auth methods and memberships

    Raises:
        HTTPException(404): If user not found
    """
    service = AdminService(db)
    result = service.get_user_details(user_id)

    if not result:
        raise HTTPException(status_code=404, detail="User not found")

    return UserDetail(**result)


@router.get("/users/{user_id}/resources", response_model=UserResources)
async def get_user_resources(
    user_id: UUID,
    staff: User = Depends(get_staff_user),
    db: Session = Depends(get_db),
) -> UserResources:
    """
    Get all resources created by a user.

    Requires staff access.

    Args:
        user_id: User ID

    Returns:
        UserResources: Chatbots, chatflows, and KBs created by user
    """
    service = AdminService(db)
    result = service.get_user_resources(user_id)
    return UserResources(**result)


@router.patch("/users/{user_id}/staff", response_model=UpdateStaffStatusResponse)
async def update_user_staff_status(
    user_id: UUID,
    request: UpdateStaffStatusRequest,
    staff: User = Depends(get_staff_user),
    db: Session = Depends(get_db),
) -> UpdateStaffStatusResponse:
    """
    Update a user's staff status.

    Requires staff access. Staff can promote or demote other users.

    Args:
        user_id: User ID to update
        request: New staff status

    Returns:
        UpdateStaffStatusResponse: Updated user info with success message

    Raises:
        HTTPException(404): If user not found
        HTTPException(400): If trying to demote yourself (last resort protection)
    """
    # Prevent staff from demoting themselves
    if user_id == staff.id and not request.is_staff:
        raise HTTPException(
            status_code=400,
            detail="You cannot remove your own staff access"
        )

    # Find the user
    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Update staff status
    old_status = user.is_staff
    user.is_staff = request.is_staff
    db.commit()
    db.refresh(user)

    # Create response message
    if request.is_staff and not old_status:
        message = f"User '{user.username}' has been granted staff access"
    elif not request.is_staff and old_status:
        message = f"User '{user.username}' staff access has been revoked"
    else:
        message = f"User '{user.username}' staff status unchanged"

    return UpdateStaffStatusResponse(
        user_id=str(user.id),
        username=user.username,
        is_staff=user.is_staff,
        message=message
    )


# ============================================================================
# Invite Code Endpoints
# ============================================================================


@router.post("/invite-codes", response_model=GenerateInviteCodeResponse)
async def generate_invite_code(
    request: GenerateInviteCodeRequest = None,
    staff: User = Depends(get_staff_user),
) -> GenerateInviteCodeResponse:
    """
    Generate a new invite code for beta testers.

    Requires staff access.

    Args:
        request: Optional TTL customization (default: 7 days)

    Returns:
        GenerateInviteCodeResponse: The generated code with expiration info
    """
    ttl_days = request.ttl_days if request else 7

    code_data = invite_code_service.generate_code(
        created_by=staff.id,
        ttl_days=ttl_days
    )

    return GenerateInviteCodeResponse(
        code=code_data["code"],
        created_at=code_data["created_at"],
        expires_at=code_data["expires_at"],
        message=f"Invite code generated successfully. Valid for {ttl_days} days."
    )


@router.get("/invite-codes", response_model=list[InviteCodeInfo])
async def list_invite_codes(
    staff: User = Depends(get_staff_user),
) -> list[InviteCodeInfo]:
    """
    List all active invite codes.

    Requires staff access.

    Returns:
        List of invite codes with their status
    """
    codes = invite_code_service.list_codes()

    return [
        InviteCodeInfo(
            code=code["code"],
            created_by=code["created_by"],
            created_at=code["created_at"],
            expires_at=code["expires_at"],
            ttl_seconds=code.get("ttl_seconds", 0),
            is_redeemed=code.get("redeemed_by") is not None,
            redeemed_by=code.get("redeemed_by"),
            redeemed_at=code.get("redeemed_at"),
        )
        for code in codes
    ]


@router.delete("/invite-codes/{code}")
async def revoke_invite_code(
    code: str,
    staff: User = Depends(get_staff_user),
) -> dict:
    """
    Revoke (delete) an invite code.

    Requires staff access.

    Args:
        code: The invite code to revoke

    Returns:
        Success message

    Raises:
        HTTPException(404): If code not found
    """
    success = invite_code_service.revoke_code(code)

    if not success:
        raise HTTPException(status_code=404, detail="Invite code not found")

    return {"message": f"Invite code {code} has been revoked"}


# ============================================================================
# Analytics Endpoints
# ============================================================================


@router.get("/analytics", response_model=AggregatedAnalyticsResponse)
async def get_platform_analytics(
    days: int = Query(7, ge=1, le=90, description="Number of days to analyze"),
    staff: User = Depends(get_staff_user),
    db: Session = Depends(get_db),
) -> AggregatedAnalyticsResponse:
    """
    Platform-wide analytics. Requires staff access.

    Returns aggregated performance, cost, trend, and per-bot metrics
    across all tenants.

    Args:
        days: Number of days to analyze (1-90)

    Returns:
        AggregatedAnalyticsResponse: Platform-wide analytics data
    """
    service = AggregatedAnalyticsService(db)
    return await service.get_platform_analytics(days)


# ─── Plan management ────────────────────────────────────────────────────────
# Staff-only path to upgrade ANY org's plan tier without going through Stripe.
# `POST /billing/upgrade` only operates on the caller's active org; this
# parallel route lets ops change someone else's tier from the admin UI.

from pydantic import BaseModel as _PlanBaseModel
from app.core.plans import PLAN_LIMITS as _PLAN_LIMITS
from app.core.config import settings
from app.services import billing_service as _billing_service


class _AdminUpgradeRequest(_PlanBaseModel):
    tier: str


@router.get("/orgs/{org_id}/plan")
async def admin_get_org_plan(
    org_id: UUID,
    db: Session = Depends(get_db),
    staff: User = Depends(get_staff_user),
):
    """Read the current plan status (tier + live usage) for any organization.

    Staff-only — `GET /billing/plan` only operates on the caller's active org;
    this lets ops inspect another org's tier and usage breakdown before
    deciding whether to upgrade or downgrade them.
    """
    try:
        return _billing_service.get_plan_status(db, org_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/orgs/{org_id}/plan")
async def admin_upgrade_org_plan(
    org_id: UUID,
    request: _AdminUpgradeRequest,
    db: Session = Depends(get_db),
    staff: User = Depends(get_staff_user),
):
    """Set the subscription tier for any organization. Staff-only."""
    if request.tier not in _PLAN_LIMITS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown tier: {request.tier}",
        )

    try:
        _billing_service.upgrade_org_to_tier(db, org_id, request.tier)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    return _billing_service.get_plan_status(db, org_id)


# ─── OAuth setup discoverability ───────────────────────────────────────────
# Operators register OAuth redirect URIs in each provider's developer
# console (Google Cloud Console, Notion, Calendly, Slack). The URIs are
# auto-derived from API_BASE_URL — this endpoint surfaces the exact URLs
# so the operator can copy-paste without inspecting code or env files.

@router.get("/oauth/redirect-uris")
async def admin_get_oauth_redirect_uris(
    staff: User = Depends(get_staff_user),
):
    """Return per-provider redirect URIs + which `*_CLIENT_ID` env vars are set.

    Used by the admin dashboard's OAuth setup card so operators can:
    1) Copy the exact URI to register in each provider's console.
    2) See at a glance which providers still need credentials filled in.

    Slack uses a different callback path (`/webhooks/slack/oauth/callback`)
    because its install flow is owned by the webhooks router, not the
    credentials router. Discord shared-bot uses the OAuth invite flow into
    `/webhooks/discord/shared` for interactions, plus a separate callback
    for guild grants — both surfaced here for completeness.
    """
    api = settings.API_BASE_URL.rstrip("/")
    credentials_callback = f"{api}/credentials/oauth/callback"
    slack_callback = f"{api}/webhooks/slack/oauth/callback"
    discord_interactions = f"{api}/webhooks/discord/shared"

    providers = [
        {
            "provider": "google",
            "label": "Google (Drive / Docs / Sheets / Gmail)",
            "redirect_uri": credentials_callback,
            "console_url": "https://console.cloud.google.com/apis/credentials",
            "configured": bool(settings.GOOGLE_CLIENT_ID),
            "env_var": "GOOGLE_CLIENT_ID",
        },
        {
            "provider": "notion",
            "label": "Notion",
            "redirect_uri": credentials_callback,
            "console_url": "https://www.notion.so/my-integrations",
            "configured": bool(settings.NOTION_CLIENT_ID),
            "env_var": "NOTION_CLIENT_ID",
        },
        {
            "provider": "calendly",
            "label": "Calendly",
            "redirect_uri": credentials_callback,
            "console_url": "https://calendly.com/integrations/api_webhooks",
            "configured": bool(settings.CALENDLY_CLIENT_ID),
            "env_var": "CALENDLY_CLIENT_ID",
        },
        {
            "provider": "slack",
            "label": "Slack (workspace install)",
            "redirect_uri": slack_callback,
            "console_url": "https://api.slack.com/apps",
            "configured": bool(settings.SLACK_CLIENT_ID),
            "env_var": "SLACK_CLIENT_ID",
        },
        {
            "provider": "discord",
            "label": "Discord (shared bot, interactions endpoint)",
            "redirect_uri": discord_interactions,
            "console_url": "https://discord.com/developers/applications",
            "configured": bool(settings.DISCORD_SHARED_APPLICATION_ID),
            "env_var": "DISCORD_SHARED_APPLICATION_ID",
        },
    ]

    return {
        "providers": providers,
        "configured_providers": [p["provider"] for p in providers if p["configured"]],
        "missing_providers": [p["provider"] for p in providers if not p["configured"]],
    }
