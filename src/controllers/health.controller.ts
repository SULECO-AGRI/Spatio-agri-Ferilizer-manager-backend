import { Request, Response } from "express";
import { checkDatabaseConnection } from "../services/health.service";

export const getHealth = (_req: Request, res: Response): void => {
  res.status(200).json({ status: "ok" });
};

export const getDbHealth = async (_req: Request, res: Response): Promise<void> => {
  await checkDatabaseConnection();
  res.status(200).json({ status: "ok" });
};
