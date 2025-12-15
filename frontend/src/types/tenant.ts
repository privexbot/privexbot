/**
 * Multi-Tenancy Type Definitions
 *
 * WHY: Type-safe organization, workspace, and permission management
 * HOW: TypeScript interfaces matching backend API responses
 *
 * HIERARCHY:
 * User → Organizations → Workspaces → Resources (Chatbots, KBs, etc.)
 */

// Organization roles
export type OrganizationRole = "owner" | "admin" | "member";

// Workspace roles
export type WorkspaceRole = "admin" | "editor" | "viewer";

// Subscription tiers - FREE → STARTER → PRO → ENTERPRISE
export type SubscriptionTier = "free" | "starter" | "pro" | "enterprise";

/**
 * Organization
 */
export interface Organization {
  id: string;
  name: string;
  billing_email: string;
  avatar_url?: string;
  subscription_tier: SubscriptionTier;
  user_role: OrganizationRole;
  member_count: number;
  workspace_count?: number;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Organization Member
 */
export interface OrganizationMember {
  id: string;
  user_id: string;
  username: string;
  email?: string;
  role: OrganizationRole;
  invited_by?: string;
  joined_at: string;
  created_at: string;
}

/**
 * Workspace
 */
export interface Workspace {
  id: string;
  name: string;
  description?: string;
  avatar_url?: string;
  organization_id: string;
  user_role: WorkspaceRole;
  is_default: boolean;
  member_count: number;
  created_at: string;
  updated_at: string;
}

/**
 * Workspace Member
 */
export interface WorkspaceMember {
  id: string;
  user_id: string;
  username: string;
  email?: string;
  role: WorkspaceRole;
  invited_by?: string;
  joined_at: string;
  created_at: string;
}

/**
 * Permission keys
 */
export type Permission =
  // Organization-level
  | "org:read"
  | "org:write"
  | "org:billing"
  | "org:members"
  // Workspace-level
  | "workspace:read"
  | "workspace:write"
  | "workspace:create"
  | "workspace:delete"
  | "workspace:members"
  // Chatbot permissions
  | "chatbot:view"
  | "chatbot:create"
  | "chatbot:edit"
  | "chatbot:delete"
  // Chatflow permissions
  | "chatflow:view"
  | "chatflow:create"
  | "chatflow:edit"
  | "chatflow:delete"
  // Knowledge Base permissions
  | "kb:view"
  | "kb:create"
  | "kb:edit"
  | "kb:delete"
  // Lead permissions
  | "lead:view"
  | "lead:export"
  | "lead:edit"
  | "lead:delete";

/**
 * Permission map
 */
export type PermissionMap = Record<Permission, boolean>;

/**
 * Create organization request
 */
export interface CreateOrganizationRequest {
  name: string;
  billing_email: string;
}

/**
 * Create organization response
 */
export interface CreateOrganizationResponse extends Organization {
  default_workspace: Workspace;
}

/**
 * List organizations response
 */
export interface ListOrganizationsResponse {
  organizations: Organization[];
  total: number;
  page: number;
  page_size: number;
}

/**
 * Create workspace request
 * NOTE: organization_id comes from URL path parameter
 */
export interface CreateWorkspaceRequest {
  name: string;
  description?: string;
}

/**
 * Switch organization request
 */
export interface SwitchOrganizationRequest {
  organization_id: string;
  workspace_id?: string; // Optional, uses default if not provided
}

/**
 * Switch workspace request
 */
export interface SwitchWorkspaceRequest {
  workspace_id: string;
}

/**
 * Context switch response
 */
export interface ContextSwitchResponse {
  access_token: string;
  organization_id: string;
  workspace_id: string;
}

/**
 * Current context response
 */
export interface CurrentContextResponse {
  organization_id: string;
  workspace_id: string;
  user_id: string;
}

// Invitation types

/**
 * Invitation resource type
 */
export type InvitationResourceType = "organization" | "workspace";

/**
 * Invitation status
 */
export type InvitationStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "expired"
  | "cancelled";

/**
 * Invitation
 */
export interface Invitation {
  id: string;
  email: string;
  resource_type: InvitationResourceType;
  resource_id: string;
  invited_role: string;
  status: InvitationStatus;
  invited_by?: string;
  invited_at: string;
  expires_at: string;
  accepted_at?: string;
}

/**
 * Invitation details (public view)
 */
export interface InvitationDetails {
  resource_type: InvitationResourceType;
  resource_name: string;
  invited_role: string;
  inviter_name?: string;
  expires_at: string;
  is_expired: boolean;
}

/**
 * Create invitation request
 */
export interface CreateInvitationRequest {
  email: string;
  resource_type: InvitationResourceType;
  resource_id: string;
  role: string;
}

/**
 * List invitations response
 */
export interface ListInvitationsResponse {
  invitations: Invitation[];
  total: number;
  pending_count: number;
  accepted_count: number;
  expired_count: number;
}

/**
 * Invitation statistics
 */
export interface InvitationStatistics {
  total_sent: number;
  pending: number;
  accepted: number;
  rejected: number;
  expired: number;
  cancelled: number;
}
