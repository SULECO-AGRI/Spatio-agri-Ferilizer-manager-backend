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
    connectTimeout: 5000,
    lazyConnect: true,
    retryStrategy: (times: number) => {
      // Stop retrying after 3 attempts if Redis is local and not running
      if (times > 3) {
        if (!hasLoggedOfflineWarning) {
          hasLoggedOfflineWarning = true;
          console.warn(
            `[Redis] Offline: Cannot reach Redis at ${host}:${port}. Operating in direct PostgreSQL fallback mode.`
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
    const defaultOptions = getRedisOptions();

    if (redisUrl) {
      redisClient = new Redis(redisUrl, {
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
        connectTimeout: 6000,
        lazyConnect: true,
        keepAlive: 30000,
        family: 4,
        retryStrategy: (times: number) => {
          // Cloud Redis auto-reconnect backoff
          return Math.min(times * 200, 3000);
        },
      });
    } else {
      redisClient = new Redis(defaultOptions);
    }

    redisClient.on("connect", () => {
      hasLoggedOfflineWarning = false;
      console.log("\x1b[32m[Redis]\x1b[0m Connected to Redis server.");
    });

    redisClient.on("ready", () => {
      isReady = true;
      hasLoggedOfflineWarning = false;
      console.log("\x1b[32m[Redis]\x1b[0m Client ready to cache and serve commands.");
    });

    redisClient.on("error", (error: Error) => {
      isReady = false;
      // Filter harmless transient reconnect notices
      if (!hasLoggedOfflineWarning && !error.message.includes("ECONNRESET")) {
        hasLoggedOfflineWarning = true;
        const target = redisUrl ? "Cloud Redis" : `${defaultOptions.host}:${defaultOptions.port}`;
        console.warn(
          `\x1b[33m[Redis]\x1b[0m Connection warning (${error.message}). Operating with direct PostgreSQL fallback.`
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
          `\x1b[33m[Redis]\x1b[0m Initial connection note (${err.message}). Operating with direct PostgreSQL fallback.`
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
