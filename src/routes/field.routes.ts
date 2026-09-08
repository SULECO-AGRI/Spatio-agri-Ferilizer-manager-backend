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

// Global authentication on all fields endpoints
router.use(authenticate);

/**
 * @route   GET /fields
 * @desc    Get paginated directory of fields with search, filters, and sorting
 * @access  Private (Admin sees all; Farmers see own)
 */
router.get(
  "/",
  authorize("Admin", "Farmer", "Pilot"),
  validateQuery(fieldListQuerySchema),
  FieldController.getAllFields
);

/**
 * @route   POST /fields
 * @desc    Register a new agricultural field
 * @access  Private (Admin for any farmer, Farmer for own account)
 */
router.post(
  "/",
  authorize("Admin", "Farmer"),
  validateBody(createFieldBodySchema),
  FieldController.createField
);

/**
 * @route   GET /fields/:id
 * @desc    Get single field details with owner info, stats, and coordinates
 * @access  Private (Admin or field owner Farmer, Pilot)
 */
router.get(
  "/:id",
  authorize("Admin", "Farmer", "Pilot"),
  validateParams(fieldIdParamSchema),
  FieldController.getFieldById
);

/**
 * @route   PATCH /fields/:id
 * @desc    Update field metadata, acreage, crop type, or coordinates
 * @access  Private (Admin or field owner Farmer)
 */
router.patch(
  "/:id",
  authorize("Admin", "Farmer"),
  validateParams(fieldIdParamSchema),
  validateBody(updateFieldBodySchema),
  FieldController.updateField
);

/**
 * @route   DELETE /fields/:id
 * @desc    Delete agricultural field (safeguarded against active missions)
 * @access  Private (Admin or field owner Farmer)
 */
router.delete(
  "/:id",
  authorize("Admin", "Farmer"),
  validateParams(fieldIdParamSchema),
  FieldController.deleteField
);

export default router;
