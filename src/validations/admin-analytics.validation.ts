import { z } from "zod";

/**
 * Query Schema: Pilot Performance Table
 */
export const pilotPerformanceTableQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1))
    .refine((val) => val >= 1, { message: "page must be 1 or greater" }),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 10))
    .refine((val) => val >= 1 && val <= 100, {
      message: "limit must be between 1 and 100",
    }),
  search: z
    .string()
    .max(100, "search query cannot exceed 100 characters")
    .optional()
    .transform((val) => (val ? val.trim() : undefined)),
  status: z
    .enum(["ACTIVE", "INACTIVE", "ON_MISSION", "SUSPENDED"])
    .optional(),
  sortBy: z
    .enum([
      "pilotName",
      "completedMissions",
      "ratings",
      "totalFlightHours",
      "totalEarnings",
      "createdAt",
    ])
    .optional()
    .default("completedMissions"),
  sortOrder: z
    .enum(["asc", "desc"])
    .optional()
    .default("desc"),
});
