import { Request, Response } from "express";
import { AuthService } from "../services/auth.service";
import { PilotCacheService } from "../services/pilot-cache.service";
import { FarmerCacheService } from "../services/farmer-cache.service";
import { AdminAnalyticsCacheService } from "../services/admin-analytics-cache.service";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/AppError";
import { sendSuccess, sendCreated } from "../utils/response";

export class AuthController {
  /**
   * POST /auth/register/farmer
   */
  public static registerFarmer = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const result = await AuthService.registerFarmer(req.body);

      // Invalidate farmer directory list caches and admin analytics on new farmer registration
      Promise.allSettled([
        FarmerCacheService.invalidateFarmerCaches(),
        AdminAnalyticsCacheService.invalidateAdminAnalyticsCaches(),
      ]).catch((err) => {
        console.warn("[AuthController] Cache invalidation warning:", err.message);
      });

      sendCreated(res, result, "Farmer registered successfully.");
    }
  );

  /**
   * POST /auth/register/pilot
   */
  public static registerPilot = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const result = await AuthService.registerPilot(req.body);

      // Invalidate pilot directory list caches and admin analytics on new pilot registration
      Promise.allSettled([
        PilotCacheService.invalidatePilotCaches(),
        AdminAnalyticsCacheService.invalidateAdminAnalyticsCaches(),
      ]).catch((err) => {
        console.warn("[AuthController] Cache invalidation warning:", err.message);
      });

      sendCreated(res, result, "Pilot registered successfully.");
    }
  );

  /**
   * POST /auth/login
   */
  public static login = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const result = await AuthService.login(req.body);
      sendSuccess(res, result, "Login successful.");
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
      sendSuccess(res, user);
    }
  );
}
