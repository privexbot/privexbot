"""
ChatflowTemplate — global, public starter templates that any workspace can clone.

WHY:
- Marketplace surface: drop-in chatflow blueprints with sensible defaults.
- A clone produces a fresh draft in the caller's workspace, owned by the
  caller — workspace isolation kicks in only at clone time, so templates
  themselves carry no `workspace_id`.

NOTE: This model deliberately has NO `workspace_id`. Templates are global
(across the install) and surfaced read-only via `GET /api/v1/templates`.
"""

from sqlalchemy import Column, String, Text, Integer, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB

from app.db.base_class import Base


class ChatflowTemplate(Base):
    __tablename__ = "chatflow_templates"

    # Public-facing identity
    name = Column(String(150), nullable=False)
    slug = Column(String(150), nullable=False, unique=True, index=True)
    description = Column(Text, nullable=True)
    category = Column(String(50), nullable=True, index=True)
    icon = Column(String(50), nullable=True)  # emoji or short URL

    # Filtering / discovery
    tags = Column(JSONB, nullable=True, default=list)

    # The actual workflow: same shape as `Chatflow.config`
    # ({nodes, edges, variables, settings}). Cloned verbatim into a new draft.
    config = Column(JSONB, nullable=False, default=dict)

    # Visibility
    is_public = Column(Boolean, nullable=False, default=True)

    # Soft analytics
    use_count = Column(Integer, nullable=False, default=0)

    # Optional creator for user-contributed templates (null for seed rows)
    created_by = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
