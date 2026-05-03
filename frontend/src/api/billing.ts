/**
 * Billing API client.
 *
 * Mirrors `backend/src/app/api/v1/routes/billing.py`.
 */

import { apiClient } from "@/lib/api-client";

export type BillingTier = "free" | "starter" | "pro" | "enterprise";

export interface BillingLimits {
  chatbots: number;
  chatflows: number;
  knowledge_bases: number;
  kb_documents: number;
  web_pages_per_month: number;
  messages_per_month: number;
  api_calls_per_month: number;
  team_members: number;
  workspaces: number;
}

export interface BillingUsage {
  chatbots: number;
  chatflows: number;
  knowledge_bases: number;
  kb_documents: number;
  web_pages_this_month: number;
  messages_this_month: number;
  api_calls_this_month: number;
  team_members: number;
  workspaces: number;
}

/**
 * Feature gates per tier — booleans + a few categoricals (audit retention
 * days, support tier). Mirrors `core/plans.py:PLAN_FEATURES`.
 */
export interface PlanFeatures {
  channel_website: boolean;
  channel_telegram: boolean;
  channel_discord: boolean;
  channel_slack: boolean;
  channel_zapier: boolean;
  channel_whatsapp: boolean;
  kb_file_upload: boolean;
  kb_text_input: boolean;
  kb_google_drive: boolean;
  kb_notion: boolean;
  kb_web_scraping: boolean;
  public_api_access: boolean;
  marketplace_clone: boolean;
  tee_confidential_inference: boolean;
  custom_domain: boolean;
  remove_branding: boolean;
  sso_saml: boolean;
  audit_log_retention_days: number;
  priority_support: string;
  inactivity_suspend_days: number;
}

export interface PlanBreakdownEntry {
  usage: number;
  limit: number;
  unlimited: boolean;
  percent_used: number | null;
}

export interface PlanStatus {
  tier: BillingTier;
  label: string;
  status: string;
  trial_ends_at: string | null;
  subscription_starts_at: string | null;
  subscription_ends_at: string | null;
  limits: BillingLimits;
  usage: BillingUsage;
  breakdown: Record<keyof BillingLimits, PlanBreakdownEntry>;
  /**
   * Account-level limits — per USER (across all orgs they own), NOT per
   * org. Currently just `owned_orgs`; the per-org tier on each org may
   * differ from `tier` here (which reflects the user's highest-tier
   * owned org).
   */
  account?: {
    tier: BillingTier;
    owned_orgs: PlanBreakdownEntry;
  };
}

export interface PlanCard {
  tier: BillingTier;
  label: string;
  price_monthly_usd: number | null;
  price_annual_usd?: number | null;
  tagline: string;
  best_for?: string;
  cta_label?: string;
  highlight?: boolean;
  annual_discount?: number;
  limits: BillingLimits;
  features?: PlanFeatures;
}

export const billingApi = {
  async getPlan(): Promise<PlanStatus> {
    const response = await apiClient.get<PlanStatus>("/billing/plan");
    return response.data;
  },

  async listPlans(): Promise<PlanCard[]> {
    const response = await apiClient.get<PlanCard[]>("/billing/plans");
    return response.data;
  },

  // Public — used by the marketing pricing page so it stays in sync with
  // backend `core/plans.py` without hardcoded values.
  async listPublicPlans(): Promise<PlanCard[]> {
    const response = await apiClient.get<PlanCard[]>("/billing/public-plans");
    return response.data;
  },

  async getUsage(): Promise<BillingUsage> {
    const response = await apiClient.get<BillingUsage>("/billing/usage");
    return response.data;
  },

  async upgrade(tier: BillingTier): Promise<PlanStatus> {
    const response = await apiClient.post<PlanStatus>("/billing/upgrade", {
      tier,
    });
    return response.data;
  },
};
