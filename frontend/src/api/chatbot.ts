/**
 * Chatbot API Client
 *
 * Implements the 3-phase architecture:
 * Phase 1: Draft Mode (Redis) - Configuration & Preview
 * Phase 2: Deployment (DB + Channels) - Commit & Register
 * Phase 3: Active Usage - Messages, Analytics
 */

import { apiClient, handleApiError } from "@/lib/api-client";
import type {
  // Draft Types
  CreateChatbotDraftRequest,
  ChatbotDraft,
  UpdateChatbotDraftRequest,
  AttachKBRequest,
  DeployChatbotRequest,
  DeploymentResponse,
  CreateDraftResponse,

  // Deployed Types
  Chatbot,
  ChatbotListFilters,
  PaginatedChatbotResponse,

  // Test Types
  TestMessageRequest,
  TestMessageResponse,

  // Analytics Types
  ChatbotAnalytics,
} from "@/types/chatbot";

// ========================================
// PHASE 1: DRAFT MODE API (Redis Storage)
// ========================================

export const chatbotDraftApi = {
  /**
   * Create new chatbot draft (Phase 1 start)
   * POST /api/v1/chatbots/drafts
   */
  async create(
    request: CreateChatbotDraftRequest
  ): Promise<CreateDraftResponse> {
    try {
      const response = await apiClient.post<CreateDraftResponse>(
        "/chatbots/drafts",
        request
      );
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  /**
   * List drafts for workspace
   * GET /api/v1/chatbots/drafts?workspace_id=...
   */
  async list(workspaceId: string): Promise<ChatbotDraft[]> {
    try {
      const response = await apiClient.get<ChatbotDraft[]>("/chatbots/drafts", {
        params: { workspace_id: workspaceId },
      });
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  /**
   * Get draft details
   * GET /api/v1/chatbots/drafts/{draft_id}
   */
  async get(draftId: string): Promise<ChatbotDraft> {
    try {
      const response = await apiClient.get<ChatbotDraft>(
        `/chatbots/drafts/${draftId}`
      );
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  /**
   * Update draft configuration
   * PATCH /api/v1/chatbots/drafts/{draft_id}
   */
  async update(
    draftId: string,
    request: UpdateChatbotDraftRequest
  ): Promise<{ status: string; draft_id: string }> {
    try {
      const response = await apiClient.patch<{ status: string; draft_id: string }>(
        `/chatbots/drafts/${draftId}`,
        request
      );
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  /**
   * Delete draft (abandon creation)
   * DELETE /api/v1/chatbots/drafts/{draft_id}
   */
  async delete(draftId: string): Promise<void> {
    try {
      await apiClient.delete(`/chatbots/drafts/${draftId}`);
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  /**
   * Attach knowledge base to draft
   * POST /api/v1/chatbots/drafts/{draft_id}/kb
   */
  async attachKB(
    draftId: string,
    request: AttachKBRequest
  ): Promise<{ status: string; kb_id: string; kb_name: string }> {
    try {
      const response = await apiClient.post<{
        status: string;
        kb_id: string;
        kb_name: string;
      }>(`/chatbots/drafts/${draftId}/kb`, request);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  /**
   * Detach knowledge base from draft
   * DELETE /api/v1/chatbots/drafts/{draft_id}/kb/{kb_id}
   */
  async detachKB(draftId: string, kbId: string): Promise<void> {
    try {
      await apiClient.delete(`/chatbots/drafts/${draftId}/kb/${kbId}`);
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  /**
   * Test draft with a message
   * POST /api/v1/chatbots/drafts/{draft_id}/test
   */
  async test(
    draftId: string,
    request: TestMessageRequest
  ): Promise<TestMessageResponse> {
    try {
      const response = await apiClient.post<TestMessageResponse>(
        `/chatbots/drafts/${draftId}/test`,
        request,
        { timeout: 60000 } // 60 second timeout for AI response
      );
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  /**
   * Deploy chatbot from draft
   * POST /api/v1/chatbots/drafts/{draft_id}/deploy
   */
  async deploy(
    draftId: string,
    request: DeployChatbotRequest
  ): Promise<DeploymentResponse> {
    try {
      const response = await apiClient.post<DeploymentResponse>(
        `/chatbots/drafts/${draftId}/deploy`,
        request
      );
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },
};

// ========================================
// PHASE 3: DEPLOYED CHATBOT API
// ========================================

export const chatbotApi = {
  /**
   * List deployed chatbots
   * GET /api/v1/chatbots/?workspace_id=...
   */
  async list(filters: ChatbotListFilters): Promise<PaginatedChatbotResponse> {
    try {
      const params: Record<string, string | number> = {
        workspace_id: filters.workspace_id,
      };

      if (filters.status) {
        params.status_filter = filters.status;
      }
      if (filters.skip !== undefined) {
        params.skip = filters.skip;
      }
      if (filters.limit !== undefined) {
        params.limit = filters.limit;
      }

      const response = await apiClient.get<PaginatedChatbotResponse>(
        "/chatbots/",
        { params }
      );
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  /**
   * Get chatbot details
   * GET /api/v1/chatbots/{chatbot_id}
   */
  async get(chatbotId: string): Promise<Chatbot> {
    try {
      const response = await apiClient.get<Chatbot>(`/chatbots/${chatbotId}`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  /**
   * Update deployed chatbot
   * PATCH /api/v1/chatbots/{chatbot_id}
   */
  async update(
    chatbotId: string,
    request: UpdateChatbotDraftRequest
  ): Promise<{ status: string; chatbot_id: string }> {
    try {
      const response = await apiClient.patch<{
        status: string;
        chatbot_id: string;
      }>(`/chatbots/${chatbotId}`, request);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  /**
   * Archive chatbot (soft delete)
   * DELETE /api/v1/chatbots/{chatbot_id}
   *
   * The chatbot will be hidden but can be restored later.
   * All associated data (sessions, leads) is preserved.
   */
  async archive(
    chatbotId: string
  ): Promise<{ status: string; chatbot_id: string; archived_at: string }> {
    try {
      const response = await apiClient.delete<{
        status: string;
        chatbot_id: string;
        archived_at: string;
      }>(`/chatbots/${chatbotId}`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  /**
   * Restore an archived chatbot
   * POST /api/v1/chatbots/{chatbot_id}/restore
   *
   * The chatbot will be restored to PAUSED status.
   */
  async restore(
    chatbotId: string
  ): Promise<{ status: string; chatbot_id: string; new_status: string }> {
    try {
      const response = await apiClient.post<{
        status: string;
        chatbot_id: string;
        new_status: string;
      }>(`/chatbots/${chatbotId}/restore`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  /**
   * Update chatbot status (pause/resume)
   * POST /api/v1/chatbots/{chatbot_id}/status?new_status=active|paused
   *
   * Use 'active' to resume a paused chatbot.
   * Use 'paused' to pause an active chatbot.
   */
  async updateStatus(
    chatbotId: string,
    newStatus: "active" | "paused"
  ): Promise<{
    status: string;
    chatbot_id: string;
    old_status: string;
    new_status: string;
  }> {
    try {
      const response = await apiClient.post<{
        status: string;
        chatbot_id: string;
        old_status: string;
        new_status: string;
      }>(`/chatbots/${chatbotId}/status`, null, {
        params: { new_status: newStatus },
      });
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  /**
   * Permanently delete a chatbot (hard delete)
   * DELETE /api/v1/chatbots/{chatbot_id}/permanent?confirm=true
   *
   * WARNING: This is IRREVERSIBLE. All associated data will be deleted.
   * The chatbot must be archived first.
   */
  async deletePermanently(
    chatbotId: string
  ): Promise<{
    status: string;
    chatbot_id: string;
    chatbot_name: string;
    deleted_resources: {
      sessions: number;
      api_keys: number;
      leads: number;
    };
  }> {
    try {
      const response = await apiClient.delete<{
        status: string;
        chatbot_id: string;
        chatbot_name: string;
        deleted_resources: {
          sessions: number;
          api_keys: number;
          leads: number;
        };
      }>(`/chatbots/${chatbotId}/permanent`, {
        params: { confirm: true },
      });
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  /**
   * Test deployed chatbot with a message
   * POST /api/v1/chatbots/{chatbot_id}/test
   */
  async test(
    chatbotId: string,
    request: TestMessageRequest
  ): Promise<TestMessageResponse> {
    try {
      const response = await apiClient.post<TestMessageResponse>(
        `/chatbots/${chatbotId}/test`,
        request,
        { timeout: 60000 } // 60 second timeout for AI response
      );
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  /**
   * Get chatbot analytics
   * GET /api/v1/chatbots/{chatbot_id}/analytics
   */
  async getAnalytics(
    chatbotId: string,
    days: number = 7
  ): Promise<ChatbotAnalytics> {
    try {
      const response = await apiClient.get<ChatbotAnalytics>(
        `/chatbots/${chatbotId}/analytics`,
        { params: { days } }
      );
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },
};

// ========================================
// ERROR UTILITIES
// ========================================

export const chatbotErrorHandling = {
  /**
   * Get user-friendly error message
   */
  getUserMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === "string") {
      return error;
    }
    return "An unexpected error occurred";
  },

  /**
   * Check if error is a validation error
   */
  isValidationError(error: unknown): boolean {
    if (error instanceof Error) {
      return error.message.includes("Validation failed");
    }
    return false;
  },

  /**
   * Check if error is a rate limit error
   */
  isRateLimitError(error: unknown): boolean {
    if (error instanceof Error) {
      const msg = error.message.toLowerCase();
      return msg.includes("rate limit") || msg.includes("429");
    }
    return false;
  },

  /**
   * Check if error is a network error
   */
  isNetworkError(error: unknown): boolean {
    if (error instanceof Error) {
      const msg = error.message.toLowerCase();
      return (
        msg.includes("network") ||
        msg.includes("timeout") ||
        msg.includes("econnrefused")
      );
    }
    return false;
  },
};

// ========================================
// UNIFIED CLIENT EXPORT
// ========================================

const chatbotClient = {
  draft: chatbotDraftApi,
  chatbot: chatbotApi,
  errors: chatbotErrorHandling,
};

export default chatbotClient;
