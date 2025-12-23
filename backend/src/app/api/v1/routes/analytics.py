"""
Analytics Routes - API endpoints for aggregated analytics.

WHY:
- Provide comprehensive analytics for dashboard
- Support workspace and organization scopes
- Track chatbot performance and costs

HOW:
- FastAPI router
- Multi-tenant access control
- Service layer for aggregation
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import Optional
from uuid import UUID

from app.db.session import get_db
from app.api.v1.dependencies import get_current_user, get_current_user_with_org
from app.models.user import User
from app.models.workspace import Workspace
from app.models.organization import Organization
from app.models.organization_member import OrganizationMember
from app.schemas.analytics import (
    AnalyticsScope,
    AggregatedAnalyticsResponse,
)
from app.services.aggregated_analytics_service import AggregatedAnalyticsService


router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/", response_model=AggregatedAnalyticsResponse)
async def get_aggregated_analytics(
    scope: AnalyticsScope = Query(
        default=AnalyticsScope.WORKSPACE,
        description="Analytics scope (workspace or organization)"
    ),
    workspace_id: Optional[UUID] = Query(
        default=None,
        description="Workspace ID (required if scope=workspace)"
    ),
    organization_id: Optional[UUID] = Query(
        default=None,
        description="Organization ID (required if scope=organization)"
    ),
    days: int = Query(
        default=7,
        ge=1,
        le=90,
        description="Number of days to analyze (1-90)"
    ),
    db: Session = Depends(get_db),
    user_and_org: tuple = Depends(get_current_user_with_org)
):
    """
    Get aggregated analytics for workspace or organization.

    WHY: Dashboard overview of chatbot performance and costs
    HOW: Aggregate from ChatSession and ChatMessage tables

    QUERY PARAMS:
        scope: "workspace" or "organization"
        workspace_id: Required if scope=workspace
        organization_id: Required if scope=organization
        days: Time range (1-90 days, default: 7)

    RETURNS:
        AggregatedAnalyticsResponse with:
        - Performance metrics (conversations, messages, satisfaction)
        - Cost/usage metrics (tokens, estimated cost)
        - Daily trends for charts
        - Per-chatbot breakdown

    EXAMPLE:
        GET /api/v1/analytics?scope=workspace&workspace_id=uuid&days=7
        GET /api/v1/analytics?scope=organization&organization_id=uuid&days=30
    """
    user, org_id_from_token, ws_id_from_token = user_and_org

    service = AggregatedAnalyticsService(db)

    if scope == AnalyticsScope.WORKSPACE:
        # Use workspace_id from query or token
        ws_id = workspace_id or (UUID(ws_id_from_token) if ws_id_from_token else None)

        if not ws_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="workspace_id is required for workspace scope"
            )

        # Validate workspace access
        workspace = db.query(Workspace).filter(
            Workspace.id == ws_id
        ).first()

        if not workspace:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Workspace not found"
            )

        # Verify organization membership
        org_member = db.query(OrganizationMember).filter(
            OrganizationMember.organization_id == workspace.organization_id,
            OrganizationMember.user_id == user.id
        ).first()

        if not org_member:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this workspace"
            )

        return await service.get_workspace_analytics(ws_id, days)

    elif scope == AnalyticsScope.ORGANIZATION:
        # Use organization_id from query or token
        org_id = organization_id or UUID(org_id_from_token)

        # Validate organization access
        organization = db.query(Organization).filter(
            Organization.id == org_id
        ).first()

        if not organization:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Organization not found"
            )

        # Verify organization membership
        org_member = db.query(OrganizationMember).filter(
            OrganizationMember.organization_id == org_id,
            OrganizationMember.user_id == user.id
        ).first()

        if not org_member:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this organization"
            )

        return await service.get_organization_analytics(org_id, days)

    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid scope: {scope}"
        )
