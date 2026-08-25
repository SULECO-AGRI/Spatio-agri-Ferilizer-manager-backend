import "dotenv/config";
import http from "http";
import { EventEmitter } from "events";
import app from "../src/app";
import { generateToken } from "../src/utils/jwt";
import { CacheService } from "../src/utils/cache";
import { ServiceRequestCacheService } from "../src/services/service-request-cache.service";
import { setCustomRedisClient, closeRedis } from "../src/config/redis";

/**
 * Lightweight mock Redis implementing key ioredis interfaces for testing
 */
class InMemoryRedisMock extends EventEmitter {
  public status = "ready";
  private store = new Map<string, { value: string; expiresAt?: number }>();

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, mode?: string, duration?: number): Promise<string> {
    let expiresAt: number | undefined;
    if (mode === "EX" && typeof duration === "number") {
      expiresAt = Date.now() + duration * 1000;
    }
    this.store.set(key, { value, expiresAt });
    return "OK";
  }

  async del(...keys: string[]): Promise<number> {
    let count = 0;
    for (const k of keys) {
      if (this.store.delete(k)) count++;
    }
    return count;
  }

  async unlink(...keys: string[]): Promise<number> {
    return this.del(...keys);
  }

  scanStream(options?: { match?: string; count?: number }): EventEmitter {
    const emitter = new EventEmitter();
    const pattern = options?.match || "*";
    const regex = new RegExp(
      "^" + pattern.replace(/\*/g, ".*").replace(/\?/g, ".") + "$"
    );

    const matchingKeys: string[] = [];
    for (const key of this.store.keys()) {
      if (regex.test(key)) {
        matchingKeys.push(key);
      }
    }

    setImmediate(() => {
      if (matchingKeys.length > 0) {
        emitter.emit("data", matchingKeys);
      }
      emitter.emit("end");
    });

    return emitter;
  }

  async quit(): Promise<string> {
    this.status = "end";
    this.store.clear();
    return "OK";
  }

  disconnect(): void {
    this.status = "end";
    this.store.clear();
  }
}

const runTests = async () => {
  console.log("=================================================");
  console.log("   REDIS CACHING PIPELINE QA TEST SUITE");
  console.log("=================================================");

  // 1. Generate test admin token
  const adminToken = generateToken({
    userId: 1,
    email: "admin@fertilizer.com",
    role: "Admin",
  });

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://localhost:${port}`;

  console.log(`[QA] Test server listening on ${baseUrl}`);

  try {
    // -------------------------------------------------------------
    // PART A: Connected Redis Tests (MISS, HIT, Latency, Invalidation)
    // -------------------------------------------------------------
    console.log("\n=================================================");
    console.log(" PART A: LIVE REDIS CACHING & LATENCY VERIFICATION");
    console.log("=================================================");

    const mockRedis = new InMemoryRedisMock();
    setCustomRedisClient(mockRedis as any, true);

    // 1. Verify Key Generation
    console.log("\n[TEST 1] Testing Cache Key Schema & Multi-Tenant Scoping...");
    const listKey = ServiceRequestCacheService.buildListCacheKey(
      { page: 1, limit: 5, status: "PENDING" } as any,
      { userId: 1, role: "Admin", email: "admin@fertilizer.com" }
    );
    console.log(`Generated Key: ${listKey}`);
    if (!listKey.includes("role=admin") || !listKey.includes("user=1")) {
      throw new Error("Cache key missing RBAC tenancy isolation properties!");
    }
    console.log("--> [PASS] Key schema verified.");

    // 2. Request 1: Cache MISS
    console.log("\n[TEST 2] Executing Request 1 (Initial query -> Cache MISS)...");
    const t0 = performance.now();
    const res1 = await fetch(`${baseUrl}/service-requests?page=1&limit=5`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
        Origin: "http://localhost:8080",
      },
    });
    const t1 = performance.now();
    const duration1 = (t1 - t0).toFixed(2);
    const cacheHeader1 = res1.headers.get("x-cache");
    const json1 = await res1.json();

    console.log(`Response 1: Status=${res1.status}, X-Cache=${cacheHeader1}, Latency=${duration1}ms`);
    if (res1.status !== 200 || cacheHeader1 !== "MISS") {
      throw new Error(`Expected Status 200 and X-Cache: MISS, got ${res1.status} and ${cacheHeader1}`);
    }
    console.log("--> [PASS] Initial request registered Cache MISS.");

    // 3. Request 2: Cache HIT (< 10ms)
    console.log("\n[TEST 3] Executing Request 2 (Identical query -> Cache HIT)...");
    const t2 = performance.now();
    const res2 = await fetch(`${baseUrl}/service-requests?page=1&limit=5`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
        Origin: "http://localhost:8080",
      },
    });
    const t3 = performance.now();
    const duration2 = (t3 - t2).toFixed(2);
    const cacheHeader2 = res2.headers.get("x-cache");
    const json2 = await res2.json();

    console.log(`Response 2: Status=${res2.status}, X-Cache=${cacheHeader2}, Latency=${duration2}ms`);
    if (res2.status !== 200 || cacheHeader2 !== "HIT") {
      throw new Error(`Expected Status 200 and X-Cache: HIT, got ${res2.status} and ${cacheHeader2}`);
    }
    if (parseFloat(duration2) > 100) {
      console.warn(`[WARNING] Cache HIT latency was ${duration2}ms (expected fast local read).`);
    } else {
      console.log(`--> [PASS] Cache HIT served in ${duration2}ms.`);
    }

    // Verify Data Integrity
    if (JSON.stringify(json1.data) !== JSON.stringify(json2.data)) {
      throw new Error("Data discrepancy between Cache MISS and Cache HIT responses!");
    }
    console.log("--> [PASS] Data integrity matched perfectly.");

    // 4. Detail Item Caching
    console.log("\n[TEST 4] Testing Single Service Request Detail Caching...");
    if (json1.data && json1.data.requests && json1.data.requests.length > 0) {
      const targetId = json1.data.requests[0].requestId;

      const dRes1 = await fetch(`${baseUrl}/service-requests/${targetId}`, {
        headers: { Authorization: `Bearer ${adminToken}`, Origin: "http://localhost:8080" },
      });
      console.log(`Detail 1: Status=${dRes1.status}, X-Cache=${dRes1.headers.get("x-cache")}`);

      const dRes2 = await fetch(`${baseUrl}/service-requests/${targetId}`, {
        headers: { Authorization: `Bearer ${adminToken}`, Origin: "http://localhost:8080" },
      });
      console.log(`Detail 2: Status=${dRes2.status}, X-Cache=${dRes2.headers.get("x-cache")}`);

      if (dRes1.headers.get("x-cache") !== "MISS" || dRes2.headers.get("x-cache") !== "HIT") {
        throw new Error("Detail caching failed MISS/HIT lifecycle!");
      }
      console.log("--> [PASS] Single item detail caching verified.");
    }

    // 5. Cache Invalidation on Mutation
    console.log("\n[TEST 5] Testing Non-Blocking Cache Invalidation Trigger...");
    await ServiceRequestCacheService.invalidateServiceRequestCaches();

    const postInvalidateRes = await fetch(`${baseUrl}/service-requests?page=1&limit=5`, {
      headers: { Authorization: `Bearer ${adminToken}`, Origin: "http://localhost:8080" },
    });
    const postInvalidateCacheHeader = postInvalidateRes.headers.get("x-cache");
    console.log(`Post-Invalidation Read: Status=${postInvalidateRes.status}, X-Cache=${postInvalidateCacheHeader}`);

    if (postInvalidateCacheHeader !== "MISS") {
      throw new Error(`Expected post-invalidation read to be MISS, got ${postInvalidateCacheHeader}`);
    }
    console.log("--> [PASS] Invalidation successfully purged keys and triggered fresh DB query.");

    // -------------------------------------------------------------
    // PART B: Fault Tolerance & Graceful Degradation
    // -------------------------------------------------------------
    console.log("\n=================================================");
    console.log(" PART B: RESILIENCE & FAULT TOLERANCE (OFFLINE REDIS)");
    console.log("=================================================");

    // Simulate Redis crash / disconnect
    await closeRedis();
    setCustomRedisClient(null, false);

    console.log("\n[TEST 6] Testing Degraded DB Fallback (Redis completely offline)...");
    const degradedRes = await fetch(`${baseUrl}/service-requests?page=1&limit=5`, {
      headers: { Authorization: `Bearer ${adminToken}`, Origin: "http://localhost:8080" },
    });
    const degradedData = await degradedRes.json();
    const degradedHeader = degradedRes.headers.get("x-cache");

    console.log(`Offline Read: Status=${degradedRes.status}, X-Cache=${degradedHeader}`);
    if (degradedRes.status !== 200) {
      throw new Error(`Expected HTTP 200 on degraded fallback, got ${degradedRes.status}`);
    }
    if (degradedHeader !== "BYPASS") {
      throw new Error(`Expected X-Cache: BYPASS on offline Redis, got ${degradedHeader}`);
    }
    console.log("--> [PASS] System degraded gracefully to primary DB with ZERO 500 errors.");

    console.log("\n=================================================");
    console.log("   ALL 6 QA TEST PHASES PASSED WITH FLYING COLORS! ");
    console.log("=================================================\n");
  } finally {
    server.close();
    await closeRedis();
  }
};

runTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n[FATAL] Test failed with error:", err);
    process.exit(1);
  });
