import crypto from "crypto";
import {
  PilotQueryDTO,
  PilotMissionQueryDTO,
  PilotPayoutQueryDTO,
  PilotReviewQueryDTO,
} from "../types/pilot.types";
import { CacheService } from "../utils/cache";

export const PILOT_CACHE_TTL = {
  LIST_SECONDS: Number(process.env.CACHE_TTL_PILOTS_LIST_SECONDS) || 900, // 15 minutes (900s)
  DETAIL_SECONDS: Number(process.env.CACHE_TTL_PILOTS_DETAIL_SECONDS) || 1800, // 30 minutes (1,800s)
  MISSIONS_SECONDS: Number(process.env.CACHE_TTL_PILOTS_MISSIONS_SECONDS) || 900, // 15 minutes (900s)
  PAYOUTS_SECONDS: Number(process.env.CACHE_TTL_PILOTS_PAYOUTS_SECONDS) || 900, // 15 minutes (900s)
  REVIEWS_SECONDS: Number(process.env.CACHE_TTL_PILOTS_REVIEWS_SECONDS) || 1800, // 30 minutes (1,800s)
};

export class PilotCacheService {
  /**
   * Generates a deterministic cache key for Pilot directory list queries
   */
  public static buildListCacheKey(query: PilotQueryDTO): string {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const status = query.status || "all";
    const sortBy = query.sortBy || "createdAt";
    const sortOrder = query.sortOrder || "desc";

    let searchKey = "none";
    if (query.search && query.search.trim()) {
      // Hash search string to keep key lengths manageable and clean
      searchKey = crypto
        .createHash("md5")
        .update(query.search.trim().toLowerCase())
        .digest("hex")
        .substring(0, 10);
    }

    return `pilots:list:p=${page}:l=${limit}:s=${status}:q=${searchKey}:sb=${sortBy}:so=${sortOrder}`;
  }

  /**
   * Generates cache key for a single pilot's comprehensive profile and stats
   */
  public static buildDetailCacheKey(pilotId: number): string {
    return `pilots:details:${pilotId}`;
  }

  /**
   * Generates cache key for pilot's mission assignments and historical flights
   */
  public static buildMissionsCacheKey(
    pilotId: number,
    query: PilotMissionQueryDTO
  ): string {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const status = query.status || "all";
    const start = query.startDate || "none";
    const end = query.endDate || "none";

    return `pilots:missions:${pilotId}:p=${page}:l=${limit}:s=${status}:d1=${start}:d2=${end}`;
  }

  /**
   * Generates cache key for pilot payouts and financial ledger
   */
  public static buildPayoutsCacheKey(
    pilotId: number,
    query: PilotPayoutQueryDTO
  ): string {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const status = query.status || "all";

    return `pilots:payouts:${pilotId}:p=${page}:l=${limit}:s=${status}`;
  }

  /**
   * Generates cache key for pilot reviews and ratings
   */
  public static buildReviewsCacheKey(
    pilotId: number,
    query: PilotReviewQueryDTO
  ): string {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const minRating = query.minRating ?? "all";
    const maxRating = query.maxRating ?? "all";

    return `pilots:reviews:${pilotId}:p=${page}:l=${limit}:min=${minRating}:max=${maxRating}`;
  }

  /**
   * Purges pilot cache entries on mutation events (registration, status update, mission lifecycle)
   */
  public static async invalidatePilotCaches(pilotId?: number): Promise<void> {
    const promises: Promise<unknown>[] = [];

    // 1. Invalidate all paginated/filtered pilot list caches
    promises.push(CacheService.delByPattern("pilots:list:*"));

    // 2. Invalidate specific pilot profile and sub-resources if pilot ID provided
    if (pilotId) {
      promises.push(CacheService.del(this.buildDetailCacheKey(pilotId)));
      // Also delete singular detail key variant for safety
      promises.push(CacheService.del(`pilots:detail:${pilotId}`));
      promises.push(CacheService.delByPattern(`pilots:missions:${pilotId}:*`));
      promises.push(CacheService.delByPattern(`pilots:payouts:${pilotId}:*`));
      promises.push(CacheService.delByPattern(`pilots:reviews:${pilotId}:*`));
    }

    await Promise.allSettled(promises);
    console.log(
      `\x1b[35m[CACHE INVALIDATION]\x1b[0m 🔄 Pilot caches purged${
        pilotId ? ` for pilot #${pilotId}` : ""
      }.`
    );
  }
}
