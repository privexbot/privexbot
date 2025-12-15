/**
 * Dashboard API Client
 *
 * WHY: Fetch dashboard statistics, activities, and recent resources
 * HOW: Mock data until backend endpoints are implemented
 *
 * ENDPOINTS:
 * - GET /dashboard - Get all dashboard data
 * - GET /dashboard/stats - Get statistics
 * - GET /dashboard/activities - Get recent activities
 */

import kbClient from "@/lib/kb-client";
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
import type { KBSummary } from "@/types/knowledge-base";

/**
 * Helper functions to convert KB data to dashboard format
 */
function convertKBSummaryToDashboard(
  kbSummary: KBSummary
): KnowledgeBaseSummary {
  return {
    id: kbSummary.id,
    name: kbSummary.name,
    description: kbSummary.description,
    status: kbSummary.status,
    documents_count:
      kbSummary.total_documents ?? kbSummary.stats?.documents ?? 0,
    total_chunks: kbSummary.total_chunks ?? kbSummary.stats?.chunks ?? 0,
    last_indexed_at: kbSummary.updated_at,
    created_at: kbSummary.created_at,
    updated_at: kbSummary.updated_at ?? kbSummary.created_at,
  };
}

/**
 * Client-side filtering utilities
 */
function getDateRangeFilter(timeRange: TimeRange): Date {
  const now = new Date();
  let daysBack = 7; // default

  switch (timeRange) {
    case "24h":
      daysBack = 1;
      break;
    case "7d":
      daysBack = 7;
      break;
    case "30d":
      daysBack = 30;
      break;
    case "90d":
      daysBack = 90;
      break;
    case "1y":
      daysBack = 365;
      break;
  }

  return new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
}

function filterKBsByTimeRange(
  kbs: KBSummary[],
  timeRange?: TimeRange
): KBSummary[] {
  if (!timeRange) return kbs;

  const cutoffDate = getDateRangeFilter(timeRange);
  return kbs.filter((kb) => {
    const createdDate = new Date(kb.created_at);
    return createdDate >= cutoffDate;
  });
}

function filterKBsBySearch(kbs: KBSummary[], search?: string): KBSummary[] {
  if (!search || typeof search !== 'string' || search.trim() === "") return kbs;

  const searchTerm = search.toLowerCase().trim();
  return kbs.filter(
    (kb) =>
      kb.name.toLowerCase().includes(searchTerm) ||
      kb.description?.toLowerCase().includes(searchTerm)
  );
}

function applyKBFilters(
  kbs: KBSummary[],
  filters?: DashboardFilters
): KBSummary[] {
  let filteredKBs = kbs;

  // Apply time range filtering if provided
  if (filters?.time_range) {
    filteredKBs = filterKBsByTimeRange(filteredKBs, filters.time_range);
  }

  // Apply search filtering if provided and not empty
  if (filters && 'search' in filters && filters.search) {
    const searchQuery = filters.search;
    if (typeof searchQuery === 'string' && searchQuery.trim() !== '') {
      filteredKBs = filterKBsBySearch(filteredKBs, searchQuery);
    }
  }

  return filteredKBs;
}

// Note: The KB API only supports workspace_id, context, status, page, and limit filters

class DashboardApiClient {
  /**
   * Get complete dashboard data - Now uses real KB APIs
   */
  async getDashboardData(
    workspaceId: string,
    filters?: DashboardFilters
  ): Promise<DashboardData> {
    try {
      // Use backend-supported filters only (client-side filtering applied after)
      const finalFilters = {
        workspace_id: workspaceId, // CRITICAL: Ensures only workspace-specific KBs are returned
        page: 1,
        limit: 50, // Fetch more data to enable effective client-side filtering
      };

      const kbListResponse = await kbClient.kb.list(finalFilters);

      // Handle response format safely - extract items from paginated response
      const kbArray: KBSummary[] = Array.isArray(kbListResponse)
        ? kbListResponse
        : kbListResponse.items;

      // Validate that returned data belongs to the correct workspace (defense in depth)
      const validatedKBs = kbArray.filter(
        (kb: KBSummary) => kb.workspace_id === workspaceId
      );

      // Apply client-side filtering (time range, search)
      const filteredKBs = applyKBFilters(validatedKBs, filters);

      // Convert filtered KB data to dashboard format
      const recentKnowledgeBases = filteredKBs
        .slice(0, 10) // Limit to recent items for dashboard display
        .map(convertKBSummaryToDashboard);

      // Calculate KB stats from filtered data
      const totalKnowledgeBases = filteredKBs.length;

      // For now, use fallback data for other resources until their APIs are ready
      await new Promise((resolve) => setTimeout(resolve, 300)); // Reduce delay since we have real data

      const dashboardStats: DashboardStats = {
        total_chatbots: 0,
        total_chatflows: 0,
        total_knowledge_bases: totalKnowledgeBases,
        total_leads: 0,
        total_conversations: 0,
        active_conversations: 0,
        chatbots_delta: 12.5,
        chatflows_delta: -5.2,
        knowledge_bases_delta: 8.3, // TODO: Calculate real delta
        leads_delta: 24.7,
        conversations_delta: 15.8,
      };

      const fallbackActivities: Activity[] = [
        {
          id: "act-1",
          type: "chatbot_deployed",
          title: "Customer Support Bot deployed",
          description: "Successfully deployed to production environment",
          resource_type: "chatbot",
          resource_id: "cb-1",
          resource_name: "Customer Support Bot",
          timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(), // 15 min ago
        },
        {
          id: "act-2",
          type: "lead_captured",
          title: "New lead captured",
          description: "Contact form submitted from landing page",
          resource_type: "lead",
          timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(), // 45 min ago
        },
        {
          id: "act-3",
          type: "chatflow_updated",
          title: "Sales Qualification Flow updated",
          description: "Added new validation nodes to workflow",
          resource_type: "chatflow",
          resource_id: "cf-1",
          resource_name: "Sales Qualification Flow",
          timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(), // 2 hours ago
        },
        {
          id: "act-4",
          type: "kb_updated",
          title: "Product Documentation updated",
          description: "Indexed 23 new documents",
          resource_type: "knowledge_base",
          resource_id: "kb-1",
          resource_name: "Product Documentation",
          timestamp: new Date(Date.now() - 1000 * 60 * 180).toISOString(), // 3 hours ago
        },
        {
          id: "act-5",
          type: "conversation_started",
          title: "45 new conversations started",
          description: "Peak activity detected in the last hour",
          timestamp: new Date(Date.now() - 1000 * 60 * 240).toISOString(), // 4 hours ago
        },
        {
          id: "act-6",
          type: "chatbot_created",
          title: "FAQ Bot created",
          description: "New chatbot initialized as draft",
          resource_type: "chatbot",
          resource_id: "cb-5",
          resource_name: "FAQ Bot",
          timestamp: new Date(Date.now() - 1000 * 60 * 360).toISOString(), // 6 hours ago
        },
      ];

      const fallbackChatbots: ChatbotSummary[] = [
        {
          id: "cb-1",
          name: "Customer Support Bot",
          description: "24/7 customer support automation",
          status: "active",
          conversations_count: 342,
          last_active_at: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
          created_at: new Date(
            Date.now() - 1000 * 60 * 60 * 24 * 7
          ).toISOString(),
          updated_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
          deployed_at: new Date(
            Date.now() - 1000 * 60 * 60 * 24 * 3
          ).toISOString(),
        },
        {
          id: "cb-2",
          name: "Lead Qualification Bot",
          description: "Qualify leads before sales handoff",
          status: "active",
          conversations_count: 128,
          last_active_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
          created_at: new Date(
            Date.now() - 1000 * 60 * 60 * 24 * 14
          ).toISOString(),
          updated_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
          deployed_at: new Date(
            Date.now() - 1000 * 60 * 60 * 24 * 10
          ).toISOString(),
        },
        {
          id: "cb-3",
          name: "FAQ Bot",
          description: "Answers frequently asked questions",
          status: "draft",
          conversations_count: 0,
          created_at: new Date(Date.now() - 1000 * 60 * 360).toISOString(),
          updated_at: new Date(Date.now() - 1000 * 60 * 360).toISOString(),
        },
      ];

      const fallbackChatflows: ChatflowSummary[] = [
        {
          id: "cf-1",
          name: "Sales Qualification Flow",
          description: "Multi-step sales qualification process",
          status: "active",
          nodes_count: 15,
          conversations_count: 89,
          last_active_at: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
          created_at: new Date(
            Date.now() - 1000 * 60 * 60 * 24 * 21
          ).toISOString(),
          updated_at: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
          deployed_at: new Date(
            Date.now() - 1000 * 60 * 60 * 24 * 14
          ).toISOString(),
        },
        {
          id: "cf-2",
          name: "Onboarding Workflow",
          description: "User onboarding automation",
          status: "active",
          nodes_count: 12,
          conversations_count: 156,
          last_active_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
          created_at: new Date(
            Date.now() - 1000 * 60 * 60 * 24 * 30
          ).toISOString(),
          updated_at: new Date(
            Date.now() - 1000 * 60 * 60 * 24 * 2
          ).toISOString(),
          deployed_at: new Date(
            Date.now() - 1000 * 60 * 60 * 24 * 25
          ).toISOString(),
        },
      ];

      return {
        stats: dashboardStats,
        recent_activities: fallbackActivities,
        recent_chatbots: fallbackChatbots,
        recent_chatflows: fallbackChatflows,
        recent_knowledge_bases: recentKnowledgeBases, // Real KB data
      };
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);

      // Fallback to mock data if real API fails
      await new Promise((resolve) => setTimeout(resolve, 500));

      const fallbackStats: DashboardStats = {
        total_chatbots: 12,
        total_chatflows: 5,
        total_knowledge_bases: 3, // Fallback value
        total_leads: 347,
        total_conversations: 1842,
        active_conversations: 23,
        chatbots_delta: 12.5,
        chatflows_delta: -5.2,
        knowledge_bases_delta: 8.3,
        leads_delta: 24.7,
        conversations_delta: 15.8,
      };

      // Return fallback data
      return {
        stats: fallbackStats,
        recent_activities: this.getFallbackActivities(),
        recent_chatbots: this.getFallbackChatbots(),
        recent_chatflows: this.getFallbackChatflows(),
        recent_knowledge_bases: this.getFallbackKnowledgeBases(),
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
    const data = await this.getDashboardData(workspaceId, filters);
    return data.stats;
  }

  /**
   * Get recent activities only
   */
  async getActivities(
    workspaceId: string,
    filters?: DashboardFilters,
    limit = 10
  ): Promise<Activity[]> {
    const data = await this.getDashboardData(workspaceId, filters);
    return data.recent_activities.slice(0, limit);
  }

  /**
   * Helper methods for fallback data when APIs are unavailable
   */
  private getFallbackActivities(): Activity[] {
    return [
      {
        id: "act-1",
        type: "chatbot_deployed",
        title: "Customer Support Bot deployed",
        description: "Successfully deployed to production environment",
        resource_type: "chatbot",
        resource_id: "cb-1",
        resource_name: "Customer Support Bot",
        timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
      },
      {
        id: "act-2",
        type: "kb_updated",
        title: "Product Documentation updated",
        description: "Indexed 23 new documents",
        resource_type: "knowledge_base",
        resource_id: "kb-1",
        resource_name: "Product Documentation",
        timestamp: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
      },
    ];
  }

  private getFallbackChatbots(): ChatbotSummary[] {
    return [
      {
        id: "cb-1",
        name: "Customer Support Bot",
        description: "24/7 customer support automation",
        status: "active",
        conversations_count: 342,
        last_active_at: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
        created_at: new Date(
          Date.now() - 1000 * 60 * 60 * 24 * 7
        ).toISOString(),
        updated_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
        deployed_at: new Date(
          Date.now() - 1000 * 60 * 60 * 24 * 3
        ).toISOString(),
      },
    ];
  }

  private getFallbackChatflows(): ChatflowSummary[] {
    return [
      {
        id: "cf-1",
        name: "Sales Qualification Flow",
        description: "Multi-step sales qualification process",
        status: "active",
        nodes_count: 15,
        conversations_count: 89,
        last_active_at: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
        created_at: new Date(
          Date.now() - 1000 * 60 * 60 * 24 * 21
        ).toISOString(),
        updated_at: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
        deployed_at: new Date(
          Date.now() - 1000 * 60 * 60 * 24 * 14
        ).toISOString(),
      },
    ];
  }

  private getFallbackKnowledgeBases(): KnowledgeBaseSummary[] {
    return [
      {
        id: "kb-fallback-1",
        name: "Product Documentation",
        description: "Complete product documentation and guides",
        status: "ready",
        documents_count: 127,
        total_chunks: 3420,
        last_indexed_at: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
        created_at: new Date(
          Date.now() - 1000 * 60 * 60 * 24 * 45
        ).toISOString(),
        updated_at: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
      },
    ];
  }
}

export const dashboardApi = new DashboardApiClient();
