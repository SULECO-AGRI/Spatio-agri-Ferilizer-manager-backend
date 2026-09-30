import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { Client } from "pg";

/**
 * Automatically detects and executes pending Prisma SQL migrations
 * before server initialization and Prisma Client connection.
 */
export async function runPendingMigrations(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is missing.");
  }

  const isRemote =
    databaseUrl.includes("render.com") ||
    databaseUrl.includes("sslmode=require") ||
    !databaseUrl.includes("localhost") && !databaseUrl.includes("127.0.0.1");

  const client = new Client({
    connectionString: databaseUrl,
    ssl: isRemote ? { rejectUnauthorized: false } : undefined,
  });

  try {
    await client.connect();

    // Ensure _prisma_migrations table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
        "id" VARCHAR(36) NOT NULL PRIMARY KEY,
        "checksum" VARCHAR(64) NOT NULL,
        "finished_at" TIMESTAMPTZ,
        "migration_name" VARCHAR(255) NOT NULL,
        "logs" TEXT,
        "rolled_back_at" TIMESTAMPTZ,
        "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "applied_steps_count" INTEGER NOT NULL DEFAULT 0
      );
    `);

    // Look for migration directories in prisma/migrations
    const migrationsDir = path.resolve(process.cwd(), "prisma", "migrations");
    if (!fs.existsSync(migrationsDir)) {
      console.log("[Migration] No migrations directory found. Skipping.");
      return;
    }

    const migrationFolders = fs
      .readdirSync(migrationsDir)
      .filter((entry) => {
        const fullPath = path.join(migrationsDir, entry);
        return fs.statSync(fullPath).isDirectory();
      })
      .sort();

    let appliedCount = 0;

    for (const folder of migrationFolders) {
      const sqlPath = path.join(migrationsDir, folder, "migration.sql");
      if (!fs.existsSync(sqlPath)) continue;

      // Check if migration is already recorded
      const checkRes = await client.query(
        'SELECT "id" FROM "_prisma_migrations" WHERE "migration_name" = $1 AND "finished_at" IS NOT NULL',
        [folder]
      );

      if (checkRes.rowCount && checkRes.rowCount > 0) {
        continue;
      }

      const sql = fs.readFileSync(sqlPath, "utf-8");
      const checksum = crypto.createHash("sha256").update(sql).digest("hex");
      const migrationId = crypto.randomUUID();

      console.log(`[Migration] Applying pending migration: ${folder}...`);

      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          `INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "applied_steps_count")
           VALUES ($1, $2, now(), $3, 1)`,
          [migrationId, checksum, folder]
        );
        await client.query("COMMIT");
        console.log(`[Migration] Successfully applied: ${folder}`);
        appliedCount++;
      } catch (migrationErr) {
        await client.query("ROLLBACK");
        console.error(`[Migration] Error executing migration ${folder}:`, migrationErr);
        throw migrationErr;
      }
    }

    if (appliedCount === 0) {
      console.log("[Migration] Database schema is already up-to-date.");
    } else {
      console.log(`[Migration] Completed applying ${appliedCount} migration(s).`);
    }
  } finally {
    await client.end();
  }
}
