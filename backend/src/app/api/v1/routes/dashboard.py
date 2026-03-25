"""
Dashboard Routes - API endpoints for dashboard statistics.

WHY:
- Provide aggregated statistics for the dashboard
- Real data instead of mock/fake data
- Multi-tenant workspace isolation

HOW:
- FastAPI router with authentication
- Uses DashboardService for aggregation
- Returns all dashboard data in a single endpoint
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import Optional
from uuid import UUID
from pydantic import BaseModel
from typing import List, Any, Dict

from app.db.session import get_db
from app.api.v1.dependencies import get_current_user_with_org
from app.models.user import User
from app.models.workspace import Workspace
from app.services.dashboard_service import DashboardService

# Type alias for the user context tuple
from typing import Tuple
UserContext = Tuple[User, str, str]  # (user, org_id, ws_id)

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


# ═══════════════════════════════════════════════════════════════════════════
# RESPONSE MODELS
# ═══════════════════════════════════════════════════════════════════════════

class DashboardStats(BaseModel):
    """Dashboard statistics response."""
    total_chatbots: int
    total_chatflows: int
    total_knowledge_bases: int
    total_leads: int
    total_conversations: int
    active_conversations: int
    chatbots_delta: float
    chatflows_delta: float
    knowledge_bases_delta: float
    leads_delta: float
    conversations_delta: float


class Activity(BaseModel):
    """Recent activity item."""
    id: str
    type: str
    title: str
    description: Optional[str] = None
    resource_type: Optional[str] = None
    resource_id: Optional[str] = None
    resource_name: Optional[str] = None
    timestamp: str


class ChatbotSummary(BaseModel):
    """Chatbot summary for dashboard."""
    id: str
    name: str
    description: Optional[str] = None
    status: str
    conversations_count: int = 0
    last_active_at: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    deployed_at: Optional[str] = None


class ChatflowSummary(BaseModel):
    """Chatflow summary for dashboard."""
    id: str
    name: str
    description: Optional[str] = None
    status: str = "draft"
    nodes_count: int = 0
    conversations_count: int = 0
    last_active_at: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    deployed_at: Optional[str] = None


class KnowledgeBaseSummary(BaseModel):
    """Knowledge base summary for dashboard."""
    id: str
    name: str
    description: Optional[str] = None
    status: str
    documents_count: int = 0
    total_chunks: int = 0
    last_indexed_at: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class DashboardData(BaseModel):
    """Complete dashboard data response."""
    stats: DashboardStats
    recent_activities: List[Activity]
    recent_chatbots: List[ChatbotSummary]
    recent_chatflows: List[ChatflowSummary]
    recent_knowledge_bases: List[KnowledgeBaseSummary]


# ═══════════════════════════════════════════════════════════════════════════
# ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/", response_model=DashboardData)
async def get_dashboard_data(
    workspace_id: UUID = Query(..., description="Workspace ID"),
    days: int = Query(7, ge=1, le=90, description="Period for delta calculation"),
    db: Session = Depends(get_db),
    user_context: UserContext = Depends(get_current_user_with_org)
):
    """
    Get complete dashboard data for a workspace.

    Returns:
        - Aggregated statistics (counts and deltas)
        - Recent activities
        - Recent chatbots
        - Recent chatflows
        - Recent knowledge bases

    All data is real, queried from the database with proper
    workspace isolation.
    """
    current_user, org_id, _ = user_context

    # Validate workspace access
    workspace = db.query(Workspace).filter(
        Workspace.id == workspace_id,
        Workspace.organization_id == org_id
    ).first()

    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found or access denied"
        )

    # Get dashboard data from service
    service = DashboardService(db)

    stats = service.get_workspace_stats(workspace_id, days=days)
    activities = service.get_recent_activities(workspace_id, limit=10)
    chatbots = service.get_recent_chatbots(workspace_id, limit=5)
    chatflows = service.get_recent_chatflows(workspace_id, limit=5)
    knowledge_bases = service.get_recent_knowledge_bases(workspace_id, limit=5)

    return DashboardData(
        stats=DashboardStats(**stats),
        recent_activities=[Activity(**a) for a in activities],
        recent_chatbots=[ChatbotSummary(**c) for c in chatbots],
        recent_chatflows=[ChatflowSummary(**c) for c in chatflows],
        recent_knowledge_bases=[KnowledgeBaseSummary(**k) for k in knowledge_bases],
    )


@router.get("/stats", response_model=DashboardStats)
async def get_dashboard_stats(
    workspace_id: UUID = Query(..., description="Workspace ID"),
    days: int = Query(7, ge=1, le=90, description="Period for delta calculation"),
    db: Session = Depends(get_db),
    user_context: UserContext = Depends(get_current_user_with_org)
):
    """
    Get dashboard statistics only.

    Lighter endpoint for just the stat counts and deltas.
    """
    current_user, org_id, _ = user_context

    # Validate workspace access
    workspace = db.query(Workspace).filter(
        Workspace.id == workspace_id,
        Workspace.organization_id == org_id
    ).first()

    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found or access denied"
        )

    service = DashboardService(db)
    stats = service.get_workspace_stats(workspace_id, days=days)

    return DashboardStats(**stats)


@router.get("/activities", response_model=List[Activity])
async def get_recent_activities(
    workspace_id: UUID = Query(..., description="Workspace ID"),
    limit: int = Query(10, ge=1, le=50, description="Max activities to return"),
    db: Session = Depends(get_db),
    user_context: UserContext = Depends(get_current_user_with_org)
):
    """
    Get recent activities for a workspace.
    """
    current_user, org_id, _ = user_context

    # Validate workspace access
    workspace = db.query(Workspace).filter(
        Workspace.id == workspace_id,
        Workspace.organization_id == org_id
    ).first()

    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found or access denied"
        )

    service = DashboardService(db)
    activities = service.get_recent_activities(workspace_id, limit=limit)

    return [Activity(**a) for a in activities]


@router.get("/chatbots", response_model=List[ChatbotSummary])
async def get_recent_chatbots(
    workspace_id: UUID = Query(..., description="Workspace ID"),
    limit: int = Query(5, ge=1, le=20, description="Max chatbots to return"),
    db: Session = Depends(get_db),
    user_context: UserContext = Depends(get_current_user_with_org)
):
    """
    Get recent chatbots for the dashboard.
    """
    current_user, org_id, _ = user_context

    # Validate workspace access
    workspace = db.query(Workspace).filter(
        Workspace.id == workspace_id,
        Workspace.organization_id == org_id
    ).first()

    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found or access denied"
        )

    service = DashboardService(db)
    chatbots = service.get_recent_chatbots(workspace_id, limit=limit)

    return [ChatbotSummary(**c) for c in chatbots]


@router.get("/chatflows", response_model=List[ChatflowSummary])
async def get_recent_chatflows(
    workspace_id: UUID = Query(..., description="Workspace ID"),
    limit: int = Query(5, ge=1, le=20, description="Max chatflows to return"),
    db: Session = Depends(get_db),
    user_context: UserContext = Depends(get_current_user_with_org)
):
    """
    Get recent chatflows for the dashboard.
    """
    current_user, org_id, _ = user_context

    # Validate workspace access
    workspace = db.query(Workspace).filter(
        Workspace.id == workspace_id,
        Workspace.organization_id == org_id
    ).first()

    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found or access denied"
        )

    service = DashboardService(db)
    chatflows = service.get_recent_chatflows(workspace_id, limit=limit)

    return [ChatflowSummary(**c) for c in chatflows]


@router.get("/knowledge-bases", response_model=List[KnowledgeBaseSummary])
async def get_recent_knowledge_bases(
    workspace_id: UUID = Query(..., description="Workspace ID"),
    limit: int = Query(5, ge=1, le=20, description="Max knowledge bases to return"),
    db: Session = Depends(get_db),
    user_context: UserContext = Depends(get_current_user_with_org)
):
    """
    Get recent knowledge bases for the dashboard.
    """
    current_user, org_id, _ = user_context

    # Validate workspace access
    workspace = db.query(Workspace).filter(
        Workspace.id == workspace_id,
        Workspace.organization_id == org_id
    ).first()

    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found or access denied"
        )

    service = DashboardService(db)
    knowledge_bases = service.get_recent_knowledge_bases(workspace_id, limit=limit)

    return [KnowledgeBaseSummary(**k) for k in knowledge_bases]
