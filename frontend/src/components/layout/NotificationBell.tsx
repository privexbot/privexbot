import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useNotificationStore } from "@/store/notification-store";
import { useWorkspaceStore } from "@/store/workspace-store";
import type { Notification } from "@/types/notification";

const EVENT_ICONS: Record<string, string> = {
  "kb.processing.completed": "📚",
  "kb.processing.failed": "❌",
  "chatbot.deployed": "🤖",
  "chatflow.deployed": "⚡",
  "invitation.accepted": "🤝",
  "lead.captured": "📩",
};

function NotificationItem({
  notification,
  onClick,
}: {
  notification: Notification;
  onClick: () => void;
}) {
  const icon = EVENT_ICONS[notification.event] || "🔔";
  const timeAgo = formatDistanceToNow(new Date(notification.created_at), {
    addSuffix: true,
  });

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2.5 flex items-start gap-2.5 hover:bg-[#36373D] dark:hover:bg-[#36373D] hover:bg-gray-100 transition-colors border-b border-[#3a3a3a] dark:border-[#3a3a3a] border-gray-200 last:border-b-0 ${
        !notification.is_read ? "bg-blue-500/5" : ""
      }`}
    >
      <span className="text-base mt-0.5 flex-shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm leading-snug truncate ${
            notification.is_read
              ? "text-gray-500 dark:text-gray-400"
              : "text-gray-900 dark:text-gray-200 font-medium"
          }`}
        >
          {notification.title}
        </p>
        {notification.body && (
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">
            {notification.body}
          </p>
        )}
        <p className="text-[11px] text-gray-400 dark:text-gray-600 mt-1">
          {timeAgo}
        </p>
      </div>
      {!notification.is_read && (
        <span className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
      )}
    </button>
  );
}

export function NotificationBell() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    notifications,
    unreadCount,
    isLoading,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    startPolling,
    stopPolling,
    setWorkspaceId,
  } = useNotificationStore();

  // Keep notification store in sync with the active workspace so the
  // dropdown only surfaces events scoped to it (server-side enforcement is
  // in `notification_service.get_notifications`).
  const activeWorkspaceId = useWorkspaceStore(
    (s) => s.currentWorkspace?.id ?? null,
  );
  useEffect(() => {
    setWorkspaceId(activeWorkspaceId);
  }, [activeWorkspaceId, setWorkspaceId]);

  // Start/stop polling on mount/unmount
  useEffect(() => {
    startPolling();
    return () => stopPolling();
  }, [startPolling, stopPolling]);

  // Fetch full list when dropdown opens
  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen, fetchNotifications]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  const handleNotificationClick = (notification: Notification) => {
    markAsRead(notification.id);
    setIsOpen(false);
    if (notification.link) {
      navigate(notification.link);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Bell button */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative p-2 rounded-lg text-gray-400 hover:text-white hover:bg-[#36373D] transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1 leading-none">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 max-h-96 bg-white dark:bg-[#2B2D31] border border-gray-200 dark:border-[#3a3a3a] rounded-lg shadow-xl z-50 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-200 dark:border-[#3a3a3a]">
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-200">
              Notifications
            </span>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllAsRead()}
                className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 transition-colors"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all read
              </button>
            )}
          </div>

          {/* Notification list */}
          <div className="flex-1 overflow-y-auto">
            {isLoading && notifications.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-500">
                Loading...
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-500">
                No notifications yet
              </div>
            ) : (
              notifications.map((n) => (
                <NotificationItem
                  key={n.id}
                  notification={n}
                  onClick={() => handleNotificationClick(n)}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
