"""
Slug History model - Track historical slugs for backward-compatible redirects.

WHY:
- When users update slugs, old URLs should still work via redirects
- Prevent recently deleted slugs from being immediately reused (cooldown period)
- Maintain URL stability for shared links and embedded widgets

HOW:
- Store old slugs with their entity references
- On slug lookup failure, check history for redirects
- Enforce cooldown period before slug reuse
"""

from sqlalchemy import Column, String, DateTime, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID
from app.db.base_class import Base
from datetime import datetime


class SlugHistory(Base):
    """
    Slug History model - Historical slug tracking for redirects.

    When a slug is changed, the old slug is stored here with a reference to
    the entity (workspace or chatbot). This enables 301 redirects from old
    URLs to new ones.

    Additionally, when an entity is deleted, its slug enters a "cooldown"
    period during which it cannot be reused, preventing URL hijacking.

    Note: id, created_at, and updated_at are inherited from Base class.
    """
    __tablename__ = "slug_history"

    # Entity reference
    entity_type = Column(String(50), nullable=False)
    # 'workspace' or 'chatbot' - the type of entity this slug belonged to

    entity_id = Column(UUID(as_uuid=True), nullable=False)
    # The ID of the entity (workspace or chatbot) - may be null if entity deleted

    # The old slug that should redirect
    old_slug = Column(String(255), nullable=False)

    # For chatbot slugs, the workspace scope (null for workspace slugs)
    workspace_id = Column(
        UUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=True
    )
    # Chatbot slugs are scoped to workspace, workspace slugs are globally unique

    # The new slug that the old one redirects to (null if entity deleted)
    new_slug = Column(String(255), nullable=True)
    # When entity is deleted, new_slug is null and expires_at is set

    expires_at = Column(DateTime, nullable=True)
    # For deleted entities: when the slug can be reused
    # For changed slugs: typically null (redirect forever)

    # Who made the change (for audit)
    changed_by = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True
    )

    # Indexes for fast lookup
    __table_args__ = (
        # Primary lookup: find redirect by old slug and scope
        Index(
            'ix_slug_history_lookup',
            'entity_type',
            'old_slug',
            'workspace_id'
        ),
        # Find all history for an entity
        Index(
            'ix_slug_history_entity',
            'entity_type',
            'entity_id'
        ),
        # Find slugs in cooldown (for reuse validation)
        Index(
            'ix_slug_history_cooldown',
            'entity_type',
            'old_slug',
            'expires_at'
        ),
    )

    def __repr__(self):
        return (
            f"<SlugHistory("
            f"entity_type={self.entity_type}, "
            f"old_slug={self.old_slug}, "
            f"new_slug={self.new_slug}"
            f")>"
        )

    @property
    def is_in_cooldown(self) -> bool:
        """Check if this slug is still in cooldown period."""
        if self.expires_at is None:
            return False
        return datetime.utcnow() < self.expires_at

    @property
    def can_redirect(self) -> bool:
        """Check if this history entry can provide a redirect."""
        return self.new_slug is not None
