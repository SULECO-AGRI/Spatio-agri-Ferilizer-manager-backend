import { Router } from "express";
import { ServiceRequestController } from "../controllers/service-request.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";
import {
  validateParams,
  validateQuery,
  validateBody,
} from "../middlewares/validate.middleware";
import {
  serviceRequestIdParamSchema,
  createServiceRequestSchema,
  serviceRequestListQuerySchema,
  assignPilotSchema,
  updateServiceRequestStatusSchema,
} from "../validations/service-request.validation";

const router = Router();

// Mount authentication on all service request routes
router.use(authenticate);

/**
 * @route   POST /service-requests
 * @desc    Create a new agricultural spraying service request for a field
 * @access  Private (Farmer Only)
 */
router.post(
  "/",
  authorize("Farmer", "Admin"),
  validateBody(createServiceRequestSchema),
  ServiceRequestController.createServiceRequest
);

/**
 * @route   GET /service-requests
 * @desc    List all service requests (Admin sees all; Farmer sees own; Pilot sees assigned)
 * @access  Private (Admin, Farmer, Pilot)
 */
router.get(
  "/",
  authorize("Admin", "Farmer", "Pilot"),
  validateQuery(serviceRequestListQuerySchema),
  ServiceRequestController.getAllServiceRequests
);

/**
 * @route   GET /service-requests/counts
 * @desc    Get aggregated service request status counts for summary metrics / badges
 * @access  Private (Admin, Farmer, Pilot)
 */
router.get(
  "/counts",
  authorize("Admin", "Farmer", "Pilot"),
  ServiceRequestController.getStatusCounts
);

/**
 * @route   GET /service-requests/:id
 * @desc    Get single service request detailed inspection with farmer, field & mission data
 * @access  Private (Admin, Farmer, Pilot)
 */
router.get(
  "/:id",
  authorize("Admin", "Farmer", "Pilot"),
  validateParams(serviceRequestIdParamSchema),
  ServiceRequestController.getServiceRequestById
);

/**
 * @route   GET /service-requests/:id/candidate-pilots
 * @desc    Get recommended and ranked candidate pilots for a service request
 * @access  Private (Admin Only)
 */
router.get(
  "/:id/candidate-pilots",
  authorize("Admin"),
  validateParams(serviceRequestIdParamSchema),
  ServiceRequestController.getCandidatePilots
);

/**
 * @route   POST /service-requests/:id/assign
 * @desc    Assign pilot to service request and schedule mission
 * @access  Private (Admin Only)
 */
router.post(
  "/:id/assign",
  authorize("Admin"),
  validateParams(serviceRequestIdParamSchema),
  validateBody(assignPilotSchema),
  ServiceRequestController.assignPilot
);

/**
 * @route   PATCH /service-requests/:id/status
 * @desc    Update service request lifecycle status
 * @access  Private (Admin, or Farmer for cancellation)
 */
router.patch(
  "/:id/status",
  authorize("Admin", "Farmer"),
  validateParams(serviceRequestIdParamSchema),
  validateBody(updateServiceRequestStatusSchema),
  ServiceRequestController.updateStatus
);

/**
 * @route   DELETE /service-requests/:id
 * @desc    Delete a service request (Admin, or Farmer for own eligible requests)
 * @access  Private (Admin, Farmer)
 */
router.delete(
  "/:id",
  authorize("Admin", "Farmer"),
  validateParams(serviceRequestIdParamSchema),
  ServiceRequestController.deleteServiceRequest
);

export default router;

