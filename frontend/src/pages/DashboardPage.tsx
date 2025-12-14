/**
 * Dashboard Page (Protected)
 *
 * WHY: Main dashboard for authenticated users with org/workspace context
 * HOW: Displays workspace stats, recent activities, resources, and quick actions
 *
 * LAYOUT:
 * 1. DashboardHeader (avatar, search, notifications, date, create button)
 * 2. Horizontal divider
 * 3. StatsCards (unified with header via same bg color)
 * 4. Horizontal divider
 * 5. Main content: 2-column grid (Recent Activities + Recent Resources)
 * 6. Action Cards grid (create chatbot, chatflow, KB, view analytics)
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useApp } from "@/contexts/AppContext";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { StatsCards } from "@/components/dashboard/StatsCards";
import { RecentActivities } from "@/components/dashboard/RecentActivities";
import { RecentResources } from "@/components/dashboard/RecentResources";
import { ActionCards } from "@/components/dashboard/ActionCards";
import { dashboardApi } from "@/api/dashboard";
import type { DashboardData, Activity } from "@/types/dashboard";

export function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentOrganization, currentWorkspace } = useApp();

  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTimeRange, setSelectedTimeRange] = useState("Last 7 days");
  const [customDateRange, setCustomDateRange] = useState<string | null>(null);

  // Fetch dashboard data
  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!currentOrganization?.id || !currentWorkspace?.id) {
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        const data = await dashboardApi.getDashboardData(
          currentOrganization.id,
          currentWorkspace.id
        );
        setDashboardData(data);
      } catch (err) {
        console.error("Failed to fetch dashboard data:", err);
        setError("Failed to load dashboard data. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, [currentOrganization?.id, currentWorkspace?.id]);

  // Navigation handlers
  const handleCreateChatbot = () => {
    navigate("/chatbots/create");
  };

  const handleCreateChatflow = () => {
    navigate("/studio");
  };

  const handleCreateKnowledgeBase = () => {
    navigate("/knowledge-bases/create");
  };

  const handleViewAnalytics = () => {
    navigate("/analytics");
  };

  const handleViewAllActivities = () => {
    navigate("/activities");
  };

  const handleActivityClick = (activity: Activity) => {
    // Navigate to resource based on activity type
    if (activity.resource_type && activity.resource_id) {
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
    }
  };

  const handleViewChatbots = () => {
    navigate("/chatbots");
  };

  const handleViewChatflows = () => {
    navigate("/studio");
  };

  const handleViewKnowledgeBases = () => {
    navigate("/knowledge-bases");
  };

  return (
    <DashboardLayout>
      {/* Container for unified header + stats section */}
      <div className="w-full bg-white dark:bg-gray-800">
        {/* Dashboard Header */}
        <DashboardHeader
          user={user}
          onCreateChatbot={handleCreateChatbot}
          onCreateChatflow={handleCreateChatflow}
          onCreateKnowledgeBase={handleCreateKnowledgeBase}
          onTimeRangeChange={setSelectedTimeRange}
          selectedTimeRange={selectedTimeRange}
          onCustomDateRangeChange={setCustomDateRange}
        />

        {/* Horizontal Divider between Header and Stats - Fixed spacing */}
        <div className="px-4 sm:px-6 lg:pl-6 lg:pr-8 xl:pl-8 xl:pr-12 2xl:pl-8 2xl:pr-16 max-w-none">
          <div className="h-px bg-gray-200 dark:bg-gray-700/50" />
        </div>

        {/* Stats Cards - Unified with Header */}
        <StatsCards
          stats={dashboardData?.stats || {
            total_chatbots: 0,
            total_chatflows: 0,
            total_knowledge_bases: 0,
            total_leads: 0,
            total_conversations: 0,
            active_conversations: 0,
          }}
          isLoading={isLoading}
          timeRange={selectedTimeRange}
          customDateRange={customDateRange}
        />

        {/* Horizontal Divider below Stats - Fixed spacing */}
        <div className="px-4 sm:px-6 lg:pl-6 lg:pr-8 xl:pl-8 xl:pr-12 2xl:pl-8 2xl:pr-16 max-w-none">
          <div className="h-px bg-gray-200 dark:bg-gray-700/50" />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="px-4 sm:px-6 lg:pl-6 lg:pr-8 xl:pl-8 xl:pr-12 2xl:pl-8 2xl:pr-16 max-w-none space-y-6 py-4 sm:py-5 md:py-6">
        {/* Error State */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-sm text-red-800 dark:text-red-300 font-manrope">{error}</p>
          </div>
        )}

        {/* 2-Column Layout: Recent Activities + Recent Resources */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5 lg:gap-6">
          {/* Left Column: Recent Activities */}
          <RecentActivities
            activities={dashboardData?.recent_activities || []}
            onViewAll={handleViewAllActivities}
            onActivityClick={handleActivityClick}
            isLoading={isLoading}
          />

          {/* Right Column: Recent Resources */}
          <RecentResources
            chatbots={dashboardData?.recent_chatbots || []}
            chatflows={dashboardData?.recent_chatflows || []}
            knowledgeBases={dashboardData?.recent_knowledge_bases || []}
            onViewChatbots={handleViewChatbots}
            onViewChatflows={handleViewChatflows}
            onViewKnowledgeBases={handleViewKnowledgeBases}
            isLoading={isLoading}
          />
        </div>
      </div>

      {/* Horizontal Divider before Quick Actions - Fixed spacing */}
      <div className="px-4 sm:px-6 lg:pl-6 lg:pr-8 xl:pl-8 xl:pr-12 2xl:pl-8 2xl:pr-16 max-w-none">
        <div className="h-px bg-gray-200 dark:bg-gray-700/50" />
      </div>

      {/* Quick Actions Section */}
      <div className="px-4 sm:px-6 lg:pl-6 lg:pr-8 xl:pl-8 xl:pr-12 2xl:pl-8 2xl:pr-16 max-w-none py-4 sm:py-5 md:py-6">
        {/* Action Cards Grid */}
        <div>
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-50 mb-4 font-manrope">
            Quick Actions
          </h2>
          <ActionCards
            onCreateChatbot={handleCreateChatbot}
            onCreateChatflow={handleCreateChatflow}
            onCreateKnowledgeBase={handleCreateKnowledgeBase}
            onViewAnalytics={handleViewAnalytics}
          />
        </div>
      </div>
    </DashboardLayout>
  );
}
