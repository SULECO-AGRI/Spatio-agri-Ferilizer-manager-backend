import { z } from "zod";

/**
 * 1. Path Parameter: Pilot ID
 */
export const pilotIdParamSchema = z.object({
  id: z
    .string()
    .regex(/^\d+$/, "Pilot ID must be a valid numeric integer")
    .transform((val) => parseInt(val, 10))
    .refine((val) => val > 0, { message: "Pilot ID must be greater than zero" }),
});

/**
 * 2. Path Parameter: Mission ID and Pilot ID composite check
 */
export const pilotMissionParamsSchema = z.object({
  id: z
    .string()
    .regex(/^\d+$/, "Pilot ID must be a valid numeric integer")
    .transform((val) => parseInt(val, 10))
    .refine((val) => val > 0, { message: "Pilot ID must be greater than zero" }),
  missionId: z
    .string()
    .regex(/^\d+$/, "Mission ID must be a valid numeric integer")
    .transform((val) => parseInt(val, 10))
    .refine((val) => val > 0, { message: "Mission ID must be greater than zero" }),
});

/**
 * 3. Query Schema: List all pilots
 */
export const pilotListQuerySchema = z.object({
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
    .enum(["ACTIVE", "INACTIVE", "ON_MISSION", "SUSPENDED"])
    .optional(),
  sortBy: z
    .enum([
      "createdAt",
      "name",
      "ratings",
      "completedMissions",
      "totalFlightHours",
    ])
    .optional()
    .default("createdAt"),
  sortOrder: z
    .enum(["asc", "desc"])
    .optional()
    .default("desc"),
});

/**
 * 4. Body Schema: Update Pilot Status
 */
export const updatePilotStatusSchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE", "ON_MISSION", "SUSPENDED"], {
    message:
      "Status must be one of: ACTIVE, INACTIVE, ON_MISSION, SUSPENDED",
  }),
});

/**
 * 5. Query Schema: Pilot Missions History
 */
export const pilotMissionQuerySchema = z.object({
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
    .enum(["SCHEDULED", "IN_PROGRESS", "COMPLETED", "FAILED"])
    .optional(),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "startDate must be in YYYY-MM-DD format")
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "endDate must be in YYYY-MM-DD format")
    .optional(),
});

/**
 * 6. Body Schema: Complete Mission
 */
export const completeMissionSchema = z.object({
  areaSpread: z
    .number({ message: "areaSpread is required and must be a number" })
    .positive("areaSpread must be a strictly positive number in acres/hectares")
    .max(10000, "areaSpread exceeds allowable limit"),
  flightDurationHours: z
    .number({ message: "flightDurationHours is required and must be a number" })
    .positive("flightDurationHours must be a strictly positive number")
    .max(24, "flightDurationHours cannot exceed 24 hours in a single mission"),
  pilotNotes: z
    .string()
    .max(1000, "pilotNotes cannot exceed 1000 characters")
    .optional()
    .transform((val) => (val ? val.trim() : undefined)),
});

/**
 * 7. Query Schema: Pilot Payouts
 */
export const pilotPayoutQuerySchema = z.object({
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
    .enum(["PENDING", "PROCESSING", "SETTLED", "FAILED"])
    .optional(),
});

/**
 * 8. Query Schema: Pilot Reviews
 */
export const pilotReviewQuerySchema = z.object({
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
  minRating: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : undefined))
    .refine((val) => val === undefined || (val >= 1 && val <= 5), {
      message: "minRating must be between 1 and 5",
    }),
  maxRating: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : undefined))
    .refine((val) => val === undefined || (val >= 1 && val <= 5), {
      message: "maxRating must be between 1 and 5",
    }),
});

/**
 * 9. Path Parameter: Single Mission ID
 */
export const missionIdParamSchema = z.object({
  missionId: z
    .string()
    .regex(/^\d+$/, "Mission ID must be a valid numeric integer")
    .transform((val) => parseInt(val, 10))
    .refine((val) => val > 0, { message: "Mission ID must be greater than zero" }),
});

/**
 * 10. Body Schema: Pilot Mission Response (Accept / Reject)
 */
export const respondMissionSchema = z.object({
  action: z.enum(["ACCEPT", "REJECT"], {
    message: "Action must be either 'ACCEPT' or 'REJECT'",
  }),
  rejectionReason: z
    .string()
    .max(1000, "Rejection reason cannot exceed 1000 characters")
    .optional()
    .transform((val) => (val ? val.trim() : undefined)),
});

