"""
Chunk schemas - Pydantic models for API validation.

WHY:
- Validate API requests for chunk operations
- Serialize chunk data for API responses
- Support chunk editing and management
- Manual chunk creation for advanced users

HOW:
- Request schemas for creating/updating chunks
- Response schemas for returning data
- Search result schemas

PSEUDOCODE:
-----------

# Base schemas
class ChunkBase(BaseModel):
    WHY: Shared fields between request/response

    content: str (min_length=1, max_length=10000)
    page_number: int | None = None (ge=1)
    chunk_metadata: dict | None = {}


# Create schemas
class ChunkCreate(ChunkBase):
    WHY: Manual chunk creation (advanced users)
    HOW: Provide content + metadata

    document_id: UUID
    position: int (ge=0)
        WHY: Order within document

    keywords: list[str] | None = None
        WHY: Optional keywords for keyword search

    class Config:
        json_schema_extra = {
            "example": {
                "document_id": "uuid",
                "content": "This section explains how to reset your password...",
                "position": 0,
                "page_number": 1,
                "chunk_metadata": {
                    "heading": "Account Management",
                    "heading_level": 2
                },
                "keywords": ["password", "reset", "account"]
            }
        }


class ChunkUpdate(BaseModel):
    WHY: Update chunk content or metadata
    HOW: All fields optional

    content: str | None = None (min_length=1, max_length=10000)
    chunk_metadata: dict | None = None
    keywords: list[str] | None = None
    is_enabled: bool | None = None

    NOTE: Updating content requires re-embedding
    HOW: is_edited flag set to True, embedding regenerated


class ChunkBulkCreate(BaseModel):
    WHY: Create multiple chunks at once
    HOW: List of chunk data

    document_id: UUID
    chunks: list[ChunkCreate] (min_length=1, max_length=1000)


# Response schemas
class ChunkResponse(ChunkBase):
    WHY: Return chunk data in API responses

    id: UUID
    document_id: UUID
    content_hash: str
    position: int
    chunk_index: int

    word_count: int
    character_count: int
    token_count: int | None

    embedding_id: str | None
        WHY: Reference to vector in vector store

    embedding_metadata: dict | None
        EXAMPLE:
        {
            "model": "text-embedding-ada-002",
            "provider": "openai",
            "dimensions": 1536,
            "generated_at": "2024-01-15T10:30:00Z"
        }

    keywords: list[str] | None
    quality_score: float | None (ge=0.0, le=1.0)

    is_enabled: bool
    is_edited: bool

    created_at: datetime
    updated_at: datetime
    last_retrieved_at: datetime | None
    retrieval_count: int = 0

    related_chunks: list[UUID] | None
        WHY: Semantically similar chunks

    class Config:
        from_attributes = True


class ChunkWithDocumentResponse(ChunkResponse):
    WHY: Include parent document info
    HOW: Nested document data

    document: dict
        EXAMPLE:
        {
            "id": "uuid",
            "name": "FAQ.pdf",
            "knowledge_base_id": "uuid"
        }


class ChunkListResponse(BaseModel):
    WHY: Paginated list of chunks
    HOW: Items + pagination

    items: list[ChunkResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class ChunkDetailResponse(ChunkResponse):
    WHY: Extended chunk details
    HOW: Include surrounding chunks and document info

    document_name: str
    document_source_type: str

    previous_chunk: dict | None
        WHY: Chunk before this one (for context)
        EXAMPLE:
        {
            "id": "uuid",
            "position": 4,
            "content_preview": "First 100 chars..."
        }

    next_chunk: dict | None
        WHY: Chunk after this one (for context)

    related_chunks_preview: list[dict] | None
        WHY: Preview of related chunks
        EXAMPLE:
        [
            {
                "id": "uuid",
                "content_preview": "First 100 chars...",
                "similarity_score": 0.89
            }
        ]


# Search and filter
class ChunkFilterRequest(BaseModel):
    WHY: Filter chunks by criteria
    HOW: Multiple filter options

    document_id: UUID | None = None
    knowledge_base_id: UUID | None = None

    is_enabled: bool | None = None
    is_edited: bool | None = None

    min_quality_score: float | None = None (ge=0.0, le=1.0)
    max_quality_score: float | None = None (ge=0.0, le=1.0)

    page_number: int | None = None
    min_word_count: int | None = None
    max_word_count: int | None = None

    search_query: str | None = None
        WHY: Search in chunk content

    keywords: list[str] | None = None
        WHY: Filter by keywords

    sort_by: Literal["position", "created_at", "quality_score", "retrieval_count"] = "position"
    sort_order: Literal["asc", "desc"] = "asc"

    page: int = 1 (ge=1)
    page_size: int = 50 (ge=1, le=200)


class ChunkSearchRequest(BaseModel):
    WHY: Semantic search within document or KB
    HOW: Query + filters

    query: str (min_length=1, max_length=1000)
    document_id: UUID | None = None
    knowledge_base_id: UUID | None = None

    top_k: int = 10 (ge=1, le=100)
    similarity_threshold: float = 0.0 (ge=0.0, le=1.0)

    filters: dict | None = None


class ChunkSearchResult(BaseModel):
    WHY: Single search result
    HOW: Chunk + score + highlighting

    chunk: ChunkResponse
    score: float (ge=0.0, le=1.0)
    highlights: list[str] | None
        WHY: Highlighted matching passages
        EXAMPLE: ["...reset your <mark>password</mark> by..."]


class ChunkSearchResponse(BaseModel):
    WHY: Return search results
    HOW: List of results + metadata

    query: str
    results: list[ChunkSearchResult]
    total_results: int
    processing_time_ms: int


# Bulk operations
class ChunkBulkUpdateRequest(BaseModel):
    WHY: Update multiple chunks
    HOW: Same update applied to all

    chunk_ids: list[UUID] (min_length=1, max_length=100)
    update_data: ChunkUpdate


class ChunkBulkDeleteRequest(BaseModel):
    WHY: Delete multiple chunks
    HOW: List of chunk IDs

    chunk_ids: list[UUID] (min_length=1, max_length=100)
    confirm: bool = False


class ChunkBulkEnableRequest(BaseModel):
    WHY: Enable/disable multiple chunks
    HOW: List of IDs + enable flag

    chunk_ids: list[UUID] (min_length=1, max_length=100)
    is_enabled: bool


class ChunkBulkReembedRequest(BaseModel):
    WHY: Regenerate embeddings for multiple chunks
    HOW: List of chunk IDs

    chunk_ids: list[UUID] (min_length=1, max_length=1000)
    use_new_model: bool = False
        WHY: Use current KB embedding model or specify new one

    new_embedding_config: dict | None = None
        WHY: Optionally use different embedding model


# Quality and analytics
class ChunkQualityAssessment(BaseModel):
    WHY: Assess chunk quality
    HOW: Multiple quality metrics

    chunk_id: UUID
    quality_score: float (ge=0.0, le=1.0)

    metrics: dict
        EXAMPLE:
        {
            "length_score": 0.9,  # Optimal length
            "coherence_score": 0.85,  # Complete sentences
            "information_density": 0.8,  # Not repetitive
            "structure_score": 0.95  # Proper formatting
        }

    issues: list[str] | None
        EXAMPLES: ["Too short (< 50 chars)", "Incomplete sentence", "Low information density"]

    recommendations: list[str] | None
        EXAMPLES: ["Consider merging with next chunk", "Add more context"]


class ChunkUsageStats(BaseModel):
    WHY: Track chunk usage
    HOW: Retrieval analytics

    chunk_id: UUID
    retrieval_count: int
    last_retrieved_at: datetime | None

    retrieval_by_date: dict[str, int]
        WHY: Daily retrieval counts
        EXAMPLE: {"2024-01-15": 5, "2024-01-16": 3}

    avg_similarity_score: float (ge=0.0, le=1.0)
        WHY: Average score when retrieved

    queries_matched: list[str]
        WHY: Recent queries that matched this chunk
        EXAMPLE: ["reset password", "change password", "forgot password"]


# Feedback and annotation
class ChunkFeedback(BaseModel):
    WHY: User feedback on chunk relevance
    HOW: Thumbs up/down + comment

    chunk_id: UUID
    query: str
        WHY: Original query that returned this chunk

    relevant: bool
        WHY: Was this chunk helpful for the query?

    comment: str | None = None (max_length=500)
        WHY: Optional explanation

    rating: int | None = None (ge=1, le=5)
        WHY: Optional 1-5 star rating


class ChunkAnnotation(BaseModel):
    WHY: Manual annotations for improving chunks
    HOW: Tags + notes

    chunk_id: UUID
    tags: list[str] | None
        EXAMPLES: ["needs-review", "high-quality", "outdated", "duplicate"]

    notes: str | None (max_length=1000)
        WHY: Internal notes about this chunk

    reviewed_by: UUID | None
    reviewed_at: datetime | None


# Related chunks
class ChunkRelatedRequest(BaseModel):
    WHY: Find related chunks
    HOW: Semantic similarity

    chunk_id: UUID
    top_k: int = 5 (ge=1, le=20)
    min_similarity: float = 0.7 (ge=0.0, le=1.0)


class ChunkRelatedResponse(BaseModel):
    WHY: Return related chunks
    HOW: List of similar chunks + scores

    source_chunk_id: UUID
    related_chunks: list[ChunkSearchResult]


USAGE IN API ENDPOINTS:
------------------------

# Get chunk details
@router.get("/chunks/{chunk_id}", response_model=ChunkDetailResponse)
def get_chunk(chunk_id: UUID, current_user: User):
    chunk = get_chunk_or_404(chunk_id, current_user)

    # Get surrounding chunks
    previous_chunk = db.query(Chunk).filter(
        Chunk.document_id == chunk.document_id,
        Chunk.position == chunk.position - 1
    ).first()

    next_chunk = db.query(Chunk).filter(
        Chunk.document_id == chunk.document_id,
        Chunk.position == chunk.position + 1
    ).first()

    # Get related chunks
    related_chunks = get_related_chunks(chunk.id, top_k=3)

    response = ChunkDetailResponse.from_orm(chunk)
    response.document_name = chunk.document.name
    response.document_source_type = chunk.document.source_type
    response.previous_chunk = {"id": previous_chunk.id, "position": previous_chunk.position} if previous_chunk else None
    response.next_chunk = {"id": next_chunk.id, "position": next_chunk.position} if next_chunk else None
    response.related_chunks_preview = related_chunks

    return response


# Update chunk
@router.patch("/chunks/{chunk_id}", response_model=ChunkResponse)
def update_chunk(chunk_id: UUID, chunk_data: ChunkUpdate, current_user: User):
    chunk = get_chunk_or_404(chunk_id, current_user)

    # Track if content changed
    content_changed = chunk_data.content and chunk_data.content != chunk.content

    # Update fields
    for field, value in chunk_data.dict(exclude_unset=True).items():
        setattr(chunk, field, value)

    if content_changed:
        chunk.is_edited = True
        # Queue re-embedding
        reembed_chunk.delay(chunk.id)

    db.commit()
    db.refresh(chunk)

    return chunk


# Search chunks
@router.post("/chunks/search", response_model=ChunkSearchResponse)
def search_chunks(search_data: ChunkSearchRequest, current_user: User):
    # Determine scope
    if search_data.document_id:
        doc = get_document_or_404(search_data.document_id, current_user)
        kb = doc.knowledge_base
    elif search_data.knowledge_base_id:
        kb = get_kb_or_404(search_data.knowledge_base_id, current_user)
    else:
        raise HTTPException(400, "Must specify document_id or knowledge_base_id")

    # Generate query embedding
    query_embedding = embedding_service.embed_text(kb, search_data.query)

    # Add scope filter
    filters = search_data.filters or {}
    if search_data.document_id:
        filters["document_id"] = {"$eq": str(search_data.document_id)}

    # Search
    start_time = time.time()
    results = vector_store_service.search(
        kb=kb,
        query_embedding=query_embedding,
        filters=filters,
        top_k=search_data.top_k
    )
    processing_time = int((time.time() - start_time) * 1000)

    # Update retrieval stats
    for result in results:
        chunk = db.query(Chunk).filter(Chunk.id == result["id"]).first()
        if chunk:
            chunk.last_retrieved_at = datetime.utcnow()
            chunk.retrieval_count += 1

    db.commit()

    return ChunkSearchResponse(
        query=search_data.query,
        results=results,
        total_results=len(results),
        processing_time_ms=processing_time
    )


# Submit feedback
@router.post("/chunks/feedback", status_code=201)
def submit_chunk_feedback(feedback: ChunkFeedback, current_user: User):
    chunk = get_chunk_or_404(feedback.chunk_id, current_user)

    # Store feedback (in separate feedback table)
    feedback_record = ChunkFeedbackRecord(
        chunk_id=feedback.chunk_id,
        user_id=current_user.id,
        query=feedback.query,
        relevant=feedback.relevant,
        comment=feedback.comment,
        rating=feedback.rating
    )
    db.add(feedback_record)

    # Update chunk quality score based on feedback
    update_chunk_quality_score(chunk.id)

    db.commit()

    return {"message": "Feedback submitted successfully"}


# Bulk delete chunks
@router.post("/chunks/bulk-delete")
def bulk_delete_chunks(delete_data: ChunkBulkDeleteRequest, current_user: User):
    if not delete_data.confirm:
        raise HTTPException(400, "Must confirm bulk delete")

    # Verify access to all chunks
    chunks = db.query(Chunk).join(Document).join(KnowledgeBase).join(Workspace).join(Organization).filter(
        Chunk.id.in_(delete_data.chunk_ids),
        Organization.id == current_user.org_id
    ).all()

    if len(chunks) != len(delete_data.chunk_ids):
        raise HTTPException(403, "Access denied to some chunks")

    # Delete from vector store
    for chunk in chunks:
        kb = chunk.document.knowledge_base
        vector_store_service.delete_chunks(kb, [chunk.id])

    # Delete from database
    db.query(Chunk).filter(Chunk.id.in_(delete_data.chunk_ids)).delete()
    db.commit()

    return {"deleted_count": len(chunks)}
"""
