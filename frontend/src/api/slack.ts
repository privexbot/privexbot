/**
 * Slack API Client
 *
 * Manages Slack workspace deployments for shared bot architecture.
 * ONE Slack app serves ALL customers, routing based on team_id.
 */

import { apiClient, handleApiError } from "@/lib/api-client";

// ========================================
// TYPES
// ========================================

export interface DeployToWorkspaceRequest {
  chatbot_id: string;
  team_id: string;
  team_name?: string;
  allowed_channel_ids?: string[];
}

export interface UpdateWorkspaceDeploymentRequest {
  allowed_channel_ids?: string[];
  is_active?: boolean;
}

export interface ReassignWorkspaceRequest {
  new_chatbot_id: string;
}

export interface WorkspaceDeployment {
  id: string;
  workspace_id: string;
  team_id: string;
  team_name: string | null;
  team_domain: string | null;
  team_icon: string | null;
  chatbot_id: string;
  chatbot_name: string | null;
  allowed_channel_ids: string[];
  is_active: boolean;
  created_at: string;
  deployed_at: string | null;
}

export interface SlackChannel {
  id: string;
  name: string;
  is_private: boolean;
  num_members: number;
  topic: string;
}

export interface ChannelListResponse {
  channels: SlackChannel[];
  total: number;
}

export interface InstallUrlResponse {
  install_url: string;
  instructions: string;
}

// ========================================
// API CLIENT
// ========================================

export const slackApi = {
  /**
   * Get the install URL for the shared Slack app.
   * Users must install the app to their workspace before deploying.
   */
  async getInstallUrl(chatbotId?: string): Promise<InstallUrlResponse> {
    try {
      const params: Record<string, string> = {};
      if (chatbotId) params.chatbot_id = chatbotId;

      const response = await apiClient.get<InstallUrlResponse>(
        "/slack/workspaces/install-url",
        { params }
      );
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  /**
   * Deploy chatbot to a Slack workspace.
   */
  async deployToWorkspace(request: DeployToWorkspaceRequest): Promise<WorkspaceDeployment> {
    try {
      const response = await apiClient.post<WorkspaceDeployment>(
        "/slack/workspaces/deploy",
        request
      );
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  /**
   * List all workspace deployments.
   */
  async listDeployments(
    chatbotId?: string,
    activeOnly: boolean = false
  ): Promise<WorkspaceDeployment[]> {
    try {
      const params: Record<string, string | boolean> = {};
      if (chatbotId) params.chatbot_id = chatbotId;
      if (activeOnly) params.active_only = true;

      const response = await apiClient.get<WorkspaceDeployment[]>(
        "/slack/workspaces/",
        { params }
      );
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  /**
   * Get details of a specific workspace deployment.
   */
  async getDeployment(teamId: string): Promise<WorkspaceDeployment> {
    try {
      const response = await apiClient.get<WorkspaceDeployment>(
        `/slack/workspaces/${teamId}`
      );
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  /**
   * Get list of channels in a Slack workspace.
   */
  async getWorkspaceChannels(teamId: string): Promise<ChannelListResponse> {
    try {
      const response = await apiClient.get<ChannelListResponse>(
        `/slack/workspaces/${teamId}/channels`
      );
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  /**
   * Update a workspace deployment (channel restrictions, active status).
   */
  async updateDeployment(
    teamId: string,
    request: UpdateWorkspaceDeploymentRequest
  ): Promise<WorkspaceDeployment> {
    try {
      const response = await apiClient.patch<WorkspaceDeployment>(
        `/slack/workspaces/${teamId}`,
        request
      );
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  /**
   * Reassign a workspace to a different chatbot.
   */
  async reassignWorkspace(
    teamId: string,
    newChatbotId: string
  ): Promise<WorkspaceDeployment> {
    try {
      const response = await apiClient.post<WorkspaceDeployment>(
        `/slack/workspaces/${teamId}/reassign`,
        { new_chatbot_id: newChatbotId }
      );
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  /**
   * Remove workspace deployment.
   */
  async removeDeployment(teamId: string): Promise<{ detail: string }> {
    try {
      const response = await apiClient.delete<{ detail: string }>(
        `/slack/workspaces/${teamId}`
      );
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  /**
   * Activate a paused workspace deployment.
   */
  async activateWorkspace(teamId: string): Promise<WorkspaceDeployment> {
    try {
      const response = await apiClient.post<WorkspaceDeployment>(
        `/slack/workspaces/${teamId}/activate`
      );
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  /**
   * Temporarily deactivate a workspace deployment.
   */
  async deactivateWorkspace(teamId: string): Promise<WorkspaceDeployment> {
    try {
      const response = await apiClient.post<WorkspaceDeployment>(
        `/slack/workspaces/${teamId}/deactivate`
      );
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },
};

export default slackApi;
