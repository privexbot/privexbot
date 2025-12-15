/**
 * Referrals Page (Protected)
 *
 * WHY: Manage referral program and earn rewards for inviting users
 * HOW: Coming soon page with proper layout and navigation
 *
 * FEATURES:
 * - Consistent with dashboard design
 * - Proper navigation and layout
 * - Type-safe implementation
 */

import { useNavigate } from "react-router-dom";
import { Gift } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ComingSoon } from "@/components/shared/ComingSoon";

export function ReferralsPage() {
  const navigate = useNavigate();

  const handleBackToDashboard = () => {
    navigate("/dashboard");
  };

  return (
    <DashboardLayout>
      <ComingSoon
        title="Referral Program"
        description="Invite friends and colleagues to earn rewards. Track your referrals, commissions, and unlock exclusive benefits through our partner program."
        icon={Gift}
        iconColor="text-pink-600 dark:text-pink-400"
        expectedDate="Soon"
        onBackToDashboard={handleBackToDashboard}
      />
    </DashboardLayout>
  );
}
