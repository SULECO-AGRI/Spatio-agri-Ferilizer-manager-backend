import { Router } from "express";
import { AdminAnalyticsController } from "../controllers/admin-analytics.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";
import { validateQuery } from "../middlewares/validate.middleware";
import { pilotPerformanceTableQuerySchema } from "../validations/admin-analytics.validation";

const router = Router();

// Mount authentication and Admin-only RBAC globally across all admin analytics endpoints
router.use(authenticate);
router.use(authorize("Admin"));

/**
 * @route   GET /admin/analytics/completed-missions
 * @desc    Get total completed missions metrics and month-over-month growth rate
 * @access  Private (Admin Only)
 */
router.get(
  "/completed-missions",
  AdminAnalyticsController.getCompletedMissionsAnalytics
);

/**
 * @route   GET /admin/analytics/revenue
 * @desc    Get comprehensive revenue analytics, company commissions, and earnings
 * @access  Private (Admin Only)
 */
router.get("/revenue", AdminAnalyticsController.getRevenueAnalytics);

/**
 * @route   GET /admin/analytics/pilot-performance
 * @desc    Get fleet-wide pilot performance KPIs and ratings
 * @access  Private (Admin Only)
 */
router.get(
  "/pilot-performance",
  AdminAnalyticsController.getPilotFleetPerformance
);

/**
 * @route   GET /admin/analytics/farmer-growth
 * @desc    Get farmer registration acquisition metrics and growth percentage
 * @access  Private (Admin Only)
 */
router.get("/farmer-growth", AdminAnalyticsController.getFarmerGrowth);

/**
 * @route   GET /admin/analytics/pilot-performance-table
 * @desc    Get paginated, searchable, and sortable data for the Pilot Performance Table
 * @access  Private (Admin Only)
 */
router.get(
  "/pilot-performance-table",
  validateQuery(pilotPerformanceTableQuerySchema),
  AdminAnalyticsController.getPilotPerformanceTable
);

export default router;
