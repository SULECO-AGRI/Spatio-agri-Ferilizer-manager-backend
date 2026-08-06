import prisma from "../config/prisma";

export const checkDatabaseConnection = async (): Promise<void> => {
  await prisma.$queryRaw`SELECT 1`;
};
