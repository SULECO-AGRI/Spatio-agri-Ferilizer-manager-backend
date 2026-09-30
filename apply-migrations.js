const fs = require("fs");
const path = require("path");
const { Client } = require("pg");
require("dotenv").config();

async function runMigrations() {
  const databaseUrl = process.env.DATABASE_URL;
  const isRemote =
    databaseUrl.includes("render.com") ||
    databaseUrl.includes("sslmode=require") ||
    (!databaseUrl.includes("localhost") && !databaseUrl.includes("127.0.0.1"));

  const client = new Client({
    connectionString: databaseUrl,
    ssl: isRemote ? { rejectUnauthorized: false } : undefined,
  });

  try {
    await client.connect();
    console.log("Connected to database:", process.env.DATABASE_URL);

    // Create prisma migrations table if not exists
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

    const migrationsDir = path.join(__dirname, "prisma", "migrations");
    const migrationFolders = fs
      .readdirSync(migrationsDir)
      .filter((f) => fs.statSync(path.join(migrationsDir, f)).isDirectory())
      .sort();

    for (const folder of migrationFolders) {
      const checkRes = await client.query(
        'SELECT 1 FROM "_prisma_migrations" WHERE "migration_name" = $1 AND "finished_at" IS NOT NULL',
        [folder]
      );

      if (checkRes.rowCount > 0) {
        console.log(`Migration already applied: ${folder}`);
        continue;
      }

      const sqlPath = path.join(migrationsDir, folder, "migration.sql");
      if (!fs.existsSync(sqlPath)) continue;

      const sql = fs.readFileSync(sqlPath, "utf-8");
      console.log(`Applying migration: ${folder}...`);

      const migrationId = require("crypto").randomUUID();
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          `INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "applied_steps_count") VALUES ($1, $2, now(), $3, 1)`,
          [migrationId, "manual-migration", folder]
        );
        await client.query("COMMIT");
        console.log(`Successfully applied: ${folder}`);
      } catch (migrationErr) {
        await client.query("ROLLBACK");
        console.error(`Error applying migration ${folder}:`, migrationErr);
        throw migrationErr;
      }
    }

    console.log("All migrations successfully processed.");
  } finally {
    await client.end();
  }
}

runMigrations().catch((err) => {
  console.error("Migration runner failed:", err);
  process.exit(1);
});
