"""
Organization API routes.

WHY:
- Provide REST API for organization management
- Support multi-tenant organization operations
- Enable organization membership management

HOW:
- CRUD operations for organizations
- Role-based access control
- Organization membership management

ENDPOINTS:
-----------
Organization Management:
  GET /orgs - List user's organizations
  POST /orgs - Create new organization
  GET /orgs/{org_id} - Get organization details
  PUT /orgs/{org_id} - Update organization
  DELETE /orgs/{org_id} - Delete organization

Organization Membership:
  GET /orgs/{org_id}/members - List organization members
  POST /orgs/{org_id}/members - Add member to organization
  PUT /orgs/{org_id}/members/{member_id} - Update member role
  DELETE /orgs/{org_id}/members/{member_id} - Remove member from organization

Context Management:
  POST /orgs/switch - Switch organization context
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID

from app.api.v1.dependencies import get_db, get_current_user
from app.models.user import User
from app.schemas.organization import (
    OrganizationCreate,
    OrganizationUpdate,
    OrganizationResponse,
    OrganizationDetailed,
    OrganizationList,
    OrganizationMemberCreate,
    OrganizationMemberUpdate,
    OrganizationMemberResponse,
)
from app.services.tenant_service import (
    create_organization,
    get_organization,
    list_user_organizations,
    list_organization_workspaces,
    update_organization,
    delete_organization,
    add_organization_member,
    update_organization_member_role,
    remove_organization_member,
    get_organization_members,
)

router = APIRouter()


# ============================================================================
# ORGANIZATION MANAGEMENT
# ============================================================================

@router.get("/", response_model=OrganizationList)
async def list_organizations(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List user's organizations with their roles.

    Returns paginated list of organizations the user belongs to.
    """
    # Get all user organizations
    user_orgs = list_user_organizations(db=db, user_id=current_user.id)

    # Calculate pagination
    total = len(user_orgs)
    start_idx = (page - 1) * limit
    end_idx = start_idx + limit
    paginated_orgs = user_orgs[start_idx:end_idx]

    # Format response
    organizations = []
    for org, role in paginated_orgs:
        # Add role and basic counts to response
        org_data = OrganizationResponse.model_validate(org)

        # Get counts using database queries (avoid lazy loading issues)
        from app.models.organization_member import OrganizationMember
        from app.models.workspace import Workspace

        member_count = db.query(OrganizationMember).filter(
            OrganizationMember.organization_id == org.id
        ).count()

        workspace_count = db.query(Workspace).filter(
            Workspace.organization_id == org.id
        ).count()

        org_data.member_count = member_count
        org_data.workspace_count = workspace_count
        org_data.user_role = role  # Set current user's role in this organization
        organizations.append(org_data)

    # Calculate pagination metadata
    total_pages = (total + limit - 1) // limit
    has_next = page < total_pages
    has_previous = page > 1

    return OrganizationList(
        organizations=organizations,
        total=total,
        page=page,
        page_size=limit,
        total_pages=total_pages,
        has_next=has_next,
        has_previous=has_previous
    )


@router.post("/", response_model=OrganizationResponse, status_code=status.HTTP_201_CREATED)
async def create_new_organization(
    org_data: OrganizationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create a new organization.

    User becomes the owner and a default workspace is created.
    """
    org = create_organization(
        db=db,
        name=org_data.name,
        billing_email=org_data.billing_email,
        creator_id=current_user.id
    )

    org_response = OrganizationResponse.model_validate(org)
    org_response.user_role = "owner"  # Creator is automatically owner
    return org_response


@router.get("/{org_id}", response_model=OrganizationDetailed)
async def get_organization_details(
    org_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get detailed organization information.

    Includes members and workspaces if user has access.
    """
    org, user_role = get_organization(
        db=db,
        organization_id=org_id,
        user_id=current_user.id
    )

    # Get members and workspaces for detailed view
    members_data = get_organization_members(
        db=db,
        organization_id=org_id,
        user_id=current_user.id
    )

    # Convert members to response format
    members = []
    for membership, user in members_data:
        member_response = OrganizationMemberResponse(
            id=membership.id,
            user_id=user.id,
            username=user.username,
            role=membership.role,
            invited_by=membership.invited_by,
            joined_at=membership.joined_at,
            created_at=membership.created_at
        )
        members.append(member_response)

    # Get workspaces for detailed view
    workspaces_data = list_organization_workspaces(
        db=db,
        organization_id=org_id,
        user_id=current_user.id
    )

    # Convert workspaces to response format with user roles
    from app.schemas.organization import WorkspaceSummary
    from app.models.workspace_member import WorkspaceMember
    from app.models.organization_member import OrganizationMember

    workspaces = []
    for workspace in workspaces_data:
        # Get user's role in this workspace
        ws_member = db.query(WorkspaceMember).filter(
            WorkspaceMember.workspace_id == workspace.id,
            WorkspaceMember.user_id == current_user.id
        ).first()

        # If not a workspace member, check if org admin/owner (they get admin access)
        user_workspace_role = None
        if ws_member:
            user_workspace_role = ws_member.role
        else:
            # Check if user is org admin/owner
            org_member = db.query(OrganizationMember).filter(
                OrganizationMember.organization_id == org_id,
                OrganizationMember.user_id == current_user.id
            ).first()
            if org_member and org_member.role in ["owner", "admin"]:
                user_workspace_role = "admin"  # Org admins/owners get admin access to all workspaces

        workspace_summary = WorkspaceSummary(
            id=workspace.id,
            name=workspace.name,
            description=workspace.description,
            is_default=workspace.is_default,
            created_at=workspace.created_at,
            user_role=user_workspace_role
        )
        workspaces.append(workspace_summary)

    # Create detailed response using base organization data
    base_org = OrganizationResponse.model_validate(org)
    base_org.user_role = user_role  # Set current user's role

    return OrganizationDetailed(
        **base_org.model_dump(),
        members=members,
        workspaces=workspaces,
        settings={}
    )


@router.put("/{org_id}", response_model=OrganizationResponse)
async def update_organization_details(
    org_id: UUID,
    org_update: OrganizationUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update organization information.

    Requires admin or owner role.
    """
    # Convert Pydantic model to dict, excluding unset fields
    update_data = org_update.model_dump(exclude_unset=True)

    updated_org = update_organization(
        db=db,
        organization_id=org_id,
        user_id=current_user.id,
        **update_data
    )

    # Get user's role in the organization
    _, user_role = get_organization(
        db=db,
        organization_id=org_id,
        user_id=current_user.id
    )

    org_response = OrganizationResponse.model_validate(updated_org)
    org_response.user_role = user_role
    return org_response


@router.delete("/{org_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_organization_endpoint(
    org_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Delete organization.

    Requires owner role. Cascades to all workspaces and memberships.
    """
    delete_organization(
        db=db,
        organization_id=org_id,
        user_id=current_user.id
    )

    return None


# ============================================================================
# ORGANIZATION MEMBERSHIP MANAGEMENT
# ============================================================================

@router.get("/{org_id}/members", response_model=List[OrganizationMemberResponse])
async def list_organization_members(
    org_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List all members of an organization.

    Requires organization membership.
    """
    members_data = get_organization_members(
        db=db,
        organization_id=org_id,
        user_id=current_user.id
    )

    members = []
    for membership, user in members_data:
        member_response = OrganizationMemberResponse(
            id=membership.id,
            user_id=user.id,
            username=user.username,
            role=membership.role,
            invited_by=membership.invited_by,
            joined_at=membership.joined_at,
            created_at=membership.created_at
        )
        members.append(member_response)

    return members


@router.post("/{org_id}/members", response_model=OrganizationMemberResponse, status_code=status.HTTP_201_CREATED)
async def add_organization_member_endpoint(
    org_id: UUID,
    member_data: OrganizationMemberCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Add a member to the organization.

    Requires admin or owner role.
    """
    membership = add_organization_member(
        db=db,
        organization_id=org_id,
        inviter_id=current_user.id,
        invitee_id=member_data.user_id,
        role=member_data.role
    )

    # Get user details for response
    user = db.query(User).filter(User.id == member_data.user_id).first()

    return OrganizationMemberResponse(
        id=membership.id,
        user_id=user.id,
        username=user.username,
        role=membership.role,
        invited_by=membership.invited_by,
        joined_at=membership.joined_at,
        created_at=membership.created_at
    )


@router.put("/{org_id}/members/{member_id}", response_model=OrganizationMemberResponse)
async def update_organization_member_role_endpoint(
    org_id: UUID,
    member_id: UUID,
    role_update: OrganizationMemberUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update organization member's role.

    Requires admin or owner role. Only owners can promote to owner.
    """
    updated_membership = update_organization_member_role(
        db=db,
        organization_id=org_id,
        member_id=member_id,
        updater_id=current_user.id,
        new_role=role_update.role
    )

    # Get user details for response
    user = db.query(User).filter(User.id == updated_membership.user_id).first()

    return OrganizationMemberResponse(
        id=updated_membership.id,
        user_id=user.id,
        username=user.username,
        role=updated_membership.role,
        invited_by=updated_membership.invited_by,
        joined_at=updated_membership.joined_at,
        created_at=updated_membership.created_at
    )


@router.delete("/{org_id}/members/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_organization_member_endpoint(
    org_id: UUID,
    member_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Remove member from organization.

    Requires admin or owner role. Cannot remove last owner.
    """
    remove_organization_member(
        db=db,
        organization_id=org_id,
        member_id=member_id,
        remover_id=current_user.id
    )

    return None