/**
 * App Context - Multi-Tenancy State Management
 *
 * WHY: Centralized organization, workspace, and permission management
 * HOW: React Context with localStorage persistence and JWT synchronization
 *
 * PROVIDES:
 * - Current organization and workspace context
 * - List of all organizations and workspaces
 * - Calculated permissions based on roles
 * - Context switching functions (org/workspace)
 * - Workspace creation
 * - Automatic context restoration on mount
 *
 * PERSISTENCE:
 * - Current org_id and workspace_id saved to localStorage
 * - Restored on app mount
 * - Synced with backend via JWT tokens
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAuth } from "./AuthContext";
import { organizationApi } from "@/api/organization";
import { workspaceApi } from "@/api/workspace";
import { calculatePermissions, hasPermission as checkPermission } from "@/lib/permissions";
import type {
  Organization,
  Workspace,
  PermissionMap,
  Permission,
  CreateWorkspaceRequest,
} from "@/types/tenant";

const STORAGE_KEYS = {
  ORG_ID: "privexbot_current_org_id",
  WORKSPACE_ID: "privexbot_current_workspace_id",
};

interface AppContextType {
  // State
  organizations: Organization[];
  workspaces: Workspace[];
  currentOrganization: Organization | null;
  currentWorkspace: Workspace | null;
  permissions: PermissionMap;
  isLoading: boolean;
  error: string | null;

  // Context switching
  switchOrganization: (orgId: string, workspaceId?: string) => Promise<void>;
  switchWorkspace: (workspaceId: string) => Promise<void>;

  // Workspace management
  createWorkspace: (name: string, description?: string) => Promise<Workspace>;

  // Permissions
  hasPermission: (permission: Permission) => boolean;

  // Utility
  refreshData: () => Promise<void>;
  clearError: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth();

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [permissions, setPermissions] = useState<PermissionMap>({} as PermissionMap);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Refresh all data: organizations, workspaces, and restore context
   */
  const refreshData = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      setIsLoading(true);
      setError(null);

      console.log("[AppContext] Refreshing data...");

      // Step 1: Get all organizations
      const orgsResponse = await organizationApi.list();
      console.log("[AppContext] Organizations loaded:", orgsResponse);
      setOrganizations(orgsResponse.organizations);

      if (orgsResponse.organizations.length === 0) {
        console.error("[AppContext] No organizations found!");
        throw new Error("No organizations found. Backend needs to create default org on signup.");
      }

      // Step 2: Restore last context from localStorage
      const savedOrgId = localStorage.getItem(STORAGE_KEYS.ORG_ID);
      const savedWorkspaceId = localStorage.getItem(STORAGE_KEYS.WORKSPACE_ID);

      // Step 3: Determine target organization
      let targetOrg: Organization | null = null;

      if (savedOrgId) {
        targetOrg = orgsResponse.organizations.find((o) => o.id === savedOrgId) || null;
      }

      if (!targetOrg) {
        // Fallback: Use first organization (usually Personal)
        targetOrg = orgsResponse.organizations[0];
      }

      setCurrentOrganization(targetOrg);

      // Step 4: Get workspaces for selected organization
      console.log("[AppContext] Loading workspaces for org:", targetOrg.id);
      const workspacesData = await organizationApi.getWorkspaces(targetOrg.id);
      console.log("[AppContext] Workspaces loaded:", workspacesData);
      setWorkspaces(workspacesData);

      if (workspacesData.length === 0) {
        console.error("[AppContext] No workspaces found for organization!");
        throw new Error("No workspaces found. Backend needs to create default workspace on signup.");
      }

      // Step 5: Determine target workspace
      let targetWorkspace: Workspace | null = null;

      if (savedWorkspaceId) {
        targetWorkspace = workspacesData.find((w) => w.id === savedWorkspaceId) || null;
      }

      if (!targetWorkspace) {
        // Fallback: Use default workspace or first workspace
        targetWorkspace =
          workspacesData.find((w) => w.is_default) || workspacesData[0];
      }

      setCurrentWorkspace(targetWorkspace);

      // Step 6: Persist to localStorage
      localStorage.setItem(STORAGE_KEYS.ORG_ID, targetOrg.id);
      localStorage.setItem(STORAGE_KEYS.WORKSPACE_ID, targetWorkspace.id);

      // Step 7: Calculate permissions
      const perms = calculatePermissions(targetOrg, targetWorkspace);
      setPermissions(perms);
    } catch (err: any) {
      console.error("Failed to refresh app data:", err);
      setError(err.message || "Failed to load app data");
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  /**
   * Switch organization context (and workspace)
   */
  const switchOrganization = useCallback(
    async (orgId: string, workspaceId?: string) => {
      if (!isAuthenticated) return;

      try {
        setIsLoading(true);
        setError(null);

        // Find organization in current state
        let org = organizations.find((o) => o.id === orgId);

        // If not found, refresh organizations list (might be newly created)
        if (!org) {
          console.log("[AppContext] Organization not in state, refreshing list...");
          const orgsResponse = await organizationApi.list();
          setOrganizations(orgsResponse.organizations);
          org = orgsResponse.organizations.find((o) => o.id === orgId);

          if (!org) {
            throw new Error("Organization not found");
          }
        }

        setCurrentOrganization(org);

        // Get workspaces for organization
        const workspacesData = await organizationApi.getWorkspaces(orgId);
        setWorkspaces(workspacesData);

        // Determine target workspace
        let targetWorkspace: Workspace;
        if (workspaceId) {
          const ws = workspacesData.find((w) => w.id === workspaceId);
          if (!ws) {
            throw new Error("Workspace not found");
          }
          targetWorkspace = ws;
        } else {
          // Use default workspace
          targetWorkspace =
            workspacesData.find((w) => w.is_default) || workspacesData[0];
        }

        setCurrentWorkspace(targetWorkspace);

        // Persist to localStorage
        localStorage.setItem(STORAGE_KEYS.ORG_ID, orgId);
        localStorage.setItem(STORAGE_KEYS.WORKSPACE_ID, targetWorkspace.id);

        // Calculate new permissions
        const perms = calculatePermissions(org, targetWorkspace);
        setPermissions(perms);

        // Update backend context (get new JWT)
        const response = await workspaceApi.switchOrganization({
          organization_id: orgId,
          workspace_id: targetWorkspace.id,
        });

        // Update JWT token
        if (response.access_token) {
          localStorage.setItem("access_token", response.access_token);
        }
      } catch (err: any) {
        console.error("Failed to switch organization:", err);
        setError(err.message || "Failed to switch organization");
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [isAuthenticated, organizations]
  );

  /**
   * Switch workspace context (same organization)
   */
  const switchWorkspace = useCallback(
    async (workspaceId: string) => {
      if (!isAuthenticated || !currentOrganization) return;

      try {
        setIsLoading(true);
        setError(null);

        // Find workspace in current state
        let workspace = workspaces.find((w) => w.id === workspaceId);

        // If not found, refresh workspaces list (might be newly created)
        if (!workspace) {
          console.log("[AppContext] Workspace not in state, refreshing list...");
          const workspacesData = await organizationApi.getWorkspaces(currentOrganization.id);
          setWorkspaces(workspacesData);
          workspace = workspacesData.find((w) => w.id === workspaceId);

          if (!workspace) {
            throw new Error("Workspace not found");
          }
        }

        setCurrentWorkspace(workspace);

        // Persist to localStorage
        localStorage.setItem(STORAGE_KEYS.WORKSPACE_ID, workspaceId);

        // Calculate new permissions
        const perms = calculatePermissions(currentOrganization, workspace);
        setPermissions(perms);

        // Update backend context (get new JWT)
        const response = await workspaceApi.switchWorkspace({
          workspace_id: workspaceId,
        });

        // Update JWT token
        if (response.access_token) {
          localStorage.setItem("access_token", response.access_token);
        }
      } catch (err: any) {
        console.error("Failed to switch workspace:", err);
        setError(err.message || "Failed to switch workspace");
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [isAuthenticated, currentOrganization, workspaces]
  );

  /**
   * Create new workspace in current organization
   */
  const createWorkspace = useCallback(
    async (name: string, description?: string): Promise<Workspace> => {
      if (!isAuthenticated || !currentOrganization) {
        throw new Error("No organization selected");
      }

      // Check permission
      if (!checkPermission(permissions, "workspace:create")) {
        throw new Error("You do not have permission to create workspaces");
      }

      try {
        setIsLoading(true);
        setError(null);

        const data: CreateWorkspaceRequest = {
          name,
          description,
          // organization_id removed - now comes from URL path parameter
        };
        const newWorkspace = await workspaceApi.create(currentOrganization.id, data);

        // Add to workspaces list
        setWorkspaces([...workspaces, newWorkspace]);

        return newWorkspace;
      } catch (err: any) {
        console.error("Failed to create workspace:", err);
        setError(err.message || "Failed to create workspace");
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [isAuthenticated, currentOrganization, workspaces, permissions]
  );

  /**
   * Check if user has a specific permission
   */
  const hasPermission = useCallback(
    (permission: Permission): boolean => {
      return checkPermission(permissions, permission);
    },
    [permissions]
  );

  /**
   * Clear error
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Initialize on mount when user is authenticated
   */
  useEffect(() => {
    if (isAuthenticated && user) {
      refreshData();
    }
  }, [isAuthenticated, user, refreshData]);

  const value: AppContextType = {
    organizations,
    workspaces,
    currentOrganization,
    currentWorkspace,
    permissions,
    isLoading,
    error,
    switchOrganization,
    switchWorkspace,
    createWorkspace,
    hasPermission,
    refreshData,
    clearError,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

/**
 * Hook to use AppContext
 */
export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
}
