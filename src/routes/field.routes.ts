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

// Mount authentication and ADMIN authorization on all field routes
router.use(authenticate);
router.use(authorize("ADMIN"));

/**
 * @route   GET /api/fields
 * @desc    Get paginated directory of fields with search, filters, and sorting
 * @access  Private (Admin Only)
 */
router.get(
  "/",
  validateQuery(fieldListQuerySchema),
  FieldController.getAllFields
);

/**
 * @route   POST /api/fields
 * @desc    Register a new agricultural field
 * @access  Private (Admin Only)
 */
router.post(
  "/",
  validateBody(createFieldBodySchema),
  FieldController.createField
);

/**
 * @route   GET /api/fields/:id
 * @desc    Get single field details with owner info, stats, and coordinates
 * @access  Private (Admin Only)
 */
router.get(
  "/:id",
  validateParams(fieldIdParamSchema),
  FieldController.getFieldById
);

/**
 * @route   PATCH /api/fields/:id
 * @desc    Update field metadata, acreage, crop type, or coordinates
 * @access  Private (Admin Only)
 */
router.patch(
  "/:id",
  validateParams(fieldIdParamSchema),
  validateBody(updateFieldBodySchema),
  FieldController.updateField
);

/**
 * @route   DELETE /api/fields/:id
 * @desc    Delete agricultural field (safeguarded against active missions or service requests)
 * @access  Private (Admin Only)
 */
router.delete(
  "/:id",
  validateParams(fieldIdParamSchema),
  FieldController.deleteField
);

export default router;

