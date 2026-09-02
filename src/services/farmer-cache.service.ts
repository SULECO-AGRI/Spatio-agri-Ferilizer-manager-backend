import crypto from "crypto";
import {
  FarmerQueryDTO,
  FarmerFieldsQueryDTO,
  FarmerServiceHistoryQueryDTO,
  FarmerPaymentQueryDTO,
} from "../types/farmer.types";
import { CacheService } from "../utils/cache";

export const FARMER_CACHE_TTL = {
  LIST_SECONDS: Number(process.env.CACHE_TTL_FARMERS_LIST_SECONDS) || 900, // 15 minutes (900s)
  DETAIL_SECONDS: Number(process.env.CACHE_TTL_FARMERS_DETAIL_SECONDS) || 900, // 15 minutes (900s)
  FIELDS_SECONDS: Number(process.env.CACHE_TTL_FARMERS_FIELDS_SECONDS) || 900, // 15 minutes (900s)
  SERVICES_SECONDS: Number(process.env.CACHE_TTL_FARMERS_SERVICES_SECONDS) || 900, // 15 minutes (900s)
  PAYMENTS_SECONDS: Number(process.env.CACHE_TTL_FARMERS_PAYMENTS_SECONDS) || 900, // 15 minutes (900s)
};

export class FarmerCacheService {
  /**
   * Generates a deterministic cache key for Farmer directory list queries
   */
  public static buildListCacheKey(query: FarmerQueryDTO): string {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const sortBy = query.sortBy || "createdAt";
    const sortOrder = query.sortOrder || "desc";

    let searchKey = "none";
    if (query.search && query.search.trim()) {
      // Hash search query string to keep Redis key lengths manageable and clean
      searchKey = crypto
        .createHash("md5")
        .update(query.search.trim().toLowerCase())
        .digest("hex")
        .substring(0, 10);
    }

    return `farmers:list:p=${page}:l=${limit}:q=${searchKey}:sb=${sortBy}:so=${sortOrder}`;
  }

  /**
   * Generates cache key for a single farmer's comprehensive profile and stats
   */
  public static buildDetailCacheKey(userId: number): string {
    return `farmers:details:${userId}`;
  }

  /**
   * Generates cache key for a farmer's registered agricultural fields
   */
  public static buildFieldsCacheKey(
    userId: number,
    query: FarmerFieldsQueryDTO
  ): string {
    const cropType = query.cropType || "all";
    const district = query.district || "all";
    const province = query.province || "all";

    return `farmers:fields:${userId}:ct=${cropType}:d=${district}:p=${province}`;
  }

  /**
   * Generates cache key for a farmer's service requests and execution history
   */
  public static buildServicesCacheKey(
    userId: number,
    query: FarmerServiceHistoryQueryDTO
  ): string {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const status = query.status || "all";
    const priority = query.priority || "all";
    const serviceType = query.serviceType || "all";
    const fieldId = query.fieldId || "all";

    return `farmers:services:${userId}:p=${page}:l=${limit}:s=${status}:pr=${priority}:st=${serviceType}:f=${fieldId}`;
  }

  /**
   * Generates cache key for a farmer's billing records and payment history
   */
  public static buildPaymentsCacheKey(
    userId: number,
    query: FarmerPaymentQueryDTO
  ): string {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const paymentStatus = query.paymentStatus || "all";
    const paymentMethod = query.paymentMethod || "all";

    return `farmers:payments:${userId}:p=${page}:l=${limit}:s=${paymentStatus}:m=${paymentMethod}`;
  }

  /**
   * Purges farmer cache entries on mutation events (registration, profile update, field change, service request change)
   */
  public static async invalidateFarmerCaches(farmerId?: number): Promise<void> {
    const promises: Promise<unknown>[] = [];

    // 1. Invalidate all paginated/filtered farmer list caches using non-blocking SCAN + UNLINK
    promises.push(CacheService.delByPattern("farmers:list:*"));

    // 2. Invalidate specific farmer profile and sub-resources if farmerId provided
    if (farmerId) {
      promises.push(CacheService.del(this.buildDetailCacheKey(farmerId)));
      promises.push(CacheService.del(`farmers:detail:${farmerId}`));
      promises.push(CacheService.delByPattern(`farmers:fields:${farmerId}:*`));
      promises.push(CacheService.delByPattern(`farmers:services:${farmerId}:*`));
      promises.push(CacheService.delByPattern(`farmers:payments:${farmerId}:*`));
    }

    await Promise.allSettled(promises);
    console.log(
      `\x1b[35m[CACHE INVALIDATION]\x1b[0m 🔄 Farmer caches purged${
        farmerId ? ` for farmer #${farmerId}` : ""
      }.`
    );
  }
}
