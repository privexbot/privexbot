/**
 * Discord API Client
 *
 * Manages Discord guild deployments for shared bot architecture.
 * ONE Discord bot serves ALL customers, routing based on guild_id.
 */

import { apiClient, handleApiError } from "@/lib/api-client";

// ========================================
// TYPES
// ========================================

export interface UpdateGuildDeploymentRequest {
  allowed_channel_ids?: string[];
  is_active?: boolean;
}

export interface ReassignGuildRequest {
  new_chatbot_id: string;
}

export interface GuildDeployment {
  id: string;
  workspace_id: string;
  guild_id: string;
  guild_name: string | null;
  guild_icon: string | null;
  chatbot_id: string;
  chatbot_name: string | null;
  allowed_channel_ids: string[];
  is_active: boolean;
  created_at: string;
  deployed_at: string | null;
}

export interface DiscordChannel {
  id: string;
  name: string;
  type: number;
  position: number;
  parent_id: string | null;
}

export interface ChannelListResponse {
  guild_id: string;
  channels: DiscordChannel[];
}

export interface InviteUrlResponse {
  invite_url: string;
  application_id: string;
  instructions: string;
}

// ========================================
// API CLIENT
// ========================================

export const discordApi = {
  /**
   * Get the signed-OAuth invite URL for the shared Discord bot. Adding the bot
   * via this URL auto-connects it to `chatbotId` for the caller's workspace
   * (the OAuth callback verifies the signed state). No manual server-ID step.
   */
  async getInviteUrl(
    chatbotId: string,
    entityType: "chatbot" | "chatflow" = "chatbot"
  ): Promise<InviteUrlResponse> {
    try {
      const response = await apiClient.get<InviteUrlResponse>(
        "/discord/guilds/invite-url",
        { params: { chatbot_id: chatbotId, entity_type: entityType } }
      );
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  /**
   * List all guild deployments for the workspace.
   */
  async listDeployments(
    chatbotId?: string,
    activeOnly: boolean = false
  ): Promise<GuildDeployment[]> {
    try {
      const params: Record<string, string | boolean> = {};
      if (chatbotId) params.chatbot_id = chatbotId;
      if (activeOnly) params.active_only = true;

      const response = await apiClient.get<GuildDeployment[]>(
        "/discord/guilds/",
        { params }
      );
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  /**
   * Get details of a specific guild deployment.
   */
  async getDeployment(guildId: string): Promise<GuildDeployment> {
    try {
      const response = await apiClient.get<GuildDeployment>(
        `/discord/guilds/${guildId}`
      );
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  /**
   * Get list of text channels in a Discord guild.
   * Used for channel restriction UI.
   */
  async getGuildChannels(guildId: string): Promise<ChannelListResponse> {
    try {
      const response = await apiClient.get<ChannelListResponse>(
        `/discord/guilds/${guildId}/channels`
      );
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  /**
   * Update a guild deployment (channel restrictions, active status).
   */
  async updateDeployment(
    guildId: string,
    request: UpdateGuildDeploymentRequest
  ): Promise<GuildDeployment> {
    try {
      const response = await apiClient.patch<GuildDeployment>(
        `/discord/guilds/${guildId}`,
        request
      );
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  /**
   * Reassign a guild to a different chatbot.
   */
  async reassignGuild(
    guildId: string,
    newChatbotId: string
  ): Promise<GuildDeployment> {
    try {
      const response = await apiClient.post<GuildDeployment>(
        `/discord/guilds/${guildId}/reassign`,
        { new_chatbot_id: newChatbotId }
      );
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  /**
   * Remove guild deployment (disconnect chatbot from Discord server).
   */
  async removeDeployment(
    guildId: string
  ): Promise<{ status: string; guild_id: string }> {
    try {
      const response = await apiClient.delete<{
        status: string;
        guild_id: string;
      }>(`/discord/guilds/${guildId}`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  /**
   * Activate a paused guild deployment.
   */
  async activateGuild(
    guildId: string
  ): Promise<{ status: string; guild_id: string }> {
    try {
      const response = await apiClient.post<{
        status: string;
        guild_id: string;
      }>(`/discord/guilds/${guildId}/activate`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  /**
   * Temporarily deactivate a guild deployment.
   */
  async deactivateGuild(
    guildId: string
  ): Promise<{ status: string; guild_id: string }> {
    try {
      const response = await apiClient.post<{
        status: string;
        guild_id: string;
      }>(`/discord/guilds/${guildId}/deactivate`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },
};

export default discordApi;
