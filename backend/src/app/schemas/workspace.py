"""
Pydantic schemas for Workspace API requests and responses.

WHY:
- Validate workspace operations within organizations
- Handle workspace-level permissions
- Support fine-grained access control

PSEUDOCODE:
-----------
from pydantic import BaseModel, UUID4
from datetime import datetime
from typing import Literal

# Workspace Roles
WorkspaceRole = Literal["admin", "editor", "viewer"]
    WHY: Type-safe workspace permissions
    ADMIN: Full workspace control (manage members, chatbots)
    EDITOR: Can create/edit chatbots, cannot manage members
    VIEWER: Read-only access

# Create Workspace
class WorkspaceCreate(BaseModel):
    \"\"\"
    WHY: Create workspace within organization
    HOW: Organization ID from URL path parameter
    \"\"\"
    name: str (min_length=1, max_length=100)
    description: str | None (optional)

# Update Workspace
class WorkspaceUpdate(BaseModel):
    \"\"\"WHY: Partial updates\"\"\"
    name: str | None

# Workspace Response (basic)
class WorkspaceResponse(BaseModel):
    \"\"\"
    WHY: Return workspace data
    \"\"\"
    id: UUID4
    name: str
    organization_id: UUID4
    organization_name: str
        WHY: Display parent org name
    created_by: UUID4 | None
    created_at: datetime
    updated_at: datetime
    chatbot_count: int | None
        WHY: Number of bots in this workspace
    member_count: int | None

    class Config:
        from_attributes = True

# Workspace Member
class WorkspaceMemberResponse(BaseModel):
    \"\"\"
    WHY: Show member details in workspace
    \"\"\"
    user_id: UUID4
    username: str
    email: str | None
    role: WorkspaceRole
    joined_at: datetime

# Add Workspace Member
class AddWorkspaceMemberRequest(BaseModel):
    \"\"\"
    WHY: Add user to workspace
    VALIDATION: User must already be organization member
    \"\"\"
    user_id: UUID4
    role: WorkspaceRole = "viewer"
        WHY: Default to least privilege

# Update Workspace Member Role
class UpdateWorkspaceMemberRoleRequest(BaseModel):
    \"\"\"
    WHY: Change user's workspace role
    PERMISSION: Workspace admin or org admin/owner
    \"\"\"
    role: WorkspaceRole

# Workspace Detailed Response
class WorkspaceDetailedResponse(WorkspaceResponse):
    \"\"\"
    WHY: Include members and chatbots
    HOW: Used in GET /workspaces/{id}
    \"\"\"
    members: list[WorkspaceMemberResponse]
    chatbots: list[ChatbotSummary]
        WHY: Quick overview of bots in workspace

# Workspace Summary (for lists)
class WorkspaceSummary(BaseModel):
    \"\"\"
    WHY: Lightweight version for lists
    \"\"\"
    id: UUID4
    name: str
    chatbot_count: int
    user_role: WorkspaceRole | None
        WHY: Show current user's role in this workspace

PERMISSION FLOW:
----------------
When user accesses workspace:
1. Check user is org member (from org_id in JWT)
2. Check user is workspace member OR org admin/owner
3. If workspace member, check role for specific permission
4. If org admin/owner, grant admin-level access

USAGE:
------
POST /api/v1/orgs/{org_id}/workspaces
{
    "name": "Engineering Team",
    "description": "Optional description"
}
-> Creates workspace in org (org_id from URL)

POST /api/v1/workspaces/{ws_id}/members
{
    "user_id": "uuid",
    "role": "editor"
}
-> Add user to workspace as editor
"""

# ACTUAL IMPLEMENTATION
from pydantic import BaseModel, Field, ConfigDict
from uuid import UUID
from datetime import datetime
from typing import Optional, List, Literal, Dict

# Workspace Roles Type
WorkspaceRole = Literal["admin", "editor", "viewer"]
# WHY: Type-safe workspace roles with IDE autocomplete
# ADMIN: Full workspace control (manage members, create/edit/delete chatbots)
# EDITOR: Can create/edit chatbots, cannot delete or manage members
# VIEWER: Read-only access, can view chatbots and configurations


class WorkspaceCreate(BaseModel):
    """
    Schema for creating a new workspace within an organization.

    WHY: Validate workspace creation data
    HOW: Organization ID comes from URL path parameter

    Example:
        POST /api/v1/orgs/{org_id}/workspaces
        {
            "name": "Engineering Team",
            "description": "Workspace for engineering chatbots"
        }
    """
    name: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="Workspace display name",
        examples=["Engineering Team"]
    )
    description: Optional[str] = Field(
        None,
        max_length=1000,
        description="Optional workspace description"
    )
    is_default: bool = Field(
        default=False,
        description="Whether this is the default workspace for the organization"
    )


class WorkspaceUpdate(BaseModel):
    """
    Schema for updating workspace information.

    WHY: Allow partial updates to workspace
    HOW: All fields optional - only update what's provided

    Example:
        {
            "name": "New Workspace Name",
            "description": "Updated description"
        }
    """
    name: Optional[str] = Field(
        None,
        min_length=1,
        max_length=255,
        description="New workspace name"
    )
    description: Optional[str] = Field(
        None,
        max_length=1000,
        description="New workspace description"
    )
    settings: Optional[dict] = Field(
        None,
        description="Workspace settings (theme, defaults, integrations)"
    )


class WorkspaceResponse(BaseModel):
    """
    Schema for basic workspace data in API responses.

    WHY: Return workspace data without full member/chatbot lists
    HOW: Serialize Workspace model to JSON

    Example:
        {
            "id": "ws-id",
            "name": "Engineering Team",
            "organization_id": "org-id",
            "is_default": false,
            "created_at": "2024-01-15T10:30:00Z",
            "member_count": 5,
            "user_role": "admin"
        }
    """
    id: UUID = Field(..., description="Workspace unique identifier")
    organization_id: UUID = Field(..., description="Parent organization ID")
    name: str = Field(..., description="Workspace name")
    description: Optional[str] = Field(None, description="Workspace description")
    avatar_url: Optional[str] = Field(None, description="Workspace avatar/logo URL")
    is_default: bool = Field(..., description="Whether this is the default workspace")
    created_by: Optional[UUID] = Field(None, description="User who created this workspace")
    created_at: datetime = Field(..., description="Workspace creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")
    member_count: Optional[int] = Field(None, description="Number of members in workspace")
    user_role: Optional[WorkspaceRole] = Field(None, description="Current user's role in this workspace")

    model_config = ConfigDict(from_attributes=True)


class WorkspaceMemberCreate(BaseModel):
    """
    Schema for adding a member to a workspace.

    WHY: Add users to workspace with specific role
    HOW: User must already be organization member

    Example:
        {
            "user_id": "user-id",
            "role": "editor"
        }
    """
    user_id: UUID = Field(
        ...,
        description="User ID (must be organization member)"
    )
    role: WorkspaceRole = Field(
        default="viewer",
        description="Role to assign in workspace (default: viewer)"
    )


class WorkspaceMemberUpdate(BaseModel):
    """
    Schema for updating a member's role in workspace.

    WHY: Change user's workspace role
    HOW: Only workspace admin or org admin/owner can update roles

    Example:
        {
            "role": "admin"
        }
    """
    role: WorkspaceRole = Field(..., description="New role for the member")


class WorkspaceMemberResponse(BaseModel):
    """
    Schema for workspace member data in API responses.

    WHY: Show member details within workspace context
    HOW: Join WorkspaceMember with User data

    Example:
        {
            "id": "member-id",
            "user_id": "user-id",
            "username": "alice",
            "role": "editor",
            "joined_at": "2024-01-15T10:30:00Z"
        }
    """
    id: UUID = Field(..., description="Membership record ID")
    user_id: UUID = Field(..., description="User ID")
    username: str = Field(..., description="User's username")
    role: WorkspaceRole = Field(..., description="Member's role in workspace")
    invited_by: Optional[UUID] = Field(None, description="User who invited this member")
    joined_at: datetime = Field(..., description="When member joined workspace")
    created_at: datetime = Field(..., description="Membership creation timestamp")

    model_config = ConfigDict(from_attributes=True)


class ChatbotSummary(BaseModel):
    """
    Schema for chatbot summary in workspace details.

    WHY: Show basic chatbot info without full configuration
    HOW: Used in WorkspaceDetailed response

    Example:
        {
            "id": "bot-id",
            "name": "Support Bot",
            "is_active": true
        }
    """
    id: UUID = Field(..., description="Chatbot ID")
    name: str = Field(..., description="Chatbot name")
    is_active: bool = Field(..., description="Whether chatbot is active")
    created_at: datetime = Field(..., description="Chatbot creation timestamp")

    model_config = ConfigDict(from_attributes=True)


class WorkspaceDetailed(WorkspaceResponse):
    """
    Schema for detailed workspace data including members.

    WHY: Provide complete workspace information
    HOW: Used in GET /workspaces/{id} endpoint

    Example:
        {
            "id": "ws-id",
            "name": "Engineering Team",
            ...
            "members": [...],
            "settings": {...}
        }
    """
    members: List[WorkspaceMemberResponse] = Field(
        default_factory=list,
        description="List of workspace members"
    )
    settings: dict = Field(
        default_factory=dict,
        description="Workspace settings (theme, defaults, integrations)"
    )
    # NOTE: chatbots list will be added when Chatbot model is implemented
    # chatbots: List[ChatbotSummary] = Field(
    #     default_factory=list,
    #     description="List of chatbots in workspace"
    # )


class WorkspaceList(BaseModel):
    """
    Schema for paginated workspace list responses.

    WHY: Return multiple workspaces with pagination
    HOW: Used in GET /workspaces endpoint

    Example:
        {
            "workspaces": [...],
            "total": 25,
            "page": 1,
            "page_size": 10,
            "total_pages": 3,
            "has_next": true,
            "has_previous": false
        }
    """
    workspaces: List[WorkspaceResponse] = Field(
        ...,
        description="List of workspaces for current page"
    )
    total: int = Field(..., description="Total number of workspaces")
    page: int = Field(..., description="Current page number (1-indexed)")
    page_size: int = Field(..., description="Number of workspaces per page")
    total_pages: int = Field(..., description="Total number of pages")
    has_next: bool = Field(..., description="Whether there's a next page")
    has_previous: bool = Field(..., description="Whether there's a previous page")


class ContextSwitchRequest(BaseModel):
    """
    Schema for switching organization/workspace context.

    WHY: Allow users to switch between their organizations and workspaces
    HOW: Issues new JWT with updated org_id and workspace_id

    Example:
        {
            "organization_id": "org-id",
            "workspace_id": "workspace-id"
        }
    """
    organization_id: UUID = Field(
        ...,
        description="Organization ID to switch to (must be member)"
    )
    workspace_id: Optional[UUID] = Field(
        None,
        description="Workspace ID to switch to (optional, uses default if not provided)"
    )


class WorkspaceSwitchRequest(BaseModel):
    """
    Schema for switching workspace context only (keeps same organization).

    WHY: Allow users to switch workspaces within current organization
    HOW: Issues new JWT with updated workspace_id, maintains org_id

    Example:
        {
            "workspace_id": "workspace-id"
        }
    """
    workspace_id: UUID = Field(
        ...,
        description="Workspace ID to switch to (must be member and in current org)"
    )


class ContextSwitchResponse(BaseModel):
    """
    Schema for context switch response.

    WHY: Return new JWT and context information
    HOW: Contains new access token with updated org/workspace context

    Example:
        {
            "access_token": "new-jwt-token",
            "token_type": "bearer",
            "organization_id": "org-id",
            "workspace_id": "ws-id",
            "organization_name": "Acme Corp",
            "workspace_name": "Engineering"
        }
    """
    access_token: str = Field(..., description="New JWT access token")
    token_type: str = Field(default="bearer", description="Token type")
    organization_id: UUID = Field(..., description="Current organization ID")
    workspace_id: UUID = Field(..., description="Current workspace ID")
    organization_name: str = Field(..., description="Current organization name")
    workspace_name: str = Field(..., description="Current workspace name")
    permissions: Dict[str, bool] = Field(..., description="User permissions in this context")


class CurrentContextResponse(BaseModel):
    """
    Response for getting current user context.

    WHY: Shows user their current organization/workspace and permissions
    HOW: Extract context from JWT or calculate from database

    Example:
        {
            "user_id": "user-id",
            "username": "john_doe",
            "organization_id": "org-id",
            "organization_name": "Acme Corp",
            "workspace_id": "ws-id",
            "workspace_name": "Engineering",
            "permissions": {"org:read": true, "chatbot:create": true}
        }
    """
    user_id: UUID = Field(..., description="Current user ID")
    username: str = Field(..., description="Current username")
    organization_id: UUID = Field(..., description="Current organization ID")
    organization_name: str = Field(..., description="Current organization name")
    workspace_id: Optional[UUID] = Field(None, description="Current workspace ID")
    workspace_name: Optional[str] = Field(None, description="Current workspace name")
    permissions: Dict[str, bool] = Field(..., description="User permissions in this context")
