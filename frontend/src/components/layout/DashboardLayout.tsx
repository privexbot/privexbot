/**
 * Dashboard Layout - Discord-Style Sidebar with Mobile Support
 *
 * WHY: Consistent layout for all dashboard pages with org/workspace switching
 * HOW: 3 horizontal sections stacked vertically in sidebar
 *
 * STRUCTURE (3 Horizontal Sections):
 * 1. TOP SECTION: Logo only (fixed at top)
 * 2. MIDDLE SECTION: Two columns side-by-side
 *    - Left: Workspace switcher (60-72px Discord-style)
 *    - Right: Main menu (scrollable)
 * 3. BOTTOM SECTION: User profile + org switcher (fixed at bottom, full width)
 *
 * MOBILE RESPONSIVE:
 * - < 768px: Sidebar hidden by default, hamburger menu in top bar
 * - Hamburger click: Sidebar slides in from left with backdrop
 * - Click backdrop: Sidebar slides out and hides
 * - >= 768px: Sidebar always visible, no hamburger
 *
 * COLORS (from sidebar-color-guide.md):
 * - Mobile bar: bg-[#2B2D31] dark:bg-[#1E1F22]
 * - Hamburger: text-gray-300 dark:text-gray-400
 * - Backdrop: bg-black/60 backdrop-blur-sm
 * - Sidebar: shadow-2xl when open on mobile
 */

import React, { useState } from "react";
import { Menu, X } from "lucide-react";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import { MainMenu } from "./MainMenu";
import { OrganizationSwitcher } from "./OrganizationSwitcher";
import { CreateWorkspaceModal } from "../workspace/CreateWorkspaceModal";
import { ManageWorkspaceModal } from "../workspace/ManageWorkspaceModal";
import { useApp } from "@/contexts/AppContext";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [showCreateWorkspace, setShowCreateWorkspace] = useState(false);
  const [showManageWorkspace, setShowManageWorkspace] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const {
    currentOrganization,
    currentWorkspace,
    refreshData,
    switchWorkspace,
  } = useApp();

  // Close mobile menu
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
          {isMobileMenuOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <Menu className="h-5 w-5" />
          )}
        </button>

        {/* Mobile Logo */}
        <div className="flex items-center space-x-2 ml-3">
          <img
            src="/privexbot-logo-icon.png"
            alt="Privexbot Logo"
            loading="lazy"
            className="h-8 w-8 object-contain flex-shrink-0"
          />
          <span className="text-base font-extrabold text-white truncate">
            Privexbot
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
        className={`
          flex flex-col h-full w-[260px] flex-shrink-0
          bg-[#2B2D31] dark:bg-[#1E1F22]
          border-r border-[#3a3a3a] dark:border-[#26272B]

          /* Mobile: Fixed, slide-in from left, with shadow */
          md:relative md:translate-x-0
          fixed top-0 bottom-0 left-0 z-50
          transition-transform duration-300 ease-out
          ${isMobileMenuOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"}
        `}
      >
        {/* ========== TOP SECTION: Logo Only (Fixed at Top) ========== */}
        <div className="flex-shrink-0 px-3 sm:px-4 py-3 sm:py-4 border-b border-[#3a3a3a] dark:border-[#26272B] bg-[#2B2D31] dark:bg-[#1E1F22]">
          <div className="flex items-center space-x-2">
            {/* Privexbot Logo Icon */}
            <img
              src="/privexbot-logo-icon.png"
              alt="Privexbot Logo"
              loading="lazy"
              className="h-8 sm:h-9 w-8 sm:w-9 object-contain flex-shrink-0"
            />
            {/* Brand Name */}
            <span className="text-base sm:text-lg font-extrabold text-white truncate">
              Privexbot
            </span>
          </div>
        </div>

        {/* ========== MIDDLE SECTION: Two-Column Layout (Workspace + Menu) ========== */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left Column: Workspace Switcher (72px Discord-style) */}
          <WorkspaceSwitcher
            onCreateWorkspace={() => {
              setShowCreateWorkspace(true);
              closeMobileMenu();
            }}
          />

          {/* Right Column: Main Menu (scrollable) */}
          <div
            onClick={closeMobileMenu}
            className="flex-1 min-h-0 flex flex-col pb-3"
          >
            <MainMenu
              onOpenSettings={() => {
                setShowManageWorkspace(true);
                closeMobileMenu();
              }}
            />
          </div>
        </div>

        {/* ========== BOTTOM SECTION: User Profile + Org Switcher (Full Width) ========== */}
        <OrganizationSwitcher />
      </div>

      {/* ========== MAIN CONTENT AREA ========== */}
      <main className="flex-1 overflow-y-auto bg-background mt-14 md:mt-0">
        {children}
      </main>

      {/* ========== CREATE WORKSPACE MODAL ========== */}
      {currentOrganization && (
        <CreateWorkspaceModal
          isOpen={showCreateWorkspace}
          onClose={() => setShowCreateWorkspace(false)}
          organizationId={currentOrganization.id}
          onWorkspaceCreated={async (workspace) => {
            // Refresh data first to load the new workspace into the array
            await refreshData();
            // Then switch to the newly created workspace
            await switchWorkspace(workspace.id);
          }}
        />
      )}

      {/* ========== MANAGE WORKSPACE MODAL ========== */}
      {currentWorkspace && currentOrganization && (
        <ManageWorkspaceModal
          isOpen={showManageWorkspace}
          onClose={() => setShowManageWorkspace(false)}
          workspace={currentWorkspace}
          organizationId={currentOrganization.id}
          onSuccess={() => {
            setShowManageWorkspace(false);
          }}
        />
      )}
    </div>
  );
}
