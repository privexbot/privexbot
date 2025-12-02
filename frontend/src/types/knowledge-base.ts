/**
 * Knowledge Base Type Definitions
 *
 * WHY: Type-safe KB management with complete pipeline support
 * HOW: Comprehensive TypeScript interfaces matching backend API
 */

// ========================================
// ENUMS & CONSTANTS
// ========================================

/**
 * KB Status - Lifecycle states
 */
export const KBStatus = {
  DRAFT: "draft",
  PROCESSING: "processing",
  READY: "ready",
  FAILED: "failed",
  REINDEXING: "reindexing",
} as const;

export type KBStatus = (typeof KBStatus)[keyof typeof KBStatus];

/**
 * KB Context - Where KB can be used
 */
export const KBContext = {
  CHATBOT: "chatbot",
  CHATFLOW: "chatflow",
  BOTH: "both",
} as const;

export type KBContext = (typeof KBContext)[keyof typeof KBContext];

/**
 * Source Types - Different ways to add content
 */
export const SourceType = {
  WEB: "web",
  FILE: "file",
  TEXT: "text",
  COMBINE: "combine",
  GOOGLE_DOCS: "google_docs",
  GOOGLE_SHEETS: "google_sheets",
  NOTION: "notion",
} as const;

export type SourceType = (typeof SourceType)[keyof typeof SourceType];

/**
 * Crawl Methods for web sources (matches Crawl4AI backend exactly)
 */
export const CrawlMethod = {
  SCRAPE: "single", // Single page scraping (maps to scrape_single_url)
  CRAWL: "crawl", // Crawl linked pages (maps to crawl_website)
} as const;

export type CrawlMethod = (typeof CrawlMethod)[keyof typeof CrawlMethod];

/**
 * Chunking Strategies
 */
export const ChunkingStrategy = {
  RECURSIVE: "recursive",
  BY_HEADING: "by_heading",
  SEMANTIC: "semantic",
  BY_SECTION: "by_section",
  ADAPTIVE: "adaptive",
  SENTENCE_BASED: "sentence_based",
  PARAGRAPH_BASED: "paragraph_based",
  HYBRID: "hybrid",
  FULL_CONTENT: "full_content", // No chunking - index full content as single document
} as const;

export type ChunkingStrategy =
  (typeof ChunkingStrategy)[keyof typeof ChunkingStrategy];

/**
 * Vector Store Providers
 */
export const VectorStoreProvider = {
  QDRANT: "qdrant",
  FAISS: "faiss",
  WEAVIATE: "weaviate",
  PINECONE: "pinecone",
  CHROMA: "chroma",
} as const;

export type VectorStoreProvider =
  (typeof VectorStoreProvider)[keyof typeof VectorStoreProvider];

/**
 * Distance Metrics
 */
export const DistanceMetric = {
  COSINE: "cosine",
  EUCLIDEAN: "euclidean",
  DOT_PRODUCT: "dot",
  MANHATTAN: "manhattan",
} as const;

export type DistanceMetric =
  (typeof DistanceMetric)[keyof typeof DistanceMetric];

/**
 * Index Types
 */
export const IndexType = {
  HNSW: "hnsw",
  FLAT: "flat",
  IVF: "ivf",
} as const;

export type IndexType = (typeof IndexType)[keyof typeof IndexType];

// ========================================
// MODEL & VECTOR STORE CONFIGURATION
// ========================================

/**
 * HNSW Index Configuration
 */
export interface HNSWConfig {
  m: number; // Number of connections per node (16 default)
  ef_construct: number; // Construction accuracy (100 default)
  ef_search?: number; // Search accuracy (auto-calculated)
}

/**
 * Qdrant-specific configuration
 */
export interface QdrantConfig {
  collection_naming: string; // Pattern: kb_{kb_id}
  distance_metric: DistanceMetric;
  index_type: IndexType;
  vector_size: number; // Embedding dimension (384 default)
  hnsw_config: HNSWConfig;
  batch_size: number; // Upsert batch size (100 default)
  indexing_threshold: number; // Start indexing after N vectors (10000 default)
}

/**
 * FAISS-specific configuration (for future use)
 */
export interface FaissConfig {
  index_factory: string; // "IVF100,PQ8" etc.
  metric_type: DistanceMetric;
  nlist?: number; // Number of clusters for IVF
}

/**
 * Generic Vector Store Configuration
 */
export interface VectorStoreConfig {
  provider: VectorStoreProvider;
  settings: QdrantConfig | FaissConfig | Record<string, any>;
}

/**
 * Model Configuration (Embedding + Vector Store)
 */
export interface ModelConfig {
  embedding: {
    provider: "openai" | "local" | "huggingface";
    model: string; // e.g., 'text-embedding-ada-002', 'all-MiniLM-L6-v2'
    dimensions: number; // Embedding vector dimensions
    batch_size: number; // Embedding batch size
  };
  vector_store: VectorStoreConfig;
  performance: {
    indexing_strategy: "immediate" | "batch" | "background";
    search_timeout: number; // Search timeout in milliseconds
    max_results: number; // Maximum search results to return
  };
}

/**
 * Pipeline Status
 */
export const PipelineStatus = {
  QUEUED: "queued",
  RUNNING: "running",
  COMPLETED: "completed",
  FAILED: "failed",
  CANCELLED: "cancelled",
} as const;

export type PipelineStatus =
  (typeof PipelineStatus)[keyof typeof PipelineStatus];

/**
 * Pipeline Stages
 */
export const PipelineStage = {
  SCRAPING: "scraping",
  PARSING: "parsing",
  CHUNKING: "chunking",
  EMBEDDING: "embedding",
  INDEXING: "indexing",
} as const;

export type PipelineStage = (typeof PipelineStage)[keyof typeof PipelineStage];

// ========================================
// PHASE 1: DRAFT TYPES
// ========================================

/**
 * Create Draft Request
 */
export interface CreateDraftRequest {
  name: string;
  description?: string;
  workspace_id: string;
  context?: KBContext;
}

/**
 * KB Draft (Redis storage)
 */
export interface KBDraft {
  draft_id: string;
  name: string;
  description?: string;
  workspace_id: string;
  context: KBContext;
  sources: DraftSource[];
  chunking_config: ChunkingConfig;
  embedding_config: EmbeddingConfig;
  vector_store_config: VectorStoreConfig;
  created_at: string;
  created_by: string;
  ttl_expires_at: string;
}

/**
 * Draft Source
 */
export interface DraftSource {
  source_id: string;
  type: SourceType;
  url?: string;
  config?: WebSourceConfig;
  status: "pending" | "processing" | "completed" | "failed";
  created_at: string;
  metadata?: Record<string, unknown>;
}

/**
 * Add Web Source Request
 */
export interface AddWebSourceRequest {
  url?: string;
  urls?: string[]; // Bulk upload up to 50 URLs
  config?: WebSourceConfig;
  per_url_configs?: Record<string, WebSourceConfig>; // Per-URL configuration overrides
}

/**
 * Source Data Types for UI Forms
 */
export interface WebSourceFormData {
  url?: string;
  urls?: string[];
  bulk?: boolean;
  config?: Partial<WebSourceConfig>;
}

export interface FileSourceFormData {
  file: File;
  config?: Record<string, unknown>;
}

export interface TextSourceFormData {
  content: string;
  title: string;
}

export type SourceFormData =
  | WebSourceFormData
  | FileSourceFormData
  | TextSourceFormData;

/**
 * Update Chunking Configuration Request
 */
export interface UpdateChunkingRequest {
  chunking_config: Partial<ChunkingConfig>;
}

/**
 * Update Embedding Configuration Request
 */
export interface UpdateEmbeddingRequest {
  embedding_config: Partial<EmbeddingConfig>;
}

/**
 * Update Vector Store Configuration Request
 */
export interface UpdateVectorStoreRequest {
  vector_store_config: Partial<VectorStoreConfig>;
}

/**
 * Draft Validation Response
 */
export interface DraftValidationResponse {
  is_valid: boolean;
  errors: string[];
  warnings: string[];
  estimated_duration_minutes: number;
  estimated_cost_usd?: number;
  resource_requirements: {
    storage_mb: number;
    processing_time_minutes: number;
    api_calls_estimated: number;
  };
}

// ========================================
// PHASE 2: PREVIEW & FINALIZATION TYPES
// ========================================

/**
 * Preview Request (for quick preview without draft)
 * Matches backend ChunkingPreviewRequest
 */
export interface PreviewRequest {
  url: string;
  strategy?: string;
  chunk_size?: number;
  chunk_overlap?: number;
  max_preview_chunks?: number;
}

/**
 * Quick Preview Response
 */
export interface QuickPreviewResponse {
  url: string;
  title?: string;
  pages_found?: number;
  chunks?: PreviewChunk[]; // Legacy field, may be deprecated
  preview_chunks: PreviewChunk[]; // Current field used by backend
  strategy?: string; // Backend returns strategy as string
  strategy_used?: ChunkingStrategy;
  total_chunks_estimated?: number;
  recommendation?: string;
  strategy_recommendation?: string;
  content_enhancement?: any;
  document_stats?: any;
  intelligent_analysis?: any;
  metadata?: any;
  optimized_for?: string;
}

/**
 * Multi-page Preview Response
 */
export interface PreviewResponse {
  draft_id: string;
  pages_previewed: number;
  total_chunks: number;
  strategy: ChunkingStrategy;
  strategy_recommendation?: string;
  optimized_for?: string;
  pages: PagePreview[];
  estimated_total_chunks: number;
  note?: string;
}

/**
 * Page Preview
 */
export interface PagePreview {
  url: string;
  title: string;
  content: string; // Full scraped content
  content_length?: number;
  chunks: number; // Number of chunks (not array)
  chunks_created?: number;
  processing_time_ms?: number;
  preview_chunks: PreviewChunk[]; // Actual chunk objects array

  // Content editing fields
  edited_content?: string; // Edited version of content
  is_edited?: boolean; // Whether content has been edited
  word_count?: number; // Word count for display
  char_count?: number; // Character count for display
}

/**
 * Preview Chunk
 */
export interface PreviewChunk {
  index: number; // Backend provides index
  content: string;
  full_length: number; // Backend uses full_length instead of char_count
  token_count: number; // Backend uses token_count instead of word_count
  word_count?: number; // Keep for backwards compatibility
  char_count?: number; // Keep for backwards compatibility
  overlap_with_previous?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Finalize Request (optional configuration override)
 */
export interface FinalizeRequest {
  chunking_config?: Partial<ChunkingConfig>;
  embedding_config?: Partial<EmbeddingConfig>;
  vector_store_config?: Partial<VectorStoreConfig>;
  priority?: "low" | "normal" | "high";
}

/**
 * Finalize Response
 */
export interface FinalizeResponse {
  kb_id: string;
  pipeline_id: string;
  status: KBStatus;
  message: string;
  tracking_url: string;
  estimated_completion_minutes: number;
}

// ========================================
// PHASE 3: PIPELINE MONITORING TYPES
// ========================================

/**
 * Pipeline Progress
 */
export interface PipelineProgress {
  current_page?: number;
  total_pages?: number;
  current_document?: number;
  total_documents?: number;
  percent: number;
  current_step: PipelineStage;
}

/**
 * Pipeline Status Response
 */
export interface PipelineStatusResponse {
  pipeline_id: string;
  kb_id: string;
  status: PipelineStatus;
  progress: PipelineProgress;
  message: string;
  started_at: string;
  completed_at?: string;
  error?: string;
  stats?: {
    pages_discovered: number;
    pages_scraped: number;
    pages_failed: number;
    chunks_created: number;
    embeddings_generated: number;
    vectors_indexed: number;
  };
}

/**
 * Pipeline Log Entry
 */
export interface PipelineLogEntry {
  timestamp: string;
  level: "info" | "warning" | "error";
  stage: PipelineStage;
  message: string;
  details?: Record<string, unknown>;
}

// ========================================
// CONFIGURATION TYPES
// ========================================

/**
 * Web Source Configuration
 */
export interface WebSourceConfig {
  method: CrawlMethod;
  max_pages?: number; // Default: 50
  max_depth?: number; // Default: 3
  include_patterns?: string[]; // e.g., ['/docs/**', '/api/**']
  exclude_patterns?: string[]; // e.g., ['/admin/**', '/auth/**']
  include_subdomains?: boolean;
  wait_time?: number; // Seconds to wait for JS rendering
  headers?: Record<string, string>; // Custom headers
}

/**
 * Chunking Configuration
 */
export interface ChunkingConfig {
  strategy: ChunkingStrategy;
  chunk_size: number; // Characters per chunk (100-5000)
  chunk_overlap: number; // Overlap between chunks (0-1000)
  preserve_formatting?: boolean;
  split_by_heading_level?: number; // For by_heading strategy
  semantic_threshold?: number; // For semantic strategy (0-1)

  // Additional configuration options
  min_chunk_size?: number; // Minimum chunk size (50-500)
  max_chunk_size?: number; // Maximum chunk size (500-10000)
  preserve_headings?: boolean;
  remove_duplicates?: boolean;
  smart_splitting?: boolean;
}

/**
 * Embedding Configuration
 */
export interface EmbeddingConfig {
  model: string; // e.g., 'all-MiniLM-L6-v2'
  device: "cpu" | "gpu";
  batch_size?: number;
  normalize?: boolean;
}

// ========================================
// SOURCE TYPES
// ========================================

/**
 * Base Source Interface
 */
export interface KBSource {
  id: string;
  type: SourceType;
  created_at: string;
  metadata?: Record<string, unknown>;
}

/**
 * Web URL Source
 */
export interface WebSource extends KBSource {
  type: typeof SourceType.WEB;
  url: string;
  config: WebSourceConfig;
}

/**
 * File Upload Source
 */
export interface FileSource extends KBSource {
  type: typeof SourceType.FILE;
  file_name: string;
  file_size: number;
  file_type: string;
  upload_url?: string;
}

/**
 * Direct Text Source
 */
export interface TextSource extends KBSource {
  type: typeof SourceType.TEXT;
  content: string;
  title?: string;
}

/**
 * Union type for all sources
 */
export type AnySource = WebSource | FileSource | TextSource;

// ========================================
// API REQUEST/RESPONSE TYPES
// ========================================

/**
 * KB List Filters
 */
export interface KBListFilters {
  workspace_id?: string;
  context?: KBContext;
  status?: KBStatus;
  page?: number;
  limit?: number;
}

/**
 * KB Query Request
 */
export interface QueryRequest {
  query: string;
  top_k?: number;
  threshold?: number;
  include_metadata?: boolean;
}

/**
 * KB Query Response
 */
export interface QueryResponse {
  results: QueryResult[];
  query: string;
  total_results: number;
  processing_time_ms: number;
}

/**
 * Query Result
 */
export interface QueryResult {
  chunk_id: string;
  content: string;
  score: number;
  metadata: Record<string, unknown>;
  document_title?: string;
  document_url?: string;
  kb_id: string;
}

/**
 * KB Error Response
 */
export interface KBErrorResponse {
  error: string;
  error_code: string;
  message: string;
  details?: Record<string, unknown>;
  suggestions?: string[];
}

/**
 * KB Summary (for list views)
 */
export interface KBSummary {
  id: string;
  name: string;
  description?: string;
  workspace_id: string;
  context: KBContext;
  status: KBStatus;
  created_at: string;
  updated_at?: string;
  stats?: {
    documents: number;
    chunks: number;
    total_size_bytes: number;
  };
}

/**
 * Full Knowledge Base (for detail views)
 */
export interface KnowledgeBase extends KBSummary {
  sources: AnySource[];
  chunking_config: ChunkingConfig;
  embedding_config: EmbeddingConfig;
  vector_store_config: VectorStoreConfig;
  created_by: string;
  last_processed_at?: string;
  processing_logs?: PipelineLogEntry[];
}

/**
 * KB Document (individual document within a KB)
 */
export interface KBDocument {
  id: string;
  kb_id: string;
  name: string;
  url?: string;
  source_type: string;
  source_metadata?: Record<string, unknown>;
  content?: string;
  content_preview?: string;
  status: string;
  processing_metadata?: Record<string, unknown>;
  word_count: number;
  character_count: number;
  chunk_count: number;
  custom_metadata?: Record<string, unknown>;
  annotations?: Record<string, unknown>;
  is_enabled: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  created_by: string;

  // Legacy fields for backward compatibility (will be deprecated)
  title?: string;
  content_type?: string;
  size_bytes?: number;
  processed_at?: string;
  metadata?: Record<string, unknown>;
}

/**
 * KB Statistics
 */
export interface KBStats {
  documents: number;
  chunks: number;
  total_size_bytes: number;
  avg_chunk_size: number;
  last_updated: string;
}

/**
 * Draft Validation (alias for DraftValidationResponse)
 */
export type DraftValidation = DraftValidationResponse;

/**
 * Reindex Response
 */
export interface ReindexResponse {
  kb_id: string;
  pipeline_id: string;
  status: KBStatus;
  message: string;
  estimated_completion_minutes: number;
}

// ========================================
// UTILITY TYPES
// ========================================

/**
 * Paginated Response
 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  has_next: boolean;
  has_previous: boolean;
}

/**
 * Sort Options
 */
export interface SortOptions {
  field: "name" | "created_at" | "updated_at" | "status";
  direction: "asc" | "desc";
}

/**
 * Workspace (simplified for KB context)
 */
export interface Workspace {
  id: string;
  name: string;
  organization_id: string;
}

// ========================================
// NEW ARCHITECTURAL PHASE TYPES
// ========================================

/**
 * KB Creation Steps - Multi-phase creation workflow
 */
export const KBCreationStep = {
  BASIC_INFO: 1, // Phase 1A: Basic information & URL addition
  CONTENT_REVIEW: 2, // Phase 1B: Content review & editing
  CONTENT_APPROVAL: 3, // Phase 1C: Content approval & source addition
  CHUNKING_CONFIG: 4, // Phase 1D: Chunking configuration with live preview
  MODEL_CONFIG: 5, // Phase 1E: Model & vector store configuration
  FINALIZATION: 6, // Phase 2: Final review & creation
} as const;

export type KBCreationStep =
  (typeof KBCreationStep)[keyof typeof KBCreationStep];

/**
 * Phase 1C: Content Approval Request
 */
export interface ApproveContentRequest {
  page_indices: number[];
  source_name?: string;
  metadata?: Record<string, any>;
}

export interface ApproveContentResponse {
  success: boolean;
  message: string;
  source_id: string;
  source_name: string;
  summary: {
    total_pages_approved: number;
    edited_pages: number;
    unedited_pages: number;
    total_content_size: number;
    average_page_size: number;
  };
}

/**
 * Phase 1D: Chunking Configuration with Live Preview
 */
export interface ChunkingPreviewRequest {
  strategy?: string;
  chunk_size?: number;
  chunk_overlap?: number;
  preserve_code_blocks?: boolean;
  source_id?: string;
  max_chunks_preview?: number;
}

export interface ChunkingPreviewResponse {
  success: boolean;
  message: string;
  config: {
    strategy: string;
    chunk_size: number;
    chunk_overlap: number;
    preserve_code_blocks: boolean;
  };
  preview_chunks: Array<{
    chunk_index: number;
    content: string;
    size: number;
    word_count: number;
    source_metadata: {
      source_id: string;
      source_name: string;
      page_title: string;
      page_url: string;
      page_index: number;
      is_edited: boolean;
      word_count: number;
      char_count: number;
    };
    chunk_position_in_page: number;
    total_chunks_in_page: number;
  }>;
  statistics: {
    total_sources: number;
    total_pages: number;
    total_content_size: number;
    total_chunks: number;
    preview_chunks_shown: number;
    average_chunk_size: number;
    size_distribution: {
      small: number;
      medium: number;
      large: number;
    };
    chunks_per_page: number;
  };
  source_breakdown: Array<{
    source_id: string;
    source_name: string;
    pages: number;
    total_content_size: number;
  }>;
}

/**
 * Phase 1E: Model & Vector Store Configuration
 */
export interface ModelConfigRequest {
  embedding_config?: {
    model?: string;
    device?: string;
    batch_size?: number;
    normalize_embeddings?: boolean;
  };
  vector_store_config?: {
    provider?: string;
    collection_name_prefix?: string;
    distance_metric?: string;
    enable_hybrid_search?: boolean;
  };
  retrieval_config?: {
    strategy?: string;
    top_k?: number;
    score_threshold?: number;
    rerank_enabled?: boolean;
  };
  metadata_config?: {
    store_full_content?: boolean;
    indexed_fields?: string[];
    filterable_fields?: string[];
    include_source_tracking?: boolean;
  };
}

export interface ModelConfigResponse {
  success: boolean;
  message: string;
  configuration: {
    embedding: Record<string, any>;
    vector_store: Record<string, any>;
    retrieval: Record<string, any>;
    metadata: Record<string, any>;
  };
  estimates: {
    total_approved_pages: number;
    total_content_size: number;
    estimated_chunks: number;
    embedding_dimensions: number;
    estimated_vector_storage_mb: number;
    estimated_processing_time_minutes: number;
  };
  compatibility: {
    embedding_model_available: boolean;
    vector_store_available: boolean;
    gpu_acceleration: boolean;
  };
}

/**
 * Approved Source (Phase 1C output)
 */
export interface ApprovedSource {
  id: string;
  type: "approved_content";
  name: string;
  status: "approved";
  approved_pages: Array<{
    index: number;
    url: string;
    title: string;
    content: string;
    original_content: string;
    is_edited: boolean;
    word_count: number;
    char_count: number;
    approved_at: string;
    approved_by: string;
  }>;
  metadata: {
    total_pages: number;
    total_content_size: number;
    edited_pages: number;
    original_url: string;
    approval_source: string;
  };
  added_at: string;
  added_by: string;
}

/**
 * Stepper Navigation State
 */
export interface StepperState {
  currentStep: KBCreationStep;
  completedSteps: Set<KBCreationStep>;
  approvedSources: ApprovedSource[];
  chunkingConfig: ChunkingPreviewRequest | null;
  modelConfig: ModelConfigRequest | null;
}

// ========================================
// TYPE GUARDS
// ========================================

/**
 * Type guard for Web Source
 */
export function isWebSource(source: AnySource): source is WebSource {
  return source.type === SourceType.WEB;
}

/**
 * Type guard for File Source
 */
export function isFileSource(source: AnySource): source is FileSource {
  return source.type === SourceType.FILE;
}

/**
 * Type guard for Text Source
 */
export function isTextSource(source: AnySource): source is TextSource {
  return source.type === SourceType.TEXT;
}

/**
 * Type guard for KB Error Response
 */
export function isKBError(response: unknown): response is KBErrorResponse {
  return (
    response !== null &&
    typeof response === "object" &&
    "error_code" in response
  );
}
