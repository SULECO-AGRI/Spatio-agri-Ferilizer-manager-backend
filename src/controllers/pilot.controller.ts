import { Request, Response } from "express";
import { PilotService } from "../services/pilot.service";
import {
  PilotCacheService,
  PILOT_CACHE_TTL,
} from "../services/pilot-cache.service";
import { ServiceRequestCacheService } from "../services/service-request-cache.service";
import { FarmerCacheService } from "../services/farmer-cache.service";
import { CacheService } from "../utils/cache";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess, sendPaginated } from "../utils/response";

export class PilotController {
  /**
   * GET /pilots
   * Retrieve paginated set of pilots with search, status filters, and sorting (Admin Only)
   * Cache-Aside enabled with X-Cache response header
   */
  public static getAllPilots = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const cacheKey = PilotCacheService.buildListCacheKey(req.query as any);

      const { data: result } = await CacheService.getCachedOrFetch({
        key: cacheKey,
        ttlSeconds: PILOT_CACHE_TTL.LIST_SECONDS,
        fetchFn: () => PilotService.getAllPilots(req.query as any),
        res,
      });

      sendPaginated(res, "pilots", result.items, result.pagination);
    }
  );

  /**
   * GET /pilots/:id
   * Retrieve single pilot comprehensive profile, analytics, and stats
   * Cache-Aside enabled with X-Cache response header
   */
  public static getPilotById = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const pilotId = Number(req.params.id);
      const cacheKey = PilotCacheService.buildDetailCacheKey(pilotId);

      const { data: pilot } = await CacheService.getCachedOrFetch({
        key: cacheKey,
        ttlSeconds: PILOT_CACHE_TTL.DETAIL_SECONDS,
        fetchFn: () => PilotService.getPilotById(pilotId, req.user),
        res,
      });

      sendSuccess(res, { pilot });
    }
  );

  /**
   * PATCH /pilots/:id/status
   * Update pilot availability / duty status
   * Triggers automatic event-driven Redis cache invalidation
   */
  public static updatePilotStatus = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const pilotId = Number(req.params.id);
      const { status } = req.body;

      const updated = await PilotService.updatePilotStatus(
        pilotId,
        status,
        req.user
      );

      // Invalidate pilot profile and list caches asynchronously
      PilotCacheService.invalidatePilotCaches(pilotId).catch((err) => {
        console.warn("[PilotController] Cache invalidation warning:", err.message);
      });

      sendSuccess(res, updated, "Pilot status updated successfully.");
    }
  );

  /**
   * GET /pilots/:id/missions
   * Retrieve pilot's mission assignments and historical flights
   * Cache-Aside enabled with X-Cache response header
   */
  public static getPilotMissions = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const pilotId = Number(req.params.id);
      const cacheKey = PilotCacheService.buildMissionsCacheKey(
        pilotId,
        req.query as any
      );

      const { data: result } = await CacheService.getCachedOrFetch({
        key: cacheKey,
        ttlSeconds: PILOT_CACHE_TTL.MISSIONS_SECONDS,
        fetchFn: () =>
          PilotService.getPilotMissions(pilotId, req.query as any, req.user),
        res,
      });

      sendPaginated(res, "missions", result.items, result.pagination);
    }
  );

  /**
   * PATCH /pilots/:id/missions/:missionId/start
   * Start a scheduled mission (transitions mission to IN_PROGRESS, pilot to ON_MISSION)
   * Invalidates pilot and service request caches
   */
  public static startMission = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const pilotId = Number(req.params.id);
      const missionId = Number(req.params.missionId);

      const result = await PilotService.startMission(
        pilotId,
        missionId,
        req.user
      );

      // Invalidate pilot, service request, and farmer caches
      Promise.allSettled([
        PilotCacheService.invalidatePilotCaches(pilotId),
        ServiceRequestCacheService.invalidateServiceRequestCaches(),
        FarmerCacheService.invalidateFarmerCaches(),
      ]).catch((err) => {
        console.warn("[PilotController] Cache invalidation warning:", err.message);
      });

      sendSuccess(res, result, "Mission started successfully.");
    }
  );

  /**
   * PATCH /pilots/:id/missions/:missionId/complete
   * Complete a mission atomically (records flight hours, area spread, restores pilot status)
   * Invalidates pilot and service request caches
   */
  public static completeMission = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const pilotId = Number(req.params.id);
      const missionId = Number(req.params.missionId);

      const result = await PilotService.completeMission(
        pilotId,
        missionId,
        req.body,
        req.user
      );

      // Invalidate pilot, service request, and farmer caches
      Promise.allSettled([
        PilotCacheService.invalidatePilotCaches(pilotId),
        ServiceRequestCacheService.invalidateServiceRequestCaches(),
        FarmerCacheService.invalidateFarmerCaches(),
      ]).catch((err) => {
        console.warn("[PilotController] Cache invalidation warning:", err.message);
      });

      sendSuccess(res, result, "Mission completed successfully.");
    }
  );

  /**
   * GET /pilots/:id/payouts
   * Retrieve financial payout records and settlement ledger
   * Cache-Aside enabled with X-Cache response header
   */
  public static getPilotPayouts = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const pilotId = Number(req.params.id);
      const cacheKey = PilotCacheService.buildPayoutsCacheKey(
        pilotId,
        req.query as any
      );

      const { data: result } = await CacheService.getCachedOrFetch({
        key: cacheKey,
        ttlSeconds: PILOT_CACHE_TTL.PAYOUTS_SECONDS,
        fetchFn: () =>
          PilotService.getPilotPayouts(pilotId, req.query as any, req.user),
        res,
      });

      sendPaginated(
        res,
        "payouts",
        result.payouts,
        result.pagination,
        { summary: result.summary }
      );
    }
  );

  /**
   * GET /pilots/:id/reviews
   * Retrieve customer performance reviews and ratings for the pilot
   * Cache-Aside enabled with X-Cache response header
   */
  public static getPilotReviews = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const pilotId = Number(req.params.id);
      const cacheKey = PilotCacheService.buildReviewsCacheKey(
        pilotId,
        req.query as any
      );

      const { data: result } = await CacheService.getCachedOrFetch({
        key: cacheKey,
        ttlSeconds: PILOT_CACHE_TTL.REVIEWS_SECONDS,
        fetchFn: () =>
          PilotService.getPilotReviews(pilotId, req.query as any, req.user),
        res,
      });

      sendPaginated(res, "reviews", result.items, result.pagination);
    }
  );
}
