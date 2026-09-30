import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const databaseUrl = process.env.DATABASE_URL;
const isRemote =
  databaseUrl?.includes("render.com") ||
  databaseUrl?.includes("sslmode=require") ||
  (databaseUrl && !databaseUrl.includes("localhost") && !databaseUrl.includes("127.0.0.1"));

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: isRemote ? { rejectUnauthorized: false } : undefined,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

export default prisma;
