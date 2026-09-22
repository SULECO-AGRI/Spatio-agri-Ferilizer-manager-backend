import { Request, Response } from "express";
import { FieldService } from "../services/field.service";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess, sendCreated, sendPaginated } from "../utils/response";

export class FieldController {
  /**
   * GET /fields
   * List all registered fields (Admin sees all; Farmers see own)
   */
  public static getAllFields = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const result = await FieldService.getAllFields(req.query as any, req.user);
      sendPaginated(res, "fields", result.fields, result.pagination);
    }
  );

  /**
   * GET /fields/:id
   * Get single field detail with coordinates and owner info
   */
  public static getFieldById = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const fieldId = Number(req.params.id);
      const field = await FieldService.getFieldById(fieldId, req.user);
      sendSuccess(res, { field });
    }
  );

  /**
   * POST /fields
   * Create and register a new agricultural field
   */
  public static createField = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const field = await FieldService.createField(req.body, req.user);
      sendCreated(res, { field }, "Agricultural field registered successfully.");
    }
  );

  /**
   * PATCH /fields/:id
   * Update agricultural field details and coordinates
   */
  public static updateField = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const fieldId = Number(req.params.id);
      const field = await FieldService.updateField(fieldId, req.body, req.user);
      sendSuccess(res, { field }, "Agricultural field updated successfully.");
    }
  );

  /**
   * DELETE /fields/:id
   * Remove an agricultural field
   */
  public static deleteField = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const fieldId = Number(req.params.id);
      const deleted = await FieldService.deleteField(fieldId, req.user);
      sendSuccess(res, { deleted }, "Agricultural field deleted successfully.");
    }
  );
}
