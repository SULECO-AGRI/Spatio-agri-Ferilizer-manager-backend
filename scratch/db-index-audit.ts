import "dotenv/config";
import prisma from "../src/config/prisma";

async function runIndexScanVerification() {
  console.log("=================================================");
  console.log("   INDEX SCAN PATH & BUFFER PROFILE VERIFICATION");
  console.log("=================================================");

  // Force PostgreSQL query optimizer to inspect Index Scan paths
  await prisma.$executeRawUnsafe(`SET enable_seqscan = OFF;`);

  console.log("\n[INDEX SCAN 1: Status + CreatedAt DESC]");
  const plan1 = await prisma.$queryRawUnsafe<Array<{ "QUERY PLAN": string }>>(
    `EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM service_requests WHERE status = 'PENDING'::"RequestStatus" ORDER BY created_at DESC LIMIT 20;`
  );
  plan1.forEach((p) => console.log(p["QUERY PLAN"]));

  console.log("\n[INDEX SCAN 2: Field ID + Status + CreatedAt DESC]");
  const plan2 = await prisma.$queryRawUnsafe<Array<{ "QUERY PLAN": string }>>(
    `EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM service_requests WHERE field_id = 1 AND status = 'PENDING'::"RequestStatus" ORDER BY created_at DESC LIMIT 20;`
  );
  plan2.forEach((p) => console.log(p["QUERY PLAN"]));

  console.log("\n[INDEX SCAN 3: Preferred Date + Status + CreatedAt DESC]");
  const plan3 = await prisma.$queryRawUnsafe<Array<{ "QUERY PLAN": string }>>(
    `EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM service_requests WHERE preferred_date >= '2026-01-01' AND preferred_date <= '2026-12-31' AND status = 'PENDING'::"RequestStatus" ORDER BY created_at DESC LIMIT 20;`
  );
  plan3.forEach((p) => console.log(p["QUERY PLAN"]));

  console.log("\n[INDEX SCAN 4: High-Traffic Active Request Partial Index]");
  const plan4 = await prisma.$queryRawUnsafe<Array<{ "QUERY PLAN": string }>>(
    `EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM service_requests WHERE status = 'PENDING'::"RequestStatus" AND priority = 'MEDIUM'::"RequestPriority" ORDER BY created_at DESC LIMIT 20;`
  );
  plan4.forEach((p) => console.log(p["QUERY PLAN"]));

  console.log("\n[INDEX SCAN 5: Pilot Assigned Missions Composite Index]");
  const plan5 = await prisma.$queryRawUnsafe<Array<{ "QUERY PLAN": string }>>(
    `EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM missions WHERE pilot_id = 1 AND status = 'SCHEDULED'::"MissionStatus" ORDER BY created_at DESC LIMIT 20;`
  );
  plan5.forEach((p) => console.log(p["QUERY PLAN"]));

  await prisma.$executeRawUnsafe(`RESET enable_seqscan;`);
  await prisma.$disconnect();
}

runIndexScanVerification().catch(console.error);
