/**
 * Primitive Schema Validators
 *
 * WHY: Reusable, low-level validators used across all domains
 * HOW: Zod schemas for common data types
 *
 * USAGE:
 * import { emailSchema, uuidSchema } from "@/lib/schemas/primitives";
 * const mySchema = z.object({ email: emailSchema });
 */

import { z } from "zod";

/**
 * Email validator
 * Trims whitespace, converts to lowercase, validates format
 */
export const emailSchema = z
  .string()
  .min(1, "Email is required")
  .email("Please enter a valid email address")
  .trim()
  .toLowerCase();

/**
 * UUID validator
 * Validates v4 UUID format
 */
export const uuidSchema = z
  .string()
  .uuid("Please enter a valid UUID");

/**
 * Non-empty string validator
 * Trims whitespace and ensures not empty
 */
export const nonEmptyStringSchema = (fieldName: string = "This field") =>
  z
    .string()
    .min(1, `${fieldName} is required`)
    .trim();

/**
 * Optional string validator
 * Allows empty string or undefined, trims if provided
 */
export const optionalStringSchema = z
  .string()
  .trim()
  .optional()
  .or(z.literal(""));

/**
 * Name validator (1-255 characters)
 * Common for organization names, workspace names, etc.
 */
export const nameSchema = (fieldName: string = "Name") =>
  z
    .string()
    .min(1, `${fieldName} is required`)
    .max(255, `${fieldName} must be less than 255 characters`)
    .trim();

/**
 * Description validator (max 1000 characters)
 * Common for descriptions across entities
 */
export const descriptionSchema = z
  .string()
  .max(1000, "Description must be less than 1000 characters")
  .trim()
  .optional()
  .or(z.literal(""));

/**
 * URL validator
 */
export const urlSchema = z
  .string()
  .url("Please enter a valid URL")
  .trim();

/**
 * Phone number validator (basic)
 * Accepts various formats, trims whitespace
 */
export const phoneSchema = z
  .string()
  .regex(/^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/, "Please enter a valid phone number")
  .trim();

/**
 * Pagination schema
 * For list endpoints with page/page_size
 */
export const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  page_size: z.number().int().min(1).max(100).default(20),
});

export type PaginationParams = z.infer<typeof paginationSchema>;
