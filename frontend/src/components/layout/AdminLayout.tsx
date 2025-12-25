/**
 * Admin Layout - Staff-only backoffice layout
 *
 * WHY: Separate layout for admin/backoffice pages
 * HOW: Simple sidebar with admin navigation, no org/workspace context needed
 *
 * STRUCTURE:
 * - Left sidebar with admin navigation
 * - Main content area
 * - Back to Dashboard link
 */

import React, { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Menu, X, LayoutDashboard, Building2, Users, ArrowLeft, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

const adminNavItems = [
  {
    label: "Dashboard",
    to: "/admin",
    icon: LayoutDashboard,
    end: true,
  },
  {
    label: "Organizations",
    to: "/admin/organizations",
    icon: Building2,
  },
  {
    label: "Users",
    to: "/admin/users",
    icon: Users,
  },
];

export function AdminLayout() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* ========== MOBILE TOP BAR (< 768px only) ========== */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 z-30 bg-[#2B2D31] dark:bg-[#1E1F22] border-b border-[#3a3a3a] dark:border-[#26272B] shadow-sm flex items-center px-4">
        {/* Hamburger Button */}
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 rounded-lg text-gray-300 dark:text-gray-400 hover:bg-[#36373D] dark:hover:bg-[#232427] hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 active:scale-95 transition-all"
          aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
        >
          {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

        {/* Mobile Logo */}
        <div className="flex items-center space-x-2 ml-3">
          <Shield className="h-6 w-6 text-amber-500" />
          <span className="text-base font-extrabold text-white truncate">
            Backoffice
          </span>
        </div>
      </div>

      {/* ========== MOBILE BACKDROP OVERLAY ========== */}
      {isMobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity"
          onClick={closeMobileMenu}
          aria-hidden="true"
        />
      )}

      {/* ========== SIDEBAR CONTAINER ========== */}
      <div
        className={cn(
          "flex flex-col h-full w-[240px] flex-shrink-0",
          "bg-[#2B2D31] dark:bg-[#1E1F22]",
          "border-r border-[#3a3a3a] dark:border-[#26272B]",
          "md:relative md:translate-x-0",
          "fixed top-0 bottom-0 left-0 z-50",
          "transition-transform duration-300 ease-out",
          isMobileMenuOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
        )}
      >
        {/* ========== TOP SECTION: Logo ========== */}
        <div className="flex-shrink-0 px-4 py-4 border-b border-[#3a3a3a] dark:border-[#26272B]">
          <div className="flex items-center space-x-2">
            <Shield className="h-8 w-8 text-amber-500" />
            <div className="flex flex-col">
              <span className="text-lg font-extrabold text-white">Backoffice</span>
              <span className="text-xs text-gray-400">Staff Only</span>
            </div>
          </div>
        </div>

        {/* ========== BACK TO DASHBOARD ========== */}
        <div className="px-3 py-3 border-b border-[#3a3a3a] dark:border-[#26272B]">
          <button
            onClick={() => {
              navigate("/dashboard");
              closeMobileMenu();
            }}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-[#36373D] dark:hover:bg-[#232427] rounded-md transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Dashboard</span>
          </button>
        </div>

        {/* ========== NAVIGATION ========== */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {adminNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={closeMobileMenu}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors",
                  isActive
                    ? "bg-[#404249] dark:bg-[#313338] text-white font-medium"
                    : "text-gray-300 hover:text-white hover:bg-[#36373D] dark:hover:bg-[#232427]"
                )
              }
            >
              <item.icon className="h-4 w-4" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* ========== BOTTOM: User Info ========== */}
        <div className="flex-shrink-0 px-3 py-3 border-t border-[#3a3a3a] dark:border-[#26272B]">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="h-8 w-8 rounded-full bg-amber-500/20 flex items-center justify-center">
              <Shield className="h-4 w-4 text-amber-500" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-medium text-white truncate">
                {user?.username || "Staff"}
              </span>
              <span className="text-xs text-amber-500">Staff Member</span>
            </div>
          </div>
        </div>
      </div>

      {/* ========== MAIN CONTENT AREA ========== */}
      <main className="flex-1 overflow-y-auto bg-background mt-14 md:mt-0">
        <Outlet />
      </main>
    </div>
  );
}
