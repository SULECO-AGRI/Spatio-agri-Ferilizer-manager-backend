import { z } from "zod";

/**
 * 1. Path Params Validation: Field ID
 */
export const fieldIdParamSchema = z.object({
  id: z
    .string({ message: "Field ID parameter is required" })
    .regex(/^\d+$/, "Field ID must be a positive integer")
    .transform(Number),
});

/**
 * 2. Query Validation: List Fields
 */
export const fieldListQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? Number(val) : 1))
    .refine((val) => Number.isInteger(val) && val > 0, {
      message: "Page must be a positive integer",
    }),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? Number(val) : 10))
    .refine((val) => Number.isInteger(val) && val > 0 && val <= 100, {
      message: "Limit must be between 1 and 100",
    }),
  search: z
    .string()
    .optional()
    .transform((val) => val?.trim()),
  cropType: z
    .string()
    .optional()
    .transform((val) => val?.trim()),
  district: z
    .string()
    .optional()
    .transform((val) => val?.trim()),
  province: z
    .string()
    .optional()
    .transform((val) => val?.trim()),
  farmerId: z
    .string()
    .optional()
    .transform((val) => (val ? Number(val) : undefined))
    .refine((val) => val === undefined || (Number.isInteger(val) && val > 0), {
      message: "farmerId must be a positive integer",
    }),
  sortBy: z
    .enum(["fieldName", "area", "createdAt", "cropType"])
    .optional()
    .default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
});

/**
 * 3. Body Validation: Create Field
 */
export const createFieldBodySchema = z.object({
  farmerId: z
    .number()
    .int("farmerId must be an integer")
    .positive("farmerId must be a positive integer")
    .optional(),
  fieldName: z
    .string({ message: "Field name is required" })
    .min(2, "Field name must be at least 2 characters")
    .max(100, "Field name cannot exceed 100 characters")
    .transform((val) => val.trim()),
  cropType: z
    .string({ message: "Crop type is required" })
    .min(2, "Crop type must be at least 2 characters")
    .max(50, "Crop type cannot exceed 50 characters")
    .transform((val) => val.trim()),
  area: z
    .number({ message: "Area in acres is required" })
    .positive("Area must be a positive number")
    .max(10000, "Area exceeds maximum allowable value"),
  locationCoordinates: z
    .array(z.array(z.number()).length(2), {
      message: "locationCoordinates must be an array of [latitude, longitude] pairs",
    })
    .min(3, "At least 3 coordinate points required to define a field polygon"),
  province: z
    .string({ message: "Province is required" })
    .min(2, "Province is required")
    .max(50, "Province cannot exceed 50 characters")
    .transform((val) => val.trim()),
  district: z
    .string({ message: "District is required" })
    .min(2, "District is required")
    .max(50, "District cannot exceed 50 characters")
    .transform((val) => val.trim()),
  city: z
    .string({ message: "City is required" })
    .min(2, "City is required")
    .max(50, "City cannot exceed 50 characters")
    .transform((val) => val.trim()),
  village: z
    .string({ message: "Village is required" })
    .min(2, "Village is required")
    .max(50, "Village cannot exceed 50 characters")
    .transform((val) => val.trim()),
});

/**
 * 4. Body Validation: Update Field
 */
export const updateFieldBodySchema = z.object({
  fieldName: z
    .string()
    .min(2, "Field name must be at least 2 characters")
    .max(100, "Field name cannot exceed 100 characters")
    .transform((val) => val.trim())
    .optional(),
  cropType: z
    .string()
    .min(2, "Crop type must be at least 2 characters")
    .max(50, "Crop type cannot exceed 50 characters")
    .transform((val) => val.trim())
    .optional(),
  area: z
    .number()
    .positive("Area must be a positive number")
    .max(10000, "Area exceeds maximum allowable value")
    .optional(),
  locationCoordinates: z
    .array(z.array(z.number()).length(2))
    .min(3, "At least 3 coordinate points required to define a field polygon")
    .optional(),
  province: z
    .string()
    .min(2, "Province is required")
    .max(50, "Province cannot exceed 50 characters")
    .transform((val) => val.trim())
    .optional(),
  district: z
    .string()
    .min(2, "District is required")
    .max(50, "District cannot exceed 50 characters")
    .transform((val) => val.trim())
    .optional(),
  city: z
    .string()
    .min(2, "City is required")
    .max(50, "City cannot exceed 50 characters")
    .transform((val) => val.trim())
    .optional(),
  village: z
    .string()
    .min(2, "Village is required")
    .max(50, "Village cannot exceed 50 characters")
    .transform((val) => val.trim())
    .optional(),
});
