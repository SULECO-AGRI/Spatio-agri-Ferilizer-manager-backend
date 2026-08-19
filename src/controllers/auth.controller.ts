import { Request, Response } from "express";
import { AuthService } from "../services/auth.service";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/AppError";

export class AuthController {
  /**
   * POST /auth/register/farmer
   */
  public static registerFarmer = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const result = await AuthService.registerFarmer(req.body);
      res.status(201).json({
        status: "success",
        message: "Farmer registered successfully.",
        data: result,
      });
    }
  );

  /**
   * POST /auth/register/pilot
   */
  public static registerPilot = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const result = await AuthService.registerPilot(req.body);
      res.status(201).json({
        status: "success",
        message: "Pilot registered successfully.",
        data: result,
      });
    }
  );

  /**
   * POST /auth/login
   */
  public static login = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const result = await AuthService.login(req.body);
      res.status(200).json({
        status: "success",
        message: "Login successful.",
        data: result,
      });
    }
  );

  /**
   * GET /auth/me
   */
  public static getMe = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      if (!req.user) {
        throw AppError.unauthorized("Authentication required.");
      }

      const user = await AuthService.getMe(req.user.userId);
      res.status(200).json({
        status: "success",
        data: user,
      });
    }
  );
}
