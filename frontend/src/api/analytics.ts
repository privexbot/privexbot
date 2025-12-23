/**
 * Analytics API Client
 *
 * WHY: Fetch aggregated analytics for performance and cost metrics
 * HOW: Call backend /api/v1/analytics endpoint
 *
 * ENDPOINTS:
 * - GET /analytics - Get aggregated analytics with scope filter
 */

import { apiClient } from "@/lib/api-client";
import type {
  AnalyticsFilters,
  AggregatedAnalytics,
  AnalyticsTimeRange,
} from "@/types/analytics";

/**
 * Analytics API client for dashboard metrics
 */
class AnalyticsApiClient {
  /**
   * Get aggregated analytics for workspace or organization
   *
   * @param filters - Query filters (scope, workspace_id, organization_id, days)
   * @returns AggregatedAnalytics with performance and cost metrics
   */
  async getAggregatedAnalytics(
    filters: AnalyticsFilters
  ): Promise<AggregatedAnalytics> {
    const params: Record<string, string | number> = {
      scope: filters.scope,
      days: filters.days,
    };

    if (filters.scope === "workspace" && filters.workspace_id) {
      params.workspace_id = filters.workspace_id;
    }

    if (filters.scope === "organization" && filters.organization_id) {
      params.organization_id = filters.organization_id;
    }

    const response = await apiClient.get<AggregatedAnalytics>("/analytics", {
      params,
    });

    return response.data;
  }

  /**
   * Get workspace analytics (convenience method)
   */
  async getWorkspaceAnalytics(
    workspaceId: string,
    days: AnalyticsTimeRange = 7
  ): Promise<AggregatedAnalytics> {
    return this.getAggregatedAnalytics({
      scope: "workspace",
      workspace_id: workspaceId,
      days,
    });
  }

  /**
   * Get organization analytics (convenience method)
   */
  async getOrganizationAnalytics(
    organizationId: string,
    days: AnalyticsTimeRange = 7
  ): Promise<AggregatedAnalytics> {
    return this.getAggregatedAnalytics({
      scope: "organization",
      organization_id: organizationId,
      days,
    });
  }
}

export const analyticsApi = new AnalyticsApiClient();
