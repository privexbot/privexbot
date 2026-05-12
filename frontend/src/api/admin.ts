/**
 * Admin API Client - Staff-only backoffice endpoints
 *
 * WHY: Centralized API calls for admin/backoffice functionality
 * HOW: Uses apiClient with proper typing
 */

import apiClient from "@/lib/api-client";
import type { AggregatedAnalytics } from "@/types/analytics";
import type { PlanCard, PlanStatus } from "@/api/billing";

// ============== Types ==============

export interface SystemStats {
  total_users: number;
  total_organizations: number;
  total_workspaces: number;
  total_chatbots: number;
  total_chatflows: number;
  total_knowledge_bases: number;
  active_users_7d: number;
  new_users_7d: number;
  new_users_30d: number;
  new_organizations_7d: number;
}

export interface OrganizationListItem {
  id: string;
  name: string;
  billing_email?: string;
  subscription_tier?: string;
  subscription_status?: string;
  created_at?: string;
  member_count: number;
  workspace_count: number;
}

export interface OrganizationListResponse {
  items: OrganizationListItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface WorkspaceDetail {
  id: string;
  name: string;
  is_default: boolean;
  created_at?: string;
  chatbot_count: number;
  chatflow_count: number;
  kb_count: number;
}

export interface OrgMemberDetail {
  user_id: string;
  username: string;
  role: string;
  is_active: boolean;
  joined_at?: string;
}

export interface OrganizationDetail {
  id: string;
  name: string;
  billing_email?: string;
  subscription_tier?: string;
  subscription_status?: string;
  created_at?: string;
  settings?: Record<string, unknown>;
  workspaces: WorkspaceDetail[];
  members: OrgMemberDetail[];
}

export interface UserListItem {
  id: string;
  username: string;
  email?: string;
  is_active: boolean;
  is_staff: boolean;
  created_at?: string;
  organization_count: number;
}

export interface UserListResponse {
  items: UserListItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface AuthMethodDetail {
  provider: string;
  identifier: string;
  created_at?: string;
}

export interface UserOrgMembership {
  id: string;
  name: string;
  role: string;
  joined_at?: string;
  subscription_tier?: string;
  subscription_status?: string;
}

export interface UserWorkspaceMembership {
  id: string;
  name: string;
  organization_id: string;
  role: string;
}

export interface UserDetail {
  id: string;
  username: string;
  is_active: boolean;
  is_staff: boolean;
  created_at?: string;
  updated_at?: string;
  auth_methods: AuthMethodDetail[];
  organizations: UserOrgMembership[];
  workspaces: UserWorkspaceMembership[];
}

export interface ResourceItem {
  id: string;
  name: string;
  status?: string;
  workspace_id: string;
  created_at?: string;
}

export interface ResourceTotals {
  chatbots: number;
  chatflows: number;
  knowledge_bases: number;
}

export interface UserResources {
  user_id: string;
  chatbots: ResourceItem[];
  chatflows: ResourceItem[];
  knowledge_bases: ResourceItem[];
  totals: ResourceTotals;
}

export interface UpdateStaffStatusResponse {
  user_id: string;
  username: string;
  is_staff: boolean;
  message: string;
}

// Invite Code Types
export interface GenerateInviteCodeRequest {
  ttl_days?: number;
}

export interface GenerateInviteCodeResponse {
  code: string;
  created_at: string;
  expires_at: string;
  message: string;
}

export interface InviteCodeInfo {
  code: string;
  created_by: string;
  created_at: string;
  expires_at: string;
  ttl_seconds: number;
  is_redeemed: boolean;
  redeemed_by?: string;
  redeemed_at?: string;
}

// Business Analytics Types — mirror the payload from
// `services/business_analytics_service.get_business_overview`.
export interface BusinessMrr {
  mrr_usd: number;
  arr_usd: number;
  by_tier: Record<string, { count: number; mrr_usd: number }>;
  total_active_paid_orgs: number;
}

export interface BusinessActiveByTier {
  days: number;
  by_tier: Record<string, number>;
  total_active_orgs: number;
}

export interface BusinessConversionEntry {
  week: string;
  signups: number;
  converted: number;
  rate: number;
}

export interface BusinessConversion {
  weeks: number;
  series: BusinessConversionEntry[];
}

export interface BusinessSoftDegrade {
  days: number;
  orgs_at_or_over_120_percent: number;
  threshold: number;
}

export interface BusinessTopOrg {
  org_id: string;
  name: string;
  tier: string;
  status: string;
  messages_this_month: number;
}

export interface BusinessTopOrgs {
  top: BusinessTopOrg[];
  n: number;
}

export interface BusinessChurn {
  available: boolean;
  message?: string;
  days: number;
  downgrades: number;
}

export interface BusinessAnalytics {
  mrr: BusinessMrr;
  active_by_tier: BusinessActiveByTier;
  conversion: BusinessConversion;
  soft_degrade: BusinessSoftDegrade;
  top_orgs: BusinessTopOrgs;
  churn: BusinessChurn;
  generated_at: string;
}

// ============== API Functions ==============

export const adminApi = {
  /**
   * Get system-wide statistics
   */
  getStats: async (): Promise<SystemStats> => {
    const response = await apiClient.get<SystemStats>("/admin/stats");
    return response.data;
  },

  /**
   * List all organizations
   */
  listOrganizations: async (params?: {
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<OrganizationListResponse> => {
    const response = await apiClient.get<OrganizationListResponse>("/admin/organizations", {
      params,
    });
    return response.data;
  },

  /**
   * Get organization details
   */
  getOrganization: async (orgId: string): Promise<OrganizationDetail> => {
    const response = await apiClient.get<OrganizationDetail>(`/admin/organizations/${orgId}`);
    return response.data;
  },

  /**
   * List/search users
   */
  listUsers: async (params?: {
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<UserListResponse> => {
    const response = await apiClient.get<UserListResponse>("/admin/users", {
      params,
    });
    return response.data;
  },

  /**
   * Get user details
   */
  getUser: async (userId: string): Promise<UserDetail> => {
    const response = await apiClient.get<UserDetail>(`/admin/users/${userId}`);
    return response.data;
  },

  /**
   * Get user's resources (chatbots, chatflows, KBs)
   */
  getUserResources: async (userId: string): Promise<UserResources> => {
    const response = await apiClient.get<UserResources>(`/admin/users/${userId}/resources`);
    return response.data;
  },

  /**
   * Update user's staff status
   */
  updateStaffStatus: async (
    userId: string,
    isStaff: boolean
  ): Promise<UpdateStaffStatusResponse> => {
    const response = await apiClient.patch<UpdateStaffStatusResponse>(
      `/admin/users/${userId}/staff`,
      { is_staff: isStaff }
    );
    return response.data;
  },

  // ============== Invite Code Methods ==============

  /**
   * Generate a new invite code
   */
  generateInviteCode: async (
    ttlDays?: number
  ): Promise<GenerateInviteCodeResponse> => {
    const response = await apiClient.post<GenerateInviteCodeResponse>(
      "/admin/invite-codes",
      ttlDays ? { ttl_days: ttlDays } : undefined
    );
    return response.data;
  },

  /**
   * List all active invite codes
   */
  listInviteCodes: async (): Promise<InviteCodeInfo[]> => {
    const response = await apiClient.get<InviteCodeInfo[]>("/admin/invite-codes");
    return response.data;
  },

  /**
   * Revoke an invite code
   */
  revokeInviteCode: async (code: string): Promise<void> => {
    await apiClient.delete(`/admin/invite-codes/${code}`);
  },

  // ============== Analytics Methods ==============

  /**
   * Get platform-wide analytics (staff-only)
   */
  getPlatformAnalytics: async (days: number = 7): Promise<AggregatedAnalytics> => {
    const response = await apiClient.get<AggregatedAnalytics>("/admin/analytics", {
      params: { days },
    });
    return response.data;
  },

  /**
   * Get business / revenue analytics: MRR, ARR, active orgs by tier,
   * weekly conversion-rate cohorts, soft-degrade hits, top-N orgs,
   * churn placeholder. Sibling to `/admin/analytics` which covers
   * bot-performance metrics. Staff-only.
   */
  getBusinessAnalytics: async (): Promise<BusinessAnalytics> => {
    const response = await apiClient.get<BusinessAnalytics>(
      "/admin/analytics/business",
    );
    return response.data;
  },

  /**
   * Read an organization's current plan + live usage (staff-only).
   * Mirrors `GET /billing/plan` but for any org id.
   */
  getOrgPlan: async (orgId: string): Promise<PlanStatus> => {
    const response = await apiClient.get<PlanStatus>(
      `/admin/orgs/${orgId}/plan`,
    );
    return response.data;
  },

  /**
   * Upgrade (or downgrade) an organization's plan tier (staff-only).
   * Returns the updated plan status (same shape as /billing/plan).
   */
  upgradeOrgPlan: async (orgId: string, tier: string): Promise<PlanStatus> => {
    const response = await apiClient.post<PlanStatus>(
      `/admin/orgs/${orgId}/plan`,
      { tier },
    );
    return response.data;
  },

  /**
   * Public list of all plan tiers (label, price, tagline, limits).
   * Re-exported via the admin client so the org-detail page only depends
   * on one client; the underlying endpoint is `/billing/public-plans`.
   */
  listPlans: async (): Promise<PlanCard[]> => {
    const response = await apiClient.get<PlanCard[]>("/billing/public-plans");
    return response.data;
  },

  /**
   * Per-provider OAuth redirect URIs + which env vars are populated.
   * Used by the AdminDashboard "OAuth setup" card so operators can copy
   * the exact URI to register in Google / Notion / Calendly / Slack /
   * Discord developer consoles.
   */
  getOAuthRedirectUris: async (): Promise<OAuthRedirectUrisResponse> => {
    const response = await apiClient.get<OAuthRedirectUrisResponse>(
      "/admin/oauth/redirect-uris",
    );
    return response.data;
  },
};

export interface OAuthProviderInfo {
  provider: string;
  label: string;
  redirect_uri: string;
  console_url: string;
  configured: boolean;
  env_var: string;
}

export interface OAuthRedirectUrisResponse {
  providers: OAuthProviderInfo[];
  configured_providers: string[];
  missing_providers: string[];
}

export default adminApi;
