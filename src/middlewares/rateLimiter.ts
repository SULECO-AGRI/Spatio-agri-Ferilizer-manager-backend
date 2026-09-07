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
  /** Distinct Redis key prefix to prevent collision across different limiters */
  prefix: string;
  /** When true, successful requests (2xx status codes) do not count against the rate limit */
  skipSuccessfulRequests?: boolean;
  /** When true, failed requests (4xx/5xx status codes) do not count against the rate limit */
  skipFailedRequests?: boolean;
  /** Optional custom skip predicate function */
  skip?: (req: Request) => boolean;
}

/**
 * Extracts and normalizes the client IP address.
 * Handles X-Forwarded-For (from proxies/load balancers), Express req.ip,
 * and normalizes IPv6-mapped IPv4 representations (e.g., ::ffff:127.0.0.1 -> 127.0.0.1).
 */
export function getClientIp(req: Request): string {
  const xForwardedFor = req.headers["x-forwarded-for"];
  let ip = "";

  if (typeof xForwardedFor === "string") {
    ip = xForwardedFor.split(",")[0].trim();
  } else if (Array.isArray(xForwardedFor) && xForwardedFor.length > 0) {
    ip = xForwardedFor[0].trim();
  } else if (req.ip) {
    ip = req.ip;
  } else if (req.socket?.remoteAddress) {
    ip = req.socket.remoteAddress;
  }

  if (!ip || ip === "::1") {
    return "127.0.0.1";
  }

  // Strip IPv6-mapped IPv4 prefix
  return ip.replace(/^::ffff:/, "");
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
      prefix: config.prefix, // Use isolated prefix per limiter
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
 *  - If Upstash credentials exist -> use @upstash/ratelimit (REST-based, sliding window, isolated prefix)
 *  - Otherwise -> fall back to express-rate-limit's built-in in-memory store
 *
 * Security & Reliability:
 *  - skipSuccessfulRequests: When enabled, successful responses (HTTP 2xx) reset
 *    or do not penalize the IP counter, strictly targeting failed brute-force attempts.
 *  - OPTIONS preflight requests bypass rate limiting entirely.
 *  - Client IP is normalized behind proxies.
 */
export function createDistributedRateLimiter(
  config: RateLimiterConfig
): RequestHandler {
  const upstashLimiter = buildUpstashLimiter(config);

  if (upstashLimiter) {
    console.log(
      `[RateLimit] Upstash sliding-window limiter active [${config.prefix}]: ${config.limit} req / ${config.windowMs}ms`
    );

    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      // 1. Bypass CORS preflight OPTIONS or custom skip condition
      if (req.method === "OPTIONS" || (config.skip && config.skip(req))) {
        return next();
      }

      // 2. Resolve client IP key
      const identifier = getClientIp(req);

      try {
        const { success, limit, remaining, reset } =
          await upstashLimiter.limit(identifier);

        // 3. Set standard rate-limit response headers
        res.setHeader("RateLimit-Limit", limit);
        res.setHeader("RateLimit-Remaining", remaining);
        res.setHeader("RateLimit-Reset", Math.ceil(reset / 1000)); // seconds
        res.setHeader("X-RateLimit-Limit", limit);
        res.setHeader("X-RateLimit-Remaining", remaining);

        // 4. If rate limit exceeded, block request with 429
        if (!success) {
          res.status(429).json({
            status: "error",
            message: config.message,
          });
          return;
        }

        // 5. If skipSuccessfulRequests is true, reset used tokens upon successful completion (HTTP 2xx)
        if (config.skipSuccessfulRequests) {
          res.on("finish", async () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              try {
                await upstashLimiter.resetUsedTokens(identifier);
              } catch (resetErr) {
                console.warn(
                  "[RateLimit] Failed to reset tokens on success:",
                  (resetErr as Error).message
                );
              }
            }
          });
        }

        next();
      } catch (err) {
        // If Upstash is unreachable, pass through rather than blocking legitimate traffic
        console.warn(
          "[RateLimit] Upstash error - passing request through:",
          (err as Error).message
        );
        next();
      }
    };
  }

  // -- In-memory fallback (express-rate-limit) ------------------------------
  console.log(
    `[RateLimit] No Upstash credentials - using in-memory rate limiter [${config.prefix}]`
  );

  return rateLimit({
    windowMs: config.windowMs,
    limit: config.limit,
    standardHeaders: "draft-7",
    legacyHeaders: true,
    passOnStoreError: true,
    skipSuccessfulRequests: config.skipSuccessfulRequests ?? false,
    skipFailedRequests: config.skipFailedRequests ?? false,
    skip: (req) => req.method === "OPTIONS" || (config.skip ? config.skip(req) : false),
    keyGenerator: (req) => getClientIp(req),
    message: {
      status: "error",
      message: config.message,
    },
  });
}

/**
 * Global API Rate Limiter: 2000 requests per 15 minutes in dev (1000 in prod), isolated prefix rl:global:v2
 */
export const globalApiLimiter = createDistributedRateLimiter({
  prefix: "rl:global:v2",
  windowMs: 15 * 60 * 1000,
  limit:
    Number(process.env.RATE_LIMIT_GLOBAL_MAX) ||
    (process.env.NODE_ENV === "production" ? 1000 : 2500),
  skip: (req: Request) => {
    // Disable rate limiting if explicitly set in environment
    if (process.env.RATE_LIMIT_ENABLED === "false") {
      return true;
    }
    return false;
  },
  message: "Too many requests from this IP, please try again after 15 minutes.",
});

/**
 * Strict Auth Rate Limiter: 20 failed attempts per 15 minutes (isolated prefix rl:auth:v2)
 * Protects /login, /register routes against brute-force attacks.
 * Resets counter immediately on successful authentication (HTTP 200).
 */
export const authLimiter = createDistributedRateLimiter({
  prefix: "rl:auth:v2",
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.RATE_LIMIT_AUTH_MAX) || 20,
  skipSuccessfulRequests: true,
  skip: () => process.env.RATE_LIMIT_ENABLED === "false",
  message:
    "Too many authentication attempts from this IP, please try again after 15 minutes.",
});
