"""
Invitation API routes.

WHY:
- Enable email-based invitations for organizations and workspaces
- Provide consent-based membership flow
- Support invitation lifecycle management (create, accept, cancel, resend)

HOW:
- Authenticated endpoints for creating/managing invitations
- Public endpoints for accepting/rejecting invitations
- Email notifications for all invitation events

ENDPOINTS:
-----------
Organization Invitations:
  POST /orgs/{org_id}/invitations - Create organization invitation
  GET /orgs/{org_id}/invitations - List organization invitations
  DELETE /orgs/{org_id}/invitations/{inv_id} - Cancel organization invitation
  POST /orgs/{org_id}/invitations/{inv_id}/resend - Resend organization invitation

Workspace Invitations:
  POST /orgs/{org_id}/workspaces/{ws_id}/invitations - Create workspace invitation
  GET /orgs/{org_id}/workspaces/{ws_id}/invitations - List workspace invitations
  DELETE /orgs/{org_id}/workspaces/{ws_id}/invitations/{inv_id} - Cancel workspace invitation
  POST /orgs/{org_id}/workspaces/{ws_id}/invitations/{inv_id}/resend - Resend workspace invitation

Public Endpoints (No Authentication):
  GET /invitations/details - Get invitation details by token
  POST /invitations/accept - Accept invitation
  POST /invitations/reject - Reject invitation
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID

from app.api.v1.dependencies import get_db, get_current_user
from app.models.user import User
from app.core.config import settings
from app.schemas.invitation import (
    InvitationCreate,
    InvitationResponse,
    InvitationDetails,
    InvitationAccept,
    InvitationList,
)
from app.services import invitation_service

router = APIRouter()


# ============================================================================
# ORGANIZATION INVITATION MANAGEMENT
# ============================================================================

@router.post(
    "/orgs/{org_id}/invitations",
    response_model=InvitationResponse,
    status_code=status.HTTP_201_CREATED
)
async def create_organization_invitation(
    org_id: UUID,
    invitation_data: InvitationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create an invitation to join an organization.

    WHY: Invite users by email instead of requiring UUID lookup
    HOW: Creates invitation, generates token, sends email

    Requires admin or owner role in the organization.
    """
    # Validate that resource_type matches endpoint
    if invitation_data.resource_type != "organization":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Resource type must be 'organization' for organization invitations"
        )

    # Validate that resource_id matches org_id from URL
    if invitation_data.resource_id != org_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Resource ID in request body must match organization ID in URL"
        )

    invitation = invitation_service.create_invitation(
        db=db,
        email=invitation_data.email,
        resource_type="organization",
        resource_id=org_id,
        invited_role=invitation_data.role,
        inviter_id=current_user.id,
        frontend_url=settings.FRONTEND_URL
    )

    return InvitationResponse.model_validate(invitation)


@router.get("/orgs/{org_id}/invitations", response_model=List[InvitationResponse])
async def list_organization_invitations(
    org_id: UUID,
    status_filter: Optional[str] = Query(None, description="Filter by status (pending, accepted, rejected, expired, cancelled)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List all invitations for an organization.

    WHY: Show pending/accepted invitations to organization members
    HOW: Query by organization ID with optional status filter

    Requires organization membership.
    """
    invitations = invitation_service.list_invitations_for_resource(
        db=db,
        resource_type="organization",
        resource_id=org_id,
        user_id=current_user.id,
        status_filter=status_filter
    )

    return [InvitationResponse.model_validate(inv) for inv in invitations]


@router.delete(
    "/orgs/{org_id}/invitations/{invitation_id}",
    status_code=status.HTTP_204_NO_CONTENT
)
async def cancel_organization_invitation(
    org_id: UUID,
    invitation_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Cancel a pending organization invitation.

    WHY: Allow admins to revoke invitations
    HOW: Marks invitation as 'cancelled'

    Requires admin or owner role.
    """
    invitation_service.cancel_invitation(
        db=db,
        invitation_id=invitation_id,
        canceller_id=current_user.id
    )

    return None


@router.post(
    "/orgs/{org_id}/invitations/{invitation_id}/resend",
    response_model=InvitationResponse
)
async def resend_organization_invitation(
    org_id: UUID,
    invitation_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Resend an organization invitation with new token.

    WHY: User might not have received original email
    HOW: Generates new token, extends expiration, sends new email

    Requires admin or owner role.
    """
    invitation = invitation_service.resend_invitation(
        db=db,
        invitation_id=invitation_id,
        resender_id=current_user.id,
        frontend_url=settings.FRONTEND_URL
    )

    return InvitationResponse.model_validate(invitation)


# ============================================================================
# WORKSPACE INVITATION MANAGEMENT
# ============================================================================

@router.post(
    "/orgs/{org_id}/workspaces/{workspace_id}/invitations",
    response_model=InvitationResponse,
    status_code=status.HTTP_201_CREATED
)
async def create_workspace_invitation(
    org_id: UUID,
    workspace_id: UUID,
    invitation_data: InvitationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create an invitation to join a workspace.

    WHY: Invite users by email instead of requiring UUID lookup
    HOW: Creates invitation, generates token, sends email

    Requires admin role in the workspace.
    """
    # Validate that resource_type matches endpoint
    if invitation_data.resource_type != "workspace":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Resource type must be 'workspace' for workspace invitations"
        )

    # Validate that resource_id matches workspace_id from URL
    if invitation_data.resource_id != workspace_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Resource ID in request body must match workspace ID in URL"
        )

    invitation = invitation_service.create_invitation(
        db=db,
        email=invitation_data.email,
        resource_type="workspace",
        resource_id=workspace_id,
        invited_role=invitation_data.role,
        inviter_id=current_user.id,
        frontend_url=settings.FRONTEND_URL
    )

    return InvitationResponse.model_validate(invitation)


@router.get(
    "/orgs/{org_id}/workspaces/{workspace_id}/invitations",
    response_model=List[InvitationResponse]
)
async def list_workspace_invitations(
    org_id: UUID,
    workspace_id: UUID,
    status_filter: Optional[str] = Query(None, description="Filter by status (pending, accepted, rejected, expired, cancelled)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List all invitations for a workspace.

    WHY: Show pending/accepted invitations to workspace members
    HOW: Query by workspace ID with optional status filter

    Requires workspace membership.
    """
    invitations = invitation_service.list_invitations_for_resource(
        db=db,
        resource_type="workspace",
        resource_id=workspace_id,
        user_id=current_user.id,
        status_filter=status_filter
    )

    return [InvitationResponse.model_validate(inv) for inv in invitations]


@router.delete(
    "/orgs/{org_id}/workspaces/{workspace_id}/invitations/{invitation_id}",
    status_code=status.HTTP_204_NO_CONTENT
)
async def cancel_workspace_invitation(
    org_id: UUID,
    workspace_id: UUID,
    invitation_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Cancel a pending workspace invitation.

    WHY: Allow admins to revoke invitations
    HOW: Marks invitation as 'cancelled'

    Requires admin role.
    """
    invitation_service.cancel_invitation(
        db=db,
        invitation_id=invitation_id,
        canceller_id=current_user.id
    )

    return None


@router.post(
    "/orgs/{org_id}/workspaces/{workspace_id}/invitations/{invitation_id}/resend",
    response_model=InvitationResponse
)
async def resend_workspace_invitation(
    org_id: UUID,
    workspace_id: UUID,
    invitation_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Resend a workspace invitation with new token.

    WHY: User might not have received original email
    HOW: Generates new token, extends expiration, sends new email

    Requires admin role.
    """
    invitation = invitation_service.resend_invitation(
        db=db,
        invitation_id=invitation_id,
        resender_id=current_user.id,
        frontend_url=settings.FRONTEND_URL
    )

    return InvitationResponse.model_validate(invitation)


# ============================================================================
# PUBLIC INVITATION ENDPOINTS (No Authentication Required)
# ============================================================================

@router.get("/invitations/details", response_model=InvitationDetails)
async def get_invitation_details(
    token: str = Query(..., description="Invitation token from email link"),
    db: Session = Depends(get_db)
):
    """
    Get invitation details for the accept/reject page.

    WHY: Show invitation info to unauthenticated users
    HOW: Fetches invitation and related resource info by token

    This is a public endpoint (no authentication required).
    Used by the frontend accept page to show invitation details.
    """
    invitation, resource_name, inviter_name = invitation_service.get_invitation_details(
        db=db,
        token=token
    )

    return InvitationDetails(
        resource_type=invitation.resource_type,
        resource_name=resource_name,
        invited_role=invitation.invited_role,
        inviter_name=inviter_name,
        expires_at=invitation.expires_at,
        is_expired=invitation.is_expired
    )


@router.post("/invitations/accept", response_model=InvitationResponse)
async def accept_invitation(
    token: str = Query(..., description="Invitation token from email link"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Accept an invitation and create membership.

    WHY: Allow users to consent to joining org/workspace
    HOW: Creates membership and marks invitation as accepted

    User must be authenticated to accept invitation.
    Creates OrganizationMember or WorkspaceMember based on invitation type.
    """
    invitation = invitation_service.accept_invitation(
        db=db,
        token=token,
        user_id=current_user.id
    )

    return InvitationResponse.model_validate(invitation)


@router.post("/invitations/reject", response_model=InvitationResponse)
async def reject_invitation(
    token: str = Query(..., description="Invitation token from email link"),
    db: Session = Depends(get_db)
):
    """
    Reject an invitation.

    WHY: Allow users to decline invitations
    HOW: Marks invitation as 'rejected'

    This endpoint does not require authentication.
    Users can reject invitations without logging in.
    """
    invitation = invitation_service.reject_invitation(
        db=db,
        token=token
    )

    return InvitationResponse.model_validate(invitation)
