"""
Chatflow model - Visual workflow-based chatbot within a workspace.

WHY:
- Advanced users need complex branching, conditionals, API integrations
- Visual drag-and-drop builder using ReactFlow
- Different from simple form-based chatbots

HOW:
- Store ReactFlow nodes/edges in config JSONB column
- Lives within a workspace (required workspace_id for multi-tenancy)
- Uses same draft-first architecture as chatbots
"""
from sqlalchemy import Column, String, Boolean, Integer, DateTime, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.db.base_class import Base
import uuid
from datetime import datetime


class Chatflow(Base):
    """
    Chatflow model - Visual workflow-based chatbot.

    Config JSONB structure:
    {
        "name": "My Chatflow",
        "description": "...",
        "nodes": [
            {"id": "1", "type": "llm", "data": {...}, "position": {"x": 100, "y": 100}}
        ],
        "edges": [
            {"id": "e1-2", "source": "1", "target": "2"}
        ],
        "variables": {},
        "settings": {"max_iterations": 10, "timeout_seconds": 30}
    }
    """
    __tablename__ = "chatflows"

    # Identity
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False)
    description = Column(String(500), nullable=True)

    # Tenant Isolation (CRITICAL)
    workspace_id = Column(
        UUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    # Workflow Configuration (nodes, edges, variables, settings)
    config = Column(JSONB, nullable=False, default=dict)

    # Version Control
    version = Column(Integer, nullable=False, default=1)

    # Lifecycle
    is_active = Column(Boolean, nullable=False, default=True)
    is_deleted = Column(Boolean, nullable=False, default=False)
    deployed_at = Column(DateTime, nullable=True)

    # Audit
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    workspace = relationship("Workspace", back_populates="chatflows")
    creator = relationship("User", foreign_keys=[created_by])

    # Indexes for common queries
    __table_args__ = (
        Index("ix_chatflows_workspace_active", "workspace_id", "is_active"),
        Index("ix_chatflows_workspace_deleted", "workspace_id", "is_deleted"),
    )

    def __repr__(self):
        return f"<Chatflow(id={self.id}, name={self.name}, workspace_id={self.workspace_id})>"

    @property
    def node_count(self) -> int:
        """Get the number of nodes in the chatflow."""
        if self.config and isinstance(self.config, dict):
            return len(self.config.get("nodes", []))
        return 0

    @property
    def edge_count(self) -> int:
        """Get the number of edges in the chatflow."""
        if self.config and isinstance(self.config, dict):
            return len(self.config.get("edges", []))
        return 0
