/**
 * Workspace Domain Schemas
 *
 * WHY: Validation schemas for workspace-related operations
 * HOW: Uses primitive validators + domain-specific rules
 *
 * DOMAIN: Workspaces, members, roles
 *
 * USAGE:
 * import { createWorkspaceSchema } from "@/api/schemas/workspace.schema";
 * const form = useForm({ resolver: zodResolver(createWorkspaceSchema) });
 */

import { z } from "zod";
import { uuidSchema, nameSchema, descriptionSchema } from "@/lib/schemas/primitives";

/**
 * Workspace Roles
 */
export const workspaceRoleSchema = z.enum(["admin", "editor", "viewer"], {
  errorMap: () => ({ message: "Please select a valid role" }),
});

export type WorkspaceRole = z.infer<typeof workspaceRoleSchema>;

/**
 * Create Workspace Schema
 *
 * WHY: Validate workspace creation
 * FIELDS: name, description (optional)
 * NOTE: organization_id comes from URL path (not in request body)
 */
export const createWorkspaceSchema = z.object({
  name: nameSchema("Workspace name"),
  description: descriptionSchema,
});

export type CreateWorkspaceFormData = z.infer<typeof createWorkspaceSchema>;

/**
 * Edit Workspace Schema
 *
 * WHY: Validate workspace updates
 * FIELDS: name, description (optional)
 */
export const editWorkspaceSchema = z.object({
  name: nameSchema("Workspace name"),
  description: descriptionSchema,
});

export type EditWorkspaceFormData = z.infer<typeof editWorkspaceSchema>;

/**
 * Add Workspace Member Schema
 *
 * WHY: Validate member invitation
 * FIELDS: user_id (UUID), role (admin/editor/viewer)
 */
export const addWorkspaceMemberSchema = z.object({
  user_id: uuidSchema,
  role: workspaceRoleSchema.default("viewer"),
});

export type AddWorkspaceMemberFormData = z.infer<typeof addWorkspaceMemberSchema>;

/**
 * Update Workspace Member Role Schema
 *
 * WHY: Validate role changes
 * FIELDS: role (admin/editor/viewer)
 */
export const updateWorkspaceMemberRoleSchema = z.object({
  role: workspaceRoleSchema,
});

export type UpdateWorkspaceMemberRoleFormData = z.infer<typeof updateWorkspaceMemberRoleSchema>;

/**
 * Delete Workspace Confirmation Schema
 *
 * WHY: Require user to type workspace name for confirmation
 * FIELDS: confirmation_name (must match workspace name)
 * RULE: Cannot delete default workspace
 */
export const deleteWorkspaceSchema = (workspaceName: string, isDefault: boolean = false) =>
  z.object({
    confirmation_name: z
      .string()
      .min(1, "Please type the workspace name to confirm")
      .refine(
        (value) => value === workspaceName,
        `Please type "${workspaceName}" exactly to confirm deletion`
      )
      .refine(
        () => !isDefault,
        "Cannot delete default workspace"
      ),
  });

export type DeleteWorkspaceFormData = z.infer<ReturnType<typeof deleteWorkspaceSchema>>;
