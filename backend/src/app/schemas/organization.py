"""
Pydantic schemas for Organization API requests and responses.

WHY:
- Validate organization creation/update
- Handle membership and role management
- Support multi-tenancy context

PSEUDOCODE:
-----------
from pydantic import BaseModel, UUID4
from datetime import datetime
from typing import Literal

# Organization Roles
OrgRole = Literal["owner", "admin", "member"]
    WHY: Type-safe roles
    OWNER: Full control, can delete org
    ADMIN: Can manage workspaces and members
    MEMBER: Basic access, workspace-dependent permissions

# Create Organization
class OrganizationCreate(BaseModel):
    \"\"\"
    WHY: Validate org creation
    HOW: Creator automatically becomes owner
    \"\"\"
    name: str (min_length=1, max_length=100)
        WHY: Organization display name

# Update Organization
class OrganizationUpdate(BaseModel):
    \"\"\"WHY: Partial updates allowed\"\"\"
    name: str | None

# Organization Response (basic)
class OrganizationResponse(BaseModel):
    \"\"\"
    WHY: Return organization data
    \"\"\"
    id: UUID4
    name: str
    created_by: UUID4 | None
    created_at: datetime
    updated_at: datetime
    member_count: int | None
        WHY: Show how many users in org
    workspace_count: int | None
        WHY: Show how many workspaces

    class Config:
        from_attributes = True

# Organization Member
class OrganizationMemberResponse(BaseModel):
    \"\"\"
    WHY: Show member details in org
    \"\"\"
    user_id: UUID4
    username: str
    email: str | None
    role: OrgRole
    joined_at: datetime
        WHY: When they joined the organization

# Add Member Request
class AddOrganizationMemberRequest(BaseModel):
    \"\"\"
    WHY: Invite user to organization
    HOW: Can use user_id or email
    \"\"\"
    user_id: UUID4 | None
    email: str | None
        WHY: Invite by email if user doesn't exist yet
    role: OrgRole = "member"
        WHY: Default to member, can specify admin

# Update Member Role
class UpdateMemberRoleRequest(BaseModel):
    \"\"\"
    WHY: Change user's role in org
    PERMISSION: Only owner/admin can do this
    \"\"\"
    role: OrgRole

# Organization with Members (detailed)
class OrganizationDetailedResponse(OrganizationResponse):
    \"\"\"
    WHY: Include full member list
    HOW: Used in GET /organizations/{id}
    \"\"\"
    members: list[OrganizationMemberResponse]
    workspaces: list[WorkspaceSummary]
        WHY: Show all workspaces in this org

USAGE:
------
POST /api/v1/organizations
{
    "name": "Acme Corp"
}
-> Creates org, current user becomes owner

POST /api/v1/organizations/{org_id}/members
{
    "email": "user@example.com",
    "role": "admin"
}
-> Invite user to org as admin
"""

# ACTUAL IMPLEMENTATION
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from uuid import UUID
from datetime import datetime
from typing import Optional, List, Literal

# Organization Roles Type
OrgRole = Literal["owner", "admin", "member"]
# WHY: Type-safe roles with IDE autocomplete
# OWNER: Full control, can delete org, manage billing
# ADMIN: Can manage workspaces and members
# MEMBER: Basic access, workspace-dependent permissions

# Subscription Tiers Type
SubscriptionTier = Literal["free", "starter", "pro", "enterprise"]
# WHY: Type-safe subscription tiers
# FREE: Limited features, trial mode
# STARTER: Basic paid features
# PRO: Advanced features
# ENTERPRISE: Full features with custom limits

# Subscription Status Type
SubscriptionStatus = Literal["trial", "active", "cancelled", "suspended"]


class OrganizationCreate(BaseModel):
    """
    Schema for creating a new organization.

    WHY: Validate organization creation data
    HOW: Creator automatically becomes owner via OrganizationMember

    Example:
        {
            "name": "Acme Corporation",
            "billing_email": "billing@acme.com"
        }
    """
    name: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="Organization display name",
        examples=["Acme Corporation"]
    )
    billing_email: EmailStr = Field(
        ...,
        description="Email address for billing and subscription notifications"
    )


class OrganizationUpdate(BaseModel):
    """
    Schema for updating organization information.

    WHY: Allow partial updates to organization
    HOW: All fields optional - only update what's provided

    Example:
        {
            "name": "New Organization Name",
            "billing_email": "new_billing@acme.com"
        }
    """
    name: Optional[str] = Field(
        None,
        min_length=1,
        max_length=255,
        description="New organization name"
    )
    billing_email: Optional[EmailStr] = Field(
        None,
        description="New billing email address"
    )
    settings: Optional[dict] = Field(
        None,
        description="Organization settings (branding, defaults, features)"
    )


class OrganizationResponse(BaseModel):
    """
    Schema for basic organization data in API responses.

    WHY: Return organization data without sensitive billing information
    HOW: Serialize Organization model to JSON

    Example:
        {
            "id": "123e4567-e89b-12d3-a456-426614174000",
            "name": "Acme Corporation",
            "subscription_tier": "pro",
            "subscription_status": "active",
            "created_at": "2024-01-15T10:30:00Z",
            "updated_at": "2024-01-15T10:30:00Z",
            "member_count": 5,
            "workspace_count": 3
        }
    """
    id: UUID = Field(..., description="Organization unique identifier")
    name: str = Field(..., description="Organization name")
    billing_email: str = Field(..., description="Billing email address")
    avatar_url: Optional[str] = Field(None, description="Organization avatar/logo URL")
    subscription_tier: SubscriptionTier = Field(..., description="Current subscription tier")
    subscription_status: SubscriptionStatus = Field(..., description="Current subscription status")
    trial_ends_at: Optional[datetime] = Field(None, description="When trial period ends (if in trial)")
    created_by: Optional[UUID] = Field(None, description="User who created this organization")
    created_at: datetime = Field(..., description="Organization creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")
    member_count: Optional[int] = Field(None, description="Number of members in organization")
    workspace_count: Optional[int] = Field(None, description="Number of workspaces in organization")
    is_default: bool = Field(..., description="Whether this is the user's personal organization")
    user_role: Optional[OrgRole] = Field(None, description="Current user's role in this organization")

    model_config = ConfigDict(from_attributes=True)


class OrganizationMemberCreate(BaseModel):
    """
    Schema for adding a member to an organization.

    WHY: Invite users to organization with specific role
    HOW: Can use user_id (existing user) or email (invite new user)

    Example:
        {
            "user_id": "123e4567-e89b-12d3-a456-426614174000",
            "role": "admin"
        }

    Or:
        {
            "email": "newuser@example.com",
            "role": "member"
        }
    """
    user_id: Optional[UUID] = Field(
        None,
        description="User ID (for existing users)"
    )
    email: Optional[EmailStr] = Field(
        None,
        description="Email address (for inviting new users)"
    )
    role: OrgRole = Field(
        default="member",
        description="Role to assign to the member"
    )


class OrganizationMemberUpdate(BaseModel):
    """
    Schema for updating a member's role in organization.

    WHY: Change user's role in organization
    HOW: Only owner/admin can update roles

    Example:
        {
            "role": "admin"
        }
    """
    role: OrgRole = Field(..., description="New role for the member")


class OrganizationMemberResponse(BaseModel):
    """
    Schema for organization member data in API responses.

    WHY: Show member details within organization context
    HOW: Join OrganizationMember with User data

    Example:
        {
            "id": "member-id",
            "user_id": "user-id",
            "username": "alice",
            "role": "admin",
            "joined_at": "2024-01-15T10:30:00Z"
        }
    """
    id: UUID = Field(..., description="Membership record ID")
    user_id: UUID = Field(..., description="User ID")
    username: str = Field(..., description="User's username")
    role: OrgRole = Field(..., description="Member's role in organization")
    invited_by: Optional[UUID] = Field(None, description="User who invited this member")
    joined_at: datetime = Field(..., description="When member joined organization")
    created_at: datetime = Field(..., description="Membership creation timestamp")

    model_config = ConfigDict(from_attributes=True)


class WorkspaceSummary(BaseModel):
    """
    Schema for workspace summary in organization details.

    WHY: Show basic workspace info without full details
    HOW: Used in OrganizationDetailed response

    Example:
        {
            "id": "ws-id",
            "name": "Engineering",
            "is_default": true
        }
    """
    id: UUID = Field(..., description="Workspace ID")
    name: str = Field(..., description="Workspace name")
    description: Optional[str] = Field(None, description="Workspace description")
    avatar_url: Optional[str] = Field(None, description="Workspace avatar URL")
    is_default: bool = Field(..., description="Whether this is the default workspace")
    created_at: datetime = Field(..., description="Workspace creation timestamp")
    user_role: Optional[str] = Field(None, description="Current user's role in this workspace")
    member_count: Optional[int] = Field(None, description="Number of members in this workspace")

    model_config = ConfigDict(from_attributes=True)


class OrganizationDetailed(OrganizationResponse):
    """
    Schema for detailed organization data including members and workspaces.

    WHY: Provide complete organization information
    HOW: Used in GET /organizations/{id} endpoint

    Example:
        {
            "id": "org-id",
            "name": "Acme Corporation",
            ...
            "members": [...],
            "workspaces": [...]
        }
    """
    members: List[OrganizationMemberResponse] = Field(
        default_factory=list,
        description="List of organization members"
    )
    workspaces: List[WorkspaceSummary] = Field(
        default_factory=list,
        description="List of workspaces in organization"
    )
    settings: dict = Field(
        default_factory=dict,
        description="Organization settings (branding, defaults, features)"
    )


class OrganizationList(BaseModel):
    """
    Schema for paginated organization list responses.

    WHY: Return multiple organizations with pagination
    HOW: Used in GET /organizations endpoint

    Example:
        {
            "organizations": [...],
            "total": 50,
            "page": 1,
            "page_size": 10,
            "total_pages": 5,
            "has_next": true,
            "has_previous": false
        }
    """
    organizations: List[OrganizationResponse] = Field(
        ...,
        description="List of organizations for current page"
    )
    total: int = Field(..., description="Total number of organizations")
    page: int = Field(..., description="Current page number (1-indexed)")
    page_size: int = Field(..., description="Number of organizations per page")
    total_pages: int = Field(..., description="Total number of pages")
    has_next: bool = Field(..., description="Whether there's a next page")
    has_previous: bool = Field(..., description="Whether there's a previous page")
