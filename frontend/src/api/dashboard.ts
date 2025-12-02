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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { apiClient } from "@/lib/api-client";
import type {
  DashboardData,
  DashboardStats,
  Activity,
  ChatbotSummary,
  ChatflowSummary,
  KnowledgeBaseSummary,
  DashboardFilters,
} from "@/types/dashboard";

class DashboardApiClient {
  /**
   * Get complete dashboard data
   * MOCK: Returns mock data until backend is implemented
   */
  async getDashboardData(
    _organizationId: string,
    _workspaceId: string,
    _filters?: DashboardFilters
  ): Promise<DashboardData> {
    // TODO: Replace with actual API call when backend is ready
    // return apiClient.get(`/orgs/${organizationId}/workspaces/${workspaceId}/dashboard`, { params: filters }).then(res => res.data);

    // MOCK DATA
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate API delay

    const mockStats: DashboardStats = {
      total_chatbots: 12,
      total_chatflows: 5,
      total_knowledge_bases: 8,
      total_leads: 347,
      total_conversations: 1842,
      active_conversations: 23,
      chatbots_delta: 12.5,
      chatflows_delta: -5.2,
      knowledge_bases_delta: 8.3,
      leads_delta: 24.7,
      conversations_delta: 15.8,
    };

    const mockActivities: Activity[] = [
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

    const mockChatbots: ChatbotSummary[] = [
      {
        id: "cb-1",
        name: "Customer Support Bot",
        description: "24/7 customer support automation",
        status: "active",
        conversations_count: 342,
        last_active_at: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
        created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
        updated_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
        deployed_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
      },
      {
        id: "cb-2",
        name: "Lead Qualification Bot",
        description: "Qualify leads before sales handoff",
        status: "active",
        conversations_count: 128,
        last_active_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
        created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 14).toISOString(),
        updated_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
        deployed_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString(),
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

    const mockChatflows: ChatflowSummary[] = [
      {
        id: "cf-1",
        name: "Sales Qualification Flow",
        description: "Multi-step sales qualification process",
        status: "active",
        nodes_count: 15,
        conversations_count: 89,
        last_active_at: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
        created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 21).toISOString(),
        updated_at: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
        deployed_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 14).toISOString(),
      },
      {
        id: "cf-2",
        name: "Onboarding Workflow",
        description: "User onboarding automation",
        status: "active",
        nodes_count: 12,
        conversations_count: 156,
        last_active_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
        created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
        updated_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
        deployed_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 25).toISOString(),
      },
    ];

    const mockKnowledgeBases: KnowledgeBaseSummary[] = [
      {
        id: "kb-1",
        name: "Product Documentation",
        description: "Complete product documentation and guides",
        status: "active",
        documents_count: 127,
        total_chunks: 3420,
        last_indexed_at: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
        created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 45).toISOString(),
        updated_at: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
      },
      {
        id: "kb-2",
        name: "Internal Wiki",
        description: "Company internal knowledge base",
        status: "active",
        documents_count: 89,
        total_chunks: 2156,
        last_indexed_at: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
        created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60).toISOString(),
        updated_at: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
      },
      {
        id: "kb-3",
        name: "Customer FAQs",
        description: "Frequently asked questions database",
        status: "active",
        documents_count: 45,
        total_chunks: 892,
        last_indexed_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
        created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 90).toISOString(),
        updated_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
      },
    ];

    return {
      stats: mockStats,
      recent_activities: mockActivities,
      recent_chatbots: mockChatbots,
      recent_chatflows: mockChatflows,
      recent_knowledge_bases: mockKnowledgeBases,
    };
  }

  /**
   * Get dashboard statistics only
   */
  async getStats(
    organizationId: string,
    workspaceId: string,
    filters?: DashboardFilters
  ): Promise<DashboardStats> {
    const data = await this.getDashboardData(organizationId, workspaceId, filters);
    return data.stats;
  }

  /**
   * Get recent activities only
   */
  async getActivities(
    organizationId: string,
    workspaceId: string,
    limit = 10
  ): Promise<Activity[]> {
    const data = await this.getDashboardData(organizationId, workspaceId);
    return data.recent_activities.slice(0, limit);
  }
}

export const dashboardApi = new DashboardApiClient();
