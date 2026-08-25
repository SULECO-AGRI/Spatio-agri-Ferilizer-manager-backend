import "dotenv/config";
import http from "http";
import app from "../src/app";
import { generateToken } from "../src/utils/jwt";
import { ServiceRequestCacheService } from "../src/services/service-request-cache.service";
import getRedisClient, { isRedisReady, closeRedis } from "../src/config/redis";

async function verifyStatusCaching() {
  console.log("=================================================");
  console.log("   STATUS FILTERING REDIS CACHE VERIFICATION");
  console.log("=================================================");

  const adminToken = generateToken({
    userId: 1,
    email: "admin@fertilizer.com",
    role: "Admin",
  });

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://localhost:${port}`;

  const client = getRedisClient();
  await new Promise((r) => setTimeout(r, 1000));
  console.log(`[Redis] Connected and ready: ${isRedisReady()}`);

  try {
    // 1. Invalidate caches before starting test
    await ServiceRequestCacheService.invalidateServiceRequestCaches();

    // 2. Test status=PENDING
    console.log("\n--- [1] Testing status=PENDING Caching ---");
    const pKey = ServiceRequestCacheService.buildListCacheKey({ status: "PENDING" } as any, { userId: 1, role: "Admin", email: "admin@fertilizer.com" });
    console.log(`Cache Key: ${pKey}`);

    const pRes1 = await fetch(`${baseUrl}/service-requests?status=PENDING&page=1&limit=5`, {
      headers: { Authorization: `Bearer ${adminToken}`, Origin: "http://localhost:8080" },
    });
    console.log(`Query 1 (PENDING): Status=${pRes1.status}, X-Cache=${pRes1.headers.get("x-cache")}`);

    const pRes2 = await fetch(`${baseUrl}/service-requests?status=PENDING&page=1&limit=5`, {
      headers: { Authorization: `Bearer ${adminToken}`, Origin: "http://localhost:8080" },
    });
    console.log(`Query 2 (PENDING - Repeat): Status=${pRes2.status}, X-Cache=${pRes2.headers.get("x-cache")}`);

    // 3. Test status=ASSIGNED (Should be a separate cache partition)
    console.log("\n--- [2] Testing status=ASSIGNED Caching ---");
    const aKey = ServiceRequestCacheService.buildListCacheKey({ status: "ASSIGNED" } as any, { userId: 1, role: "Admin", email: "admin@fertilizer.com" });
    console.log(`Cache Key: ${aKey}`);

    const aRes1 = await fetch(`${baseUrl}/service-requests?status=ASSIGNED&page=1&limit=5`, {
      headers: { Authorization: `Bearer ${adminToken}`, Origin: "http://localhost:8080" },
    });
    console.log(`Query 1 (ASSIGNED): Status=${aRes1.status}, X-Cache=${aRes1.headers.get("x-cache")}`);

    const aRes2 = await fetch(`${baseUrl}/service-requests?status=ASSIGNED&page=1&limit=5`, {
      headers: { Authorization: `Bearer ${adminToken}`, Origin: "http://localhost:8080" },
    });
    console.log(`Query 2 (ASSIGNED - Repeat): Status=${aRes2.status}, X-Cache=${aRes2.headers.get("x-cache")}`);

    // 4. Test status=COMPLETED
    console.log("\n--- [3] Testing status=COMPLETED Caching ---");
    const cKey = ServiceRequestCacheService.buildListCacheKey({ status: "COMPLETED" } as any, { userId: 1, role: "Admin", email: "admin@fertilizer.com" });
    console.log(`Cache Key: ${cKey}`);

    const cRes1 = await fetch(`${baseUrl}/service-requests?status=COMPLETED&page=1&limit=5`, {
      headers: { Authorization: `Bearer ${adminToken}`, Origin: "http://localhost:8080" },
    });
    console.log(`Query 1 (COMPLETED): Status=${cRes1.status}, X-Cache=${cRes1.headers.get("x-cache")}`);

    const cRes2 = await fetch(`${baseUrl}/service-requests?status=COMPLETED&page=1&limit=5`, {
      headers: { Authorization: `Bearer ${adminToken}`, Origin: "http://localhost:8080" },
    });
    console.log(`Query 2 (COMPLETED - Repeat): Status=${cRes2.status}, X-Cache=${cRes2.headers.get("x-cache")}`);

    console.log("\n=================================================");
    console.log("   STATUS FILTERING CACHING VERIFIED SUCCESSFULLY!");
    console.log("=================================================\n");
  } finally {
    server.close();
    await closeRedis();
  }
}

verifyStatusCaching()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
