"""
Chat Schemas - Pydantic models for chat request/response.

WHY:
- Validate chat API requests
- Type-safe response structures
- Consistent API interface

HOW:
- Pydantic BaseModel
- Field validation
- Response formatting

PSEUDOCODE follows the existing codebase patterns.
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime


class ChatRequest(BaseModel):
    """
    Chat request schema for public API.

    WHY: Validate incoming chat messages
    HOW: Pydantic validation

    USED BY: /api/v1/public/bots/{bot_id}/chat
    """

    message: str = Field(
        ...,
        description="User message",
        min_length=1,
        max_length=10000
    )

    session_id: Optional[str] = Field(
        None,
        description="Session ID for conversation continuity. Auto-generated if not provided."
    )

    metadata: Optional[Dict[str, Any]] = Field(
        None,
        description="Additional metadata (user info, context, etc.)"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "message": "Hello, I need help with my order",
                "session_id": "web_abc123",
                "metadata": {
                    "user_name": "John Doe",
                    "user_email": "john@example.com",
                    "page_url": "https://example.com/products"
                }
            }
        }


class SourceReference(BaseModel):
    """
    Source reference for RAG responses.

    WHY: Show knowledge base sources
    HOW: Include chunk references
    """

    chunk_id: UUID = Field(..., description="Chunk ID")
    document_id: UUID = Field(..., description="Document ID")
    document_title: Optional[str] = Field(None, description="Document title")
    content: str = Field(..., description="Chunk content")
    score: float = Field(..., description="Relevance score", ge=0.0, le=1.0)
    metadata: Optional[Dict[str, Any]] = Field(None, description="Chunk metadata")

    class Config:
        json_schema_extra = {
            "example": {
                "chunk_id": "550e8400-e29b-41d4-a716-446655440000",
                "document_id": "660e8400-e29b-41d4-a716-446655440000",
                "document_title": "Product Guide.pdf",
                "content": "To reset your password, go to Settings > Security...",
                "score": 0.95,
                "metadata": {"page": 5}
            }
        }


class ChatResponse(BaseModel):
    """
    Chat response schema for public API.

    WHY: Consistent response format
    HOW: Include message, sources, metadata
    """

    response: str = Field(
        ...,
        description="Bot response message"
    )

    session_id: str = Field(
        ...,
        description="Session ID for conversation continuity"
    )

    message_id: UUID = Field(
        ...,
        description="Message ID for tracking"
    )

    sources: Optional[List[SourceReference]] = Field(
        None,
        description="Knowledge base sources (if RAG was used)"
    )

    metadata: Optional[Dict[str, Any]] = Field(
        None,
        description="Additional response metadata (tokens, execution time, etc.)"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "response": "To reset your password, go to Settings > Security and click 'Reset Password'.",
                "session_id": "web_abc123",
                "message_id": "770e8400-e29b-41d4-a716-446655440000",
                "sources": [
                    {
                        "chunk_id": "550e8400-e29b-41d4-a716-446655440000",
                        "document_id": "660e8400-e29b-41d4-a716-446655440000",
                        "document_title": "Product Guide.pdf",
                        "content": "To reset your password, go to Settings > Security...",
                        "score": 0.95,
                        "metadata": {"page": 5}
                    }
                ],
                "metadata": {
                    "tokens_used": 150,
                    "execution_time_ms": 850
                }
            }
        }


class ChatFeedback(BaseModel):
    """
    Chat feedback schema.

    WHY: Collect user feedback on responses
    HOW: Rating and optional comment
    """

    message_id: UUID = Field(
        ...,
        description="Message ID to provide feedback for"
    )

    rating: int = Field(
        ...,
        description="Rating (1-5 stars)",
        ge=1,
        le=5
    )

    comment: Optional[str] = Field(
        None,
        description="Optional feedback comment",
        max_length=1000
    )

    class Config:
        json_schema_extra = {
            "example": {
                "message_id": "770e8400-e29b-41d4-a716-446655440000",
                "rating": 5,
                "comment": "Very helpful response!"
            }
        }


class LeadCaptureRequest(BaseModel):
    """
    Lead capture request schema.

    WHY: Capture leads during chat
    HOW: Validate lead data

    USED BY: Chatbot/chatflow lead capture nodes
    """

    session_id: str = Field(
        ...,
        description="Chat session ID"
    )

    name: Optional[str] = Field(
        None,
        description="Lead name",
        max_length=200
    )

    email: Optional[str] = Field(
        None,
        description="Lead email",
        max_length=200
    )

    phone: Optional[str] = Field(
        None,
        description="Lead phone number",
        max_length=50
    )

    metadata: Optional[Dict[str, Any]] = Field(
        None,
        description="Additional lead data"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "session_id": "web_abc123",
                "name": "John Doe",
                "email": "john@example.com",
                "phone": "+1234567890",
                "metadata": {
                    "company": "Acme Inc",
                    "interest": "Enterprise plan"
                }
            }
        }


class SessionHistoryResponse(BaseModel):
    """
    Session history response schema.

    WHY: Return chat history
    HOW: List of messages with metadata
    """

    session_id: str = Field(..., description="Session ID")
    messages: List[Dict[str, Any]] = Field(..., description="List of messages")
    total_messages: int = Field(..., description="Total message count")

    class Config:
        json_schema_extra = {
            "example": {
                "session_id": "web_abc123",
                "messages": [
                    {
                        "role": "user",
                        "content": "Hello",
                        "created_at": "2025-10-01T12:00:00Z"
                    },
                    {
                        "role": "assistant",
                        "content": "Hi! How can I help you?",
                        "created_at": "2025-10-01T12:00:01Z"
                    }
                ],
                "total_messages": 2
            }
        }


class ChatAnalyticsResponse(BaseModel):
    """
    Chat analytics response schema.

    WHY: Return chat analytics
    HOW: Aggregated statistics
    """

    total_conversations: int = Field(..., description="Total conversation count")
    total_messages: int = Field(..., description="Total message count")
    avg_conversation_length: float = Field(..., description="Average messages per conversation")
    avg_response_time_ms: float = Field(..., description="Average response time in milliseconds")
    user_satisfaction: Optional[float] = Field(None, description="Average user rating (1-5)")

    conversations_by_day: Optional[List[Dict[str, Any]]] = Field(
        None,
        description="Conversations grouped by day"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "total_conversations": 1234,
                "total_messages": 5678,
                "avg_conversation_length": 4.6,
                "avg_response_time_ms": 850,
                "user_satisfaction": 4.5,
                "conversations_by_day": [
                    {"date": "2025-10-01", "count": 150},
                    {"date": "2025-10-02", "count": 200}
                ]
            }
        }
