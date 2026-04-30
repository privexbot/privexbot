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
  kb_documents: number;
  messages_per_month: number;
  api_calls_per_month: number;
  team_members: number;
}

export interface BillingUsage {
  chatbots: number;
  chatflows: number;
  kb_documents: number;
  messages_this_month: number;
  api_calls_this_month: number;
  team_members: number;
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
}

export interface PlanCard {
  tier: BillingTier;
  label: string;
  price_monthly_usd: number | null;
  tagline: string;
  limits: BillingLimits;
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
