"""
KB Analytics Service - Track and analyze KB usage patterns.

WHY:
- Understand how KBs are being used
- Identify popular content and gaps
- Track query performance
- Optimize retrieval strategies
- Usage-based insights for users

HOW:
- Record query events with performance metrics
- Track chunk retrievals and usage
- Support session tracking
- Provide aggregated analytics
"""

from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy import func, desc

from app.models.kb_analytics import KBAnalyticsEvent
from app.models.knowledge_base import KnowledgeBase


def record_query_event(
    db: Session,
    kb_id: UUID,
    user_id: UUID,
    query: str,
    chunks_retrieved: int,
    chunks_used: int,
    chunk_ids: List[Dict[str, Any]],
    performance_ms: int,
    context: str = "api",
    session_id: Optional[str] = None,
    event_metadata: Optional[Dict[str, Any]] = None
) -> KBAnalyticsEvent:
    """
    Record a KB query event.

    WHY: Track every search for analytics
    HOW: Create analytics event record

    Args:
        db: Database session
        kb_id: UUID of knowledge base
        user_id: UUID of user performing query
        query: Search query text
        chunks_retrieved: Number of chunks returned
        chunks_used: Number of chunks actually used
        chunk_ids: List of chunk IDs with scores
        performance_ms: Query execution time in ms
        context: Where query came from (chatbot, chatflow, api)
        session_id: Session/conversation ID for grouping
        event_metadata: Additional context

    Returns:
        Created analytics event
    """
    event = KBAnalyticsEvent(
        kb_id=kb_id,
        user_id=user_id,
        event_type="query",
        query=query,
        chunks_retrieved=chunks_retrieved,
        chunks_used=chunks_used,
        chunk_ids=chunk_ids,
        performance_ms=performance_ms,
        context=context,
        session_id=session_id,
        event_metadata=event_metadata or {}
    )

    db.add(event)
    db.commit()
    db.refresh(event)
    return event


def record_chunk_viewed(
    db: Session,
    kb_id: UUID,
    user_id: UUID,
    chunk_id: str,
    session_id: Optional[str] = None
) -> KBAnalyticsEvent:
    """
    Record a chunk being viewed/retrieved.

    WHY: Track which chunks are most accessed
    HOW: Create chunk_viewed event

    Args:
        db: Database session
        kb_id: UUID of knowledge base
        user_id: UUID of user
        chunk_id: ID of chunk viewed
        session_id: Session ID

    Returns:
        Created analytics event
    """
    event = KBAnalyticsEvent(
        kb_id=kb_id,
        user_id=user_id,
        event_type="chunk_viewed",
        chunk_ids=[{"chunk_id": chunk_id}],
        session_id=session_id
    )

    db.add(event)
    db.commit()
    db.refresh(event)
    return event


def record_chunk_used(
    db: Session,
    kb_id: UUID,
    user_id: UUID,
    chunk_id: str,
    session_id: Optional[str] = None
) -> KBAnalyticsEvent:
    """
    Record a chunk being used in a response.

    WHY: Track which chunks lead to successful responses
    HOW: Create chunk_used event

    Args:
        db: Database session
        kb_id: UUID of knowledge base
        user_id: UUID of user
        chunk_id: ID of chunk used
        session_id: Session ID

    Returns:
        Created analytics event
    """
    event = KBAnalyticsEvent(
        kb_id=kb_id,
        user_id=user_id,
        event_type="chunk_used",
        chunk_ids=[{"chunk_id": chunk_id}],
        session_id=session_id
    )

    db.add(event)
    db.commit()
    db.refresh(event)
    return event


def record_feedback(
    db: Session,
    kb_id: UUID,
    user_id: UUID,
    feedback_score: int,
    feedback_comment: Optional[str] = None,
    session_id: Optional[str] = None
) -> KBAnalyticsEvent:
    """
    Record user feedback on KB results.

    WHY: Measure user satisfaction
    HOW: Create feedback event

    Args:
        db: Database session
        kb_id: UUID of knowledge base
        user_id: UUID of user
        feedback_score: Rating 1-5 stars
        feedback_comment: Optional comment
        session_id: Session ID

    Returns:
        Created analytics event
    """
    event = KBAnalyticsEvent(
        kb_id=kb_id,
        user_id=user_id,
        event_type="feedback",
        feedback_score=feedback_score,
        feedback_comment=feedback_comment,
        session_id=session_id
    )

    db.add(event)
    db.commit()
    db.refresh(event)
    return event


def get_kb_query_stats(
    db: Session,
    kb_id: UUID,
    days: int = 30
) -> Dict[str, Any]:
    """
    Get query statistics for a KB.

    WHY: Dashboard overview of KB usage
    HOW: Aggregate query events

    Args:
        db: Database session
        kb_id: UUID of knowledge base
        days: Number of days to analyze

    Returns:
        Dictionary with query statistics
    """
    since = datetime.utcnow() - timedelta(days=days)

    query_events = db.query(KBAnalyticsEvent).filter(
        KBAnalyticsEvent.kb_id == kb_id,
        KBAnalyticsEvent.event_type == "query",
        KBAnalyticsEvent.created_at >= since
    ).all()

    if not query_events:
        return {
            "total_queries": 0,
            "avg_performance_ms": 0,
            "p95_performance_ms": 0,
            "avg_chunks_retrieved": 0,
            "avg_relevance_ratio": 0,
            "slow_queries_count": 0
        }

    total_queries = len(query_events)
    performance_times = [e.performance_ms for e in query_events if e.performance_ms]
    chunks_retrieved = [e.chunks_retrieved for e in query_events if e.chunks_retrieved]
    relevance_ratios = [e.relevance_ratio for e in query_events]

    # Calculate p95 performance
    if performance_times:
        performance_times_sorted = sorted(performance_times)
        p95_index = int(len(performance_times_sorted) * 0.95)
        p95_performance = performance_times_sorted[p95_index] if p95_index < len(performance_times_sorted) else performance_times_sorted[-1]
    else:
        p95_performance = 0

    # Count slow queries (>1 second)
    slow_queries = sum(1 for e in query_events if e.is_slow_query)

    return {
        "total_queries": total_queries,
        "avg_performance_ms": sum(performance_times) / len(performance_times) if performance_times else 0,
        "p95_performance_ms": p95_performance,
        "avg_chunks_retrieved": sum(chunks_retrieved) / len(chunks_retrieved) if chunks_retrieved else 0,
        "avg_relevance_ratio": sum(relevance_ratios) / len(relevance_ratios) if relevance_ratios else 0,
        "slow_queries_count": slow_queries
    }


def get_popular_chunks(
    db: Session,
    kb_id: UUID,
    limit: int = 10,
    days: int = 30
) -> List[Dict[str, Any]]:
    """
    Get most frequently retrieved chunks.

    WHY: Identify popular content
    HOW: Aggregate chunk retrievals

    Args:
        db: Database session
        kb_id: UUID of knowledge base
        limit: Number of top chunks to return
        days: Number of days to analyze

    Returns:
        List of popular chunks with counts
    """
    since = datetime.utcnow() - timedelta(days=days)

    # This would need a more complex query to extract chunk IDs from JSONB
    # For now, return placeholder structure
    # In production, you'd use JSON operators to aggregate chunk_ids

    return []


def get_common_queries(
    db: Session,
    kb_id: UUID,
    limit: int = 10,
    days: int = 30
) -> List[Dict[str, Any]]:
    """
    Get most common search queries.

    WHY: Understand what users are searching for
    HOW: Aggregate query text

    Args:
        db: Database session
        kb_id: UUID of knowledge base
        limit: Number of queries to return
        days: Number of days to analyze

    Returns:
        List of common queries with counts
    """
    since = datetime.utcnow() - timedelta(days=days)

    # Group by query text and count
    results = db.query(
        KBAnalyticsEvent.query,
        func.count(KBAnalyticsEvent.id).label("count")
    ).filter(
        KBAnalyticsEvent.kb_id == kb_id,
        KBAnalyticsEvent.event_type == "query",
        KBAnalyticsEvent.created_at >= since,
        KBAnalyticsEvent.query != None
    ).group_by(
        KBAnalyticsEvent.query
    ).order_by(
        desc("count")
    ).limit(limit).all()

    return [
        {"query": query, "count": count}
        for query, count in results
    ]


def get_query_trends(
    db: Session,
    kb_id: UUID,
    days: int = 30
) -> List[Dict[str, Any]]:
    """
    Get daily query counts over time.

    WHY: Show usage trends in charts
    HOW: Group queries by date

    Args:
        db: Database session
        kb_id: UUID of knowledge base
        days: Number of days to analyze

    Returns:
        List of {date, count} for each day
    """
    since = datetime.utcnow() - timedelta(days=days)

    # Group by date
    results = db.query(
        func.date(KBAnalyticsEvent.created_at).label("date"),
        func.count(KBAnalyticsEvent.id).label("count")
    ).filter(
        KBAnalyticsEvent.kb_id == kb_id,
        KBAnalyticsEvent.event_type == "query",
        KBAnalyticsEvent.created_at >= since
    ).group_by(
        func.date(KBAnalyticsEvent.created_at)
    ).order_by(
        "date"
    ).all()

    return [
        {"date": date.isoformat(), "count": count}
        for date, count in results
    ]


def get_performance_trends(
    db: Session,
    kb_id: UUID,
    days: int = 30
) -> List[Dict[str, Any]]:
    """
    Get average query performance over time.

    WHY: Monitor performance degradation
    HOW: Average performance by date

    Args:
        db: Database session
        kb_id: UUID of knowledge base
        days: Number of days to analyze

    Returns:
        List of {date, avg_performance_ms} for each day
    """
    since = datetime.utcnow() - timedelta(days=days)

    results = db.query(
        func.date(KBAnalyticsEvent.created_at).label("date"),
        func.avg(KBAnalyticsEvent.performance_ms).label("avg_performance")
    ).filter(
        KBAnalyticsEvent.kb_id == kb_id,
        KBAnalyticsEvent.event_type == "query",
        KBAnalyticsEvent.created_at >= since,
        KBAnalyticsEvent.performance_ms != None
    ).group_by(
        func.date(KBAnalyticsEvent.created_at)
    ).order_by(
        "date"
    ).all()

    return [
        {"date": date.isoformat(), "avg_performance_ms": float(avg_perf)}
        for date, avg_perf in results
    ]


def get_context_breakdown(
    db: Session,
    kb_id: UUID,
    days: int = 30
) -> List[Dict[str, Any]]:
    """
    Get query count breakdown by context.

    WHY: Understand which applications use KB most
    HOW: Group queries by context field

    Args:
        db: Database session
        kb_id: UUID of knowledge base
        days: Number of days to analyze

    Returns:
        List of {context, count} for each context
    """
    since = datetime.utcnow() - timedelta(days=days)

    results = db.query(
        KBAnalyticsEvent.context,
        func.count(KBAnalyticsEvent.id).label("count")
    ).filter(
        KBAnalyticsEvent.kb_id == kb_id,
        KBAnalyticsEvent.event_type == "query",
        KBAnalyticsEvent.created_at >= since
    ).group_by(
        KBAnalyticsEvent.context
    ).all()

    return [
        {"context": context or "unknown", "count": count}
        for context, count in results
    ]


def get_session_analytics(
    db: Session,
    session_id: str
) -> Dict[str, Any]:
    """
    Get analytics for a specific session/conversation.

    WHY: Analyze conversation patterns
    HOW: Aggregate events by session

    Args:
        db: Database session
        session_id: Session ID to analyze

    Returns:
        Dictionary with session analytics
    """
    events = db.query(KBAnalyticsEvent).filter(
        KBAnalyticsEvent.session_id == session_id
    ).order_by(KBAnalyticsEvent.created_at).all()

    if not events:
        return {"session_id": session_id, "event_count": 0}

    queries = [e for e in events if e.event_type == "query"]
    feedbacks = [e for e in events if e.event_type == "feedback"]

    return {
        "session_id": session_id,
        "event_count": len(events),
        "query_count": len(queries),
        "feedback_count": len(feedbacks),
        "avg_feedback_score": sum(f.feedback_score for f in feedbacks if f.feedback_score) / len(feedbacks) if feedbacks else None,
        "duration_minutes": (events[-1].created_at - events[0].created_at).total_seconds() / 60,
        "first_event": events[0].created_at.isoformat(),
        "last_event": events[-1].created_at.isoformat()
    }


def get_feedback_summary(
    db: Session,
    kb_id: UUID,
    days: int = 30
) -> Dict[str, Any]:
    """
    Get user feedback summary.

    WHY: Measure user satisfaction
    HOW: Aggregate feedback events

    Args:
        db: Database session
        kb_id: UUID of knowledge base
        days: Number of days to analyze

    Returns:
        Dictionary with feedback summary
    """
    since = datetime.utcnow() - timedelta(days=days)

    feedbacks = db.query(KBAnalyticsEvent).filter(
        KBAnalyticsEvent.kb_id == kb_id,
        KBAnalyticsEvent.event_type == "feedback",
        KBAnalyticsEvent.created_at >= since
    ).all()

    if not feedbacks:
        return {
            "total_feedback": 0,
            "avg_score": 0,
            "score_distribution": {}
        }

    scores = [f.feedback_score for f in feedbacks if f.feedback_score]

    # Score distribution
    score_dist = {}
    for score in scores:
        score_dist[score] = score_dist.get(score, 0) + 1

    return {
        "total_feedback": len(feedbacks),
        "avg_score": sum(scores) / len(scores) if scores else 0,
        "score_distribution": score_dist
    }
