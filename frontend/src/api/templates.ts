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
