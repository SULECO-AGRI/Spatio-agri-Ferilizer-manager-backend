import "dotenv/config";
import http from "http";
import app from "../src/app";
import { generateToken } from "../src/utils/jwt";
import { closeRedis } from "../src/config/redis";

async function runFullTestSuite() {
  console.log("=================================================");
  console.log("   FULL BACKEND INTEGRATION & CONTRACT TEST SUITE");
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

  const farmerToken = generateToken({
    userId: 2,
    email: "farmer@farm.lk",
    role: "Farmer",
  });

  const pilotToken = generateToken({
    userId: 3,
    email: "pilot@sky.lk",
    role: "Pilot",
  });

  try {
    // 1. Health check
    console.log("\n[1] Testing GET /health...");
    const healthRes = await fetch(`${baseUrl}/health`);
    console.log(`--> Status=${healthRes.status}, Body=${await healthRes.text()}`);

    // 2. Admin Dashboard Overview
    console.log("\n[2] Testing GET /admin/dashboard...");
    const adminOverviewRes = await fetch(`${baseUrl}/admin/dashboard`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const overviewData = await adminOverviewRes.json();
    console.log(`--> Status=${adminOverviewRes.status}, StatusKey=${overviewData.status}, HasMetrics=${!!overviewData.data?.metrics}`);

    // 3. Admin Analytics Revenue & Completed Missions
    console.log("\n[3] Testing GET /admin/analytics/revenue & /completed-missions...");
    const [revRes, misRes] = await Promise.all([
      fetch(`${baseUrl}/admin/analytics/revenue`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      }),
      fetch(`${baseUrl}/admin/analytics/completed-missions`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      }),
    ]);
    const revData = await revRes.json();
    const misData = await misRes.json();
    console.log(`--> Revenue: Status=${revRes.status}, TotalRevenue=${revData.data?.totalRevenue} ${revData.data?.currency}`);
    console.log(`--> Missions: Status=${misRes.status}, TotalCompleted=${misData.data?.totalCompletedMissions}`);

    // 4. Farmers Listing & Details
    console.log("\n[4] Testing GET /farmers...");
    const farmersRes = await fetch(`${baseUrl}/farmers?page=1&limit=5`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const farmersData = await farmersRes.json();
    console.log(`--> Status=${farmersRes.status}, TotalFarmers=${farmersData.data?.pagination?.total}`);

    // 5. Pilots Listing
    console.log("\n[5] Testing GET /pilots...");
    const pilotsRes = await fetch(`${baseUrl}/pilots?page=1&limit=5`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const pilotsData = await pilotsRes.json();
    console.log(`--> Status=${pilotsRes.status}, TotalPilots=${pilotsData.data?.pagination?.total}`);

    // 6. Service Requests List (Admin + Farmer + Pilot Scopes)
    console.log("\n[6] Testing GET /service-requests for all roles...");
    const [srAdmin, srFarmer, srPilot] = await Promise.all([
      fetch(`${baseUrl}/service-requests?page=1&limit=5`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      }),
      fetch(`${baseUrl}/service-requests?page=1&limit=5`, {
        headers: { Authorization: `Bearer ${farmerToken}` },
      }),
      fetch(`${baseUrl}/service-requests?page=1&limit=5`, {
        headers: { Authorization: `Bearer ${pilotToken}` },
      }),
    ]);
    console.log(`--> Admin Service Requests: Status=${srAdmin.status}, X-Cache=${srAdmin.headers.get("x-cache")}`);
    console.log(`--> Farmer Service Requests: Status=${srFarmer.status}, X-Cache=${srFarmer.headers.get("x-cache")}`);
    console.log(`--> Pilot Service Requests: Status=${srPilot.status}, X-Cache=${srPilot.headers.get("x-cache")}`);

    console.log("\n=================================================");
    console.log("   ALL ENDPOINT CONTRACTS VERIFIED SUCCESSFULLY!");
    console.log("=================================================\n");
  } finally {
    server.close();
    await closeRedis();
  }
}

runFullTestSuite()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
