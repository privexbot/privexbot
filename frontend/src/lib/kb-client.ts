/**
 * Knowledge Base API Client
 *
 * Implements the exact 3-phase architecture from the backend:
 * Phase 1: Draft Mode (Redis) - Configuration & Preview
 * Phase 2: Finalization (DB + Queue) - Commit & Start Processing
 * Phase 3: Pipeline Monitoring (Celery) - Real-time Status
 */

import { apiClient, handleApiError } from './api-client';
import type {
  // Draft Phase Types
  CreateDraftRequest,
  KBDraft,
  AddWebSourceRequest,
  UpdateChunkingRequest,
  UpdateEmbeddingRequest,
  UpdateVectorStoreRequest,
  DraftValidationResponse,

  // Preview Types
  PreviewRequest,
  PreviewResponse,
  QuickPreviewResponse,

  // Finalization Types
  FinalizeRequest,
  FinalizeResponse,

  // Pipeline Types
  PipelineStatusResponse,
  PipelineLogEntry,

  // KB Management Types
  KnowledgeBase,
  KBSummary,
  KBListFilters,
  PaginatedResponse,
  KBDocument,
  KBStats,

  // Search Types
  QueryRequest,
  QueryResponse,

  // Error Types
  KBErrorResponse
} from '@/types/knowledge-base';

// ========================================
// PHASE 1: DRAFT MODE API (Redis Storage)
// ========================================

export const kbDraftApi = {
  /**
   * Create new KB draft (Phase 1 start)
   * POST /api/v1/kb-drafts/
   */
  async create(request: CreateDraftRequest): Promise<KBDraft> {
    try {
      const response = await apiClient.post<KBDraft>('/kb-drafts/', request);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  /**
   * Get draft details
   * GET /api/v1/kb-drafts/{draft_id}
   */
  async get(draftId: string): Promise<KBDraft> {
    try {
      const response = await apiClient.get<KBDraft>(`/kb-drafts/${draftId}`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  /**
   * Delete draft
   * DELETE /api/v1/kb-drafts/{draft_id}
   */
  async delete(draftId: string): Promise<void> {
    try {
      await apiClient.delete(`/kb-drafts/${draftId}`);
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  /**
   * Add web sources (single or bulk up to 50 URLs)
   * POST /api/v1/kb-drafts/{draft_id}/sources/web
   */
  async addWebSources(draftId: string, request: AddWebSourceRequest): Promise<{
    source_id?: string;
    source_ids?: string[];
    sources_added?: number;
    duplicates_skipped?: number;
    invalid_urls?: string[];
    message: string
  }> {
    try {
      const response = await apiClient.post<{
        source_id?: string;
        source_ids?: string[];
        sources_added?: number;
        duplicates_skipped?: number;
        invalid_urls?: string[];
        message: string
      }>(
        `/kb-drafts/${draftId}/sources/web`,
        request
      );
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  /**
   * Calculate adaptive timeout based on file size and type
   *
   * Formula: base (60s) + (file_size_mb * 30s) + OCR_multiplier
   * - PDFs and images get 3x multiplier for potential OCR
   * - Large files (>10MB) get additional time
   * - Max timeout: 10 minutes
   */
  calculateAdaptiveTimeout(file: File): number {
    const fileSizeMB = file.size / (1024 * 1024);
    const baseTimeout = 60000; // 60 seconds base
    const perMBTimeout = 30000; // 30 seconds per MB

    // MIME types that may require OCR (slower processing)
    const ocrTypes = [
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/tiff',
      'image/bmp'
    ];

    // Calculate base timeout
    let timeout = baseTimeout + (fileSizeMB * perMBTimeout);

    // Apply OCR multiplier for PDFs and images
    if (ocrTypes.some(type => file.type.includes(type) || file.name.toLowerCase().endsWith('.pdf'))) {
      timeout *= 3; // OCR can be 3x slower
    }

    // Large file bonus
    if (fileSizeMB > 10) {
      timeout += 60000; // Extra minute for large files
    }
    if (fileSizeMB > 30) {
      timeout += 120000; // Extra 2 minutes for very large files
    }

    // Clamp to max 10 minutes
    const maxTimeout = 600000; // 10 minutes
    const minTimeout = 60000; // 1 minute minimum

    return Math.min(Math.max(timeout, minTimeout), maxTimeout);
  },

  /**
   * Analyze file complexity before upload (for user feedback)
   */
  analyzeFileComplexity(file: File): {
    complexity: 'low' | 'medium' | 'high' | 'very_high';
    estimatedSeconds: number;
    warnings: string[];
    canProcess: boolean;
  } {
    const fileSizeMB = file.size / (1024 * 1024);
    const warnings: string[] = [];
    let complexity: 'low' | 'medium' | 'high' | 'very_high' = 'low';
    let estimatedSeconds = 5;

    // Fast parse types
    const fastTypes = ['text/plain', 'text/csv', 'text/markdown', 'application/json', 'text/html'];
    const ocrTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/tiff'];

    const isFastType = fastTypes.some(t => file.type.includes(t));
    const isOcrType = ocrTypes.some(t => file.type.includes(t) || file.name.toLowerCase().endsWith('.pdf'));

    // Estimate processing time
    if (isFastType) {
      estimatedSeconds = Math.ceil(2 + fileSizeMB * 0.5);
      complexity = 'low';
    } else if (isOcrType) {
      estimatedSeconds = Math.ceil(10 + fileSizeMB * 8); // OCR is slow
      complexity = fileSizeMB > 5 ? 'high' : 'medium';
      warnings.push('PDF/Image files may require OCR, which can take several minutes');
    } else {
      estimatedSeconds = Math.ceil(5 + fileSizeMB * 2);
      complexity = 'medium';
    }

    // Size-based warnings
    if (fileSizeMB > 20) {
      warnings.push(`Large file (${fileSizeMB.toFixed(1)} MB) - processing may take longer`);
      complexity = complexity === 'low' ? 'medium' : complexity === 'medium' ? 'high' : 'very_high';
    }
    if (fileSizeMB > 50) {
      warnings.push('Very large file - consider splitting into smaller documents');
      complexity = 'very_high';
    }

    // Check max size (100MB)
    const canProcess = fileSizeMB <= 100;
    if (!canProcess) {
      warnings.push('File exceeds maximum size of 100MB');
    }

    return {
      complexity,
      estimatedSeconds,
      warnings,
      canProcess
    };
  },

  /**
   * Upload single file to draft
   * POST /api/v1/kb-drafts/{draft_id}/sources/file
   *
   * File is parsed by Apache Tika on the backend (supports 15+ formats)
   * Returns source info including parsed content metadata
   *
   * ROBUSTNESS FEATURES:
   * - Adaptive timeout based on file size and type
   * - Up to 10 minutes for very large/complex files with OCR
   * - Detailed error messages with suggestions
   */
  async addFileSource(
    draftId: string,
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<{
    source_id: string;
    filename: string;
    file_size: number;
    mime_type: string;
    page_count: number;
    char_count: number;
    word_count: number;
    parsing_time_ms: number;
    message: string;
    warnings?: string[];
    preview_pages?: Array<{
      url: string;
      title: string;
      content: string;
      word_count: number;
      char_count: number;
      source_id: string;
      page_index: number;
    }>;
  }> {
    try {
      // Analyze file complexity for logging
      const complexity = this.analyzeFileComplexity(file);
      console.log(`📄 Uploading file: ${file.name}`);
      console.log(`   Size: ${(file.size / 1024 / 1024).toFixed(2)} MB`);
      console.log(`   Complexity: ${complexity.complexity}`);
      console.log(`   Est. time: ${complexity.estimatedSeconds}s`);

      if (complexity.warnings.length > 0) {
        console.log(`   Warnings: ${complexity.warnings.join(', ')}`);
      }

      const formData = new FormData();
      formData.append('file', file);

      // Calculate adaptive timeout based on file characteristics
      const timeout = this.calculateAdaptiveTimeout(file);
      console.log(`   Timeout: ${timeout / 1000}s`);

      const response = await apiClient.post(
        `/kb-drafts/${draftId}/sources/file`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          // Adaptive timeout for robust file processing
          timeout: timeout,
          onUploadProgress: (progressEvent: { loaded: number; total?: number }) => {
            if (onProgress && progressEvent.total) {
              const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              onProgress(progress);
            }
          },
        }
      );

      console.log(`✅ File parsed successfully: ${file.name}`);
      return response.data;
    } catch (error) {
      // Provide detailed error messages
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ECONNABORTED') {
        const fileSizeMB = file.size / (1024 * 1024);
        const isPDF = file.type.includes('pdf') || file.name.toLowerCase().endsWith('.pdf');

        let errorMessage = 'File parsing timed out.';

        if (isPDF && fileSizeMB > 10) {
          errorMessage += '\n\nThis appears to be a large PDF that may contain scanned images requiring OCR.';
          errorMessage += '\n\nSuggestions:';
          errorMessage += '\n• Try splitting the PDF into smaller parts';
          errorMessage += '\n• If the PDF contains scanned images, try using a clearer scan';
          errorMessage += '\n• Convert to a searchable PDF using Adobe Acrobat or similar';
        } else if (fileSizeMB > 30) {
          errorMessage += '\n\nThe file is very large.';
          errorMessage += '\n\nSuggestions:';
          errorMessage += '\n• Split the document into smaller parts (< 20MB each)';
          errorMessage += '\n• Compress the file if possible';
        } else {
          errorMessage += '\n\nThe file may be complex or corrupted.';
          errorMessage += '\n\nSuggestions:';
          errorMessage += '\n• Try opening and re-saving the file';
          errorMessage += '\n• Ensure the file is not password-protected';
        }

        throw new Error(errorMessage);
      }

      throw new Error(handleApiError(error));
    }
  },

  /**
   * Upload multiple files to draft (bulk upload)
   * POST /api/v1/kb-drafts/{draft_id}/sources/files/bulk
   *
   * Uploads up to 20 files at once, each parsed by Tika
   * Returns summary with per-file results
   */
  async addFileSourcesBulk(
    draftId: string,
    files: File[],
    onProgress?: (progress: number, currentFile: string) => void
  ): Promise<{
    total_files: number;
    successful: number;
    failed: number;
    total_chars: number;
    total_words: number;
    total_pages: number;
    sources: Array<{
      source_id: string;
      filename: string;
      file_size: number;
      mime_type: string;
      page_count: number;
      char_count: number;
      word_count: number;
    }>;
    failures: Array<{
      filename: string;
      error: string;
    }>;
    message: string;
  }> {
    try {
      const formData = new FormData();
      files.forEach((file) => {
        formData.append('files', file);
      });

      const response = await apiClient.post(
        `/kb-drafts/${draftId}/sources/files/bulk`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          // Extended timeout for bulk files with OCR (10 minutes)
          timeout: 600000,
          onUploadProgress: (progressEvent: { loaded: number; total?: number }) => {
            if (onProgress && progressEvent.total) {
              const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              onProgress(progress, 'Uploading files...');
            }
          },
        }
      );
      return response.data;
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ECONNABORTED') {
        throw new Error('Bulk file parsing timed out. Try uploading fewer files or smaller files.');
      }
      throw new Error(handleApiError(error));
    }
  },

  /**
   * Remove source from draft
   * DELETE /api/v1/kb-drafts/{draft_id}/sources/{source_id}
   */
  async removeSource(draftId: string, sourceId: string): Promise<void> {
    try {
      await apiClient.delete(`/kb-drafts/${draftId}/sources/${sourceId}`);
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  /**
   * Update chunking configuration
   * POST /api/v1/kb-drafts/{draft_id}/chunking
   */
  async updateChunking(draftId: string, request: UpdateChunkingRequest): Promise<void> {
    try {
      await apiClient.post(`/kb-drafts/${draftId}/chunking`, request);
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  /**
   * Update embedding configuration
   * POST /api/v1/kb-drafts/{draft_id}/embedding
   */
  async updateEmbedding(draftId: string, request: UpdateEmbeddingRequest): Promise<void> {
    try {
      await apiClient.post(`/kb-drafts/${draftId}/embedding`, request);
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  /**
   * Update vector store configuration
   * POST /api/v1/kb-drafts/{draft_id}/vector-store
   */
  async updateVectorStore(draftId: string, request: UpdateVectorStoreRequest): Promise<void> {
    try {
      await apiClient.post(`/kb-drafts/${draftId}/vector-store`, request);
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  /**
   * Validate draft before finalization
   * GET /api/v1/kb-drafts/{draft_id}/validate
   */
  async validate(draftId: string): Promise<DraftValidationResponse> {
    try {
      const response = await apiClient.get<DraftValidationResponse>(`/kb-drafts/${draftId}/validate`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  /**
   * Get scraped pages with full content
   * GET /api/v1/kb-drafts/{draft_id}/pages
   */
  async getPages(draftId: string, page: number = 1, limit: number = 10): Promise<any[]> {
    try {
      const response = await apiClient.get(`/kb-drafts/${draftId}/pages`, {
        params: { page, limit }
      });
      return response.data.pages || [];
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  /**
   * Get specific draft page
   * GET /api/v1/kb-drafts/{draft_id}/pages/{page_index}
   */
  async getPage(draftId: string, pageIndex: number): Promise<any> {
    try {
      const response = await apiClient.get(`/kb-drafts/${draftId}/pages/${pageIndex}`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  /**
   * Get generated chunks for inspection
   * GET /api/v1/kb-drafts/{draft_id}/chunks
   */
  async getChunks(draftId: string, page: number = 1, limit: number = 20): Promise<any[]> {
    try {
      const response = await apiClient.get(`/kb-drafts/${draftId}/chunks`, {
        params: { page, limit }
      });
      return response.data.chunks || [];
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  /**
   * Preview chunks with different strategies (live preview)
   * POST /api/v1/kb-drafts/{draft_id}/preview-chunks-live
   *
   * Returns chunks with chunking_decision metadata for preview/production parity
   */
  async previewChunks(draftId: string, params: {
    source_id?: string;
    content: string;
    strategy: string;
    chunk_size: number;
    chunk_overlap: number;
    include_metrics?: boolean;
    custom_separators?: string[];
    enable_enhanced_metadata?: boolean;
    title?: string;
    max_chunks?: number;
  }): Promise<{
    chunks: any[];
    metrics: any;
    total_chunks: number;
    preview_limited: boolean;
    chunks_shown: number;
    chunking_decision?: {
      strategy: string;
      chunk_size: number;
      chunk_overlap: number;
      user_preference: boolean;
      adaptive_suggestion: string;
      reasoning: string;
    };
  }> {
    try {
      const response = await apiClient.post(`/kb-drafts/${draftId}/preview-chunks-live`, params);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  /**
   * Multi-page realistic preview
   * POST /api/v1/kb-drafts/{draft_id}/preview
   */
  async preview(draftId: string, maxPages: number = 5, retryCount: number = 0): Promise<PreviewResponse> {
    const maxRetries = 2;
    const timeoutMs = 300000; // 5 minutes

    try {
      console.log(`🔄 Preview attempt ${retryCount + 1}/${maxRetries + 1} (timeout: ${timeoutMs/1000}s)`);

      const response = await apiClient.post<PreviewResponse>(
        `/kb-drafts/${draftId}/preview`,
        { max_pages: maxPages },
        { timeout: timeoutMs }
      );

      console.log('✅ Preview completed successfully');
      return response.data;
    } catch (error: any) {
      const isTimeoutError = error.code === 'ECONNABORTED' || error.message?.includes('timeout');

      if (isTimeoutError && retryCount < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, retryCount), 10000); // Exponential backoff, max 10s
        console.log(`⏰ Preview timeout, retrying in ${delay/1000}s... (attempt ${retryCount + 2}/${maxRetries + 1})`);

        await new Promise(resolve => setTimeout(resolve, delay));
        return this.preview(draftId, maxPages, retryCount + 1);
      }

      // If all retries failed or non-timeout error
      if (isTimeoutError) {
        throw new Error('Preview operation timed out after multiple attempts. The URLs may be taking too long to crawl or the websites are blocking automated access.');
      }

      throw new Error(handleApiError(error));
    }
  },

  /**
   * Finalize draft (Phase 1 → Phase 2 transition)
   * POST /api/v1/kb-drafts/{draft_id}/finalize
   */
  async finalize(draftId: string, request?: FinalizeRequest): Promise<FinalizeResponse> {
    try {
      const response = await apiClient.post<FinalizeResponse>(
        `/kb-drafts/${draftId}/finalize`,
        request || {}
      );
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  /**
   * Update draft preview data with edited content
   * PUT /api/v1/kb-drafts/{draft_id}/preview-data
   */
  async updatePreviewData(draftId: string, previewData: any): Promise<{
    success: boolean;
    message: string;
    draft_id: string;
  }> {
    try {
      const response = await apiClient.put<{
        success: boolean;
        message: string;
        draft_id: string;
      }>(`/kb-drafts/${draftId}/preview-data`, previewData);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  /**
   * Approve content and add to sources (Phase 1C)
   * POST /api/v1/kb-drafts/{draft_id}/approve-content
   */
  async approveContent(draftId: string, request: {
    page_indices: number[];
    source_name?: string;
    metadata?: Record<string, any>;
  }): Promise<{
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
  }> {
    // Legacy method - now delegates to source-centric approach
    return await this.approveContentLegacy(draftId, request);
  },

  // Source-centric approval API (modern approach)
  async approveSources(draftId: string, sourceApprovals: Array<{
    source_id: string;
    approved_page_indices: number[];
    page_updates: Array<{
      page_index: number;
      edited_content?: string;
      is_edited: boolean;
    }>;
  }>): Promise<{
    success: boolean;
    message: string;
    summary: {
      total_sources_updated: number;
      total_pages_approved: number;
      total_edited_pages: number;
      duplicate_prevention_triggered?: boolean;
      sources: Array<{
        source_id: string;
        source_name: string;
        approved_pages: number;
        total_pages: number;
      }>;
    };
  }> {
    try {
      const response = await apiClient.post<{
        success: boolean;
        message: string;
        summary: {
          total_sources_updated: number;
          total_pages_approved: number;
          total_edited_pages: number;
          duplicate_prevention_triggered?: boolean;
          sources: Array<{
            source_id: string;
            source_name: string;
            approved_pages: number;
            total_pages: number;
          }>;
        };
      }>(`/kb-drafts/${draftId}/approve-sources`, sourceApprovals);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  // Legacy approve content method (kept for compatibility)
  async approveContentLegacy(draftId: string, request: {
    page_indices: number[];
    source_name?: string;
    metadata?: Record<string, any>;
  }): Promise<{
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
  }> {
    try {
      const response = await apiClient.post<{
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
      }>(`/kb-drafts/${draftId}/approve-content`, request);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  /**
   * Preview chunking on approved content (Phase 1D)
   * POST /api/v1/kb-drafts/{draft_id}/chunking-preview
   */
  async previewChunking(draftId: string, request: {
    strategy?: string;
    chunk_size?: number;
    chunk_overlap?: number;
    preserve_code_blocks?: boolean;
    source_id?: string;
    max_chunks_preview?: number;
  }): Promise<{
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
  }> {
    try {
      const response = await apiClient.post(`/kb-drafts/${draftId}/chunking-preview`, request);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  /**
   * Configure embedding model, vector store, and retrieval settings (Phase 1E)
   * POST /api/v1/kb-drafts/{draft_id}/model-config
   */
  async configureModels(draftId: string, request: {
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
  }): Promise<{
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
  }> {
    try {
      const response = await apiClient.post(`/kb-drafts/${draftId}/model-config`, request);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }
};

// ========================================
// QUICK PREVIEW API (No Draft Required)
// ========================================

export const previewApi = {
  /**
   * Quick preview chunking for a URL (no draft needed)
   * POST /api/v1/kb-drafts/preview
   */
  async quickPreview(request: PreviewRequest): Promise<QuickPreviewResponse> {
    try {
      const response = await apiClient.post<QuickPreviewResponse>('/kb-drafts/preview', request);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  /**
   * Preview chunking using kb-drafts endpoint
   * POST /api/v1/kb-drafts/preview
   */
  async previewDrafts(request: PreviewRequest): Promise<any> {
    try {
      const response = await apiClient.post<any>('/kb-drafts/preview', request);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }
};

// ========================================
// PHASE 3: PIPELINE MONITORING API
// ========================================

export const pipelineApi = {
  /**
   * Get real-time pipeline status (polled every 2 seconds)
   * GET /api/v1/kb-pipeline/{pipeline_id}/status
   */
  async getStatus(pipelineId: string): Promise<PipelineStatusResponse> {
    try {
      const response = await apiClient.get<PipelineStatusResponse>(`/kb-pipeline/${pipelineId}/status`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  /**
   * Get detailed pipeline logs
   * GET /api/v1/kb-pipeline/{pipeline_id}/logs
   */
  async getLogs(pipelineId: string): Promise<PipelineLogEntry[]> {
    try {
      const response = await apiClient.get<PipelineLogEntry[]>(`/kb-pipeline/${pipelineId}/logs`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  /**
   * Cancel running pipeline
   * POST /api/v1/kb-pipeline/{pipeline_id}/cancel
   */
  async cancel(pipelineId: string): Promise<void> {
    try {
      await apiClient.post(`/kb-pipeline/${pipelineId}/cancel`);
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }
};

// ========================================
// PRODUCTION KB MANAGEMENT API
// ========================================

export const kbApi = {
  /**
   * List KBs with pagination and filtering
   * GET /api/v1/kbs/
   */
  async list(filters?: KBListFilters): Promise<PaginatedResponse<KBSummary>> {
    try {
      const params = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined) {
            params.append(key, String(value));
          }
        });
      }
      const response = await apiClient.get<PaginatedResponse<KBSummary>>(
        `/kbs/?${params}`
      );
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  /**
   * Get specific KB details
   * GET /api/v1/kbs/{kb_id}
   */
  async get(kbId: string): Promise<KnowledgeBase> {
    try {
      const response = await apiClient.get<KnowledgeBase>(`/kbs/${kbId}`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  /**
   * Update KB configuration
   * PATCH /api/v1/kbs/{kb_id}
   */
  async update(kbId: string, updates: Partial<KnowledgeBase>): Promise<KnowledgeBase> {
    try {
      const response = await apiClient.patch<KnowledgeBase>(`/kbs/${kbId}`, updates);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  /**
   * Soft delete KB
   * DELETE /api/v1/kbs/{kb_id}
   */
  async delete(kbId: string): Promise<void> {
    try {
      await apiClient.delete(`/kbs/${kbId}`);
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  /**
   * Query KB for testing
   * POST /api/v1/kbs/{kb_id}/query
   */
  async query(kbId: string, request: QueryRequest): Promise<QueryResponse> {
    try {
      const response = await apiClient.post<QueryResponse>(`/kbs/${kbId}/query`, request);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  /**
   * Get KB stats
   * GET /api/v1/kbs/{kb_id}/stats
   */
  async getStats(kbId: string): Promise<KBStats> {
    try {
      const response = await apiClient.get<KBStats>(`/kbs/${kbId}/stats`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  /**
   * Reindex KB with optional configuration updates
   * POST /api/v1/kbs/{kb_id}/reindex
   */
  async reindex(kbId: string, config?: {
    chunking_config?: any;
    embedding_config?: any;
    vector_store_config?: any;
  }): Promise<{ message: string; task_id: string; configuration_updated?: boolean }> {
    try {
      const response = await apiClient.post<{ message: string; task_id: string; configuration_updated?: boolean }>(
        `/kbs/${kbId}/reindex`,
        config || {}
      );
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  /**
   * Preview KB rechunking
   * POST /api/v1/kbs/{kb_id}/preview-rechunk
   */
  async previewRechunk(kbId: string, chunkingConfig: any): Promise<any> {
    try {
      const response = await apiClient.post<any>(`/kbs/${kbId}/preview-rechunk`, chunkingConfig);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  /**
   * Add document to existing KB
   * POST /api/v1/kbs/{kb_id}/documents/upload
   */
  async uploadDocument(kbId: string, file: File): Promise<KBDocument> {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await apiClient.post<KBDocument>(
        `/kbs/${kbId}/documents/upload`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  /**
   * Create KB document
   * POST /api/v1/kbs/{kb_id}/documents
   */
  async createDocument(kbId: string, documentData: any): Promise<KBDocument> {
    try {
      const response = await apiClient.post<KBDocument>(`/kbs/${kbId}/documents`, documentData);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  /**
   * List KB documents
   * GET /api/v1/kbs/{kb_id}/documents
   */
  async getDocuments(kbId: string): Promise<KBDocument[]> {
    try {
      const response = await apiClient.get<{
        kb_id: string;
        total_documents: number;
        documents: KBDocument[];
        page: number;
        limit: number;
        total_pages: number;
      }>(`/kbs/${kbId}/documents`);
      return response.data.documents || [];
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  /**
   * Get specific KB document
   * GET /api/v1/kbs/{kb_id}/documents/{doc_id}
   */
  async getDocument(kbId: string, docId: string): Promise<KBDocument> {
    try {
      const response = await apiClient.get<KBDocument>(`/kbs/${kbId}/documents/${docId}`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  /**
   * Update KB document
   * PUT /api/v1/kbs/{kb_id}/documents/{doc_id}
   */
  async updateDocument(kbId: string, docId: string, updates: Partial<KBDocument>): Promise<KBDocument> {
    try {
      const response = await apiClient.put<KBDocument>(`/kbs/${kbId}/documents/${docId}`, updates);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  /**
   * Delete KB document
   * DELETE /api/v1/kbs/{kb_id}/documents/{doc_id}
   */
  async deleteDocument(kbId: string, docId: string): Promise<void> {
    try {
      await apiClient.delete(`/kbs/${kbId}/documents/${docId}`);
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  /**
   * Download KB document in specified format
   * GET /api/v1/kbs/{kb_id}/documents/{doc_id}/download?format={format}
   */
  async downloadDocument(kbId: string, docId: string, format: 'txt' | 'md' | 'json' = 'txt'): Promise<Blob> {
    try {
      const response = await apiClient.get(`/kbs/${kbId}/documents/${docId}/download`, {
        params: { format },
        responseType: 'blob'
      });
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  /**
   * List KB chunks
   * GET /api/v1/kbs/{kb_id}/chunks
   */
  async getChunks(kbId: string, page?: number, limit?: number): Promise<any[]> {
    try {
      const params = new URLSearchParams();
      if (page) params.append('page', String(page));
      if (limit) params.append('limit', String(limit));

      const response = await apiClient.get<{
        kb_id: string;
        total_chunks: number;
        chunks: any[];
        page: number;
        limit: number;
        total_pages: number;
      }>(`/kbs/${kbId}/chunks?${params}`);
      return response.data.chunks || [];
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  /**
   * Enhanced retry for failed KB processing with complete state restoration
   * POST /api/v1/kbs/{kb_id}/retry-processing
   */
  async retryProcessing(kbId: string, options?: {
    config_overrides?: Record<string, any>;
    preserve_existing_chunks?: boolean;
    retry_stages?: string[];
  }): Promise<{
    pipeline_id: string;
    kb_id: string;
    task_id: string;
    status: string;
    message: string;
    backup_id?: string;
    cleanup_stats?: {
      chunks_deleted: number;
      documents_updated: number;
      qdrant_vectors_deleted: number;
      errors: string[];
    };
    retry_features?: string[];
    enhanced_retry?: boolean;
    kb_name?: string;
    configuration_overrides_applied?: boolean;
    note?: string;
  }> {
    try {
      const requestBody = options ? {
        config_overrides: options.config_overrides,
        preserve_existing_chunks: options.preserve_existing_chunks || false,
        retry_stages: options.retry_stages
      } : {};

      const response = await apiClient.post<{
        pipeline_id: string;
        kb_id: string;
        task_id: string;
        status: string;
        message: string;
        backup_id?: string;
        cleanup_stats?: {
          chunks_deleted: number;
          documents_updated: number;
          qdrant_vectors_deleted: number;
          errors: string[];
        };
        retry_features?: string[];
        enhanced_retry?: boolean;
        kb_name?: string;
        configuration_overrides_applied?: boolean;
        retry_stages?: string[];
        preserve_existing_chunks?: boolean;
        original_retry_options?: Record<string, any>;
        note?: string;
      }>(`/kbs/${kbId}/retry-processing`, requestBody);

      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  /**
   * Get retry status for a KB - whether it can be retried and why
   * GET /api/v1/kbs/{kb_id}/retry-status
   *
   * Returns information about whether the KB can be retried:
   * - Failed KBs: immediate retry available
   * - Processing KBs with stale queued pipelines: retry available
   * - Processing KBs with active pipelines: retry not available yet
   */
  async getRetryStatus(kbId: string): Promise<{
    can_retry: boolean;
    reason: string;
    kb_status: string;
    pipeline_status: string | null;
    pipeline_age_seconds: number | null;
    is_stale: boolean;
    stale_threshold_seconds: number;
    retry_available_in_seconds: number | null;
  }> {
    try {
      const response = await apiClient.get<{
        can_retry: boolean;
        reason: string;
        kb_status: string;
        pipeline_status: string | null;
        pipeline_age_seconds: number | null;
        is_stale: boolean;
        stale_threshold_seconds: number;
        retry_available_in_seconds: number | null;
      }>(`/kbs/${kbId}/retry-status`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }
};

// ========================================
// ENHANCED SEARCH API
// ========================================

export const enhancedSearchApi = {
  /**
   * Enhanced search endpoint
   * POST /api/v1/enhanced-search/
   */
  async search(searchQuery: any): Promise<any> {
    try {
      const response = await apiClient.post<any>('/enhanced-search/', searchQuery);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  /**
   * Search health check
   * GET /api/v1/enhanced-search/health
   */
  async checkHealth(): Promise<{ status: string; timestamp: string }> {
    try {
      const response = await apiClient.get<{ status: string; timestamp: string }>('/enhanced-search/health');
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }
};

// ========================================
// ERROR HANDLING UTILITIES
// ========================================

export const kbErrorHandling = {
  /**
   * Extract user-friendly error message
   */
  getUserMessage: (error: unknown): string => {
    if (error instanceof Error) {
      return error.message;
    }
    return handleApiError(error);
  },

  /**
   * Check if error indicates specific KB error codes
   */
  isKBError: (error: unknown, errorCode: string): boolean => {
    if (error instanceof Error && error.message.includes(errorCode)) {
      return true;
    }
    return false;
  },

  /**
   * Handle common KB validation errors
   */
  handleValidationError: (error: unknown): string[] => {
    const message = handleApiError(error);
    // Backend returns validation errors as comma-separated or JSON array
    try {
      const parsed = JSON.parse(message);
      if (Array.isArray(parsed)) {
        return parsed.map(e => typeof e === 'string' ? e : e.message || String(e));
      }
    } catch {
      // Not JSON, split by comma if multiple errors
      if (message.includes(',')) {
        return message.split(',').map(s => s.trim());
      }
    }
    return [message];
  },

  /**
   * Validate URL format
   */
  validateUrl: (url: string): boolean => {
    try {
      const urlObj = new URL(url);
      return ['http:', 'https:'].includes(urlObj.protocol);
    } catch {
      return false;
    }
  }
};

// ========================================
// UNIFIED KB CLIENT EXPORT
// ========================================

const kbClient = {
  // 3-Phase APIs
  draft: kbDraftApi,
  pipeline: pipelineApi,
  preview: previewApi,

  // Production APIs
  kb: kbApi,
  search: enhancedSearchApi,

  // Utilities
  errors: kbErrorHandling
};

export default kbClient;