import "dotenv/config";
import Redis, { RedisOptions } from "ioredis";

let redisClient: Redis | null = null;
let isReady = false;
let hasLoggedOfflineWarning = false;

const isRedisEnabled = (): boolean => {
  return process.env.REDIS_ENABLED !== "false";
};

/**
 * Builds Redis connection configuration from environment variables
 */
const getRedisOptions = (): RedisOptions => {
  const host = process.env.REDIS_HOST || "127.0.0.1";
  const port = Number(process.env.REDIS_PORT) || 6379;
  const password = process.env.REDIS_PASSWORD || undefined;

  return {
    host,
    port,
    password,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    connectTimeout: 4000,
    lazyConnect: true,
    retryStrategy: (times: number) => {
      // Stop retrying after 3 attempts if Redis is not running locally
      if (times > 3) {
        if (!hasLoggedOfflineWarning) {
          hasLoggedOfflineWarning = true;
          console.warn(
            `[Redis] Offline: Cannot reach Redis at ${host}:${port}. Operating in degraded mode (direct PostgreSQL fallback).`
          );
        }
        return null;
      }
      return Math.min(times * 300, 1000);
    },
  };
};

/**
 * Initializes and returns the singleton Redis client instance
 */
export const getRedisClient = (): Redis | null => {
  if (!isRedisEnabled()) {
    if (!hasLoggedOfflineWarning) {
      hasLoggedOfflineWarning = true;
      console.log("[Redis] REDIS_ENABLED is false. Running with direct PostgreSQL queries.");
    }
    return null;
  }

  if (!redisClient) {
    const redisUrl = process.env.REDIS_URL;
    const options = getRedisOptions();

    redisClient = redisUrl
      ? new Redis(redisUrl, {
          maxRetriesPerRequest: 1,
          enableOfflineQueue: false,
          connectTimeout: 4000,
          lazyConnect: true,
          retryStrategy: options.retryStrategy,
        })
      : new Redis(options);

    redisClient.on("connect", () => {
      hasLoggedOfflineWarning = false;
      console.log("[Redis] Connected to server.");
    });

    redisClient.on("ready", () => {
      isReady = true;
      hasLoggedOfflineWarning = false;
      console.log("[Redis] Client ready to process commands.");
    });

    redisClient.on("error", (error: Error) => {
      isReady = false;
      if (!hasLoggedOfflineWarning) {
        hasLoggedOfflineWarning = true;
        const target = redisUrl || `${options.host}:${options.port}`;
        console.warn(
          `[Redis] Cannot connect to Redis at ${target} (${error.message}). Caching disabled, falling back to PostgreSQL.`
        );
      }
    });

    redisClient.on("close", () => {
      isReady = false;
    });

    redisClient.on("reconnecting", () => {
      isReady = false;
    });

    // Initiate connection asynchronously
    redisClient.connect().catch((err: Error) => {
      isReady = false;
      if (!hasLoggedOfflineWarning) {
        hasLoggedOfflineWarning = true;
        console.warn(
          `[Redis] Initial connection failed (${err.message}). Caching disabled, falling back to PostgreSQL.`
        );
      }
    });
  }

  return redisClient;
};

/**
 * Checks whether Redis is currently connected and operational
 */
export const isRedisReady = (): boolean => {
  return isReady && redisClient !== null && redisClient.status === "ready";
};

/**
 * Graceful shutdown of the Redis client
 */
export const closeRedis = async (): Promise<void> => {
  if (redisClient) {
    try {
      await redisClient.quit();
    } catch {
      redisClient.disconnect();
    } finally {
      redisClient = null;
      isReady = false;
      hasLoggedOfflineWarning = false;
    }
  }
};

/**
 * Injects a custom or mock Redis client instance (primarily for automated testing)
 */
export const setCustomRedisClient = (
  customClient: Redis | null,
  readyState = true
): void => {
  redisClient = customClient;
  isReady = readyState;
  hasLoggedOfflineWarning = false;
};

export default getRedisClient;
