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
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.v1.dependencies import get_db, get_staff_user
from app.models.user import User
from app.services.admin_service import AdminService
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
