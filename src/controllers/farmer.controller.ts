import { Request, Response } from "express";
import { FarmerService } from "../services/farmer.service";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess, sendCreated, sendPaginated } from "../utils/response";

export class FarmerController {
  /**
   * GET /farmers
   * Retrieve paginated set of farmers with search, sort, and summary statistics
   */
  public static getAllFarmers = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const result = await FarmerService.getAllFarmers(req.query as any);
      sendPaginated(res, "farmers", result.items, result.pagination);
    }
  );

  /**
   * GET /farmers/:id
   * Retrieve single farmer comprehensive profile and aggregate stats
   */
  public static getFarmerById = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const farmerId = Number(req.params.id);
      const farmer = await FarmerService.getFarmerById(farmerId, req.user);
      sendSuccess(res, { farmer });
    }
  );

  /**
   * GET /farmers/:id/fields
   * Retrieve all registered agricultural fields for a farmer
   */
  public static getFarmerFields = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const farmerId = Number(req.params.id);
      const fields = await FarmerService.getFarmerFields(
        farmerId,
        req.query as any,
        req.user
      );
      sendSuccess(res, { fields });
    }
  );

  /**
   * POST /farmers/:id/fields
   * Register a new agricultural field for a farmer
   */
  public static createField = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const farmerId = Number(req.params.id);
      const newField = await FarmerService.createField(
        farmerId,
        req.body,
        req.user
      );
      sendCreated(res, { field: newField }, "Field registered successfully.");
    }
  );

  /**
   * GET /farmers/:id/services
   * Retrieve service requests and mission execution history for a farmer
   */
  public static getFarmerServiceHistory = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const farmerId = Number(req.params.id);
      const result = await FarmerService.getFarmerServiceHistory(
        farmerId,
        req.query as any,
        req.user
      );
      sendPaginated(res, "serviceHistory", result.items, result.pagination);
    }
  );

  /**
   * GET /farmers/:id/payments
   * Retrieve billing transactions and payment history for a farmer
   */
  public static getFarmerPayments = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const farmerId = Number(req.params.id);
      const result = await FarmerService.getFarmerPayments(
        farmerId,
        req.query as any,
        req.user
      );
      sendPaginated(
        res,
        "payments",
        result.payments,
        result.pagination,
        { summary: result.summary }
      );
    }
  );

  /**
   * DELETE /farmers/:id
   * Delete farmer profile, fields, history, and account
   */
  public static deleteFarmer = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const farmerId = Number(req.params.id);
      const deletedFarmer = await FarmerService.deleteFarmer(
        farmerId,
        req.user
      );
      sendSuccess(
        res,
        { farmer: deletedFarmer },
        "Farmer account and associated records deleted successfully."
      );
    }
  );
}
