/**
 * Main Menu Component (Right Sidebar Column)
 *
 * WHY: Navigation for all workspace features
 * HOW: Two sections with all menu items visible
 *
 * SECTIONS:
 * 1. Main Menu - Core pages with "MAIN MENU" label (scrollable)
 * 2. Others - Documentation, Settings with "OTHERS" label (fixed at bottom)
 *
 * MENU ITEMS:
 * - Main: Dashboard, Chatbots, Studio, KB, Leads, Analytics, Billings, Profile, Organizations, Marketplace, Referrals
 * - Others: Documentation, Settings
 *
 * RBAC MODEL:
 * - Menu items: Always visible (show all features)
 * - Data filtering: Happens inside pages
 *   - Your resources: Always visible
 *   - Others' resources: Filtered by permissions
 *
 * VISIBILITY RULES:
 * - All items visible by default
 * - Context-based: Profile (ONLY in Personal org + default workspace)
 *
 * DESIGN:
 * - Height: 32-36px per item, rounded-lg
 * - Active: Blue bg-blue-600, white text, shadow-sm
 * - Hover: Dark gray bg, white text
 * - Icons: 16-18px responsive
 * - Text: 12-13px responsive, font-medium
 * - Transitions: 200ms
 */

import React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutGrid,
  Bot,
  Workflow,
  Database,
  Mail,
  BarChart3,
  User,
  Building2,
  Briefcase,
  Gift,
  FileText,
  Settings,
  CreditCard,
  Shield,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useApp } from "@/contexts/AppContext";
import { useAuth } from "@/contexts/AuthContext";
import type { Permission } from "@/types/tenant";

interface MenuItem {
  name: string;
  href?: string;
  onClick?: () => void;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  permission?: Permission;
  requiresDefaultWorkspace?: boolean;
}

const mainMenuItems: MenuItem[] = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: LayoutGrid,
  },
  {
    name: "Chatbots",
    href: "/chatbots",
    icon: Bot,
  },
  {
    name: "Studio",
    href: "/studio",
    icon: Workflow,
  },
  {
    name: "Knowledge Bases",
    href: "/knowledge-bases",
    icon: Database,
  },
  {
    name: "Leads",
    href: "/leads",
    icon: Mail,
  },
  {
    name: "Analytics",
    href: "/analytics",
    icon: BarChart3,
  },
  {
    name: "Billings",
    href: "/billings",
    icon: CreditCard,
  },
  {
    name: "Profile",
    href: "/profile",
    icon: User,
    requiresDefaultWorkspace: true, // Special: Only in Personal org + default workspace
  },
  {
    name: "Organizations",
    href: "/organizations",
    icon: Building2,
  },
  {
    name: "Marketplace",
    href: "/marketplace",
    icon: Briefcase,
  },
  {
    name: "Referrals",
    href: "/referrals",
    icon: Gift,
  },
];

const otherMenuItems: MenuItem[] = [
  {
    name: "Documentation",
    href: "/documentation",
    icon: FileText,
  },
  {
    name: "Settings",
    href: "/settings",
    icon: Settings,
  },
];

interface MainMenuProps {
  onOpenSettings: () => void;
}

export function MainMenu({ onOpenSettings }: MainMenuProps) {
  const location = useLocation();
  const { currentOrganization, currentWorkspace } = useApp();
  const { user } = useAuth();

  /**
   * Check if user is in personal organization and default workspace
   *
   * WHY: Profile menu should only be visible in user's personal context
   * HOW: Use database flags that survive renames, deletions, and reorganization
   */
  const isInPersonalContext = React.useMemo(() => {
    // Both organization and workspace must be marked as default/personal
    // This is set by the backend during user signup and is permanent
    return currentOrganization?.is_default && currentWorkspace?.is_default;
  }, [currentOrganization?.is_default, currentWorkspace?.is_default]);

  /**
   * Filter menu items based on context only
   * (No permission filtering - pages handle data-level RBAC)
   */
  const filterMenuItems = (items: MenuItem[]): MenuItem[] => {
    return items.filter((item) => {
      // Only check workspace context requirement (Profile page)
      if (item.requiresDefaultWorkspace && !isInPersonalContext) {
        return false;
      }

      return true;
    });
  };

  const filteredMainMenu = filterMenuItems(mainMenuItems);

  // Modify Settings item to use onClick instead of href
  const filteredOtherMenu = filterMenuItems(otherMenuItems).map((item) => {
    if (item.name === "Settings") {
      return {
        ...item,
        href: undefined,
        onClick: onOpenSettings,
      };
    }
    return item;
  });

  /**
   * Render menu item
   */
  const renderMenuItem = (item: MenuItem) => {
    const isActive = item.href ? location.pathname === item.href : false;
    const Icon = item.icon;

    const className = cn(
      "flex items-center justify-between px-2 sm:px-3 py-2 rounded-lg transition-all duration-200",
      isActive
        ? "bg-blue-600 text-white shadow-sm"
        : "text-gray-300 dark:text-gray-400 hover:bg-[#36373D] dark:hover:bg-[#2B2D31] hover:text-white"
    );

    const content = (
      <>
        <div className="flex items-center mr-2 sm:mr-3 min-w-0 flex-1">
          <Icon
            className={cn(
              "h-4 w-4 sm:h-[18px] sm:w-[18px] flex-shrink-0 mr-2 sm:mr-3 transition-colors",
              isActive ? "text-white" : "text-gray-400 dark:text-gray-500"
            )}
          />
          <span className="text-xs sm:text-[13px] font-medium truncate">
            {item.name}
          </span>
        </div>
        {item.badge && (
          <Badge
            variant="secondary"
            className="ml-2 text-[10px] sm:text-xs bg-green-500 text-white hover:bg-green-600 flex-shrink-0"
          >
            {item.badge}
          </Badge>
        )}
      </>
    );

    // If item has onClick, render as button
    if (item.onClick) {
      return (
        <button
          key={item.name}
          onClick={item.onClick}
          className={`${className} w-full text-left`}
        >
          {content}
        </button>
      );
    }

    // Otherwise render as Link
    return (
      <Link
        key={item.href}
        to={item.href!}
        className={className}
      >
        {content}
      </Link>
    );
  };

  return (
    <div className="flex-1 flex flex-col bg-[#2B2D31] dark:bg-[#1E1F22] min-h-0">
      {/* Main Menu Section - Scrollable */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide">
        <div className="px-2 sm:px-3 py-3 sm:py-4 space-y-0.5 sm:space-y-1">
          {/* "MAIN MENU" Label */}
          <div className="mb-2 px-1">
            <span className="text-[9px] sm:text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
              Main Menu
            </span>
          </div>

          {/* Main Menu Items */}
          {filteredMainMenu.map(renderMenuItem)}
        </div>
      </div>

      {/* Staff Section - Backoffice (only for staff users) */}
      {user?.is_staff && (
        <div className="flex-shrink-0 px-2 sm:px-3 py-2 sm:py-3 space-y-0.5 sm:space-y-1 border-t border-[#3a3a3a] dark:border-[#26272B] bg-[#2B2D31] dark:bg-[#1E1F22]">
          {/* "STAFF" Label */}
          <div className="mb-1 sm:mb-2 px-1">
            <span className="text-[9px] sm:text-[10px] font-bold text-amber-500 uppercase tracking-wider">
              Staff
            </span>
          </div>

          {/* Backoffice Link */}
          <Link
            to="/admin"
            className={cn(
              "flex items-center justify-between px-2 sm:px-3 py-2 rounded-lg transition-all duration-200",
              location.pathname.startsWith("/admin")
                ? "bg-amber-600 text-white shadow-sm"
                : "text-gray-300 dark:text-gray-400 hover:bg-[#36373D] dark:hover:bg-[#2B2D31] hover:text-white"
            )}
          >
            <div className="flex items-center mr-2 sm:mr-3 min-w-0 flex-1">
              <Shield
                className={cn(
                  "h-4 w-4 sm:h-[18px] sm:w-[18px] flex-shrink-0 mr-2 sm:mr-3 transition-colors",
                  location.pathname.startsWith("/admin")
                    ? "text-white"
                    : "text-amber-500"
                )}
              />
              <span className="text-xs sm:text-[13px] font-medium truncate">
                Backoffice
              </span>
            </div>
          </Link>
        </div>
      )}

      {/* Others Section - Fixed at bottom */}
      <div className="flex-shrink-0 px-2 sm:px-3 py-2 sm:py-3 space-y-0.5 sm:space-y-1 border-t border-[#3a3a3a] dark:border-[#26272B] bg-[#2B2D31] dark:bg-[#1E1F22]">
        {/* "OTHERS" Label */}
        <div className="mb-1 sm:mb-2 px-1">
          <span className="text-[9px] sm:text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
            Others
          </span>
        </div>

        {/* Others Menu Items */}
        {filteredOtherMenu.map(renderMenuItem)}
      </div>
    </div>
  );
}
