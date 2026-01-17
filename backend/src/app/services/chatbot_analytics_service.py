"""
Chatbot Analytics Service - Track and analyze chatbot usage.

WHY:
- Provide chatbot owners with usage insights
- Track widget events and chat metrics
- Generate dashboard data for frontend

HOW:
- Store widget events in database
- Aggregate metrics by time periods
- Calculate key performance indicators
"""

from typing import Dict, List, Optional, Any
from uuid import UUID
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, and_, String

from app.models.widget_event import WidgetEvent, EventType
from app.models.chat_session import ChatSession, BotType
from app.models.chat_message import ChatMessage, MessageRole


class ChatbotAnalyticsService:
    """
    Analytics service for chatbots.

    WHY: Data-driven chatbot improvement and monitoring
    HOW: Collect metrics, aggregate stats, provide insights
    """

    async def store_widget_event(
        self,
        db: Session,
        bot_id: UUID,
        workspace_id: UUID,
        event_type: str,
        event_data: Optional[Dict] = None,
        session_id: Optional[str] = None,
        client_timestamp: Optional[str] = None,
        bot_type: str = "chatbot"
    ) -> WidgetEvent:
        """
        Store a widget analytics event.

        Args:
            db: Database session
            bot_id: Chatbot ID
            workspace_id: Workspace ID for tenant isolation
            event_type: Type of event (widget_loaded, message_sent, etc.)
            event_data: Additional event data
            session_id: Widget session ID
            client_timestamp: Timestamp from client
            bot_type: Type of bot ("chatbot" or "chatflow")

        Returns:
            Created WidgetEvent
        """

        # Map string event type to enum
        try:
            event_type_enum = EventType(event_type)
        except ValueError:
            # Default to error for unknown types
            event_type_enum = EventType.ERROR
            event_data = event_data or {}
            event_data["original_event_type"] = event_type

        # Parse client timestamp
        parsed_client_timestamp = None
        if client_timestamp:
            try:
                parsed_client_timestamp = datetime.fromisoformat(
                    client_timestamp.replace("Z", "+00:00")
                )
            except (ValueError, AttributeError):
                pass

        event = WidgetEvent(
            bot_id=bot_id,
            bot_type=bot_type,
            workspace_id=workspace_id,
            event_type=event_type_enum,
            session_id=session_id,
            event_data=event_data or {},
            client_timestamp=parsed_client_timestamp
        )

        db.add(event)
        db.commit()
        db.refresh(event)

        return event

    async def get_chatbot_analytics(
        self,
        db: Session,
        chatbot_id: UUID,
        days: int = 30
    ) -> Dict[str, Any]:
        """
        Get comprehensive chatbot analytics.

        Args:
            db: Database session
            chatbot_id: Chatbot ID
            days: Analysis period in days

        Returns:
            {
                "overview": {
                    "total_conversations": 100,
                    "total_messages": 500,
                    "unique_visitors": 75,
                    "avg_session_duration": 120,
                    "avg_messages_per_session": 5
                },
                "engagement": {
                    "widget_opens": 150,
                    "conversation_starts": 100,
                    "engagement_rate": 0.67
                },
                "trends": [
                    {"date": "2025-01-01", "conversations": 10, "messages": 50},
                    ...
                ],
                "top_hours": [
                    {"hour": 14, "conversations": 25},
                    ...
                ]
            }
        """

        start_date = datetime.utcnow() - timedelta(days=days)

        # Base filter for real sessions (exclude test sessions)
        # Test sessions have session_metadata->>'platform' = 'test'
        real_session_filter = and_(
            ChatSession.bot_id == chatbot_id,
            ChatSession.bot_type == BotType.CHATBOT,
            ChatSession.created_at >= start_date,
            # Exclude test sessions - check platform != 'test' or platform is null
            ~ChatSession.session_metadata["platform"].astext.in_(["test", "preview"])
        )

        # Get overview stats from sessions (excluding test/preview)
        session_stats = db.query(
            func.count(ChatSession.id).label("total_sessions"),
            func.avg(ChatSession.message_count).label("avg_messages")
        ).filter(
            real_session_filter
        ).first()

        # Get message stats (all messages, excluding test sessions)
        message_count = db.query(func.count(ChatMessage.id)).join(
            ChatSession,
            ChatMessage.session_id == ChatSession.id
        ).filter(
            real_session_filter,
            ChatMessage.created_at >= start_date
        ).scalar() or 0

        # Get assistant response stats (successful vs failed, excluding test sessions)
        assistant_messages_query = db.query(ChatMessage).join(
            ChatSession,
            ChatMessage.session_id == ChatSession.id
        ).filter(
            real_session_filter,
            ChatMessage.created_at >= start_date,
            ChatMessage.role == MessageRole.ASSISTANT
        )

        total_responses = assistant_messages_query.count()
        failed_responses = assistant_messages_query.filter(
            ChatMessage.error.isnot(None)
        ).count()
        successful_responses = total_responses - failed_responses

        # Calculate error rate (AI failures only - NOT client errors)
        # Client errors are network issues, not AI quality issues
        error_rate = round(failed_responses / total_responses, 3) if total_responses > 0 else 0

        # Get widget event stats (for external embeds)
        widget_opens = db.query(func.count(WidgetEvent.id)).filter(
            WidgetEvent.bot_id == chatbot_id,
            WidgetEvent.event_type == EventType.WIDGET_OPENED,
            WidgetEvent.created_at >= start_date
        ).scalar() or 0

        widget_loads = db.query(func.count(WidgetEvent.id)).filter(
            WidgetEvent.bot_id == chatbot_id,
            WidgetEvent.event_type == EventType.WIDGET_LOADED,
            WidgetEvent.created_at >= start_date
        ).scalar() or 0

        # Get hosted page views
        page_views = db.query(func.count(WidgetEvent.id)).filter(
            WidgetEvent.bot_id == chatbot_id,
            WidgetEvent.event_type == EventType.PAGE_VIEW,
            WidgetEvent.created_at >= start_date
        ).scalar() or 0

        # Unique visitors (by session_id)
        unique_sessions = db.query(
            func.count(func.distinct(WidgetEvent.session_id))
        ).filter(
            WidgetEvent.bot_id == chatbot_id,
            WidgetEvent.created_at >= start_date,
            WidgetEvent.session_id.isnot(None)
        ).scalar() or 0

        # Calculate engagement rate (includes both widget AND hosted page)
        # Impressions = widget loads + page views (how many people saw the bot)
        # Engagements = conversations only (actual meaningful engagement)
        # NOTE: Don't add widget_opens to avoid double-counting (open + chat = 2 for 1 user)
        total_impressions = widget_loads + page_views
        total_engagements = session_stats.total_sessions or 0
        engagement_rate = 0
        if total_impressions > 0:
            # Cap at 1.0 to prevent mathematically invalid rates (>100%)
            engagement_rate = min(1.0, round(total_engagements / total_impressions, 2))

        # Get daily trends
        daily_trends = await self._get_daily_trends(db, chatbot_id, days)

        # Get hourly distribution
        hourly_dist = await self._get_hourly_distribution(db, chatbot_id, days)

        return {
            "overview": {
                "total_conversations": session_stats.total_sessions or 0,
                "total_messages": message_count,
                "unique_visitors": unique_sessions,
                "avg_messages_per_session": round(session_stats.avg_messages or 0, 1),
                "widget_loads": widget_loads
            },
            "engagement": {
                "widget_opens": widget_opens,
                "widget_loads": widget_loads,
                "page_views": page_views,
                "conversation_starts": session_stats.total_sessions or 0,
                "engagement_rate": engagement_rate,
                "total_impressions": total_impressions
            },
            "response_quality": {
                "total_responses": total_responses,
                "successful_responses": successful_responses,
                "failed_responses": failed_responses,  # AI inference failures only
                "error_rate": error_rate,
                "success_rate": round(1 - error_rate, 3) if total_responses > 0 else 1
            },
            "trends": daily_trends,
            "hourly_distribution": hourly_dist,
            "period_days": days
        }

    async def _get_daily_trends(
        self,
        db: Session,
        chatbot_id: UUID,
        days: int
    ) -> List[Dict[str, Any]]:
        """Get daily conversation and message trends (excluding test sessions)."""

        start_date = datetime.utcnow() - timedelta(days=days)

        # Get daily session counts (excluding test/preview sessions)
        daily_sessions = db.query(
            func.date(ChatSession.created_at).label("date"),
            func.count(ChatSession.id).label("conversations"),
            func.sum(ChatSession.message_count).label("messages")
        ).filter(
            ChatSession.bot_id == chatbot_id,
            ChatSession.bot_type == BotType.CHATBOT,
            ChatSession.created_at >= start_date,
            # Exclude test sessions
            ~ChatSession.session_metadata["platform"].astext.in_(["test", "preview"])
        ).group_by(
            func.date(ChatSession.created_at)
        ).order_by(
            func.date(ChatSession.created_at)
        ).all()

        return [
            {
                "date": str(row.date),
                "conversations": row.conversations,
                "messages": row.messages or 0
            }
            for row in daily_sessions
        ]

    async def _get_hourly_distribution(
        self,
        db: Session,
        chatbot_id: UUID,
        days: int
    ) -> List[Dict[str, Any]]:
        """Get hourly distribution of widget opens."""

        start_date = datetime.utcnow() - timedelta(days=days)

        # Get hourly event counts
        hourly_events = db.query(
            func.extract("hour", WidgetEvent.created_at).label("hour"),
            func.count(WidgetEvent.id).label("count")
        ).filter(
            WidgetEvent.bot_id == chatbot_id,
            WidgetEvent.event_type == EventType.WIDGET_OPENED,
            WidgetEvent.created_at >= start_date
        ).group_by(
            func.extract("hour", WidgetEvent.created_at)
        ).order_by(
            func.extract("hour", WidgetEvent.created_at)
        ).all()

        return [
            {
                "hour": int(row.hour),
                "count": row.count
            }
            for row in hourly_events
        ]

    async def get_feedback_summary(
        self,
        db: Session,
        chatbot_id: UUID,
        days: int = 30
    ) -> Dict[str, Any]:
        """
        Get feedback summary for a chatbot.

        Returns:
            {
                "total_feedback": 50,
                "positive": 40,
                "negative": 10,
                "satisfaction_rate": 0.80,
                "recent_feedback": [...]
            }
        """

        start_date = datetime.utcnow() - timedelta(days=days)

        # Get feedback counts (excluding test sessions)
        feedback_messages = db.query(ChatMessage).join(
            ChatSession,
            ChatMessage.session_id == ChatSession.id
        ).filter(
            ChatSession.bot_id == chatbot_id,
            ChatSession.bot_type == BotType.CHATBOT,
            ChatMessage.feedback.isnot(None),
            ChatMessage.created_at >= start_date,
            # Exclude test sessions
            ~ChatSession.session_metadata["platform"].astext.in_(["test", "preview"])
        ).all()

        positive = sum(
            1 for msg in feedback_messages
            if msg.feedback and msg.feedback.get("rating") == "positive"
        )
        negative = sum(
            1 for msg in feedback_messages
            if msg.feedback and msg.feedback.get("rating") == "negative"
        )

        total = positive + negative
        satisfaction_rate = round(positive / total, 2) if total > 0 else 0

        # Get recent feedback with comments
        recent_feedback = []
        for msg in feedback_messages[-10:]:
            if msg.feedback and msg.feedback.get("comment"):
                recent_feedback.append({
                    "rating": msg.feedback.get("rating"),
                    "comment": msg.feedback.get("comment"),
                    "submitted_at": msg.feedback.get("submitted_at"),
                    "message_preview": msg.content[:100] if msg.content else ""
                })

        return {
            "total_feedback": total,
            "positive": positive,
            "negative": negative,
            "satisfaction_rate": satisfaction_rate,
            "recent_feedback": recent_feedback
        }

    async def get_event_breakdown(
        self,
        db: Session,
        chatbot_id: UUID,
        days: int = 30
    ) -> Dict[str, int]:
        """
        Get breakdown of widget events by type.

        Excludes test/preview sessions to be consistent with other analytics metrics.

        Returns:
            {
                "widget_loaded": 1000,
                "widget_opened": 500,
                "widget_closed": 450,
                "message_sent": 200,
                ...
            }
        """

        start_date = datetime.utcnow() - timedelta(days=days)

        # Get test/preview session IDs to exclude (as strings for comparison)
        # This ensures consistency with get_chatbot_analytics() which excludes test sessions
        test_session_ids_subquery = db.query(
            func.cast(ChatSession.id, String).label("session_id")
        ).filter(
            ChatSession.bot_id == chatbot_id,
            ChatSession.session_metadata["platform"].astext.in_(["test", "preview"])
        ).subquery()

        # Get event counts by type, excluding test/preview sessions
        # Events with NULL session_id are included (e.g., widget_loaded before chat starts)
        event_counts = db.query(
            WidgetEvent.event_type,
            func.count(WidgetEvent.id).label("count")
        ).filter(
            WidgetEvent.bot_id == chatbot_id,
            WidgetEvent.created_at >= start_date,
            # Exclude events from test/preview sessions
            # Keep events with NULL session_id (they're legitimate widget loads)
            ~and_(
                WidgetEvent.session_id.isnot(None),
                WidgetEvent.session_id.in_(
                    db.query(test_session_ids_subquery.c.session_id)
                )
            )
        ).group_by(
            WidgetEvent.event_type
        ).all()

        return {
            str(row.event_type.value): row.count
            for row in event_counts
        }


# Global instance
chatbot_analytics_service = ChatbotAnalyticsService()
