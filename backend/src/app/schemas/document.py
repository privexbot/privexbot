"""
Document schemas - Pydantic models for API validation.

WHY:
- Validate API requests for document operations
- Serialize document data for API responses
- Handle file uploads and metadata
- Support multiple source types

HOW:
- Request schemas for uploading/updating
- Response schemas for returning data
- Support for different source types

PSEUDOCODE:
-----------

# Base schemas
class DocumentBase(BaseModel):
    WHY: Shared fields between request/response

    name: str (min_length=1, max_length=255)
    source_type: Literal["file_upload", "text_input", "website", "google_docs", "notion", "confluence", "api"]
    source_url: str | None = None (max_length=2048)
    custom_metadata: dict | None = {}
        WHY: User-defined metadata for filtering

class DocumentSourceMetadata(BaseModel):
    WHY: Source-specific information
    HOW: Different fields per source type

    # File uploads
    original_filename: str | None = None
    file_size: int | None = None
    mime_type: str | None = None
    file_hash: str | None = None

    # Web sources
    crawled_at: datetime | None = None
    crawl_depth: int | None = None
    parent_url: str | None = None

    # Cloud sources
    google_doc_id: str | None = None
    notion_page_id: str | None = None
    confluence_page_id: str | None = None
    last_synced_at: datetime | None = None

class ChunkingConfigSchema(BaseModel):
    WHY: Per-document chunking strategy override
    HOW: Override KB default if specified

    strategy: Literal["size_based", "by_heading", "by_page", "by_similarity"] | None = None
    max_characters: int | None = None (ge=100, le=10000)
    overlap: int | None = None (ge=0, le=1000)
    custom_separators: list[str] | None = None


# Create schemas
class DocumentUploadRequest(BaseModel):
    WHY: Validate file upload requests
    HOW: File + metadata

    knowledge_base_id: UUID
    name: str | None = None
        WHY: Optional custom name (defaults to filename)

    custom_metadata: dict | None = {}
    chunking_config: ChunkingConfigSchema | None = None

    NOTE: Actual file is uploaded via multipart/form-data
    HOW: FastAPI UploadFile parameter


class DocumentTextCreate(BaseModel):
    WHY: Create document from direct text input
    HOW: Text + metadata

    knowledge_base_id: UUID
    name: str (min_length=1, max_length=255)
    content: str (min_length=1, max_length=1000000)
        WHY: Raw text content

    custom_metadata: dict | None = {}
    chunking_config: ChunkingConfigSchema | None = None

    class Config:
        json_schema_extra = {
            "example": {
                "knowledge_base_id": "uuid",
                "name": "Company FAQ",
                "content": "Q: How do I reset my password?\\nA: Click 'Forgot Password'...",
                "custom_metadata": {
                    "department": "Support",
                    "version": "1.0"
                }
            }
        }


class DocumentWebsiteCreate(BaseModel):
    WHY: Import document from website
    HOW: URL + crawl settings

    knowledge_base_id: UUID
    url: str (max_length=2048)
        WHY: Website URL to crawl

    name: str | None = None
        WHY: Optional custom name (defaults to page title)

    crawl_options: dict | None = None
        WHY: Firecrawl/Jina Reader options
        EXAMPLE:
        {
            "max_depth": 2,
            "include_paths": ["/docs/*"],
            "exclude_paths": ["/blog/*"],
            "wait_for": "selector",
            "extract_images": false
        }

    custom_metadata: dict | None = {}
    chunking_config: ChunkingConfigSchema | None = None


class DocumentCloudCreate(BaseModel):
    WHY: Import from cloud sources (Google Docs, Notion, etc.)
    HOW: Source type + source ID

    knowledge_base_id: UUID
    source_type: Literal["google_docs", "notion", "confluence"]
    source_id: str
        WHY: Document/page ID from cloud service

    name: str | None = None
    auto_sync: bool = False
        WHY: Automatically sync updates from source

    custom_metadata: dict | None = {}
    chunking_config: ChunkingConfigSchema | None = None


class DocumentUpdate(BaseModel):
    WHY: Update document metadata
    HOW: All fields optional

    name: str | None = None (min_length=1, max_length=255)
    custom_metadata: dict | None = None
    is_enabled: bool | None = None
    is_archived: bool | None = None

    NOTE: Cannot update content directly
    WHY: Would require re-chunking and re-embedding
    HOW: Delete and recreate document instead


class DocumentReprocessRequest(BaseModel):
    WHY: Reprocess document with new chunking strategy
    HOW: Optional new config

    chunking_config: ChunkingConfigSchema | None = None
        WHY: New chunking strategy (or use current)


# Response schemas
class DocumentResponse(DocumentBase):
    WHY: Return document data in API responses

    id: UUID
    knowledge_base_id: UUID
    source_metadata: DocumentSourceMetadata
    file_path: str | None
    content_preview: str | None

    status: Literal["pending", "processing", "embedding", "completed", "failed", "disabled", "archived"]
    processing_progress: int (ge=0, le=100)
    error_message: str | None

    processing_metadata: dict | None
        EXAMPLE:
        {
            "processing_time_seconds": 135,
            "total_pages": 45,
            "total_words": 12500,
            "chunks_created": 48
        }

    word_count: int = 0
    character_count: int = 0
    page_count: int | None = None
    chunk_count: int = 0

    chunking_config: ChunkingConfigSchema | None

    is_enabled: bool
    is_archived: bool
    disabled_at: datetime | None
    archived_at: datetime | None

    created_by: UUID
    created_at: datetime
    updated_at: datetime
    last_accessed_at: datetime | None

    class Config:
        from_attributes = True


class DocumentListResponse(BaseModel):
    WHY: Paginated list of documents
    HOW: Items + pagination

    items: list[DocumentResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class DocumentDetailResponse(DocumentResponse):
    WHY: Extended document details
    HOW: Include chunks preview

    chunks_preview: list[dict] | None
        WHY: First 5 chunks for quick preview
        EXAMPLE:
        [
            {
                "id": "uuid",
                "position": 0,
                "content_preview": "First 200 chars...",
                "page_number": 1
            }
        ]


class DocumentStatsResponse(BaseModel):
    WHY: Document statistics
    HOW: Aggregate chunk data

    document_id: UUID
    total_chunks: int
    total_words: int
    total_characters: int
    total_tokens: int

    chunks_by_page: dict[int, int]
        EXAMPLE: {1: 5, 2: 8, 3: 6}  # Page -> chunk count

    avg_chunk_length: float
    min_chunk_length: int
    max_chunk_length: int

    processing_time_seconds: float
    storage_size_bytes: int


class DocumentProcessingStatus(BaseModel):
    WHY: Real-time processing status
    HOW: WebSocket or polling endpoint

    document_id: UUID
    status: Literal["pending", "processing", "embedding", "completed", "failed"]
    progress_percent: int (ge=0, le=100)

    current_step: str | None
        EXAMPLES: "Parsing PDF", "Generating embeddings", "Uploading to vector store"

    chunks_processed: int
    total_chunks: int

    error_message: str | None


# Bulk operations
class DocumentBulkUploadRequest(BaseModel):
    WHY: Upload multiple files at once
    HOW: List of file references

    knowledge_base_id: UUID
    custom_metadata: dict | None = {}
        WHY: Apply same metadata to all documents

    chunking_config: ChunkingConfigSchema | None = None

    NOTE: Files uploaded via multipart/form-data


class DocumentBulkDeleteRequest(BaseModel):
    WHY: Delete multiple documents
    HOW: List of document IDs

    document_ids: list[UUID] (min_length=1, max_length=100)
    confirm: bool = False


class DocumentBulkDeleteResponse(BaseModel):
    deleted_count: int
    failed_count: int
    failed_document_ids: list[UUID]
    errors: dict[UUID, str]


class DocumentBulkUpdateRequest(BaseModel):
    WHY: Update multiple documents at once
    HOW: Same update applied to all

    document_ids: list[UUID] (min_length=1, max_length=100)
    update_data: DocumentUpdate


class DocumentBulkEnableRequest(BaseModel):
    WHY: Enable/disable multiple documents
    HOW: List of IDs + enable flag

    document_ids: list[UUID] (min_length=1, max_length=100)
    is_enabled: bool


# Search and filter
class DocumentFilterRequest(BaseModel):
    WHY: Filter documents by criteria
    HOW: Multiple filter options

    knowledge_base_id: UUID | None = None
    status: list[str] | None = None
        EXAMPLE: ["completed", "failed"]

    source_type: list[str] | None = None
    is_enabled: bool | None = None
    is_archived: bool | None = None

    custom_metadata_filters: dict | None = None
        EXAMPLE: {"department": "Sales", "version": "2.0"}

    created_after: datetime | None = None
    created_before: datetime | None = None

    search_query: str | None = None
        WHY: Search in name or content_preview

    sort_by: Literal["created_at", "updated_at", "name", "word_count", "chunk_count"] = "created_at"
    sort_order: Literal["asc", "desc"] = "desc"

    page: int = 1 (ge=1)
    page_size: int = 20 (ge=1, le=100)


# Metadata management
class DocumentMetadataUpdate(BaseModel):
    WHY: Update custom metadata
    HOW: Add/update/remove fields

    add_fields: dict | None = None
        WHY: Add new fields or update existing

    remove_fields: list[str] | None = None
        WHY: Remove specific fields

    class Config:
        json_schema_extra = {
            "example": {
                "add_fields": {
                    "department": "Engineering",
                    "reviewed": true
                },
                "remove_fields": ["old_field"]
            }
        }


USAGE IN API ENDPOINTS:
------------------------

# Upload file
@router.post("/documents/upload", response_model=DocumentResponse)
async def upload_document(
    file: UploadFile,
    request_data: DocumentUploadRequest,
    current_user: User
):
    # Validate KB access
    kb = get_kb_or_404(request_data.knowledge_base_id, current_user)

    # Save file
    file_path = save_uploaded_file(file, kb.id)

    # Create document
    doc = Document(
        knowledge_base_id=kb.id,
        name=request_data.name or file.filename,
        source_type="file_upload",
        file_path=file_path,
        source_metadata={
            "original_filename": file.filename,
            "file_size": file.size,
            "mime_type": file.content_type,
            "file_hash": calculate_file_hash(file)
        },
        custom_metadata=request_data.custom_metadata,
        chunking_config=request_data.chunking_config,
        status="pending",
        created_by=current_user.id
    )
    db.add(doc)
    db.commit()

    # Queue processing task
    process_document.delay(doc.id)

    return doc


# Create from text
@router.post("/documents/text", response_model=DocumentResponse)
def create_text_document(doc_data: DocumentTextCreate, current_user: User):
    kb = get_kb_or_404(doc_data.knowledge_base_id, current_user)

    doc = Document(
        knowledge_base_id=kb.id,
        name=doc_data.name,
        source_type="text_input",
        content=doc_data.content,
        custom_metadata=doc_data.custom_metadata,
        chunking_config=doc_data.chunking_config,
        status="pending",
        created_by=current_user.id
    )
    db.add(doc)
    db.commit()

    # Process immediately (text is already available)
    process_document.delay(doc.id)

    return doc


# Import from website
@router.post("/documents/website", response_model=DocumentResponse)
async def import_website(doc_data: DocumentWebsiteCreate, current_user: User):
    kb = get_kb_or_404(doc_data.knowledge_base_id, current_user)

    # Crawl website (using Firecrawl or Jina Reader)
    content, metadata = await crawl_website(
        url=doc_data.url,
        options=doc_data.crawl_options
    )

    doc = Document(
        knowledge_base_id=kb.id,
        name=doc_data.name or metadata.get("title", doc_data.url),
        source_type="website",
        source_url=doc_data.url,
        content=content,
        source_metadata={
            "crawled_at": datetime.utcnow(),
            "crawl_depth": doc_data.crawl_options.get("max_depth", 1)
        },
        custom_metadata=doc_data.custom_metadata,
        chunking_config=doc_data.chunking_config,
        status="pending",
        created_by=current_user.id
    )
    db.add(doc)
    db.commit()

    process_document.delay(doc.id)

    return doc


# Get document details
@router.get("/documents/{document_id}", response_model=DocumentDetailResponse)
def get_document(document_id: UUID, current_user: User):
    doc = get_document_or_404(document_id, current_user)

    # Get chunks preview
    chunks_preview = db.query(Chunk).filter(
        Chunk.document_id == document_id
    ).order_by(Chunk.position).limit(5).all()

    response = DocumentDetailResponse.from_orm(doc)
    response.chunks_preview = [
        {
            "id": chunk.id,
            "position": chunk.position,
            "content_preview": chunk.preview,
            "page_number": chunk.page_number
        }
        for chunk in chunks_preview
    ]

    return response


# Filter documents
@router.post("/documents/filter", response_model=DocumentListResponse)
def filter_documents(filter_data: DocumentFilterRequest, current_user: User):
    # Build query with filters
    query = db.query(Document).join(KnowledgeBase).join(Workspace).join(Organization)
    query = query.filter(Organization.id == current_user.org_id)

    if filter_data.knowledge_base_id:
        query = query.filter(Document.knowledge_base_id == filter_data.knowledge_base_id)

    if filter_data.status:
        query = query.filter(Document.status.in_(filter_data.status))

    if filter_data.source_type:
        query = query.filter(Document.source_type.in_(filter_data.source_type))

    if filter_data.is_enabled is not None:
        query = query.filter(Document.is_enabled == filter_data.is_enabled)

    if filter_data.search_query:
        query = query.filter(
            or_(
                Document.name.ilike(f"%{filter_data.search_query}%"),
                Document.content_preview.ilike(f"%{filter_data.search_query}%")
            )
        )

    # Custom metadata filtering
    if filter_data.custom_metadata_filters:
        for key, value in filter_data.custom_metadata_filters.items():
            query = query.filter(
                Document.custom_metadata[key].astext == str(value)
            )

    # Sort
    sort_field = getattr(Document, filter_data.sort_by)
    if filter_data.sort_order == "desc":
        query = query.order_by(sort_field.desc())
    else:
        query = query.order_by(sort_field.asc())

    # Paginate
    total = query.count()
    documents = query.offset((filter_data.page - 1) * filter_data.page_size).limit(filter_data.page_size).all()

    return DocumentListResponse(
        items=documents,
        total=total,
        page=filter_data.page,
        page_size=filter_data.page_size,
        total_pages=(total + filter_data.page_size - 1) // filter_data.page_size
    )


# Reprocess document
@router.post("/documents/{document_id}/reprocess", response_model=DocumentResponse)
def reprocess_document(
    document_id: UUID,
    reprocess_data: DocumentReprocessRequest,
    current_user: User
):
    doc = get_document_or_404(document_id, current_user)

    # Update chunking config if provided
    if reprocess_data.chunking_config:
        doc.chunking_config = reprocess_data.chunking_config

    # Delete existing chunks
    db.query(Chunk).filter(Chunk.document_id == document_id).delete()

    # Reset status
    doc.status = "pending"
    doc.processing_progress = 0
    db.commit()

    # Queue processing
    process_document.delay(doc.id)

    return doc
"""
