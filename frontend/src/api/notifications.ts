import { apiClient } from "@/lib/api-client";
import type {
  NotificationListResponse,
  UnreadCountResponse,
} from "@/types/notification";

export const notificationsApi = {
  async list(params?: {
    limit?: number;
    offset?: number;
    unread_only?: boolean;
    workspace_id?: string;
  }): Promise<NotificationListResponse> {
    const response = await apiClient.get<NotificationListResponse>(
      "/notifications",
      { params }
    );
    return response.data;
  },

  async getUnreadCount(params?: {
    workspace_id?: string;
  }): Promise<UnreadCountResponse> {
    const response = await apiClient.get<UnreadCountResponse>(
      "/notifications/count",
      { params }
    );
    return response.data;
  },

  async markAsRead(id: string): Promise<void> {
    await apiClient.put(`/notifications/${id}/read`);
  },

  async markAllAsRead(): Promise<void> {
    await apiClient.put("/notifications/read-all");
  },
};
