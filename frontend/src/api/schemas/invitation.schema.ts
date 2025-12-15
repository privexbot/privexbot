/**
 * Invitation Domain Schemas
 *
 * WHY: Validation schemas for invitation-related operations
 * HOW: Uses primitive validators + domain-specific rules
 *
 * DOMAIN: Email-based invitations for organizations and workspaces
 *
 * USAGE:
 * import { createInvitationSchema } from "@/api/schemas/invitation.schema";
 * const form = useForm({ resolver: zodResolver(createInvitationSchema) });
 */

import { z } from "zod";
import { emailSchema } from "@/lib/schemas/primitives";
import { organizationInvitationRoleSchema } from "@/api/schemas/organization.schema";
import { workspaceRoleSchema } from "@/api/schemas/workspace.schema";

/**
 * Invitation Resource Type
 */
export const invitationResourceTypeSchema = z.enum(
  ["organization", "workspace"],
  {
    errorMap: () => ({ message: "Please select a valid resource type" }),
  }
);

export type InvitationResourceType = z.infer<
  typeof invitationResourceTypeSchema
>;

/**
 * Invitation Status
 */
export const invitationStatusSchema = z.enum(
  ["pending", "accepted", "rejected", "expired", "cancelled"],
  {
    errorMap: () => ({ message: "Invalid invitation status" }),
  }
);

export type InvitationStatus = z.infer<typeof invitationStatusSchema>;

/**
 * Create Organization Invitation Schema
 *
 * WHY: Validate organization invitation creation
 * FIELDS: email, role (admin or member only - owner excluded)
 * NOTE: Organizations can only have ONE owner, assigned at creation
 */
export const createOrganizationInvitationSchema = z.object({
  email: emailSchema,
  role: organizationInvitationRoleSchema.default("member"),
});

export type CreateOrganizationInvitationFormData = z.infer<
  typeof createOrganizationInvitationSchema
>;

/**
 * Create Workspace Invitation Schema
 *
 * WHY: Validate workspace invitation creation
 * FIELDS: email, role
 */
export const createWorkspaceInvitationSchema = z.object({
  email: emailSchema,
  role: workspaceRoleSchema.default("viewer"),
});

export type CreateWorkspaceInvitationFormData = z.infer<
  typeof createWorkspaceInvitationSchema
>;

/**
 * Generic Create Invitation Schema (for dynamic forms)
 *
 * WHY: Support both organization and workspace invitations
 * FIELDS: email, role (string), resource_type
 */
export const createInvitationSchema = z.object({
  email: emailSchema,
  role: z.string().min(1, "Role is required"),
  resource_type: invitationResourceTypeSchema.optional(),
});

export type CreateInvitationFormData = z.infer<typeof createInvitationSchema>;

/**
 * Accept Invitation Schema
 *
 * WHY: Validate invitation acceptance (token-based)
 * FIELDS: token (from URL)
 */
export const acceptInvitationSchema = z.object({
  token: z.string().min(1, "Invitation token is required"),
});

export type AcceptInvitationFormData = z.infer<typeof acceptInvitationSchema>;

/**
 * Reject Invitation Schema
 *
 * WHY: Validate invitation rejection (token-based)
 * FIELDS: token (from URL)
 */
export const rejectInvitationSchema = z.object({
  token: z.string().min(1, "Invitation token is required"),
});

export type RejectInvitationFormData = z.infer<typeof rejectInvitationSchema>;
