/**
 * Invitation API Client
 *
 * WHY: Centralized invitation management API calls
 * HOW: Axios-based client with type-safe requests/responses
 *
 * ENDPOINTS:
 * Organization Invitations:
 * - POST /api/v1/orgs/{org_id}/invitations - Create organization invitation
 * - GET /api/v1/orgs/{org_id}/invitations - List organization invitations
 * - DELETE /api/v1/orgs/{org_id}/invitations/{inv_id} - Cancel invitation
 * - POST /api/v1/orgs/{org_id}/invitations/{inv_id}/resend - Resend invitation
 *
 * Workspace Invitations:
 * - POST /api/v1/orgs/{org_id}/workspaces/{ws_id}/invitations - Create workspace invitation
 * - GET /api/v1/orgs/{org_id}/workspaces/{ws_id}/invitations - List workspace invitations
 * - DELETE /api/v1/orgs/{org_id}/workspaces/{ws_id}/invitations/{inv_id} - Cancel invitation
 * - POST /api/v1/orgs/{org_id}/workspaces/{ws_id}/invitations/{inv_id}/resend - Resend invitation
 *
 * Public Endpoints:
 * - GET /api/v1/invitations/details?token={token} - Get invitation details
 * - POST /api/v1/invitations/accept?token={token} - Accept invitation
 * - POST /api/v1/invitations/reject?token={token} - Reject invitation
 */

import axios, { AxiosInstance } from "axios";
import { config } from "@/config/env";
import type {
  Invitation,
  InvitationDetails,
  CreateInvitationRequest,
} from "@/types/tenant";

const API_BASE_URL = config.API_BASE_URL;

class InvitationApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        "Content-Type": "application/json",
      },
      timeout: 30000,
    });

    // Add auth token to requests (except public endpoints)
    this.client.interceptors.request.use((config) => {
      const token = localStorage.getItem("access_token");
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Error handling interceptor
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.code === "ERR_NETWORK") {
          console.error("[InvitationAPI] Network error - Backend not reachable");
        }
        return Promise.reject(error);
      }
    );
  }

  // ============================================================================
  // ORGANIZATION INVITATIONS
  // ============================================================================

  /**
   * Create an organization invitation
   */
  async createOrganizationInvitation(
    orgId: string,
    email: string,
    role: string
  ): Promise<Invitation> {
    const data: CreateInvitationRequest = {
      email,
      resource_type: "organization",
      resource_id: orgId,
      role,
    };
    const response = await this.client.post<Invitation>(
      `/orgs/${orgId}/invitations`,
      data
    );
    return response.data;
  }

  /**
   * List organization invitations
   */
  async listOrganizationInvitations(
    orgId: string,
    statusFilter?: string
  ): Promise<Invitation[]> {
    const params = statusFilter ? { status_filter: statusFilter } : {};
    const response = await this.client.get<Invitation[]>(
      `/orgs/${orgId}/invitations`,
      { params }
    );
    return response.data;
  }

  /**
   * Cancel an organization invitation
   */
  async cancelOrganizationInvitation(
    orgId: string,
    invitationId: string
  ): Promise<void> {
    await this.client.delete(`/orgs/${orgId}/invitations/${invitationId}`);
  }

  /**
   * Resend an organization invitation
   */
  async resendOrganizationInvitation(
    orgId: string,
    invitationId: string
  ): Promise<Invitation> {
    const response = await this.client.post<Invitation>(
      `/orgs/${orgId}/invitations/${invitationId}/resend`
    );
    return response.data;
  }

  // ============================================================================
  // WORKSPACE INVITATIONS
  // ============================================================================

  /**
   * Create a workspace invitation
   */
  async createWorkspaceInvitation(
    orgId: string,
    workspaceId: string,
    email: string,
    role: string
  ): Promise<Invitation> {
    const data: CreateInvitationRequest = {
      email,
      resource_type: "workspace",
      resource_id: workspaceId,
      role,
    };
    const response = await this.client.post<Invitation>(
      `/orgs/${orgId}/workspaces/${workspaceId}/invitations`,
      data
    );
    return response.data;
  }

  /**
   * List workspace invitations
   */
  async listWorkspaceInvitations(
    orgId: string,
    workspaceId: string,
    statusFilter?: string
  ): Promise<Invitation[]> {
    const params = statusFilter ? { status_filter: statusFilter } : {};
    const response = await this.client.get<Invitation[]>(
      `/orgs/${orgId}/workspaces/${workspaceId}/invitations`,
      { params }
    );
    return response.data;
  }

  /**
   * Cancel a workspace invitation
   */
  async cancelWorkspaceInvitation(
    orgId: string,
    workspaceId: string,
    invitationId: string
  ): Promise<void> {
    await this.client.delete(
      `/orgs/${orgId}/workspaces/${workspaceId}/invitations/${invitationId}`
    );
  }

  /**
   * Resend a workspace invitation
   */
  async resendWorkspaceInvitation(
    orgId: string,
    workspaceId: string,
    invitationId: string
  ): Promise<Invitation> {
    const response = await this.client.post<Invitation>(
      `/orgs/${orgId}/workspaces/${workspaceId}/invitations/${invitationId}/resend`
    );
    return response.data;
  }

  // ============================================================================
  // PUBLIC ENDPOINTS (No Authentication Required)
  // ============================================================================

  /**
   * Get invitation details by token (public endpoint)
   */
  async getInvitationDetails(token: string): Promise<InvitationDetails> {
    const response = await this.client.get<InvitationDetails>(
      `/invitations/details`,
      { params: { token } }
    );
    return response.data;
  }

  /**
   * Accept an invitation (requires authentication)
   */
  async acceptInvitation(token: string): Promise<Invitation> {
    const response = await this.client.post<Invitation>(
      `/invitations/accept`,
      null,
      { params: { token } }
    );
    return response.data;
  }

  /**
   * Reject an invitation (public endpoint)
   */
  async rejectInvitation(token: string): Promise<Invitation> {
    const response = await this.client.post<Invitation>(
      `/invitations/reject`,
      null,
      { params: { token } }
    );
    return response.data;
  }
}

// Export singleton instance
export const invitationApi = new InvitationApiClient();
