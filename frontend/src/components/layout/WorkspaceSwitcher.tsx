/**
 * Workspace Switcher Component (Left Sidebar Column)
 *
 * WHY: Discord-style workspace switching with visual feedback
 * HOW: Avatar column with circle→square morphing, active indicators
 *
 * FEATURES:
 * - Workspace avatars with initials
 * - Circle → Rounded square hover transition (200ms)
 * - Active: Rounded square + white border + blue bar on right
 * - Workspace name below avatar (text-[9px])
 * - Add workspace button (dashed, green hover)
 * - "ACCT" label at top
 *
 * DESIGN:
 * - Width: 60px (mobile) → 70px (sm) → 72px (lg)
 * - Border-right: #3a3a3a (light) / #26272B (dark)
 * - Background: Always dark (light: #2B2D31, dark: #1E1F22)
 */

import React, { useState } from "react";
import { Plus } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useApp } from "@/contexts/AppContext";

interface WorkspaceSwitcherProps {
  onCreateWorkspace?: () => void;
}

export function WorkspaceSwitcher({
  onCreateWorkspace,
}: WorkspaceSwitcherProps) {
  const {
    workspaces,
    currentWorkspace,
    currentOrganization,
    switchWorkspace,
    hasPermission,
    isLoading,
    error,
  } = useApp();

  const canCreateWorkspace = hasPermission("workspace:create");

  // Debug logging
  React.useEffect(() => {
    console.log("[WorkspaceSwitcher] Workspaces:", workspaces);
    console.log("[WorkspaceSwitcher] Current Workspace:", currentWorkspace);
    console.log("[WorkspaceSwitcher] Can Create:", canCreateWorkspace);
  }, [workspaces, currentWorkspace, canCreateWorkspace]);

  /**
   * Get initials from workspace name
   */
  const getInitials = (name: string): string => {
    return name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  /**
   * Handle workspace switch
   */
  const handleSwitch = async (workspaceId: string) => {
    if (workspaceId === currentWorkspace?.id) return;

    try {
      await switchWorkspace(workspaceId);
    } catch (error) {
      console.error("Failed to switch workspace:", error);
    }
  };

  return (
    <div className="w-[60px] sm:w-[70px] lg:w-[72px] flex-shrink-0 flex flex-col bg-[#2B2D31] dark:bg-[#1E1F22] border-r border-[#3a3a3a] dark:border-[#26272B] overflow-y-auto scrollbar-hide">
      {/* ACCT Label */}
      <div className="px-1.5 sm:px-2 pt-3 pb-2 flex-shrink-0">
        <span className="text-[8px] sm:text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
          ACCT
        </span>
      </div>

      {/* Workspace List - Scrollable */}
      <div className="flex-1 px-1.5 sm:px-2 space-y-2 overflow-y-auto scrollbar-hide">
        {/* Loading State */}
        {isLoading && workspaces.length === 0 && (
          <div className="flex flex-col items-center py-4">
            <div className="h-11 w-11 rounded-full bg-gray-700 animate-pulse mb-1"></div>
            <div className="h-2 w-12 bg-gray-700 rounded animate-pulse"></div>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && workspaces.length === 0 && (
          <div className="flex flex-col items-center py-4 text-center">
            <div className="h-11 w-11 rounded-full border-2 border-dashed border-gray-600 flex items-center justify-center mb-1">
              <span className="text-xs text-gray-500">?</span>
            </div>
            <span className="text-[9px] text-gray-500">No workspaces</span>
          </div>
        )}

        {/* Workspace List */}
        {workspaces.map((workspace) => {
          const isActive = workspace.id === currentWorkspace?.id;

          return (
            <button
              key={workspace.id}
              onClick={() => handleSwitch(workspace.id)}
              className={cn(
                "relative group flex flex-col items-center w-full",
                // Active indicator - blue bar on right side (4px × 32px) - Design Guide: #2563EB
                isActive &&
                  "after:absolute after:-right-2 after:top-2 after:w-1 after:h-12 after:bg-[#2563EB] after:rounded-full"
              )}
              title={workspace.name}
            >
              {/* Container for avatar + text with blue background when active */}
              <div
                className={cn(
                  "flex flex-col items-center transition-all duration-200 w-full max-w-[52px]",
                  isActive
                    ? "bg-[#2563EB] rounded-[14px] p-1.5" // Active: Blue background with rounded square and padding
                    : "bg-transparent" // Inactive: Transparent
                )}
              >
                {/* Avatar with transition effects */}
                <div className="relative mb-1 transition-all duration-200">
                  <Avatar
                    className={cn(
                      "h-11 w-11 transition-all duration-200 border-2 rounded-[14px]",
                      isActive
                        ? "border-white" // Design Guide: Active = #FFFFFF border
                        : "border-white group-hover:border-[#6B7280]" // Design Guide: White border, grey on hover
                    )}
                  >
                    {/* Priority: workspace avatar → organization avatar → initials */}
                    {(workspace.avatar_url || currentOrganization?.avatar_url) && (
                      <AvatarImage
                        src={workspace.avatar_url || currentOrganization?.avatar_url}
                        alt={workspace.name}
                        className="object-cover transition-all duration-200 rounded-[14px]"
                      />
                    )}
                    <AvatarFallback
                      className={cn(
                        "text-xs font-bold transition-all duration-200 rounded-[14px]",
                        isActive
                          ? "bg-gray-600 dark:bg-gray-700 text-white" // Active: Gray background instead of blue
                          : "bg-[#36373D] dark:bg-[#2B2D31] text-[#D1D5DB] dark:text-[#9CA3AF] group-hover:bg-[#3B82F6] group-hover:text-white" // Inactive, original blue hover
                      )}
                    >
                      {getInitials(workspace.name)}
                    </AvatarFallback>
                  </Avatar>
                </div>

                {/* Workspace name below avatar - constrained width with truncation */}
                <span
                  className={cn(
                    "text-[9px] font-medium text-center truncate w-full max-w-[48px] block transition-colors",
                    isActive
                      ? "text-white"
                      : "text-gray-400 dark:text-gray-500 group-hover:text-gray-200"
                  )}
                >
                  {workspace.name}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Add Workspace Button - Fixed at bottom of workspace list */}
      {canCreateWorkspace && onCreateWorkspace && (
        <div className="flex-shrink-0 px-1.5 sm:px-2 pb-3">
          <button
            onClick={onCreateWorkspace}
            className="group flex flex-col items-center w-full"
            title="Add Workspace"
          >
            {/* Dashed border circle that transforms - Enhanced visibility */}
            <div className="h-11 w-11 rounded-full border-2 border-dashed border-gray-400 dark:border-gray-500 flex items-center justify-center group-hover:border-green-500 group-hover:bg-green-500/10 group-hover:rounded-[14px] transition-all duration-200 mb-1">
              <Plus className="h-5 w-5 text-gray-300 dark:text-gray-400 group-hover:text-green-400 transition-colors" />
            </div>
            <span className="text-[9px] font-medium text-gray-300 dark:text-gray-400 group-hover:text-green-400 transition-colors">
              Add
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
