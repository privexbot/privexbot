"""
Lead Routes - API endpoints for lead management.

WHY:
- Capture leads from chatbot interactions
- Lead dashboard and analytics
- Export leads
- Lead status management

HOW:
- FastAPI router
- Multi-tenant access control
- Analytics aggregation
- CSV/JSON export

PSEUDOCODE follows the existing codebase patterns.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID
from datetime import datetime, timedelta
import csv
import io

from app.db.session import get_db
from app.api.v1.dependencies import get_current_user
from app.models.user import User
from app.models.lead import Lead

router = APIRouter(prefix="/leads", tags=["leads"])


@router.get("/")
async def list_leads(
    workspace_id: UUID,
    bot_id: Optional[UUID] = None,
    channel: Optional[str] = None,
    lead_status: Optional[str] = None,
    date_range: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List all leads in workspace with stats for dashboard.

    WHY: Display leads in dashboard
    HOW: Query database with filters, include stats

    QUERY PARAMS:
        workspace_id: Required
        bot_id: Optional - filter by specific bot
        channel: Optional - filter by platform (website, whatsapp, telegram, discord, api)
        lead_status: Optional - filter by status (new, contacted, qualified, converted)
        date_range: Optional - filter by time period (today, week, month, all)

    RETURNS:
        {
            "items": [...],
            "total": 42,
            "skip": 0,
            "limit": 50,
            "stats": {
                "total_leads": 150,
                "leads_this_week": 25,
                "leads_this_month": 80,
                "top_source": "website"
            }
        }
    """
    from sqlalchemy import func
    from app.models.workspace import Workspace

    # Validate workspace access
    workspace = db.query(Workspace).filter(
        Workspace.id == workspace_id,
        Workspace.org_id == current_user.org_id
    ).first()

    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found"
        )

    # Build query
    query = db.query(Lead).filter(
        Lead.workspace_id == workspace_id
    )

    # Apply filters
    if bot_id:
        query = query.filter(Lead.bot_id == bot_id)

    if channel:
        query = query.filter(Lead.channel == channel)

    if lead_status:
        query = query.filter(Lead.status == lead_status)

    # Apply date range filter
    if date_range and date_range != "all":
        now = datetime.utcnow()
        if date_range == "today":
            start_of_day = now.replace(hour=0, minute=0, second=0, microsecond=0)
            query = query.filter(Lead.created_at >= start_of_day)
        elif date_range == "week":
            week_ago = now - timedelta(days=7)
            query = query.filter(Lead.created_at >= week_ago)
        elif date_range == "month":
            month_ago = now - timedelta(days=30)
            query = query.filter(Lead.created_at >= month_ago)

    # Order by most recent
    query = query.order_by(Lead.created_at.desc())

    total = query.count()
    leads = query.offset(skip).limit(limit).all()

    # Calculate stats for dashboard
    now = datetime.utcnow()
    week_ago = now - timedelta(days=7)
    month_ago = now - timedelta(days=30)

    total_leads = db.query(Lead).filter(Lead.workspace_id == workspace_id).count()
    leads_this_week = db.query(Lead).filter(
        Lead.workspace_id == workspace_id,
        Lead.created_at >= week_ago
    ).count()
    leads_this_month = db.query(Lead).filter(
        Lead.workspace_id == workspace_id,
        Lead.created_at >= month_ago
    ).count()

    # Get top source/channel
    top_source_result = db.query(Lead.channel, func.count(Lead.id).label('count')).filter(
        Lead.workspace_id == workspace_id
    ).group_by(Lead.channel).order_by(func.count(Lead.id).desc()).first()

    top_source = top_source_result[0] if top_source_result else "N/A"

    return {
        "items": leads,
        "total": total,
        "skip": skip,
        "limit": limit,
        "stats": {
            "total_leads": total_leads,
            "leads_this_week": leads_this_week,
            "leads_this_month": leads_this_month,
            "top_source": top_source
        }
    }


# =============================================================================
# SPECIFIC ROUTES - Must be defined BEFORE wildcard routes
# =============================================================================

@router.get("/analytics/summary")
async def get_leads_summary(
    workspace_id: UUID,
    days: int = 30,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get leads summary analytics.

    WHY: Dashboard overview
    HOW: Aggregate from leads table

    RETURNS:
        {
            "total_leads": 150,
            "new_leads": 25,
            "contacted": 50,
            "qualified": 40,
            "converted": 35,
            "conversion_rate": 0.23,
            "leads_by_day": [
                {"date": "2025-10-01", "count": 5},
                {"date": "2025-10-02", "count": 8}
            ],
            "top_bots": [
                {"bot_id": "uuid", "bot_name": "Support Bot", "lead_count": 75}
            ]
        }
    """

    from app.models.workspace import Workspace

    # Validate workspace access
    workspace = db.query(Workspace).filter(
        Workspace.id == workspace_id,
        Workspace.org_id == current_user.org_id
    ).first()

    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found"
        )

    # Calculate date range
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=days)

    # Get total leads
    total_leads = db.query(Lead).filter(
        Lead.workspace_id == workspace_id,
        Lead.created_at >= start_date
    ).count()

    # Get leads by status
    new_leads = db.query(Lead).filter(
        Lead.workspace_id == workspace_id,
        Lead.status == "new",
        Lead.created_at >= start_date
    ).count()

    contacted = db.query(Lead).filter(
        Lead.workspace_id == workspace_id,
        Lead.status == "contacted",
        Lead.created_at >= start_date
    ).count()

    qualified = db.query(Lead).filter(
        Lead.workspace_id == workspace_id,
        Lead.status == "qualified",
        Lead.created_at >= start_date
    ).count()

    converted = db.query(Lead).filter(
        Lead.workspace_id == workspace_id,
        Lead.status == "converted",
        Lead.created_at >= start_date
    ).count()

    # Calculate conversion rate
    conversion_rate = converted / total_leads if total_leads > 0 else 0

    # Leads by day aggregation
    from sqlalchemy import func, cast, Date
    leads_by_day_query = db.query(
        cast(Lead.captured_at, Date).label('date'),
        func.count(Lead.id).label('count')
    ).filter(
        Lead.workspace_id == workspace_id,
        Lead.created_at >= start_date
    ).group_by(
        cast(Lead.captured_at, Date)
    ).order_by(
        cast(Lead.captured_at, Date)
    ).all()

    leads_by_day = [
        {"date": row.date.isoformat(), "count": row.count}
        for row in leads_by_day_query
    ]

    # Top bots aggregation
    from app.models.chatbot import Chatbot
    top_bots_query = db.query(
        Lead.bot_id,
        Lead.bot_type,
        func.count(Lead.id).label('lead_count')
    ).filter(
        Lead.workspace_id == workspace_id,
        Lead.created_at >= start_date
    ).group_by(
        Lead.bot_id,
        Lead.bot_type
    ).order_by(
        func.count(Lead.id).desc()
    ).limit(5).all()

    # Get bot names
    top_bots = []
    for row in top_bots_query:
        bot_name = "Unknown Bot"
        if row.bot_type == "chatbot":
            chatbot = db.query(Chatbot).filter(Chatbot.id == row.bot_id).first()
            if chatbot:
                bot_name = chatbot.name
        # TODO: Add chatflow name lookup when chatflow model is available
        top_bots.append({
            "bot_id": str(row.bot_id),
            "bot_type": row.bot_type,
            "bot_name": bot_name,
            "lead_count": row.lead_count
        })

    return {
        "total_leads": total_leads,
        "new_leads": new_leads,
        "contacted": contacted,
        "qualified": qualified,
        "converted": converted,
        "conversion_rate": round(conversion_rate, 2),
        "leads_by_day": leads_by_day,
        "top_bots": top_bots
    }


@router.get("/export/csv")
async def export_leads_csv(
    workspace_id: UUID,
    bot_id: Optional[UUID] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Export leads as CSV.

    WHY: Download leads for CRM
    HOW: Generate CSV file

    RETURNS:
        CSV file download
    """

    from app.models.workspace import Workspace

    # Validate workspace access
    workspace = db.query(Workspace).filter(
        Workspace.id == workspace_id,
        Workspace.org_id == current_user.org_id
    ).first()

    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found"
        )

    # Build query
    query = db.query(Lead).filter(
        Lead.workspace_id == workspace_id
    )

    if bot_id:
        query = query.filter(Lead.bot_id == bot_id)

    if status:
        query = query.filter(Lead.status == status)

    leads = query.all()

    # Generate CSV
    output = io.StringIO()
    writer = csv.writer(output)

    # Write header
    writer.writerow([
        "Lead ID",
        "Name",
        "Email",
        "Phone",
        "Status",
        "Bot ID",
        "Session ID",
        "Source",
        "Created At",
        "Notes"
    ])

    # Write rows
    for lead in leads:
        writer.writerow([
            str(lead.id),
            lead.name or "",
            lead.email or "",
            lead.phone or "",
            lead.status,
            str(lead.bot_id),
            str(lead.session_id) if lead.session_id else "",
            lead.channel or "",
            lead.created_at.isoformat(),
            lead.notes or ""
        ])

    # Return CSV file
    csv_content = output.getvalue()
    output.close()

    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=leads_{workspace_id}.csv"
        }
    )


@router.get("/export/json")
async def export_leads_json(
    workspace_id: UUID,
    bot_id: Optional[UUID] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Export leads as JSON.

    WHY: Download leads for integration
    HOW: Return JSON array

    RETURNS:
        [
            {
                "id": "uuid",
                "name": "John Doe",
                "email": "john@example.com",
                ...
            }
        ]
    """

    from app.models.workspace import Workspace

    # Validate workspace access
    workspace = db.query(Workspace).filter(
        Workspace.id == workspace_id,
        Workspace.org_id == current_user.org_id
    ).first()

    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found"
        )

    # Build query
    query = db.query(Lead).filter(
        Lead.workspace_id == workspace_id
    )

    if bot_id:
        query = query.filter(Lead.bot_id == bot_id)

    if status:
        query = query.filter(Lead.status == status)

    leads = query.all()

    # Format as JSON
    return [
        {
            "id": str(lead.id),
            "name": lead.name,
            "email": lead.email,
            "phone": lead.phone,
            "status": lead.status,
            "bot_id": str(lead.bot_id),
            "session_id": str(lead.session_id) if lead.session_id else None,
            "channel": lead.channel,
            "custom_fields": lead.custom_fields,
            "notes": lead.notes,
            "created_at": lead.created_at.isoformat()
        }
        for lead in leads
    ]


# =============================================================================
# WILDCARD ROUTES - Must be defined AFTER specific routes
# =============================================================================

@router.get("/{lead_id}")
async def get_lead(
    lead_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get single lead by ID.

    WHY: View lead details
    HOW: Query database, verify access
    """

    lead = db.query(Lead).filter(
        Lead.id == lead_id
    ).first()

    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead not found"
        )

    # Verify access
    from app.models.workspace import Workspace
    workspace = db.query(Workspace).filter(
        Workspace.id == lead.workspace_id,
        Workspace.org_id == current_user.org_id
    ).first()

    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    return lead


@router.patch("/{lead_id}")
async def update_lead(
    lead_id: UUID,
    updates: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update lead status/notes.

    WHY: Manage lead lifecycle
    HOW: Update database

    BODY:
        {
            "status": "contacted",
            "notes": "Called customer, interested in product"
        }
    """

    lead = db.query(Lead).filter(
        Lead.id == lead_id
    ).first()

    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead not found"
        )

    # Verify access
    from app.models.workspace import Workspace
    workspace = db.query(Workspace).filter(
        Workspace.id == lead.workspace_id,
        Workspace.org_id == current_user.org_id
    ).first()

    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    # Update fields
    allowed_fields = ["status", "notes", "custom_fields"]
    for key, value in updates.items():
        if key in allowed_fields and hasattr(lead, key):
            setattr(lead, key, value)

    db.commit()
    db.refresh(lead)

    return lead


@router.delete("/{lead_id}")
async def delete_lead(
    lead_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete lead.

    WHY: Remove lead
    HOW: Hard delete from database
    """

    lead = db.query(Lead).filter(
        Lead.id == lead_id
    ).first()

    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead not found"
        )

    # Verify access
    from app.models.workspace import Workspace
    workspace = db.query(Workspace).filter(
        Workspace.id == lead.workspace_id,
        Workspace.org_id == current_user.org_id
    ).first()

    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    db.delete(lead)
    db.commit()

    return {"status": "deleted"}
