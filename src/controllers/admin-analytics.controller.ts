import { Request, Response } from "express";
import { AdminAnalyticsService } from "../services/admin-analytics.service";
import {
  AdminAnalyticsCacheService,
  ADMIN_ANALYTICS_CACHE_TTL,
} from "../services/admin-analytics-cache.service";
import { CacheService } from "../utils/cache";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess, sendPaginated } from "../utils/response";

export class AdminAnalyticsController {
  /**
   * GET /admin/analytics/summary
   * High-level KPI summary cards for the 4 core metrics (Admin Only)
   */
  public static getAnalyticsSummary = asyncHandler(
    async (_req: Request, res: Response): Promise<void> => {
      const cacheKey = AdminAnalyticsCacheService.buildSummaryCacheKey();

      const { data } = await CacheService.getCachedOrFetch({
        key: cacheKey,
        ttlSeconds: ADMIN_ANALYTICS_CACHE_TTL.SUMMARY_SECONDS,
        fetchFn: () => AdminAnalyticsService.getAnalyticsSummary(),
        res,
      });

      sendSuccess(res, data);
    }
  );

  /**
   * GET /admin/analytics/completed-missions
   * Completed missions count, monthly comparisons, and growth rates (Admin Only)
   */
  public static getCompletedMissionsAnalytics = asyncHandler(
    async (_req: Request, res: Response): Promise<void> => {
      const cacheKey = AdminAnalyticsCacheService.buildCompletedMissionsCacheKey();

      const { data } = await CacheService.getCachedOrFetch({
        key: cacheKey,
        ttlSeconds: ADMIN_ANALYTICS_CACHE_TTL.METRICS_SECONDS,
        fetchFn: () => AdminAnalyticsService.getCompletedMissionsAnalytics(),
        res,
      });

      sendSuccess(res, data);
    }
  );

  /**
   * GET /admin/analytics/revenue
   * Gross revenue, company commission, pilot earnings, and monthly growth (Admin Only)
   */
  public static getRevenueAnalytics = asyncHandler(
    async (_req: Request, res: Response): Promise<void> => {
      const cacheKey = AdminAnalyticsCacheService.buildRevenueCacheKey();

      const { data } = await CacheService.getCachedOrFetch({
        key: cacheKey,
        ttlSeconds: ADMIN_ANALYTICS_CACHE_TTL.METRICS_SECONDS,
        fetchFn: () => AdminAnalyticsService.getRevenueAnalytics(),
        res,
      });

      sendSuccess(res, data);
    }
  );

  /**
   * GET /admin/analytics/pilot-performance
   * Fleet-wide pilot performance KPIs and ratings (Admin Only)
   */
  public static getPilotFleetPerformance = asyncHandler(
    async (_req: Request, res: Response): Promise<void> => {
      const cacheKey = AdminAnalyticsCacheService.buildPilotPerformanceCacheKey();

      const { data } = await CacheService.getCachedOrFetch({
        key: cacheKey,
        ttlSeconds: ADMIN_ANALYTICS_CACHE_TTL.METRICS_SECONDS,
        fetchFn: () => AdminAnalyticsService.getPilotFleetPerformance(),
        res,
      });

      sendSuccess(res, data);
    }
  );

  /**
   * GET /admin/analytics/farmer-growth
   * Farmer registration growth metrics and percentages (Admin Only)
   */
  public static getFarmerGrowth = asyncHandler(
    async (_req: Request, res: Response): Promise<void> => {
      const cacheKey = AdminAnalyticsCacheService.buildFarmerGrowthCacheKey();

      const { data } = await CacheService.getCachedOrFetch({
        key: cacheKey,
        ttlSeconds: ADMIN_ANALYTICS_CACHE_TTL.METRICS_SECONDS,
        fetchFn: () => AdminAnalyticsService.getFarmerGrowth(),
        res,
      });

      sendSuccess(res, data);
    }
  );

  /**
   * GET /admin/analytics/pilot-performance-table
   * Paginated pilot performance data table (Admin Only)
   */
  public static getPilotPerformanceTable = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const cacheKey =
        AdminAnalyticsCacheService.buildPilotPerformanceTableCacheKey(
          req.query as any
        );

      const { data: result } = await CacheService.getCachedOrFetch({
        key: cacheKey,
        ttlSeconds: ADMIN_ANALYTICS_CACHE_TTL.TABLE_SECONDS,
        fetchFn: () =>
          AdminAnalyticsService.getPilotPerformanceTable(req.query as any),
        res,
      });

      sendPaginated(res, "pilots", result.pilots, result.pagination);
    }
  );
}

