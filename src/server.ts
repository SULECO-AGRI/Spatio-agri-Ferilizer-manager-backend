import "dotenv/config";

import app from "./app";
import prisma from "./config/prisma";

const PORT = process.env.PORT || 5000;

const start = async () => {
  await prisma.$queryRaw`SELECT 1`;
  console.log("Database connected");

  const server = app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

  const shutdown = async () => {
    await prisma.$disconnect();
    server.close(() => process.exit(0));
  };
  ["SIGINT", "SIGTERM"].forEach((signal) => process.on(signal, shutdown));
};

start().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
