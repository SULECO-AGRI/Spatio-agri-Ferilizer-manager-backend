import { Response } from "express";
import { getRedisClient, isRedisReady } from "../config/redis";

export type CacheSource = "HIT" | "MISS" | "BYPASS";

export interface CacheFetchOptions<T> {
  key: string;
  ttlSeconds: number;
  fetchFn: () => Promise<T>;
  res?: Response;
}

export interface CacheFetchResult<T> {
  data: T;
  source: CacheSource;
}

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
   * Cache-Aside Execution: Checks cache, returns cached JSON on HIT,
   * or fetches from DB, saves to cache, and returns on MISS/BYPASS.
   */
  public static async getCachedOrFetch<T>(
    options: CacheFetchOptions<T>
  ): Promise<CacheFetchResult<T>> {
    const { key, ttlSeconds, fetchFn, res } = options;

    const readStart = Date.now();

    // 1. Try reading from Cache
    const cachedData = await this.get<T>(key);
    const readDuration = Date.now() - readStart;

    if (cachedData !== null) {
      if (res && !res.headersSent) {
        res.setHeader("X-Cache", "HIT");
      }
      console.log(
        `\x1b[32m[CACHE HIT]\x1b[0m ⚡ Fetched from REDIS CACHE in \x1b[1m${readDuration}ms\x1b[0m (Key: ${key})`
      );
      return { data: cachedData, source: "HIT" };
    }

    // 2. Cache MISS or Redis Unavailable -> Fetch fresh data from primary DB
    const dbStart = Date.now();
    const freshData = await fetchFn();
    const dbDuration = Date.now() - dbStart;

    // 3. Store result in Redis asynchronously (fire & forget to not block client)
    this.set(key, freshData, ttlSeconds).catch((err) => {
      console.warn(`[CacheService] Async set failed for key "${key}":`, err.message);
    });

    const source: CacheSource = isRedisReady() ? "MISS" : "BYPASS";

    if (res && !res.headersSent) {
      res.setHeader("X-Cache", source);
    }

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
}
