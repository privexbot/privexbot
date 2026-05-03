import { create } from "zustand";
import { devtools, subscribeWithSelector } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import type { Notification } from "@/types/notification";
import { notificationsApi } from "@/api/notifications";

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  total: number;
  isLoading: boolean;
  pollingInterval: ReturnType<typeof setInterval> | null;
  // Active workspace filter applied to subsequent fetches. Set this when the
  // user switches workspaces so the dropdown doesn't show events from other
  // workspaces (server-side enforcement is in notification_service.py).
  workspaceId: string | null;
}

interface NotificationActions {
  fetchNotifications: (limit?: number) => Promise<void>;
  fetchUnreadCount: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  startPolling: () => void;
  stopPolling: () => void;
  setWorkspaceId: (workspaceId: string | null) => void;
}

export const useNotificationStore = create<
  NotificationState & NotificationActions
>()(
  devtools(
    subscribeWithSelector(
      immer((set, get) => ({
        // Initial state
        notifications: [],
        unreadCount: 0,
        total: 0,
        isLoading: false,
        pollingInterval: null,
        workspaceId: null,

        fetchNotifications: async (limit = 20) => {
          set((state) => {
            state.isLoading = true;
          });
          try {
            const workspaceId = get().workspaceId;
            const data = await notificationsApi.list({
              limit,
              ...(workspaceId ? { workspace_id: workspaceId } : {}),
            });
            set((state) => {
              state.notifications = data.items;
              state.total = data.total;
              state.unreadCount = data.unread_count;
              state.isLoading = false;
            });
          } catch {
            set((state) => {
              state.isLoading = false;
            });
          }
        },

        fetchUnreadCount: async () => {
          // Skip if not authenticated — prevents 401 spam on public pages
          if (!localStorage.getItem("access_token")) return;

          try {
            const workspaceId = get().workspaceId;
            const data = await notificationsApi.getUnreadCount(
              workspaceId ? { workspace_id: workspaceId } : undefined,
            );
            set((state) => {
              state.unreadCount = data.unread_count;
            });
          } catch {
            // Silently ignore — polling should not disrupt UX
          }
        },

        markAsRead: async (id: string) => {
          // Optimistic update
          set((state) => {
            const notif = state.notifications.find((n) => n.id === id);
            if (notif && !notif.is_read) {
              notif.is_read = true;
              state.unreadCount = Math.max(0, state.unreadCount - 1);
            }
          });
          try {
            await notificationsApi.markAsRead(id);
          } catch {
            // Revert on failure by re-fetching
            get().fetchUnreadCount();
          }
        },

        markAllAsRead: async () => {
          const prevCount = get().unreadCount;
          // Optimistic update
          set((state) => {
            state.notifications.forEach((n) => {
              n.is_read = true;
            });
            state.unreadCount = 0;
          });
          try {
            await notificationsApi.markAllAsRead();
          } catch {
            // Revert
            set((state) => {
              state.unreadCount = prevCount;
            });
            get().fetchNotifications();
          }
        },

        startPolling: () => {
          const existing = get().pollingInterval;
          if (existing) return; // Already polling

          // Fetch immediately
          get().fetchUnreadCount();

          const interval = setInterval(() => {
            get().fetchUnreadCount();
          }, 30_000);

          set((state) => {
            state.pollingInterval = interval;
          });
        },

        stopPolling: () => {
          const interval = get().pollingInterval;
          if (interval) {
            clearInterval(interval);
            set((state) => {
              state.pollingInterval = null;
            });
          }
        },

        setWorkspaceId: (workspaceId: string | null) => {
          if (get().workspaceId === workspaceId) return;
          set((state) => {
            state.workspaceId = workspaceId;
            // Reset cached items so the dropdown does not flash stale rows
            // from the previous workspace before the next fetch lands.
            state.notifications = [];
            state.total = 0;
            state.unreadCount = 0;
          });
          // Refetch with the new filter. fetchNotifications already guards
          // for unauth, but the count fetch we call from elsewhere also
          // checks; calling them sequentially is fine.
          get().fetchNotifications();
          get().fetchUnreadCount();
        },
      }))
    ),
    { name: "notification-store" }
  )
);
