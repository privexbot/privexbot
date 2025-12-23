"""
Aggregated Analytics Service - Calculate performance and cost metrics.

WHY:
- Provide comprehensive analytics for dashboard
- Support workspace and organization scopes
- Aggregate from ChatSession, ChatMessage tables

HOW:
- SQLAlchemy queries with aggregation functions
- Calculate performance metrics (conversations, messages, satisfaction)
- Calculate cost metrics (tokens, estimated cost)
- Generate daily trends and chatbot breakdowns
"""

from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from uuid import UUID
from sqlalchemy import func, cast, Date, Integer
from sqlalchemy.orm import Session

from app.models.chat_session import ChatSession, BotType
from app.models.chat_message import ChatMessage, MessageRole
from app.models.workspace import Workspace
from app.models.organization import Organization
from app.models.chatbot import Chatbot
from app.schemas.analytics import (
    AnalyticsScope,
    PerformanceMetrics,
    CostUsageMetrics,
    DailyTrend,
    ChatbotBreakdown,
    AggregatedAnalyticsResponse,
)


# Cost per 1000 tokens (configurable)
COST_PER_1K_TOKENS = 0.002


class AggregatedAnalyticsService:
    """Service for calculating aggregated analytics."""

    def __init__(self, db: Session):
        self.db = db

    async def get_workspace_analytics(
        self,
        workspace_id: UUID,
        days: int = 7
    ) -> AggregatedAnalyticsResponse:
        """
        Get analytics for a specific workspace.

        Args:
            workspace_id: The workspace ID
            days: Number of days to analyze

        Returns:
            AggregatedAnalyticsResponse with all metrics
        """
        # Get workspace info
        workspace = self.db.query(Workspace).filter(
            Workspace.id == workspace_id
        ).first()

        if not workspace:
            raise ValueError(f"Workspace {workspace_id} not found")

        # Calculate date range
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)

        # Get workspace IDs list for query
        workspace_ids = [workspace_id]

        # Calculate metrics
        performance = await self._calculate_performance_metrics(
            workspace_ids, start_date
        )
        cost_usage = await self._calculate_cost_metrics(
            workspace_ids, start_date
        )
        daily_trends = await self._get_daily_trends(
            workspace_ids, start_date
        )
        chatbot_breakdown = await self._get_chatbot_breakdown(
            workspace_ids, start_date
        )

        return AggregatedAnalyticsResponse(
            scope=AnalyticsScope.WORKSPACE,
            scope_id=str(workspace_id),
            scope_name=workspace.name,
            period_days=days,
            performance=performance,
            cost_usage=cost_usage,
            daily_trends=daily_trends,
            chatbot_breakdown=chatbot_breakdown,
        )

    async def get_organization_analytics(
        self,
        org_id: UUID,
        days: int = 7
    ) -> AggregatedAnalyticsResponse:
        """
        Get analytics for an entire organization (all workspaces).

        Args:
            org_id: The organization ID
            days: Number of days to analyze

        Returns:
            AggregatedAnalyticsResponse with all metrics
        """
        # Get organization info
        organization = self.db.query(Organization).filter(
            Organization.id == org_id
        ).first()

        if not organization:
            raise ValueError(f"Organization {org_id} not found")

        # Get all workspace IDs in the organization
        workspace_ids = [
            ws.id for ws in self.db.query(Workspace.id).filter(
                Workspace.organization_id == org_id
            ).all()
        ]

        if not workspace_ids:
            # Return empty analytics if no workspaces
            return AggregatedAnalyticsResponse(
                scope=AnalyticsScope.ORGANIZATION,
                scope_id=str(org_id),
                scope_name=organization.name,
                period_days=days,
                performance=PerformanceMetrics(
                    total_conversations=0,
                    total_messages=0,
                    unique_visitors=0,
                    avg_messages_per_session=0.0,
                    avg_response_time_ms=0.0,
                    satisfaction_rate=0.0,
                    positive_feedback=0,
                    negative_feedback=0,
                    error_rate=0.0,
                ),
                cost_usage=CostUsageMetrics(
                    total_prompt_tokens=0,
                    total_completion_tokens=0,
                    total_tokens=0,
                    estimated_cost_usd=0.0,
                    api_calls=0,
                    avg_tokens_per_message=0.0,
                ),
                daily_trends=[],
                chatbot_breakdown=[],
            )

        # Calculate date range
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)

        # Calculate metrics
        performance = await self._calculate_performance_metrics(
            workspace_ids, start_date
        )
        cost_usage = await self._calculate_cost_metrics(
            workspace_ids, start_date
        )
        daily_trends = await self._get_daily_trends(
            workspace_ids, start_date
        )
        # Chatbot breakdown is aggregated across all workspaces
        chatbot_breakdown = await self._get_chatbot_breakdown(
            workspace_ids, start_date
        )

        return AggregatedAnalyticsResponse(
            scope=AnalyticsScope.ORGANIZATION,
            scope_id=str(org_id),
            scope_name=organization.name,
            period_days=days,
            performance=performance,
            cost_usage=cost_usage,
            daily_trends=daily_trends,
            chatbot_breakdown=chatbot_breakdown,
        )

    async def _calculate_performance_metrics(
        self,
        workspace_ids: List[UUID],
        start_date: datetime
    ) -> PerformanceMetrics:
        """
        Calculate performance metrics from ChatSession and ChatMessage.
        """
        # Total conversations
        total_conversations = self.db.query(func.count(ChatSession.id)).filter(
            ChatSession.workspace_id.in_(workspace_ids),
            ChatSession.created_at >= start_date
        ).scalar() or 0

        # Total messages
        total_messages = self.db.query(func.count(ChatMessage.id)).filter(
            ChatMessage.workspace_id.in_(workspace_ids),
            ChatMessage.created_at >= start_date
        ).scalar() or 0

        # Unique visitors (by session metadata IP or session count)
        # Using distinct session IDs as proxy for unique visitors
        unique_visitors = self.db.query(
            func.count(func.distinct(ChatSession.id))
        ).filter(
            ChatSession.workspace_id.in_(workspace_ids),
            ChatSession.created_at >= start_date
        ).scalar() or 0

        # Average messages per session
        avg_messages = self.db.query(
            func.avg(ChatSession.message_count)
        ).filter(
            ChatSession.workspace_id.in_(workspace_ids),
            ChatSession.created_at >= start_date,
            ChatSession.message_count > 0
        ).scalar() or 0.0

        # Average response time (from response_metadata.latency_ms)
        # Query assistant messages with latency_ms in response_metadata
        avg_response_time = self.db.query(
            func.avg(
                ChatMessage.response_metadata['latency_ms'].astext.cast(Integer)
            )
        ).filter(
            ChatMessage.workspace_id.in_(workspace_ids),
            ChatMessage.created_at >= start_date,
            ChatMessage.role == MessageRole.ASSISTANT,
            ChatMessage.response_metadata.isnot(None),
            ChatMessage.response_metadata['latency_ms'].isnot(None)
        ).scalar() or 0.0

        # Feedback metrics
        positive_feedback = self.db.query(func.count(ChatMessage.id)).filter(
            ChatMessage.workspace_id.in_(workspace_ids),
            ChatMessage.created_at >= start_date,
            ChatMessage.feedback.isnot(None),
            ChatMessage.feedback['rating'].astext == 'positive'
        ).scalar() or 0

        negative_feedback = self.db.query(func.count(ChatMessage.id)).filter(
            ChatMessage.workspace_id.in_(workspace_ids),
            ChatMessage.created_at >= start_date,
            ChatMessage.feedback.isnot(None),
            ChatMessage.feedback['rating'].astext == 'negative'
        ).scalar() or 0

        total_feedback = positive_feedback + negative_feedback
        satisfaction_rate = (
            positive_feedback / total_feedback if total_feedback > 0 else 0.0
        )

        # Error rate
        error_messages = self.db.query(func.count(ChatMessage.id)).filter(
            ChatMessage.workspace_id.in_(workspace_ids),
            ChatMessage.created_at >= start_date,
            ChatMessage.role == MessageRole.ASSISTANT,
            ChatMessage.error.isnot(None)
        ).scalar() or 0

        assistant_messages = self.db.query(func.count(ChatMessage.id)).filter(
            ChatMessage.workspace_id.in_(workspace_ids),
            ChatMessage.created_at >= start_date,
            ChatMessage.role == MessageRole.ASSISTANT
        ).scalar() or 0

        error_rate = (
            error_messages / assistant_messages if assistant_messages > 0 else 0.0
        )

        return PerformanceMetrics(
            total_conversations=total_conversations,
            total_messages=total_messages,
            unique_visitors=unique_visitors,
            avg_messages_per_session=round(float(avg_messages), 1),
            avg_response_time_ms=round(float(avg_response_time), 0),
            satisfaction_rate=round(satisfaction_rate, 2),
            positive_feedback=positive_feedback,
            negative_feedback=negative_feedback,
            error_rate=round(error_rate, 3),
        )

    async def _calculate_cost_metrics(
        self,
        workspace_ids: List[UUID],
        start_date: datetime
    ) -> CostUsageMetrics:
        """
        Calculate cost and usage metrics from ChatMessage token fields.
        """
        # Sum of prompt tokens
        total_prompt_tokens = self.db.query(
            func.coalesce(func.sum(ChatMessage.prompt_tokens), 0)
        ).filter(
            ChatMessage.workspace_id.in_(workspace_ids),
            ChatMessage.created_at >= start_date,
            ChatMessage.role == MessageRole.ASSISTANT
        ).scalar() or 0

        # Sum of completion tokens
        total_completion_tokens = self.db.query(
            func.coalesce(func.sum(ChatMessage.completion_tokens), 0)
        ).filter(
            ChatMessage.workspace_id.in_(workspace_ids),
            ChatMessage.created_at >= start_date,
            ChatMessage.role == MessageRole.ASSISTANT
        ).scalar() or 0

        # Total tokens
        total_tokens = total_prompt_tokens + total_completion_tokens

        # Estimated cost
        estimated_cost_usd = (total_tokens / 1000) * COST_PER_1K_TOKENS

        # API calls (count of assistant messages)
        api_calls = self.db.query(func.count(ChatMessage.id)).filter(
            ChatMessage.workspace_id.in_(workspace_ids),
            ChatMessage.created_at >= start_date,
            ChatMessage.role == MessageRole.ASSISTANT
        ).scalar() or 0

        # Average tokens per message
        avg_tokens_per_message = (
            total_tokens / api_calls if api_calls > 0 else 0.0
        )

        return CostUsageMetrics(
            total_prompt_tokens=int(total_prompt_tokens),
            total_completion_tokens=int(total_completion_tokens),
            total_tokens=int(total_tokens),
            estimated_cost_usd=round(estimated_cost_usd, 2),
            api_calls=api_calls,
            avg_tokens_per_message=round(avg_tokens_per_message, 0),
        )

    async def _get_daily_trends(
        self,
        workspace_ids: List[UUID],
        start_date: datetime
    ) -> List[DailyTrend]:
        """
        Get daily trend data for charts.
        """
        # Group sessions by date
        daily_conversations = self.db.query(
            cast(ChatSession.created_at, Date).label('date'),
            func.count(ChatSession.id).label('conversations')
        ).filter(
            ChatSession.workspace_id.in_(workspace_ids),
            ChatSession.created_at >= start_date
        ).group_by(
            cast(ChatSession.created_at, Date)
        ).all()

        # Group messages and tokens by date
        daily_messages = self.db.query(
            cast(ChatMessage.created_at, Date).label('date'),
            func.count(ChatMessage.id).label('messages'),
            func.coalesce(func.sum(ChatMessage.total_tokens), 0).label('tokens')
        ).filter(
            ChatMessage.workspace_id.in_(workspace_ids),
            ChatMessage.created_at >= start_date
        ).group_by(
            cast(ChatMessage.created_at, Date)
        ).all()

        # Merge data by date
        # Using dict to store intermediate data, then create DailyTrend objects
        trends_data: Dict[Any, dict] = {}

        for row in daily_conversations:
            date_key = row.date
            if date_key not in trends_data:
                trends_data[date_key] = {
                    "conversations": 0,
                    "messages": 0,
                    "tokens": 0,
                    "cost_usd": 0.0,
                }
            trends_data[date_key]["conversations"] = row.conversations

        for row in daily_messages:
            date_key = row.date
            if date_key not in trends_data:
                trends_data[date_key] = {
                    "conversations": 0,
                    "messages": 0,
                    "tokens": 0,
                    "cost_usd": 0.0,
                }
            trends_data[date_key]["messages"] = row.messages
            trends_data[date_key]["tokens"] = int(row.tokens)
            trends_data[date_key]["cost_usd"] = round(
                (int(row.tokens) / 1000) * COST_PER_1K_TOKENS, 2
            )

        # Convert to DailyTrend objects and sort by date
        sorted_trends = [
            DailyTrend(
                trend_date=date_key,
                conversations=data["conversations"],
                messages=data["messages"],
                tokens=data["tokens"],
                cost_usd=data["cost_usd"],
            )
            for date_key, data in sorted(trends_data.items(), key=lambda x: x[0])
        ]

        return sorted_trends

    async def _get_chatbot_breakdown(
        self,
        workspace_ids: List[UUID],
        start_date: datetime
    ) -> List[ChatbotBreakdown]:
        """
        Get per-chatbot performance breakdown.
        """
        # Group sessions by bot_id and bot_type
        bot_sessions = self.db.query(
            ChatSession.bot_id,
            ChatSession.bot_type,
            func.count(ChatSession.id).label('conversations')
        ).filter(
            ChatSession.workspace_id.in_(workspace_ids),
            ChatSession.created_at >= start_date
        ).group_by(
            ChatSession.bot_id,
            ChatSession.bot_type
        ).all()

        # Get message stats per bot
        # Using subquery to join with sessions
        bot_stats: Dict[str, Dict[str, Any]] = {}

        for row in bot_sessions:
            bot_key = f"{row.bot_type.value}:{row.bot_id}"
            bot_stats[bot_key] = {
                'bot_id': str(row.bot_id),
                'bot_type': row.bot_type.value,
                'conversations': row.conversations,
                'messages': 0,
                'tokens': 0,
                'positive_feedback': 0,
                'negative_feedback': 0,
            }

        # Get message stats for each bot by joining with sessions
        for bot_key, stats in bot_stats.items():
            bot_type_str, bot_id_str = bot_key.split(':', 1)
            bot_type = BotType(bot_type_str)
            bot_id = UUID(bot_id_str)

            # Get session IDs for this bot
            session_ids = [
                s.id for s in self.db.query(ChatSession.id).filter(
                    ChatSession.bot_id == bot_id,
                    ChatSession.bot_type == bot_type,
                    ChatSession.workspace_id.in_(workspace_ids),
                    ChatSession.created_at >= start_date
                ).all()
            ]

            if session_ids:
                # Messages and tokens
                msg_stats = self.db.query(
                    func.count(ChatMessage.id).label('messages'),
                    func.coalesce(func.sum(ChatMessage.total_tokens), 0).label('tokens')
                ).filter(
                    ChatMessage.session_id.in_(session_ids)
                ).first()

                if msg_stats:
                    stats['messages'] = msg_stats.messages or 0
                    stats['tokens'] = int(msg_stats.tokens or 0)

                # Feedback - use separate count queries for reliability
                positive_count = self.db.query(func.count(ChatMessage.id)).filter(
                    ChatMessage.session_id.in_(session_ids),
                    ChatMessage.feedback.isnot(None),
                    ChatMessage.feedback['rating'].astext == 'positive'
                ).scalar() or 0

                negative_count = self.db.query(func.count(ChatMessage.id)).filter(
                    ChatMessage.session_id.in_(session_ids),
                    ChatMessage.feedback.isnot(None),
                    ChatMessage.feedback['rating'].astext == 'negative'
                ).scalar() or 0

                stats['positive_feedback'] = positive_count
                stats['negative_feedback'] = negative_count

        # Get bot names
        breakdowns: List[ChatbotBreakdown] = []

        for bot_key, stats in bot_stats.items():
            bot_name = "Unknown Bot"
            bot_id = UUID(stats['bot_id'])

            if stats['bot_type'] == 'chatbot':
                chatbot = self.db.query(Chatbot).filter(
                    Chatbot.id == bot_id
                ).first()
                if chatbot:
                    bot_name = chatbot.name

            # TODO: Add chatflow name lookup when available

            total_feedback = stats['positive_feedback'] + stats['negative_feedback']
            satisfaction_rate = (
                stats['positive_feedback'] / total_feedback
                if total_feedback > 0 else 0.0
            )

            breakdowns.append(ChatbotBreakdown(
                chatbot_id=stats['bot_id'],
                chatbot_name=bot_name,
                bot_type=stats['bot_type'],
                conversations=stats['conversations'],
                messages=stats['messages'],
                tokens=stats['tokens'],
                satisfaction_rate=round(satisfaction_rate, 2),
            ))

        # Sort by conversations descending
        breakdowns.sort(key=lambda x: x.conversations, reverse=True)

        return breakdowns[:10]  # Top 10 bots
