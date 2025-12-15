"""
Lead Schemas - Pydantic models for lead management.

WHY:
- Validate lead data
- Type-safe lead operations
- Consistent API interface

HOW:
- Pydantic BaseModel
- Field validation
- Status enums

PSEUDOCODE follows the existing codebase patterns.
"""

from pydantic import BaseModel, Field, EmailStr
from typing import Optional, Dict, Any, List
from uuid import UUID
from datetime import datetime
from enum import Enum


class LeadStatus(str, Enum):
    """Lead status enum."""
    NEW = "new"
    CONTACTED = "contacted"
    QUALIFIED = "qualified"
    CONVERTED = "converted"
    LOST = "lost"


class LeadSource(str, Enum):
    """Lead source enum."""
    WEBSITE = "website"
    TELEGRAM = "telegram"
    DISCORD = "discord"
    WHATSAPP = "whatsapp"
    ZAPIER = "zapier"
    API = "api"


class LeadCreate(BaseModel):
    """
    Lead creation schema.

    WHY: Validate lead creation
    HOW: Required and optional fields
    """

    bot_id: UUID = Field(..., description="Bot ID that captured the lead")
    session_id: UUID = Field(..., description="Chat session ID")

    name: Optional[str] = Field(
        None,
        description="Lead name",
        max_length=200
    )

    email: Optional[EmailStr] = Field(
        None,
        description="Lead email"
    )

    phone: Optional[str] = Field(
        None,
        description="Lead phone number",
        max_length=50
    )

    source: LeadSource = Field(
        ...,
        description="Lead source channel"
    )

    metadata: Optional[Dict[str, Any]] = Field(
        default_factory=dict,
        description="Additional lead data"
    )

    notes: Optional[str] = Field(
        None,
        description="Initial notes",
        max_length=2000
    )

    class Config:
        json_schema_extra = {
            "example": {
                "bot_id": "550e8400-e29b-41d4-a716-446655440000",
                "session_id": "660e8400-e29b-41d4-a716-446655440000",
                "name": "John Doe",
                "email": "john@example.com",
                "phone": "+1234567890",
                "source": "website",
                "metadata": {
                    "company": "Acme Inc",
                    "interest": "Enterprise plan",
                    "budget": "$10k-$50k"
                },
                "notes": "Interested in enterprise features"
            }
        }


class LeadUpdate(BaseModel):
    """
    Lead update schema.

    WHY: Update lead information
    HOW: All fields optional
    """

    status: Optional[LeadStatus] = Field(
        None,
        description="Lead status"
    )

    name: Optional[str] = Field(
        None,
        description="Lead name",
        max_length=200
    )

    email: Optional[EmailStr] = Field(
        None,
        description="Lead email"
    )

    phone: Optional[str] = Field(
        None,
        description="Lead phone number",
        max_length=50
    )

    notes: Optional[str] = Field(
        None,
        description="Lead notes",
        max_length=2000
    )

    metadata: Optional[Dict[str, Any]] = Field(
        None,
        description="Additional lead data"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "status": "contacted",
                "notes": "Called customer, scheduled demo for next week",
                "metadata": {
                    "demo_scheduled": "2025-10-15T14:00:00Z"
                }
            }
        }


class LeadResponse(BaseModel):
    """
    Lead response schema.

    WHY: Return lead data
    HOW: Complete lead information
    """

    id: UUID = Field(..., description="Lead ID")
    workspace_id: UUID = Field(..., description="Workspace ID")
    bot_id: UUID = Field(..., description="Bot ID")
    session_id: UUID = Field(..., description="Session ID")

    name: Optional[str] = Field(None, description="Lead name")
    email: Optional[str] = Field(None, description="Lead email")
    phone: Optional[str] = Field(None, description="Lead phone")

    status: LeadStatus = Field(..., description="Lead status")
    source: str = Field(..., description="Lead source")

    metadata: Dict[str, Any] = Field(default_factory=dict, description="Lead metadata")
    notes: Optional[str] = Field(None, description="Lead notes")

    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")

    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "id": "550e8400-e29b-41d4-a716-446655440000",
                "workspace_id": "660e8400-e29b-41d4-a716-446655440000",
                "bot_id": "770e8400-e29b-41d4-a716-446655440000",
                "session_id": "880e8400-e29b-41d4-a716-446655440000",
                "name": "John Doe",
                "email": "john@example.com",
                "phone": "+1234567890",
                "status": "new",
                "source": "website",
                "metadata": {
                    "company": "Acme Inc",
                    "interest": "Enterprise plan"
                },
                "notes": "Interested in enterprise features",
                "created_at": "2025-10-01T12:00:00Z",
                "updated_at": "2025-10-01T12:00:00Z"
            }
        }


class LeadListResponse(BaseModel):
    """
    Lead list response schema.

    WHY: Return paginated leads
    HOW: Items + pagination info
    """

    items: List[LeadResponse] = Field(..., description="List of leads")
    total: int = Field(..., description="Total count")
    skip: int = Field(..., description="Offset")
    limit: int = Field(..., description="Limit")

    class Config:
        json_schema_extra = {
            "example": {
                "items": [
                    {
                        "id": "550e8400-e29b-41d4-a716-446655440000",
                        "workspace_id": "660e8400-e29b-41d4-a716-446655440000",
                        "bot_id": "770e8400-e29b-41d4-a716-446655440000",
                        "session_id": "880e8400-e29b-41d4-a716-446655440000",
                        "name": "John Doe",
                        "email": "john@example.com",
                        "status": "new",
                        "source": "website",
                        "created_at": "2025-10-01T12:00:00Z"
                    }
                ],
                "total": 150,
                "skip": 0,
                "limit": 50
            }
        }


class LeadAnalyticsResponse(BaseModel):
    """
    Lead analytics response schema.

    WHY: Return lead analytics
    HOW: Aggregated statistics
    """

    total_leads: int = Field(..., description="Total leads")
    new_leads: int = Field(..., description="New leads")
    contacted: int = Field(..., description="Contacted leads")
    qualified: int = Field(..., description="Qualified leads")
    converted: int = Field(..., description="Converted leads")
    conversion_rate: float = Field(..., description="Conversion rate (0-1)")

    leads_by_day: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Leads grouped by day"
    )

    top_bots: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Top bots by lead count"
    )

    top_sources: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Top sources by lead count"
    )

    class Config:
        json_schema_extra = {
            "example": {
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
                    {
                        "bot_id": "550e8400-e29b-41d4-a716-446655440000",
                        "bot_name": "Support Bot",
                        "lead_count": 75
                    }
                ],
                "top_sources": [
                    {"source": "website", "count": 80},
                    {"source": "telegram", "count": 70}
                ]
            }
        }


class LeadExportRequest(BaseModel):
    """
    Lead export request schema.

    WHY: Configure export filters
    HOW: Optional filters
    """

    workspace_id: UUID = Field(..., description="Workspace ID")
    bot_id: Optional[UUID] = Field(None, description="Filter by bot")
    status: Optional[LeadStatus] = Field(None, description="Filter by status")
    format: str = Field("csv", description="Export format (csv or json)")

    class Config:
        json_schema_extra = {
            "example": {
                "workspace_id": "550e8400-e29b-41d4-a716-446655440000",
                "bot_id": "660e8400-e29b-41d4-a716-446655440000",
                "status": "new",
                "format": "csv"
            }
        }
