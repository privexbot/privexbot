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

/**
 * Email validation schema
 *
 * WHY: Consistent email validation across the app
 * HOW: Standard email format validation
 */
export const emailSchema = z
  .string()
  .min(1, "Email is required")
  .email("Invalid email address")
  .max(254, "Email must be less than 254 characters")
  .trim()
  .toLowerCase();

/**
 * Password validation schema
 *
 * WHY: Ensure secure password requirements
 * HOW: Minimum 8 characters, max 128, require complexity
 */
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password must be less than 128 characters")
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
    "Password must contain at least one lowercase letter, one uppercase letter, and one number"
  );

/**
 * Link Email Schema
 *
 * WHY: Validate email linking requests for wallet-only accounts
 * FIELDS: email, password (both required for creating new email auth)
 */
export const linkEmailSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export type LinkEmailFormData = z.infer<typeof linkEmailSchema>;

/**
 * Unlink Account Confirmation Schema
 *
 * WHY: Require confirmation before removing auth methods
 * FIELDS: confirmation_text (must be exact match)
 */
export const unlinkAccountConfirmationSchema = z.object({
  confirmation_text: z
    .string()
    .min(1, "Please type UNLINK to confirm")
    .refine(
      (value) => value === "UNLINK",
      'Please type "UNLINK" exactly to confirm removal'
    ),
});

export type UnlinkAccountConfirmationFormData = z.infer<
  typeof unlinkAccountConfirmationSchema
>;