import { Router } from "express";
import { AdminController } from "../controllers/admin.controller";
import { ServiceRequestController } from "../controllers/service-request.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";
import {
  validateParams,
  validateQuery,
  validateBody,
} from "../middlewares/validate.middleware";
import {
  adminMetricsQuerySchema,
  adminActivitiesQuerySchema,
  adminScheduleQuerySchema,
} from "../validations/admin.validation";
import {
  serviceRequestIdParamSchema,
  assignPilotSchema,
} from "../validations/service-request.validation";

const router = Router();

// Mount authentication and Admin-only RBAC globally across all admin endpoints
router.use(authenticate);
router.use(authorize("Admin"));

/**
 * @route   GET /admin/dashboard
 * @desc    Get complete aggregated admin executive dashboard overview
 * @access  Private (Admin Only)
 */
router.get("/dashboard", AdminController.getDashboardOverview);

/**
 * @route   GET /admin/dashboard/metrics
 * @desc    Get real-time operational KPIs and financial totals
 * @access  Private (Admin Only)
 */
router.get(
  "/dashboard/metrics",
  validateQuery(adminMetricsQuerySchema),
  AdminController.getDashboardMetrics
);

/**
 * @route   GET /admin/dashboard/activities
 * @desc    Get live recent system activity feed (latest activities)
 * @access  Private (Admin Only)
 */
router.get(
  "/dashboard/activities",
  validateQuery(adminActivitiesQuerySchema),
  AdminController.getRecentActivities
);

/**
 * @route   GET /admin/dashboard/schedule
 * @desc    Get today's flight & mission schedule with field and farmer context
 * @access  Private (Admin Only)
 */
router.get(
  "/dashboard/schedule",
  validateQuery(adminScheduleQuerySchema),
  AdminController.getTodaySchedule
);

/**
 * @route   GET /admin/service-requests/:id/candidate-pilots
 * @desc    Get recommended and ranked candidate pilots for a service request
 * @access  Private (Admin Only)
 */
router.get(
  "/service-requests/:id/candidate-pilots",
  validateParams(serviceRequestIdParamSchema),
  ServiceRequestController.getCandidatePilots
);

/**
 * @route   POST /admin/service-requests/:id/assign
 * @desc    Assign pilot to service request and schedule mission
 * @access  Private (Admin Only)
 */
router.post(
  "/service-requests/:id/assign",
  validateParams(serviceRequestIdParamSchema),
  validateBody(assignPilotSchema),
  ServiceRequestController.assignPilot
);

export default router;

