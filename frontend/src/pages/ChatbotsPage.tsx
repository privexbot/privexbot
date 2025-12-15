/**
 * Chatbots Page (Protected)
 *
 * WHY: Manage and create chatbots within the current workspace
 * HOW: Coming soon page with proper layout and navigation
 *
 * FEATURES:
 * - Consistent with dashboard design
 * - Proper navigation and layout
 * - Type-safe implementation
 */

import { useNavigate } from "react-router-dom";
import { Bot } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ComingSoon } from "@/components/shared/ComingSoon";

export function ChatbotsPage() {
  const navigate = useNavigate();

  const handleBackToDashboard = () => {
    navigate("/dashboard");
  };

  return (
    <DashboardLayout>
      <ComingSoon
        title="Chatbots"
        description="Create and manage your AI chatbots with form-based configurations. Build intelligent conversational experiences for your users."
        icon={Bot}
        iconColor="text-blue-600 dark:text-blue-400"
        expectedDate="Soon"
        onBackToDashboard={handleBackToDashboard}
      />
    </DashboardLayout>
  );
}
