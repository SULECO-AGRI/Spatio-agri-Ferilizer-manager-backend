/**
 * ==============================================================================
 * SPATIO-AGRI PRECISION FERTILIZER MANAGEMENT SYSTEM
 * Dynamic System Settings & Pricing Engine Service
 * File: src/services/system-setting.service.ts
 * ==============================================================================
 */

import prisma from "../config/prisma";
import { AppError } from "../utils/AppError";
import { logActivity } from "../utils/activityLogger";

export interface SystemSettingsDTO {
  pilotCommissionPercentage: number;
  costPerHectare: number;
  minimumDispatchFee?: number;
  operationRates?: Record<string, number>;
  currency: string;
  updatedAt?: Date;
}

export interface UpdateSystemSettingsDTO {
  pilotCommissionPercentage?: number;
  costPerHectare?: number;
  minimumDispatchFee?: number;
  operationRates?: Record<string, number>;
}

export class SystemSettingService {
  public static readonly DEFAULT_PILOT_COMMISSION_PERCENTAGE = 70;
  public static readonly DEFAULT_COST_PER_HECTARE = 6200;
  public static readonly DEFAULT_MINIMUM_DISPATCH_FEE = 3500;
  public static readonly CURRENCY = "LKR";

  // In-memory micro-cache (30s) to keep high performance across rapid cost estimates and requests
  private static cachedSettings: SystemSettingsDTO | null = null;
  private static lastCacheTime = 0;
  private static readonly CACHE_TTL_MS = 30_000;

  /**
   * Retrieves all dynamic system settings from DB with fallback defaults
   */
  /**
   * Synchronous accessor for fast pricing engine calculations
   */
  public static getCachedSettingsSync(): SystemSettingsDTO {
    if (this.cachedSettings) {
      return this.cachedSettings;
    }
    return {
      pilotCommissionPercentage: this.DEFAULT_PILOT_COMMISSION_PERCENTAGE,
      costPerHectare: this.DEFAULT_COST_PER_HECTARE,
      minimumDispatchFee: this.DEFAULT_MINIMUM_DISPATCH_FEE,
      operationRates: {
        FERTILIZING: this.DEFAULT_COST_PER_HECTARE,
        PRECISION_SPRAYING: Math.round(this.DEFAULT_COST_PER_HECTARE * 1.12),
        PEST_CONTROL_SPRAY: Math.round(this.DEFAULT_COST_PER_HECTARE * 1.2),
        SEED_BROADCASTING: Math.round(this.DEFAULT_COST_PER_HECTARE * 0.88),
        DRONE_MAPPING: Math.round(this.DEFAULT_COST_PER_HECTARE * 1.52),
      },
      currency: this.CURRENCY,
      updatedAt: new Date(),
    };
  }

  public static async getSettings(): Promise<SystemSettingsDTO> {
    const now = Date.now();
    if (this.cachedSettings && now - this.lastCacheTime < this.CACHE_TTL_MS) {
      return this.cachedSettings;
    }

    try {
      const dbSettings = await prisma.systemSetting.findMany();
      const settingsMap: Record<string, string> = {};
      let latestUpdated: Date | undefined;

      for (const row of dbSettings) {
        settingsMap[row.key] = row.value;
        if (!latestUpdated || row.updatedAt > latestUpdated) {
          latestUpdated = row.updatedAt;
        }
      }

      const pilotPct = settingsMap["pilot_commission_percentage"]
        ? parseFloat(settingsMap["pilot_commission_percentage"])
        : this.DEFAULT_PILOT_COMMISSION_PERCENTAGE;

      const costPerHa = settingsMap["cost_per_hectare"]
        ? parseFloat(settingsMap["cost_per_hectare"])
        : this.DEFAULT_COST_PER_HECTARE;

      const minDispatch = settingsMap["minimum_dispatch_fee"]
        ? parseFloat(settingsMap["minimum_dispatch_fee"])
        : this.DEFAULT_MINIMUM_DISPATCH_FEE;

      let opRates: any = {
        FERTILIZING: costPerHa,
        PRECISION_SPRAYING: Math.round(costPerHa * 1.12),
        PEST_CONTROL_SPRAY: Math.round(costPerHa * 1.2),
        SEED_BROADCASTING: Math.round(costPerHa * 0.88),
        DRONE_MAPPING: Math.round(costPerHa * 1.52),
      };

      if (settingsMap["operation_rates"]) {
        try {
          opRates = JSON.parse(settingsMap["operation_rates"]);
        } catch {
          // ignore parsing error
        }
      }

      const settings: SystemSettingsDTO = {
        pilotCommissionPercentage: isNaN(pilotPct) ? this.DEFAULT_PILOT_COMMISSION_PERCENTAGE : pilotPct,
        costPerHectare: isNaN(costPerHa) ? this.DEFAULT_COST_PER_HECTARE : costPerHa,
        minimumDispatchFee: isNaN(minDispatch) ? this.DEFAULT_MINIMUM_DISPATCH_FEE : minDispatch,
        operationRates: opRates,
        currency: this.CURRENCY,
        updatedAt: latestUpdated || new Date(),
      };

      this.cachedSettings = settings;
      this.lastCacheTime = now;
      return settings;
    } catch (err) {
      console.error("[SystemSettingService] Failed to load settings from DB, using defaults:", err);
      return {
        pilotCommissionPercentage: this.DEFAULT_PILOT_COMMISSION_PERCENTAGE,
        costPerHectare: this.DEFAULT_COST_PER_HECTARE,
        minimumDispatchFee: this.DEFAULT_MINIMUM_DISPATCH_FEE,
        currency: this.CURRENCY,
        updatedAt: new Date(),
      };
    }
  }

  /**
   * Helper to retrieve only current pilot commission percentage (e.g. 70)
   */
  public static async getPilotCommissionPercentage(): Promise<number> {
    const settings = await this.getSettings();
    return settings.pilotCommissionPercentage;
  }

  /**
   * Helper to retrieve base cost per hectare in LKR
   */
  public static async getCostPerHectare(): Promise<number> {
    const settings = await this.getSettings();
    return settings.costPerHectare;
  }

  /**
   * Calculates pilot earnings and platform cut dynamically
   */
  public static async calculatePilotEarnings(totalCost: number): Promise<{
    pilotEarnings: number;
    companyCommission: number;
    pilotCommissionPercentage: number;
  }> {
    const pilotPct = await this.getPilotCommissionPercentage();
    const safeCost = Math.max(0, Number(totalCost) || 0);
    const pilotEarnings = Math.round((safeCost * pilotPct) / 100);
    const companyCommission = safeCost - pilotEarnings;

    return {
      pilotEarnings,
      companyCommission,
      pilotCommissionPercentage: pilotPct,
    };
  }

  /**
   * Admin updates dynamic system settings (pilot commission % and cost per hectare)
   */
  public static async updateSettings(
    dto: UpdateSystemSettingsDTO,
    userId?: number
  ): Promise<SystemSettingsDTO> {
    if (
      dto.pilotCommissionPercentage !== undefined &&
      (dto.pilotCommissionPercentage < 0 || dto.pilotCommissionPercentage > 100)
    ) {
      throw AppError.badRequest(
        "Pilot commission percentage must be a number between 0 and 100."
      );
    }

    if (dto.costPerHectare !== undefined && dto.costPerHectare <= 0) {
      throw AppError.badRequest("Cost per hectare must be greater than 0 LKR.");
    }

    const updates: Array<{ key: string; value: string; description: string }> = [];

    if (dto.pilotCommissionPercentage !== undefined) {
      updates.push({
        key: "pilot_commission_percentage",
        value: String(dto.pilotCommissionPercentage),
        description: "Percentage of mission cost allocated to the pilot (0-100)",
      });
    }

    if (dto.costPerHectare !== undefined) {
      updates.push({
        key: "cost_per_hectare",
        value: String(dto.costPerHectare),
        description: "Standard base cost per hectare in LKR for precision fertilizer spraying",
      });
    }

    if (dto.minimumDispatchFee !== undefined) {
      updates.push({
        key: "minimum_dispatch_fee",
        value: String(dto.minimumDispatchFee),
        description: "Minimum mobilization dispatch fee in LKR",
      });
    }

    if (dto.operationRates !== undefined) {
      updates.push({
        key: "operation_rates",
        value: JSON.stringify(dto.operationRates),
        description: "Granular base rates per hectare by operation type in LKR",
      });
    }

    // Persist to database in a transaction
    await prisma.$transaction(
      updates.map((item) =>
        prisma.systemSetting.upsert({
          where: { key: item.key },
          create: {
            key: item.key,
            value: item.value,
            description: item.description,
            updatedBy: userId || null,
          },
          update: {
            value: item.value,
            description: item.description,
            updatedBy: userId || null,
          },
        })
      )
    );

    // Invalidate local cache
    this.cachedSettings = null;
    this.lastCacheTime = 0;

    logActivity({
      userId: userId || null,
      action: "SETTINGS_UPDATED",
      entityType: "SYSTEM_SETTING",
      entityId: "PRICING_CONFIG",
      details: `Admin updated dynamic pricing: Pilot cut ${dto.pilotCommissionPercentage ?? "unchanged"}%, Cost/Ha: LKR ${dto.costPerHectare ?? "unchanged"}`,
    });

    return await this.getSettings();
  }
}