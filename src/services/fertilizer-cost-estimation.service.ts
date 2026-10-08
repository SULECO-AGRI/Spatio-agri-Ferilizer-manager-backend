/**
 * ==============================================================================
 * SPATIO-AGRI PRECISION FERTILIZER MANAGEMENT SYSTEM
 * Fertilizer Cost Estimation Engine
 * File: src/services/fertilizer-cost-estimation.service.ts
 * ==============================================================================
 */

import {
  CostEstimationParams,
  CostEstimationBreakdown,
  PriorityLevel,
} from "../types/cost-estimation.types";

export class FertilizerCostEstimationService {
  /**
   * Currency used across the system
   */
  public static readonly CURRENCY = "LKR";

  /**
   * Minimum flight dispatch setup fee (covers battery cycling, drone prep & pilot mobilization)
   */
  public static readonly MINIMUM_DISPATCH_FEE = 3500;

  /**
   * Base rate (LKR / acre) by fertilizer operation type
   */
  public static readonly OPERATION_BASE_RATES: Record<string, number> = {
    FERTILIZING: 2500,
    FERTILIZER: 2500,
    PRECISION_SPRAYING: 2800,
    PEST_CONTROL_SPRAY: 3000,
    SEED_BROADCASTING: 2200,
    DEFAULT: 2500,
  };

  /**
   * Priority urgency multipliers
   */
  public static readonly PRIORITY_MULTIPLIERS: Record<PriorityLevel, number> = {
    LOW: 0.95,
    MEDIUM: 1.0,
    HIGH: 1.15,
    CRITICAL: 1.3,
  };

  /**
   * Classifies crop string into categorized complexity tier for liquid/granular spraying
   */
  public static classifyCrop(cropType: string): {
    category: string;
    multiplier: number;
  } {
    if (!cropType || typeof cropType !== "string") {
      return { category: "Standard / Default", multiplier: 1.0 };
    }

    const normalized = cropType.toLowerCase().trim();

    // 1. Paddy / Rice (Base standard flat canopy)
    if (
      normalized.includes("paddy") ||
      normalized.includes("rice") ||
      normalized.includes("bg") ||
      normalized.includes("bw") ||
      normalized.includes("samba") ||
      normalized.includes("nadu") ||
      normalized.includes("suwandel")
    ) {
      return { category: "Paddy & Grains", multiplier: 1.0 };
    }

    // 2. Field Crops & Cereals (Dense medium canopy)
    if (
      normalized.includes("maize") ||
      normalized.includes("corn") ||
      normalized.includes("sorghum") ||
      normalized.includes("millet") ||
      normalized.includes("kurakkan") ||
      normalized.includes("soya") ||
      normalized.includes("soybean") ||
      normalized.includes("mung") ||
      normalized.includes("cowpea") ||
      normalized.includes("peanut") ||
      normalized.includes("groundnut")
    ) {
      return { category: "Field Crops & Cereals", multiplier: 1.1 };
    }

    // 3. Vegetables, Legumes & Spices (Lower flight speed, precision droplet targeting)
    if (
      normalized.includes("chilli") ||
      normalized.includes("chili") ||
      normalized.includes("onion") ||
      normalized.includes("tomato") ||
      normalized.includes("potato") ||
      normalized.includes("cabbage") ||
      normalized.includes("carrot") ||
      normalized.includes("leek") ||
      normalized.includes("beet") ||
      normalized.includes("brinjal") ||
      normalized.includes("eggplant") ||
      normalized.includes("okra") ||
      normalized.includes("bean") ||
      normalized.includes("ginger") ||
      normalized.includes("turmeric") ||
      normalized.includes("vegetable")
    ) {
      return { category: "Vegetables & Spices", multiplier: 1.25 };
    }

    // 4. Commercial Plantation Crops (Slope terrain navigation, contour elevation)
    if (
      normalized.includes("tea") ||
      normalized.includes("sugarcane") ||
      normalized.includes("sugar cane") ||
      normalized.includes("cinnamon") ||
      normalized.includes("cardamom") ||
      normalized.includes("clove") ||
      normalized.includes("coffee")
    ) {
      return { category: "Plantation & Hill Crops", multiplier: 1.35 };
    }

    // 5. Tree Crops, Palms & Orchards (High flight altitude, tall crown canopy obstacle clearance)
    if (
      normalized.includes("coconut") ||
      normalized.includes("rubber") ||
      normalized.includes("palm") ||
      normalized.includes("mango") ||
      normalized.includes("banana") ||
      normalized.includes("papaya") ||
      normalized.includes("guava") ||
      normalized.includes("avocado") ||
      normalized.includes("dragon fruit") ||
      normalized.includes("durian") ||
      normalized.includes("fruit") ||
      normalized.includes("orchard")
    ) {
      return { category: "Tree Canopy & Orchards", multiplier: 1.5 };
    }

    // Default fallback
    return { category: "General Agriculture", multiplier: 1.0 };
  }

  /**
   * Calculates volume discount based on total area in acres for fertilizer spraying
   */
  public static getAreaDiscountPercent(areaAcres: number): number {
    if (areaAcres > 10.0) return 15; // 15% discount for large commercial plots (> 10 acres)
    if (areaAcres > 5.0) return 10;  // 10% discount for medium plots (5 - 10 acres)
    if (areaAcres > 2.0) return 5;   // 5% discount (2 - 5 acres)
    return 0; // Standard rate for <= 2 acres
  }

  /**
   * Main Cost Calculation for Fertilizer & Chemical Spraying Operations
   *
   * @param params Parameters including field area (acres), crop type, service type and priority
   * @returns Detailed CostEstimationBreakdown
   */
  public static calculateEstimatedCost(
    params: CostEstimationParams
  ): CostEstimationBreakdown {
    const rawArea = Number(params.area);
    const area = isNaN(rawArea) || rawArea <= 0 ? 1.0 : Number(rawArea.toFixed(2));
    const cropType = params.cropType || "Paddy";
    const serviceTypeKey = (params.serviceType || "FERTILIZING").toUpperCase().replace(/\s+/g, "_");
    const priority: PriorityLevel = (params.priority || "MEDIUM").toUpperCase() as PriorityLevel;

    // 1. Determine Base Rate per acre
    const baseRatePerAcre =
      this.OPERATION_BASE_RATES[serviceTypeKey] ||
      this.OPERATION_BASE_RATES.DEFAULT;

    // 2. Determine Crop Multiplier
    const { category: cropCategory, multiplier: cropMultiplier } =
      this.classifyCrop(cropType);

    // 3. Determine Area Volume Discount
    const areaDiscountPercent = this.getAreaDiscountPercent(area);
    const discountMultiplier = 1 - areaDiscountPercent / 100;

    // 4. Determine Priority Surge Multiplier
    const priorityMultiplier =
      this.PRIORITY_MULTIPLIERS[priority] || this.PRIORITY_MULTIPLIERS.MEDIUM;

    // 5. Calculate Raw Cost
    const standardCostBeforeDiscount = area * baseRatePerAcre * cropMultiplier;
    const discountedCost = standardCostBeforeDiscount * discountMultiplier;
    const areaDiscountAmount = Number(
      (standardCostBeforeDiscount - discountedCost).toFixed(2)
    );

    const calculatedWithPriority = discountedCost * priorityMultiplier;
    const rawCalculatedCost = Number(calculatedWithPriority.toFixed(2));

    // 6. Apply Minimum Dispatch Fee Guard
    const isMinimumFeeApplied = rawCalculatedCost < this.MINIMUM_DISPATCH_FEE;
    const finalCostValue = isMinimumFeeApplied
      ? this.MINIMUM_DISPATCH_FEE
      : rawCalculatedCost;

    // Round to nearest 10 LKR for clean invoice pricing
    const totalEstimatedCost = Math.round(finalCostValue / 10) * 10;

    // 7. Compose Human-Readable Breakdown Summary
    const breakdownSummary = isMinimumFeeApplied
      ? `Base calculation ${this.CURRENCY} ${rawCalculatedCost.toLocaleString()} below minimum threshold. Minimum flight dispatch fee of ${this.CURRENCY} ${this.MINIMUM_DISPATCH_FEE.toLocaleString()} applied.`
      : `${area} acre(s) of ${cropType} (${cropCategory}) @ ${this.CURRENCY} ${baseRatePerAcre.toLocaleString()}/acre [Crop Factor: ${cropMultiplier}x, Discount: ${areaDiscountPercent}%, Priority: ${priority}] = ${this.CURRENCY} ${totalEstimatedCost.toLocaleString()}`;

    return {
      area,
      cropType,
      cropCategory,
      serviceType: "FERTILIZING",
      priority,
      baseRatePerAcre,
      cropMultiplier,
      areaDiscountPercent,
      areaDiscountAmount,
      priorityMultiplier,
      minimumFee: this.MINIMUM_DISPATCH_FEE,
      isMinimumFeeApplied,
      rawCalculatedCost,
      totalEstimatedCost,
      currency: this.CURRENCY,
      breakdownSummary,
      details: {
        operationType: "FERTILIZER_APPLICATION",
        method: "PRECISION_DRONE_SPRAYING",
        areaAcres: area,
        baseRatePerAcre,
      },
    };
  }
}

export default FertilizerCostEstimationService;
