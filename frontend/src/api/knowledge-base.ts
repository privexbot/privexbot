/**
 * Knowledge Base API Client
 *
 * Production-ready API client matching exact backend endpoints
 */

import { apiClient } from '@/lib/api-client';
import {
  KBDraft,
  KBSummary,
  KnowledgeBase,
  KBDocument,
  KBStats,
  CreateDraftRequest,
  AddWebSourceRequest,
  UpdateChunkingRequest,
  PreviewRequest,
  PreviewResponse,
  QuickPreviewResponse,
  FinalizeResponse,
  DraftValidation,
  PipelineStatusResponse,
  PipelineLogEntry,
  ReindexResponse,
  KBListFilters,
  PaginatedResponse,
  KBErrorResponse
} from '@/types/knowledge-base';

// ========================================
// KB DRAFTS API
// ========================================

export const kbDraftApi = {
  /**
   * POST /api/v1/kb-drafts/
   */
  async create(request: CreateDraftRequest): Promise<KBDraft> {
    const response = await apiClient.post<KBDraft>('/api/v1/kb-drafts/', request);
    return response.data;
  },

  /**
   * GET /api/v1/kb-drafts/{draft_id}
   */
  async get(draftId: string): Promise<KBDraft> {
    const response = await apiClient.get<KBDraft>(`/api/v1/kb-drafts/${draftId}`);
    return response.data;
  },

  /**
   * DELETE /api/v1/kb-drafts/{draft_id}
   */
  async delete(draftId: string): Promise<void> {
    await apiClient.delete(`/api/v1/kb-drafts/${draftId}`);
  },

  /**
   * POST /api/v1/kb-drafts/{draft_id}/sources/web
   */
  async addWebSource(draftId: string, request: AddWebSourceRequest): Promise<{ source_id: string }> {
    const response = await apiClient.post<{ source_id: string }>(`/api/v1/kb-drafts/${draftId}/sources/web`, request);
    return response.data;
  },

  /**
   * DELETE /api/v1/kb-drafts/{draft_id}/sources/{source_id}
   */
  async removeSource(draftId: string, sourceId: string): Promise<void> {
    await apiClient.delete(`/api/v1/kb-drafts/${draftId}/sources/${sourceId}`);
  },

  /**
   * POST /api/v1/kb-drafts/{draft_id}/chunking
   */
  async updateChunking(draftId: string, request: UpdateChunkingRequest): Promise<void> {
    await apiClient.post(`/api/v1/kb-drafts/${draftId}/chunking`, request);
  },

  /**
   * POST /api/v1/kb-drafts/{draft_id}/embedding
   */
  async updateEmbedding(draftId: string, request: any): Promise<void> {
    await apiClient.post(`/api/v1/kb-drafts/${draftId}/embedding`, request);
  },

  /**
   * POST /api/v1/kb-drafts/{draft_id}/vector-store
   */
  async updateVectorStore(draftId: string, request: any): Promise<void> {
    await apiClient.post(`/api/v1/kb-drafts/${draftId}/vector-store`, request);
  },

  /**
   * GET /api/v1/kb-drafts/{draft_id}/validate
   */
  async validate(draftId: string): Promise<DraftValidation> {
    const response = await apiClient.get<DraftValidation>(`/api/v1/kb-drafts/${draftId}/validate`);
    return response.data;
  },

  /**
   * POST /api/v1/kb-drafts/preview
   */
  async preview(request: PreviewRequest): Promise<PreviewResponse> {
    const response = await apiClient.post<PreviewResponse>('/api/v1/kb-drafts/preview', request);
    return response.data;
  },

  /**
   * POST /api/v1/kb-drafts/{draft_id}/preview
   */
  async previewDraft(draftId: string, request?: any): Promise<PreviewResponse> {
    const response = await apiClient.post<PreviewResponse>(`/api/v1/kb-drafts/${draftId}/preview`, request || {});
    return response.data;
  },

  /**
   * GET /api/v1/kb-drafts/{draft_id}/pages
   */
  async getPages(draftId: string): Promise<any[]> {
    const response = await apiClient.get<any[]>(`/api/v1/kb-drafts/${draftId}/pages`);
    return response.data;
  },

  /**
   * GET /api/v1/kb-drafts/{draft_id}/pages/{page_index}
   */
  async getPage(draftId: string, pageIndex: number): Promise<any> {
    const response = await apiClient.get<any>(`/api/v1/kb-drafts/${draftId}/pages/${pageIndex}`);
    return response.data;
  },

  /**
   * GET /api/v1/kb-drafts/{draft_id}/chunks
   */
  async getChunks(draftId: string): Promise<any[]> {
    const response = await apiClient.get<any[]>(`/api/v1/kb-drafts/${draftId}/chunks`);
    return response.data;
  },

  /**
   * POST /api/v1/kb-drafts/{draft_id}/finalize
   */
  async finalize(draftId: string): Promise<FinalizeResponse> {
    const response = await apiClient.post<FinalizeResponse>(`/api/v1/kb-drafts/${draftId}/finalize`);
    return response.data;
  },

  /**
   * POST /api/v1/kb-drafts/{draft_id}/preview - Quick preview of chunking
   */
  async quickPreview(draftId: string, maxPages?: number): Promise<PreviewResponse> {
    const response = await apiClient.post<PreviewResponse>(`/api/v1/kb-drafts/${draftId}/preview`, {
      max_pages: maxPages || 5
    });
    return response.data;
  }
};

// ========================================
// KB PIPELINES API
// ========================================

export const kbPipelineApi = {
  /**
   * GET /api/v1/kb-pipeline/{pipeline_id}/status
   */
  async getStatus(pipelineId: string): Promise<PipelineStatusResponse> {
    const response = await apiClient.get<PipelineStatusResponse>(`/api/v1/kb-pipeline/${pipelineId}/status`);
    return response.data;
  },

  /**
   * GET /api/v1/kb-pipeline/{pipeline_id}/logs
   */
  async getLogs(pipelineId: string): Promise<PipelineLogEntry[]> {
    const response = await apiClient.get<PipelineLogEntry[]>(`/api/v1/kb-pipeline/${pipelineId}/logs`);
    return response.data;
  },

  /**
   * POST /api/v1/kb-pipeline/{pipeline_id}/cancel
   */
  async cancel(pipelineId: string): Promise<void> {
    await apiClient.post(`/api/v1/kb-pipeline/${pipelineId}/cancel`);
  }
};

// ========================================
// KNOWLEDGE BASES API
// ========================================

export const kbApi = {
  /**
   * GET /api/v1/kbs/
   */
  async list(filters?: KBListFilters): Promise<PaginatedResponse<KBSummary>> {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) {
          params.append(key, String(value));
        }
      });
    }
    const response = await apiClient.get<PaginatedResponse<KBSummary>>(`/api/v1/kbs/?${params}`);
    return response.data;
  },

  /**
   * GET /api/v1/kbs/{kb_id}
   */
  async get(kbId: string): Promise<KnowledgeBase> {
    const response = await apiClient.get<KnowledgeBase>(`/api/v1/kbs/${kbId}`);
    return response.data;
  },

  /**
   * DELETE /api/v1/kbs/{kb_id}
   */
  async delete(kbId: string): Promise<void> {
    await apiClient.delete(`/api/v1/kbs/${kbId}`);
  },

  /**
   * POST /api/v1/kbs/{kb_id}/reindex
   */
  async reindex(kbId: string): Promise<ReindexResponse> {
    const response = await apiClient.post<ReindexResponse>(`/api/v1/kbs/${kbId}/reindex`);
    return response.data;
  },

  /**
   * GET /api/v1/kbs/{kb_id}/stats
   */
  async getStats(kbId: string): Promise<KBStats> {
    const response = await apiClient.get<KBStats>(`/api/v1/kbs/${kbId}/stats`);
    return response.data;
  },

  /**
   * POST /api/v1/kbs/{kb_id}/preview-rechunk
   */
  async previewRechunk(kbId: string, request: any): Promise<PreviewResponse> {
    const response = await apiClient.post<PreviewResponse>(`/api/v1/kbs/${kbId}/preview-rechunk`, request);
    return response.data;
  },

  /**
   * GET /api/v1/kbs/{kb_id}/documents
   */
  async getDocuments(kbId: string): Promise<KBDocument[]> {
    const response = await apiClient.get<KBDocument[]>(`/api/v1/kbs/${kbId}/documents`);
    return response.data;
  },

  /**
   * POST /api/v1/kbs/{kb_id}/documents
   */
  async createDocument(kbId: string, request: any): Promise<KBDocument> {
    const response = await apiClient.post<KBDocument>(`/api/v1/kbs/${kbId}/documents`, request);
    return response.data;
  },

  /**
   * GET /api/v1/kbs/{kb_id}/documents/{doc_id}
   */
  async getDocument(kbId: string, docId: string): Promise<KBDocument> {
    const response = await apiClient.get<KBDocument>(`/api/v1/kbs/${kbId}/documents/${docId}`);
    return response.data;
  },

  /**
   * PUT /api/v1/kbs/{kb_id}/documents/{doc_id}
   */
  async updateDocument(kbId: string, docId: string, request: any): Promise<KBDocument> {
    const response = await apiClient.put<KBDocument>(`/api/v1/kbs/${kbId}/documents/${docId}`, request);
    return response.data;
  },

  /**
   * DELETE /api/v1/kbs/{kb_id}/documents/{doc_id}
   */
  async deleteDocument(kbId: string, docId: string): Promise<void> {
    await apiClient.delete(`/api/v1/kbs/${kbId}/documents/${docId}`);
  },

  /**
   * GET /api/v1/kbs/{kb_id}/chunks
   */
  async getChunks(kbId: string): Promise<any[]> {
    const response = await apiClient.get<any[]>(`/api/v1/kbs/${kbId}/chunks`);
    return response.data;
  },

  /**
   * PUT /api/v1/kbs/{kb_id} - Update KB metadata
   */
  async update(kbId: string, request: { name?: string; description?: string; context?: string }): Promise<KnowledgeBase> {
    const response = await apiClient.put<KnowledgeBase>(`/api/v1/kbs/${kbId}`, request);
    return response.data;
  }
};

// ========================================
// CONTENT ENHANCEMENT API
// ========================================

export const contentEnhancementApi = {
  /**
   * POST /api/v1/content-enhancement/enhance-content
   */
  async enhanceContent(request: {
    content: string;
    content_type?: string;
    enhancement_config?: {
      remove_noise?: boolean;
      normalize_whitespace?: boolean;
      remove_markdown?: boolean;
      extract_code_blocks?: boolean;
    };
  }): Promise<{
    enhanced_content: string;
    original_length: number;
    enhanced_length: number;
    improvements_applied: string[];
    metadata: any;
  }> {
    const response = await apiClient.post('/api/v1/content-enhancement/enhance-content', request);
    return response.data;
  },

  /**
   * POST /api/v1/content-enhancement/extract-image-text
   */
  async extractImageText(request: any): Promise<any> {
    const response = await apiClient.post('/api/v1/content-enhancement/extract-image-text', request);
    return response.data;
  },

  /**
   * POST /api/v1/content-enhancement/recommend-strategy
   */
  async recommendStrategy(request: any): Promise<any> {
    const response = await apiClient.post('/api/v1/content-enhancement/recommend-strategy', request);
    return response.data;
  },

  /**
   * GET /api/v1/content-enhancement/presets
   */
  async getPresets(): Promise<any[]> {
    const response = await apiClient.get('/api/v1/content-enhancement/presets');
    return response.data;
  },

  /**
   * POST /api/v1/content-enhancement/enhanced-preview
   */
  async getEnhancedPreview(request: any): Promise<any> {
    const response = await apiClient.post('/api/v1/content-enhancement/enhanced-preview', request);
    return response.data;
  },

  /**
   * GET /api/v1/content-enhancement/health
   */
  async getHealth(): Promise<any> {
    const response = await apiClient.get('/api/v1/content-enhancement/health');
    return response.data;
  }
};

// ========================================
// ENHANCED SEARCH API
// ========================================

export const enhancedSearchApi = {
  /**
   * POST /api/v1/enhanced-search/
   */
  async search(request: any): Promise<any> {
    const response = await apiClient.post('/api/v1/enhanced-search/', request);
    return response.data;
  },

  /**
   * GET /api/v1/enhanced-search/health
   */
  async getHealth(): Promise<any> {
    const response = await apiClient.get('/api/v1/enhanced-search/health');
    return response.data;
  }
};

// ========================================
// ERROR HANDLING UTILITIES
// ========================================

export const kbErrorHandling = {
  isKBError(error: any): error is KBErrorResponse {
    return error?.error_code && typeof error.error_code === 'string';
  },

  getUserMessage(error: any): string {
    if (this.isKBError(error)) {
      switch (error.error_code) {
        case 'DRAFT_NOT_FOUND':
          return 'Your session has expired. Please start over.';
        case 'DRAFT_EXPIRED':
          return 'Your draft has expired. Would you like to recover your progress?';
        case 'URL_FETCH_FAILED':
          return 'Unable to access the URL. Please check and try again.';
        case 'QUOTA_EXCEEDED':
          return 'Too many requests. Please wait a moment before trying again.';
        case 'PROCESSING_FAILED':
          return 'Processing failed. Please try again or contact support.';
        default:
          return error.message || 'An unexpected error occurred.';
      }
    }

    if (error?.response?.data?.detail) {
      return error.response.data.detail;
    }

    return error?.message || 'An unexpected error occurred.';
  }
};

// ========================================
// EXPORT ALL
// ========================================

// Utility functions
const utils = {
  validateUrl: (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  },
  formatFileSize: (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  },
  estimateProcessingTime: (sources: any[]): number => {
    // Simple estimation based on source count and type
    const baseTimePerSource = 2; // minutes
    return Math.max(1, sources.length * baseTimePerSource);
  },
  debounceUpdate: <T extends (...args: any[]) => any>(func: T, delay: number): T => {
    let timeoutId: NodeJS.Timeout;
    return ((...args: any[]) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func(...args), delay);
    }) as T;
  }
};

export default {
  draft: kbDraftApi,
  pipeline: kbPipelineApi,
  kb: kbApi,
  contentEnhancement: contentEnhancementApi,
  enhancedSearch: enhancedSearchApi,
  errorHandling: kbErrorHandling,
  utils,
};