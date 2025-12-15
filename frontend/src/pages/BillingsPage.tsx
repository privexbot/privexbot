/**
 * Billings Page (Protected)
 *
 * WHY: Manage subscriptions, usage, and payment information
 * HOW: Coming soon page with proper layout and navigation
 *
 * FEATURES:
 * - Consistent with dashboard design
 * - Proper navigation and layout
 * - Type-safe implementation
 */

import { useNavigate } from "react-router-dom";
import { CreditCard } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ComingSoon } from "@/components/shared/ComingSoon";

export function BillingsPage() {
  const navigate = useNavigate();

  const handleBackToDashboard = () => {
    navigate("/dashboard");
  };

  return (
    <DashboardLayout>
      <ComingSoon
        title="Billing & Usage"
        description="Manage your subscription plans, monitor usage metrics, view invoices, and update payment methods. Track costs and optimize your spending."
        icon={CreditCard}
        iconColor="text-green-600 dark:text-green-400"
        expectedDate="Soon"
        onBackToDashboard={handleBackToDashboard}
      />
    </DashboardLayout>
  );
}
