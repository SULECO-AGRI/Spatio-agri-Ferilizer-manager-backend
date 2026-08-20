import { Request, Response } from "express";
import { AdminAnalyticsService } from "../services/admin-analytics.service";
import { asyncHandler } from "../utils/asyncHandler";

export class AdminAnalyticsController {
  /**
   * GET /admin/analytics/completed-missions
   * Completed missions count, monthly comparisons, and growth rates (Admin Only)
   */
  public static getCompletedMissionsAnalytics = asyncHandler(
    async (_req: Request, res: Response): Promise<void> => {
      const data = await AdminAnalyticsService.getCompletedMissionsAnalytics();

      res.status(200).json({
        status: "success",
        data,
      });
    }
  );

  /**
   * GET /admin/analytics/revenue
   * Gross revenue, company commission, pilot earnings, and monthly growth (Admin Only)
   */
  public static getRevenueAnalytics = asyncHandler(
    async (_req: Request, res: Response): Promise<void> => {
      const data = await AdminAnalyticsService.getRevenueAnalytics();

      res.status(200).json({
        status: "success",
        data,
      });
    }
  );

  /**
   * GET /admin/analytics/pilot-performance
   * Fleet-wide pilot performance KPIs and ratings (Admin Only)
   */
  public static getPilotFleetPerformance = asyncHandler(
    async (_req: Request, res: Response): Promise<void> => {
      const data = await AdminAnalyticsService.getPilotFleetPerformance();

      res.status(200).json({
        status: "success",
        data,
      });
    }
  );

  /**
   * GET /admin/analytics/farmer-growth
   * Farmer registration growth metrics and percentages (Admin Only)
   */
  public static getFarmerGrowth = asyncHandler(
    async (_req: Request, res: Response): Promise<void> => {
      const data = await AdminAnalyticsService.getFarmerGrowth();

      res.status(200).json({
        status: "success",
        data,
      });
    }
  );

  /**
   * GET /admin/analytics/pilot-performance-table
   * Paginated pilot performance data table (Admin Only)
   */
  public static getPilotPerformanceTable = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const result = await AdminAnalyticsService.getPilotPerformanceTable(
        req.query as any
      );

      res.status(200).json({
        status: "success",
        data: {
          pilots: result.pilots,
          pagination: result.pagination,
        },
      });
    }
  );
}
