/**
 * Activities Page (Protected)
 *
 * WHY: View detailed activity feed and history across all resources
 * HOW: Full activity list with search filtering
 *
 * DESIGN: Consistent with Dashboard's RecentActivities component
 * - Pure icons (no colored backgrounds)
 * - Font: Manrope
 * - Card styling matches dashboard components
 * - Simple search-only filtering
 */

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Clock,
  Search,
  Network,
  Book,
  Users,
  MessageCircle,
  AlertCircle,
  Settings,
  CheckCircle,
  ArrowLeft,
  RefreshCw,
  X,
} from "lucide-react";
import { motion } from "framer-motion";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { useApp } from "@/contexts/AppContext";
import { dashboardApi } from "@/api/dashboard";
import { formatRelativeTime } from "@/utils/time";
import { cn } from "@/lib/utils";
import type { Activity, ActivityType } from "@/types/dashboard";

// Custom chatbot SVG component (matches dashboard)
const ChatbotIcon = ({ className }: { className?: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M20.5696 19.0752L20.0096 18.5056L19.6816 18.8256L19.7936 19.2688L20.5696 19.0752ZM21.6 23.2L21.4064 23.976C21.5403 24.0093 21.6806 24.0075 21.8136 23.9706C21.9466 23.9337 22.0678 23.863 22.1654 23.7654C22.263 23.5678 22.3337 23.5466 22.3706 23.4136C22.4075 23.2806 22.4093 23.1403 22.376 23.0064L21.6 23.2ZM15.2 21.6L14.6336 21.0336L13.6352 22.0336L15.0064 22.376L15.2 21.6ZM15.24 21.56L15.8048 22.1264C15.9215 22.0101 15.9995 21.8606 16.0281 21.6983C16.0566 21.536 16.0344 21.3688 15.9644 21.2197C15.8943 21.0705 15.7799 20.9466 15.6368 20.8649C15.4937 20.7832 15.3289 20.7477 15.1648 20.7632L15.24 21.56ZM11.2 0V4H12.8V0H11.2ZM14.4 3.2H9.6V4.8H14.4V3.2ZM24 12.8C24 10.2539 22.9886 7.81212 21.1882 6.01178C19.3879 4.21143 16.9461 3.2 14.4 3.2V4.8C15.4506 4.8 16.4909 5.00693 17.4615 5.40896C18.4321 5.811 19.314 6.40028 20.0569 7.14315C20.7997 7.88601 21.389 8.76793 21.791 9.73853C22.1931 10.7091 22.4 11.7494 22.4 12.8H24ZM21.1296 19.6464C22.0402 18.7538 22.7633 17.6882 23.2562 16.5122C23.7491 15.3362 24.002 14.0751 24 12.8H22.4C22.402 13.8627 22.1915 14.9136 21.7807 15.8937C21.3699 16.8738 20.7688 17.7619 20.0096 18.5056L21.1296 19.6464ZM22.3776 23.0064L21.344 18.88L19.792 19.2672L20.8224 23.392L22.3776 23.0064ZM15.0064 22.376L21.4064 23.976L21.7936 22.424L15.3936 20.824L15.0064 22.376ZM14.6736 20.9952L14.6336 21.0336L15.7664 22.1648L15.8048 22.1264L14.6736 20.9952ZM14.4 22.4C14.7093 22.4 15.0144 22.3856 15.3152 22.3568L15.1648 20.7632C14.9106 20.7877 14.6554 20.7999 14.4 20.8V22.4ZM9.6 22.4H14.4V20.8H9.6V22.4ZM0 12.8C0 15.3461 1.01143 17.7879 2.81177 19.5882C4.61212 21.3886 7.05392 22.4 9.6 22.4V20.8C8.54942 20.8 7.50914 20.5931 6.53853 20.191C5.56793 19.789 4.68601 19.1997 3.94315 18.4569C2.44285 16.9566 1.6 14.9217 1.6 12.8H0ZM9.6 3.2C7.05392 3.2 4.61212 4.21143 2.81177 6.01178C1.01143 7.81212 0 10.2539 0 12.8H1.6C1.6 10.6783 2.44285 8.64344 3.94315 7.14315C5.44344 5.64285 7.47827 4.8 9.6 4.8V3.2ZM12 12.8C11.3635 12.8 10.753 12.5471 10.3029 12.0971C9.85286 11.647 9.6 11.0365 9.6 10.4H8C8 11.4609 8.42143 12.4783 9.17157 13.2284C9.92172 13.9786 10.9391 14.4 12 14.4V12.8ZM14.4 10.4C14.4 11.0365 14.1471 11.647 13.6971 12.0971C13.247 12.5471 12.6365 12.8 12 12.8V14.4C13.0609 14.4 14.0783 13.9786 14.8284 13.2284C15.5786 12.4783 16 11.4609 16 10.4H14.4ZM12 8C12.6365 8 13.247 8.25286 13.6971 8.70294C14.1471 9.15303 14.4 9.76348 14.4 10.4H16C16 9.33913 15.5786 8.32172 14.8284 7.57157C14.0783 6.82143 13.0609 6.4 12 6.4V8ZM12 6.4C10.9391 6.4 9.92172 6.82143 9.17157 7.57157C8.42143 8.32172 8 9.33913 8 10.4H9.6C9.6 9.76348 9.85286 9.15303 10.3029 8.70294C10.753 8.25286 11.3635 8 12 8V6.4ZM12 19.2C13.7024 19.2 15.2672 18.608 16.5008 17.6208L15.4992 16.3728C14.5392 17.1408 13.3248 17.6 12 17.6V19.2ZM7.4992 17.6208C8.7312 18.608 10.2992 19.2 12 19.2V17.6C10.7276 17.6028 9.49272 17.1697 8.5008 16.3728L7.4992 17.6208Z" fill="currentColor"/>
  </svg>
);

// Map activity types to icon (pure icons, no backgrounds - matches dashboard)
const getActivityIcon = (type: ActivityType): React.ComponentType<{ className?: string }> => {
  const iconMap: Record<ActivityType, React.ComponentType<{ className?: string }>> = {
    chatbot_created: ChatbotIcon,
    chatbot_updated: ChatbotIcon,
    chatbot_deployed: CheckCircle,
    chatflow_created: Network,
    chatflow_updated: Network,
    chatflow_deployed: CheckCircle,
    kb_created: Book,
    kb_updated: Book,
    lead_captured: Users,
    conversation_started: MessageCircle,
    error_occurred: AlertCircle,
    settings_changed: Settings,
  };

  return iconMap[type] || Clock;
};

export function ActivitiesPage() {
  const navigate = useNavigate();
  const { currentWorkspace } = useApp();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchExpanded, setSearchExpanded] = useState(false);

  // Fetch activities from API - use same endpoint as dashboard
  const { data: activities = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["activities", currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];
      const dashboardData = await dashboardApi.getDashboardData(currentWorkspace.id);
      return dashboardData.recent_activities || [];
    },
    enabled: !!currentWorkspace?.id,
    refetchInterval: 30000,
  });

  // Filter activities based on search
  const filteredActivities = useMemo(() => {
    if (!searchQuery.trim()) return activities;

    const query = searchQuery.toLowerCase();
    return activities.filter((activity) => {
      const matchesTitle = activity.title?.toLowerCase().includes(query);
      const matchesDescription = activity.description?.toLowerCase().includes(query);
      const matchesResource = activity.resource_name?.toLowerCase().includes(query);
      return matchesTitle || matchesDescription || matchesResource;
    });
  }, [activities, searchQuery]);

  // Navigate to resource when clicking on activity.
  // Chatflow activity → the read-only detail page (deployment channels + test
  // chat). Users who actually want to edit click Edit from Studio.
  const handleActivityClick = (activity: Activity) => {
    if (!activity.resource_type || !activity.resource_id) return;

    switch (activity.resource_type) {
      case "chatbot":
        navigate(`/chatbots/${activity.resource_id}`);
        break;
      case "chatflow":
        navigate(`/studio/${activity.resource_id}`);
        break;
      case "knowledge_base":
        navigate(`/knowledge-bases/${activity.resource_id}`);
        break;
      case "lead":
        navigate(`/leads/${activity.resource_id}`);
        break;
    }
  };

  const handleSearchToggle = () => {
    if (searchExpanded) {
      setSearchQuery("");
    }
    setSearchExpanded(!searchExpanded);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Search is already reactive via filteredActivities
  };

  // Loading skeleton that matches dashboard style
  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="w-full bg-white dark:bg-gray-800">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Header skeleton */}
            <div className="mb-6">
              <div className="h-8 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2" />
              <div className="h-5 w-64 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            </div>

            {/* Card skeleton */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
              <div className="p-5 sm:p-6 bg-[#EAECEE] dark:bg-gray-800/80 rounded-t-xl">
                <div className="h-6 w-40 bg-gray-300 dark:bg-gray-600 rounded animate-pulse mb-2" />
                <div className="h-4 w-56 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              </div>
              <div className="px-5 sm:px-6 pb-5 sm:pb-6 bg-gray-50 dark:bg-gray-800/50 space-y-1">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="flex items-start gap-4 p-3 rounded-lg animate-pulse">
                    <div className="h-5 w-5 bg-gray-200 dark:bg-gray-700 rounded flex-shrink-0" />
                    <div className="flex-1 space-y-2 min-w-0">
                      <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded" />
                      <div className="h-3 w-1/2 bg-gray-200 dark:bg-gray-700 rounded" />
                    </div>
                    <div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded flex-shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="w-full bg-white dark:bg-gray-800 min-h-screen">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-6">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/dashboard")}
              className="mb-4 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white font-manrope -ml-2"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white font-manrope">
                  Activity Feed
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1 font-manrope">
                  Track all changes and events across your workspace
                </p>
              </div>

              {/* Actions: Search + Refresh */}
              <div className="flex items-center gap-2">
                {/* Expandable Search (matches dashboard style) */}
                {searchExpanded ? (
                  <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search activities..."
                      autoFocus
                      className="h-10 w-48 sm:w-64 px-4 pr-10 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-full text-sm text-gray-900 dark:text-gray-50 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600 dark:focus:ring-blue-400 focus:border-transparent transition-all font-manrope"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      type="button"
                      onClick={handleSearchToggle}
                      className="h-10 w-10 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
                    >
                      <X className="h-5 w-5" />
                    </Button>
                  </form>
                ) : (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleSearchToggle}
                    className="h-10 w-10 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
                  >
                    <Search className="h-5 w-5" />
                  </Button>
                )}

                {/* Refresh Button */}
                {!searchExpanded && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => refetch()}
                    disabled={isRefetching}
                    className="h-10 w-10 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
                  >
                    <RefreshCw className={cn("h-5 w-5", isRefetching && "animate-spin")} />
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Results count (when searching) */}
          {searchQuery && (
            <div className="mb-4 text-sm text-gray-500 dark:text-gray-400 font-manrope">
              Showing {filteredActivities.length} of {activities.length} activities
            </div>
          )}

          {/* Activities Card (matches dashboard RecentActivities component) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm"
          >
            {/* Card Header */}
            <div className="flex items-start justify-between p-5 sm:p-6 bg-[#EAECEE] dark:bg-gray-800/80 rounded-t-xl">
              <div className="min-w-0 flex-1">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-1 font-manrope">
                  All Activities
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 font-manrope">
                  Complete history of workspace events
                </p>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 font-manrope">
                <Clock className="h-4 w-4" />
                <span>Auto-refreshes every 30s</span>
              </div>
            </div>

            {/* Activities List */}
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-b-xl">
              {filteredActivities.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                  <Clock className="h-12 w-12 mb-4 text-gray-400 dark:text-gray-500" />
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 font-manrope mb-1">
                    {searchQuery ? "No matching activities" : "No recent activities"}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-manrope">
                    {searchQuery
                      ? "Try a different search term"
                      : "Activities will appear here as you work"}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
                  {filteredActivities.map((activity, index) => {
                    const Icon = getActivityIcon(activity.type);

                    return (
                      <motion.div
                        key={activity.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.03 }}
                        onClick={() => handleActivityClick(activity)}
                        className={cn(
                          "flex items-start gap-4 p-4 sm:px-6 transition-all duration-200 group",
                          activity.resource_id && "cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/50"
                        )}
                      >
                        {/* Pure Icon (no background - matches dashboard) */}
                        <div className="flex-shrink-0 pt-0.5">
                          <Icon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                        </div>

                        {/* Text Content */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate font-manrope">
                            {activity.title}
                          </p>
                          {activity.description && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate font-manrope">
                              {activity.description}
                            </p>
                          )}
                          {activity.resource_name && (
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 font-manrope">
                              {activity.resource_name}
                            </p>
                          )}
                        </div>

                        {/* Timestamp */}
                        <div className="flex-shrink-0 text-right">
                          <p className="text-xs text-gray-500 dark:text-gray-400 font-manrope whitespace-nowrap">
                            {formatRelativeTime(activity.timestamp)}
                          </p>
                          {activity.username && (
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 font-manrope">
                              {activity.username}
                            </p>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>

          {/* Footer info */}
          {filteredActivities.length > 0 && (
            <div className="mt-4 text-center">
              <p className="text-xs text-gray-400 dark:text-gray-500 font-manrope">
                Showing {filteredActivities.length} {filteredActivities.length === 1 ? "activity" : "activities"}
              </p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
