export interface Notification {
  id: string;
  event: string;
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean;
  resource_type: string | null;
  resource_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface NotificationListResponse {
  items: Notification[];
  total: number;
  unread_count: number;
}

export interface UnreadCountResponse {
  unread_count: number;
}
