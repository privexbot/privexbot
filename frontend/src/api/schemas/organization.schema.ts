/**
 * Organization Domain Schemas
 *
 * WHY: Validation schemas for organization-related operations
 * HOW: Uses primitive validators + domain-specific rules
 *
 * DOMAIN: Organizations, members, roles
 *
 * USAGE:
 * import { createOrganizationSchema } from "@/api/schemas/organization.schema";
 * const form = useForm({ resolver: zodResolver(createOrganizationSchema) });
 */

import { z } from "zod";
import { emailSchema, uuidSchema, nameSchema } from "@/lib/schemas/primitives";

/**
 * Organization Roles (all roles including owner)
 *
 * NOTE: Use organizationInvitationRoleSchema for invitations
 */
export const organizationRoleSchema = z.enum(["owner", "admin", "member"], {
  errorMap: () => ({ message: "Please select a valid role" }),
});

export type OrganizationRole = z.infer<typeof organizationRoleSchema>;

/**
 * Organization Invitation Roles (excludes owner)
 *
 * WHY: Organizations should have only ONE owner
 * HOW: Owner is automatically assigned at organization creation
 */
export const organizationInvitationRoleSchema = z.enum(["admin", "member"], {
  errorMap: () => ({ message: "Please select a valid role" }),
});

export type OrganizationInvitationRole = z.infer<
  typeof organizationInvitationRoleSchema
>;

/**
 * Create Organization Schema
 *
 * WHY: Validate organization creation
 * FIELDS: name, billing_email
 */
export const createOrganizationSchema = z.object({
  name: nameSchema("Organization name"),
  billing_email: emailSchema,
});

export type CreateOrganizationFormData = z.infer<
  typeof createOrganizationSchema
>;

/**
 * Edit Organization Schema
 *
 * WHY: Validate organization updates
 * FIELDS: name (optional), billing_email (optional)
 * RULE: At least one field must be provided
 */
export const editOrganizationSchema = z
  .object({
    name: nameSchema("Organization name").optional(),
    billing_email: emailSchema.optional(),
  })
  .refine(
    (data) => data.name !== undefined || data.billing_email !== undefined,
    {
      message: "At least one field must be provided",
      path: ["name"], // Show error on name field
    }
  );

export type EditOrganizationFormData = z.infer<typeof editOrganizationSchema>;

/**
 * Add Organization Member Schema
 *
 * WHY: Validate member invitation
 * FIELDS: user_id (UUID), role (owner/admin/member)
 */
export const addOrganizationMemberSchema = z.object({
  user_id: uuidSchema,
  role: organizationRoleSchema.default("member"),
});

export type AddOrganizationMemberFormData = z.infer<
  typeof addOrganizationMemberSchema
>;

/**
 * Update Organization Member Role Schema
 *
 * WHY: Validate role changes
 * FIELDS: role (owner/admin/member)
 */
export const updateOrganizationMemberRoleSchema = z.object({
  role: organizationRoleSchema,
});

export type UpdateOrganizationMemberRoleFormData = z.infer<
  typeof updateOrganizationMemberRoleSchema
>;

/**
 * Delete Organization Confirmation Schema
 *
 * WHY: Require user to type organization name for confirmation
 * FIELDS: confirmation_name (must match organization name)
 */
export const deleteOrganizationSchema = (organizationName: string) =>
  z.object({
    confirmation_name: z
      .string()
      .min(1, "Please type the organization name to confirm")
      .refine(
        (value) => value === organizationName,
        `Please type "${organizationName}" exactly to confirm deletion`
      ),
  });

export type DeleteOrganizationFormData = z.infer<
  ReturnType<typeof deleteOrganizationSchema>
>;
