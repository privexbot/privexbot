/**
 * Inference API client — model discovery for the frontend <ModelSelector>.
 *
 * Mirrors `backend/src/app/api/v1/routes/inference.py`. The list comes from
 * `Secret().get_models()` server-side, with Redis-backed caching, so this
 * client just needs to fetch and surface — no client-side caching beyond
 * what React Query's staleTime provides.
 */

import { apiClient } from "@/lib/api-client";

export interface ModelsResponse {
  /** Model IDs the user can pick. May be empty when the SDK is unreachable. */
  models: string[];
  /** True when the response came from the server-side Redis cache. */
  cached: boolean;
  /** ISO-8601 timestamp of when the list was last fetched from the SDK. */
  as_of: string;
}

export const inferenceApi = {
  async listModels(): Promise<ModelsResponse> {
    const response = await apiClient.get<ModelsResponse>("/inference/models");
    return response.data;
  },
};
