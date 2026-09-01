import { Request, Response, NextFunction, RequestHandler } from "express";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis as UpstashRedis } from "@upstash/redis";
import rateLimit from "express-rate-limit";

// ---------------------------------------------------------------------------
// Why @upstash/ratelimit instead of rate-limit-redis?
//
// Upstash is a *serverless* Redis provider that communicates over HTTP/REST.
// It deliberately disables Lua scripting commands (SCRIPT LOAD, EVALSHA)
// because those commands are stateful and cannot be safely routed across their
// distributed infrastructure. The `rate-limit-redis` package relies on Lua
// scripts to atomically increment counters — so it is fundamentally
// incompatible with Upstash.
//
// `@upstash/ratelimit` is the official Upstash rate-limiting SDK. It uses
// the REST API directly (no Lua) and supports multiple algorithms:
//   - Fixed Window   → simple, low memory
//   - Sliding Window → accurate, prevents edge-of-window bursts (used here)
//   - Token Bucket   → smooth rate with burst allowance
// ---------------------------------------------------------------------------

interface RateLimiterConfig {
  /** How many requests are allowed inside the window */
  limit: number;
  /** Window duration in milliseconds */
  windowMs: number;
  /** Human-readable message returned when the limit is exceeded */
  message: string;
}

/**
 * Parses Upstash REST credentials from the `REDIS_URL` env variable.
 *
 * Upstash provides two access methods:
 *   1. Raw Redis protocol:  rediss://default:<TOKEN>@<HOST>:6379
 *   2. REST API:            https://<HOST>  +  Bearer <TOKEN>
 *
 * `@upstash/redis` uses method 2. We derive the REST URL and token from the
 * same `REDIS_URL` that `ioredis` uses for caching, so no extra env vars are
 * needed. The token is the password field in the connection string.
 */
function getUpstashCredentials(): { url: string; token: string } | null {
  // Allow explicit REST creds if someone prefers that
  const restUrl = process.env.UPSTASH_REDIS_REST_URL;
  const restToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (restUrl && restToken) return { url: restUrl, token: restToken };

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return null;

  try {
    // rediss://default:<token>@<host>:<port>
    const parsed = new URL(redisUrl);
    const token = parsed.password;
    const host = parsed.hostname;
    if (!token || !host) return null;

    // Upstash REST endpoint is always https on port 443
    return { url: `https://${host}`, token };
  } catch {
    return null;
  }
}

/**
 * Builds an `@upstash/ratelimit` Ratelimit instance backed by Upstash Redis.
 * Returns `null` if Upstash credentials are not available; the caller will
 * fall back to an in-memory express-rate-limit limiter.
 */
function buildUpstashLimiter(config: RateLimiterConfig): Ratelimit | null {
  const creds = getUpstashCredentials();
  if (!creds) return null;

  try {
    const redis = new UpstashRedis({
      url: creds.url,
      token: creds.token,
    });

    // Sliding Window prevents edge-of-window burst attacks:
    // e.g. 100 req at xx:59 + 100 req at xy:01 = 200 in 2 seconds.
    return new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(
        config.limit,
        `${config.windowMs}ms` as `${number}ms`
      ),
      analytics: false, // disable Upstash analytics write-back to reduce latency
    });
  } catch (err) {
    console.warn(
      "[RateLimit] Failed to create Upstash rate limiter:",
      (err as Error).message
    );
    return null;
  }
}

/**
 * Creates a distributed rate-limiting middleware backed by Upstash Redis.
 *
 * Strategy:
 *  - If Upstash credentials exist → use @upstash/ratelimit (REST-based, no Lua)
 *  - Otherwise → fall back to express-rate-limit's built-in in-memory store
 *
 * The in-memory fallback works correctly for single-process deployments.
 * For multi-process/multi-instance deployments you must have Upstash configured.
 */
export function createDistributedRateLimiter(
  config: RateLimiterConfig
): RequestHandler {
  const upstashLimiter = buildUpstashLimiter(config);

  if (upstashLimiter) {
    console.log(
      `[RateLimit] Upstash sliding-window limiter active: ${config.limit} req / ${config.windowMs}ms`
    );

    // Return an express middleware that calls @upstash/ratelimit on each request
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      // Use the client IP as the rate-limit key
      const identifier =
        (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
        req.socket.remoteAddress ||
        "anonymous";

      try {
        const { success, limit, remaining, reset } =
          await upstashLimiter.limit(identifier);

        // Set standard rate-limit response headers
        res.setHeader("RateLimit-Limit", limit);
        res.setHeader("RateLimit-Remaining", remaining);
        res.setHeader("RateLimit-Reset", Math.ceil(reset / 1000)); // seconds
        res.setHeader("X-RateLimit-Limit", limit);
        res.setHeader("X-RateLimit-Remaining", remaining);

        if (!success) {
          res.status(429).json({
            status: "error",
            message: config.message,
          });
          return;
        }

        next();
      } catch (err) {
        // If Upstash is unreachable, pass through rather than blocking traffic
        console.warn(
          "[RateLimit] Upstash error — passing request through:",
          (err as Error).message
        );
        next();
      }
    };
  }

  // ── In-memory fallback (express-rate-limit) ──────────────────────────────
  console.log(
    "[RateLimit] No Upstash credentials — using in-memory rate limiter " +
    "(not shared across processes)."
  );

  return rateLimit({
    windowMs: config.windowMs,
    limit: config.limit,
    standardHeaders: "draft-7",
    legacyHeaders: true,
    passOnStoreError: true,
    message: {
      status: "error",
      message: config.message,
    },
  });
}

/**
 * Global API Rate Limiter: 100 requests per 15 minutes
 */
export const globalApiLimiter = createDistributedRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.RATE_LIMIT_GLOBAL_MAX) || 100,
  message: "Too many requests from this IP, please try again after 15 minutes.",
});

/**
 * Strict Auth Rate Limiter: 5 requests per 15 minutes
 * Protects /login, /register routes against brute-force attacks.
 */
export const authLimiter = createDistributedRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.RATE_LIMIT_AUTH_MAX) || 5,
  message:
    "Too many authentication attempts from this IP, please try again after 15 minutes.",
});
