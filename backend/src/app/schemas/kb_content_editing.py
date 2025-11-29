"""
KB Content Editing Schemas - Pydantic models for content editing operations.

WHY:
- Enable manual content editing in preview pages
- Track edit history and revisions
- Support copy/export functionality
- Maintain original content preservation

HOW:
- Edit operation tracking
- Revision history management
- Content export formats
- Undo/redo support

BUILDS ON: Existing draft architecture (draft.py, knowledge_base.py)
"""

from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict, Any, Literal
from datetime import datetime
from enum import Enum
from uuid import UUID


class EditOperation(str, Enum):
    """Edit operation types for tracking changes"""
    DELETE = "delete"
    REPLACE = "replace"
    INSERT = "insert"


class EditOperationDetail(BaseModel):
    """
    Individual edit operation detail.

    WHY: Track granular changes for undo/redo functionality
    HOW: Store operation type, position, and text changes
    """

    operation: EditOperation = Field(..., description="Type of edit operation")
    position: int = Field(..., ge=0, description="Character position in content")
    original_text: Optional[str] = Field(None, description="Original text (for replace/delete)")
    new_text: Optional[str] = Field(None, description="New text (for replace/insert)")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="When operation occurred")

    @validator("original_text", "new_text")
    def validate_text_content(cls, v, values):
        """Ensure appropriate text content for operation type"""
        operation = values.get('operation')
        if not operation:
            return v

        if operation == EditOperation.DELETE and v == "new_text":
            if v is not None:
                raise ValueError("Delete operation should not have new_text")
        elif operation == EditOperation.INSERT and v == "original_text":
            if v is not None:
                raise ValueError("Insert operation should not have original_text")

        return v

    class Config:
        json_schema_extra = {
            "example": {
                "operation": "replace",
                "position": 100,
                "original_text": "unwanted link text",
                "new_text": "",
                "timestamp": "2025-01-15T10:30:00Z"
            }
        }


class ContentEditingRequest(BaseModel):
    """
    Request to edit page content.

    WHY: Allow users to manually edit scraped content
    HOW: Submit edited content with optional operation tracking
    """

    page_index: int = Field(..., ge=0, description="Index of page to edit (0-based)")
    edited_content: str = Field(..., description="Full edited content of the page")
    edit_operations: Optional[List[EditOperationDetail]] = Field(
        None,
        description="Detailed edit operations (optional, for granular tracking)"
    )
    preserve_original: bool = Field(
        default=True,
        description="Whether to preserve original content for revert capability"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "page_index": 0,
                "edited_content": "# Documentation\n\nThis is the edited content without unwanted links...",
                "edit_operations": [
                    {
                        "operation": "delete",
                        "position": 500,
                        "original_text": "[unwanted link](http://spam.com)",
                        "timestamp": "2025-01-15T10:30:00Z"
                    }
                ],
                "preserve_original": True
            }
        }


class PageRevision(BaseModel):
    """
    Single revision of a page.

    WHY: Track edit history for version control
    HOW: Store content snapshot with metadata
    """

    revision_id: str = Field(..., description="Unique revision identifier")
    page_index: int = Field(..., ge=0, description="Page index this revision belongs to")
    edited_content: str = Field(..., description="Content at this revision")
    edit_operations: List[EditOperationDetail] = Field(
        default_factory=list,
        description="Operations that created this revision"
    )
    edited_at: datetime = Field(..., description="When revision was created")
    edited_by: str = Field(..., description="User ID who made the edit")

    class Config:
        json_schema_extra = {
            "example": {
                "revision_id": "rev_abc123",
                "page_index": 0,
                "edited_content": "# Edited Documentation...",
                "edit_operations": [],
                "edited_at": "2025-01-15T10:30:00Z",
                "edited_by": "user_123"
            }
        }


class ContentEditingResponse(BaseModel):
    """
    Response after editing content.

    WHY: Confirm edit was saved and provide revision info
    HOW: Return success status and revision details
    """

    success: bool = Field(..., description="Whether edit was successful")
    draft_id: str = Field(..., description="Draft ID that was edited")
    page_index: int = Field(..., description="Page index that was edited")
    revision_id: str = Field(..., description="New revision ID created")
    message: str = Field(..., description="Success or error message")
    edited_at: datetime = Field(..., description="Timestamp of edit")
    stats: Optional[Dict[str, Any]] = Field(
        None,
        description="Edit statistics (character count, word count changes)"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "draft_id": "draft_kb_xyz789",
                "page_index": 0,
                "revision_id": "rev_abc123",
                "message": "Content edited successfully",
                "edited_at": "2025-01-15T10:30:00Z",
                "stats": {
                    "original_length": 5000,
                    "edited_length": 4500,
                    "characters_removed": 500,
                    "words_original": 800,
                    "words_edited": 720
                }
            }
        }


class RevertContentRequest(BaseModel):
    """
    Request to revert page content.

    WHY: Allow users to undo changes or revert to original
    HOW: Specify revision to revert to or use original
    """

    page_index: int = Field(..., ge=0, description="Index of page to revert")
    revision_id: Optional[str] = Field(
        None,
        description="Specific revision to revert to (None = revert to original)"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "page_index": 0,
                "revision_id": None  # Revert to original
            }
        }


class ExportFormat(str, Enum):
    """Supported export formats"""
    MARKDOWN = "markdown"
    PLAIN_TEXT = "plain_text"
    HTML = "html"
    JSON = "json"


class ExportContentRequest(BaseModel):
    """
    Request to export edited content.

    WHY: Allow users to copy/download edited content
    HOW: Export specific pages in chosen format
    """

    page_indices: Optional[List[int]] = Field(
        None,
        description="Specific page indices to export (None = all pages)"
    )
    format: ExportFormat = Field(
        default=ExportFormat.MARKDOWN,
        description="Export format"
    )
    include_metadata: bool = Field(
        default=False,
        description="Include page metadata in export"
    )
    combine_pages: bool = Field(
        default=True,
        description="Combine all pages into single document"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "page_indices": [0, 1, 2],
                "format": "markdown",
                "include_metadata": True,
                "combine_pages": True
            }
        }


class ExportContentResponse(BaseModel):
    """
    Response with exported content.

    WHY: Return formatted content ready for copy/download
    HOW: Provide content string with metadata
    """

    content: str = Field(..., description="Exported content in requested format")
    format: ExportFormat = Field(..., description="Format of exported content")
    pages_exported: int = Field(..., description="Number of pages exported")
    total_size: int = Field(..., description="Total size in characters")
    metadata: Optional[Dict[str, Any]] = Field(
        None,
        description="Export metadata (timestamp, page info, etc.)"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "content": "# Page 1\n\nContent here...\n\n---\n\n# Page 2\n\nMore content...",
                "format": "markdown",
                "pages_exported": 2,
                "total_size": 5000,
                "metadata": {
                    "exported_at": "2025-01-15T10:30:00Z",
                    "pages": [
                        {"index": 0, "title": "Introduction", "size": 2500},
                        {"index": 1, "title": "Getting Started", "size": 2500}
                    ]
                }
            }
        }


class PageRevisionsResponse(BaseModel):
    """
    Response with page revision history.

    WHY: Show edit history for a page
    HOW: List all revisions with metadata
    """

    page_index: int = Field(..., description="Page index")
    original_content: str = Field(..., description="Original scraped content")
    current_content: str = Field(..., description="Current edited content")
    is_edited: bool = Field(..., description="Whether page has been edited")
    revisions: List[PageRevision] = Field(
        default_factory=list,
        description="List of all revisions (newest first)"
    )
    total_revisions: int = Field(..., description="Total number of revisions")

    class Config:
        json_schema_extra = {
            "example": {
                "page_index": 0,
                "original_content": "# Original Documentation...",
                "current_content": "# Edited Documentation...",
                "is_edited": True,
                "revisions": [
                    {
                        "revision_id": "rev_abc123",
                        "page_index": 0,
                        "edited_content": "# Edited Documentation...",
                        "edited_at": "2025-01-15T10:30:00Z",
                        "edited_by": "user_123"
                    }
                ],
                "total_revisions": 1
            }
        }


class EditingSessionInfo(BaseModel):
    """
    Information about current editing session.

    WHY: Track editing activity across all pages
    HOW: Aggregate editing statistics and status
    """

    session_id: str = Field(..., description="Editing session identifier")
    started_at: datetime = Field(..., description="When editing session started")
    last_edited_at: Optional[datetime] = Field(None, description="Last edit timestamp")
    total_edits: int = Field(default=0, description="Total number of edits made")
    pages_edited: int = Field(default=0, description="Number of pages edited")
    edited_page_indices: List[int] = Field(
        default_factory=list,
        description="Indices of pages that have been edited"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "session_id": "session_xyz789",
                "started_at": "2025-01-15T10:00:00Z",
                "last_edited_at": "2025-01-15T10:30:00Z",
                "total_edits": 5,
                "pages_edited": 2,
                "edited_page_indices": [0, 2]
            }
        }


class ContentCopyRequest(BaseModel):
    """
    Request to copy specific page content.

    WHY: Quick copy functionality for individual pages
    HOW: Get formatted content for clipboard
    """

    page_index: int = Field(..., ge=0, description="Page index to copy")
    use_edited: bool = Field(
        default=True,
        description="Use edited content if available, otherwise original"
    )
    format: ExportFormat = Field(
        default=ExportFormat.MARKDOWN,
        description="Format for copied content"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "page_index": 0,
                "use_edited": True,
                "format": "markdown"
            }
        }


class ContentCopyResponse(BaseModel):
    """
    Response with content ready for clipboard.

    WHY: Provide formatted content for copy operation
    HOW: Return content string with format info
    """

    content: str = Field(..., description="Content formatted for clipboard")
    format: ExportFormat = Field(..., description="Format of content")
    page_index: int = Field(..., description="Page index copied")
    is_edited: bool = Field(..., description="Whether edited version was used")
    size: int = Field(..., description="Content size in characters")

    class Config:
        json_schema_extra = {
            "example": {
                "content": "# Documentation\n\nThis is the content...",
                "format": "markdown",
                "page_index": 0,
                "is_edited": True,
                "size": 2500
            }
        }