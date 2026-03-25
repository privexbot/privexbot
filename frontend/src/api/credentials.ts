/**
 * Credentials API Client
 *
 * Handles credential management for integrations (Telegram, Discord, etc.)
 */

import apiClient from '@/lib/api-client';

export interface CreateCredentialRequest {
  workspace_id: string;
  name: string;
  credential_type: string;
  provider: string;
  data: Record<string, string>;
}

export interface CredentialResponse {
  credential_id: string;
  name: string;
  credential_type: string;
  provider: string;
  is_active: boolean;
}

export const credentialApi = {
  /**
   * Create a new credential
   */
  create: async (data: CreateCredentialRequest): Promise<CredentialResponse> => {
    const response = await apiClient.post('/credentials/', data);
    return response.data;
  },

  /**
   * List credentials for a workspace
   */
  list: async (workspaceId: string, provider?: string): Promise<CredentialResponse[]> => {
    const params: Record<string, string> = { workspace_id: workspaceId };
    if (provider) {
      params.provider = provider;
    }
    const response = await apiClient.get('/credentials/', { params });
    return response.data.credentials;
  },

  /**
   * Delete a credential
   */
  delete: async (credentialId: string): Promise<void> => {
    await apiClient.delete(`/credentials/${credentialId}`);
  },
};
