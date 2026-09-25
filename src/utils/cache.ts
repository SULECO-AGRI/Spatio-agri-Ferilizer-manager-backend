import crypto from "crypto";
import { getRedisClient, isRedisReady } from "../config/redis";
import { JwtPayload } from "../types/auth.types";
import { FarmerQueryDTO, FarmerFieldsQueryDTO, FarmerServiceHistoryQueryDTO, FarmerPaymentQueryDTO } from "../types/farmer.types";
import { FieldQueryDTO } from "../types/field.types";
import { PilotQueryDTO, PilotMissionQueryDTO, PilotPayoutQueryDTO, PilotReviewQueryDTO } from "../types/pilot.types";
import { ServiceRequestQueryDTO } from "../types/service-request.types";
import { PilotPerformanceTableQueryDTO } from "../types/admin-analytics.types";

export type CacheSource = "HIT" | "MISS" | "BYPASS";

export interface CacheFetchOptions<T> {
  key: string;
  ttlSeconds: number;
  fetchFn: () => Promise<T>;
}

export interface CacheFetchResult<T> {
  data: T;
  source: CacheSource;
}

/**
 * Centralized TTL Configuration with environment variable overrides
 */
export const CACHE_TTL = {
  ADMIN_ANALYTICS: {
    SUMMARY_SECONDS: Number(process.env.CACHE_TTL_ADMIN_ANALYTICS_SECONDS) || 900,
    METRICS_SECONDS: Number(process.env.CACHE_TTL_ADMIN_METRICS_SECONDS) || 900,
    TABLE_SECONDS: Number(process.env.CACHE_TTL_ADMIN_TABLE_SECONDS) || 900,
  },
  FARMER: {
    LIST_SECONDS: Number(process.env.CACHE_TTL_FARMERS_LIST_SECONDS) || 900,
    DETAIL_SECONDS: Number(process.env.CACHE_TTL_FARMERS_DETAIL_SECONDS) || 900,
    FIELDS_SECONDS: Number(process.env.CACHE_TTL_FARMERS_FIELDS_SECONDS) || 900,
    SERVICES_SECONDS: Number(process.env.CACHE_TTL_FARMERS_SERVICES_SECONDS) || 900,
    PAYMENTS_SECONDS: Number(process.env.CACHE_TTL_FARMERS_PAYMENTS_SECONDS) || 900,
  },
  FIELD: {
    LIST_SECONDS: Number(process.env.CACHE_TTL_FIELDS_LIST_SECONDS) || 900,
    DETAIL_SECONDS: Number(process.env.CACHE_TTL_FIELDS_DETAIL_SECONDS) || 900,
  },
  PILOT: {
    LIST_SECONDS: Number(process.env.CACHE_TTL_PILOTS_LIST_SECONDS) || 900,
    DETAIL_SECONDS: Number(process.env.CACHE_TTL_PILOTS_DETAIL_SECONDS) || 1800,
    MISSIONS_SECONDS: Number(process.env.CACHE_TTL_PILOTS_MISSIONS_SECONDS) || 900,
    PAYOUTS_SECONDS: Number(process.env.CACHE_TTL_PILOTS_PAYOUTS_SECONDS) || 900,
    REVIEWS_SECONDS: Number(process.env.CACHE_TTL_PILOTS_REVIEWS_SECONDS) || 1800,
  },
  SERVICE_REQUEST: {
    LIST_SECONDS: Number(process.env.CACHE_TTL_LIST_SECONDS) || 3600,
    DETAIL_SECONDS: Number(process.env.CACHE_TTL_DETAIL_SECONDS) || 86400,
    METRICS_SECONDS: Number(process.env.CACHE_TTL_METRICS_SECONDS) || 3600,
    COUNTS_SECONDS: Number(process.env.CACHE_TTL_COUNTS_SECONDS) || 300,
  },
} as const;

/**
 * Reusable MD5 query string hash helper for compact cache keys
 */
export function hashSearchQuery(query?: string | null): string {
  if (!query || !query.trim()) {
    return "none";
  }
  return crypto
    .createHash("md5")
    .update(query.trim().toLowerCase())
    .digest("hex")
    .substring(0, 10);
}

/**
 * Deterministic Cache Key Builders for all system domains
 */
export const CacheKeyBuilder = {
  adminAnalytics: {
    summary: () => "admin:analytics:summary",
    completedMissions: () => "admin:analytics:completed-missions",
    revenue: () => "admin:analytics:revenue",
    pilotPerformance: () => "admin:analytics:pilot-performance",
    farmerGrowth: () => "admin:analytics:farmer-growth",
    pilotTable: (query: PilotPerformanceTableQueryDTO) => {
      const page = query.page || 1;
      const limit = query.limit || 10;
      const status = query.status || "all";
      const sortBy = query.sortBy || "completedMissions";
      const sortOrder = query.sortOrder || "desc";
      const searchKey = hashSearchQuery(query.search);
      return `admin:analytics:pilot-table:p=${page}:l=${limit}:s=${status}:sb=${sortBy}:so=${sortOrder}:q=${searchKey}`;
    },
  },
  farmer: {
    list: (query: FarmerQueryDTO) => {
      const page = query.page || 1;
      const limit = query.limit || 10;
      const sortBy = query.sortBy || "createdAt";
      const sortOrder = query.sortOrder || "desc";
      const searchKey = hashSearchQuery(query.search);
      return `farmers:list:p=${page}:l=${limit}:q=${searchKey}:sb=${sortBy}:so=${sortOrder}`;
    },
    detail: (userId: number) => `farmers:details:${userId}`,
    fields: (userId: number, query: FarmerFieldsQueryDTO) => {
      const cropType = query.cropType || "all";
      const district = query.district || "all";
      const province = query.province || "all";
      return `farmers:fields:${userId}:ct=${cropType}:d=${district}:p=${province}`;
    },
    services: (userId: number, query: FarmerServiceHistoryQueryDTO) => {
      const page = query.page || 1;
      const limit = query.limit || 10;
      const status = query.status || "all";
      const priority = query.priority || "all";
      const serviceType = query.serviceType || "all";
      const fieldId = query.fieldId || "all";
      return `farmers:services:${userId}:p=${page}:l=${limit}:s=${status}:pr=${priority}:st=${serviceType}:f=${fieldId}`;
    },
    payments: (userId: number, query: FarmerPaymentQueryDTO) => {
      const page = query.page || 1;
      const limit = query.limit || 10;
      const paymentStatus = query.paymentStatus || "all";
      const paymentMethod = query.paymentMethod || "all";
      return `farmers:payments:${userId}:p=${page}:l=${limit}:s=${paymentStatus}:m=${paymentMethod}`;
    },
  },
  field: {
    list: (query: FieldQueryDTO, userIdScope?: number) => {
      const page = query.page || 1;
      const limit = query.limit || 10;
      const cropType = query.cropType || "all";
      const district = query.district || "all";
      const province = query.province || "all";
      const farmerId = query.farmerId || "all";
      const scope = userIdScope || "all";
      const sortBy = query.sortBy || "createdAt";
      const sortOrder = query.sortOrder || "desc";
      const searchKey = hashSearchQuery(query.search);
      return `fields:list:s=${scope}:p=${page}:l=${limit}:ct=${cropType}:d=${district}:pr=${province}:f=${farmerId}:sb=${sortBy}:so=${sortOrder}:q=${searchKey}`;
    },
    detail: (fieldId: number) => `fields:detail:${fieldId}`,
  },
  pilot: {
    list: (query: PilotQueryDTO) => {
      const page = query.page || 1;
      const limit = query.limit || 10;
      const status = query.status || "all";
      const sortBy = query.sortBy || "createdAt";
      const sortOrder = query.sortOrder || "desc";
      const searchKey = hashSearchQuery(query.search);
      return `pilots:list:p=${page}:l=${limit}:s=${status}:q=${searchKey}:sb=${sortBy}:so=${sortOrder}`;
    },
    detail: (pilotId: number) => `pilots:details:${pilotId}`,
    missions: (pilotId: number, query: PilotMissionQueryDTO) => {
      const page = query.page || 1;
      const limit = query.limit || 10;
      const status = query.status || "all";
      const start = query.startDate || "none";
      const end = query.endDate || "none";
      return `pilots:missions:${pilotId}:p=${page}:l=${limit}:s=${status}:d1=${start}:d2=${end}`;
    },
    payouts: (pilotId: number, query: PilotPayoutQueryDTO) => {
      const page = query.page || 1;
      const limit = query.limit || 10;
      const status = query.status || "all";
      return `pilots:payouts:${pilotId}:p=${page}:l=${limit}:s=${status}`;
    },
    reviews: (pilotId: number, query: PilotReviewQueryDTO) => {
      const page = query.page || 1;
      const limit = query.limit || 10;
      const minRating = query.minRating ?? "all";
      const maxRating = query.maxRating ?? "all";
      return `pilots:reviews:${pilotId}:p=${page}:l=${limit}:min=${minRating}:max=${maxRating}`;
    },
  },
  serviceRequest: {
    list: (query: ServiceRequestQueryDTO, user?: JwtPayload) => {
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
      const searchKey = hashSearchQuery(query.search);
      return `service_requests:v2:list:role=${role}:user=${userId}:p=${page}:l=${limit}:s=${status}:pr=${priority}:stype=${serviceType}:f=${fieldId}:fid=${farmerId}:q=${searchKey}:sb=${sortBy}:so=${sortOrder}:d1=${start}:d2=${end}`;
    },
    cursor: (query: ServiceRequestQueryDTO, user?: JwtPayload) => {
      const role = user?.role ? user.role.toLowerCase() : "anonymous";
      const userId = user?.userId || 0;
      const cursor = query.cursor || "start";
      const take = query.take || query.limit || 20;
      const direction = query.direction || "forward";
      const status = query.status || "all";
      const priority = query.priority || "all";
      const fieldId = query.fieldId || "all";
      const serviceType = query.serviceType || "all";
      const farmerId = query.farmerId || "all";
      const start = query.startDate || "none";
      const end = query.endDate || "none";
      const searchKey = hashSearchQuery(query.search);
      return `service_requests:v2:cursor:role=${role}:user=${userId}:c=${cursor}:t=${take}:dir=${direction}:s=${status}:pr=${priority}:stype=${serviceType}:f=${fieldId}:fid=${farmerId}:q=${searchKey}:d1=${start}:d2=${end}`;
    },
    detail: (requestId: number) => `service_requests:v2:detail:${requestId}`,
    metrics: (user?: JwtPayload) => {
      const role = user?.role ? user.role.toLowerCase() : "anonymous";
      const userId = user?.userId || 0;
      return `service_requests:v2:metrics:role=${role}:user=${userId}`;
    },
    statusCounts: (user?: JwtPayload) => {
      const role = user?.role ? user.role.toLowerCase() : "anonymous";
      const userId = user?.userId || 0;
      return `service_requests:v2:counts:role=${role}:user=${userId}`;
    },
  },
};

/**
 * Generic Cache Service & Manager
 */
export class CacheService {
  /**
   * Retrieves and parses JSON data from Redis by key
   */
  public static async get<T>(key: string): Promise<T | null> {
    if (!isRedisReady()) {
      return null;
    }

    try {
      const client = getRedisClient();
      if (!client) return null;

      const rawData = await client.get(key);
      if (!rawData) {
        return null;
      }

      return JSON.parse(rawData) as T;
    } catch (error) {
      console.warn(`[CacheService] Error reading key "${key}":`, (error as Error).message);
      return null;
    }
  }

  /**
   * Serializes and stores value in Redis with an expiration TTL (seconds)
   */
  public static async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    if (!isRedisReady()) {
      return;
    }

    try {
      const client = getRedisClient();
      if (!client) return;

      const serialized = JSON.stringify(value);

      if (ttlSeconds && ttlSeconds > 0) {
        await client.set(key, serialized, "EX", ttlSeconds);
      } else {
        await client.set(key, serialized);
      }
    } catch (error) {
      console.warn(`[CacheService] Error setting key "${key}":`, (error as Error).message);
    }
  }

  /**
   * Deletes a specific key using non-blocking UNLINK (or DEL)
   */
  public static async del(key: string): Promise<void> {
    if (!isRedisReady()) {
      return;
    }

    try {
      const client = getRedisClient();
      if (!client) return;

      if (typeof client.unlink === "function") {
        await client.unlink(key);
      } else {
        await client.del(key);
      }
    } catch (error) {
      console.warn(`[CacheService] Error deleting key "${key}":`, (error as Error).message);
    }
  }

  /**
   * Deletes all keys matching a pattern using non-blocking SCAN stream + UNLINK
   */
  public static async delByPattern(pattern: string): Promise<number> {
    if (!isRedisReady()) {
      return 0;
    }

    try {
      const client = getRedisClient();
      if (!client) return 0;

      let deletedCount = 0;

      return new Promise<number>((resolve) => {
        const stream = client.scanStream({
          match: pattern,
          count: 100,
        });

        const keysToDelete: string[] = [];

        stream.on("data", (resultKeys: string[]) => {
          for (const k of resultKeys) {
            keysToDelete.push(k);
          }
        });

        stream.on("end", async () => {
          if (keysToDelete.length > 0) {
            try {
              if (typeof client.unlink === "function") {
                await client.unlink(...keysToDelete);
              } else {
                await client.del(...keysToDelete);
              }
              deletedCount = keysToDelete.length;
            } catch (err) {
              console.warn(
                `[CacheService] Error unlinking pattern "${pattern}":`,
                (err as Error).message
              );
            }
          }
          resolve(deletedCount);
        });

        stream.on("error", (err: Error) => {
          console.warn(
            `[CacheService] SCAN stream error for pattern "${pattern}":`,
            err.message
          );
          resolve(deletedCount);
        });
      });
    } catch (error) {
      console.warn(
        `[CacheService] Error in delByPattern for "${pattern}":`,
        (error as Error).message
      );
      return 0;
    }
  }

  /**
   * Standard Cache-Aside Execution: Checks cache, returns cached JSON on HIT,
   * or fetches fresh data from DB, saves to cache asynchronously, and returns on MISS/BYPASS.
   */
  public static async getCachedOrFetch<T>(
    options: CacheFetchOptions<T>
  ): Promise<CacheFetchResult<T>> {
    const { key, ttlSeconds, fetchFn } = options;

    const readStart = Date.now();

    // 1. Try reading from Cache
    const cachedData = await this.get<T>(key);
    const readDuration = Date.now() - readStart;

    if (cachedData !== null) {
      console.log(
        `\x1b[32m[CACHE HIT]\x1b[0m ⚡ Fetched from REDIS CACHE in \x1b[1m${readDuration}ms\x1b[0m (Key: ${key})`
      );
      return { data: cachedData, source: "HIT" };
    }

    // 2. Cache MISS or Redis Unavailable -> Fetch fresh data from primary DB
    const dbStart = Date.now();
    const freshData = await fetchFn();
    const dbDuration = Date.now() - dbStart;

    // 3. Store result in Redis asynchronously (fire & forget)
    this.set(key, freshData, ttlSeconds).catch((err) => {
      console.warn(`[CacheService] Async set failed for key "${key}":`, err.message);
    });

    const source: CacheSource = isRedisReady() ? "MISS" : "BYPASS";

    if (source === "MISS") {
      console.log(
        `\x1b[33m[CACHE MISS]\x1b[0m 🗄️  Fetched from POSTGRESQL in \x1b[1m${dbDuration}ms\x1b[0m -> Saved to Redis with TTL ${ttlSeconds}s (Key: ${key})`
      );
    } else {
      console.log(
        `\x1b[36m[DB DIRECT]\x1b[0m 🗄️  Fetched directly from POSTGRESQL in \x1b[1m${dbDuration}ms\x1b[0m (Redis Bypassed)`
      );
    }

    return { data: freshData, source };
  }

  /**
   * Simplified helper for service methods returning raw data directly
   */
  public static async getOrSet<T>(
    key: string,
    ttlSeconds: number,
    fetchFn: () => Promise<T>
  ): Promise<T> {
    const result = await this.getCachedOrFetch({ key, ttlSeconds, fetchFn });
    return result.data;
  }
}

/**
 * Domain-specific Cache Invalidation Orchestrator
 */
export const CacheInvalidator = {
  /**
   * Purges all Admin Analytics & Dashboard KPI cache entries
   */
  async invalidateAdminAnalytics(): Promise<void> {
    const promises: Promise<unknown>[] = [
      CacheService.del(CacheKeyBuilder.adminAnalytics.summary()),
      CacheService.del(CacheKeyBuilder.adminAnalytics.completedMissions()),
      CacheService.del(CacheKeyBuilder.adminAnalytics.revenue()),
      CacheService.del(CacheKeyBuilder.adminAnalytics.pilotPerformance()),
      CacheService.del(CacheKeyBuilder.adminAnalytics.farmerGrowth()),
      CacheService.delByPattern("admin:analytics:pilot-table:*"),
      CacheService.delByPattern("admin:dashboard:*"),
    ];

    await Promise.allSettled(promises);
    console.log("\x1b[35m[CACHE INVALIDATION]\x1b[0m 🔄 Admin Analytics & KPI caches purged.");
  },

  /**
   * Purges Farmer profile and related caches
   */
  async invalidateFarmer(farmerId?: number): Promise<void> {
    const promises: Promise<unknown>[] = [
      CacheService.delByPattern("farmers:list:*"),
    ];

    if (farmerId) {
      promises.push(CacheService.del(CacheKeyBuilder.farmer.detail(farmerId)));
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
  },

  /**
   * Purges Field and linked farmer/dashboard caches
   */
  async invalidateField(fieldId?: number, farmerId?: number): Promise<void> {
    const promises: Promise<unknown>[] = [
      CacheService.delByPattern("fields:list:*"),
      CacheService.delByPattern("farmers:list:*"),
      CacheService.delByPattern("farmers:fields:*"),
      CacheService.delByPattern("admin:dashboard:*"),
      CacheService.del(CacheKeyBuilder.adminAnalytics.summary()),
    ];

    if (fieldId) {
      promises.push(CacheService.del(CacheKeyBuilder.field.detail(fieldId)));
    }

    if (farmerId) {
      promises.push(CacheService.delByPattern(`farmers:fields:${farmerId}:*`));
      promises.push(CacheService.del(CacheKeyBuilder.farmer.detail(farmerId)));
      promises.push(CacheService.del(`farmers:detail:${farmerId}`));
    }

    await Promise.allSettled(promises);
    console.log(
      `\x1b[35m[CACHE INVALIDATION]\x1b[0m 🔄 Field caches purged${
        fieldId ? ` for field #${fieldId}` : ""
      }.`
    );
  },

  /**
   * Purges Pilot caches on status changes or mission updates
   */
  async invalidatePilot(pilotId?: number): Promise<void> {
    const promises: Promise<unknown>[] = [
      CacheService.delByPattern("pilots:list:*"),
    ];

    if (pilotId) {
      promises.push(CacheService.del(CacheKeyBuilder.pilot.detail(pilotId)));
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
  },

  /**
   * Purges Service Request caches on lifecycle events
   */
  async invalidateServiceRequest(requestId?: number): Promise<void> {
    const promises: Promise<unknown>[] = [
      CacheService.delByPattern("service_requests:*"),
    ];

    if (requestId) {
      promises.push(CacheService.del(CacheKeyBuilder.serviceRequest.detail(requestId)));
    }

    await Promise.allSettled(promises);
    console.log(
      `\x1b[35m[CACHE INVALIDATION]\x1b[0m 🔄 Service request caches purged${
        requestId ? ` for request #${requestId}` : ""
      }.`
    );
  },
};
