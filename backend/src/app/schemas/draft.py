"""
Draft Schemas - Pydantic models for draft management.

WHY:
- Validate draft operations
- Type-safe draft handling
- Consistent draft interface

HOW:
- Pydantic BaseModel
- Field validation
- Type enums

PSEUDOCODE follows the existing codebase patterns.
"""

from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from uuid import UUID
from datetime import datetime
from enum import Enum


class DraftType(str, Enum):
    """Draft type enum."""
    CHATBOT = "chatbot"
    CHATFLOW = "chatflow"
    KB = "kb"


class DraftStatus(str, Enum):
    """Draft status enum."""
    DRAFT = "draft"
    FINALIZING = "finalizing"
    FINALIZED = "finalized"
    ERROR = "error"


class DraftCreate(BaseModel):
    """
    Draft creation schema.

    WHY: Validate draft creation
    HOW: Type, workspace, initial data
    """

    draft_type: DraftType = Field(..., description="Draft type")
    workspace_id: UUID = Field(..., description="Workspace ID")
    initial_data: Dict[str, Any] = Field(
        default_factory=dict,
        description="Initial draft data"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "draft_type": "chatbot",
                "workspace_id": "550e8400-e29b-41d4-a716-446655440000",
                "initial_data": {
                    "name": "Support Chatbot",
                    "description": "Customer support bot",
                    "system_prompt": "You are a helpful assistant"
                }
            }
        }


class DraftUpdate(BaseModel):
    """
    Draft update schema.

    WHY: Update draft data
    HOW: Partial updates
    """

    updates: Dict[str, Any] = Field(
        ...,
        description="Fields to update"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "updates": {
                    "name": "Updated Chatbot Name",
                    "system_prompt": "Updated prompt",
                    "knowledge_bases": ["kb_id_1", "kb_id_2"]
                }
            }
        }


class DraftResponse(BaseModel):
    """
    Draft response schema.

    WHY: Return draft data
    HOW: Complete draft information
    """

    id: str = Field(..., description="Draft ID")
    type: DraftType = Field(..., description="Draft type")
    workspace_id: UUID = Field(..., description="Workspace ID")
    created_by: UUID = Field(..., description="Creator user ID")

    status: DraftStatus = Field(..., description="Draft status")
    data: Dict[str, Any] = Field(..., description="Draft data")

    created_at: str = Field(..., description="Creation timestamp (ISO)")
    expires_at: str = Field(..., description="Expiry timestamp (ISO)")
    updated_at: Optional[str] = Field(None, description="Last update timestamp (ISO)")

    class Config:
        json_schema_extra = {
            "example": {
                "id": "draft_chatbot_abc123",
                "type": "chatbot",
                "workspace_id": "550e8400-e29b-41d4-a716-446655440000",
                "created_by": "660e8400-e29b-41d4-a716-446655440000",
                "status": "draft",
                "data": {
                    "name": "Support Chatbot",
                    "description": "Customer support bot",
                    "system_prompt": "You are a helpful assistant",
                    "knowledge_bases": []
                },
                "created_at": "2025-10-01T12:00:00Z",
                "expires_at": "2025-10-02T12:00:00Z",
                "updated_at": "2025-10-01T14:00:00Z"
            }
        }


class DraftFinalizeRequest(BaseModel):
    """
    Draft finalization request schema.

    WHY: Finalize draft with deployment config
    HOW: Optional deployment configuration
    """

    deployment_config: Optional[Dict[str, Any]] = Field(
        None,
        description="Deployment configuration (channels, settings)"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "deployment_config": {
                    "channels": ["website", "telegram"],
                    "telegram": {
                        "bot_token": "123456:ABC...",
                        "webhook_url": "https://..."
                    },
                    "allowed_domains": ["example.com"]
                }
            }
        }


class DraftFinalizeResponse(BaseModel):
    """
    Draft finalization response schema.

    WHY: Return finalization results
    HOW: Success status, entity ID, errors
    """

    success: bool = Field(..., description="Finalization success")
    entity_id: Optional[UUID] = Field(None, description="Created entity ID (chatbot/chatflow/kb)")
    draft_id: str = Field(..., description="Draft ID")

    errors: List[str] = Field(
        default_factory=list,
        description="Validation errors (if any)"
    )

    metadata: Dict[str, Any] = Field(
        default_factory=dict,
        description="Additional metadata (channels deployed, etc.)"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "success": true,
                "entity_id": "770e8400-e29b-41d4-a716-446655440000",
                "draft_id": "draft_chatbot_abc123",
                "errors": [],
                "metadata": {
                    "channels": {
                        "website": {
                            "status": "success",
                            "embed_code": "<script>...</script>"
                        },
                        "telegram": {
                            "status": "success",
                            "webhook_url": "https://...",
                            "bot_username": "@support_bot"
                        }
                    }
                }
            }
        }


class KBDraftDocumentAdd(BaseModel):
    """
    KB draft document addition schema.

    WHY: Add document to KB draft
    HOW: File upload metadata
    """

    filename: str = Field(..., description="File name")
    content_type: str = Field(..., description="MIME type")
    # Note: Actual file content handled separately via multipart/form-data

    class Config:
        json_schema_extra = {
            "example": {
                "filename": "product_guide.pdf",
                "content_type": "application/pdf"
            }
        }


class KBDraftDocumentResponse(BaseModel):
    """
    KB draft document response schema.

    WHY: Return added document info
    HOW: Temporary document metadata
    """

    document_id: str = Field(..., description="Temporary document ID")
    filename: str = Field(..., description="File name")
    file_size: int = Field(..., description="File size in bytes")
    content_type: str = Field(..., description="MIME type")
    status: str = Field(..., description="Document status (pending, parsed, error)")

    class Config:
        json_schema_extra = {
            "example": {
                "document_id": "temp_doc_xyz789",
                "filename": "product_guide.pdf",
                "file_size": 1234567,
                "content_type": "application/pdf",
                "status": "parsed"
            }
        }


class ChatflowDraftValidation(BaseModel):
    """
    Chatflow draft validation schema.

    WHY: Validate chatflow graph
    HOW: Return validation results
    """

    is_valid: bool = Field(..., description="Is chatflow valid")
    errors: List[str] = Field(
        default_factory=list,
        description="Validation errors"
    )
    warnings: List[str] = Field(
        default_factory=list,
        description="Validation warnings"
    )

    graph_info: Dict[str, Any] = Field(
        default_factory=dict,
        description="Graph metadata (nodes, edges, start/end nodes)"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "is_valid": true,
                "errors": [],
                "warnings": ["No error handling configured for HTTP node"],
                "graph_info": {
                    "node_count": 5,
                    "edge_count": 4,
                    "start_node": "trigger_1",
                    "end_nodes": ["response_1"],
                    "has_cycles": false
                }
            }
        }


class DraftListResponse(BaseModel):
    """
    Draft list response schema.

    WHY: Return user's drafts
    HOW: List with metadata
    """

    items: List[DraftResponse] = Field(..., description="List of drafts")
    total: int = Field(..., description="Total count")

    class Config:
        json_schema_extra = {
            "example": {
                "items": [
                    {
                        "id": "draft_chatbot_abc123",
                        "type": "chatbot",
                        "workspace_id": "550e8400-e29b-41d4-a716-446655440000",
                        "status": "draft",
                        "data": {"name": "Support Bot"},
                        "created_at": "2025-10-01T12:00:00Z",
                        "expires_at": "2025-10-02T12:00:00Z"
                    }
                ],
                "total": 3
            }
        }
