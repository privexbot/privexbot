"""
ChatMessage model - Individual messages within chat sessions.

WHY:
- Store conversation history
- Enable context-aware AI responses
- Track message sources and metadata
- Support message feedback and ratings

HOW:
- Belongs to a chat session
- Stores both user messages and bot responses
- Tracks sources (for RAG citations)
- Supports feedback collection

PSEUDOCODE:
-----------
class ChatMessage(Base):
    __tablename__ = "chat_messages"

    # Identity
    id: UUID (primary key, auto-generated)

    session_id: UUID (foreign key -> chat_sessions.id, indexed, cascade delete)
        WHY: Link to parent session
        HOW: When session deleted, messages deleted

    workspace_id: UUID (foreign key -> workspaces.id, indexed)
        WHY: Tenant isolation (redundant but useful for direct queries)

    # Message Content
    role: str (enum)
        WHY: Who sent this message
        VALUES:
            - "user": Human user input
            - "assistant": AI bot response
            - "system": System message (e.g., "Session started")

    content: text (required)
        WHY: The actual message text
        EXAMPLE:
            User: "How do I reset my password?"
            Assistant: "To reset your password, click on..."

    content_type: str (enum, default: "text")
        WHY: Support different message types
        VALUES:
            - "text": Plain text message
            - "markdown": Markdown formatted
            - "html": HTML formatted
            - "image": Image URL
            - "file": File attachment

    # Response Metadata (Assistant messages only)
    response_metadata: JSONB | None
        WHY: Track how response was generated

        STRUCTURE (for RAG responses):
        {
            "model": "secret-ai-v1",
            "temperature": 0.7,
            "tokens_used": 450,

            # For chatbots
            "type": "chatbot",
            "chatbot_id": "uuid",

            # For chatflows
            "type": "chatflow",
            "chatflow_id": "uuid",
            "nodes_executed": ["start", "llm1", "kb_search", "response"],
            "execution_time_ms": 1250,

            # RAG sources
            "sources": [
                {
                    "document_id": "uuid",
                    "document_name": "User Guide.pdf",
                    "chunk_id": "uuid",
                    "content_preview": "To reset your password...",
                    "score": 0.85,
                    "page": 12
                }
            ],

            # Citations
            "has_citations": true,
            "citation_count": 2,

            # Generation details
            "latency_ms": 1200,
            "cache_hit": false,
            "error": null
        }

    # User Feedback (Optional)
    feedback: JSONB | None
        WHY: Collect user satisfaction data

        STRUCTURE:
        {
            "rating": "positive" | "negative" | "neutral",
                WHY: Thumbs up/down

            "comment": "This helped me a lot!",
                WHY: Optional user comment

            "reason": "accurate" | "helpful" | "irrelevant" | "unclear",
                WHY: Why they rated this way

            "submitted_at": "2025-01-15T10:30:00Z"
        }

    feedback_at: datetime | None
        WHY: When feedback was submitted

    # Token Tracking (Cost Management)
    prompt_tokens: int | None
        WHY: Input tokens used (for cost tracking)

    completion_tokens: int | None
        WHY: Output tokens generated

    total_tokens: int | None
        WHY: prompt_tokens + completion_tokens
        USE: Billing, rate limiting

    # Error Handling
    error: text | None
        WHY: Store error if response generation failed
        EXAMPLE: "Rate limit exceeded", "Model unavailable"

    error_code: str | None
        WHY: Error classification
        VALUES: "rate_limit", "auth_error", "timeout", "server_error"

    # Timestamps
    created_at: datetime (auto-set)
        WHY: Message timestamp

    # Relationships
    session: ChatSession (many-to-one)

    # Indexes
    index: (session_id, created_at)
        WHY: Fast retrieval of session messages in order

    index: (workspace_id, created_at)
        WHY: Workspace-wide message analytics

    index: (role, created_at)
        WHY: Filter by role (e.g., all user messages)

    index: (feedback IS NOT NULL)
        WHY: Find messages with feedback


MESSAGE FLOW (Chatbot):
------------------------
1. User Sends:
    role = "user"
    content = "How do I reset my password?"
    created_at = now()

2. Bot Responds:
    # Retrieve from KB
    context = retrieval_service.search(kb, query)

    # Generate response
    response = inference_service.generate(
        system_prompt=chatbot.system_prompt,
        context=context,
        user_message=content,
        history=session.messages[-10:]
    )

    # Save assistant message
    role = "assistant"
    content = response.text
    response_metadata = {
        "sources": response.sources,
        "tokens_used": response.tokens
    }
    prompt_tokens = response.prompt_tokens
    completion_tokens = response.completion_tokens


MESSAGE FLOW (Chatflow):
-------------------------
1. User Sends:
    role = "user"
    content = "Show my order status"

2. Chatflow Executes:
    # Execute graph
    result = chatflow_executor.execute(chatflow, content, session)

    # Save assistant message with execution trace
    role = "assistant"
    content = result.output
    response_metadata = {
        "type": "chatflow",
        "nodes_executed": result.nodes_executed,
        "execution_time_ms": result.execution_time
    }


FEEDBACK COLLECTION:
--------------------
WHY: Improve AI responses over time
HOW: Users rate messages in widget

def submit_feedback(message_id, rating, comment):
    """User submits feedback on a message."""

    message = db.query(ChatMessage).get(message_id)

    message.feedback = {
        "rating": rating,  # "positive" | "negative"
        "comment": comment,
        "submitted_at": datetime.utcnow().isoformat()
    }
    message.feedback_at = datetime.utcnow()

    db.commit()

    # Use feedback for:
    # - Fine-tuning prompts
    # - Identifying poor responses
    # - Analytics dashboard


COST TRACKING:
--------------
def calculate_session_cost(session):
    """Calculate total cost for a session."""

    total_tokens = sum(
        msg.total_tokens or 0
        for msg in session.messages
        if msg.role == "assistant"
    )

    # Example: $0.002 per 1K tokens
    cost = (total_tokens / 1000) * 0.002

    return cost


ANALYTICS QUERIES:
------------------
# Average messages per session
avg_messages = db.query(func.avg(ChatSession.message_count)).scalar()

# Most common user questions
common_questions = db.query(
    ChatMessage.content,
    func.count(ChatMessage.id)
).filter(
    ChatMessage.role == "user"
).group_by(
    ChatMessage.content
).order_by(
    func.count(ChatMessage.id).desc()
).limit(10).all()

# Response quality (by feedback)
positive_feedback = db.query(func.count(ChatMessage.id)).filter(
    ChatMessage.feedback["rating"].astext == "positive"
).scalar()


GDPR COMPLIANCE:
----------------
WHY: Users can request data deletion
HOW: Cascade delete from session

def delete_user_data(email):
    """Delete all messages for a user (GDPR)."""

    # Find sessions by email in metadata
    sessions = db.query(ChatSession).filter(
        ChatSession.session_metadata["user"]["email"].astext == email
    ).all()

    # Delete sessions (cascades to messages)
    for session in sessions:
        db.delete(session)

    db.commit()
"""

from sqlalchemy import Column, String, Integer, DateTime, Text, Index, Enum, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum

from app.db.base_class import Base


class MessageRole(str, enum.Enum):
    """Message role enum."""
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


class ContentType(str, enum.Enum):
    """Content type enum."""
    TEXT = "text"
    MARKDOWN = "markdown"
    HTML = "html"
    IMAGE = "image"
    FILE = "file"


class ChatMessage(Base):
    """Chat message model."""

    __tablename__ = "chat_messages"

    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Foreign keys
    session_id = Column(
        UUID(as_uuid=True),
        ForeignKey("chat_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    workspace_id = Column(
        UUID(as_uuid=True),
        nullable=False,
        index=True
    )

    # Message content
    role = Column(Enum(MessageRole), nullable=False, index=True)
    content = Column(Text, nullable=False)
    content_type = Column(Enum(ContentType), nullable=False, default=ContentType.TEXT)

    # Response metadata
    response_metadata = Column(JSONB, nullable=True)

    # User feedback
    feedback = Column(JSONB, nullable=True)
    feedback_at = Column(DateTime, nullable=True)

    # Token tracking
    prompt_tokens = Column(Integer, nullable=True)
    completion_tokens = Column(Integer, nullable=True)
    total_tokens = Column(Integer, nullable=True)

    # Error handling
    error = Column(Text, nullable=True)
    error_code = Column(String(50), nullable=True)

    # Timestamps
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)

    # Relationships
    session = relationship("ChatSession", back_populates="messages")

    # Indexes
    __table_args__ = (
        Index("ix_chat_messages_session_created", "session_id", "created_at"),
        Index("ix_chat_messages_workspace_created", "workspace_id", "created_at"),
        Index("ix_chat_messages_role_created", "role", "created_at"),
        Index(
            "ix_chat_messages_feedback",
            "feedback",
            postgresql_where=(Column("feedback").isnot(None))
        ),
    )

    def __repr__(self):
        return f"<ChatMessage {self.id} ({self.role})>"
