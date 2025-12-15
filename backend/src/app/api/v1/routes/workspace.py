"""
Workspace API routes.

WHY:
- Provide REST API for workspace management within organizations
- Support workspace member management
- Enable workspace-level resource access control

HOW:
- CRUD operations for workspaces within organizations
- Workspace membership management
- Inheritance from organization permissions

ENDPOINTS:
-----------
Workspace Management:
  GET /orgs/{org_id}/workspaces - List organization workspaces
  POST /orgs/{org_id}/workspaces - Create new workspace
  GET /orgs/{org_id}/workspaces/{workspace_id} - Get workspace details
  PUT /orgs/{org_id}/workspaces/{workspace_id} - Update workspace
  DELETE /orgs/{org_id}/workspaces/{workspace_id} - Delete workspace

Workspace Membership:
  GET /orgs/{org_id}/workspaces/{workspace_id}/members - List workspace members
  POST /orgs/{org_id}/workspaces/{workspace_id}/members - Add member to workspace
  PUT /orgs/{org_id}/workspaces/{workspace_id}/members/{member_id} - Update member role
  DELETE /orgs/{org_id}/workspaces/{workspace_id}/members/{member_id} - Remove member

Context Management:
  POST /workspaces/switch - Switch workspace context
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID

from app.api.v1.dependencies import get_db, get_current_user
from app.models.user import User
from app.schemas.workspace import (
    WorkspaceCreate,
    WorkspaceUpdate,
    WorkspaceResponse,
    WorkspaceDetailed,
    WorkspaceList,
    WorkspaceMemberCreate,
    WorkspaceMemberUpdate,
    WorkspaceMemberResponse,
)
from app.services.tenant_service import (
    create_workspace,
    get_workspace,
    list_organization_workspaces,
    update_workspace,
    delete_workspace,
    add_workspace_member,
    update_workspace_member_role,
    remove_workspace_member,
    get_workspace_members,
    verify_organization_permission,
)

router = APIRouter()


# ============================================================================
# WORKSPACE MANAGEMENT
# ============================================================================

@router.get("/{org_id}/workspaces", response_model=WorkspaceList)
async def list_workspaces(
    org_id: UUID,
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List workspaces in an organization.

    Organization admins see all workspaces, members see only assigned workspaces.
    """
    # Get user's accessible workspaces
    workspaces = list_organization_workspaces(
        db=db,
        organization_id=org_id,
        user_id=current_user.id
    )

    # Calculate pagination
    total = len(workspaces)
    start_idx = (page - 1) * limit
    end_idx = start_idx + limit
    paginated_workspaces = workspaces[start_idx:end_idx]

    # Format response
    from app.models.workspace_member import WorkspaceMember
    from app.models.organization_member import OrganizationMember

    workspace_responses = []
    for workspace in paginated_workspaces:
        ws_data = WorkspaceResponse.model_validate(workspace)

        # Get member count using database query (avoid lazy loading issues)
        member_count = db.query(WorkspaceMember).filter(
            WorkspaceMember.workspace_id == workspace.id
        ).count()
        ws_data.member_count = member_count

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

        ws_data.user_role = user_workspace_role
        workspace_responses.append(ws_data)

    # Calculate pagination metadata
    total_pages = (total + limit - 1) // limit
    has_next = page < total_pages
    has_previous = page > 1

    return WorkspaceList(
        workspaces=workspace_responses,
        total=total,
        page=page,
        page_size=limit,
        total_pages=total_pages,
        has_next=has_next,
        has_previous=has_previous
    )


@router.post("/{org_id}/workspaces", response_model=WorkspaceResponse, status_code=status.HTTP_201_CREATED)
async def create_new_workspace(
    org_id: UUID,
    workspace_data: WorkspaceCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create a new workspace in the organization.

    Organization ID is derived from the URL path parameter.
    Requires admin or owner role in the organization.
    """
    workspace = create_workspace(
        db=db,
        organization_id=org_id,  # From URL path parameter
        name=workspace_data.name,
        description=workspace_data.description,
        creator_id=current_user.id,
        is_default=workspace_data.is_default
    )

    # Creator is automatically assigned admin role
    workspace_response = WorkspaceResponse.model_validate(workspace)
    workspace_response.user_role = "admin"

    return workspace_response


@router.get("/{org_id}/workspaces/{workspace_id}", response_model=WorkspaceDetailed)
async def get_workspace_details(
    org_id: UUID,
    workspace_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get detailed workspace information.

    Includes members if user has workspace access.
    """
    workspace = get_workspace(
        db=db,
        workspace_id=workspace_id,
        user_id=current_user.id
    )

    # Verify workspace belongs to the specified organization
    if workspace.organization_id != org_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found in specified organization"
        )

    # Get workspace members for detailed view
    members_data = get_workspace_members(
        db=db,
        workspace_id=workspace_id,
        user_id=current_user.id
    )

    # Convert to response format
    members = []
    for membership, user in members_data:
        member_response = WorkspaceMemberResponse(
            id=membership.id,
            user_id=user.id,
            username=user.username,
            role=membership.role,
            invited_by=membership.invited_by,
            joined_at=membership.joined_at,
            created_at=membership.created_at
        )
        members.append(member_response)

    # Get user's role in this workspace
    from app.models.workspace_member import WorkspaceMember
    from app.models.organization_member import OrganizationMember

    ws_member = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == workspace_id,
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

    # Create detailed response using base workspace data
    base_workspace = WorkspaceResponse.model_validate(workspace)
    base_workspace.user_role = user_workspace_role

    return WorkspaceDetailed(
        **base_workspace.model_dump(),
        members=members,
        settings={}
    )


@router.put("/{org_id}/workspaces/{workspace_id}", response_model=WorkspaceResponse)
async def update_workspace_details(
    org_id: UUID,
    workspace_id: UUID,
    workspace_update: WorkspaceUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update workspace information.

    Requires workspace admin role or organization admin/owner.
    """
    # Convert Pydantic model to dict, excluding unset fields
    update_data = workspace_update.model_dump(exclude_unset=True)

    updated_workspace = update_workspace(
        db=db,
        workspace_id=workspace_id,
        user_id=current_user.id,
        **update_data
    )

    # Verify workspace belongs to the specified organization
    if updated_workspace.organization_id != org_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found in specified organization"
        )

    # Get user's role in this workspace
    from app.models.workspace_member import WorkspaceMember
    from app.models.organization_member import OrganizationMember

    ws_member = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == workspace_id,
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

    workspace_response = WorkspaceResponse.model_validate(updated_workspace)
    workspace_response.user_role = user_workspace_role

    return workspace_response


@router.delete("/{org_id}/workspaces/{workspace_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_workspace_endpoint(
    org_id: UUID,
    workspace_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Delete workspace.

    Requires workspace admin role or organization admin/owner.
    Cannot delete default workspace.
    """
    # First verify the workspace belongs to the organization
    workspace = get_workspace(
        db=db,
        workspace_id=workspace_id,
        user_id=current_user.id
    )

    if workspace.organization_id != org_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found in specified organization"
        )

    delete_workspace(
        db=db,
        workspace_id=workspace_id,
        user_id=current_user.id
    )

    return None


# ============================================================================
# WORKSPACE MEMBERSHIP MANAGEMENT
# ============================================================================

@router.get("/{org_id}/workspaces/{workspace_id}/members", response_model=List[WorkspaceMemberResponse])
async def list_workspace_members(
    org_id: UUID,
    workspace_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List all members of a workspace.

    Requires workspace access or organization admin role.
    """
    # Verify workspace belongs to organization
    workspace = get_workspace(
        db=db,
        workspace_id=workspace_id,
        user_id=current_user.id
    )

    if workspace.organization_id != org_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found in specified organization"
        )

    members_data = get_workspace_members(
        db=db,
        workspace_id=workspace_id,
        user_id=current_user.id
    )

    members = []
    for membership, user in members_data:
        member_response = WorkspaceMemberResponse(
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


@router.post("/{org_id}/workspaces/{workspace_id}/members", response_model=WorkspaceMemberResponse, status_code=status.HTTP_201_CREATED)
async def add_workspace_member_endpoint(
    org_id: UUID,
    workspace_id: UUID,
    member_data: WorkspaceMemberCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Add a member to the workspace.

    Requires workspace admin role or organization admin/owner.
    User must already be an organization member.
    """
    # Verify workspace belongs to organization
    workspace = get_workspace(
        db=db,
        workspace_id=workspace_id,
        user_id=current_user.id
    )

    if workspace.organization_id != org_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found in specified organization"
        )

    membership = add_workspace_member(
        db=db,
        workspace_id=workspace_id,
        inviter_id=current_user.id,
        invitee_id=member_data.user_id,
        role=member_data.role
    )

    # Get user details for response
    user = db.query(User).filter(User.id == member_data.user_id).first()

    return WorkspaceMemberResponse(
        id=membership.id,
        user_id=user.id,
        username=user.username,
        role=membership.role,
        invited_by=membership.invited_by,
        joined_at=membership.joined_at,
        created_at=membership.created_at
    )


@router.put("/{org_id}/workspaces/{workspace_id}/members/{member_id}", response_model=WorkspaceMemberResponse)
async def update_workspace_member_role_endpoint(
    org_id: UUID,
    workspace_id: UUID,
    member_id: UUID,
    role_update: WorkspaceMemberUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update workspace member's role.

    Requires workspace admin role or organization admin/owner.
    """
    # Verify workspace belongs to organization
    workspace = get_workspace(
        db=db,
        workspace_id=workspace_id,
        user_id=current_user.id
    )

    if workspace.organization_id != org_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found in specified organization"
        )

    updated_membership = update_workspace_member_role(
        db=db,
        workspace_id=workspace_id,
        member_id=member_id,
        updater_id=current_user.id,
        new_role=role_update.role
    )

    # Get user details for response
    user = db.query(User).filter(User.id == updated_membership.user_id).first()

    return WorkspaceMemberResponse(
        id=updated_membership.id,
        user_id=user.id,
        username=user.username,
        role=updated_membership.role,
        invited_by=updated_membership.invited_by,
        joined_at=updated_membership.joined_at,
        created_at=updated_membership.created_at
    )


@router.delete("/{org_id}/workspaces/{workspace_id}/members/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_workspace_member_endpoint(
    org_id: UUID,
    workspace_id: UUID,
    member_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Remove member from workspace.

    Requires workspace admin role or organization admin/owner.
    """
    # Verify workspace belongs to organization
    workspace = get_workspace(
        db=db,
        workspace_id=workspace_id,
        user_id=current_user.id
    )

    if workspace.organization_id != org_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found in specified organization"
        )

    remove_workspace_member(
        db=db,
        workspace_id=workspace_id,
        member_id=member_id,
        remover_id=current_user.id
    )

    return None