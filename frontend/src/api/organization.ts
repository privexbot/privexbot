/**
 * Organization API Client
 *
 * WHY: Centralized organization management API calls
 * HOW: Axios-based client with type-safe requests/responses
 *
 * ENDPOINTS:
 * - GET /api/v1/orgs/ - List all organizations user belongs to
 * - POST /api/v1/orgs/ - Create new organization
 * - GET /api/v1/orgs/{org_id} - Get organization details
 * - PUT /api/v1/orgs/{org_id} - Update organization
 * - DELETE /api/v1/orgs/{org_id} - Delete organization
 * - GET /api/v1/orgs/{org_id}/workspaces - Get workspaces in organization
 */

import axios, { AxiosInstance } from "axios";
import { config } from "@/config/env";
import type {
  Organization,
  Workspace,
  CreateOrganizationRequest,
  CreateOrganizationResponse,
  ListOrganizationsResponse,
  OrganizationMember,
} from "@/types/tenant";

const API_BASE_URL = config.API_BASE_URL;

class OrganizationApiClient {
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
          console.error("[OrganizationAPI] Network error - Backend not reachable");
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * List all organizations user belongs to
   */
  async list(page: number = 1, pageSize: number = 20): Promise<ListOrganizationsResponse> {
    const response = await this.client.get<ListOrganizationsResponse>("/orgs/", {
      params: { page, page_size: pageSize },
    });
    return response.data;
  }

  /**
   * Create new organization (with default workspace)
   */
  async create(data: CreateOrganizationRequest): Promise<CreateOrganizationResponse> {
    const response = await this.client.post<CreateOrganizationResponse>("/orgs/", data);
    return response.data;
  }

  /**
   * Get organization details
   */
  async get(orgId: string): Promise<Organization> {
    const response = await this.client.get<Organization>(`/orgs/${orgId}`);
    return response.data;
  }

  /**
   * Update organization
   */
  async update(
    orgId: string,
    data: Partial<Pick<Organization, "name" | "billing_email">>
  ): Promise<Organization> {
    const response = await this.client.put<Organization>(`/orgs/${orgId}`, data);
    return response.data;
  }

  /**
   * Delete organization
   */
  async delete(orgId: string): Promise<void> {
    await this.client.delete(`/orgs/${orgId}`);
  }

  /**
   * Get all workspaces in organization
   */
  async getWorkspaces(orgId: string): Promise<Workspace[]> {
    const response = await this.client.get<{ workspaces: Workspace[], total: number }>(`/orgs/${orgId}/workspaces`);
    return response.data.workspaces; // Extract workspaces array from paginated response
  }

  /**
   * Add member to organization
   */
  async addMember(
    orgId: string,
    data: { user_id: string; role: string }
  ): Promise<OrganizationMember> {
    const response = await this.client.post<OrganizationMember>(
      `/orgs/${orgId}/members`,
      data
    );
    return response.data;
  }

  /**
   * Update organization member role
   */
  async updateMemberRole(
    orgId: string,
    memberId: string,
    role: string
  ): Promise<OrganizationMember> {
    const response = await this.client.put<OrganizationMember>(
      `/orgs/${orgId}/members/${memberId}`,
      { role }
    );
    return response.data;
  }

  /**
   * Remove member from organization
   */
  async removeMember(orgId: string, memberId: string): Promise<void> {
    await this.client.delete(`/orgs/${orgId}/members/${memberId}`);
  }
}

export const organizationApi = new OrganizationApiClient();
