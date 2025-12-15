"""
Pydantic schemas for Invitation API requests and responses.

WHY:
- Validate invitation operations (create, accept, cancel)
- Support email-based invitations instead of requiring UUIDs
- Track invitation status and expiration
- Enable proper consent flow

PSEUDOCODE:
-----------
from pydantic import BaseModel, EmailStr, UUID4
from datetime import datetime
from typing import Literal

# Resource Types
ResourceType = Literal["organization", "workspace"]
    WHY: Type-safe resource identification

# Invitation Status
InvitationStatus = Literal["pending", "accepted", "rejected", "expired", "cancelled"]
    WHY: Type-safe status tracking

# Create Invitation
class InvitationCreate(BaseModel):
    \"\"\"
    WHY: Invite user by email (not UUID)
    HOW: System creates token, sends email
    \"\"\"
    email: EmailStr
        WHY: Who to invite
    resource_type: ResourceType
        WHY: Organization or workspace
    resource_id: UUID4
        WHY: Which org/workspace
    role: str
        WHY: Role to assign on acceptance

# Invitation Response
class InvitationResponse(BaseModel):
    \"\"\"
    WHY: Return invitation details
    \"\"\"
    id: UUID4
    email: EmailStr
    resource_type: ResourceType
    resource_id: UUID4
    invited_role: str
    status: InvitationStatus
    invited_by: UUID4 | None
    invited_at: datetime
    expires_at: datetime
    invitation_url: str
        WHY: Full URL for email template

# Accept Invitation
class InvitationAccept(BaseModel):
    \"\"\"
    WHY: Accept or reject invitation
    \"\"\"
    accepted: bool
        WHY: True to accept, False to reject

# Invitation Details (public)
class InvitationDetails(BaseModel):
    \"\"\"
    WHY: Show invitation details to unauthenticated user
    HOW: No sensitive data, just enough to accept/reject
    \"\"\"
    resource_type: ResourceType
    resource_name: str  # Organization or workspace name
    invited_role: str
    inviter_name: str | None
    expires_at: datetime
    is_expired: bool

USAGE:
------
# Create invitation
POST /api/v1/invitations
{
    "email": "user@example.com",
    "resource_type": "organization",
    "resource_id": "org-uuid",
    "role": "admin"
}

# Accept invitation (with token)
POST /api/v1/invitations/accept?token=abc123
{
    "accepted": true
}
"""

# ACTUAL IMPLEMENTATION
from pydantic import BaseModel, EmailStr, Field, ConfigDict, field_validator
from uuid import UUID
from datetime import datetime
from typing import Optional, Literal

# Type definitions
ResourceType = Literal["organization", "workspace"]
InvitationStatus = Literal["pending", "accepted", "rejected", "expired", "cancelled"]


class InvitationCreate(BaseModel):
    """
    Schema for creating a new invitation.

    WHY: Invite users by email instead of requiring UUID lookup
    HOW: Backend generates token and sends email

    Example:
        {
            "email": "user@example.com",
            "resource_type": "organization",
            "resource_id": "123e4567-e89b-12d3-a456-426614174000",
            "role": "admin"
        }
    """
    email: EmailStr = Field(
        ...,
        description="Email address of person to invite"
    )
    resource_type: ResourceType = Field(
        ...,
        description="Type of resource (organization or workspace)"
    )
    resource_id: UUID = Field(
        ...,
        description="ID of organization or workspace"
    )
    role: str = Field(
        ...,
        description="Role to assign when invitation is accepted",
        examples=["admin", "member", "editor"]
    )

    @field_validator('role')
    @classmethod
    def validate_role(cls, v: str, info) -> str:
        """Validate role based on resource type"""
        resource_type = info.data.get('resource_type')

        if resource_type == 'organization':
            # NOTE: 'owner' role excluded - organizations should have only ONE owner
            # Owner is automatically assigned when organization is created
            valid_roles = ['admin', 'member']
        elif resource_type == 'workspace':
            valid_roles = ['admin', 'editor', 'viewer']
        else:
            valid_roles = []

        if v not in valid_roles:
            raise ValueError(f"Invalid role '{v}' for resource type '{resource_type}'")

        return v


class InvitationResponse(BaseModel):
    """
    Schema for invitation data in API responses.

    WHY: Return invitation details including URL for email
    HOW: Serialize Invitation model to JSON

    Example:
        {
            "id": "invitation-uuid",
            "email": "user@example.com",
            "resource_type": "organization",
            "resource_id": "org-uuid",
            "invited_role": "admin",
            "status": "pending",
            "invited_by": "inviter-uuid",
            "invited_at": "2024-01-15T10:30:00Z",
            "expires_at": "2024-01-22T10:30:00Z"
        }
    """
    id: UUID = Field(..., description="Invitation unique identifier")
    email: EmailStr = Field(..., description="Email address of invitee")
    resource_type: ResourceType = Field(..., description="Type of resource")
    resource_id: UUID = Field(..., description="ID of organization or workspace")
    invited_role: str = Field(..., description="Role to be assigned")
    status: InvitationStatus = Field(..., description="Current invitation status")
    invited_by: Optional[UUID] = Field(None, description="User who sent invitation")
    invited_at: datetime = Field(..., description="When invitation was sent")
    expires_at: datetime = Field(..., description="When invitation expires")
    accepted_at: Optional[datetime] = Field(None, description="When invitation was accepted")

    model_config = ConfigDict(from_attributes=True)


class InvitationDetails(BaseModel):
    """
    Schema for public invitation details (unauthenticated view).

    WHY: Show invitation info without requiring authentication
    HOW: Returns non-sensitive data for accept/reject page

    Example:
        {
            "resource_type": "organization",
            "resource_name": "Acme Corp",
            "invited_role": "admin",
            "inviter_name": "John Doe",
            "expires_at": "2024-01-22T10:30:00Z",
            "is_expired": false
        }
    """
    resource_type: ResourceType = Field(..., description="Type of resource")
    resource_name: str = Field(..., description="Name of organization or workspace")
    invited_role: str = Field(..., description="Role to be assigned")
    inviter_name: Optional[str] = Field(None, description="Name of person who sent invitation")
    expires_at: datetime = Field(..., description="When invitation expires")
    is_expired: bool = Field(..., description="Whether invitation has expired")


class InvitationAccept(BaseModel):
    """
    Schema for accepting or rejecting an invitation.

    WHY: Allow user to consent to joining
    HOW: True = accept and create membership, False = reject

    Example:
        {
            "accepted": true
        }
    """
    accepted: bool = Field(
        ...,
        description="True to accept invitation, False to reject"
    )


class InvitationResend(BaseModel):
    """
    Schema for resending an invitation (generates new token).

    WHY: Allow resending if user didn't receive email
    HOW: Creates new token, extends expiration, sends new email

    Example: Empty body, just POST to resend endpoint
    """
    pass


class InvitationList(BaseModel):
    """
    Schema for paginated invitation list responses.

    WHY: Return multiple invitations with pagination
    HOW: Used in list endpoints

    Example:
        {
            "invitations": [...],
            "total": 10,
            "pending_count": 5,
            "accepted_count": 3,
            "expired_count": 2
        }
    """
    invitations: list[InvitationResponse] = Field(
        ...,
        description="List of invitations"
    )
    total: int = Field(..., description="Total number of invitations")
    pending_count: int = Field(..., description="Number of pending invitations")
    accepted_count: int = Field(..., description="Number of accepted invitations")
    expired_count: int = Field(..., description="Number of expired invitations")


class InvitationStatistics(BaseModel):
    """
    Schema for invitation statistics.

    WHY: Show invitation metrics to organization/workspace admins
    HOW: Aggregate counts by status

    Example:
        {
            "total_sent": 50,
            "pending": 10,
            "accepted": 35,
            "rejected": 2,
            "expired": 3
        }
    """
    total_sent: int = Field(..., description="Total invitations sent")
    pending: int = Field(..., description="Pending invitations")
    accepted: int = Field(..., description="Accepted invitations")
    rejected: int = Field(..., description="Rejected invitations")
    expired: int = Field(..., description="Expired invitations")
    cancelled: int = Field(..., description="Cancelled invitations")
