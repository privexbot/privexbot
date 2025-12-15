"""
KBAnalytics model - Track KB usage patterns, query performance, and popular chunks.

WHY:
- Understand how KBs are being used
- Identify popular content
- Track query performance
- Optimize retrieval strategies
- Usage-based insights

HOW:
- Record every KB query
- Track chunk retrievals
- Measure performance metrics
- Aggregate for analytics

PSEUDOCODE:
-----------
class KBAnalyticsEvent(Base):
    __tablename__ = "kb_analytics_events"

    # Fields
    id: UUID (primary key, auto-generated)

    kb_id: UUID (foreign key -> knowledge_bases.id, indexed, CASCADE delete)
        WHY: Which KB was queried
        HOW: Deleted when KB is deleted

    user_id: UUID (foreign key -> users.id, indexed, SET NULL on delete)
        WHY: Who performed the query
        HOW: Set NULL when user deleted (keep anonymous analytics)

    event_type: str (required, indexed)
        WHY: Type of analytics event
        HOW: Different event types for different insights

        TYPES:
        - 'query': Semantic search query
        - 'chunk_viewed': Chunk was retrieved and shown
        - 'chunk_used': Chunk was actually used in response
        - 'feedback': User provided feedback on result

    query: text (nullable)
        WHY: The search query text
        HOW: For query pattern analysis

    query_vector: vector (nullable)
        WHY: Query embedding for similarity analysis
        HOW: Find similar queries

    chunks_retrieved: int (nullable)
        WHY: How many chunks were returned
        HOW: Track retrieval quality

    chunks_used: int (nullable)
        WHY: How many chunks were actually used
        HOW: Measure relevance

    chunk_ids: JSONB (nullable)
        WHY: Which chunks were retrieved/used
        HOW: Track popular chunks
        FORMAT: [{"chunk_id": "uuid", "rank": 1, "score": 0.95}]

    performance_ms: int (nullable)
        WHY: Query performance in milliseconds
        HOW: Identify slow queries

    context: str (nullable)
        WHY: Where query came from (chatbot, chatflow, API)
        HOW: Track usage patterns by context

    metadata: JSONB (nullable)
        WHY: Additional context
        HOW: Filter parameters, model used, etc.

    session_id: str (nullable, indexed)
        WHY: Group queries by user session
        HOW: Track conversation flows

    created_at: datetime (auto-set on creation, indexed)
        WHY: When the event occurred
        HOW: For time-series analysis

    # Relationships
    kb: KnowledgeBase (many-to-one)
    user: User (many-to-one, nullable)

ANALYTICS INSIGHTS:
-------------------
1. Popular Chunks:
   - Which chunks are retrieved most often
   - Which chunks lead to successful responses
   - Content gaps (queries with no good matches)

2. Query Patterns:
   - Most common queries
   - Query trends over time
   - Failed queries (low scores)

3. Performance Metrics:
   - Average query time
   - 95th percentile latency
   - Slow queries

4. Usage Stats:
   - Queries per day/week/month
   - Active users
   - Peak usage times

AGGREGATION STRATEGY:
---------------------
WHY: Don't store raw events forever (privacy, storage)
HOW: Aggregate and delete
    1. Keep raw events for 30 days
    2. Daily aggregation task:
       - Calculate metrics (popular chunks, avg performance)
       - Store in separate aggregated_kb_analytics table
       - Delete events older than 30 days
    3. Keep aggregated data for 1 year

RETENTION:
----------
- Raw events: 30 days
- Daily aggregates: 1 year
- Monthly aggregates: Forever
"""

# ACTUAL IMPLEMENTATION
from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Integer, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.db.base_class import Base
import uuid
from datetime import datetime


class KBAnalyticsEvent(Base):
    """
    KBAnalyticsEvent - Track individual KB usage events for analytics.

    Records queries, chunk retrievals, and performance metrics.
    Used for analytics dashboards and optimization insights.

    Event types: query, chunk_viewed, chunk_used, feedback
    """
    __tablename__ = "kb_analytics_events"

    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Foreign keys
    kb_id = Column(
        UUID(as_uuid=True),
        ForeignKey("knowledge_bases.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )

    # Event details
    event_type = Column(String(50), nullable=False, index=True)
    # Values: 'query', 'chunk_viewed', 'chunk_used', 'feedback'

    # Query details
    query = Column(Text, nullable=True)
    # The search query text

    # Results
    chunks_retrieved = Column(Integer, nullable=True)
    # Number of chunks returned

    chunks_used = Column(Integer, nullable=True)
    # Number of chunks actually used in response

    chunk_ids = Column(JSONB, nullable=True)
    # Array of {chunk_id, rank, score} objects
    # Example: [{"chunk_id": "uuid", "rank": 1, "score": 0.95}]

    # Performance metrics
    performance_ms = Column(Integer, nullable=True)
    # Query execution time in milliseconds

    # Context
    context = Column(String(50), nullable=True, index=True)
    # Values: 'chatbot', 'chatflow', 'api', 'web'

    event_metadata = Column(JSONB, nullable=True)
    # Additional context: filters, model, parameters, etc.
    # Example: {"model": "all-MiniLM-L6-v2", "top_k": 5, "score_threshold": 0.7}

    # Session tracking
    session_id = Column(String(255), nullable=True, index=True)
    # Group queries by conversation/session

    # Feedback (if event_type = 'feedback')
    feedback_score = Column(Integer, nullable=True)
    # User rating: 1-5 stars

    feedback_comment = Column(Text, nullable=True)
    # User feedback text

    # Timestamp
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    # Indexes for analytics queries
    __table_args__ = (
        Index('idx_kbanalytics_kb_created', 'kb_id', 'created_at'),  # KB usage over time
        Index('idx_kbanalytics_type_created', 'event_type', 'created_at'),  # Event type analysis
        Index('idx_kbanalytics_context_created', 'context', 'created_at'),  # Context-specific analytics
        Index('idx_kbanalytics_session', 'session_id', 'created_at'),  # Session analysis
    )

    # Relationships
    kb = relationship("KnowledgeBase", foreign_keys=[kb_id])
    user = relationship("User", foreign_keys=[user_id])

    def __repr__(self):
        return f"<KBAnalyticsEvent(event_type={self.event_type}, kb_id={self.kb_id}, created_at={self.created_at})>"

    @property
    def is_query(self) -> bool:
        """Check if this is a query event"""
        return self.event_type == 'query'

    @property
    def is_chunk_viewed(self) -> bool:
        """Check if this is a chunk viewed event"""
        return self.event_type == 'chunk_viewed'

    @property
    def is_chunk_used(self) -> bool:
        """Check if this is a chunk used event"""
        return self.event_type == 'chunk_used'

    @property
    def is_feedback(self) -> bool:
        """Check if this is a feedback event"""
        return self.event_type == 'feedback'

    @property
    def is_slow_query(self) -> bool:
        """Check if query performance was slow (>1 second)"""
        return self.performance_ms and self.performance_ms > 1000

    @property
    def has_good_results(self) -> bool:
        """Check if query returned meaningful results (>0 chunks)"""
        return self.chunks_retrieved and self.chunks_retrieved > 0

    @property
    def relevance_ratio(self) -> float:
        """Calculate ratio of chunks used vs retrieved (relevance)"""
        if not self.chunks_retrieved or self.chunks_retrieved == 0:
            return 0.0
        if not self.chunks_used:
            return 0.0
        return self.chunks_used / self.chunks_retrieved

    def to_dict(self) -> dict:
        """Convert analytics event to dictionary for API responses"""
        return {
            'id': str(self.id),
            'kb_id': str(self.kb_id),
            'user_id': str(self.user_id) if self.user_id else None,
            'event_type': self.event_type,
            'query': self.query,
            'chunks_retrieved': self.chunks_retrieved,
            'chunks_used': self.chunks_used,
            'chunk_ids': self.chunk_ids,
            'performance_ms': self.performance_ms,
            'context': self.context,
            'event_metadata': self.event_metadata,
            'session_id': self.session_id,
            'feedback_score': self.feedback_score,
            'created_at': self.created_at.isoformat(),
            'is_slow_query': self.is_slow_query,
            'has_good_results': self.has_good_results,
            'relevance_ratio': self.relevance_ratio
        }
