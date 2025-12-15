/**
 * Workspace API Client
 *
 * WHY: Centralized workspace management API calls
 * HOW: Axios-based client with type-safe requests/responses
 *
 * ENDPOINTS:
 * - POST /api/v1/orgs/{org_id}/workspaces - Create workspace in organization
 * - GET /api/v1/workspaces/{workspace_id} - Get workspace details
 * - PUT /api/v1/workspaces/{workspace_id} - Update workspace
 * - DELETE /api/v1/workspaces/{workspace_id} - Delete workspace
 * - POST /api/v1/switch/organization - Switch organization context
 * - POST /api/v1/switch/workspace - Switch workspace context
 * - GET /api/v1/switch/current - Get current context
 */

import axios, { AxiosInstance } from "axios";
import { config } from "@/config/env";
import type {
  Workspace,
  CreateWorkspaceRequest,
  SwitchOrganizationRequest,
  SwitchWorkspaceRequest,
  ContextSwitchResponse,
  CurrentContextResponse,
  WorkspaceMember,
} from "@/types/tenant";

const API_BASE_URL = config.API_BASE_URL;

class WorkspaceApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        "Content-Type": "application/json",
      },
      timeout: 30000,
    });

    // Add auth token to requests
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
          console.error("[WorkspaceAPI] Network error - Backend not reachable");
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Create workspace in organization
   */
  async create(orgId: string, data: CreateWorkspaceRequest): Promise<Workspace> {
    const response = await this.client.post<Workspace>(
      `/orgs/${orgId}/workspaces`,
      data
    );
    return response.data;
  }

  /**
   * Get workspace details
   */
  async get(orgId: string, workspaceId: string): Promise<Workspace> {
    const response = await this.client.get<Workspace>(
      `/orgs/${orgId}/workspaces/${workspaceId}`
    );
    return response.data;
  }

  /**
   * Update workspace
   */
  async update(
    orgId: string,
    workspaceId: string,
    data: Partial<Pick<Workspace, "name" | "description">>
  ): Promise<Workspace> {
    const response = await this.client.put<Workspace>(
      `/orgs/${orgId}/workspaces/${workspaceId}`,
      data
    );
    return response.data;
  }

  /**
   * Delete workspace
   */
  async delete(orgId: string, workspaceId: string): Promise<void> {
    await this.client.delete(`/orgs/${orgId}/workspaces/${workspaceId}`);
  }

  /**
   * Switch organization context (returns new JWT)
   */
  async switchOrganization(data: SwitchOrganizationRequest): Promise<ContextSwitchResponse> {
    const response = await this.client.post<ContextSwitchResponse>(
      "/switch/organization",
      data
    );
    return response.data;
  }

  /**
   * Switch workspace context (returns new JWT)
   */
  async switchWorkspace(data: SwitchWorkspaceRequest): Promise<ContextSwitchResponse> {
    const response = await this.client.post<ContextSwitchResponse>(
      "/switch/workspace",
      data
    );
    return response.data;
  }

  /**
   * Get current context from JWT
   */
  async getCurrentContext(): Promise<CurrentContextResponse> {
    const response = await this.client.get<CurrentContextResponse>("/switch/current");
    return response.data;
  }

  /**
   * Add member to workspace
   */
  async addMember(
    orgId: string,
    workspaceId: string,
    data: { user_id: string; role: string }
  ): Promise<WorkspaceMember> {
    const response = await this.client.post<WorkspaceMember>(
      `/orgs/${orgId}/workspaces/${workspaceId}/members`,
      data
    );
    return response.data;
  }

  /**
   * Update workspace member role
   */
  async updateMemberRole(
    orgId: string,
    workspaceId: string,
    memberId: string,
    role: string
  ): Promise<WorkspaceMember> {
    const response = await this.client.put<WorkspaceMember>(
      `/orgs/${orgId}/workspaces/${workspaceId}/members/${memberId}`,
      { role }
    );
    return response.data;
  }

  /**
   * Remove member from workspace
   */
  async removeMember(
    orgId: string,
    workspaceId: string,
    memberId: string
  ): Promise<void> {
    await this.client.delete(
      `/orgs/${orgId}/workspaces/${workspaceId}/members/${memberId}`
    );
  }
}

export const workspaceApi = new WorkspaceApiClient();
