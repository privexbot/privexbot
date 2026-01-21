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

export interface DeployToGuildRequest {
  chatbot_id: string;
  guild_id: string;
  guild_name?: string;
  allowed_channel_ids?: string[];
}

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

export interface AvailableGuild {
  guild_id: string;
  guild_name: string;
  guild_icon: string | null;
}

export interface AvailableGuildsResponse {
  guilds: AvailableGuild[];
  message: string;
  error: string | null; // Error details for troubleshooting
}

// ========================================
// API CLIENT
// ========================================

export const discordApi = {
  /**
   * Get the invite URL for the shared Discord bot.
   * Users must add the bot to their server before deploying.
   */
  async getInviteUrl(): Promise<InviteUrlResponse> {
    try {
      const response = await apiClient.get<InviteUrlResponse>(
        "/discord/guilds/invite-url"
      );
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  /**
   * Get list of Discord servers where bot is present but not yet deployed.
   * Used for auto-detect servers dropdown.
   */
  async getAvailableGuilds(): Promise<AvailableGuildsResponse> {
    try {
      const response = await apiClient.get<AvailableGuildsResponse>(
        "/discord/guilds/available"
      );
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  /**
   * Deploy chatbot to a Discord guild (server).
   */
  async deployToGuild(request: DeployToGuildRequest): Promise<GuildDeployment> {
    try {
      const response = await apiClient.post<GuildDeployment>(
        "/discord/guilds/deploy",
        request
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
