"""
Chatbot Metrics Service - Calculate and update chatbot performance metrics.

WHY:
- Provide real-time metrics for chatbot dashboard cards
- Pre-calculate expensive aggregations for fast dashboard loading
- Track chatbot performance over time

HOW:
- Query ChatSession and ChatMessage for metrics
- Update chatbot.cached_metrics JSONB field
- Called by background Celery task or on-demand
"""

from datetime import datetime
from typing import Dict, Any, Optional, List
from uuid import UUID
from sqlalchemy import func, Integer
from sqlalchemy.orm import Session

from app.models.chatbot import Chatbot
from app.models.chat_session import ChatSession, BotType
from app.models.chat_message import ChatMessage, MessageRole


class ChatbotMetricsService:
    """Service for calculating and caching chatbot metrics."""

    def __init__(self, db: Session):
        self.db = db

    def calculate_metrics(self, chatbot_id: UUID) -> Dict[str, Any]:
        """
        Calculate comprehensive metrics for a single chatbot.

        Args:
            chatbot_id: The chatbot ID

        Returns:
            Dict with all metrics
        """
        # Get all session IDs for this chatbot
        session_query = self.db.query(ChatSession).filter(
            ChatSession.bot_type == BotType.CHATBOT,
            ChatSession.bot_id == chatbot_id
        )

        # Total conversations
        total_conversations = session_query.count()

        if total_conversations == 0:
            return {
                "total_conversations": 0,
                "total_messages": 0,
                "avg_satisfaction": 0.0,
                "resolution_rate": 0.0,
                "avg_response_time_ms": 0,
                "positive_feedback": 0,
                "negative_feedback": 0,
                "error_rate": 0.0,
                "last_updated": datetime.utcnow().isoformat()
            }

        session_ids = [s.id for s in session_query.all()]

        # Total messages
        total_messages = self.db.query(func.count(ChatMessage.id)).filter(
            ChatMessage.session_id.in_(session_ids)
        ).scalar() or 0

        # Get assistant messages for further analysis
        assistant_messages = self.db.query(ChatMessage).filter(
            ChatMessage.session_id.in_(session_ids),
            ChatMessage.role == MessageRole.ASSISTANT
        )

        # Average response time (from response_metadata.latency_ms)
        avg_response_time = self.db.query(
            func.avg(
                ChatMessage.response_metadata['latency_ms'].astext.cast(Integer)
            )
        ).filter(
            ChatMessage.session_id.in_(session_ids),
            ChatMessage.role == MessageRole.ASSISTANT,
            ChatMessage.response_metadata.isnot(None),
            ChatMessage.response_metadata['latency_ms'].isnot(None)
        ).scalar() or 0

        # Feedback counts
        positive_feedback = self.db.query(func.count(ChatMessage.id)).filter(
            ChatMessage.session_id.in_(session_ids),
            ChatMessage.feedback.isnot(None),
            ChatMessage.feedback['rating'].astext == 'positive'
        ).scalar() or 0

        negative_feedback = self.db.query(func.count(ChatMessage.id)).filter(
            ChatMessage.session_id.in_(session_ids),
            ChatMessage.feedback.isnot(None),
            ChatMessage.feedback['rating'].astext == 'negative'
        ).scalar() or 0

        # Calculate satisfaction rate
        total_feedback = positive_feedback + negative_feedback
        avg_satisfaction = (
            positive_feedback / total_feedback if total_feedback > 0 else 0.0
        )

        # Error rate
        error_count = self.db.query(func.count(ChatMessage.id)).filter(
            ChatMessage.session_id.in_(session_ids),
            ChatMessage.role == MessageRole.ASSISTANT,
            ChatMessage.error.isnot(None)
        ).scalar() or 0

        assistant_count = assistant_messages.count()
        error_rate = error_count / assistant_count if assistant_count > 0 else 0.0

        # Resolution rate (sessions that were closed vs expired)
        closed_sessions = self.db.query(func.count(ChatSession.id)).filter(
            ChatSession.bot_type == BotType.CHATBOT,
            ChatSession.bot_id == chatbot_id,
            ChatSession.status == 'closed'
        ).scalar() or 0

        resolution_rate = (
            closed_sessions / total_conversations
            if total_conversations > 0 else 0.0
        )

        return {
            "total_conversations": total_conversations,
            "total_messages": total_messages,
            "avg_satisfaction": round(avg_satisfaction, 2),
            "resolution_rate": round(resolution_rate, 2),
            "avg_response_time_ms": int(avg_response_time),
            "positive_feedback": positive_feedback,
            "negative_feedback": negative_feedback,
            "error_rate": round(error_rate, 3),
            "last_updated": datetime.utcnow().isoformat()
        }

    def update_chatbot_metrics(self, chatbot_id: UUID) -> Dict[str, Any]:
        """
        Calculate and save metrics for a single chatbot.

        Args:
            chatbot_id: The chatbot ID

        Returns:
            Updated metrics dict
        """
        chatbot = self.db.query(Chatbot).filter(
            Chatbot.id == chatbot_id
        ).first()

        if not chatbot:
            raise ValueError(f"Chatbot {chatbot_id} not found")

        metrics = self.calculate_metrics(chatbot_id)
        chatbot.cached_metrics = metrics
        self.db.commit()

        return metrics

    def update_all_chatbot_metrics(
        self,
        workspace_id: Optional[UUID] = None
    ) -> List[Dict[str, Any]]:
        """
        Update metrics for all chatbots (optionally filtered by workspace).

        Args:
            workspace_id: Optional workspace filter

        Returns:
            List of updated metrics dicts
        """
        query = self.db.query(Chatbot)

        if workspace_id:
            query = query.filter(Chatbot.workspace_id == workspace_id)

        chatbots = query.all()
        results = []

        for chatbot in chatbots:
            try:
                metrics = self.calculate_metrics(chatbot.id)
                chatbot.cached_metrics = metrics
                results.append({
                    "chatbot_id": str(chatbot.id),
                    "chatbot_name": chatbot.name,
                    "status": "updated",
                    "metrics": metrics
                })
            except Exception as e:
                results.append({
                    "chatbot_id": str(chatbot.id),
                    "chatbot_name": chatbot.name,
                    "status": "error",
                    "error": str(e)
                })

        self.db.commit()
        return results

    def get_cached_metrics(self, chatbot_id: UUID) -> Dict[str, Any]:
        """
        Get cached metrics for a chatbot (without recalculating).

        Args:
            chatbot_id: The chatbot ID

        Returns:
            Cached metrics dict or empty dict if not available
        """
        chatbot = self.db.query(Chatbot).filter(
            Chatbot.id == chatbot_id
        ).first()

        if not chatbot:
            return {}

        return chatbot.cached_metrics or {}
