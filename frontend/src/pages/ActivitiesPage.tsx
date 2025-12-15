/**
 * Activities Page (Protected)
 *
 * WHY: View detailed activity feed and history across all resources
 * HOW: Coming soon page with proper layout and navigation
 *
 * FEATURES:
 * - Consistent with dashboard design
 * - Proper navigation and layout
 * - Type-safe implementation
 */

import { useNavigate } from "react-router-dom";
import { Clock } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ComingSoon } from "@/components/shared/ComingSoon";

export function ActivitiesPage() {
  const navigate = useNavigate();

  const handleBackToDashboard = () => {
    navigate("/dashboard");
  };

  return (
    <DashboardLayout>
      <ComingSoon
        title="Activity Feed"
        description="View comprehensive activity history, logs, and real-time updates across all your workspace resources. Track changes and monitor system events."
        icon={Clock}
        iconColor="text-gray-600 dark:text-gray-400"
        expectedDate="Soon"
        onBackToDashboard={handleBackToDashboard}
      />
    </DashboardLayout>
  );
}
