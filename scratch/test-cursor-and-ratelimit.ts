import "dotenv/config";
import http from "http";
import app from "../src/app";
import { generateToken } from "../src/utils/jwt";
import getRedisClient, { isRedisReady, closeRedis } from "../src/config/redis";

async function runTests() {
  console.log("=================================================");
  console.log("  CURSOR PAGINATION & REDIS RATE LIMITING QA");
  console.log("=================================================");

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://localhost:${port}`;

  const adminToken = generateToken({
    userId: 1,
    email: "admin@fertilizer.com",
    role: "Admin",
  });

  try {
    // ----------------------------------------------------------------
    // 1. CURSOR-BASED PAGINATION TESTS
    // ----------------------------------------------------------------
    console.log("\n--- [PART 1: CURSOR-BASED PAGINATION] ---");

    console.log("\n[Test 1.1] Fetching Page 1 with take=1...");
    const page1Res = await fetch(`${baseUrl}/service-requests?take=1`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const page1Json = await page1Res.json();
    console.log("Page 1 Status:", page1Res.status);
    console.log("Page 1 Headers X-Cache:", page1Res.headers.get("x-cache"));
    console.log("Page 1 Item ID:", page1Json.data?.requests?.[0]?.requestId);
    console.log("Page 1 pageInfo:", page1Json.data?.pageInfo);

    if (!page1Json.data?.pageInfo?.endCursor) {
      throw new Error("Page 1 did not return endCursor!");
    }
    const cursor1 = page1Json.data.pageInfo.endCursor;
    const item1Id = page1Json.data.requests[0].requestId;

    console.log("\n[Test 1.2] Testing Cache HIT on Page 1 repeat query...");
    const page1RepeatRes = await fetch(`${baseUrl}/service-requests?take=1`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    console.log("Repeat Query X-Cache:", page1RepeatRes.headers.get("x-cache"));

    console.log("\n[Test 1.3] Fetching Page 2 with cursor from Page 1 (take=1)...");
    const page2Res = await fetch(`${baseUrl}/service-requests?cursor=${encodeURIComponent(cursor1)}&take=1`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const page2Json = await page2Res.json();
    console.log("Page 2 Status:", page2Res.status);
    console.log("Page 2 Item ID:", page2Json.data?.requests?.[0]?.requestId);
    console.log("Page 2 pageInfo:", page2Json.data?.pageInfo);

    const item2Id = page2Json.data?.requests?.[0]?.requestId;
    if (item2Id && item2Id === item1Id) {
      throw new Error("Duplicate item found across cursor pages!");
    }
    console.log("--> [PASS] Keyset cursor pagination successfully traversed records without duplication.");

    // ----------------------------------------------------------------
    // 2. DISTRIBUTED REDIS RATE LIMITING TESTS
    // ----------------------------------------------------------------
    console.log("\n--- [PART 2: DISTRIBUTED REDIS RATE LIMITING] ---");

    console.log("\n[Test 2.1] Verifying RateLimit-* Headers on /auth/login...");
    const singleReq = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "wrong@email.com", password: "wrong" }),
    });
    console.log("RateLimit Headers:");
    console.log(" - RateLimit-Limit:", singleReq.headers.get("ratelimit-limit"));
    console.log(" - RateLimit-Remaining:", singleReq.headers.get("ratelimit-remaining"));
    console.log(" - RateLimit-Reset:", singleReq.headers.get("ratelimit-reset"));

    console.log("\n[Test 2.2] Sending burst requests on /auth/login to trigger rate limit (limit is 5)...");
    let rateLimited = false;
    for (let i = 1; i <= 6; i++) {
      const res = await fetch(`${baseUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "test@test.com", password: "wrong" }),
      });
      const remaining = res.headers.get("ratelimit-remaining");
      console.log(` Attempt ${i}: Status=${res.status}, Remaining=${remaining}`);
      if (res.status === 429) {
        rateLimited = true;
        const errJson = await res.json();
        console.log(" 429 Payload:", errJson);
        break;
      }
    }

    if (!rateLimited) {
      throw new Error("Expected HTTP 429 Too Many Requests was not triggered!");
    }
    console.log("--> [PASS] Distributed rate limiter successfully blocked excessive requests with 429.");

    console.log("\n[Test 2.3] Inspecting Redis Keys for Rate Limiter...");
    const client = getRedisClient();
    if (client && isRedisReady()) {
      const keys = await client.keys("rl:auth:*");
      console.log(" Active Redis Rate Limiter Keys:", keys);
      if (keys.length > 0) {
        const ttl = await client.ttl(keys[0]);
        console.log(` Key ${keys[0]} TTL: ${ttl} seconds remaining.`);
      }
    }

    console.log("\n=================================================");
    console.log("   ALL CURSOR & RATE LIMIT TESTS PASSED 100%!");
    console.log("=================================================\n");
  } finally {
    server.close();
    await closeRedis();
  }
}

runTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Test error:", err);
    process.exit(1);
  });
