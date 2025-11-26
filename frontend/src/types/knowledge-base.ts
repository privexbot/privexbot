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
  DRAFT: 'draft',
  PROCESSING: 'processing',
  READY: 'ready',
  FAILED: 'failed',
  REINDEXING: 'reindexing'
} as const;

export type KBStatus = typeof KBStatus[keyof typeof KBStatus]

/**
 * KB Context - Where KB can be used
 */
export const KBContext = {
  CHATBOT: 'chatbot',
  CHATFLOW: 'chatflow',
  BOTH: 'both'
} as const;

export type KBContext = typeof KBContext[keyof typeof KBContext]

/**
 * Source Types - Different ways to add content
 */
export const SourceType = {
  WEB: 'web',
  FILE: 'file',
  TEXT: 'text',
  COMBINE: 'combine',
  GOOGLE_DOCS: 'google_docs',
  GOOGLE_SHEETS: 'google_sheets',
  NOTION: 'notion'
} as const;

export type SourceType = typeof SourceType[keyof typeof SourceType]

/**
 * Crawl Methods for web sources (matches backend exactly)
 */
export const CrawlMethod = {
  SCRAPE: 'scrape',     // Single page scraping
  CRAWL: 'crawl',       // Crawl linked pages
  MAP: 'map',           // Sitemap-based crawling
  SEARCH: 'search',     // Search and extract
  EXTRACT: 'extract'    // Extract structured data
} as const;

export type CrawlMethod = typeof CrawlMethod[keyof typeof CrawlMethod]

/**
 * Chunking Strategies
 */
export const ChunkingStrategy = {
  RECURSIVE: 'recursive',
  BY_HEADING: 'by_heading',
  SEMANTIC: 'semantic',
  BY_SECTION: 'by_section',
  ADAPTIVE: 'adaptive',
  SENTENCE_BASED: 'sentence_based',
  PARAGRAPH_BASED: 'paragraph_based',
  HYBRID: 'hybrid'
} as const;

export type ChunkingStrategy = typeof ChunkingStrategy[keyof typeof ChunkingStrategy]

/**
 * Pipeline Status
 */
export const PipelineStatus = {
  QUEUED: 'queued',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
} as const;

export type PipelineStatus = typeof PipelineStatus[keyof typeof PipelineStatus]

/**
 * Pipeline Stages
 */
export const PipelineStage = {
  SCRAPING: 'scraping',
  PARSING: 'parsing',
  CHUNKING: 'chunking',
  EMBEDDING: 'embedding',
  INDEXING: 'indexing'
} as const;

export type PipelineStage = typeof PipelineStage[keyof typeof PipelineStage]

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
  status: 'pending' | 'processing' | 'completed' | 'failed';
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

export type SourceFormData = WebSourceFormData | FileSourceFormData | TextSourceFormData;

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
 */
export interface PreviewRequest {
  url: string;
  chunking_config?: Partial<ChunkingConfig>;
  max_pages?: number;
}

/**
 * Quick Preview Response
 */
export interface QuickPreviewResponse {
  url: string;
  pages_found: number;
  chunks: PreviewChunk[];
  strategy_used: ChunkingStrategy;
  recommendation?: string;
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
  content_length: number;
  chunks_created: number;
  processing_time_ms: number;
  chunks: PreviewChunk[];
}

/**
 * Preview Chunk
 */
export interface PreviewChunk {
  content: string;
  word_count: number;
  char_count: number;
  overlap_with_previous: number;
  metadata: Record<string, unknown>;
}

/**
 * Finalize Request (optional configuration override)
 */
export interface FinalizeRequest {
  chunking_config?: Partial<ChunkingConfig>;
  embedding_config?: Partial<EmbeddingConfig>;
  vector_store_config?: Partial<VectorStoreConfig>;
  priority?: 'low' | 'normal' | 'high';
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
  level: 'info' | 'warning' | 'error';
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
  max_pages?: number;        // Default: 50
  max_depth?: number;        // Default: 3
  include_patterns?: string[]; // e.g., ['/docs/**', '/api/**']
  exclude_patterns?: string[]; // e.g., ['/admin/**', '/auth/**']
  include_subdomains?: boolean;
  wait_time?: number;        // Seconds to wait for JS rendering
  headers?: Record<string, string>; // Custom headers
}

/**
 * Chunking Configuration
 */
export interface ChunkingConfig {
  strategy: ChunkingStrategy;
  chunk_size: number;        // Characters per chunk (100-5000)
  chunk_overlap: number;     // Overlap between chunks (0-1000)
  preserve_formatting?: boolean;
  split_by_heading_level?: number; // For by_heading strategy
  semantic_threshold?: number;     // For semantic strategy (0-1)

  // Additional configuration options
  min_chunk_size?: number;   // Minimum chunk size (50-500)
  max_chunk_size?: number;   // Maximum chunk size (500-10000)
  preserve_headings?: boolean;
  remove_duplicates?: boolean;
  smart_splitting?: boolean;
}

/**
 * Embedding Configuration
 */
export interface EmbeddingConfig {
  model: string;            // e.g., 'all-MiniLM-L6-v2'
  device: 'cpu' | 'gpu';
  batch_size?: number;
  normalize?: boolean;
}

/**
 * Vector Store Configuration
 */
export interface VectorStoreConfig {
  provider: 'qdrant' | 'faiss' | 'weaviate' | 'milvus' | 'pinecone';
  collection_name?: string;
  distance_metric?: 'cosine' | 'euclidean' | 'dot_product';
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
  title: string;
  source_url?: string;
  content_type: string;
  size_bytes: number;
  chunk_count: number;
  created_at: string;
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
  field: 'name' | 'created_at' | 'updated_at' | 'status';
  direction: 'asc' | 'desc';
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
  return response !== null && typeof response === 'object' && 'error_code' in response;
}