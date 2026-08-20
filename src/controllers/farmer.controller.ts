import { Request, Response } from "express";
import { FarmerService } from "../services/farmer.service";
import { asyncHandler } from "../utils/asyncHandler";

export class FarmerController {
  /**
   * GET /farmers
   * Retrieve paginated set of farmers with search, sort, and summary statistics
   */
  public static getAllFarmers = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const result = await FarmerService.getAllFarmers(req.query as any);

      res.status(200).json({
        status: "success",
        data: {
          farmers: result.items,
          pagination: result.pagination,
        },
      });
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

      res.status(200).json({
        status: "success",
        data: {
          farmer,
        },
      });
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

      res.status(200).json({
        status: "success",
        data: {
          fields,
        },
      });
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

      res.status(200).json({
        status: "success",
        data: {
          serviceHistory: result.items,
          pagination: result.pagination,
        },
      });
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

      res.status(200).json({
        status: "success",
        data: {
          payments: result.payments,
          summary: result.summary,
          pagination: result.pagination,
        },
      });
    }
  );
}
