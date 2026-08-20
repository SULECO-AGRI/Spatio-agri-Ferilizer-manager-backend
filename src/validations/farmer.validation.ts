import { z } from "zod";

/**
 * 1. Path Parameter Validation: ID must be a positive integer
 */
export const farmerIdParamSchema = z.object({
  id: z
    .string()
    .regex(/^\d+$/, "Farmer ID must be a valid numeric integer")
    .transform((val) => parseInt(val, 10))
    .refine((val) => val > 0, { message: "Farmer ID must be greater than zero" }),
});

/**
 * 2. Query Validation: Listing farmers with search, pagination, and sorting
 */
export const farmerListQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1))
    .refine((val) => val >= 1, { message: "Page must be 1 or greater" }),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 10))
    .refine((val) => val >= 1 && val <= 100, {
      message: "Limit must be between 1 and 100",
    }),
  search: z
    .string()
    .max(100, "Search query cannot exceed 100 characters")
    .optional()
    .transform((val) => (val ? val.trim() : undefined)),
  sortBy: z
    .enum(["createdAt", "name", "email", "memberSince"])
    .optional()
    .default("createdAt"),
  sortOrder: z
    .enum(["asc", "desc"])
    .optional()
    .default("desc"),
});

/**
 * 3. Query Validation: Filtering farmer's agricultural fields
 */
export const farmerFieldsQuerySchema = z.object({
  cropType: z
    .string()
    .max(50, "Crop type filter cannot exceed 50 characters")
    .optional()
    .transform((val) => (val ? val.trim() : undefined)),
  district: z
    .string()
    .max(50, "District filter cannot exceed 50 characters")
    .optional()
    .transform((val) => (val ? val.trim() : undefined)),
  province: z
    .string()
    .max(50, "Province filter cannot exceed 50 characters")
    .optional()
    .transform((val) => (val ? val.trim() : undefined)),
});

/**
 * 4. Query Validation: Service & Mission history
 */
export const farmerServicesQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1))
    .refine((val) => val >= 1, { message: "Page must be 1 or greater" }),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 10))
    .refine((val) => val >= 1 && val <= 100, {
      message: "Limit must be between 1 and 100",
    }),
  status: z
    .enum([
      "PENDING",
      "ASSIGNED",
      "IN_PROGRESS",
      "COMPLETED",
      "CANCELLED",
      "REJECTED",
    ])
    .optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  serviceType: z.enum(["FERTILIZING"]).optional(),
  fieldId: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : undefined))
    .refine((val) => val === undefined || val > 0, {
      message: "fieldId must be a positive integer",
    }),
});

/**
 * 5. Query Validation: Payment history
 */
export const farmerPaymentsQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1))
    .refine((val) => val >= 1, { message: "Page must be 1 or greater" }),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 10))
    .refine((val) => val >= 1 && val <= 100, {
      message: "Limit must be between 1 and 100",
    }),
  paymentStatus: z
    .enum(["PENDING", "COMPLETED", "FAILED", "REFUNDED"])
    .optional(),
  paymentMethod: z
    .enum(["BANK_TRANSFER", "CASH", "CARD_GATEWAY", "ONLINE_QR"])
    .optional(),
});

/**
 * 6. Body Validation: Register/Create a Field for a Farmer
 */
export const createFieldSchema = z.object({
  fieldName: z
    .string()
    .min(2, "Field name must be at least 2 characters")
    .max(100, "Field name cannot exceed 100 characters")
    .transform((val) => val.trim()),
  cropType: z
    .string()
    .min(2, "Crop type must be at least 2 characters")
    .max(50, "Crop type cannot exceed 50 characters")
    .transform((val) => val.trim()),
  area: z
    .number()
    .positive("Area must be a positive number in acres")
    .max(10000, "Area exceeds maximum allowable value"),
  locationCoordinates: z
    .array(z.array(z.number()).length(2))
    .min(3, "At least 3 coordinate points required to define a field polygon"),
  province: z
    .string()
    .min(2, "Province is required")
    .max(50, "Province cannot exceed 50 characters")
    .transform((val) => val.trim()),
  district: z
    .string()
    .min(2, "District is required")
    .max(50, "District cannot exceed 50 characters")
    .transform((val) => val.trim()),
  city: z
    .string()
    .min(2, "City is required")
    .max(50, "City cannot exceed 50 characters")
    .transform((val) => val.trim()),
  village: z
    .string()
    .min(2, "Village is required")
    .max(50, "Village cannot exceed 50 characters")
    .transform((val) => val.trim()),
});

/**
 * 7. Body Validation: Update Farmer Profile
 */
export const updateFarmerProfileSchema = z.object({
  firstName: z
    .string()
    .min(2, "First name must be at least 2 characters")
    .max(50, "First name cannot exceed 50 characters")
    .optional(),
  lastName: z
    .string()
    .min(2, "Last name must be at least 2 characters")
    .max(50, "Last name cannot exceed 50 characters")
    .optional(),
  mobile: z
    .string()
    .regex(/^(?:0|94|\+94)?7[0-9]{8}$/, "Invalid Sri Lankan mobile number format")
    .optional(),
  nic: z
    .string()
    .regex(/^(?:[0-9]{9}[vVxX]|[0-9]{12})$/, "Invalid Sri Lankan NIC format")
    .optional(),
  address: z
    .string()
    .min(5, "Address must be at least 5 characters")
    .max(255, "Address cannot exceed 255 characters")
    .optional(),
});
