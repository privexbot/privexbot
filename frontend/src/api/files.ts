/**
 * Files API Client - Avatar upload/delete operations
 *
 * Uses the backend /files/avatars endpoints with FormData for file upload.
 */

import { apiClient } from "@/lib/api-client";

export type AvatarEntityType = "users" | "orgs" | "workspaces" | "chatbots";

interface AvatarUploadResponse {
  avatar_url: string;
}

export const filesApi = {
  /**
   * Upload an avatar image for an entity.
   * Backend validates: JPEG/PNG/WebP/GIF, max 2MB, python-magic MIME check.
   */
  async uploadAvatar(
    entityType: AvatarEntityType,
    entityId: string,
    file: File
  ): Promise<AvatarUploadResponse> {
    const formData = new FormData();
    formData.append("file", file);

    const response = await apiClient.post<AvatarUploadResponse>(
      `/files/avatars/${entityType}/${entityId}`,
      formData,
      { headers: { "Content-Type": "multipart/form-data" } }
    );
    return response.data;
  },

  /**
   * Delete the avatar for an entity, resetting to default/initials fallback.
   */
  async deleteAvatar(
    entityType: AvatarEntityType,
    entityId: string
  ): Promise<void> {
    await apiClient.delete(`/files/avatars/${entityType}/${entityId}`);
  },
};
