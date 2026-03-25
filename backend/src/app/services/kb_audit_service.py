"""
KB Audit Service - Automatic audit logging for Knowledge Base operations.

WHY:
- Security and compliance tracking
- Debug trail for issues
- User activity monitoring
- Accountability for changes

HOW:
- Automatically log all KB operations
- Store action, actor, target, metadata
- Immutable records (never delete)
- Support querying and filtering
"""

from datetime import datetime
from typing import List, Optional, Dict, Any
from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy import desc
from fastapi import Request

from app.models.kb_audit_log import KBAuditLog
from app.models.knowledge_base import KnowledgeBase


def log_kb_action(
    db: Session,
    kb_id: UUID,
    user_id: UUID,
    action: str,
    target_type: Optional[str] = None,
    target_id: Optional[str] = None,
    event_metadata: Optional[Dict[str, Any]] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None
) -> KBAuditLog:
    """
    Log a KB operation to the audit trail.

    WHY: Track all KB operations for security and debugging
    HOW: Create immutable audit log record

    Args:
        db: Database session
        kb_id: UUID of knowledge base
        user_id: UUID of user performing action
        action: Action performed (e.g., 'kb.created', 'kb.member.added')
        target_type: Type of target resource (member, document, query, etc.)
        target_id: ID of target resource
        event_metadata: Additional context and details (JSON)
        ip_address: IP address of requester
        user_agent: User agent string

    Returns:
        Created KBAuditLog object
    """
    audit_log = KBAuditLog(
        kb_id=kb_id,
        user_id=user_id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        event_metadata=event_metadata or {},
        ip_address=ip_address,
        user_agent=user_agent
    )

    db.add(audit_log)
    db.commit()
    db.refresh(audit_log)
    return audit_log


def log_kb_action_from_request(
    db: Session,
    kb_id: UUID,
    user_id: UUID,
    action: str,
    request: Request,
    target_type: Optional[str] = None,
    target_id: Optional[str] = None,
    event_metadata: Optional[Dict[str, Any]] = None
) -> KBAuditLog:
    """
    Log KB action with request context (IP, user agent).

    WHY: Convenience function to extract request details
    HOW: Extract IP and user agent from FastAPI request

    Args:
        db: Database session
        kb_id: UUID of knowledge base
        user_id: UUID of user performing action
        action: Action performed
        request: FastAPI Request object
        target_type: Type of target resource
        target_id: ID of target resource
        event_metadata: Additional context

    Returns:
        Created KBAuditLog object
    """
    # Extract IP address (handle proxies)
    ip_address = request.client.host if request.client else None
    if "x-forwarded-for" in request.headers:
        ip_address = request.headers["x-forwarded-for"].split(",")[0].strip()

    # Extract user agent
    user_agent = request.headers.get("user-agent")

    return log_kb_action(
        db=db,
        kb_id=kb_id,
        user_id=user_id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        event_metadata=event_metadata,
        ip_address=ip_address,
        user_agent=user_agent
    )


def get_kb_audit_trail(
    db: Session,
    kb_id: UUID,
    limit: int = 100,
    offset: int = 0,
    action_filter: Optional[str] = None,
    user_filter: Optional[UUID] = None
) -> List[KBAuditLog]:
    """
    Get audit trail for a knowledge base.

    WHY: View KB activity history
    HOW: Query audit logs with filters and pagination

    Args:
        db: Database session
        kb_id: UUID of knowledge base
        limit: Maximum number of records to return
        offset: Number of records to skip
        action_filter: Filter by action type (optional)
        user_filter: Filter by user ID (optional)

    Returns:
        List of KBAuditLog objects ordered by most recent first
    """
    query = db.query(KBAuditLog).filter(KBAuditLog.kb_id == kb_id)

    if action_filter:
        query = query.filter(KBAuditLog.action == action_filter)

    if user_filter:
        query = query.filter(KBAuditLog.user_id == user_filter)

    logs = query.order_by(desc(KBAuditLog.created_at)).limit(limit).offset(offset).all()
    return logs


def get_user_kb_activity(
    db: Session,
    user_id: UUID,
    limit: int = 100,
    offset: int = 0
) -> List[KBAuditLog]:
    """
    Get user's KB activity across all KBs.

    WHY: View user's action history
    HOW: Query all audit logs for user

    Args:
        db: Database session
        user_id: UUID of user
        limit: Maximum number of records to return
        offset: Number of records to skip

    Returns:
        List of KBAuditLog objects ordered by most recent first
    """
    logs = db.query(KBAuditLog).filter(
        KBAuditLog.user_id == user_id
    ).order_by(desc(KBAuditLog.created_at)).limit(limit).offset(offset).all()

    return logs


def get_recent_kb_activity(
    db: Session,
    kb_id: UUID,
    limit: int = 10
) -> List[KBAuditLog]:
    """
    Get recent activity for a KB (for dashboards).

    WHY: Show recent changes in KB dashboard
    HOW: Query most recent audit logs

    Args:
        db: Database session
        kb_id: UUID of knowledge base
        limit: Number of recent activities to return

    Returns:
        List of recent KBAuditLog objects
    """
    return get_kb_audit_trail(db, kb_id, limit=limit, offset=0)


def count_kb_actions(
    db: Session,
    kb_id: UUID,
    action_filter: Optional[str] = None
) -> int:
    """
    Count audit log entries for a KB.

    WHY: Pagination and statistics
    HOW: Count query with optional filters

    Args:
        db: Database session
        kb_id: UUID of knowledge base
        action_filter: Filter by action type (optional)

    Returns:
        Total count of matching audit logs
    """
    query = db.query(KBAuditLog).filter(KBAuditLog.kb_id == kb_id)

    if action_filter:
        query = query.filter(KBAuditLog.action == action_filter)

    return query.count()


def find_who_deleted_kb(
    db: Session,
    kb_id: UUID
) -> Optional[KBAuditLog]:
    """
    Find who deleted a knowledge base.

    WHY: Accountability for deletions
    HOW: Query for 'kb.deleted' action

    Args:
        db: Database session
        kb_id: UUID of knowledge base

    Returns:
        KBAuditLog record of deletion or None
    """
    log = db.query(KBAuditLog).filter(
        KBAuditLog.kb_id == kb_id,
        KBAuditLog.action == "kb.deleted"
    ).first()

    return log


def get_member_change_history(
    db: Session,
    kb_id: UUID
) -> List[KBAuditLog]:
    """
    Get history of member changes for a KB.

    WHY: Track who was added/removed and when
    HOW: Query for member-related actions

    Args:
        db: Database session
        kb_id: UUID of knowledge base

    Returns:
        List of member-related audit logs
    """
    logs = db.query(KBAuditLog).filter(
        KBAuditLog.kb_id == kb_id,
        KBAuditLog.action.like("kb.member.%")
    ).order_by(desc(KBAuditLog.created_at)).all()

    return logs


def get_query_history(
    db: Session,
    kb_id: UUID,
    limit: int = 50
) -> List[KBAuditLog]:
    """
    Get query history for a KB.

    WHY: See what users are searching for
    HOW: Query for 'kb.queried' actions

    Args:
        db: Database session
        kb_id: UUID of knowledge base
        limit: Maximum number of queries to return

    Returns:
        List of query audit logs
    """
    logs = db.query(KBAuditLog).filter(
        KBAuditLog.kb_id == kb_id,
        KBAuditLog.action == "kb.queried"
    ).order_by(desc(KBAuditLog.created_at)).limit(limit).all()

    return logs


# Convenience functions for common audit actions

def log_kb_created(
    db: Session,
    kb_id: UUID,
    user_id: UUID,
    kb_name: str,
    request: Optional[Request] = None
) -> KBAuditLog:
    """Log KB creation."""
    metadata = {"name": kb_name}

    if request:
        return log_kb_action_from_request(
            db, kb_id, user_id, "kb.created", request,
            target_type="kb", event_metadata=metadata
        )
    else:
        return log_kb_action(
            db, kb_id, user_id, "kb.created",
            target_type="kb", event_metadata=metadata
        )


def log_kb_updated(
    db: Session,
    kb_id: UUID,
    user_id: UUID,
    changes: Dict[str, Any],
    request: Optional[Request] = None
) -> KBAuditLog:
    """Log KB update."""
    if request:
        return log_kb_action_from_request(
            db, kb_id, user_id, "kb.updated", request,
            target_type="kb", event_metadata={"changes": changes}
        )
    else:
        return log_kb_action(
            db, kb_id, user_id, "kb.updated",
            target_type="kb", event_metadata={"changes": changes}
        )


def log_kb_deleted(
    db: Session,
    kb_id: UUID,
    user_id: UUID,
    kb_name: str,
    request: Optional[Request] = None
) -> KBAuditLog:
    """Log KB deletion."""
    metadata = {"name": kb_name}

    if request:
        return log_kb_action_from_request(
            db, kb_id, user_id, "kb.deleted", request,
            target_type="kb", event_metadata=metadata
        )
    else:
        return log_kb_action(
            db, kb_id, user_id, "kb.deleted",
            target_type="kb", event_metadata=metadata
        )


def log_kb_member_added(
    db: Session,
    kb_id: UUID,
    user_id: UUID,
    member_user_id: UUID,
    member_email: str,
    role: str,
    request: Optional[Request] = None
) -> KBAuditLog:
    """Log member addition."""
    metadata = {
        "member_user_id": str(member_user_id),
        "member_email": member_email,
        "role": role
    }

    if request:
        return log_kb_action_from_request(
            db, kb_id, user_id, "kb.member.added", request,
            target_type="member", target_id=str(member_user_id),
            event_metadata=metadata
        )
    else:
        return log_kb_action(
            db, kb_id, user_id, "kb.member.added",
            target_type="member", target_id=str(member_user_id),
            event_metadata=metadata
        )


def log_kb_member_removed(
    db: Session,
    kb_id: UUID,
    user_id: UUID,
    member_user_id: UUID,
    member_email: str,
    request: Optional[Request] = None
) -> KBAuditLog:
    """Log member removal."""
    metadata = {
        "member_user_id": str(member_user_id),
        "member_email": member_email
    }

    if request:
        return log_kb_action_from_request(
            db, kb_id, user_id, "kb.member.removed", request,
            target_type="member", target_id=str(member_user_id),
            event_metadata=metadata
        )
    else:
        return log_kb_action(
            db, kb_id, user_id, "kb.member.removed",
            target_type="member", target_id=str(member_user_id),
            event_metadata=metadata
        )


def log_kb_member_role_changed(
    db: Session,
    kb_id: UUID,
    user_id: UUID,
    member_user_id: UUID,
    old_role: str,
    new_role: str,
    request: Optional[Request] = None
) -> KBAuditLog:
    """Log member role change."""
    metadata = {
        "member_user_id": str(member_user_id),
        "old_role": old_role,
        "new_role": new_role
    }

    if request:
        return log_kb_action_from_request(
            db, kb_id, user_id, "kb.member.role_changed", request,
            target_type="member", target_id=str(member_user_id),
            event_metadata=metadata
        )
    else:
        return log_kb_action(
            db, kb_id, user_id, "kb.member.role_changed",
            target_type="member", target_id=str(member_user_id),
            event_metadata=metadata
        )


def log_kb_queried(
    db: Session,
    kb_id: UUID,
    user_id: UUID,
    query_text: str,
    results_count: int,
    duration_ms: int,
    request: Optional[Request] = None
) -> KBAuditLog:
    """Log KB query."""
    metadata = {
        "query": query_text,
        "results_count": results_count,
        "duration_ms": duration_ms
    }

    if request:
        return log_kb_action_from_request(
            db, kb_id, user_id, "kb.queried", request,
            target_type="query", event_metadata=metadata
        )
    else:
        return log_kb_action(
            db, kb_id, user_id, "kb.queried",
            target_type="query", event_metadata=metadata
        )


def log_kb_reindexed(
    db: Session,
    kb_id: UUID,
    user_id: UUID,
    request: Optional[Request] = None
) -> KBAuditLog:
    """Log KB re-indexing."""
    if request:
        return log_kb_action_from_request(
            db, kb_id, user_id, "kb.reindexed", request,
            target_type="kb"
        )
    else:
        return log_kb_action(
            db, kb_id, user_id, "kb.reindexed",
            target_type="kb"
        )
