/**
 * Referrals API client.
 *
 * Mirrors `backend/src/app/api/v1/routes/referrals.py`.
 */

import { apiClient } from "@/lib/api-client";

export interface ReferralSummary {
  code: string;
  share_url: string;
  total_invites: number;
  pending: number;
  registered: number;
  converted: number;
}

export type ReferralStatus = "pending" | "registered" | "converted";

export interface ReferralRow {
  id: string;
  status: ReferralStatus;
  email: string | null;
  referred_username: string | null;
  created_at: string | null;
  converted_at: string | null;
}

export const referralsApi = {
  async getMine(): Promise<ReferralSummary> {
    const response = await apiClient.get<ReferralSummary>("/referrals/me");
    return response.data;
  },

  async list(): Promise<{ items: ReferralRow[]; total: number }> {
    const response = await apiClient.get<{ items: ReferralRow[]; total: number }>(
      "/referrals/list",
    );
    return response.data;
  },
};
