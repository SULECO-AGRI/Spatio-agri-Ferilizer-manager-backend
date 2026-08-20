import { z } from "zod";

/**
 * 1. Path Parameter: Service Request ID
 */
export const serviceRequestIdParamSchema = z.object({
  id: z
    .string()
    .regex(/^\d+$/, "Service Request ID must be a valid numeric integer")
    .transform((val) => parseInt(val, 10))
    .refine((val) => val > 0, { message: "Service Request ID must be greater than zero" }),
});

/**
 * 2. Body Schema: Create Service Request (Farmer Only)
 */
export const createServiceRequestSchema = z.object({
  fieldId: z
    .number({ message: "fieldId is required and must be a number" })
    .int("fieldId must be an integer")
    .positive("fieldId must be a positive integer"),
  serviceType: z
    .enum(["FERTILIZING"], {
      message: "serviceType must be 'FERTILIZING'",
    })
    .default("FERTILIZING"),
  preferredDate: z
    .string({ message: "preferredDate is required" })
    .regex(/^\d{4}-\d{2}-\d{2}$/, "preferredDate must be in YYYY-MM-DD format")
    .refine(
      (val) => {
        const date = new Date(val);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return !isNaN(date.getTime()) && date >= today;
      },
      { message: "preferredDate cannot be in the past" }
    ),
  priority: z
    .enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"], {
      message: "priority must be one of: LOW, MEDIUM, HIGH, CRITICAL",
    })
    .optional()
    .default("MEDIUM"),
  estimatedCost: z
    .number()
    .nonnegative("estimatedCost cannot be negative")
    .optional(),
});

/**
 * 3. Body Schema: Assign Pilot to Service Request (Admin Only)
 */
export const assignPilotSchema = z.object({
  pilotId: z
    .number({ message: "pilotId is required and must be a number" })
    .int("pilotId must be an integer")
    .positive("pilotId must be a positive integer"),
  pilotNotes: z
    .string()
    .max(1000, "pilotNotes cannot exceed 1000 characters")
    .optional()
    .transform((val) => (val ? val.trim() : undefined)),
});

/**
 * 4. Body Schema: Update Service Request Status
 */
export const updateServiceRequestStatusSchema = z.object({
  status: z.enum(
    [
      "PENDING",
      "ASSIGNED",
      "IN_PROGRESS",
      "COMPLETED",
      "CANCELLED",
      "REJECTED",
    ],
    {
      message:
        "Status must be one of: PENDING, ASSIGNED, IN_PROGRESS, COMPLETED, CANCELLED, REJECTED",
    }
  ),
});

/**
 * 5. Query Schema: List Service Requests
 */
export const serviceRequestListQuerySchema = z.object({
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
  farmerId: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : undefined))
    .refine((val) => val === undefined || val > 0, {
      message: "farmerId must be a positive integer",
    }),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "startDate must be in YYYY-MM-DD format")
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "endDate must be in YYYY-MM-DD format")
    .optional(),
  sortBy: z
    .enum(["createdAt", "preferredDate", "priority", "status", "estimatedCost"])
    .optional()
    .default("createdAt"),
  sortOrder: z
    .enum(["asc", "desc"])
    .optional()
    .default("desc"),
});
