/**
 * Studio Page (Protected)
 *
 * WHY: Visual workflow builder for complex chatflow creation
 * HOW: Coming soon page with proper layout and navigation
 *
 * FEATURES:
 * - Consistent with dashboard design
 * - Proper navigation and layout
 * - Type-safe implementation
 */

import { useNavigate } from "react-router-dom";
import { Workflow } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ComingSoon } from "@/components/shared/ComingSoon";

export function StudioPage() {
  const navigate = useNavigate();

  const handleBackToDashboard = () => {
    navigate("/dashboard");
  };

  return (
    <DashboardLayout>
      <ComingSoon
        title="Visual Studio"
        description="Design complex chatflow workflows with our intuitive visual builder. Create sophisticated conversational experiences with drag-and-drop simplicity."
        icon={Workflow}
        iconColor="text-purple-600 dark:text-purple-400"
        expectedDate="Soon"
        onBackToDashboard={handleBackToDashboard}
      />
    </DashboardLayout>
  );
}
