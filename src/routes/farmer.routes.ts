import { Router } from "express";
import { FarmerController } from "../controllers/farmer.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";
import {
  validateParams,
  validateQuery,
  validateBody,
} from "../middlewares/validate.middleware";
import {
  farmerIdParamSchema,
  farmerListQuerySchema,
  farmerFieldsQuerySchema,
  createFieldSchema,
  farmerServicesQuerySchema,
  farmerPaymentsQuerySchema,
} from "../validations/farmer.validation";

const router = Router();

// Mount authentication on all farmer routes
router.use(authenticate);

/**
 * @route   GET /farmers
 * @desc    Get paginated set of all farmers with search, sort, and summary stats
 * @access  Private (Admin Only)
 */
router.get(
  "/",
  authorize("Admin"),
  validateQuery(farmerListQuerySchema),
  FarmerController.getAllFarmers
);

/**
 * @route   GET /farmers/:id
 * @desc    Get comprehensive single farmer profile details & aggregated stats
 * @access  Private (Admin or Respective Farmer)
 */
router.get(
  "/:id",
  authorize("Admin", "Farmer"),
  validateParams(farmerIdParamSchema),
  FarmerController.getFarmerById
);

/**
 * @route   GET /farmers/:id/fields
 * @desc    Get all agricultural fields registered to a specific farmer
 * @access  Private (Admin or Respective Farmer)
 */
router.get(
  "/:id/fields",
  authorize("Admin", "Farmer"),
  validateParams(farmerIdParamSchema),
  validateQuery(farmerFieldsQuerySchema),
  FarmerController.getFarmerFields
);

/**
 * @route   POST /farmers/:id/fields
 * @desc    Register a new agricultural field for a farmer
 * @access  Private (Admin for any farmer, Farmer for own account only)
 */
router.post(
  "/:id/fields",
  authorize("Admin", "Farmer"),
  validateParams(farmerIdParamSchema),
  validateBody(createFieldSchema),
  FarmerController.createField
);

/**
 * @route   GET /farmers/:id/services
 * @desc    Get service requests and mission execution history for a farmer
 * @access  Private (Admin or Respective Farmer)
 */
router.get(
  "/:id/services",
  authorize("Admin", "Farmer"),
  validateParams(farmerIdParamSchema),
  validateQuery(farmerServicesQuerySchema),
  FarmerController.getFarmerServiceHistory
);

/**
 * @route   GET /farmers/:id/payments
 * @desc    Get billing transactions and payment history for a farmer
 * @access  Private (Admin or Respective Farmer)
 */
router.get(
  "/:id/payments",
  authorize("Admin", "Farmer"),
  validateParams(farmerIdParamSchema),
  validateQuery(farmerPaymentsQuerySchema),
  FarmerController.getFarmerPayments
);

export default router;
