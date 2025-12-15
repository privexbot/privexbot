"""
KBAuditLog model - Track all operations on Knowledge Bases for security and compliance.

WHY:
- Security: Track who did what when
- Compliance: Audit trail for data governance
- Debugging: Understand what happened before an issue
- Analytics: Usage patterns and user behavior
- Accountability: Who made changes

HOW:
- Automatically log all KB operations
- Store action, actor, target, metadata
- Immutable records (never delete, only add)
- Indexed for fast queries

PSEUDOCODE:
-----------
class KBAuditLog(Base):
    __tablename__ = "kb_audit_logs"

    # Fields
    id: UUID (primary key, auto-generated)

    kb_id: UUID (foreign key -> knowledge_bases.id, indexed, SET NULL on delete)
        WHY: Which KB the action was performed on
        HOW: Set to NULL when KB is deleted (keep historical records)

    user_id: UUID (foreign key -> users.id, indexed, SET NULL on delete)
        WHY: Who performed the action
        HOW: Set to NULL when user is deleted (keep historical records)

    action: str (required, indexed)
        WHY: What operation was performed
        HOW: Standardized action names for consistency

        ACTIONS:
        - 'kb.created': KB created
        - 'kb.updated': KB configuration updated
        - 'kb.deleted': KB deleted
        - 'kb.reindexed': KB re-indexed
        - 'kb.member.added': Member added to KB
        - 'kb.member.removed': Member removed from KB
        - 'kb.member.role_changed': Member role changed
        - 'kb.document.added': Document added
        - 'kb.document.deleted': Document deleted
        - 'kb.queried': KB queried (semantic search)
        - 'kb.viewed': KB details viewed
        - 'kb.stats_viewed': KB stats viewed

    target_type: str (nullable)
        WHY: Type of target resource (member, document, etc.)
        HOW: Used for filtering and grouping
        VALUES: 'kb', 'member', 'document', 'query', null

    target_id: str (nullable)
        WHY: ID of the target resource
        HOW: For member actions, store member_id; for documents, document_id

    metadata: JSONB (nullable)
        WHY: Store additional context and details
        HOW: Flexible JSON for action-specific data
        EXAMPLES:
        - For 'kb.created': {"name": "Docs", "strategy": "by_heading"}
        - For 'kb.member.added': {"user_email": "john@example.com", "role": "editor"}
        - For 'kb.queried': {"query": "how to...", "results": 5, "duration_ms": 123}

    ip_address: str (nullable)
        WHY: Track where action came from
        HOW: For security and fraud detection

    user_agent: str (nullable)
        WHY: Track what client performed action
        HOW: Browser, API client, etc.

    created_at: datetime (auto-set on creation, indexed)
        WHY: When the action happened
        HOW: For chronological queries and retention policies

    # Constraints
    # No unique constraints - allow duplicate actions (same user, same action, different times)

    # Relationships
    kb: KnowledgeBase (many-to-one, nullable)
        WHY: Access KB details (if not deleted)

    user: User (many-to-one, nullable)
        WHY: Access user details (if not deleted)

RETENTION POLICY:
-----------------
WHY: Audit logs can grow large over time
HOW: Keep logs based on importance and age
    - Critical actions (create, delete, member changes): Keep forever
    - View actions: Keep 90 days
    - Query actions: Keep 30 days
    - Implement cleanup task in Celery

INDEXING STRATEGY:
------------------
WHY: Fast queries for common use cases
HOW: Create indexes on:
    - kb_id, created_at (DESC) - KB activity timeline
    - user_id, created_at (DESC) - User activity timeline
    - action, created_at (DESC) - Action-specific queries
    - created_at (DESC) - Recent activity

EXAMPLE QUERIES:
----------------
1. Get KB activity timeline:
   SELECT * FROM kb_audit_logs
   WHERE kb_id = ? ORDER BY created_at DESC LIMIT 100

2. Get user's recent actions:
   SELECT * FROM kb_audit_logs
   WHERE user_id = ? ORDER BY created_at DESC LIMIT 50

3. Find who deleted a KB:
   SELECT * FROM kb_audit_logs
   WHERE kb_id = ? AND action = 'kb.deleted'

4. Track member changes:
   SELECT * FROM kb_audit_logs
   WHERE kb_id = ? AND action LIKE 'kb.member.%'
   ORDER BY created_at DESC
"""

# ACTUAL IMPLEMENTATION
from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.db.base_class import Base
import uuid
from datetime import datetime


class KBAuditLog(Base):
    """
    KBAuditLog - Immutable audit trail for all KB operations.

    Tracks who did what, when, where for security, compliance, and debugging.
    Records are never deleted, only added.

    Action naming convention: <resource>.<operation>
    Examples: kb.created, kb.member.added, kb.queried
    """
    __tablename__ = "kb_audit_logs"

    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Foreign keys (SET NULL on delete to preserve historical records)
    kb_id = Column(
        UUID(as_uuid=True),
        ForeignKey("knowledge_bases.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )

    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )

    # Action details
    action = Column(String(100), nullable=False, index=True)
    # Examples: 'kb.created', 'kb.updated', 'kb.deleted', 'kb.member.added', 'kb.queried'

    target_type = Column(String(50), nullable=True, index=True)
    # Values: 'kb', 'member', 'document', 'query', etc.

    target_id = Column(String(255), nullable=True)
    # ID of the target resource (member_id, document_id, etc.)

    # Metadata (flexible JSON for action-specific data)
    event_metadata = Column(JSONB, nullable=True)
    # Examples:
    # - kb.created: {"name": "Docs", "strategy": "by_heading", "sources_count": 5}
    # - kb.member.added: {"user_email": "john@example.com", "role": "editor"}
    # - kb.queried: {"query": "how to install", "results_count": 5, "duration_ms": 123}

    # Request context
    ip_address = Column(String(45), nullable=True)  # IPv4 (15) or IPv6 (45)
    user_agent = Column(Text, nullable=True)

    # Timestamp (immutable, indexed for chronological queries)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    # Indexes for common query patterns
    __table_args__ = (
        Index('idx_kbaudit_kb_created', 'kb_id', 'created_at'),
        Index('idx_kbaudit_user_created', 'user_id', 'created_at'),
        Index('idx_kbaudit_action_created', 'action', 'created_at'),
        Index('idx_kbaudit_created', 'created_at'),  # For recent activity
    )

    # Relationships (nullable because records persist even after deletion)
    kb = relationship("KnowledgeBase", foreign_keys=[kb_id])
    user = relationship("User", foreign_keys=[user_id])

    def __repr__(self):
        return f"<KBAuditLog(action={self.action}, kb_id={self.kb_id}, user_id={self.user_id}, created_at={self.created_at})>"

    @property
    def is_critical(self) -> bool:
        """
        Check if this is a critical action that should be kept forever.

        Critical actions: create, delete, member changes
        Non-critical: view, query
        """
        critical_actions = [
            'kb.created',
            'kb.deleted',
            'kb.member.added',
            'kb.member.removed',
            'kb.member.role_changed',
            'kb.reindexed'
        ]
        return self.action in critical_actions

    @property
    def is_read_action(self) -> bool:
        """Check if this is a read-only action (view, query)"""
        read_actions = ['kb.viewed', 'kb.stats_viewed', 'kb.queried']
        return self.action in read_actions

    @property
    def is_write_action(self) -> bool:
        """Check if this is a write action (create, update, delete)"""
        return not self.is_read_action

    def to_dict(self) -> dict:
        """Convert audit log to dictionary for API responses"""
        return {
            'id': str(self.id),
            'kb_id': str(self.kb_id) if self.kb_id else None,
            'user_id': str(self.user_id) if self.user_id else None,
            'action': self.action,
            'target_type': self.target_type,
            'target_id': self.target_id,
            'event_metadata': self.event_metadata,
            'ip_address': self.ip_address,
            'user_agent': self.user_agent,
            'created_at': self.created_at.isoformat(),
            'is_critical': self.is_critical,
            'is_read_action': self.is_read_action,
            'is_write_action': self.is_write_action
        }
