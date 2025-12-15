"""
Pipeline-related Pydantic schemas for KB ETL operations.

WHY: Validate and serialize pipeline data across API boundaries
HOW: Comprehensive schemas for configuration, monitoring, and results
BUILDS ON: Existing schema patterns from organization.py and workspace.py

PSEUDOCODE:
-----------
from typing import Dict, List, Optional, Union, Any
from pydantic import BaseModel, Field, validator
from datetime import datetime
from enum import Enum
import uuid

# Enums for pipeline operations
class PipelineStatus(str, Enum):
    \"\"\"Pipeline execution status\"\"\"
    PENDING = \"pending\"
    RUNNING = \"running\"
    COMPLETED = \"completed\"
    FAILED = \"failed\"
    CANCELLED = \"cancelled\"
    PAUSED = \"paused\"

class StepStatus(str, Enum):
    \"\"\"Individual step status\"\"\"
    WAITING = \"waiting\"
    RUNNING = \"running\"
    COMPLETED = \"completed\"
    FAILED = \"failed\"
    SKIPPED = \"skipped\"

class SourceType(str, Enum):
    \"\"\"Supported source types\"\"\"
    WEB_SCRAPING = \"web_scraping\"
    FILE_UPLOAD = \"file_upload\"
    CLOUD_INTEGRATION = \"cloud_integration\"
    TEXT_INPUT = \"text_input\"
    COMBINED = \"combined\"

class ChunkingStrategy(str, Enum):
    \"\"\"Available chunking strategies\"\"\"
    RECURSIVE = \"recursive\"
    SEMANTIC = \"semantic\"
    BY_HEADING = \"by_heading\"
    ADAPTIVE = \"adaptive\"
    HYBRID = \"hybrid\"

# Base schemas for common patterns
class BaseSchema(BaseModel):
    \"\"\"Base schema with common configuration\"\"\"
    class Config:
        use_enum_values = True
        validate_assignment = True
        extra = \"forbid\"

# Source configuration schemas
class WebScrapingConfig(BaseSchema):
    \"\"\"Configuration for web scraping source\"\"\"
    method: str = Field(default=\"scrape\", description=\"Scraping method: scrape, crawl, map, search, extract\")
    url: Optional[str] = Field(None, description=\"Target URL for single page scraping\")
    urls: Optional[List[str]] = Field(None, description=\"List of URLs for batch processing\")
    crawl_config: Optional[Dict[str, Any]] = Field(default_factory=dict, description=\"Crawling configuration\")
    extraction_config: Optional[Dict[str, Any]] = Field(default_factory=dict, description=\"Content extraction settings\")

    @validator('method')
    def validate_method(cls, v):
        allowed_methods = ['scrape', 'crawl', 'map', 'search', 'extract']
        if v not in allowed_methods:
            raise ValueError(f'Method must be one of: {allowed_methods}')
        return v

    @validator('url', 'urls')
    def validate_url_config(cls, v, values):
        method = values.get('method')
        if method == 'scrape' and not values.get('url'):
            raise ValueError('URL is required for scrape method')
        if method in ['crawl', 'map'] and not (values.get('url') or values.get('urls')):
            raise ValueError('URL or URLs required for crawl/map methods')
        return v

class FileUploadConfig(BaseSchema):
    \"\"\"Configuration for file upload source\"\"\"
    files: List[Dict[str, Any]] = Field(description=\"List of file configurations\")
    processing_config: Optional[Dict[str, Any]] = Field(default_factory=dict, description=\"File processing settings\")
    ocr_config: Optional[Dict[str, Any]] = Field(default_factory=dict, description=\"OCR settings for images/PDFs\")

    @validator('files')
    def validate_files(cls, v):
        if not v:
            raise ValueError('At least one file must be specified')
        for file_config in v:
            if 'file_path' not in file_config and 'file_content' not in file_config:
                raise ValueError('Each file must have either file_path or file_content')
        return v

class CloudIntegrationConfig(BaseSchema):
    \"\"\"Configuration for cloud service integration\"\"\"
    service: str = Field(description=\"Cloud service: google_docs, notion, microsoft_365, etc.\")
    credentials: Dict[str, Any] = Field(description=\"Service authentication credentials\")
    resource_config: Dict[str, Any] = Field(description=\"Resource selection and sync settings\")
    sync_config: Optional[Dict[str, Any]] = Field(default_factory=dict, description=\"Synchronization settings\")

    @validator('service')
    def validate_service(cls, v):
        allowed_services = ['google_docs', 'notion', 'microsoft_365', 'confluence', 'slack', 'github']
        if v not in allowed_services:
            raise ValueError(f'Service must be one of: {allowed_services}')
        return v

class TextInputConfig(BaseSchema):
    \"\"\"Configuration for direct text input\"\"\"
    text: str = Field(description=\"Raw text content\")
    name: Optional[str] = Field(default=\"Text Input\", description=\"Display name for the content\")
    options: Optional[Dict[str, Any]] = Field(default_factory=dict, description=\"Text processing options\")

    @validator('text')
    def validate_text(cls, v):
        if not v or not v.strip():
            raise ValueError('Text content cannot be empty')
        return v

class CombinedSourceConfig(BaseSchema):
    \"\"\"Configuration for combining multiple sources\"\"\"
    sources: List[Dict[str, Any]] = Field(description=\"List of source configurations to combine\")
    combination_method: str = Field(default=\"concatenate\", description=\"How to combine sources\")
    options: Optional[Dict[str, Any]] = Field(default_factory=dict, description=\"Combination options\")

    @validator('sources')
    def validate_sources(cls, v):
        if not v:
            raise ValueError('At least one source must be specified for combination')
        return v

    @validator('combination_method')
    def validate_combination_method(cls, v):
        allowed_methods = ['concatenate', 'section_based', 'topic_based']
        if v not in allowed_methods:
            raise ValueError(f'Combination method must be one of: {allowed_methods}')
        return v

# Union type for all source configurations
SourceConfig = Union[
    WebScrapingConfig,
    FileUploadConfig,
    CloudIntegrationConfig,
    TextInputConfig,
    CombinedSourceConfig
]

# Processing configuration schemas
class ChunkingConfig(BaseSchema):
    \"\"\"Configuration for document chunking\"\"\"
    strategy: ChunkingStrategy = Field(default=ChunkingStrategy.ADAPTIVE, description=\"Chunking strategy to use\")
    chunk_size: int = Field(default=1000, ge=100, le=10000, description=\"Target chunk size in characters\")
    chunk_overlap: int = Field(default=200, ge=0, le=2000, description=\"Overlap between chunks in characters\")

    # Strategy-specific configurations
    semantic_config: Optional[Dict[str, Any]] = Field(default_factory=dict, description=\"Semantic chunking settings\")
    heading_config: Optional[Dict[str, Any]] = Field(default_factory=dict, description=\"Heading-based chunking settings\")
    adaptive_config: Optional[Dict[str, Any]] = Field(default_factory=dict, description=\"Adaptive chunking settings\")
    hybrid_config: Optional[Dict[str, Any]] = Field(default_factory=dict, description=\"Hybrid strategy settings\")

    @validator('chunk_overlap')
    def validate_overlap(cls, v, values):
        chunk_size = values.get('chunk_size', 1000)
        if v >= chunk_size:
            raise ValueError('Chunk overlap must be less than chunk size')
        return v

class ParsingConfig(BaseSchema):
    \"\"\"Configuration for document parsing\"\"\"
    preserve_hierarchy: bool = Field(default=True, description=\"Maintain document structure\")
    extract_tables: bool = Field(default=True, description=\"Extract table structures\")
    detect_sections: bool = Field(default=True, description=\"Detect document sections\")
    merge_short_paragraphs: bool = Field(default=False, description=\"Merge paragraphs below minimum length\")
    min_element_length: int = Field(default=50, ge=10, description=\"Minimum element length for merging\")

class AnnotationConfig(BaseSchema):
    \"\"\"Configuration for document annotation\"\"\"
    enabled_types: List[str] = Field(default=[\"keyword\", \"entity\", \"topic\", \"summary\"], description=\"Annotation types to apply\")

    # Type-specific configurations
    entity_config: Optional[Dict[str, Any]] = Field(default_factory=dict, description=\"Entity extraction settings\")
    keyword_config: Optional[Dict[str, Any]] = Field(default_factory=dict, description=\"Keyword extraction settings\")
    topic_config: Optional[Dict[str, Any]] = Field(default_factory=dict, description=\"Topic extraction settings\")
    summary_config: Optional[Dict[str, Any]] = Field(default_factory=dict, description=\"Summary generation settings\")
    sentiment_config: Optional[Dict[str, Any]] = Field(default_factory=dict, description=\"Sentiment analysis settings\")

    @validator('enabled_types')
    def validate_annotation_types(cls, v):
        allowed_types = ['entity', 'keyword', 'topic', 'category', 'sentiment', 'summary', 'relationship', 'language']
        for annotation_type in v:
            if annotation_type not in allowed_types:
                raise ValueError(f'Annotation type {annotation_type} not supported. Allowed: {allowed_types}')
        return v

# Pipeline configuration schemas
class PipelineStepConfig(BaseSchema):
    \"\"\"Configuration for individual pipeline step\"\"\"
    name: str = Field(description=\"Step name for identification\")
    type: str = Field(description=\"Step type: source, parsing, chunking, annotation, indexing\")
    config: Dict[str, Any] = Field(description=\"Step-specific configuration\")
    enabled: bool = Field(default=True, description=\"Whether step is enabled\")
    depends_on: Optional[List[str]] = Field(default_factory=list, description=\"Dependencies on other steps\")

class PipelineConfiguration(BaseSchema):
    \"\"\"Complete pipeline configuration\"\"\"
    name: str = Field(description=\"Pipeline name\")
    description: Optional[str] = Field(None, description=\"Pipeline description\")

    # Source configuration
    source_type: SourceType = Field(description=\"Type of data source\")
    source_config: Dict[str, Any] = Field(description=\"Source-specific configuration\")

    # Processing configurations
    parsing_config: Optional[ParsingConfig] = Field(default_factory=ParsingConfig, description=\"Document parsing settings\")
    chunking_config: Optional[ChunkingConfig] = Field(default_factory=ChunkingConfig, description=\"Chunking settings\")
    annotation_config: Optional[AnnotationConfig] = Field(default_factory=AnnotationConfig, description=\"Annotation settings\")

    # Pipeline steps
    steps: List[PipelineStepConfig] = Field(description=\"Ordered list of pipeline steps\")

    # Execution settings
    parallel_processing: bool = Field(default=True, description=\"Enable parallel processing where possible\")
    error_handling: str = Field(default=\"continue\", description=\"Error handling strategy: stop, continue, retry\")
    retry_config: Optional[Dict[str, Any]] = Field(default_factory=dict, description=\"Retry configuration\")

    @validator('error_handling')
    def validate_error_handling(cls, v):
        allowed_strategies = ['stop', 'continue', 'retry']
        if v not in allowed_strategies:
            raise ValueError(f'Error handling must be one of: {allowed_strategies}')
        return v

# Pipeline execution tracking schemas
class PipelineStepResult(BaseSchema):
    \"\"\"Result of individual pipeline step execution\"\"\"
    step_id: str = Field(description=\"Step identifier\")
    name: str = Field(description=\"Step name\")
    status: StepStatus = Field(description=\"Step execution status\")
    started_at: Optional[datetime] = Field(None, description=\"Step start time\")
    completed_at: Optional[datetime] = Field(None, description=\"Step completion time\")
    duration_seconds: Optional[float] = Field(None, description=\"Step execution duration\")
    error_message: Optional[str] = Field(None, description=\"Error message if failed\")
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict, description=\"Step-specific metadata\")
    metrics: Optional[Dict[str, Any]] = Field(default_factory=dict, description=\"Step performance metrics\")

class PipelineExecutionResult(BaseSchema):
    \"\"\"Complete pipeline execution result\"\"\"
    execution_id: str = Field(description=\"Unique execution identifier\")
    knowledge_base_id: str = Field(description=\"Target knowledge base ID\")
    workspace_id: str = Field(description=\"Workspace ID\")
    organization_id: str = Field(description=\"Organization ID\")

    # Execution tracking
    status: PipelineStatus = Field(description=\"Overall pipeline status\")
    created_at: datetime = Field(description=\"Execution creation time\")
    started_at: Optional[datetime] = Field(None, description=\"Execution start time\")
    completed_at: Optional[datetime] = Field(None, description=\"Execution completion time\")
    total_duration_seconds: Optional[float] = Field(None, description=\"Total execution duration\")

    # Step results
    steps: List[PipelineStepResult] = Field(description=\"Individual step results\")

    # Configuration and summary
    configuration: Dict[str, Any] = Field(description=\"Pipeline configuration used\")
    error_summary: Optional[str] = Field(None, description=\"Summary of any errors\")
    performance_metrics: Optional[Dict[str, Any]] = Field(default_factory=dict, description=\"Overall performance metrics\")

# Request/Response schemas for API endpoints
class CreatePipelineRequest(BaseSchema):
    \"\"\"Request to create and execute a pipeline\"\"\"
    knowledge_base_id: str = Field(description=\"Target knowledge base ID\")
    configuration: PipelineConfiguration = Field(description=\"Pipeline configuration\")
    draft_mode: bool = Field(default=True, description=\"Execute in draft mode (Redis only)\")

class PipelineStatusResponse(BaseSchema):
    \"\"\"Response for pipeline status queries\"\"\"
    execution: PipelineExecutionResult = Field(description=\"Pipeline execution details\")
    real_time_logs: Optional[List[Dict[str, Any]]] = Field(default_factory=list, description=\"Recent log entries\")

class PipelineListResponse(BaseSchema):
    \"\"\"Response for listing pipeline executions\"\"\"
    executions: List[PipelineExecutionResult] = Field(description=\"List of pipeline executions\")
    total_count: int = Field(description=\"Total number of executions\")
    has_more: bool = Field(description=\"Whether more executions are available\")

class PipelineMetricsResponse(BaseSchema):
    \"\"\"Response for pipeline performance metrics\"\"\"
    execution_id: str = Field(description=\"Execution ID\")
    overall_metrics: Dict[str, Any] = Field(description=\"Overall execution metrics\")
    step_metrics: List[Dict[str, Any]] = Field(description=\"Per-step metrics\")
    performance_summary: Dict[str, Any] = Field(description=\"Performance summary\")

class PipelineCancelRequest(BaseSchema):
    \"\"\"Request to cancel pipeline execution\"\"\"
    execution_id: str = Field(description=\"Execution ID to cancel\")
    reason: Optional[str] = Field(None, description=\"Cancellation reason\")

# Configuration management schemas
class ConfigurationTemplate(BaseSchema):
    \"\"\"Pre-defined configuration template\"\"\"
    template_id: str = Field(description=\"Template identifier\")
    name: str = Field(description=\"Template name\")
    description: Optional[str] = Field(None, description=\"Template description\")
    document_types: List[str] = Field(description=\"Applicable document types\")
    configuration: PipelineConfiguration = Field(description=\"Template configuration\")
    is_default: bool = Field(default=False, description=\"Whether this is a default template\")

class ConfigurationOverride(BaseSchema):
    \"\"\"Configuration override for specific scope\"\"\"
    scope: str = Field(description=\"Override scope: organization, workspace, knowledge_base\")
    scope_id: str = Field(description=\"ID of the scope entity\")
    overrides: Dict[str, Any] = Field(description=\"Configuration overrides to apply\")
    is_active: bool = Field(default=True, description=\"Whether override is active\")

# Monitoring and alerting schemas
class PipelineAlert(BaseSchema):
    \"\"\"Pipeline execution alert\"\"\"
    alert_id: str = Field(description=\"Alert identifier\")
    execution_id: str = Field(description=\"Related execution ID\")
    alert_type: str = Field(description=\"Alert type: error, warning, performance\")
    message: str = Field(description=\"Alert message\")
    created_at: datetime = Field(description=\"Alert creation time\")
    acknowledged: bool = Field(default=False, description=\"Whether alert has been acknowledged\")
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict, description=\"Alert metadata\")

class PipelineHealthResponse(BaseSchema):
    \"\"\"Response for pipeline health check\"\"\"
    workspace_id: str = Field(description=\"Workspace ID\")
    total_executions: int = Field(description=\"Total executions in time period\")
    successful_executions: int = Field(description=\"Successful executions\")
    failed_executions: int = Field(description=\"Failed executions\")
    average_duration_seconds: float = Field(description=\"Average execution duration\")
    active_executions: int = Field(description=\"Currently running executions\")
    recent_alerts: List[PipelineAlert] = Field(description=\"Recent alerts\")
    performance_trends: Dict[str, Any] = Field(description=\"Performance trend data\")

# Document and chunk schemas for pipeline outputs
class ProcessedDocument(BaseSchema):
    \"\"\"Document processed through pipeline\"\"\"
    document_id: str = Field(description=\"Document identifier\")
    source_name: str = Field(description=\"Original source name\")
    content: str = Field(description=\"Processed document content\")
    metadata: Dict[str, Any] = Field(description=\"Document metadata\")
    annotations: Optional[Dict[str, Any]] = Field(default_factory=dict, description=\"Document annotations\")
    processing_stats: Dict[str, Any] = Field(description=\"Processing statistics\")

class ProcessedChunk(BaseSchema):
    \"\"\"Document chunk processed through pipeline\"\"\"
    chunk_id: str = Field(description=\"Chunk identifier\")
    document_id: str = Field(description=\"Parent document ID\")
    content: str = Field(description=\"Chunk content\")
    metadata: Dict[str, Any] = Field(description=\"Chunk metadata\")
    annotations: Optional[Dict[str, Any]] = Field(default_factory=dict, description=\"Chunk annotations\")
    position: int = Field(description=\"Chunk position in document\")

class PipelineOutput(BaseSchema):
    \"\"\"Complete pipeline processing output\"\"\"
    execution_id: str = Field(description=\"Pipeline execution ID\")
    documents: List[ProcessedDocument] = Field(description=\"Processed documents\")
    chunks: List[ProcessedChunk] = Field(description=\"Generated chunks\")
    summary_stats: Dict[str, Any] = Field(description=\"Processing summary statistics\")
    quality_metrics: Dict[str, Any] = Field(description=\"Output quality metrics\")

# Error handling schemas
class PipelineError(BaseSchema):
    \"\"\"Structured pipeline error information\"\"\"
    error_id: str = Field(description=\"Error identifier\")
    execution_id: str = Field(description=\"Related execution ID\")
    step_name: Optional[str] = Field(None, description=\"Step where error occurred\")
    error_type: str = Field(description=\"Error classification\")
    error_message: str = Field(description=\"Detailed error message\")
    error_context: Dict[str, Any] = Field(description=\"Error context and debugging info\")
    occurred_at: datetime = Field(description=\"When error occurred\")
    is_recoverable: bool = Field(description=\"Whether error is recoverable\")
    suggested_action: Optional[str] = Field(None, description=\"Suggested remediation action\")

class PipelineErrorResponse(BaseSchema):
    \"\"\"Response containing pipeline error details\"\"\"
    errors: List[PipelineError] = Field(description=\"List of errors\")
    execution_summary: PipelineExecutionResult = Field(description=\"Execution context\")
    recovery_options: List[str] = Field(description=\"Available recovery options\")
"""