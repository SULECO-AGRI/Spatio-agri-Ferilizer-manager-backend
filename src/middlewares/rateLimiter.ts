import rateLimit, { RateLimitRequestHandler } from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import getRedisClient from "../config/redis";

interface RateLimiterConfig {
  windowMs: number;
  limit: number;
  prefix: string;
  message: string;
}

/**
 * Creates a distributed Redis-backed rate limiter with graceful offline fallback
 */
export function createDistributedRateLimiter(
  config: RateLimiterConfig
): RateLimitRequestHandler {
  const client = getRedisClient();

  // If Redis is disabled via env, use in-memory store
  const store = client
    ? new RedisStore({
        sendCommand: async (...args: string[]) => {
          return client.call(args[0], ...args.slice(1)) as any;
        },
        prefix: config.prefix,
      })
    : undefined;

  return rateLimit({
    windowMs: config.windowMs,
    limit: config.limit,
    standardHeaders: "draft-7", // Sends RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset, RateLimit-Policy
    legacyHeaders: true, // Also sends X-RateLimit-* for older HTTP client compatibility
    passOnStoreError: true, // Graceful fallback: If Redis encounters an error or network drop, pass through without 500
    message: {
      status: "error",
      message: config.message,
    },
    ...(store ? { store } : {}),
  });
}

/**
 * Global API Rate Limiter: 100 requests per 15 minutes
 */
export const globalApiLimiter = createDistributedRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.RATE_LIMIT_GLOBAL_MAX) || 100,
  prefix: "rl:global:",
  message: "Too many requests from this IP, please try again after 15 minutes.",
});

/**
 * Strict Auth Rate Limiter: 5 requests per 15 minutes (protects login/register against brute-force)
 */
export const authLimiter = createDistributedRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.RATE_LIMIT_AUTH_MAX) || 5,
  prefix: "rl:auth:",
  message: "Too many authentication attempts from this IP, please try again after 15 minutes.",
});
