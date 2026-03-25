/**
 * Dashboard API Client
 *
 * WHY: Fetch real dashboard statistics from the backend
 * HOW: Call /api/v1/dashboard endpoints with proper workspace context
 *
 * ENDPOINTS:
 * - GET /dashboard - Get all dashboard data
 * - GET /dashboard/stats - Get statistics only
 * - GET /dashboard/activities - Get recent activities
 * - GET /dashboard/chatbots - Get recent chatbots
 * - GET /dashboard/chatflows - Get recent chatflows
 * - GET /dashboard/knowledge-bases - Get recent knowledge bases
 */

import apiClient from "@/lib/api-client";
import type {
  DashboardData,
  DashboardStats,
  Activity,
  ChatbotSummary,
  ChatflowSummary,
  KnowledgeBaseSummary,
  DashboardFilters,
  TimeRange,
} from "@/types/dashboard";

/**
 * Convert TimeRange to days number for API
 */
function timeRangeToDays(timeRange?: TimeRange): number {
  if (!timeRange) return 7;

  switch (timeRange) {
    case "24h":
      return 1;
    case "7d":
      return 7;
    case "30d":
      return 30;
    case "90d":
      return 90;
    case "1y":
      return 365;
    default:
      return 7;
  }
}

class DashboardApiClient {
  /**
   * Get complete dashboard data from the backend API
   */
  async getDashboardData(
    workspaceId: string,
    filters?: DashboardFilters
  ): Promise<DashboardData> {
    try {
      const days = timeRangeToDays(filters?.time_range);

      const response = await apiClient.get<DashboardData>("/dashboard", {
        params: {
          workspace_id: workspaceId,
          days,
        },
      });

      return response.data;
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);

      // Return empty data on error instead of fake data
      return {
        stats: {
          total_chatbots: 0,
          total_chatflows: 0,
          total_knowledge_bases: 0,
          total_leads: 0,
          total_conversations: 0,
          active_conversations: 0,
          chatbots_delta: 0,
          chatflows_delta: 0,
          knowledge_bases_delta: 0,
          leads_delta: 0,
          conversations_delta: 0,
        },
        recent_activities: [],
        recent_chatbots: [],
        recent_chatflows: [],
        recent_knowledge_bases: [],
      };
    }
  }

  /**
   * Get dashboard statistics only
   */
  async getStats(
    workspaceId: string,
    filters?: DashboardFilters
  ): Promise<DashboardStats> {
    try {
      const days = timeRangeToDays(filters?.time_range);

      const response = await apiClient.get<DashboardStats>("/dashboard/stats", {
        params: {
          workspace_id: workspaceId,
          days,
        },
      });

      return response.data;
    } catch (error) {
      console.error("Failed to fetch dashboard stats:", error);

      return {
        total_chatbots: 0,
        total_chatflows: 0,
        total_knowledge_bases: 0,
        total_leads: 0,
        total_conversations: 0,
        active_conversations: 0,
        chatbots_delta: 0,
        chatflows_delta: 0,
        knowledge_bases_delta: 0,
        leads_delta: 0,
        conversations_delta: 0,
      };
    }
  }

  /**
   * Get recent activities only
   */
  async getActivities(
    workspaceId: string,
    _filters?: DashboardFilters,
    limit = 10
  ): Promise<Activity[]> {
    try {
      const response = await apiClient.get<Activity[]>("/dashboard/activities", {
        params: {
          workspace_id: workspaceId,
          limit,
        },
      });

      return response.data;
    } catch (error) {
      console.error("Failed to fetch activities:", error);
      return [];
    }
  }

  /**
   * Get recent chatbots
   */
  async getRecentChatbots(
    workspaceId: string,
    limit = 5
  ): Promise<ChatbotSummary[]> {
    try {
      const response = await apiClient.get<ChatbotSummary[]>("/dashboard/chatbots", {
        params: {
          workspace_id: workspaceId,
          limit,
        },
      });

      return response.data;
    } catch (error) {
      console.error("Failed to fetch recent chatbots:", error);
      return [];
    }
  }

  /**
   * Get recent chatflows
   */
  async getRecentChatflows(
    workspaceId: string,
    limit = 5
  ): Promise<ChatflowSummary[]> {
    try {
      const response = await apiClient.get<ChatflowSummary[]>("/dashboard/chatflows", {
        params: {
          workspace_id: workspaceId,
          limit,
        },
      });

      return response.data;
    } catch (error) {
      console.error("Failed to fetch recent chatflows:", error);
      return [];
    }
  }

  /**
   * Get recent knowledge bases
   */
  async getRecentKnowledgeBases(
    workspaceId: string,
    limit = 5
  ): Promise<KnowledgeBaseSummary[]> {
    try {
      const response = await apiClient.get<KnowledgeBaseSummary[]>("/dashboard/knowledge-bases", {
        params: {
          workspace_id: workspaceId,
          limit,
        },
      });

      return response.data;
    } catch (error) {
      console.error("Failed to fetch recent knowledge bases:", error);
      return [];
    }
  }
}

export const dashboardApi = new DashboardApiClient();
