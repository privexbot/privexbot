"""
Analytics Schemas - Pydantic models for aggregated analytics.

WHY:
- Validate analytics query parameters
- Type-safe analytics responses
- Consistent API interface for performance and cost metrics

HOW:
- Pydantic BaseModel
- Supports workspace and organization scopes
- Aggregates from ChatSession, ChatMessage, WidgetEvent
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from uuid import UUID
from datetime import date
from enum import Enum


class AnalyticsScope(str, Enum):
    """Analytics scope enum."""
    WORKSPACE = "workspace"
    ORGANIZATION = "organization"
    PLATFORM = "platform"  # Cross-tenant, staff-only


class AnalyticsFilters(BaseModel):
    """
    Analytics query filters.

    WHY: Configure analytics scope and time range
    HOW: Query parameters for GET /analytics
    """

    scope: AnalyticsScope = Field(
        default=AnalyticsScope.WORKSPACE,
        description="Analytics scope (workspace or organization)"
    )

    workspace_id: Optional[UUID] = Field(
        None,
        description="Workspace ID (required if scope=workspace)"
    )

    organization_id: Optional[UUID] = Field(
        None,
        description="Organization ID (required if scope=organization)"
    )

    days: int = Field(
        default=7,
        ge=1,
        le=90,
        description="Number of days to analyze (1-90)"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "scope": "workspace",
                "workspace_id": "550e8400-e29b-41d4-a716-446655440000",
                "days": 7
            }
        }


class PerformanceMetrics(BaseModel):
    """
    Chatbot performance metrics.

    WHY: Track conversation quality and engagement
    HOW: Aggregate from ChatSession and ChatMessage
    """

    total_conversations: int = Field(
        ...,
        description="Total number of chat sessions"
    )

    total_messages: int = Field(
        ...,
        description="Total number of messages exchanged"
    )

    unique_visitors: int = Field(
        ...,
        description="Unique visitors (unique session IPs)"
    )

    avg_messages_per_session: float = Field(
        ...,
        description="Average messages per conversation"
    )

    avg_response_time_ms: float = Field(
        ...,
        description="Average AI response time in milliseconds"
    )

    satisfaction_rate: float = Field(
        ...,
        description="Positive feedback rate (0-1)"
    )

    positive_feedback: int = Field(
        ...,
        description="Count of positive feedback"
    )

    negative_feedback: int = Field(
        ...,
        description="Count of negative feedback"
    )

    error_rate: float = Field(
        ...,
        description="Percentage of messages with errors (0-1)"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "total_conversations": 150,
                "total_messages": 1200,
                "unique_visitors": 85,
                "avg_messages_per_session": 8.0,
                "avg_response_time_ms": 450,
                "satisfaction_rate": 0.85,
                "positive_feedback": 42,
                "negative_feedback": 8,
                "error_rate": 0.02
            }
        }


class CostUsageMetrics(BaseModel):
    """
    Token usage and cost metrics.

    WHY: Track API costs and usage patterns
    HOW: Aggregate from ChatMessage token fields
    """

    total_prompt_tokens: int = Field(
        ...,
        description="Total prompt/input tokens used"
    )

    total_completion_tokens: int = Field(
        ...,
        description="Total completion/output tokens generated"
    )

    total_tokens: int = Field(
        ...,
        description="Total tokens (prompt + completion)"
    )

    estimated_cost_usd: float = Field(
        ...,
        description="Estimated cost in USD"
    )

    api_calls: int = Field(
        ...,
        description="Total API calls made"
    )

    avg_tokens_per_message: float = Field(
        ...,
        description="Average tokens per message"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "total_prompt_tokens": 250000,
                "total_completion_tokens": 180000,
                "total_tokens": 430000,
                "estimated_cost_usd": 0.86,
                "api_calls": 1200,
                "avg_tokens_per_message": 358
            }
        }


class DailyTrend(BaseModel):
    """
    Daily trend data point.

    WHY: Track metrics over time
    HOW: Aggregate by date
    """

    trend_date: date = Field(..., alias="date", description="Date")
    conversations: int = Field(..., description="Conversations on this day")
    messages: int = Field(..., description="Messages on this day")
    tokens: int = Field(..., description="Tokens used on this day")
    cost_usd: float = Field(..., description="Estimated cost on this day")

    model_config = {
        "populate_by_name": True,
        "json_schema_extra": {
            "example": {
                "date": "2025-01-15",
                "conversations": 20,
                "messages": 160,
                "tokens": 58000,
                "cost_usd": 0.12
            }
        }
    }


class ChatbotBreakdown(BaseModel):
    """
    Per-chatbot performance breakdown.

    WHY: Compare performance across chatbots
    HOW: Group by bot_id
    """

    chatbot_id: str = Field(..., description="Chatbot ID")
    chatbot_name: str = Field(..., description="Chatbot name")
    bot_type: str = Field(..., description="Bot type (chatbot or chatflow)")
    conversations: int = Field(..., description="Total conversations")
    messages: int = Field(..., description="Total messages")
    tokens: int = Field(..., description="Total tokens used")
    satisfaction_rate: float = Field(..., description="Satisfaction rate (0-1)")

    class Config:
        json_schema_extra = {
            "example": {
                "chatbot_id": "550e8400-e29b-41d4-a716-446655440000",
                "chatbot_name": "Support Bot",
                "bot_type": "chatbot",
                "conversations": 80,
                "messages": 640,
                "tokens": 230000,
                "satisfaction_rate": 0.9
            }
        }


class AggregatedAnalyticsResponse(BaseModel):
    """
    Complete aggregated analytics response.

    WHY: Provide comprehensive analytics dashboard data
    HOW: Combine performance, cost, trends, and breakdown
    """

    # Scope information
    scope: AnalyticsScope = Field(..., description="Analytics scope")
    scope_id: str = Field(..., description="Workspace or Organization ID")
    scope_name: str = Field(..., description="Workspace or Organization name")
    period_days: int = Field(..., description="Analysis period in days")

    # Performance metrics
    performance: PerformanceMetrics = Field(
        ...,
        description="Chatbot performance metrics"
    )

    # Cost and usage metrics
    cost_usage: CostUsageMetrics = Field(
        ...,
        description="Token usage and cost metrics"
    )

    # Daily trends
    daily_trends: List[DailyTrend] = Field(
        default_factory=list,
        description="Daily trend data"
    )

    # Per-chatbot breakdown (workspace scope only)
    chatbot_breakdown: List[ChatbotBreakdown] = Field(
        default_factory=list,
        description="Per-chatbot performance breakdown"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "scope": "workspace",
                "scope_id": "550e8400-e29b-41d4-a716-446655440000",
                "scope_name": "Marketing Team",
                "period_days": 7,
                "performance": {
                    "total_conversations": 150,
                    "total_messages": 1200,
                    "unique_visitors": 85,
                    "avg_messages_per_session": 8.0,
                    "avg_response_time_ms": 450,
                    "satisfaction_rate": 0.85,
                    "positive_feedback": 42,
                    "negative_feedback": 8,
                    "error_rate": 0.02
                },
                "cost_usage": {
                    "total_prompt_tokens": 250000,
                    "total_completion_tokens": 180000,
                    "total_tokens": 430000,
                    "estimated_cost_usd": 0.86,
                    "api_calls": 1200,
                    "avg_tokens_per_message": 358
                },
                "daily_trends": [
                    {
                        "date": "2025-01-15",
                        "conversations": 20,
                        "messages": 160,
                        "tokens": 58000,
                        "cost_usd": 0.12
                    }
                ],
                "chatbot_breakdown": [
                    {
                        "chatbot_id": "660e8400-e29b-41d4-a716-446655440000",
                        "chatbot_name": "Support Bot",
                        "bot_type": "chatbot",
                        "conversations": 80,
                        "messages": 640,
                        "tokens": 230000,
                        "satisfaction_rate": 0.9
                    }
                ]
            }
        }
