/**
 * Documentation Page (Protected)
 *
 * WHY: Access comprehensive guides, API docs, and help resources
 * HOW: Coming soon page with proper layout and navigation
 *
 * FEATURES:
 * - Consistent with dashboard design
 * - Proper navigation and layout
 * - Type-safe implementation
 */

import { useNavigate } from "react-router-dom";
import { FileText } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ComingSoon } from "@/components/shared/ComingSoon";

export function DocumentationPage() {
  const navigate = useNavigate();

  const handleBackToDashboard = () => {
    navigate("/dashboard");
  };

  return (
    <DashboardLayout>
      <ComingSoon
        title="Documentation"
        description="Access comprehensive guides, API documentation, tutorials, and help resources. Learn how to maximize your Privexbot experience."
        icon={FileText}
        iconColor="text-indigo-600 dark:text-indigo-400"
        expectedDate="Soon"
        onBackToDashboard={handleBackToDashboard}
      />
    </DashboardLayout>
  );
}
