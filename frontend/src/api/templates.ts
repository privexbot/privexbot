/**
 * Marketplace / chatflow templates API client.
 *
 * Mirrors `backend/src/app/api/v1/routes/templates.py`.
 */

import { apiClient } from "@/lib/api-client";

export interface TemplateSummary {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string | null;
  icon: string | null;
  tags: string[];
  use_count: number;
  node_count: number;
  edge_count: number;
}

export interface TemplateDetail extends TemplateSummary {
  config: Record<string, unknown>;
}

export interface CloneResult {
  draft_id: string;
  template_id: string;
  template_name: string;
}

export const templatesApi = {
  async list(category?: string): Promise<TemplateSummary[]> {
    const response = await apiClient.get<TemplateSummary[]>("/templates", {
      params: category ? { category } : undefined,
    });
    return response.data;
  },

  async get(id: string): Promise<TemplateDetail> {
    const response = await apiClient.get<TemplateDetail>(`/templates/${id}`);
    return response.data;
  },

  async clone(id: string, workspaceId: string): Promise<CloneResult> {
    const response = await apiClient.post<CloneResult>(
      `/templates/${id}/clone`,
      { workspace_id: workspaceId },
    );
    return response.data;
  },
};

// ─── Admin (staff-only) ──────────────────────────────────────────────────

export interface AdminTemplate extends TemplateDetail {
  is_public: boolean;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface TemplateCreateInput {
  name: string;
  slug?: string;
  description?: string | null;
  category?: string | null;
  icon?: string | null;
  tags?: string[];
  config: Record<string, unknown>;
  is_public?: boolean;
}

export type TemplateUpdateInput = Partial<TemplateCreateInput>;

export interface PromoteFromChatflowInput {
  chatflow_id: string;
  name?: string;
  slug?: string;
  description?: string | null;
  category?: string | null;
  icon?: string | null;
  tags?: string[];
  is_public?: boolean;
}

export const adminTemplatesApi = {
  async list(): Promise<AdminTemplate[]> {
    const response = await apiClient.get<AdminTemplate[]>("/templates/admin");
    return response.data;
  },

  async create(body: TemplateCreateInput): Promise<AdminTemplate> {
    const response = await apiClient.post<AdminTemplate>("/templates/admin", body);
    return response.data;
  },

  async promoteFromChatflow(body: PromoteFromChatflowInput): Promise<AdminTemplate> {
    const response = await apiClient.post<AdminTemplate>(
      "/templates/admin/from-chatflow",
      body,
    );
    return response.data;
  },

  async update(id: string, body: TemplateUpdateInput): Promise<AdminTemplate> {
    const response = await apiClient.patch<AdminTemplate>(`/templates/admin/${id}`, body);
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/templates/admin/${id}`);
  },
};
