"""
Context switching API routes.

WHY:
- Allow users to switch between organizations and workspaces
- Update JWT token with new tenant context
- Maintain session state across org/workspace switches

HOW:
- Validate user has access to target org/workspace
- Generate new JWT with updated context
- Return new token and context info

ENDPOINTS:
-----------
Context Management:
  POST /switch/organization - Switch organization context
  POST /switch/workspace - Switch workspace context
  GET /current - Get current context information
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional
from uuid import UUID

from app.api.v1.dependencies import get_db, get_current_user
from app.models.user import User
from app.schemas.workspace import (
    ContextSwitchRequest,
    WorkspaceSwitchRequest,
    ContextSwitchResponse,
    CurrentContextResponse
)
from app.services.tenant_service import (
    get_organization,
    get_workspace,
    verify_organization_permission,
    verify_workspace_permission
)
from app.core.security import create_access_token_for_user
from app.core.security import get_user_permissions

router = APIRouter()


# ============================================================================
# CONTEXT SWITCHING
# ============================================================================

@router.post("/organization", response_model=ContextSwitchResponse)
async def switch_organization_context(
    context_request: ContextSwitchRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Switch to a different organization context.

    Generates new JWT with updated organization context.
    If workspace_id provided, also switches to that workspace.
    """
    org_id = context_request.organization_id
    workspace_id = context_request.workspace_id

    # Verify user has access to the organization
    try:
        organization, _ = get_organization(
            db=db,
            organization_id=org_id,
            user_id=current_user.id
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to specified organization"
        )

    # If workspace specified, verify access to it
    workspace = None
    if workspace_id:
        try:
            workspace = get_workspace(
                db=db,
                workspace_id=workspace_id,
                user_id=current_user.id
            )

            # Verify workspace belongs to the organization
            if workspace.organization_id != org_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Workspace does not belong to specified organization"
                )
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to specified workspace"
            )
    else:
        # If no workspace specified, use organization's default workspace
        from app.models.workspace import Workspace
        workspace = db.query(Workspace).filter(
            Workspace.organization_id == org_id,
            Workspace.is_default == True
        ).first()

        if workspace:
            workspace_id = workspace.id

    # Generate new JWT with updated context
    new_token = create_access_token_for_user(
        db=db,
        user=current_user,
        organization_id=org_id,
        workspace_id=workspace_id
    )

    # Get updated permissions
    permissions = get_user_permissions(
        db=db,
        user_id=current_user.id,
        organization_id=org_id,
        workspace_id=workspace_id
    )

    return ContextSwitchResponse(
        access_token=new_token,
        token_type="bearer",
        organization_id=org_id,
        organization_name=organization.name,
        workspace_id=workspace_id,
        workspace_name=workspace.name if workspace else None,
        permissions=permissions
    )


@router.post("/workspace", response_model=ContextSwitchResponse)
async def switch_workspace_context(
    workspace_request: WorkspaceSwitchRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Switch to a different workspace within current organization.

    Maintains current organization context, updates workspace context.
    """
    workspace_id = workspace_request.workspace_id

    # Verify user has access to the workspace
    try:
        workspace = get_workspace(
            db=db,
            workspace_id=workspace_id,
            user_id=current_user.id
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to specified workspace"
        )

    org_id = workspace.organization_id

    # Verify user has access to the organization
    try:
        organization, _ = get_organization(
            db=db,
            organization_id=org_id,
            user_id=current_user.id
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to workspace's organization"
        )

    # Generate new JWT with updated workspace context
    new_token = create_access_token_for_user(
        db=db,
        user=current_user,
        organization_id=org_id,
        workspace_id=workspace_id
    )

    # Get updated permissions
    permissions = get_user_permissions(
        db=db,
        user_id=current_user.id,
        organization_id=org_id,
        workspace_id=workspace_id
    )

    return ContextSwitchResponse(
        access_token=new_token,
        token_type="bearer",
        organization_id=org_id,
        organization_name=organization.name,
        workspace_id=workspace_id,
        workspace_name=workspace.name,
        permissions=permissions
    )


@router.get("/current", response_model=CurrentContextResponse)
async def get_current_context(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get current user's context information.

    Returns current organization, workspace, and permissions.
    Note: In a real implementation, this would extract context from JWT.
    For now, we'll return the user's default organization and workspace.
    """
    # Get user's organizations to find a default
    from app.services.tenant_service import list_user_organizations
    user_orgs = list_user_organizations(db=db, user_id=current_user.id)

    if not user_orgs:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User has no organization memberships"
        )

    # Use first organization as current (in real implementation, this comes from JWT)
    organization, role = user_orgs[0]
    org_id = organization.id

    # Get default workspace for this organization
    from app.models.workspace import Workspace
    workspace = db.query(Workspace).filter(
        Workspace.organization_id == org_id,
        Workspace.is_default == True
    ).first()

    workspace_id = workspace.id if workspace else None

    # Get user permissions in this context
    permissions = get_user_permissions(
        db=db,
        user_id=current_user.id,
        organization_id=org_id,
        workspace_id=workspace_id
    )

    return CurrentContextResponse(
        user_id=current_user.id,
        username=current_user.username,
        organization_id=org_id,
        organization_name=organization.name,
        workspace_id=workspace_id,
        workspace_name=workspace.name if workspace else None,
        permissions=permissions
    )