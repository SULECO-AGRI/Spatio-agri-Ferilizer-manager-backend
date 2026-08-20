import { Request, Response } from "express";
import { AdminService } from "../services/admin.service";
import { asyncHandler } from "../utils/asyncHandler";

export class AdminController {
  /**
   * GET /admin/dashboard
   * Full aggregated executive dashboard overview (Admin Only)
   */
  public static getDashboardOverview = asyncHandler(
    async (_req: Request, res: Response): Promise<void> => {
      const data = await AdminService.getDashboardOverview();

      res.status(200).json({
        status: "success",
        data,
      });
    }
  );

  /**
   * GET /admin/dashboard/metrics
   * Real-time core KPIs & operational metrics (Admin Only)
   */
  public static getDashboardMetrics = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const periodDays = req.query.periodDays
        ? Number(req.query.periodDays)
        : 90;
      const metrics = await AdminService.getMetrics(periodDays);

      res.status(200).json({
        status: "success",
        data: {
          metrics,
        },
      });
    }
  );

  /**
   * GET /admin/dashboard/activities
   * Recent activity feed (Admin Only)
   */
  public static getRecentActivities = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const limit = req.query.limit ? Number(req.query.limit) : 6;
      const activities = await AdminService.getRecentActivities(limit);

      res.status(200).json({
        status: "success",
        data: {
          recentActivities: activities,
        },
      });
    }
  );

  /**
   * GET /admin/dashboard/schedule
   * Today's flight & mission schedule (Admin Only)
   */
  public static getTodaySchedule = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const todaySchedule = await AdminService.getTodaySchedule(req.query as any);

      res.status(200).json({
        status: "success",
        data: {
          todaySchedule,
        },
      });
    }
  );
}
