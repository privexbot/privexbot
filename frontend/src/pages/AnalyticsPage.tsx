/**
 * Analytics Page (Protected)
 *
 * WHY: Track performance, conversations, and user engagement metrics
 * HOW: Coming soon page with proper layout and navigation
 *
 * FEATURES:
 * - Consistent with dashboard design
 * - Proper navigation and layout
 * - Type-safe implementation
 */

import { useNavigate } from "react-router-dom";
import { BarChart3 } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ComingSoon } from "@/components/shared/ComingSoon";

export function AnalyticsPage() {
  const navigate = useNavigate();

  const handleBackToDashboard = () => {
    navigate("/dashboard");
  };

  return (
    <DashboardLayout>
      <ComingSoon
        title="Analytics & Insights"
        description="Deep dive into performance metrics, conversation analytics, user engagement patterns, and ROI tracking for your AI-powered experiences."
        icon={BarChart3}
        iconColor="text-blue-600 dark:text-blue-400"
        expectedDate="Soon"
        onBackToDashboard={handleBackToDashboard}
      />
    </DashboardLayout>
  );
}
