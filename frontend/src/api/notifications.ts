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
  }): Promise<NotificationListResponse> {
    const response = await apiClient.get<NotificationListResponse>(
      "/notifications",
      { params }
    );
    return response.data;
  },

  async getUnreadCount(): Promise<UnreadCountResponse> {
    const response = await apiClient.get<UnreadCountResponse>(
      "/notifications/count"
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
