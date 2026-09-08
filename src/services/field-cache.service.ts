import crypto from "crypto";
import { FieldQueryDTO } from "../types/field.types";
import { CacheService } from "../utils/cache";

export const FIELD_CACHE_TTL = {
  LIST_SECONDS: Number(process.env.CACHE_TTL_FIELDS_LIST_SECONDS) || 900, // 15 minutes
  DETAIL_SECONDS: Number(process.env.CACHE_TTL_FIELDS_DETAIL_SECONDS) || 900,
};

export class FieldCacheService {
  /**
   * Generates deterministic cache key for paginated/filtered fields query
   */
  public static buildListCacheKey(query: FieldQueryDTO, userIdScope?: number): string {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const cropType = query.cropType || "all";
    const district = query.district || "all";
    const province = query.province || "all";
    const farmerId = query.farmerId || "all";
    const scope = userIdScope || "all";
    const sortBy = query.sortBy || "createdAt";
    const sortOrder = query.sortOrder || "desc";

    let searchKey = "none";
    if (query.search && query.search.trim()) {
      searchKey = crypto
        .createHash("md5")
        .update(query.search.trim().toLowerCase())
        .digest("hex")
        .substring(0, 10);
    }

    return `fields:list:s=${scope}:p=${page}:l=${limit}:ct=${cropType}:d=${district}:pr=${province}:f=${farmerId}:sb=${sortBy}:so=${sortOrder}:q=${searchKey}`;
  }

  /**
   * Generates deterministic cache key for a single field detail
   */
  public static buildDetailCacheKey(fieldId: number): string {
    return `fields:detail:${fieldId}`;
  }

  /**
   * Purges all field and farmer field caches on mutation events
   */
  public static async invalidateFieldCaches(fieldId?: number, farmerId?: number): Promise<void> {
    const promises: Promise<unknown>[] = [
      CacheService.delByPattern("fields:list:*"),
      CacheService.delByPattern("farmers:fields:*"),
      CacheService.delByPattern("admin:dashboard:*"),
      CacheService.del("admin:analytics:summary"),
    ];

    if (fieldId) {
      promises.push(CacheService.del(this.buildDetailCacheKey(fieldId)));
    }

    if (farmerId) {
      promises.push(CacheService.delByPattern(`farmers:fields:${farmerId}:*`));
      promises.push(CacheService.del(`farmers:details:${farmerId}`));
    }

    await Promise.allSettled(promises);
    console.log(
      `\x1b[35m[CACHE INVALIDATION]\x1b[0m 🔄 Field caches purged${
        fieldId ? ` for field #${fieldId}` : ""
      }.`
    );
  }
}
