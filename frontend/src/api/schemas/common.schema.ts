/**
 * Common API Schemas
 *
 * WHY: Shared patterns across all API domains
 * HOW: Reusable schemas for pagination, filtering, sorting
 *
 * USAGE:
 * import { paginatedResponseSchema } from "@/api/schemas/common.schema";
 */

import { z } from "zod";
import { paginationSchema } from "@/lib/schemas/primitives";

/**
 * Paginated Response Schema
 * Generic wrapper for list endpoints
 */
export const paginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    total: z.number().int().min(0),
    page: z.number().int().min(1),
    page_size: z.number().int().min(1),
  });

/**
 * Sort Direction Schema
 */
export const sortDirectionSchema = z.enum(["asc", "desc"]);

/**
 * Sort Schema
 * Generic sorting parameters
 */
export const sortSchema = z.object({
  sort_by: z.string().optional(),
  sort_direction: sortDirectionSchema.default("asc"),
});

/**
 * Filter Schema
 * Generic filtering with search query
 */
export const filterSchema = z.object({
  search: z.string().optional(),
  ...paginationSchema.shape,
  ...sortSchema.shape,
});

export type FilterParams = z.infer<typeof filterSchema>;

/**
 * ID Parameter Schema
 * For route parameters
 */
export const idParamSchema = z.object({
  id: z.string().uuid("Invalid ID format"),
});

/**
 * API Error Response Schema
 * Standard error format from backend
 */
export const apiErrorSchema = z.object({
  detail: z.union([
    z.string(),
    z.array(z.object({
      msg: z.string(),
      type: z.string().optional(),
      loc: z.array(z.union([z.string(), z.number()])).optional(),
    })),
    z.record(z.any()),
  ]),
  status_code: z.number().optional(),
});

export type ApiError = z.infer<typeof apiErrorSchema>;

/**
 * Success Response Schema
 * Generic success wrapper
 */
export const successResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    data: dataSchema,
    message: z.string().optional(),
  });
