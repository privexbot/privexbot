"""
Dashboard Service - Aggregate statistics for the dashboard.

WHY:
- Provide real-time dashboard statistics
- Aggregate counts from multiple tables
- Calculate growth percentages vs previous period
- Return recent activities and resources

HOW:
- Query Chatbot, Chatflow, Lead, KnowledgeBase, ChatSession tables
- Calculate deltas by comparing current vs previous period
- Derive activities from recent database changes
"""

from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from uuid import UUID
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.chatbot import Chatbot, ChatbotStatus
from app.models.lead import Lead
from app.models.knowledge_base import KnowledgeBase
from app.models.chat_session import ChatSession

# Note: Chatflow model is not yet implemented (pseudocode only)
# Chatflow functionality will return 0 until the model is created


class DashboardService:
    """Service for aggregating dashboard statistics."""

    def __init__(self, db: Session):
        self.db = db

    def get_workspace_stats(
        self,
        workspace_id: UUID,
        days: int = 7
    ) -> Dict[str, Any]:
        """
        Get aggregated statistics for a workspace.

        Args:
            workspace_id: The workspace ID to get stats for
            days: Number of days for the current period (default 7)

        Returns:
            Dict with counts and delta percentages
        """
        now = datetime.utcnow()
        current_start = now - timedelta(days=days)
        previous_start = current_start - timedelta(days=days)

        # Current period counts
        total_chatbots = self._count_chatbots(workspace_id)
        total_chatflows = 0  # Chatflow model not yet implemented
        total_knowledge_bases = self._count_knowledge_bases(workspace_id)
        total_leads = self._count_leads(workspace_id)
        total_conversations = self._count_conversations(workspace_id)
        active_conversations = self._count_active_conversations(workspace_id)

        # Previous period counts for delta calculation
        chatbots_prev = self._count_chatbots(workspace_id, before=current_start)
        kbs_prev = self._count_knowledge_bases(workspace_id, before=current_start)
        leads_prev = self._count_leads(workspace_id, before=current_start)
        conversations_prev = self._count_conversations(workspace_id, before=current_start)

        # Calculate new items in current period
        chatbots_new = self._count_chatbots(workspace_id, after=current_start)
        kbs_new = self._count_knowledge_bases(workspace_id, after=current_start)
        leads_new = self._count_leads(workspace_id, after=current_start)
        conversations_new = self._count_conversations(workspace_id, after=current_start)

        # Previous period new items (for comparison)
        chatbots_prev_new = self._count_chatbots(
            workspace_id, after=previous_start, before=current_start
        )
        leads_prev_new = self._count_leads(
            workspace_id, after=previous_start, before=current_start
        )
        conversations_prev_new = self._count_conversations(
            workspace_id, after=previous_start, before=current_start
        )

        return {
            "total_chatbots": total_chatbots,
            "total_chatflows": total_chatflows,
            "total_knowledge_bases": total_knowledge_bases,
            "total_leads": total_leads,
            "total_conversations": total_conversations,
            "active_conversations": active_conversations,
            "chatbots_delta": self._calculate_delta(chatbots_new, chatbots_prev_new),
            "chatflows_delta": 0.0,  # Chatflow model not yet implemented
            "knowledge_bases_delta": self._calculate_delta(kbs_new, kbs_prev),
            "leads_delta": self._calculate_delta(leads_new, leads_prev_new),
            "conversations_delta": self._calculate_delta(
                conversations_new, conversations_prev_new
            ),
        }

    def get_recent_chatbots(
        self,
        workspace_id: UUID,
        limit: int = 5
    ) -> List[Dict[str, Any]]:
        """Get recent chatbots for the dashboard."""
        chatbots = (
            self.db.query(Chatbot)
            .filter(
                Chatbot.workspace_id == workspace_id,
                Chatbot.status != ChatbotStatus.ARCHIVED
            )
            .order_by(Chatbot.updated_at.desc())
            .limit(limit)
            .all()
        )

        return [
            {
                "id": str(cb.id),
                "name": cb.name,
                "description": cb.description,
                "status": cb.status.value if hasattr(cb.status, 'value') else str(cb.status),
                "conversations_count": cb.cached_metrics.get("total_conversations", 0) if cb.cached_metrics else 0,
                "last_active_at": self._get_last_session_time(cb.id, "chatbot"),
                "created_at": cb.created_at.isoformat() if cb.created_at else None,
                "updated_at": cb.updated_at.isoformat() if cb.updated_at else None,
                "deployed_at": cb.deployed_at.isoformat() if cb.deployed_at else None,
            }
            for cb in chatbots
        ]

    def get_recent_chatflows(
        self,
        workspace_id: UUID,
        limit: int = 5
    ) -> List[Dict[str, Any]]:
        """Get recent chatflows for the dashboard.

        Note: Chatflow model is not yet implemented (pseudocode only).
        Returns empty list until the model is created.
        """
        # Chatflow model not yet implemented
        return []

    def get_recent_knowledge_bases(
        self,
        workspace_id: UUID,
        limit: int = 5
    ) -> List[Dict[str, Any]]:
        """Get recent knowledge bases for the dashboard."""
        kbs = (
            self.db.query(KnowledgeBase)
            .filter(KnowledgeBase.workspace_id == workspace_id)
            .order_by(KnowledgeBase.updated_at.desc())
            .limit(limit)
            .all()
        )

        return [
            {
                "id": str(kb.id),
                "name": kb.name,
                "description": kb.description,
                "status": kb.status.value if hasattr(kb.status, 'value') else str(kb.status),
                "documents_count": kb.total_documents if hasattr(kb, 'total_documents') else 0,
                "total_chunks": kb.total_chunks if hasattr(kb, 'total_chunks') else 0,
                "last_indexed_at": kb.updated_at.isoformat() if kb.updated_at else None,
                "created_at": kb.created_at.isoformat() if kb.created_at else None,
                "updated_at": kb.updated_at.isoformat() if kb.updated_at else None,
            }
            for kb in kbs
        ]

    def get_recent_activities(
        self,
        workspace_id: UUID,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Get recent activities for the dashboard.

        Derives activities from recent database changes across all resource types.
        """
        activities = []
        now = datetime.utcnow()

        # Recent chatbots (created or updated)
        recent_chatbots = (
            self.db.query(Chatbot)
            .filter(
                Chatbot.workspace_id == workspace_id,
                Chatbot.updated_at >= now - timedelta(days=7)
            )
            .order_by(Chatbot.updated_at.desc())
            .limit(5)
            .all()
        )

        for cb in recent_chatbots:
            is_new = cb.created_at and (now - cb.created_at).total_seconds() < 3600
            activity_type = "chatbot_created" if is_new else "chatbot_updated"
            if cb.deployed_at and (now - cb.deployed_at).total_seconds() < 3600:
                activity_type = "chatbot_deployed"

            activities.append({
                "id": f"act-cb-{cb.id}",
                "type": activity_type,
                "title": f"{cb.name} {'created' if is_new else 'deployed' if activity_type == 'chatbot_deployed' else 'updated'}",
                "description": cb.description or f"Chatbot {activity_type.split('_')[1]}",
                "resource_type": "chatbot",
                "resource_id": str(cb.id),
                "resource_name": cb.name,
                "timestamp": cb.updated_at.isoformat() if cb.updated_at else now.isoformat(),
            })

        # Recent knowledge bases
        recent_kbs = (
            self.db.query(KnowledgeBase)
            .filter(
                KnowledgeBase.workspace_id == workspace_id,
                KnowledgeBase.updated_at >= now - timedelta(days=7)
            )
            .order_by(KnowledgeBase.updated_at.desc())
            .limit(5)
            .all()
        )

        for kb in recent_kbs:
            is_new = kb.created_at and (now - kb.created_at).total_seconds() < 3600
            activities.append({
                "id": f"act-kb-{kb.id}",
                "type": "kb_created" if is_new else "kb_updated",
                "title": f"{kb.name} {'created' if is_new else 'updated'}",
                "description": f"Knowledge base with {kb.total_documents if hasattr(kb, 'total_documents') else 0} documents",
                "resource_type": "knowledge_base",
                "resource_id": str(kb.id),
                "resource_name": kb.name,
                "timestamp": kb.updated_at.isoformat() if kb.updated_at else now.isoformat(),
            })

        # Recent leads
        recent_leads = (
            self.db.query(Lead)
            .filter(
                Lead.workspace_id == workspace_id,
                Lead.created_at >= now - timedelta(days=7)
            )
            .order_by(Lead.created_at.desc())
            .limit(5)
            .all()
        )

        for lead in recent_leads:
            activities.append({
                "id": f"act-lead-{lead.id}",
                "type": "lead_captured",
                "title": "New lead captured",
                "description": f"From {lead.channel if hasattr(lead, 'channel') else 'unknown'} channel",
                "resource_type": "lead",
                "resource_id": str(lead.id),
                "timestamp": lead.created_at.isoformat() if lead.created_at else now.isoformat(),
            })

        # Recent conversation starts
        recent_sessions = (
            self.db.query(ChatSession)
            .filter(
                ChatSession.workspace_id == workspace_id,
                ChatSession.created_at >= now - timedelta(hours=24)
            )
            .count()
        )

        if recent_sessions > 0:
            activities.append({
                "id": f"act-conv-{now.timestamp()}",
                "type": "conversation_started",
                "title": f"{recent_sessions} new conversations started",
                "description": "In the last 24 hours",
                "timestamp": now.isoformat(),
            })

        # Sort by timestamp and limit
        activities.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
        return activities[:limit]

    # ========================================
    # PRIVATE HELPER METHODS
    # ========================================

    def _count_chatbots(
        self,
        workspace_id: UUID,
        after: Optional[datetime] = None,
        before: Optional[datetime] = None
    ) -> int:
        """Count chatbots with optional date filters."""
        query = self.db.query(func.count(Chatbot.id)).filter(
            Chatbot.workspace_id == workspace_id,
            Chatbot.status != ChatbotStatus.ARCHIVED
        )
        if after:
            query = query.filter(Chatbot.created_at >= after)
        if before:
            query = query.filter(Chatbot.created_at < before)
        return query.scalar() or 0

    def _count_knowledge_bases(
        self,
        workspace_id: UUID,
        after: Optional[datetime] = None,
        before: Optional[datetime] = None
    ) -> int:
        """Count knowledge bases with optional date filters."""
        query = self.db.query(func.count(KnowledgeBase.id)).filter(
            KnowledgeBase.workspace_id == workspace_id
        )
        if after:
            query = query.filter(KnowledgeBase.created_at >= after)
        if before:
            query = query.filter(KnowledgeBase.created_at < before)
        return query.scalar() or 0

    def _count_leads(
        self,
        workspace_id: UUID,
        after: Optional[datetime] = None,
        before: Optional[datetime] = None
    ) -> int:
        """Count leads with optional date filters."""
        query = self.db.query(func.count(Lead.id)).filter(
            Lead.workspace_id == workspace_id
        )
        if after:
            query = query.filter(Lead.created_at >= after)
        if before:
            query = query.filter(Lead.created_at < before)
        return query.scalar() or 0

    def _count_conversations(
        self,
        workspace_id: UUID,
        after: Optional[datetime] = None,
        before: Optional[datetime] = None
    ) -> int:
        """Count chat sessions with optional date filters."""
        query = self.db.query(func.count(ChatSession.id)).filter(
            ChatSession.workspace_id == workspace_id
        )
        if after:
            query = query.filter(ChatSession.created_at >= after)
        if before:
            query = query.filter(ChatSession.created_at < before)
        return query.scalar() or 0

    def _count_active_conversations(self, workspace_id: UUID) -> int:
        """Count active (not closed/expired) sessions."""
        query = self.db.query(func.count(ChatSession.id)).filter(
            ChatSession.workspace_id == workspace_id,
            ChatSession.status == "active"
        )
        return query.scalar() or 0

    def _count_bot_conversations(self, bot_id: UUID, bot_type: str) -> int:
        """Count conversations for a specific bot."""
        return (
            self.db.query(func.count(ChatSession.id))
            .filter(
                ChatSession.bot_id == bot_id,
                ChatSession.bot_type == bot_type
            )
            .scalar() or 0
        )

    def _get_last_session_time(self, bot_id: UUID, bot_type: str) -> Optional[str]:
        """Get the timestamp of the most recent session for a bot."""
        session = (
            self.db.query(ChatSession)
            .filter(
                ChatSession.bot_id == bot_id,
                ChatSession.bot_type == bot_type
            )
            .order_by(ChatSession.created_at.desc())
            .first()
        )
        if session and session.created_at:
            return session.created_at.isoformat()
        return None

    def _calculate_delta(self, current: int, previous: int) -> float:
        """Calculate percentage change between periods."""
        if previous == 0:
            return 100.0 if current > 0 else 0.0
        return round(((current - previous) / previous) * 100, 1)


# Singleton instance for convenience
def get_dashboard_service(db: Session) -> DashboardService:
    """Get dashboard service instance."""
    return DashboardService(db)
