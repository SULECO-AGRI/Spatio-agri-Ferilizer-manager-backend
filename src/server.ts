import "dotenv/config";
import app from "./app";
import prisma from "./config/prisma";
import { runPendingMigrations } from "./config/migrate";
import { getRedisClient, closeRedis } from "./config/redis";
import { SystemSettingService } from "./services/system-setting.service";

const PORT = process.env.PORT || 5000;

const start = async () => {
  // Automatically run pending migrations before connecting
  await runPendingMigrations();

  await prisma.$queryRaw`SELECT 1`;
  console.log("Database connected");

  // Pre-load dynamic system settings (pilot commission % and cost per hectare)
  try {
    const initialSettings = await SystemSettingService.getSettings();
    console.log("[Pricing Engine] Loaded settings: Pilot Commission = " + initialSettings.pilotCommissionPercentage + "%, Base Cost/Ha = LKR " + initialSettings.costPerHectare);
  } catch (settingsErr) {
    console.warn("[Pricing Engine] Initial settings load warning:", settingsErr);
  }

  // Initialize Redis client (resilient singleton)
  getRedisClient();

  const server = app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

  const shutdown = async () => {
    await prisma.$disconnect();
    await closeRedis();
    server.close(() => process.exit(0));
  };
  ["SIGINT", "SIGTERM"].forEach((signal) => process.on(signal, shutdown));
};

start().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
