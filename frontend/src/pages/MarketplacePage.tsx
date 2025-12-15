/**
 * Marketplace Page (Protected)
 *
 * WHY: Browse and install pre-built templates, integrations, and add-ons
 * HOW: Coming soon page with proper layout and navigation
 *
 * FEATURES:
 * - Consistent with dashboard design
 * - Proper navigation and layout
 * - Type-safe implementation
 */

import { useNavigate } from "react-router-dom";
import { Briefcase } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ComingSoon } from "@/components/shared/ComingSoon";

export function MarketplacePage() {
  const navigate = useNavigate();

  const handleBackToDashboard = () => {
    navigate("/dashboard");
  };

  return (
    <DashboardLayout>
      <ComingSoon
        title="Marketplace"
        description="Discover and install pre-built chatbot templates, integrations, and community add-ons. Accelerate your development with proven solutions."
        icon={Briefcase}
        iconColor="text-purple-600 dark:text-purple-400"
        expectedDate="Soon"
        onBackToDashboard={handleBackToDashboard}
      />
    </DashboardLayout>
  );
}
