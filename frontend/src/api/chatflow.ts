/**
 * Chatflow API Client
 *
 * WHY: API client for chatflow operations (visual workflow builder)
 * HOW: Implements 3-phase architecture like chatbot API
 *
 * Endpoints:
 * - Draft: POST/GET/PATCH/DELETE /api/v1/chatflows/drafts
 * - Deploy: POST /api/v1/chatflows/drafts/{id}/finalize
 * - Deployed: GET/DELETE /api/v1/chatflows
 */

import { apiClient, handleApiError } from "@/lib/api-client";

// ========================================
// TYPE DEFINITIONS
// ========================================

export interface ChatflowSummary {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
  node_count: number;
  created_at?: string;
}

export interface Chatflow {
  id: string;
  name: string;
  description?: string;
  workspace_id: string;
  config: {
    nodes: Array<{
      id: string;
      type: string;
      data: Record<string, unknown>;
      position: { x: number; y: number };
    }>;
    edges: Array<{
      id: string;
      source: string;
      target: string;
    }>;
    variables?: Record<string, unknown>;
    settings?: Record<string, unknown>;
  };
  version: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  deployed_at?: string;
}

export interface ChatflowDraft {
  id: string;
  type: string;
  workspace_id: string;
  created_by: string;
  status: string;
  data: {
    name: string;
    description?: string;
    nodes: Array<Record<string, unknown>>;
    edges: Array<Record<string, unknown>>;
    variables?: Record<string, unknown>;
    settings?: Record<string, unknown>;
  };
  expires_at: string;
  created_at: string;
  updated_at: string;
  source_entity_id?: string;
}

export interface ChatflowListResponse {
  items: ChatflowSummary[];
  total: number;
  skip: number;
  limit: number;
}

export interface CreateChatflowDraftRequest {
  workspace_id: string;
  initial_data?: {
    name?: string;
    nodes?: Array<Record<string, unknown>>;
    edges?: Array<Record<string, unknown>>;
  };
}

export interface UpdateChatflowDraftRequest {
  nodes?: Array<Record<string, unknown>>;
  edges?: Array<Record<string, unknown>>;
  name?: string;
  description?: string;
  variables?: Record<string, unknown>;
  settings?: Record<string, unknown>;
}

export interface FinalizeChatflowRequest {
  channels?: Array<{
    type: string;
    enabled: boolean;
    config?: Record<string, unknown>;
    credential_id?: string;
  }>;
}

// ========================================
// DRAFT API (Phase 1 - Redis)
// ========================================

export const chatflowDraftApi = {
  /**
   * Create new chatflow draft
   * POST /api/v1/chatflows/drafts
   */
  async create(
    request: CreateChatflowDraftRequest
  ): Promise<{ draft_id: string; expires_at: string }> {
    try {
      const response = await apiClient.post<{
        draft_id: string;
        expires_at: string;
      }>("/chatflows/drafts", request);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  /**
   * Get draft details
   * GET /api/v1/chatflows/drafts/{draft_id}
   */
  async get(draftId: string): Promise<ChatflowDraft> {
    try {
      const response = await apiClient.get<ChatflowDraft>(
        `/chatflows/drafts/${draftId}`
      );
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  /**
   * Update draft (auto-save)
   * PATCH /api/v1/chatflows/drafts/{draft_id}
   */
  async update(
    draftId: string,
    request: UpdateChatflowDraftRequest
  ): Promise<{ status: string; draft_id: string }> {
    try {
      const response = await apiClient.patch<{
        status: string;
        draft_id: string;
      }>(`/chatflows/drafts/${draftId}`, request);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  /**
   * Delete draft (abandon)
   * DELETE /api/v1/chatflows/drafts/{draft_id}
   */
  async delete(draftId: string): Promise<{ status: string; draft_id: string }> {
    try {
      const response = await apiClient.delete<{
        status: string;
        draft_id: string;
      }>(`/chatflows/drafts/${draftId}`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  /**
   * Deploy draft to database
   * POST /api/v1/chatflows/drafts/{draft_id}/finalize
   */
  async finalize(
    draftId: string,
    request?: FinalizeChatflowRequest
  ): Promise<{ status: string; chatflow_id: string }> {
    try {
      const response = await apiClient.post<{
        status: string;
        chatflow_id: string;
      }>(`/chatflows/drafts/${draftId}/finalize`, request || {});
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },
};

// ========================================
// DEPLOYED CHATFLOWS API (Phase 3 - Database)
// ========================================

export const chatflowApi = {
  /**
   * List deployed chatflows
   * GET /api/v1/chatflows?workspace_id=...
   */
  async list(
    workspaceId: string,
    skip = 0,
    limit = 50
  ): Promise<ChatflowListResponse> {
    try {
      const response = await apiClient.get<ChatflowListResponse>("/chatflows", {
        params: { workspace_id: workspaceId, skip, limit },
      });
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  /**
   * Get chatflow details
   * GET /api/v1/chatflows/{chatflow_id}
   */
  async get(chatflowId: string): Promise<Chatflow> {
    try {
      const response = await apiClient.get<Chatflow>(
        `/chatflows/${chatflowId}`
      );
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  /**
   * Delete chatflow (soft delete)
   * DELETE /api/v1/chatflows/{chatflow_id}
   */
  async delete(
    chatflowId: string
  ): Promise<{ status: string; chatflow_id: string }> {
    try {
      const response = await apiClient.delete<{
        status: string;
        chatflow_id: string;
      }>(`/chatflows/${chatflowId}`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  /**
   * Create an edit draft from a deployed chatflow
   * POST /api/v1/chatflows/{chatflow_id}/edit
   */
  async createEditDraft(
    chatflowId: string
  ): Promise<{ draft_id: string }> {
    try {
      const response = await apiClient.post<{ draft_id: string }>(
        `/chatflows/${chatflowId}/edit`
      );
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  /**
   * Toggle chatflow active status
   * PATCH /api/v1/chatflows/{chatflow_id}/toggle
   */
  async toggle(
    chatflowId: string
  ): Promise<{ status: string; chatflow_id: string; is_active: boolean }> {
    try {
      const response = await apiClient.patch<{
        status: string;
        chatflow_id: string;
        is_active: boolean;
      }>(`/chatflows/${chatflowId}/toggle`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },
};

// Default export for convenience
export default {
  draft: chatflowDraftApi,
  deployed: chatflowApi,
};
