import { Request, Response } from "express";
import { FieldService } from "../services/field.service";
import {
  FieldCacheService,
  FIELD_CACHE_TTL,
} from "../services/field-cache.service";
import { AdminAnalyticsCacheService } from "../services/admin-analytics-cache.service";
import { CacheService } from "../utils/cache";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess, sendCreated, sendPaginated } from "../utils/response";

export class FieldController {
  /**
   * GET /fields
   * List all registered fields (Admin sees all; Farmers see own)
   * Cache-Aside enabled with X-Cache response header
   */
  public static getAllFields = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const isFarmer = req.user?.role.toLowerCase() === "farmer";
      const cacheScope = isFarmer ? req.user?.userId : undefined;
      const cacheKey = FieldCacheService.buildListCacheKey(
        req.query as any,
        cacheScope
      );

      const { data: result } = await CacheService.getCachedOrFetch({
        key: cacheKey,
        ttlSeconds: FIELD_CACHE_TTL.LIST_SECONDS,
        fetchFn: () => FieldService.getAllFields(req.query as any, req.user),
        res,
      });

      sendPaginated(res, "fields", result.fields, result.pagination);
    }
  );

  /**
   * GET /fields/:id
   * Get single field detail with coordinates and owner info
   * Cache-Aside enabled with X-Cache response header
   */
  public static getFieldById = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const fieldId = Number(req.params.id);
      const cacheKey = FieldCacheService.buildDetailCacheKey(fieldId);

      const { data: field } = await CacheService.getCachedOrFetch({
        key: cacheKey,
        ttlSeconds: FIELD_CACHE_TTL.DETAIL_SECONDS,
        fetchFn: () => FieldService.getFieldById(fieldId, req.user),
        res,
      });

      sendSuccess(res, { field });
    }
  );

  /**
   * POST /fields
   * Create and register a new agricultural field
   * Access: Admin (for any farmerId) or Farmer (for self)
   */
  public static createField = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const field = await FieldService.createField(req.body, req.user);

      // Invalidate caches
      Promise.allSettled([
        FieldCacheService.invalidateFieldCaches(field.id, field.farmerId),
        AdminAnalyticsCacheService.invalidateAdminAnalyticsCaches(),
      ]).catch((err) => {
        console.warn("[FieldController] Cache invalidation warning:", err.message);
      });

      sendCreated(res, { field }, "Agricultural field registered successfully.");
    }
  );

  /**
   * PATCH /fields/:id
   * Update agricultural field details and coordinates
   * Access: Admin or the field owner
   */
  public static updateField = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const fieldId = Number(req.params.id);
      const field = await FieldService.updateField(fieldId, req.body, req.user);

      // Invalidate caches
      Promise.allSettled([
        FieldCacheService.invalidateFieldCaches(field.id, field.farmerId),
        AdminAnalyticsCacheService.invalidateAdminAnalyticsCaches(),
      ]).catch((err) => {
        console.warn("[FieldController] Cache invalidation warning:", err.message);
      });

      sendSuccess(res, { field }, "Agricultural field updated successfully.");
    }
  );

  /**
   * DELETE /fields/:id
   * Remove an agricultural field
   * Access: Admin or the field owner
   */
  public static deleteField = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const fieldId = Number(req.params.id);
      const deleted = await FieldService.deleteField(fieldId, req.user);

      // Invalidate caches
      Promise.allSettled([
        FieldCacheService.invalidateFieldCaches(deleted.id, deleted.farmerId),
        AdminAnalyticsCacheService.invalidateAdminAnalyticsCaches(),
      ]).catch((err) => {
        console.warn("[FieldController] Cache invalidation warning:", err.message);
      });

      sendSuccess(res, { deleted }, "Agricultural field deleted successfully.");
    }
  );
}
