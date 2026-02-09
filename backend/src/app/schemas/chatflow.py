"""
Pydantic schemas for Chatflow API.

WHY:
- Validate chatflow creation/update data
- Support visual workflow builder (ReactFlow)
- Match frontend ChatflowBuilder expectations

HOW:
- CreateChatflowDraftRequest: Create new draft in Redis
- UpdateChatflowDraftRequest: Auto-save updates from frontend
- FinalizeChatflowRequest: Deploy draft to database
- ChatflowResponse: Return deployed chatflow data
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime


# =============================================================================
# DRAFT PHASE SCHEMAS (Phase 1 - Redis operations)
# =============================================================================

class CreateChatflowDraftRequest(BaseModel):
    """Request to create a new chatflow draft in Redis."""
    workspace_id: UUID
    initial_data: Dict[str, Any] = Field(
        default_factory=lambda: {
            "name": "Untitled Chatflow",
            "nodes": [],
            "edges": [],
            "variables": {},
            "settings": {}
        }
    )


class UpdateChatflowDraftRequest(BaseModel):
    """Request to update chatflow draft (auto-save from frontend)."""
    nodes: Optional[List[Dict[str, Any]]] = None
    edges: Optional[List[Dict[str, Any]]] = None
    name: Optional[str] = None
    description: Optional[str] = None
    variables: Optional[Dict[str, Any]] = None
    settings: Optional[Dict[str, Any]] = None


class FinalizeChatflowRequest(BaseModel):
    """Request to deploy chatflow from draft to database."""
    channels: List[Dict[str, Any]] = Field(
        default=[{"type": "website", "enabled": True, "config": {}}],
        description="Deployment channels with config"
    )


# =============================================================================
# DEPLOYED CHATFLOW SCHEMAS (Phase 3 - Database operations)
# =============================================================================

class ChatflowResponse(BaseModel):
    """Response schema for deployed chatflow."""
    id: UUID
    name: str
    description: Optional[str] = None
    workspace_id: UUID
    config: Dict[str, Any]
    version: int
    is_active: bool
    created_at: datetime
    updated_at: datetime
    deployed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ChatflowSummary(BaseModel):
    """Lightweight chatflow summary for lists."""
    id: str
    name: str
    description: Optional[str] = None
    is_active: bool
    node_count: int
    created_at: Optional[str] = None


class ChatflowListResponse(BaseModel):
    """Paginated list of chatflows."""
    items: List[ChatflowSummary]
    total: int
    skip: int
    limit: int


# =============================================================================
# DRAFT RESPONSE SCHEMAS
# =============================================================================

class DraftCreatedResponse(BaseModel):
    """Response when draft is created."""
    draft_id: str
    expires_at: str


class DraftUpdatedResponse(BaseModel):
    """Response when draft is updated."""
    status: str = "updated"
    draft_id: str


class ChatflowDeployedResponse(BaseModel):
    """Response when chatflow is deployed."""
    status: str = "deployed"
    chatflow_id: str


class ChatflowDeletedResponse(BaseModel):
    """Response when chatflow is deleted."""
    status: str = "deleted"
    chatflow_id: str
