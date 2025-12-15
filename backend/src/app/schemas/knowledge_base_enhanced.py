"""
Enhanced Knowledge Base schemas for advanced ETL pipeline functionality.

WHY: Extend existing KB schemas with pipeline-specific features
HOW: Add schemas for enhanced document management, chunking, and annotations
BUILDS ON: Existing knowledge_base.py patterns and multi-tenancy

PSEUDOCODE:
-----------
from typing import Dict, List, Optional, Union, Any
from pydantic import BaseModel, Field, validator
from datetime import datetime
from enum import Enum

# Enhanced document schemas
class DocumentSource(str, Enum):
    \"\"\"Source types for documents\"\"\"
    WEB_SCRAPING = \"web_scraping\"
    FILE_UPLOAD = \"file_upload\"
    CLOUD_INTEGRATION = \"cloud_integration\"
    TEXT_INPUT = \"text_input\"
    API_IMPORT = \"api_import\"

class DocumentStatus(str, Enum):
    \"\"\"Document processing status\"\"\"
    PENDING = \"pending\"
    PROCESSING = \"processing\"
    PROCESSED = \"processed\"
    FAILED = \"failed\"
    INDEXED = \"indexed\"
    ARCHIVED = \"archived\"

class ChunkingMethod(str, Enum):
    \"\"\"Available chunking methods\"\"\"
    FIXED_SIZE = \"fixed_size\"
    SEMANTIC = \"semantic\"
    BY_HEADING = \"by_heading\"
    ADAPTIVE = \"adaptive\"
    HYBRID = \"hybrid\"

class AnnotationType(str, Enum):
    \"\"\"Types of annotations\"\"\"
    ENTITY = \"entity\"
    KEYWORD = \"keyword\"
    TOPIC = \"topic\"
    CATEGORY = \"category\"
    SENTIMENT = \"sentiment\"
    SUMMARY = \"summary\"
    RELATIONSHIP = \"relationship\"

# Base schema for enhanced KB features
class EnhancedBaseSchema(BaseModel):
    \"\"\"Base schema with enhanced validation\"\"\"
    class Config:
        use_enum_values = True
        validate_assignment = True
        extra = \"forbid\"
        schema_extra = {
            \"example\": {}
        }

# Enhanced document schemas
class DocumentMetadata(EnhancedBaseSchema):
    \"\"\"Comprehensive document metadata\"\"\"
    # Source information
    source_type: DocumentSource = Field(description=\"Original source of the document\")
    source_name: str = Field(description=\"Name or identifier of the source\")
    source_url: Optional[str] = Field(None, description=\"URL if applicable\")
    source_metadata: Optional[Dict[str, Any]] = Field(default_factory=dict, description=\"Source-specific metadata\")

    # Content characteristics
    language: Optional[str] = Field(None, description=\"Detected language (ISO code)\")
    content_type: str = Field(description=\"MIME type or content classification\")
    word_count: int = Field(ge=0, description=\"Number of words in document\")
    character_count: int = Field(ge=0, description=\"Number of characters in document\")

    # Processing information
    processing_pipeline: Optional[str] = Field(None, description=\"Pipeline configuration used\")
    processing_stats: Optional[Dict[str, Any]] = Field(default_factory=dict, description=\"Processing statistics\")
    quality_score: Optional[float] = Field(None, ge=0, le=1, description=\"Content quality assessment\")

    # Temporal information
    document_created_at: Optional[datetime] = Field(None, description=\"When document was originally created\")
    document_modified_at: Optional[datetime] = Field(None, description=\"When document was last modified\")
    last_synced_at: Optional[datetime] = Field(None, description=\"When document was last synced from source\")

class EnhancedDocument(EnhancedBaseSchema):
    \"\"\"Enhanced document with comprehensive metadata\"\"\"
    document_id: str = Field(description=\"Unique document identifier\")
    knowledge_base_id: str = Field(description=\"Parent knowledge base ID\")

    # Basic information
    title: str = Field(description=\"Document title\")
    content: str = Field(description=\"Full document content\")
    preview: str = Field(max_length=500, description=\"Document preview/summary\")

    # Status and processing
    status: DocumentStatus = Field(default=DocumentStatus.PENDING, description=\"Processing status\")
    processing_errors: Optional[List[str]] = Field(default_factory=list, description=\"Any processing errors\")

    # Enhanced metadata
    metadata: DocumentMetadata = Field(description=\"Comprehensive document metadata\")

    # Timestamps (following existing patterns)
    created_at: datetime = Field(description=\"When document was added to KB\")
    updated_at: datetime = Field(description=\"When document was last updated\")
    processed_at: Optional[datetime] = Field(None, description=\"When document processing completed\")

# Enhanced chunk schemas
class ChunkMetadata(EnhancedBaseSchema):
    \"\"\"Comprehensive chunk metadata\"\"\"
    # Position and structure
    position: int = Field(ge=0, description=\"Chunk position in document\")
    start_offset: int = Field(ge=0, description=\"Character offset where chunk starts\")
    end_offset: int = Field(gt=0, description=\"Character offset where chunk ends\")

    # Content characteristics
    word_count: int = Field(ge=0, description=\"Number of words in chunk\")
    character_count: int = Field(ge=0, description=\"Number of characters in chunk\")
    sentence_count: int = Field(ge=0, description=\"Number of sentences in chunk\")

    # Chunking information
    chunking_method: ChunkingMethod = Field(description=\"Method used to create this chunk\")
    chunk_overlap: int = Field(ge=0, description=\"Overlap with adjacent chunks in characters\")

    # Semantic information
    semantic_density: Optional[float] = Field(None, ge=0, le=1, description=\"Semantic information density\")
    topical_coherence: Optional[float] = Field(None, ge=0, le=1, description=\"Topical coherence score\")

    # Structural context
    section_title: Optional[str] = Field(None, description=\"Section or heading this chunk belongs to\")
    section_level: Optional[int] = Field(None, ge=1, le=6, description=\"Heading level (1-6)\")
    parent_sections: Optional[List[str]] = Field(default_factory=list, description=\"Hierarchy of parent sections\")

class EnhancedChunk(EnhancedBaseSchema):
    \"\"\"Enhanced chunk with comprehensive metadata\"\"\"
    chunk_id: str = Field(description=\"Unique chunk identifier\")
    document_id: str = Field(description=\"Parent document ID\")
    knowledge_base_id: str = Field(description=\"Parent knowledge base ID\")

    # Content
    content: str = Field(description=\"Chunk content\")
    content_hash: str = Field(description=\"Hash of content for deduplication\")

    # Metadata
    metadata: ChunkMetadata = Field(description=\"Comprehensive chunk metadata\")

    # Vector embedding information
    embedding_model: Optional[str] = Field(None, description=\"Model used for embedding\")
    embedding_dimension: Optional[int] = Field(None, description=\"Embedding vector dimension\")
    embedding_created_at: Optional[datetime] = Field(None, description=\"When embedding was created\")

    # Timestamps
    created_at: datetime = Field(description=\"When chunk was created\")
    updated_at: datetime = Field(description=\"When chunk was last updated\")

# Annotation schemas
class Annotation(EnhancedBaseSchema):
    \"\"\"Individual annotation with comprehensive metadata\"\"\"
    annotation_id: str = Field(description=\"Unique annotation identifier\")
    type: AnnotationType = Field(description=\"Type of annotation\")

    # Content and position
    text: str = Field(description=\"Annotation text or label\")
    confidence: float = Field(ge=0, le=1, description=\"Confidence score for annotation\")
    start_offset: Optional[int] = Field(None, ge=0, description=\"Start position in content\")
    end_offset: Optional[int] = Field(None, gt=0, description=\"End position in content\")

    # Annotation metadata
    extraction_method: str = Field(description=\"Method used to extract annotation\")
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict, description=\"Annotation-specific metadata\")

    # Timestamps
    created_at: datetime = Field(description=\"When annotation was created\")

class DocumentAnnotations(EnhancedBaseSchema):
    \"\"\"Complete set of annotations for a document\"\"\"
    document_id: str = Field(description=\"Target document ID\")
    annotations: List[Annotation] = Field(description=\"List of individual annotations\")

    # Summary information for quick access
    summary: Optional[str] = Field(None, description=\"Generated document summary\")
    topics: List[str] = Field(default_factory=list, description=\"Extracted topics\")
    entities: List[str] = Field(default_factory=list, description=\"Extracted entities\")
    keywords: List[str] = Field(default_factory=list, description=\"Extracted keywords\")
    categories: List[str] = Field(default_factory=list, description=\"Document categories\")

    # Metadata
    annotation_stats: Dict[str, int] = Field(default_factory=dict, description=\"Count of each annotation type\")
    processing_info: Dict[str, Any] = Field(default_factory=dict, description=\"Annotation processing information\")

    # Timestamps
    created_at: datetime = Field(description=\"When annotations were created\")
    updated_at: datetime = Field(description=\"When annotations were last updated\")

# Knowledge Base enhancement schemas
class KnowledgeBaseStats(EnhancedBaseSchema):
    \"\"\"Comprehensive knowledge base statistics\"\"\"
    # Document statistics
    total_documents: int = Field(ge=0, description=\"Total number of documents\")
    documents_by_status: Dict[DocumentStatus, int] = Field(description=\"Document count by status\")
    documents_by_source: Dict[DocumentSource, int] = Field(description=\"Document count by source type\")

    # Content statistics
    total_chunks: int = Field(ge=0, description=\"Total number of chunks\")
    total_words: int = Field(ge=0, description=\"Total word count across all documents\")
    total_characters: int = Field(ge=0, description=\"Total character count\")
    average_document_length: float = Field(ge=0, description=\"Average document length in words\")

    # Quality metrics
    average_quality_score: Optional[float] = Field(None, ge=0, le=1, description=\"Average content quality\")
    annotation_coverage: float = Field(ge=0, le=1, description=\"Percentage of documents with annotations\")

    # Processing metrics
    successful_processing_rate: float = Field(ge=0, le=1, description=\"Rate of successful document processing\")
    average_processing_time: Optional[float] = Field(None, ge=0, description=\"Average processing time in seconds\")

    # Temporal information
    last_updated: datetime = Field(description=\"When statistics were last calculated\")
    oldest_document: Optional[datetime] = Field(None, description=\"Creation date of oldest document\")
    newest_document: Optional[datetime] = Field(None, description=\"Creation date of newest document\")

class EnhancedKnowledgeBase(EnhancedBaseSchema):
    \"\"\"Enhanced knowledge base with comprehensive features\"\"\"
    # Basic information (maintaining existing patterns)
    id: str = Field(description=\"Knowledge base identifier\")
    name: str = Field(description=\"Knowledge base name\")
    description: Optional[str] = Field(None, description=\"Knowledge base description\")
    workspace_id: str = Field(description=\"Parent workspace ID\")

    # Configuration
    chunking_config: Optional[Dict[str, Any]] = Field(default_factory=dict, description=\"Default chunking configuration\")
    annotation_config: Optional[Dict[str, Any]] = Field(default_factory=dict, description=\"Default annotation configuration\")
    processing_config: Optional[Dict[str, Any]] = Field(default_factory=dict, description=\"Default processing configuration\")

    # Statistics and metrics
    stats: Optional[KnowledgeBaseStats] = Field(None, description=\"Knowledge base statistics\")

    # Timestamps (following existing patterns)
    created_at: datetime = Field(description=\"When KB was created\")
    updated_at: datetime = Field(description=\"When KB was last updated\")
    last_sync_at: Optional[datetime] = Field(None, description=\"When KB was last synced\")

# Request/Response schemas for enhanced KB operations
class CreateEnhancedDocumentRequest(EnhancedBaseSchema):
    \"\"\"Request to create document with enhanced features\"\"\"
    title: str = Field(description=\"Document title\")
    content: str = Field(description=\"Document content\")
    source_metadata: DocumentMetadata = Field(description=\"Source and content metadata\")
    processing_options: Optional[Dict[str, Any]] = Field(default_factory=dict, description=\"Processing configuration overrides\")

class BulkDocumentUploadRequest(EnhancedBaseSchema):
    \"\"\"Request for bulk document upload\"\"\"
    documents: List[CreateEnhancedDocumentRequest] = Field(description=\"List of documents to upload\")
    processing_config: Optional[Dict[str, Any]] = Field(default_factory=dict, description=\"Shared processing configuration\")
    batch_options: Optional[Dict[str, Any]] = Field(default_factory=dict, description=\"Batch processing options\")

    @validator('documents')
    def validate_documents(cls, v):
        if not v:
            raise ValueError('At least one document must be provided')
        if len(v) > 100:  # Reasonable batch size limit
            raise ValueError('Batch size cannot exceed 100 documents')
        return v

class DocumentSearchRequest(EnhancedBaseSchema):
    \"\"\"Enhanced document search request\"\"\"
    query: str = Field(description=\"Search query\")
    filters: Optional[Dict[str, Any]] = Field(default_factory=dict, description=\"Search filters\")

    # Search options
    search_annotations: bool = Field(default=True, description=\"Include annotations in search\")
    search_metadata: bool = Field(default=True, description=\"Include metadata in search\")
    semantic_search: bool = Field(default=True, description=\"Use semantic similarity\")

    # Result options
    include_chunks: bool = Field(default=False, description=\"Include chunk-level results\")
    include_annotations: bool = Field(default=False, description=\"Include annotations in results\")
    max_results: int = Field(default=10, ge=1, le=100, description=\"Maximum number of results\")

class DocumentSearchResult(EnhancedBaseSchema):
    \"\"\"Enhanced search result with relevance information\"\"\"
    document: EnhancedDocument = Field(description=\"Matching document\")
    relevance_score: float = Field(ge=0, le=1, description=\"Relevance score for the query\")
    matching_chunks: Optional[List[EnhancedChunk]] = Field(default_factory=list, description=\"Matching chunks if requested\")
    matching_annotations: Optional[List[Annotation]] = Field(default_factory=list, description=\"Matching annotations if requested\")
    highlight_snippets: List[str] = Field(default_factory=list, description=\"Highlighted text snippets\")

class DocumentSearchResponse(EnhancedBaseSchema):
    \"\"\"Response for document search operations\"\"\"
    results: List[DocumentSearchResult] = Field(description=\"Search results\")
    total_matches: int = Field(ge=0, description=\"Total number of matching documents\")
    search_metadata: Dict[str, Any] = Field(description=\"Search execution metadata\")
    facets: Optional[Dict[str, Dict[str, int]]] = Field(default_factory=dict, description=\"Result facets for filtering\")

class KnowledgeBaseSyncRequest(EnhancedBaseSchema):
    \"\"\"Request to sync knowledge base with external sources\"\"\"
    source_types: Optional[List[DocumentSource]] = Field(None, description=\"Specific source types to sync\")
    full_sync: bool = Field(default=False, description=\"Whether to perform full sync vs incremental\")
    sync_options: Optional[Dict[str, Any]] = Field(default_factory=dict, description=\"Source-specific sync options\")

class KnowledgeBaseSyncStatus(EnhancedBaseSchema):
    \"\"\"Status of knowledge base sync operation\"\"\"
    sync_id: str = Field(description=\"Sync operation identifier\")
    status: str = Field(description=\"Sync status: pending, running, completed, failed\")
    progress: float = Field(ge=0, le=1, description=\"Sync progress (0.0 to 1.0)\")

    # Statistics
    documents_checked: int = Field(ge=0, description=\"Number of documents checked\")
    documents_updated: int = Field(ge=0, description=\"Number of documents updated\")
    documents_added: int = Field(ge=0, description=\"Number of new documents added\")
    documents_removed: int = Field(ge=0, description=\"Number of documents removed\")

    # Timing
    started_at: datetime = Field(description=\"When sync started\")
    completed_at: Optional[datetime] = Field(None, description=\"When sync completed\")
    estimated_completion: Optional[datetime] = Field(None, description=\"Estimated completion time\")

    # Error information
    errors: List[str] = Field(default_factory=list, description=\"Any errors encountered during sync\")

class DocumentProcessingStatus(EnhancedBaseSchema):
    \"\"\"Status of document processing operations\"\"\"
    document_id: str = Field(description=\"Document identifier\")
    status: DocumentStatus = Field(description=\"Current processing status\")
    progress: float = Field(ge=0, le=1, description=\"Processing progress\")

    # Processing steps
    steps_completed: List[str] = Field(description=\"Completed processing steps\")
    current_step: Optional[str] = Field(None, description=\"Currently executing step\")
    remaining_steps: List[str] = Field(description=\"Remaining processing steps\")

    # Metrics
    chunks_created: int = Field(ge=0, description=\"Number of chunks created\")
    annotations_created: int = Field(ge=0, description=\"Number of annotations created\")
    processing_time_seconds: Optional[float] = Field(None, ge=0, description=\"Total processing time\")

    # Error information
    errors: List[str] = Field(default_factory=list, description=\"Processing errors\")
    warnings: List[str] = Field(default_factory=list, description=\"Processing warnings\")

# Analytics and reporting schemas
class KnowledgeBaseAnalytics(EnhancedBaseSchema):
    \"\"\"Comprehensive analytics for knowledge base\"\"\"
    knowledge_base_id: str = Field(description=\"Knowledge base identifier\")
    period_start: datetime = Field(description=\"Analytics period start\")
    period_end: datetime = Field(description=\"Analytics period end\")

    # Content analytics
    content_growth: Dict[str, int] = Field(description=\"Content growth over time\")
    source_distribution: Dict[DocumentSource, int] = Field(description=\"Distribution of content sources\")
    quality_trends: Dict[str, float] = Field(description=\"Quality score trends\")

    # Usage analytics
    search_volume: int = Field(ge=0, description=\"Number of searches performed\")
    popular_topics: List[Dict[str, Any]] = Field(description=\"Most searched topics\")
    query_patterns: Dict[str, int] = Field(description=\"Common query patterns\")

    # Performance analytics
    processing_performance: Dict[str, float] = Field(description=\"Processing performance metrics\")
    error_rates: Dict[str, float] = Field(description=\"Error rates by operation type\")

    # Recommendations
    optimization_suggestions: List[str] = Field(description=\"Suggestions for optimization\")

class DocumentSimilarityRequest(EnhancedBaseSchema):
    \"\"\"Request to find similar documents\"\"\"
    document_id: str = Field(description=\"Reference document ID\")
    similarity_threshold: float = Field(default=0.7, ge=0, le=1, description=\"Minimum similarity score\")
    max_results: int = Field(default=10, ge=1, le=50, description=\"Maximum number of similar documents\")
    include_chunks: bool = Field(default=False, description=\"Include chunk-level similarity\")

class DocumentSimilarityResponse(EnhancedBaseSchema):
    \"\"\"Response with similar documents\"\"\"
    reference_document_id: str = Field(description=\"Reference document ID\")
    similar_documents: List[Dict[str, Any]] = Field(description=\"Similar documents with scores\")
    similarity_metadata: Dict[str, Any] = Field(description=\"Similarity calculation metadata\")

# Export and backup schemas
class KnowledgeBaseExportRequest(EnhancedBaseSchema):
    \"\"\"Request to export knowledge base data\"\"\"
    export_format: str = Field(description=\"Export format: json, csv, xml, markdown\")
    include_content: bool = Field(default=True, description=\"Include full document content\")
    include_chunks: bool = Field(default=False, description=\"Include chunk data\")
    include_annotations: bool = Field(default=True, description=\"Include annotations\")
    include_metadata: bool = Field(default=True, description=\"Include metadata\")
    compression: bool = Field(default=True, description=\"Compress export file\")

    @validator('export_format')
    def validate_export_format(cls, v):
        allowed_formats = ['json', 'csv', 'xml', 'markdown', 'pdf']
        if v not in allowed_formats:
            raise ValueError(f'Export format must be one of: {allowed_formats}')
        return v

class KnowledgeBaseExportStatus(EnhancedBaseSchema):
    \"\"\"Status of knowledge base export operation\"\"\"
    export_id: str = Field(description=\"Export operation identifier\")
    status: str = Field(description=\"Export status: pending, processing, completed, failed\")
    progress: float = Field(ge=0, le=1, description=\"Export progress\")
    file_size_bytes: Optional[int] = Field(None, ge=0, description=\"Size of export file\")
    download_url: Optional[str] = Field(None, description=\"Download URL when completed\")
    expires_at: Optional[datetime] = Field(None, description=\"When download link expires\")
    created_at: datetime = Field(description=\"When export was requested\")
    completed_at: Optional[datetime] = Field(None, description=\"When export completed\")
"""