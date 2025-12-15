"""
Knowledge Base schemas - Pydantic models for API validation.

WHY:
- Validate API requests for KB operations
- Serialize KB data for API responses
- Type safety and documentation
- Separate internal model from API representation

HOW:
- Request schemas for creating/updating
- Response schemas for returning data
- Nested schemas for complex structures

PSEUDOCODE:
-----------

# Base schemas
class KnowledgeBaseBase(BaseModel):
    WHY: Shared fields between request/response
    HOW: Inherited by Create/Update/Response schemas

    name: str (min_length=1, max_length=100)
    description: str | None = None

class EmbeddingConfigSchema(BaseModel):
    WHY: Validate embedding configuration
    HOW: Define required fields

    provider: Literal["openai", "secret_ai", "huggingface", "cohere", "google", "aws_bedrock", "azure", "local"]
        WHY: Only allow supported providers

    model: str
        WHY: Model name for provider
        EXAMPLES: "text-embedding-ada-002", "all-MiniLM-L6-v2"

    dimensions: int (ge=1, le=4096)
        WHY: Vector size (1-4096 typical range)

    batch_size: int | None = 100 (ge=1, le=1000)
        WHY: Chunks per batch for embedding generation

class VectorStoreConfigSchema(BaseModel):
    WHY: Validate vector store configuration
    HOW: Define provider and connection details

    provider: Literal["faiss", "weaviate", "qdrant", "milvus", "pinecone", "redis", "chroma", "elasticsearch", "vespa", "vald"]

    connection: dict
        WHY: Provider-specific connection details
        EXAMPLES:
            FAISS: {"type": "faiss", "index_path": "/data/kb_uuid/faiss.index"}
            Qdrant: {"type": "qdrant", "url": "http://localhost:6333", "api_key": "..."}

    metadata_config: dict | None = None
        WHY: Which metadata fields to index
        EXAMPLE: {"indexed_fields": ["document_name", "page_number"]}

    performance: dict | None = None
        WHY: Performance tuning options
        EXAMPLE: {"cache_enabled": true, "cache_ttl": 3600}

class ContextSettingsSchema(BaseModel):
    WHY: Control bot access to KB
    HOW: Define access mode and retrieval config

    access_mode: Literal["all", "specific", "none"] = "all"
        WHY: Default access for bots in workspace

    allowed_chatbots: list[UUID] | None = None
        WHY: Specific chatbot IDs (if mode="specific")

    allowed_chatflows: list[UUID] | None = None
        WHY: Specific chatflow IDs (if mode="specific")

    retrieval_config: dict | None = None
        WHY: Default retrieval settings
        EXAMPLE:
        {
            "top_k": 5,
            "similarity_threshold": 0.7,
            "search_method": "semantic" | "keyword" | "hybrid",
            "rerank": true
        }

    usage_limits: dict | None = None
        WHY: Rate limiting
        EXAMPLE:
        {
            "max_queries_per_day": 1000,
            "max_tokens_per_query": 2000
        }


# Create schemas
class KnowledgeBaseCreate(KnowledgeBaseBase):
    WHY: Validate KB creation request
    HOW: Require embedding and vector store configs

    workspace_id: UUID
        WHY: KB belongs to workspace

    embedding_config: EmbeddingConfigSchema
        WHY: Must specify embedding model

    vector_store_config: VectorStoreConfigSchema
        WHY: Must specify vector store

    context_settings: ContextSettingsSchema | None = None
        WHY: Optional access control (defaults to "all")

    indexing_method: Literal["high_quality", "balanced", "fast"] = "balanced"
        WHY: Quality vs speed tradeoff

    class Config:
        json_schema_extra = {
            "example": {
                "name": "Product Documentation",
                "description": "All product manuals and guides",
                "workspace_id": "uuid",
                "embedding_config": {
                    "provider": "openai",
                    "model": "text-embedding-ada-002",
                    "dimensions": 1536,
                    "batch_size": 100
                },
                "vector_store_config": {
                    "provider": "qdrant",
                    "connection": {
                        "url": "http://localhost:6333",
                        "api_key": "your_api_key",
                        "collection_name": "kb_uuid"
                    }
                },
                "context_settings": {
                    "access_mode": "all",
                    "retrieval_config": {
                        "top_k": 5,
                        "similarity_threshold": 0.7,
                        "search_method": "hybrid"
                    }
                }
            }
        }


class KnowledgeBaseUpdate(BaseModel):
    WHY: Validate KB update request
    HOW: All fields optional (partial update)

    name: str | None = None (min_length=1, max_length=100)
    description: str | None = None
    context_settings: ContextSettingsSchema | None = None
    indexing_method: Literal["high_quality", "balanced", "fast"] | None = None

    NOTE: Cannot update embedding_config or vector_store_config after creation
    WHY: Would require re-embedding all documents
    HOW: Use migration endpoint instead


# Response schemas
class KnowledgeBaseResponse(KnowledgeBaseBase):
    WHY: Return KB data in API responses
    HOW: Include all fields + timestamps + stats

    id: UUID
    workspace_id: UUID
    embedding_config: EmbeddingConfigSchema
    vector_store_config: VectorStoreConfigSchema
    context_settings: ContextSettingsSchema
    indexing_method: str

    total_documents: int = 0
    total_chunks: int = 0
    total_tokens: int = 0
    last_indexed_at: datetime | None = None

    reindex_required: bool = False

    created_by: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True  # Allow ORM model conversion


class KnowledgeBaseListResponse(BaseModel):
    WHY: Paginated list of KBs
    HOW: Include items + pagination metadata

    items: list[KnowledgeBaseResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class KnowledgeBaseStatsResponse(BaseModel):
    WHY: Detailed statistics for KB
    HOW: Aggregate data from documents and chunks

    kb_id: UUID
    total_documents: int
    total_chunks: int
    total_tokens: int
    total_storage_bytes: int

    documents_by_status: dict
        EXAMPLE: {"pending": 5, "processing": 2, "completed": 45, "failed": 1}

    documents_by_source: dict
        EXAMPLE: {"file_upload": 30, "website": 15, "api": 5}

    avg_chunks_per_document: float
    avg_words_per_chunk: float

    last_document_added: datetime | None
    last_indexed_at: datetime | None


# Query schemas
class KnowledgeBaseQueryRequest(BaseModel):
    WHY: Validate search/query requests
    HOW: Define query + filters + settings

    query: str (min_length=1, max_length=1000)
        WHY: User's search query

    top_k: int | None = 5 (ge=1, le=100)
        WHY: Number of results to return

    similarity_threshold: float | None = 0.0 (ge=0.0, le=1.0)
        WHY: Minimum similarity score

    search_method: Literal["semantic", "keyword", "hybrid"] | None = "semantic"
        WHY: Which search algorithm to use

    filters: dict | None = None
        WHY: Metadata filtering
        EXAMPLE:
        {
            "document_name": {"$eq": "FAQ.pdf"},
            "page_number": {"$gte": 1, "$lte": 10},
            "custom_metadata.department": {"$eq": "Sales"}
        }

    rerank: bool = False
        WHY: Re-rank results for better relevance

    include_content: bool = True
        WHY: Return full chunk content or just metadata

    class Config:
        json_schema_extra = {
            "example": {
                "query": "How do I reset my password?",
                "top_k": 5,
                "similarity_threshold": 0.7,
                "search_method": "hybrid",
                "filters": {
                    "document_name": {"$eq": "FAQ.pdf"}
                }
            }
        }


class ChunkResultSchema(BaseModel):
    WHY: Single search result
    HOW: Chunk data + score

    id: UUID
    content: str | None
        WHY: Full text (if include_content=True)

    score: float (ge=0.0, le=1.0)
        WHY: Similarity score

    document_id: UUID
    document_name: str
    page_number: int | None

    heading: str | None
    position: int

    metadata: dict | None
        WHY: Chunk metadata from chunk_metadata field

    custom_metadata: dict | None
        WHY: Document custom_metadata

    created_at: datetime


class KnowledgeBaseQueryResponse(BaseModel):
    WHY: Return query results
    HOW: List of chunks + query metadata

    query: str
    results: list[ChunkResultSchema]
    total_results: int

    search_method: str
    filters_applied: dict | None

    processing_time_ms: int
        WHY: Performance tracking


# Migration schemas
class KnowledgeBaseMigrateRequest(BaseModel):
    WHY: Migrate KB to new vector store or embedding model
    HOW: Specify new configuration

    operation: Literal["migrate_vector_store", "migrate_embedding_model", "reindex"]

    # For vector store migration
    new_vector_store_config: VectorStoreConfigSchema | None = None

    # For embedding model migration
    new_embedding_config: EmbeddingConfigSchema | None = None

    # Options
    delete_old_data: bool = True
        WHY: Remove old vector store data after migration

    verify_migration: bool = True
        WHY: Verify data integrity after migration


class KnowledgeBaseMigrateResponse(BaseModel):
    WHY: Return migration progress/result
    HOW: Status + stats

    operation: str
    status: Literal["queued", "in_progress", "completed", "failed"]
    progress_percent: int (ge=0, le=100)

    chunks_migrated: int
    total_chunks: int

    started_at: datetime | None
    completed_at: datetime | None

    error_message: str | None


# Access control schemas
class KnowledgeBaseAccessRequest(BaseModel):
    WHY: Check if bot can access KB
    HOW: Provide bot type and ID

    bot_type: Literal["chatbot", "chatflow"]
    bot_id: UUID


class KnowledgeBaseAccessResponse(BaseModel):
    WHY: Return access permissions
    HOW: Boolean + retrieval config

    has_access: bool
    access_reason: str
        EXAMPLES: "access_mode is 'all'", "bot in allowed_chatbots", "access denied"

    retrieval_config: dict | None
        WHY: Retrieval settings for this bot (from context_settings)

    usage_limits: dict | None


# Bulk operations
class KnowledgeBaseBulkDeleteRequest(BaseModel):
    WHY: Delete multiple KBs at once
    HOW: List of KB IDs

    kb_ids: list[UUID] (min_length=1, max_length=100)
    confirm: bool = False
        WHY: Require explicit confirmation for destructive action


class KnowledgeBaseBulkDeleteResponse(BaseModel):
    WHY: Return deletion results
    HOW: Success + failed IDs

    deleted_count: int
    failed_count: int
    failed_kb_ids: list[UUID]
    errors: dict[UUID, str]
        EXAMPLE: {"uuid": "Cannot delete: in use by 3 chatbots"}


USAGE IN API ENDPOINTS:
------------------------

# Create KB
@router.post("/kb", response_model=KnowledgeBaseResponse)
def create_kb(kb_data: KnowledgeBaseCreate, current_user: User):
    # Validate workspace access
    workspace = verify_workspace_access(kb_data.workspace_id, current_user)

    # Validate embedding config
    embedding_service.validate_embedding_config(kb_data.embedding_config)

    # Create KB
    kb = KnowledgeBase(**kb_data.dict())
    db.add(kb)
    db.commit()

    # Initialize vector store
    vector_store_service.create_collection(kb)

    return kb


# Query KB
@router.post("/kb/{kb_id}/query", response_model=KnowledgeBaseQueryResponse)
def query_kb(kb_id: UUID, query_data: KnowledgeBaseQueryRequest, current_user: User):
    # Get KB with tenant check
    kb = get_kb_or_404(kb_id, current_user)

    # Generate query embedding
    query_embedding = embedding_service.embed_text(kb, query_data.query)

    # Search vector store
    start_time = time.time()
    results = vector_store_service.search(
        kb=kb,
        query_embedding=query_embedding,
        filters=query_data.filters or {},
        top_k=query_data.top_k
    )
    processing_time = int((time.time() - start_time) * 1000)

    # Format response
    return KnowledgeBaseQueryResponse(
        query=query_data.query,
        results=results,
        total_results=len(results),
        search_method=query_data.search_method,
        filters_applied=query_data.filters,
        processing_time_ms=processing_time
    )


# Update KB
@router.patch("/kb/{kb_id}", response_model=KnowledgeBaseResponse)
def update_kb(kb_id: UUID, kb_data: KnowledgeBaseUpdate, current_user: User):
    kb = get_kb_or_404(kb_id, current_user)

    # Update fields
    for field, value in kb_data.dict(exclude_unset=True).items():
        setattr(kb, field, value)

    db.commit()
    db.refresh(kb)

    return kb


# Get KB stats
@router.get("/kb/{kb_id}/stats", response_model=KnowledgeBaseStatsResponse)
def get_kb_stats(kb_id: UUID, current_user: User):
    kb = get_kb_or_404(kb_id, current_user)

    stats = calculate_kb_stats(kb)
    return stats


# Check access
@router.post("/kb/{kb_id}/check-access", response_model=KnowledgeBaseAccessResponse)
def check_kb_access(kb_id: UUID, access_data: KnowledgeBaseAccessRequest, current_user: User):
    kb = get_kb_or_404(kb_id, current_user)

    has_access, reason, config = check_bot_access_to_kb(
        kb=kb,
        bot_type=access_data.bot_type,
        bot_id=access_data.bot_id
    )

    return KnowledgeBaseAccessResponse(
        has_access=has_access,
        access_reason=reason,
        retrieval_config=config.get("retrieval_config") if config else None,
        usage_limits=config.get("usage_limits") if config else None
    )
"""
