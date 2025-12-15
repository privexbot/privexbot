/**
 * Content Enhancement API Client
 *
 * Provides content enhancement capabilities for knowledge base sources
 */

import { apiClient, handleApiError } from './api-client';

// ========================================
// TYPES
// ========================================

export interface EnhanceContentRequest {
  content: string;
  content_type?: string;
  enhancement_config?: {
    mode?: 'improve' | 'expand' | 'summarize' | 'extract';
    target_length?: number;
    preserve_structure?: boolean;
    language?: string;
  };
}

export interface EnhanceContentResponse {
  enhanced_content: string;
  original_length: number;
  enhanced_length: number;
  enhancement_mode: string;
  processing_time_ms: number;
  metadata?: Record<string, any>;
}

export interface ExtractImageTextRequest {
  image_url?: string;
  image_base64?: string;
  extract_tables?: boolean;
  extract_layout?: boolean;
}

export interface ExtractImageTextResponse {
  extracted_text: string;
  confidence_score: number;
  detected_language?: string;
  tables?: Array<{
    headers: string[];
    rows: string[][];
  }>;
  layout?: {
    paragraphs: string[];
    headings: string[];
  };
}

export interface RecommendStrategyRequest {
  content_sample: string;
  content_type?: string;
  target_use_case?: string;
}

export interface RecommendStrategyResponse {
  recommended_strategy: string;
  confidence_score: number;
  reasoning: string;
  alternative_strategies?: string[];
}

export interface StrategyPreset {
  id: string;
  name: string;
  description: string;
  config: Record<string, any>;
  use_cases: string[];
  created_at: string;
}

export interface EnhancedPreviewRequest {
  content: string;
  strategy_id: string;
  preview_length?: number;
}

export interface EnhancedPreviewResponse {
  preview: string;
  full_enhanced_length: number;
  strategy_applied: string;
  improvements: string[];
}

export interface ServiceHealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency_ms: number;
  available_models: string[];
  queue_depth?: number;
  last_check: string;
}

// ========================================
// API CLIENT
// ========================================

export const contentEnhancementApi = {
  /**
   * Enhance content with AI
   * POST /api/v1/content-enhancement/enhance-content
   */
  async enhanceContent(request: EnhanceContentRequest): Promise<EnhanceContentResponse> {
    try {
      const response = await apiClient.post<EnhanceContentResponse>(
        '/api/v1/content-enhancement/enhance-content',
        request
      );
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  /**
   * Extract text from images
   * POST /api/v1/content-enhancement/extract-image-text
   */
  async extractImageText(request: ExtractImageTextRequest): Promise<ExtractImageTextResponse> {
    try {
      const response = await apiClient.post<ExtractImageTextResponse>(
        '/api/v1/content-enhancement/extract-image-text',
        request
      );
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  /**
   * Get strategy recommendation
   * POST /api/v1/content-enhancement/recommend-strategy
   */
  async recommendStrategy(request: RecommendStrategyRequest): Promise<RecommendStrategyResponse> {
    try {
      const response = await apiClient.post<RecommendStrategyResponse>(
        '/api/v1/content-enhancement/recommend-strategy',
        request
      );
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  /**
   * List available strategy presets
   * GET /api/v1/content-enhancement/presets
   */
  async getPresets(): Promise<StrategyPreset[]> {
    try {
      const response = await apiClient.get<StrategyPreset[]>(
        '/api/v1/content-enhancement/presets'
      );
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  /**
   * Get enhanced content preview
   * POST /api/v1/content-enhancement/enhanced-preview
   */
  async getEnhancedPreview(request: EnhancedPreviewRequest): Promise<EnhancedPreviewResponse> {
    try {
      const response = await apiClient.post<EnhancedPreviewResponse>(
        '/api/v1/content-enhancement/enhanced-preview',
        request
      );
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  /**
   * Check service health
   * GET /api/v1/content-enhancement/health
   */
  async checkHealth(): Promise<ServiceHealthResponse> {
    try {
      const response = await apiClient.get<ServiceHealthResponse>(
        '/api/v1/content-enhancement/health'
      );
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }
};

// ========================================
// UNIFIED EXPORT
// ========================================

const contentEnhancementClient = {
  api: contentEnhancementApi
};

export default contentEnhancementClient;