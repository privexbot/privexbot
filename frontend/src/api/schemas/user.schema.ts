/**
 * User Domain Schemas
 *
 * WHY: Validation schemas for user profile and account operations
 * HOW: Uses primitive validators + domain-specific rules
 *
 * DOMAIN: User profiles, account management, authentication
 *
 * USAGE:
 * import { updateProfileSchema } from "@/api/schemas/user.schema";
 * const form = useForm({ resolver: zodResolver(updateProfileSchema) });
 */

import { z } from "zod";

/**
 * Username validation schema
 *
 * WHY: Consistent username validation across the app
 * HOW: Alphanumeric, underscores, hyphens only, 3-50 characters
 */
export const usernameSchema = z
  .string()
  .min(3, "Username must be at least 3 characters")
  .max(50, "Username must be less than 50 characters")
  .regex(
    /^[a-zA-Z0-9_-]+$/,
    "Username can only contain letters, numbers, underscores, and hyphens"
  )
  .trim();

/**
 * Update Profile Schema
 *
 * WHY: Validate profile update requests
 * FIELDS: username (optional - only update if provided)
 */
export const updateProfileSchema = z.object({
  username: usernameSchema,
});

export type UpdateProfileFormData = z.infer<typeof updateProfileSchema>;

/**
 * Delete Account Confirmation Schema
 *
 * WHY: Require user to type "DELETE" to confirm account deletion
 * FIELDS: confirmation_text (must be exact match)
 */
export const deleteAccountConfirmationSchema = z.object({
  confirmation_text: z
    .string()
    .min(1, "Please type DELETE to confirm")
    .refine(
      (value) => value === "DELETE",
      'Please type "DELETE" exactly to confirm account deletion'
    ),
});

export type DeleteAccountConfirmationFormData = z.infer<
  typeof deleteAccountConfirmationSchema
>;