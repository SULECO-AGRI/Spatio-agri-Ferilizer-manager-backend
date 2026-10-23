/**
 * ==============================================================================
 * SPATIO-AGRI PRECISION FERTILIZER MANAGEMENT SYSTEM
 * Dynamic System Settings & Pricing Controller
 * File: src/controllers/system-setting.controller.ts
 * ==============================================================================
 */

import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { SystemSettingService } from "../services/system-setting.service";
import { sendSuccess } from "../utils/response";

export class SystemSettingController {
  /**
   * GET /admin/settings OR /settings
   * Retrieve current dynamic settings (pilot commission %, cost/ha, rates)
   */
  public static getSettings = asyncHandler(
    async (_req: Request, res: Response): Promise<void> => {
      const settings = await SystemSettingService.getSettings();
      sendSuccess(res, settings, "System settings retrieved successfully.");
    }
  );

  /**
   * PUT /admin/settings
   * Admin updates dynamic pricing and pilot commission settings
   */
  public static updateSettings = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const userId = req.user?.userId;
      const updatedSettings = await SystemSettingService.updateSettings(
        req.body,
        userId
      );
      sendSuccess(res, updatedSettings, "System settings updated successfully.");
    }
  );
}