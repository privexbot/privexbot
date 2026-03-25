/**
 * Beta Access API Client
 *
 * WHY: Centralized API calls for beta access functionality
 * HOW: Uses apiClient with proper typing
 */

import apiClient from "@/lib/api-client";

// ============== Types ==============

export interface BetaStatusResponse {
  has_access: boolean;
  is_staff: boolean;
  message: string;
}

export interface RedeemCodeRequest {
  code: string;
}

export interface RedeemCodeResponse {
  success: boolean;
  message: string;
}

// ============== API Functions ==============

export const betaApi = {
  /**
   * Check if current user has beta access
   */
  getStatus: async (): Promise<BetaStatusResponse> => {
    const response = await apiClient.get<BetaStatusResponse>("/beta/status");
    return response.data;
  },

  /**
   * Redeem an invite code to gain beta access
   */
  redeemCode: async (code: string): Promise<RedeemCodeResponse> => {
    const response = await apiClient.post<RedeemCodeResponse>("/beta/redeem", {
      code,
    });
    return response.data;
  },
};

export default betaApi;
