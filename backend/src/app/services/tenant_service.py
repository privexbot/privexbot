"""
Tenant service - Manages multi-tenancy context and organization/workspace operations.

WHY:
- Handle organization and workspace operations
- Enforce tenant isolation
- Manage user memberships and access

HOW:
- Validate tenant boundaries
- Helper functions for tenant-safe queries
- Membership management

PSEUDOCODE:
-----------
from app.models.organization import Organization
from app.models.workspace import Workspace
from app.models.organization_member import OrganizationMember
from app.models.workspace_member import WorkspaceMember
from app.models.user import User

async def get_user_default_context(user_id: UUID, db: Session) -> dict:
    \"\"\"
    WHY: Get user's default org/workspace for initial JWT
    HOW: Return first org they belong to

    Returns: {"org_id": UUID, "ws_id": UUID | None}
    \"\"\"

    # Get first organization user belongs to
    org_member = db.query(OrganizationMember).filter(
        OrganizationMember.user_id == user_id
    ).first()

    if not org_member:
        return {"org_id": None, "ws_id": None}
            WHY: User not in any org yet (shouldn't happen after signup)

    # Get first workspace in that org (optional)
    ws_member = db.query(WorkspaceMember).join(Workspace).filter(
        WorkspaceMember.user_id == user_id,
        Workspace.organization_id == org_member.organization_id
    ).first()

    return {
        "org_id": org_member.organization_id,
        "ws_id": ws_member.workspace_id if ws_member else None
    }


async def get_user_organizations(user_id: UUID, db: Session) -> list:
    \"\"\"
    WHY: List all organizations user belongs to
    HOW: Query through organization_members

    Returns: List of orgs with user's role
    \"\"\"

    orgs = db.query(Organization, OrganizationMember.role).join(
        OrganizationMember
    ).filter(
        OrganizationMember.user_id == user_id
    ).all()

    return [
        {
            "id": org.id,
            "name": org.name,
            "role": role,
            "created_at": org.created_at
        }
        for org, role in orgs
    ]
        WHY: Include role for UI display


async def get_organization_workspaces(
    organization_id: UUID,
    user_id: UUID,
    db: Session
) -> list:
    \"\"\"
    WHY: List workspaces in org that user can access
    HOW: Filter by user membership or org admin role

    Returns: List of workspaces with user's role
    \"\"\"

    # Step 1: Check user's org role
    org_member = db.query(OrganizationMember).filter(
        OrganizationMember.user_id == user_id,
        OrganizationMember.organization_id == organization_id
    ).first()

    if not org_member:
        raise HTTPException(403, "Not a member of this organization")

    # Step 2: If owner/admin, show all workspaces
    if org_member.role in ["owner", "admin"]:
        workspaces = db.query(Workspace).filter(
            Workspace.organization_id == organization_id
        ).all()

        return [
            {
                "id": ws.id,
                "name": ws.name,
                "role": "admin",  # Org admins have admin access to all workspaces
                "chatbot_count": len(ws.chatbots),  # Relationship count
                "chatflow_count": len(ws.chatflows)  # NOTE: Separate from chatbots!
            }
            for ws in workspaces
        ]

    # Step 3: If member, show only workspaces they're part of
    ws_memberships = db.query(Workspace, WorkspaceMember.role).join(
        WorkspaceMember
    ).filter(
        WorkspaceMember.user_id == user_id,
        Workspace.organization_id == organization_id
    ).all()

    return [
        {
            "id": ws.id,
            "name": ws.name,
            "role": role,
            "chatbot_count": len(ws.chatbots),
            "chatflow_count": len(ws.chatflows)
        }
        for ws, role in ws_memberships
    ]


async def create_organization(
    name: str,
    user_id: UUID,
    db: Session
) -> Organization:
    \"\"\"
    WHY: Create new organization
    HOW: Create org and set creator as owner

    Returns: Organization object
    \"\"\"

    # Create organization
    org = Organization(
        name=name,
        created_by=user_id
    )
    db.add(org)
    db.flush()

    # Add creator as owner
    org_member = OrganizationMember(
        user_id=user_id,
        organization_id=org.id,
        role="owner"
    )
    db.add(org_member)
    db.commit()
    db.refresh(org)

    return org


async def create_workspace(
    name: str,
    organization_id: UUID,
    user_id: UUID,
    db: Session
) -> Workspace:
    \"\"\"
    WHY: Create workspace within organization
    HOW: Verify user access, create workspace

    Returns: Workspace object
    \"\"\"

    # Step 1: Verify user is org member
    org_member = db.query(OrganizationMember).filter(
        OrganizationMember.user_id == user_id,
        OrganizationMember.organization_id == organization_id
    ).first()

    if not org_member:
        raise HTTPException(403, "Not a member of this organization")

    # Step 2: Check if user has permission to create workspaces
    if org_member.role not in ["owner", "admin"]:
        raise HTTPException(403, "Only owners and admins can create workspaces")

    # Step 3: Create workspace
    workspace = Workspace(
        name=name,
        organization_id=organization_id,
        created_by=user_id
    )
    db.add(workspace)
    db.flush()

    # Step 4: Add creator as workspace admin
    ws_member = WorkspaceMember(
        user_id=user_id,
        workspace_id=workspace.id,
        role="admin"
    )
    db.add(ws_member)
    db.commit()
    db.refresh(workspace)

    return workspace


async def add_organization_member(
    organization_id: UUID,
    inviter_user_id: UUID,
    invitee_user_id: UUID,
    role: str,  # 'admin' or 'member'
    db: Session
) -> OrganizationMember:
    \"\"\"
    WHY: Invite user to organization
    HOW: Verify inviter has permission, create membership

    PERMISSION: Only owner/admin can invite
    \"\"\"

    # Step 1: Verify inviter is owner/admin
    inviter_member = db.query(OrganizationMember).filter(
        OrganizationMember.user_id == inviter_user_id,
        OrganizationMember.organization_id == organization_id
    ).first()

    if not inviter_member or inviter_member.role not in ["owner", "admin"]:
        raise HTTPException(403, "Only owners and admins can invite members")

    # Step 2: Prevent creating duplicate membership
    existing = db.query(OrganizationMember).filter(
        OrganizationMember.user_id == invitee_user_id,
        OrganizationMember.organization_id == organization_id
    ).first()

    if existing:
        raise HTTPException(400, "User is already a member")

    # Step 3: Prevent non-owners from creating owners
    if role == "owner" and inviter_member.role != "owner":
        raise HTTPException(403, "Only owners can create other owners")

    # Step 4: Create membership
    org_member = OrganizationMember(
        user_id=invitee_user_id,
        organization_id=organization_id,
        role=role
    )
    db.add(org_member)
    db.commit()

    return org_member


async def verify_tenant_access(
    user_id: UUID,
    organization_id: UUID,
    workspace_id: UUID | None,
    required_role: str | None,
    db: Session
) -> bool:
    \"\"\"
    WHY: Central function to verify tenant access
    HOW: Check org membership, optionally workspace membership

    Args:
        user_id: User to check
        organization_id: Org from JWT or request
        workspace_id: Workspace from request (optional)
        required_role: Minimum role needed (e.g., 'admin')

    Returns: True if has access
    Raises: HTTPException if no access
    \"\"\"

    # Check org membership
    org_member = db.query(OrganizationMember).filter(
        OrganizationMember.user_id == user_id,
        OrganizationMember.organization_id == organization_id
    ).first()

    if not org_member:
        raise HTTPException(403, "No access to this organization")

    # If workspace specified, check workspace access
    if workspace_id:
        # Org owners/admins have access to all workspaces
        if org_member.role in ["owner", "admin"]:
            return True

        # Otherwise check workspace membership
        ws_member = db.query(WorkspaceMember).filter(
            WorkspaceMember.user_id == user_id,
            WorkspaceMember.workspace_id == workspace_id
        ).first()

        if not ws_member:
            raise HTTPException(403, "No access to this workspace")

        # Check role if required
        if required_role:
            role_hierarchy = {"viewer": 1, "editor": 2, "admin": 3}
            if role_hierarchy.get(ws_member.role, 0) < role_hierarchy.get(required_role, 0):
                raise HTTPException(403, f"Requires {required_role} role")

    return True


TENANT ISOLATION BEST PRACTICES:
---------------------------------
WHY verify at service layer:
    - Central validation logic
    - Prevents accidental access violations
    - Easier to audit and test

HOW to use in routes:
    @router.get("/chatbots/{chatbot_id}")
    def get_chatbot(chatbot_id: UUID, current_user: User = Depends(get_current_user)):
        # Verify access first
        verify_tenant_access(current_user.id, current_user.org_id, ...)

        # Then query with tenant filter
        chatbot = db.query(Chatbot).join(Workspace).filter(
            Chatbot.id == chatbot_id,
            Workspace.organization_id == current_user.org_id
        ).first()

        if not chatbot:
            raise HTTPException(404, "Chatbot not found")

        return chatbot

WHY separate chatbot and chatflow:
    - Different models/tables
    - Different creation flows
    - chatbot: Simple form-based
    - chatflow: ReactFlow drag-and-drop nodes
"""

# ACTUAL IMPLEMENTATION
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from fastapi import HTTPException, status
from uuid import UUID
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Tuple

from app.models.user import User
from app.models.organization import Organization
from app.models.organization_member import OrganizationMember
from app.models.workspace import Workspace
from app.models.workspace_member import WorkspaceMember


# ============================================================================
# ORGANIZATION OPERATIONS
# ============================================================================

def create_organization(
    db: Session,
    name: str,
    billing_email: str,
    creator_id: UUID,
    is_default: bool = False
) -> Organization:
    """
    Create a new organization with creator as owner.

    WHY: Initialize multi-tenant organization
    HOW: Create org, add creator as owner, create default workspace

    Args:
        db: Database session
        name: Organization name
        billing_email: Billing email address
        creator_id: User creating the organization

    Returns:
        Organization: Created organization with creator as owner

    Raises:
        HTTPException: If creation fails
    """
    # Create organization with trial period
    org = Organization(
        name=name,
        billing_email=billing_email,
        subscription_tier="free",
        subscription_status="trial",
        created_by=creator_id,
        is_default=is_default
    )
    org.set_trial_period(days=30)  # 30-day trial

    db.add(org)
    db.flush()  # Get org.id before creating membership

    # Add creator as owner
    org_member = OrganizationMember(
        user_id=creator_id,
        organization_id=org.id,
        role="owner"
    )
    db.add(org_member)

    # Create default workspace
    default_workspace = Workspace(
        organization_id=org.id,
        name="Default",
        description="Default workspace for organization",
        is_default=True,
        created_by=creator_id
    )
    db.add(default_workspace)
    db.flush()

    # Add creator as workspace admin
    ws_member = WorkspaceMember(
        user_id=creator_id,
        workspace_id=default_workspace.id,
        role="admin"
    )
    db.add(ws_member)

    db.commit()
    db.refresh(org)

    return org


def get_organization(
    db: Session,
    organization_id: UUID,
    user_id: UUID
) -> Tuple[Organization, str]:
    """
    Get organization by ID with access verification.

    WHY: Ensure tenant isolation
    HOW: Verify user is org member before returning

    Args:
        db: Database session
        organization_id: Organization ID
        user_id: User requesting access

    Returns:
        Tuple[Organization, str]: (Organization object, user's role) if user has access

    Raises:
        HTTPException: If organization not found or no access
    """
    # Verify user is org member
    org_member = db.query(OrganizationMember).filter(
        OrganizationMember.organization_id == organization_id,
        OrganizationMember.user_id == user_id
    ).first()

    if not org_member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No access to this organization"
        )

    # Get organization
    org = db.query(Organization).filter(Organization.id == organization_id).first()

    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found"
        )

    return org, org_member.role


def list_user_organizations(
    db: Session,
    user_id: UUID
) -> List[Tuple[Organization, str]]:
    """
    List all organizations user belongs to with their roles.

    WHY: Allow user to see and switch between organizations
    HOW: Join Organization with OrganizationMember

    Args:
        db: Database session
        user_id: User ID

    Returns:
        List of (Organization, role) tuples
    """
    orgs = db.query(Organization, OrganizationMember.role).join(
        OrganizationMember
    ).filter(
        OrganizationMember.user_id == user_id
    ).order_by(Organization.created_at.desc()).all()

    return orgs


def update_organization(
    db: Session,
    organization_id: UUID,
    user_id: UUID,
    **kwargs
) -> Organization:
    """
    Update organization information.

    WHY: Allow org admins to modify organization settings
    HOW: Verify admin role, update fields

    Args:
        db: Database session
        organization_id: Organization ID
        user_id: User making the update
        **kwargs: Fields to update (name, billing_email, settings)

    Returns:
        Organization: Updated organization

    Raises:
        HTTPException: If no permission or org not found
    """
    # Verify user is owner or admin
    verify_organization_permission(db, organization_id, user_id, required_role="admin")

    org = db.query(Organization).filter(Organization.id == organization_id).first()

    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found"
        )

    # Update fields
    for key, value in kwargs.items():
        if value is not None and hasattr(org, key):
            setattr(org, key, value)

    db.commit()
    db.refresh(org)

    return org


def delete_organization(
    db: Session,
    organization_id: UUID,
    user_id: UUID
) -> None:
    """
    Delete organization (only owner can delete).

    WHY: Complete removal of organization and all data
    HOW: Cascade delete handles related records

    Args:
        db: Database session
        organization_id: Organization ID
        user_id: User attempting deletion

    Raises:
        HTTPException: If not owner or org not found
    """
    # Verify user is owner
    org_member = db.query(OrganizationMember).filter(
        OrganizationMember.organization_id == organization_id,
        OrganizationMember.user_id == user_id,
        OrganizationMember.role == "owner"
    ).first()

    if not org_member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only organization owner can delete organization"
        )

    org = db.query(Organization).filter(Organization.id == organization_id).first()

    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found"
        )

    # Cascade delete will handle all related records
    db.delete(org)
    db.commit()


# ============================================================================
# WORKSPACE OPERATIONS
# ============================================================================

def create_workspace(
    db: Session,
    organization_id: UUID,
    name: str,
    creator_id: UUID,
    description: Optional[str] = None,
    is_default: bool = False
) -> Workspace:
    """
    Create new workspace within organization.

    WHY: Organize chatbots/resources within organization
    HOW: Verify org membership, create workspace, add creator as admin

    Args:
        db: Database session
        organization_id: Parent organization ID
        name: Workspace name
        creator_id: User creating workspace
        description: Optional description
        is_default: Whether this is default workspace

    Returns:
        Workspace: Created workspace

    Raises:
        HTTPException: If user not org admin or duplicate name
    """
    # Verify user is org admin/owner
    verify_organization_permission(db, organization_id, creator_id, required_role="admin")

    # Check for duplicate name
    existing = db.query(Workspace).filter(
        Workspace.organization_id == organization_id,
        Workspace.name == name
    ).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Workspace name already exists in this organization"
        )

    # Create workspace
    workspace = Workspace(
        organization_id=organization_id,
        name=name,
        description=description,
        is_default=is_default,
        created_by=creator_id
    )

    db.add(workspace)
    db.flush()

    # Add creator as workspace admin
    ws_member = WorkspaceMember(
        user_id=creator_id,
        workspace_id=workspace.id,
        role="admin"
    )
    db.add(ws_member)

    db.commit()
    db.refresh(workspace)

    return workspace


def get_workspace(
    db: Session,
    workspace_id: UUID,
    user_id: UUID
) -> Workspace:
    """
    Get workspace by ID with access verification.

    WHY: Ensure tenant isolation at workspace level
    HOW: Verify user has workspace access (member or org admin)

    Args:
        db: Database session
        workspace_id: Workspace ID
        user_id: User requesting access

    Returns:
        Workspace: Workspace object if user has access

    Raises:
        HTTPException: If workspace not found or no access
    """
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()

    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found"
        )

    # Verify access
    verify_workspace_access(db, workspace_id, workspace.organization_id, user_id)

    return workspace


def list_organization_workspaces(
    db: Session,
    organization_id: UUID,
    user_id: UUID
) -> List[Workspace]:
    """
    List workspaces in organization that user can access.

    WHY: Show user their accessible workspaces
    HOW: If org admin, show all; else show only member workspaces

    Args:
        db: Database session
        organization_id: Organization ID
        user_id: User ID

    Returns:
        List of Workspace objects user can access

    Raises:
        HTTPException: If user not org member
    """
    # Verify org membership
    org_member = db.query(OrganizationMember).filter(
        OrganizationMember.organization_id == organization_id,
        OrganizationMember.user_id == user_id
    ).first()

    if not org_member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not a member of this organization"
        )

    # Org owners/admins see all workspaces
    if org_member.role in ["owner", "admin"]:
        workspaces = db.query(Workspace).filter(
            Workspace.organization_id == organization_id
        ).order_by(Workspace.is_default.desc(), Workspace.created_at).all()
    else:
        # Regular members see only their workspaces
        workspaces = db.query(Workspace).join(WorkspaceMember).filter(
            Workspace.organization_id == organization_id,
            WorkspaceMember.user_id == user_id
        ).order_by(Workspace.is_default.desc(), Workspace.created_at).all()

    return workspaces


def update_workspace(
    db: Session,
    workspace_id: UUID,
    user_id: UUID,
    **kwargs
) -> Workspace:
    """
    Update workspace information.

    WHY: Allow workspace admins to modify settings
    HOW: Verify admin role, update fields

    Args:
        db: Database session
        workspace_id: Workspace ID
        user_id: User making update
        **kwargs: Fields to update (name, description, settings)

    Returns:
        Workspace: Updated workspace

    Raises:
        HTTPException: If no permission or workspace not found
    """
    workspace = get_workspace(db, workspace_id, user_id)

    # Verify user is workspace admin or org admin
    verify_workspace_permission(
        db, workspace_id, workspace.organization_id, user_id, required_role="admin"
    )

    # Update fields
    for key, value in kwargs.items():
        if value is not None and hasattr(workspace, key):
            setattr(workspace, key, value)

    db.commit()
    db.refresh(workspace)

    return workspace


def delete_workspace(
    db: Session,
    workspace_id: UUID,
    user_id: UUID
) -> None:
    """
    Delete workspace (only admins can delete).

    WHY: Remove workspace and all its resources
    HOW: Cascade delete handles chatbots, chatflows, etc.

    Args:
        db: Database session
        workspace_id: Workspace ID
        user_id: User attempting deletion

    Raises:
        HTTPException: If not admin, default workspace, or not found
    """
    workspace = get_workspace(db, workspace_id, user_id)

    # Cannot delete default workspace
    if workspace.is_default:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete default workspace"
        )

    # Verify user is workspace admin or org owner
    verify_workspace_permission(
        db, workspace_id, workspace.organization_id, user_id, required_role="admin"
    )

    # Cascade delete will handle all related records
    db.delete(workspace)
    db.commit()


# ============================================================================
# MEMBERSHIP OPERATIONS
# ============================================================================

def add_organization_member(
    db: Session,
    organization_id: UUID,
    inviter_id: UUID,
    invitee_id: UUID,
    role: str = "member"
) -> OrganizationMember:
    """
    Add member to organization.

    WHY: Invite users to join organization
    HOW: Verify inviter has permission, create membership

    Args:
        db: Database session
        organization_id: Organization ID
        inviter_id: User sending invitation
        invitee_id: User being invited
        role: Role to assign (owner, admin, member)

    Returns:
        OrganizationMember: Created membership

    Raises:
        HTTPException: If no permission or duplicate membership
    """
    # Verify inviter is owner/admin
    verify_organization_permission(db, organization_id, inviter_id, required_role="admin")

    # Verify invitee user exists
    invitee_user = db.query(User).filter(User.id == invitee_id).first()
    if not invitee_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Check for existing membership
    existing = db.query(OrganizationMember).filter(
        OrganizationMember.organization_id == organization_id,
        OrganizationMember.user_id == invitee_id
    ).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is already a member of this organization"
        )

    # Only owners can create other owners
    if role == "owner":
        inviter_member = db.query(OrganizationMember).filter(
            OrganizationMember.organization_id == organization_id,
            OrganizationMember.user_id == inviter_id,
            OrganizationMember.role == "owner"
        ).first()

        if not inviter_member:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only owners can create other owners"
            )

    # Create membership
    org_member = OrganizationMember(
        organization_id=organization_id,
        user_id=invitee_id,
        role=role,
        invited_by=inviter_id
    )

    db.add(org_member)
    db.commit()
    db.refresh(org_member)

    return org_member


def update_organization_member_role(
    db: Session,
    organization_id: UUID,
    member_id: UUID,
    updater_id: UUID,
    new_role: str
) -> OrganizationMember:
    """
    Update organization member's role.

    WHY: Change user's permissions in organization
    HOW: Verify updater has permission, update role

    Args:
        db: Database session
        organization_id: Organization ID
        member_id: User ID of member to update
        updater_id: User making the update
        new_role: New role to assign

    Returns:
        OrganizationMember: Updated membership

    Raises:
        HTTPException: If no permission or member not found
    """
    # Verify updater is owner/admin
    verify_organization_permission(db, organization_id, updater_id, required_role="admin")

    # Get member to update by membership ID
    member = db.query(OrganizationMember).filter(
        OrganizationMember.organization_id == organization_id,
        OrganizationMember.id == member_id
    ).first()

    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found in organization"
        )

    # Only owners can promote to owner
    if new_role == "owner":
        updater_member = db.query(OrganizationMember).filter(
            OrganizationMember.organization_id == organization_id,
            OrganizationMember.user_id == updater_id,
            OrganizationMember.role == "owner"
        ).first()

        if not updater_member:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only owners can promote to owner role"
            )

    member.role = new_role
    db.commit()
    db.refresh(member)

    return member


def remove_organization_member(
    db: Session,
    organization_id: UUID,
    member_id: UUID,
    remover_id: UUID
) -> None:
    """
    Remove member from organization.

    WHY: Revoke organization access
    HOW: Verify remover has permission, delete membership

    Args:
        db: Database session
        organization_id: Organization ID
        member_id: User ID to remove
        remover_id: User removing the member

    Raises:
        HTTPException: If no permission, last owner, or member not found
    """
    # Verify remover is owner/admin
    verify_organization_permission(db, organization_id, remover_id, required_role="admin")

    # Get member to remove by membership ID
    member = db.query(OrganizationMember).filter(
        OrganizationMember.organization_id == organization_id,
        OrganizationMember.id == member_id
    ).first()

    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found in organization"
        )

    # Cannot remove last owner
    if member.role == "owner":
        owner_count = db.query(OrganizationMember).filter(
            OrganizationMember.organization_id == organization_id,
            OrganizationMember.role == "owner"
        ).count()

        if owner_count == 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot remove last owner. Transfer ownership first."
            )

    # Cascade delete will remove workspace memberships
    db.delete(member)
    db.commit()


def add_workspace_member(
    db: Session,
    workspace_id: UUID,
    inviter_id: UUID,
    invitee_id: UUID,
    role: str = "viewer"
) -> WorkspaceMember:
    """
    Add member to workspace.

    WHY: Grant workspace-level access
    HOW: Verify inviter has permission and invitee is org member

    Args:
        db: Database session
        workspace_id: Workspace ID
        inviter_id: User sending invitation
        invitee_id: User being invited
        role: Role to assign (admin, editor, viewer)

    Returns:
        WorkspaceMember: Created membership

    Raises:
        HTTPException: If no permission, not org member, or duplicate
    """
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()

    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found"
        )

    # Verify inviter has workspace admin permission
    verify_workspace_permission(
        db, workspace_id, workspace.organization_id, inviter_id, required_role="admin"
    )

    # Verify invitee is organization member
    invitee_org_member = db.query(OrganizationMember).filter(
        OrganizationMember.organization_id == workspace.organization_id,
        OrganizationMember.user_id == invitee_id
    ).first()

    if not invitee_org_member:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User must be organization member before joining workspace"
        )

    # Check for existing membership
    existing = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == workspace_id,
        WorkspaceMember.user_id == invitee_id
    ).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is already a member of this workspace"
        )

    # Create membership
    ws_member = WorkspaceMember(
        workspace_id=workspace_id,
        user_id=invitee_id,
        role=role,
        invited_by=inviter_id
    )

    db.add(ws_member)
    db.commit()
    db.refresh(ws_member)

    return ws_member


def update_workspace_member_role(
    db: Session,
    workspace_id: UUID,
    member_id: UUID,
    updater_id: UUID,
    new_role: str
) -> WorkspaceMember:
    """
    Update workspace member's role.

    WHY: Change user's workspace permissions
    HOW: Verify updater has permission, update role

    Args:
        db: Database session
        workspace_id: Workspace ID
        member_id: User ID of member to update
        updater_id: User making the update
        new_role: New role to assign

    Returns:
        WorkspaceMember: Updated membership

    Raises:
        HTTPException: If no permission or member not found
    """
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()

    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found"
        )

    # Verify updater is workspace admin or org admin
    verify_workspace_permission(
        db, workspace_id, workspace.organization_id, updater_id, required_role="admin"
    )

    # Get member to update by membership ID
    member = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == workspace_id,
        WorkspaceMember.id == member_id
    ).first()

    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found in workspace"
        )

    member.role = new_role
    db.commit()
    db.refresh(member)

    return member


def remove_workspace_member(
    db: Session,
    workspace_id: UUID,
    member_id: UUID,
    remover_id: UUID
) -> None:
    """
    Remove member from workspace.

    WHY: Revoke workspace access
    HOW: Verify remover has permission, delete membership

    Args:
        db: Database session
        workspace_id: Workspace ID
        member_id: User ID to remove
        remover_id: User removing the member

    Raises:
        HTTPException: If no permission or member not found
    """
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()

    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found"
        )

    # Verify remover is workspace admin or org admin
    verify_workspace_permission(
        db, workspace_id, workspace.organization_id, remover_id, required_role="admin"
    )

    # Get member to remove by membership ID
    member = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == workspace_id,
        WorkspaceMember.id == member_id
    ).first()

    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found in workspace"
        )

    db.delete(member)
    db.commit()


# ============================================================================
# PERMISSION VERIFICATION HELPERS
# ============================================================================

def verify_organization_permission(
    db: Session,
    organization_id: UUID,
    user_id: UUID,
    required_role: Optional[str] = None
) -> OrganizationMember:
    """
    Verify user has access to organization and optionally specific role.

    WHY: Central permission checking for organization operations
    HOW: Check OrganizationMember role

    Args:
        db: Database session
        organization_id: Organization ID
        user_id: User ID
        required_role: Minimum role required (owner, admin, member)

    Returns:
        OrganizationMember: User's membership record

    Raises:
        HTTPException: If no access or insufficient role
    """
    org_member = db.query(OrganizationMember).filter(
        OrganizationMember.organization_id == organization_id,
        OrganizationMember.user_id == user_id
    ).first()

    if not org_member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No access to this organization"
        )

    if required_role:
        role_hierarchy = {"member": 1, "admin": 2, "owner": 3}
        user_level = role_hierarchy.get(org_member.role, 0)
        required_level = role_hierarchy.get(required_role, 0)

        if user_level < required_level:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires {required_role} role or higher"
            )

    return org_member


def verify_workspace_access(
    db: Session,
    workspace_id: UUID,
    organization_id: UUID,
    user_id: UUID
) -> bool:
    """
    Verify user has access to workspace.

    WHY: Workspace-level permission checking
    HOW: Check if user is workspace member OR org admin/owner

    Args:
        db: Database session
        workspace_id: Workspace ID
        organization_id: Organization ID
        user_id: User ID

    Returns:
        bool: True if has access

    Raises:
        HTTPException: If no access
    """
    # Check org membership first
    org_member = db.query(OrganizationMember).filter(
        OrganizationMember.organization_id == organization_id,
        OrganizationMember.user_id == user_id
    ).first()

    if not org_member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No access to this organization"
        )

    # Org owners/admins have access to all workspaces
    if org_member.role in ["owner", "admin"]:
        return True

    # Check workspace membership
    ws_member = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == workspace_id,
        WorkspaceMember.user_id == user_id
    ).first()

    if not ws_member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No access to this workspace"
        )

    return True


def verify_workspace_permission(
    db: Session,
    workspace_id: UUID,
    organization_id: UUID,
    user_id: UUID,
    required_role: Optional[str] = None
) -> bool:
    """
    Verify user has specific permission level in workspace.

    WHY: Fine-grained workspace permission checking
    HOW: Check workspace role OR org admin status

    Args:
        db: Database session
        workspace_id: Workspace ID
        organization_id: Organization ID
        user_id: User ID
        required_role: Minimum workspace role (admin, editor, viewer)

    Returns:
        bool: True if has permission

    Raises:
        HTTPException: If no permission
    """
    # Verify basic access first
    verify_workspace_access(db, workspace_id, organization_id, user_id)

    # Check org role (owners/admins have admin access to all workspaces)
    org_member = db.query(OrganizationMember).filter(
        OrganizationMember.organization_id == organization_id,
        OrganizationMember.user_id == user_id
    ).first()

    if org_member and org_member.role in ["owner", "admin"]:
        return True  # Org admins have full workspace access

    if required_role:
        # Check workspace role
        ws_member = db.query(WorkspaceMember).filter(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == user_id
        ).first()

        if ws_member:
            role_hierarchy = {"viewer": 1, "editor": 2, "admin": 3}
            user_level = role_hierarchy.get(ws_member.role, 0)
            required_level = role_hierarchy.get(required_role, 0)

            if user_level < required_level:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Requires {required_role} workspace role or higher"
                )
        else:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No workspace membership found"
            )

    return True


# ============================================================================
# CONTEXT AND USER DEFAULT HELPERS
# ============================================================================

def get_user_default_context(
    db: Session,
    user_id: UUID
) -> Dict[str, Optional[UUID]]:
    """
    Get user's default organization and workspace for JWT.

    WHY: Provide initial context when user logs in
    HOW: Return first org they belong to and its default workspace

    Args:
        db: Database session
        user_id: User ID

    Returns:
        Dict with org_id and workspace_id (may be None if no orgs)
    """
    # Get first organization user belongs to
    org_member = db.query(OrganizationMember).filter(
        OrganizationMember.user_id == user_id
    ).order_by(OrganizationMember.created_at).first()

    if not org_member:
        return {"org_id": None, "workspace_id": None}

    # Get default workspace or first workspace
    workspace = db.query(Workspace).filter(
        Workspace.organization_id == org_member.organization_id,
        Workspace.is_default == True
    ).first()

    if not workspace:
        # Get first workspace if no default
        workspace = db.query(Workspace).filter(
            Workspace.organization_id == org_member.organization_id
        ).order_by(Workspace.created_at).first()

    return {
        "org_id": org_member.organization_id,
        "workspace_id": workspace.id if workspace else None
    }


def get_organization_members(
    db: Session,
    organization_id: UUID,
    user_id: UUID
) -> List[Tuple[OrganizationMember, User]]:
    """
    Get all members of an organization with user details.

    WHY: Show organization member list
    HOW: Join OrganizationMember with User

    Args:
        db: Database session
        organization_id: Organization ID
        user_id: User requesting the list

    Returns:
        List of (OrganizationMember, User) tuples

    Raises:
        HTTPException: If user not org member
    """
    # Verify user is org member
    verify_organization_permission(db, organization_id, user_id)

    members = db.query(OrganizationMember, User).join(
        User, OrganizationMember.user_id == User.id
    ).filter(
        OrganizationMember.organization_id == organization_id
    ).order_by(
        OrganizationMember.role.desc(),  # Owners first, then admins, then members
        OrganizationMember.joined_at
    ).all()

    return members


def get_workspace_members(
    db: Session,
    workspace_id: UUID,
    user_id: UUID
) -> List[Tuple[WorkspaceMember, User]]:
    """
    Get all members of a workspace with user details.

    WHY: Show workspace member list
    HOW: Join WorkspaceMember with User

    Args:
        db: Database session
        workspace_id: Workspace ID
        user_id: User requesting the list

    Returns:
        List of (WorkspaceMember, User) tuples

    Raises:
        HTTPException: If user doesn't have workspace access
    """
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()

    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found"
        )

    # Verify user has workspace access
    verify_workspace_access(db, workspace_id, workspace.organization_id, user_id)

    members = db.query(WorkspaceMember, User).join(
        User, WorkspaceMember.user_id == User.id
    ).filter(
        WorkspaceMember.workspace_id == workspace_id
    ).order_by(
        WorkspaceMember.role.desc(),  # Admins first, then editors, then viewers
        WorkspaceMember.joined_at
    ).all()

    return members
