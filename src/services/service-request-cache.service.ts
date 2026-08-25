import crypto from "crypto";
import { ServiceRequestQueryDTO } from "../types/service-request.types";
import { JwtPayload } from "../types/auth.types";
import { CacheService } from "../utils/cache";

export const SERVICE_REQUEST_CACHE_TTL = {
  LIST_SECONDS: Number(process.env.CACHE_TTL_LIST_SECONDS) || 3600, // 1 hour (3,600s)
  DETAIL_SECONDS: Number(process.env.CACHE_TTL_DETAIL_SECONDS) || 86400, // 24 hours (86,400s)
  METRICS_SECONDS: Number(process.env.CACHE_TTL_METRICS_SECONDS) || 3600, // 1 hour (3,600s)
};

export class ServiceRequestCacheService {
  /**
   * Generates a deterministic cache key for Service Requests list queries
   * incorporates user role and ID to maintain strict RBAC tenancy isolation.
   */
  public static buildListCacheKey(
    query: ServiceRequestQueryDTO,
    user?: JwtPayload
  ): string {
    const role = user?.role ? user.role.toLowerCase() : "anonymous";
    const userId = user?.userId || 0;

    const page = query.page || 1;
    const limit = query.limit || 10;
    const status = query.status || "all";
    const priority = query.priority || "all";
    const fieldId = query.fieldId || "all";
    const serviceType = query.serviceType || "all";
    const farmerId = query.farmerId || "all";
    const sortBy = query.sortBy || "createdAt";
    const sortOrder = query.sortOrder || "desc";
    const start = query.startDate || "none";
    const end = query.endDate || "none";

    let searchKey = "none";
    if (query.search && query.search.trim()) {
      // Hash search string to keep key lengths manageable and clean
      searchKey = crypto
        .createHash("md5")
        .update(query.search.trim().toLowerCase())
        .digest("hex")
        .substring(0, 10);
    }

    return `service_requests:list:role=${role}:user=${userId}:p=${page}:l=${limit}:s=${status}:pr=${priority}:stype=${serviceType}:f=${fieldId}:fid=${farmerId}:q=${searchKey}:sb=${sortBy}:so=${sortOrder}:d1=${start}:d2=${end}`;
  }

  /**
   * Generates cache key for a single service request detail
   */
  public static buildDetailCacheKey(requestId: number): string {
    return `service_requests:detail:${requestId}`;
  }

  /**
   * Generates cache key for aggregated metrics
   */
  public static buildMetricsCacheKey(user?: JwtPayload): string {
    const role = user?.role ? user.role.toLowerCase() : "anonymous";
    const userId = user?.userId || 0;
    return `service_requests:metrics:role=${role}:user=${userId}`;
  }

  /**
   * Purges cache entries on mutation events (create, update, assign, delete)
   */
  public static async invalidateServiceRequestCaches(requestId?: number): Promise<void> {
    const promises: Promise<unknown>[] = [];

    // 1. Invalidate specific request detail if ID provided
    if (requestId) {
      promises.push(CacheService.del(this.buildDetailCacheKey(requestId)));
    }

    // 2. Invalidate all paginated/filtered list caches using non-blocking SCAN + UNLINK
    promises.push(CacheService.delByPattern("service_requests:list:*"));

    // 3. Invalidate metrics/summary cache keys
    promises.push(CacheService.delByPattern("service_requests:metrics:*"));

    await Promise.allSettled(promises);
  }
}
