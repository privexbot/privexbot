/**
 * Permission Calculation Utility
 *
 * WHY: Calculate user permissions based on organization and workspace roles
 * HOW: Role hierarchy determines available permissions
 *
 * ROLE HIERARCHY:
 * - Organization: owner > admin > member
 * - Workspace: admin > editor > viewer
 *
 * PERMISSION RULES:
 * - Org owners/admins have full workspace permissions
 * - Workspace admins can manage workspace but not org
 * - Workspace editors can create/edit resources
 * - Workspace viewers can only view resources
 */

import type {
  Organization,
  Workspace,
  Permission,
  PermissionMap,
  OrganizationRole,
  WorkspaceRole,
} from "@/types/tenant";

/**
 * Calculate permissions based on organization and workspace roles
 */
export function calculatePermissions(
  org: Organization | null,
  workspace: Workspace | null
): PermissionMap {
  // Default: no permissions
  if (!org) {
    return {} as PermissionMap;
  }

  const orgRole: OrganizationRole = org.user_role;
  const workspaceRole: WorkspaceRole | undefined = workspace?.user_role;

  // Organization role checks
  const isOrgOwner = orgRole === "owner";
  const isOrgAdmin = orgRole === "admin" || isOrgOwner;
  const isOrgMember = orgRole === "member" || isOrgAdmin;

  // Workspace role checks (if workspace exists)
  const isWorkspaceAdmin = workspaceRole === "admin";
  const isWorkspaceEditor = workspaceRole === "editor" || isWorkspaceAdmin;
  const isWorkspaceViewer = workspaceRole === "viewer" || isWorkspaceEditor;

  return {
    // Organization-level permissions
    "org:read": isOrgMember,
    "org:write": isOrgAdmin,
    "org:billing": isOrgOwner,
    "org:members": isOrgAdmin,

    // Workspace-level permissions
    "workspace:read": isOrgMember,
    "workspace:write": isOrgAdmin || isWorkspaceAdmin,
    "workspace:create": isOrgAdmin,
    "workspace:delete": isOrgAdmin,
    "workspace:members": isOrgAdmin || isWorkspaceAdmin,

    // Chatbot permissions (even viewers can create)
    "chatbot:view": isWorkspaceViewer,
    "chatbot:create": isWorkspaceViewer, // Special: viewers can create
    "chatbot:edit": isWorkspaceEditor,
    "chatbot:delete": isOrgAdmin || isWorkspaceAdmin,

    // Chatflow permissions (requires editor+)
    "chatflow:view": isWorkspaceViewer,
    "chatflow:create": isWorkspaceEditor, // Only editor+ can create
    "chatflow:edit": isWorkspaceEditor,
    "chatflow:delete": isOrgAdmin || isWorkspaceAdmin,

    // Knowledge Base permissions
    "kb:view": isWorkspaceViewer,
    "kb:create": isWorkspaceEditor,
    "kb:edit": isWorkspaceEditor,
    "kb:delete": isOrgAdmin || isWorkspaceAdmin,

    // Lead permissions
    "lead:view": isWorkspaceViewer,
    "lead:export": isWorkspaceEditor,
    "lead:edit": isWorkspaceEditor,
    "lead:delete": isOrgAdmin || isWorkspaceAdmin,
  };
}

/**
 * Check if user has a specific permission
 */
export function hasPermission(permissions: PermissionMap, permission: Permission): boolean {
  return permissions[permission] === true;
}

/**
 * Check if user has any of the specified permissions
 */
export function hasAnyPermission(permissions: PermissionMap, perms: Permission[]): boolean {
  return perms.some((perm) => hasPermission(permissions, perm));
}

/**
 * Check if user has all of the specified permissions
 */
export function hasAllPermissions(permissions: PermissionMap, perms: Permission[]): boolean {
  return perms.every((perm) => hasPermission(permissions, perm));
}
