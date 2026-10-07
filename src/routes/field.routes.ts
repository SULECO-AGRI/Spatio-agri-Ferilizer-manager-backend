import { Router } from "express";
import { FieldController } from "../controllers/field.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";
import {
  validateParams,
  validateQuery,
  validateBody,
} from "../middlewares/validate.middleware";
import {
  fieldIdParamSchema,
  fieldListQuerySchema,
  createFieldBodySchema,
  updateFieldBodySchema,
} from "../validations/field.validation";

const router = Router();

// Mount authentication on all field routes
router.use(authenticate);

/**
 * @route   GET /api/fields/user
 * @desc    Get agricultural fields for the authenticated user (userId fetched from auth token)
 * @access  Private (Admin, Farmer)
 */
router.get(
  "/user",
  authorize("Admin", "Farmer"),
  validateQuery(fieldListQuerySchema),
  FieldController.getMyFields
);

/**
 * @route   GET /api/fields/me
 * @desc    Get agricultural fields for the authenticated user (userId fetched from auth token)
 * @access  Private (Admin, Farmer)
 */
router.get(
  "/me",
  authorize("Admin", "Farmer"),
  validateQuery(fieldListQuerySchema),
  FieldController.getMyFields
);

/**
 * @route   GET /api/fields/my-fields
 * @desc    Get agricultural fields for the authenticated user (userId fetched from auth token)
 * @access  Private (Admin, Farmer)
 */
router.get(
  "/my-fields",
  authorize("Admin", "Farmer"),
  validateQuery(fieldListQuerySchema),
  FieldController.getMyFields
);

/**
 * @route   GET /api/fields
 * @desc    Get paginated directory of fields with search, filters, and sorting (Admin sees all; Farmers see own)
 * @access  Private (Admin, Farmer)
 */
router.get(
  "/",
  authorize("Admin", "Farmer"),
  validateQuery(fieldListQuerySchema),
  FieldController.getAllFields
);

/**
 * @route   POST /api/fields
 * @desc    Register a new agricultural field (Admin for any farmer, Farmer for own account)
 * @access  Private (Admin, Farmer)
 */
router.post(
  "/",
  authorize("Admin", "Farmer"),
  validateBody(createFieldBodySchema),
  FieldController.createField
);

/**
 * @route   GET /api/fields/:id
 * @desc    Get single field details with owner info, stats, and coordinates
 * @access  Private (Admin or Field Owner Farmer)
 */
router.get(
  "/:id",
  authorize("Admin", "Farmer"),
  validateParams(fieldIdParamSchema),
  FieldController.getFieldById
);

/**
 * @route   PATCH /api/fields/:id
 * @desc    Update field metadata, acreage, crop type, or coordinates
 * @access  Private (Admin or Field Owner Farmer)
 */
router.patch(
  "/:id",
  authorize("Admin", "Farmer"),
  validateParams(fieldIdParamSchema),
  validateBody(updateFieldBodySchema),
  FieldController.updateField
);

/**
 * @route   DELETE /api/fields/:id
 * @desc    Delete agricultural field (safeguarded against active missions or service requests)
 * @access  Private (Admin or Field Owner Farmer)
 */
router.delete(
  "/:id",
  authorize("Admin", "Farmer"),
  validateParams(fieldIdParamSchema),
  FieldController.deleteField
);

export default router;

