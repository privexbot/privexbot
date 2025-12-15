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
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List all leads in workspace.

    WHY: Display leads in dashboard
    HOW: Query database with filters

    QUERY PARAMS:
        workspace_id: Required
        bot_id: Optional - filter by specific bot
        status: Optional - filter by status (new, contacted, qualified, converted)

    RETURNS:
        {
            "items": [...],
            "total": 42,
            "skip": 0,
            "limit": 50
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

    # Build query
    query = db.query(Lead).filter(
        Lead.workspace_id == workspace_id
    )

    # Apply filters
    if bot_id:
        query = query.filter(Lead.bot_id == bot_id)

    if status:
        query = query.filter(Lead.status == status)

    # Order by most recent
    query = query.order_by(Lead.created_at.desc())

    total = query.count()
    leads = query.offset(skip).limit(limit).all()

    return {
        "items": leads,
        "total": total,
        "skip": skip,
        "limit": limit
    }


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
    allowed_fields = ["status", "notes", "metadata"]
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

    # TODO: Implement leads_by_day aggregation
    # TODO: Implement top_bots aggregation

    return {
        "total_leads": total_leads,
        "new_leads": new_leads,
        "contacted": contacted,
        "qualified": qualified,
        "converted": converted,
        "conversion_rate": round(conversion_rate, 2),
        "leads_by_day": [],
        "top_bots": []
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
            lead.source or "",
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
            "source": lead.source,
            "metadata": lead.metadata,
            "notes": lead.notes,
            "created_at": lead.created_at.isoformat()
        }
        for lead in leads
    ]
