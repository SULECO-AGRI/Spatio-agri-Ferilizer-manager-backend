import { z } from "zod";

/**
 * 1. Query Schema: Admin Dashboard Metrics
 */
export const adminMetricsQuerySchema = z.object({
  periodDays: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 90))
    .refine((val) => val >= 1 && val <= 365, {
      message: "periodDays must be between 1 and 365 days",
    }),
});

/**
 * 2. Query Schema: Admin Recent Activities Feed
 */
export const adminActivitiesQuerySchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 6))
    .refine((val) => val >= 1 && val <= 50, {
      message: "limit must be an integer between 1 and 50",
    }),
});

/**
 * 3. Query Schema: Admin Today's Flight Schedule
 */
export const adminScheduleQuerySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "date must be in YYYY-MM-DD format")
    .optional(),
  status: z
    .enum(["PENDING", "ASSIGNED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "REJECTED"])
    .optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
});
