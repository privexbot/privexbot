/**
 * Staff Route Component
 *
 * WHY: Restrict access to admin/backoffice pages for staff users only
 * HOW: Check if user has is_staff flag and redirect to dashboard if not
 *
 * USAGE:
 * <Route path="/admin/*" element={<StaffRoute><AdminLayout /></StaffRoute>} />
 */

import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

interface StaffRouteProps {
  children: React.ReactNode;
}

export function StaffRoute({ children }: StaffRouteProps) {
  const { user, isAuthenticated, isLoading } = useAuth();

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Redirect to dashboard if not staff
  if (!user?.is_staff) {
    return <Navigate to="/dashboard" replace />;
  }

  // Render admin content if staff
  return <>{children}</>;
}
