import { Request, Response } from "express";
import { FarmerService } from "../services/farmer.service";
import {
  FarmerCacheService,
  FARMER_CACHE_TTL,
} from "../services/farmer-cache.service";
import { AdminAnalyticsCacheService } from "../services/admin-analytics-cache.service";
import { CacheService } from "../utils/cache";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess, sendCreated, sendPaginated } from "../utils/response";

export class FarmerController {
  /**
   * GET /farmers
   * Retrieve paginated set of farmers with search, sort, and summary statistics
   * Cache-Aside enabled with X-Cache response header
   */
  public static getAllFarmers = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const cacheKey = FarmerCacheService.buildListCacheKey(req.query as any);

      const { data: result } = await CacheService.getCachedOrFetch({
        key: cacheKey,
        ttlSeconds: FARMER_CACHE_TTL.LIST_SECONDS,
        fetchFn: () => FarmerService.getAllFarmers(req.query as any),
        res,
      });

      sendPaginated(res, "farmers", result.items, result.pagination);
    }
  );

  /**
   * GET /farmers/:id
   * Retrieve single farmer comprehensive profile and aggregate stats
   * Cache-Aside enabled with X-Cache response header
   */
  public static getFarmerById = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const farmerId = Number(req.params.id);
      const cacheKey = FarmerCacheService.buildDetailCacheKey(farmerId);

      const { data: farmer } = await CacheService.getCachedOrFetch({
        key: cacheKey,
        ttlSeconds: FARMER_CACHE_TTL.DETAIL_SECONDS,
        fetchFn: () => FarmerService.getFarmerById(farmerId, req.user),
        res,
      });

      sendSuccess(res, { farmer });
    }
  );

  /**
   * GET /farmers/:id/fields
   * Retrieve all registered agricultural fields for a farmer
   * Cache-Aside enabled with X-Cache response header
   */
  public static getFarmerFields = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const farmerId = Number(req.params.id);
      const cacheKey = FarmerCacheService.buildFieldsCacheKey(
        farmerId,
        req.query as any
      );

      const { data: fields } = await CacheService.getCachedOrFetch({
        key: cacheKey,
        ttlSeconds: FARMER_CACHE_TTL.FIELDS_SECONDS,
        fetchFn: () =>
          FarmerService.getFarmerFields(farmerId, req.query as any, req.user),
        res,
      });

      sendSuccess(res, { fields });
    }
  );

  /**
   * POST /farmers/:id/fields
   * Register a new agricultural field for a farmer
   * Access: Admin (for any farmer) or Farmer (for their own account only)
   */
  public static createField = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const farmerId = Number(req.params.id);
      const newField = await FarmerService.createField(
        farmerId,
        req.body,
        req.user
      );

      // Event-driven cache purging for farmer caches & admin analytics
      Promise.allSettled([
        FarmerCacheService.invalidateFarmerCaches(farmerId),
        AdminAnalyticsCacheService.invalidateAdminAnalyticsCaches(),
      ]).catch((err) => {
        console.warn("[FarmerController] Cache invalidation warning:", err.message);
      });

      sendCreated(res, { field: newField }, "Field registered successfully.");
    }
  );

  /**
   * GET /farmers/:id/services
   * Retrieve service requests and mission execution history for a farmer
   * Cache-Aside enabled with X-Cache response header
   */
  public static getFarmerServiceHistory = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const farmerId = Number(req.params.id);
      const cacheKey = FarmerCacheService.buildServicesCacheKey(
        farmerId,
        req.query as any
      );

      const { data: result } = await CacheService.getCachedOrFetch({
        key: cacheKey,
        ttlSeconds: FARMER_CACHE_TTL.SERVICES_SECONDS,
        fetchFn: () =>
          FarmerService.getFarmerServiceHistory(
            farmerId,
            req.query as any,
            req.user
          ),
        res,
      });

      sendPaginated(res, "serviceHistory", result.items, result.pagination);
    }
  );

  /**
   * GET /farmers/:id/payments
   * Retrieve billing transactions and payment history for a farmer
   * Cache-Aside enabled with X-Cache response header
   */
  public static getFarmerPayments = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const farmerId = Number(req.params.id);
      const cacheKey = FarmerCacheService.buildPaymentsCacheKey(
        farmerId,
        req.query as any
      );

      const { data: result } = await CacheService.getCachedOrFetch({
        key: cacheKey,
        ttlSeconds: FARMER_CACHE_TTL.PAYMENTS_SECONDS,
        fetchFn: () =>
          FarmerService.getFarmerPayments(
            farmerId,
            req.query as any,
            req.user
          ),
        res,
      });

      sendPaginated(
        res,
        "payments",
        result.payments,
        result.pagination,
        { summary: result.summary }
      );
    }
  );
}
