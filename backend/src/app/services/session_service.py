"""
Session Service - Manage chat sessions and message history.

WHY:
- Centralized session management
- Works for BOTH chatbots and chatflows
- Automatic cleanup of old sessions
- Memory context management

HOW:
- Create/get sessions
- Save messages
- Retrieve conversation history
- Handle session expiration

PSEUDOCODE follows the existing codebase patterns.
"""

from uuid import UUID
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy.orm import Session

from app.models.chat_session import ChatSession, SessionStatus, BotType
from app.models.chat_message import ChatMessage, MessageRole


class SessionService:
    """
    Chat session and message management.
    Works for BOTH chatbots and chatflows.
    """

    def get_or_create_session(
        self,
        db: Session,
        bot_type: str,
        bot_id: UUID,
        session_id: str,
        workspace_id: UUID,
        channel_context: Optional[dict] = None
    ) -> ChatSession:
        """
        Get existing session or create new one.

        WHY: Sessions persist across widget reloads
        HOW: Check if session exists, create if not

        ARGS:
            db: Database session
            bot_type: "chatbot" or "chatflow"
            bot_id: ID of chatbot or chatflow
            session_id: Client-provided session ID
            workspace_id: Workspace ID (for isolation)
            channel_context: Channel-specific data

        RETURNS:
            ChatSession instance
        """

        # Try to get existing session
        session = db.query(ChatSession).filter(
            ChatSession.id == UUID(session_id),
            ChatSession.workspace_id == workspace_id,
            ChatSession.status != SessionStatus.EXPIRED
        ).first()

        if session:
            # Update activity
            session.updated_at = datetime.utcnow()
            session.last_message_at = datetime.utcnow()
            db.commit()
            return session

        # Create new session
        session = ChatSession(
            id=UUID(session_id),
            bot_type=BotType(bot_type),
            bot_id=bot_id,
            workspace_id=workspace_id,
            session_metadata=channel_context or {},
            status=SessionStatus.ACTIVE,
            expires_at=datetime.utcnow() + timedelta(hours=24)
        )

        db.add(session)
        db.commit()
        db.refresh(session)

        return session


    def save_message(
        self,
        db: Session,
        session_id: UUID,
        role: str,
        content: str,
        response_metadata: Optional[dict] = None,
        prompt_tokens: Optional[int] = None,
        completion_tokens: Optional[int] = None,
        error: Optional[str] = None,
        error_code: Optional[str] = None
    ) -> ChatMessage:
        """
        Save message to session.

        ARGS:
            db: Database session
            session_id: Session ID
            role: "user" or "assistant" or "system"
            content: Message text
            response_metadata: AI response details
            prompt_tokens: Input tokens
            completion_tokens: Output tokens
            error: Error message (if failed)
            error_code: Error classification

        RETURNS:
            ChatMessage instance
        """

        # Get session
        session = db.query(ChatSession).get(session_id)
        if not session:
            raise ValueError("Session not found")

        # Create message
        message = ChatMessage(
            session_id=session_id,
            workspace_id=session.workspace_id,
            role=MessageRole(role),
            content=content,
            response_metadata=response_metadata,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=(prompt_tokens or 0) + (completion_tokens or 0) if prompt_tokens or completion_tokens else None,
            error=error,
            error_code=error_code
        )

        db.add(message)

        # Update session message count
        session.message_count += 1
        session.last_message_at = datetime.utcnow()

        db.commit()
        db.refresh(message)

        return message


    def get_context_messages(
        self,
        db: Session,
        session_id: UUID,
        max_messages: int = 10
    ) -> list[ChatMessage]:
        """
        Get recent messages for LLM context.

        WHY: AI needs conversation history for context
        HOW: Get last N messages, ordered chronologically

        ARGS:
            db: Database session
            session_id: Session ID
            max_messages: Maximum messages to return

        RETURNS:
            List of ChatMessage instances (chronological order)
        """

        messages = db.query(ChatMessage).filter(
            ChatMessage.session_id == session_id
        ).order_by(
            ChatMessage.created_at.desc()
        ).limit(max_messages).all()

        # Reverse to chronological order
        return list(reversed(messages))


    def close_session(self, db: Session, session_id: UUID):
        """
        Close session explicitly.

        WHY: User closes widget or conversation ends
        """

        session = db.query(ChatSession).get(session_id)
        if session:
            session.status = SessionStatus.CLOSED
            session.closed_at = datetime.utcnow()
            db.commit()


    def cleanup_expired_sessions(self, db: Session) -> int:
        """
        Background job to delete expired sessions.

        WHY: Free up database space
        HOW: Delete sessions past expiration + 7 days grace period

        SCHEDULE: Run daily

        RETURNS:
            Number of sessions deleted
        """

        cutoff = datetime.utcnow() - timedelta(days=7)

        expired_sessions = db.query(ChatSession).filter(
            ChatSession.expires_at < cutoff
        ).all()

        for session in expired_sessions:
            db.delete(session)  # Cascades to messages

        db.commit()

        return len(expired_sessions)


    def get_session_stats(
        self,
        db: Session,
        workspace_id: UUID,
        bot_type: Optional[str] = None,
        bot_id: Optional[UUID] = None
    ) -> dict:
        """
        Get session statistics for analytics.

        WHY: Dashboard analytics
        HOW: Aggregate queries

        RETURNS:
            {
                "total_sessions": 100,
                "active_sessions": 10,
                "total_messages": 500,
                "avg_messages_per_session": 5.0
            }
        """

        query = db.query(ChatSession).filter(
            ChatSession.workspace_id == workspace_id
        )

        if bot_type:
            query = query.filter(ChatSession.bot_type == BotType(bot_type))

        if bot_id:
            query = query.filter(ChatSession.bot_id == bot_id)

        sessions = query.all()

        total_sessions = len(sessions)
        active_sessions = len([s for s in sessions if s.status == SessionStatus.ACTIVE])
        total_messages = sum(s.message_count for s in sessions)
        avg_messages = total_messages / total_sessions if total_sessions > 0 else 0

        return {
            "total_sessions": total_sessions,
            "active_sessions": active_sessions,
            "total_messages": total_messages,
            "avg_messages_per_session": round(avg_messages, 2)
        }


# Global instance
session_service = SessionService()
