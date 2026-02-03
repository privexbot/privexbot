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
}

interface NotificationActions {
  fetchNotifications: (limit?: number) => Promise<void>;
  fetchUnreadCount: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  startPolling: () => void;
  stopPolling: () => void;
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

        fetchNotifications: async (limit = 20) => {
          set((state) => {
            state.isLoading = true;
          });
          try {
            const data = await notificationsApi.list({ limit });
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
          try {
            const data = await notificationsApi.getUnreadCount();
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
      }))
    ),
    { name: "notification-store" }
  )
);
