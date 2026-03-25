"""
Admin Schemas - Pydantic models for admin/backoffice endpoints.

WHY:
- Type validation for admin API responses
- Consistent response structure
- Auto-generated API docs

HOW:
- Define response models for each admin endpoint
- Use Optional for nullable fields
- Include pagination in list responses
"""

from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel


# ============== System Stats ==============

class SystemStats(BaseModel):
    """System-wide statistics for admin dashboard."""
    total_users: int
    total_organizations: int
    total_workspaces: int
    total_chatbots: int
    total_chatflows: int
    total_knowledge_bases: int
    active_users_7d: int
    new_users_7d: int
    new_users_30d: int
    new_organizations_7d: int


# ============== Organizations ==============

class OrganizationListItem(BaseModel):
    """Organization item in list view."""
    id: str
    name: str
    billing_email: Optional[str] = None
    subscription_tier: Optional[str] = None
    subscription_status: Optional[str] = None
    created_at: Optional[str] = None
    member_count: int
    workspace_count: int


class OrganizationListResponse(BaseModel):
    """Paginated list of organizations."""
    items: List[OrganizationListItem]
    total: int
    limit: int
    offset: int


class WorkspaceDetail(BaseModel):
    """Workspace info within organization detail."""
    id: str
    name: str
    is_default: bool
    created_at: Optional[str] = None
    chatbot_count: int
    chatflow_count: int
    kb_count: int


class OrgMemberDetail(BaseModel):
    """Member info within organization detail."""
    user_id: str
    username: str
    role: str
    is_active: bool
    joined_at: Optional[str] = None


class OrganizationDetail(BaseModel):
    """Detailed organization information."""
    id: str
    name: str
    billing_email: Optional[str] = None
    subscription_tier: Optional[str] = None
    subscription_status: Optional[str] = None
    created_at: Optional[str] = None
    settings: Optional[Dict[str, Any]] = None
    workspaces: List[WorkspaceDetail]
    members: List[OrgMemberDetail]


# ============== Users ==============

class UserListItem(BaseModel):
    """User item in list view."""
    id: str
    username: str
    email: Optional[str] = None
    is_active: bool
    is_staff: bool
    created_at: Optional[str] = None
    organization_count: int


class UserListResponse(BaseModel):
    """Paginated list of users."""
    items: List[UserListItem]
    total: int
    limit: int
    offset: int


class AuthMethodDetail(BaseModel):
    """Auth method info for user detail."""
    provider: str
    identifier: str
    created_at: Optional[str] = None


class UserOrgMembership(BaseModel):
    """Organization membership for user detail."""
    id: str
    name: str
    role: str
    joined_at: Optional[str] = None


class UserWorkspaceMembership(BaseModel):
    """Workspace membership for user detail."""
    id: str
    name: str
    organization_id: str
    role: str


class UserDetail(BaseModel):
    """Detailed user information."""
    id: str
    username: str
    is_active: bool
    is_staff: bool
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    auth_methods: List[AuthMethodDetail]
    organizations: List[UserOrgMembership]
    workspaces: List[UserWorkspaceMembership]


# ============== User Resources ==============

class ResourceItem(BaseModel):
    """Generic resource item (chatbot, chatflow, or KB)."""
    id: str
    name: str
    status: Optional[str] = None
    workspace_id: str
    created_at: Optional[str] = None


class ResourceTotals(BaseModel):
    """Totals for user resources."""
    chatbots: int
    chatflows: int
    knowledge_bases: int


class UserResources(BaseModel):
    """All resources created by a user."""
    user_id: str
    chatbots: List[ResourceItem]
    chatflows: List[ResourceItem]
    knowledge_bases: List[ResourceItem]
    totals: ResourceTotals


# ============== Staff Management ==============

class UpdateStaffStatusRequest(BaseModel):
    """Request to update user's staff status."""
    is_staff: bool


class UpdateStaffStatusResponse(BaseModel):
    """Response after updating user's staff status."""
    user_id: str
    username: str
    is_staff: bool
    message: str
