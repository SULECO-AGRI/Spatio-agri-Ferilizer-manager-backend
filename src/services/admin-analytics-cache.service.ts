import crypto from "crypto";
import { PilotPerformanceTableQueryDTO } from "../types/admin-analytics.types";
import { CacheService } from "../utils/cache";

export const ADMIN_ANALYTICS_CACHE_TTL = {
  SUMMARY_SECONDS: Number(process.env.CACHE_TTL_ADMIN_ANALYTICS_SECONDS) || 900, // 15 minutes (900s)
  METRICS_SECONDS: Number(process.env.CACHE_TTL_ADMIN_METRICS_SECONDS) || 900,
  TABLE_SECONDS: Number(process.env.CACHE_TTL_ADMIN_TABLE_SECONDS) || 900,
};

export class AdminAnalyticsCacheService {
  /**
   * Generates deterministic cache key for the top-level 4 KPI summary cards
   */
  public static buildSummaryCacheKey(): string {
    return "admin:analytics:summary";
  }

  /**
   * Generates deterministic cache key for Completed Missions analytics
   */
  public static buildCompletedMissionsCacheKey(): string {
    return "admin:analytics:completed-missions";
  }

  /**
   * Generates deterministic cache key for Revenue analytics
   */
  public static buildRevenueCacheKey(): string {
    return "admin:analytics:revenue";
  }

  /**
   * Generates deterministic cache key for Pilot Fleet performance analytics
   */
  public static buildPilotPerformanceCacheKey(): string {
    return "admin:analytics:pilot-performance";
  }

  /**
   * Generates deterministic cache key for Farmer registration growth
   */
  public static buildFarmerGrowthCacheKey(): string {
    return "admin:analytics:farmer-growth";
  }

  /**
   * Generates deterministic cache key for the paginated Pilot Performance Table
   */
  public static buildPilotPerformanceTableCacheKey(
    query: PilotPerformanceTableQueryDTO
  ): string {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const status = query.status || "all";
    const sortBy = query.sortBy || "completedMissions";
    const sortOrder = query.sortOrder || "desc";

    let searchKey = "none";
    if (query.search && query.search.trim()) {
      searchKey = crypto
        .createHash("md5")
        .update(query.search.trim().toLowerCase())
        .digest("hex")
        .substring(0, 10);
    }

    return `admin:analytics:pilot-table:p=${page}:l=${limit}:s=${status}:sb=${sortBy}:so=${sortOrder}:q=${searchKey}`;
  }

  /**
   * Purges all Admin Analytics and Dashboard cache entries on relevant database mutations
   */
  public static async invalidateAdminAnalyticsCaches(): Promise<void> {
    const promises: Promise<unknown>[] = [
      CacheService.del(this.buildSummaryCacheKey()),
      CacheService.del(this.buildCompletedMissionsCacheKey()),
      CacheService.del(this.buildRevenueCacheKey()),
      CacheService.del(this.buildPilotPerformanceCacheKey()),
      CacheService.del(this.buildFarmerGrowthCacheKey()),
      CacheService.delByPattern("admin:analytics:pilot-table:*"),
      CacheService.delByPattern("admin:dashboard:*"),
    ];

    await Promise.allSettled(promises);
    console.log(
      "\x1b[35m[CACHE INVALIDATION]\x1b[0m 🔄 Admin Analytics & KPI caches purged."
    );
  }
}
