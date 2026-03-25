"""
Document model - Individual documents within a knowledge base.

WHY:
- Store source documents for RAG system
- Track processing status and metadata
- Support multiple source types (files, text, web)
- Enable document-level operations (archive, disable, delete)

HOW:
- Belongs to a knowledge base
- Parsed into chunks for embedding
- Status tracking for async processing
- Rich metadata for filtering

PSEUDOCODE:
-----------
class Document(Base):
    __tablename__ = "documents"

    # Identity
    id: UUID (primary key, auto-generated)
        WHY: Unique identifier for this document

    knowledge_base_id: UUID (foreign key -> knowledge_bases.id, indexed, cascade delete)
        WHY: Links to parent knowledge base
        HOW: When KB deleted, all documents deleted

    name: str (required, max_length=255)
        WHY: Document filename or title
        EXAMPLE: "Product_Manual_v2.pdf", "FAQ Document"

    # Source Information
    source_type: str (enum)
        WHY: Track where document came from
        VALUES: "file_upload", "text_input", "website", "google_docs", "notion", "confluence", "api"
        HOW: Different sources may require different parsing

    source_url: str | None (max_length=2048)
        WHY: Original URL for web sources
        EXAMPLE: "https://example.com/docs/guide"
        USE: Re-crawl or update from source

    source_metadata: JSONB
        WHY: Store source-specific information

        STRUCTURE:
        {
            # For file uploads
            "original_filename": "document.pdf",
            "file_size": 1024000,
            "mime_type": "application/pdf",
            "file_hash": "sha256_hash",
                WHY: Detect duplicate uploads

            # For web sources
            "crawled_at": "2024-01-15T10:30:00Z",
            "crawl_depth": 2,
            "parent_url": "https://example.com",

            # For cloud sources
            "google_doc_id": "doc_id",
            "notion_page_id": "page_id",
            "last_synced_at": "2024-01-15T10:30:00Z",
        }

    # Storage
    file_path: str | None
        WHY: Path to stored file (if file upload)
        EXAMPLE: "/storage/kb_uuid/documents/doc_uuid.pdf"
        HOW: Secure file storage, tenant-isolated

    content_preview: text | None (max_length=500)
        WHY: Show preview in UI without loading full document
        HOW: First 500 chars of extracted text

    # Processing Status
    status: str (enum, default: "pending")
        WHY: Track async processing pipeline
        VALUES:
            - "pending": Uploaded, waiting for processing
            - "processing": Currently being parsed and chunked
            - "embedding": Chunks being embedded
            - "completed": Ready for use
            - "failed": Processing error occurred
            - "disabled": Manually disabled (not in search)
            - "archived": Kept for reference, not active

    processing_progress: int (0-100, default: 0)
        WHY: Show progress bar in UI
        HOW: Updated by background tasks

    error_message: text | None
        WHY: Store error details if processing fails
        EXAMPLE: "Failed to parse PDF: corrupted file"

    processing_metadata: JSONB
        WHY: Track processing details

        STRUCTURE:
        {
            "started_at": "2024-01-15T10:30:00Z",
            "completed_at": "2024-01-15T10:32:15Z",
            "processing_time_seconds": 135,
            "total_pages": 45,
            "total_words": 12500,
            "total_characters": 65000,
            "chunks_created": 48,
            "embeddings_generated": 48,
            "errors": []
        }

    # Content Statistics
    word_count: int (default: 0)
    character_count: int (default: 0)
    page_count: int | None
        WHY: Track for PDFs and multi-page docs

    chunk_count: int (default: 0)
        WHY: How many chunks created from this document

    # User Metadata (Custom Fields)
    custom_metadata: JSONB (default: {})
        WHY: User-defined metadata for filtering
        HOW: Users can add any key-value pairs

        EXAMPLES:
        {
            "department": "Engineering",
            "version": "2.0",
            "author": "John Smith",
            "language": "en",
            "topic": "API Documentation",
            "priority": "high",
            "expiry_date": "2025-12-31"
        }

        USE CASE: Filter queries by metadata
        query = "How to deploy?" + filter(department="Engineering")

    # Chunking Configuration (Document-Level Override)
    chunking_config: JSONB | None
        WHY: Allow per-document chunking strategy
        HOW: Overrides KB default if specified

        STRUCTURE:
        {
            "strategy": "by_heading",  # Override default strategy
            "max_characters": 1500,    # Different chunk size
            "overlap": 200,
            "custom_separators": ["\n## ", "\n### "]
        }

    # Annotations (Help Inference Service Understand Document Better)
    annotations: JSONB | None (default: None)
        WHY: Provide context to help AI better understand and use this document
        HOW: User-defined annotations guide retrieval and response generation

        STRUCTURE:
        {
            "enabled": false,
                WHY: Toggle annotations on/off

            "category": "document" | "workspace" | "policy" | "guide" | "faq" | "api_docs",
                WHY: Document type classification
                HOW: Helps AI understand document purpose

            "importance": "low" | "medium" | "high" | "critical",
                WHY: Priority level for retrieval
                HOW: Higher importance = higher relevance boost

            "purpose": str,
                WHY: Explain why this document exists
                EXAMPLE: "File upload", "Integration with Notion workspace", "Product specifications"

            "context": str,
                WHY: Additional context about the document
                EXAMPLE: "Uploaded file: Invoice-GTP00010-1.10.2025.pdf", "Synced from Notion page: Product Roadmap"

            "tags": list[str],
                WHY: Searchable keywords
                EXAMPLE: ["invoice", "payment", "billing"], ["notion", "integration", "product"]

            "notes": str,
                WHY: Internal notes for the builder
                EXAMPLE: "Automatically uploaded file", "Contains Q1 2025 data only"

            "usage_instructions": str | None,
                WHY: Guide AI on how to use this document
                EXAMPLE: "Use this for billing-related questions only", "Reference this for API endpoint documentation"

            "constraints": str | None,
                WHY: Limitations or warnings
                EXAMPLE: "Data valid until Dec 2025", "Internal use only - don't share externally"
        }

        EXAMPLE:
        {
            "enabled": true,
            "category": "document",
            "importance": "medium",
            "purpose": "File upload",
            "context": "Uploaded file: Invoice-GTP00010-1.10.2025.pdf",
            "tags": ["file", "uploaded", "invoice", "billing"],
            "notes": "Automatically uploaded file",
            "usage_instructions": "Use for invoice-related queries",
            "constraints": "Q4 2024 data only"
        }

    # Lifecycle Management
    is_enabled: bool (default: True)
        WHY: Soft disable without deleting
        HOW: Disabled docs not included in search
        USE: Temporary removal or testing

    is_archived: bool (default: False)
        WHY: Keep historical docs without active use
        HOW: Archived docs cannot be edited unless unarchived

    disabled_at: datetime | None
    archived_at: datetime | None
    auto_disabled_reason: str | None
        WHY: Track why document was auto-disabled
        EXAMPLE: "Disabled after 20 days of inactivity"

    # Timestamps
    created_by: UUID (foreign key -> users.id)
    created_at: datetime (auto-set)
    updated_at: datetime (auto-update)
    last_accessed_at: datetime | None
        WHY: Track usage for auto-disable feature

    # Relationships
    knowledge_base: KnowledgeBase (many-to-one)
        WHY: Access parent KB and workspace

    chunks: list[Chunk] (one-to-many, cascade delete)
        WHY: All chunks from this document
        HOW: When document deleted, chunks deleted

    creator: User (many-to-one)

    # Indexes
    index: (knowledge_base_id, status)
        WHY: Fast queries for KB documents by status

    index: (knowledge_base_id, is_enabled, is_archived)
        WHY: Filter active documents

    index: (source_type)
        WHY: Group by source type

    index: (file_hash)
        WHY: Detect duplicate uploads (if file_hash in source_metadata)

DOCUMENT LIFECYCLE:
-------------------
1. Upload/Create:
    status = "pending"
    is_enabled = True

2. Processing Pipeline:
    status = "processing" → parse content → extract text
    status = "embedding" → create chunks → generate embeddings
    status = "completed" → ready for use

3. Usage:
    last_accessed_at updated on each query
    Track usage statistics

4. Maintenance:
    Auto-disable after 20 days:
        if last_accessed_at < now() - 20 days:
            status = "disabled"
            auto_disabled_reason = "Inactive for 20 days"

5. Archival:
    User archives:
        is_archived = True
        archived_at = now()
        Cannot be edited unless unarchived

6. Deletion:
    Permanent removal:
        Delete document → cascade delete chunks → remove embeddings from vector store

PROCESSING STATES:
------------------
pending → processing → embedding → completed
                   ↓
                failed (with error_message)

METADATA FILTERING:
-------------------
WHY: Enable powerful search capabilities
HOW: Store custom metadata, index in vector store

EXAMPLE QUERY:
    query = "deployment steps"
    filters = {
        "custom_metadata": {
            "department": "Engineering",
            "version": "2.0"
        },
        "source_type": "google_docs",
        "is_enabled": True
    }

    → Returns only chunks from Engineering docs, version 2.0

BATCH OPERATIONS:
-----------------
WHY: Manage many documents efficiently
HOW: Support bulk enable/disable/archive/delete

EXAMPLE:
    # Disable all documents from specific source
    Document.query.filter(
        source_type == "website",
        source_url.startswith("https://old-site.com")
    ).update(is_enabled=False)

RE-PROCESSING:
--------------
WHY: Update when chunking strategy changes
HOW: Track need for re-processing

TRIGGER:
    - Chunking config changes at KB level
    - User changes document-specific chunking
    - Vector store migration

PROCESS:
    1. Mark document: status = "processing"
    2. Delete existing chunks
    3. Re-parse and re-chunk
    4. Generate new embeddings
    5. Update vector store
    6. status = "completed"

AUTO-SYNC (For Cloud Sources):
-------------------------------
WHY: Keep documents up-to-date from source
HOW: Background job checks for updates

EXAMPLE (Google Docs):
    Every 24 hours:
        1. Check document modified date from Google API
        2. If modified > last_synced_at:
            - Re-fetch content
            - Re-process
            - Update last_synced_at

SECURITY:
---------
WHY: Files may contain sensitive data
HOW: Tenant isolation + access control

- file_path includes workspace_id for isolation
- Cannot access documents from other workspaces
- File storage encrypted at rest
- API access requires valid API key with KB permissions
"""

# ACTUAL IMPLEMENTATION
from sqlalchemy import Column, String, Integer, Boolean, Text, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.db.base_class import Base
import uuid
from datetime import datetime


class Document(Base):
    """
    Document model - Individual documents within a knowledge base

    Multi-tenancy: Organization → Workspace → KB → Document
    Processing Pipeline: Upload → Parse → Chunk → Embed → Index
    """
    __tablename__ = "documents"

    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Parent KB (multi-tenancy)
    kb_id = Column(
        UUID(as_uuid=True),
        ForeignKey("knowledge_bases.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    # Also store workspace_id for direct tenant filtering
    workspace_id = Column(
        UUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    # Basic info
    name = Column(String(500), nullable=False)

    # Source information
    source_type = Column(String(50), nullable=False, index=True)
    # Types: file_upload, text_input, web_scraping, google_docs, notion, confluence, api

    source_url = Column(String(2048), nullable=True)
    source_metadata = Column(JSONB, nullable=False, default=dict)

    # Storage
    file_path = Column(String(1024), nullable=True)
    content_preview = Column(Text, nullable=True)
    content_full = Column(Text, nullable=True)  # Store full document content

    # Processing status
    status = Column(
        String(50),
        nullable=False,
        default="pending",
        index=True
    )  # pending, processing, embedding, completed, failed, disabled, archived

    processing_progress = Column(Integer, nullable=False, default=0)  # 0-100
    error_message = Column(Text, nullable=True)
    processing_metadata = Column(JSONB, nullable=True)

    # Content statistics
    word_count = Column(Integer, nullable=False, default=0)
    character_count = Column(Integer, nullable=False, default=0)
    page_count = Column(Integer, nullable=True)
    chunk_count = Column(Integer, nullable=False, default=0)

    # User metadata (custom fields for filtering)
    custom_metadata = Column(JSONB, nullable=False, default=dict)

    # Chunking configuration (document-level override)
    chunking_config = Column(JSONB, nullable=True)

    # Annotations (help AI understand document better)
    annotations = Column(JSONB, nullable=True)

    # Lifecycle management
    is_enabled = Column(Boolean, nullable=False, default=True)
    is_archived = Column(Boolean, nullable=False, default=False)
    disabled_at = Column(DateTime, nullable=True)
    archived_at = Column(DateTime, nullable=True)
    auto_disabled_reason = Column(Text, nullable=True)

    # Audit fields
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    last_accessed_at = Column(DateTime, nullable=True)

    # Relationships
    knowledge_base = relationship("KnowledgeBase", back_populates="documents")
    workspace = relationship("Workspace")
    creator = relationship("User")
    chunks = relationship(
        "Chunk",
        back_populates="document",
        cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f"<Document(id={self.id}, name={self.name}, status={self.status})>"
