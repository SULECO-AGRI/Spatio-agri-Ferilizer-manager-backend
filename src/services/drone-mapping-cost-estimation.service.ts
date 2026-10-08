/**
 * ==============================================================================
 * SPATIO-AGRI PRECISION FERTILIZER MANAGEMENT SYSTEM
 * Drone Mapping Cost Estimation Engine
 * File: src/services/drone-mapping-cost-estimation.service.ts
 * ==============================================================================
 */

import {
  CostEstimationParams,
  CostEstimationBreakdown,
  PriorityLevel,
} from "../types/cost-estimation.types";

export class DroneMappingCostEstimationService {
  /**
   * Currency used across the system
   */
  public static readonly CURRENCY = "LKR";

  /**
   * Minimum survey setup & processing fee (covers RTK calibration, GCP placement, and cloud photogrammetry processing)
   */
  public static readonly MINIMUM_DISPATCH_FEE = 4500;

  /**
   * Base rate (LKR / acre) by Drone Mapping sensor & survey tier
   */
  public static readonly MAPPING_BASE_RATES: Record<string, number> = {
    DRONE_MAPPING: 3800,
    MAPPING: 3800,
    MULTISPECTRAL: 3800,
    NDVI: 3800,
    RGB_SURVEY: 3000,
    ORTHOMOSAIC: 3000,
    THERMAL_MAPPING: 4200,
    ELEVATION_CONTOUR: 3500,
    DEFAULT: 3800,
  };

  /**
   * Priority urgency multipliers for mapping deliverables
   */
  public static readonly PRIORITY_MULTIPLIERS: Record<PriorityLevel, number> = {
    LOW: 0.95,
    MEDIUM: 1.0,
    HIGH: 1.15,
    CRITICAL: 1.3,
  };

  /**
   * Classifies terrain & canopy characteristics for aerial photogrammetry survey complexity
   */
  public static classifyTerrainAndCanopy(cropType: string): {
    category: string;
    multiplier: number;
    description: string;
  } {
    if (!cropType || typeof cropType !== "string") {
      return {
        category: "Standard Flat Field",
        multiplier: 1.0,
        description: "Uniform flat surface, standard 75% image overlap",
      };
    }

    const normalized = cropType.toLowerCase().trim();

    // 1. Flat Open Fields (Paddy & Low-lying Grains)
    if (
      normalized.includes("paddy") ||
      normalized.includes("rice") ||
      normalized.includes("bg") ||
      normalized.includes("bw") ||
      normalized.includes("samba") ||
      normalized.includes("nadu") ||
      normalized.includes("suwandel")
    ) {
      return {
        category: "Flat Open Field (Paddy / Grains)",
        multiplier: 1.0,
        description: "Optimal line-of-sight & uniform ground sampling distance (GSD)",
      };
    }

    // 2. Dense Cereals & Field Crops
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
      return {
        category: "Field Crops & Cereals",
        multiplier: 1.1,
        description: "Dense canopy surface, standard photogrammetry reconstruction",
      };
    }

    // 3. Row Crops & Intensive Vegetables (High-resolution inspection)
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
      return {
        category: "Row Crops & Vegetables",
        multiplier: 1.2,
        description: "Requires high-density cross-grid flight pattern (80%+ overlap)",
      };
    }

    // 4. Commercial Plantation & Sloped Terrains (Slope tracking radar)
    if (
      normalized.includes("tea") ||
      normalized.includes("sugarcane") ||
      normalized.includes("sugar cane") ||
      normalized.includes("cinnamon") ||
      normalized.includes("cardamom") ||
      normalized.includes("clove") ||
      normalized.includes("coffee")
    ) {
      return {
        category: "Plantation & Hill Terrain",
        multiplier: 1.35,
        description: "Requires terrain-following radar elevation contour survey",
      };
    }

    // 5. Tall Canopy, Palms & Fruit Orchards (Obstacle clearance, oblique angles)
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
      return {
        category: "Tree Canopy & Orchards",
        multiplier: 1.5,
        description: "High altitude flight with multi-angle oblique photogrammetry",
      };
    }

    return {
      category: "General Agriculture",
      multiplier: 1.0,
      description: "Standard aerial mapping survey flight plan",
    };
  }

  /**
   * Calculates volume discount for contiguous drone mapping survey missions
   */
  public static getAreaDiscountPercent(areaAcres: number): number {
    if (areaAcres > 20.0) return 20; // 20% discount for large estate mapping (> 20 acres)
    if (areaAcres > 10.0) return 15; // 15% discount (> 10 acres)
    if (areaAcres > 5.0) return 10;  // 10% discount (5 - 10 acres)
    if (areaAcres > 2.0) return 5;   // 5% discount (2 - 5 acres)
    return 0; // Standard rate for <= 2 acres
  }

  /**
   * Main Cost Calculation Engine for Drone Mapping & Agricultural Remote Sensing
   *
   * @param params Parameters including field area (acres), crop type, and priority
   * @returns Detailed CostEstimationBreakdown
   */
  public static calculateEstimatedCost(
    params: CostEstimationParams
  ): CostEstimationBreakdown {
    const rawArea = Number(params.area);
    const area = isNaN(rawArea) || rawArea <= 0 ? 1.0 : Number(rawArea.toFixed(2));
    const cropType = params.cropType || "Paddy";
    const mappingKey = (params.mappingType || params.serviceType || "DRONE_MAPPING")
      .toUpperCase()
      .replace(/\s+/g, "_");
    const priority: PriorityLevel = (params.priority || "MEDIUM").toUpperCase() as PriorityLevel;

    // 1. Determine Base Rate per acre for drone mapping
    const baseRatePerAcre =
      this.MAPPING_BASE_RATES[mappingKey] ||
      this.MAPPING_BASE_RATES.DEFAULT;

    // 2. Determine Terrain & Canopy Complexity Factor
    const { category: cropCategory, multiplier: cropMultiplier, description: terrainDesc } =
      this.classifyTerrainAndCanopy(cropType);

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

    // 6. Apply Minimum Dispatch & Photogrammetry Processing Fee
    const isMinimumFeeApplied = rawCalculatedCost < this.MINIMUM_DISPATCH_FEE;
    const finalCostValue = isMinimumFeeApplied
      ? this.MINIMUM_DISPATCH_FEE
      : rawCalculatedCost;

    // Round to nearest 10 LKR for clean invoicing
    const totalEstimatedCost = Math.round(finalCostValue / 10) * 10;

    // 7. Compose Human-Readable Breakdown Summary
    const breakdownSummary = isMinimumFeeApplied
      ? `Base calculation ${this.CURRENCY} ${rawCalculatedCost.toLocaleString()} below minimum threshold. Minimum drone survey & processing fee of ${this.CURRENCY} ${this.MINIMUM_DISPATCH_FEE.toLocaleString()} applied.`
      : `${area} acre(s) Drone Mapping for ${cropType} (${cropCategory}) @ ${this.CURRENCY} ${baseRatePerAcre.toLocaleString()}/acre [Sensor: Multispectral NDVI, Terrain Factor: ${cropMultiplier}x, Discount: ${areaDiscountPercent}%, Priority: ${priority}] = ${this.CURRENCY} ${totalEstimatedCost.toLocaleString()}`;

    return {
      area,
      cropType,
      cropCategory,
      serviceType: "DRONE_MAPPING",
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
        operationType: "DRONE_AERIAL_MAPPING",
        sensorType: "MULTISPECTRAL_5_BAND",
        deliverables: [
          "High-Resolution Orthomosaic (GeoTIFF)",
          "NDVI / NDRE Crop Health & Vigor Map",
          "Digital Surface Elevation Model (DSM)",
          "Zoned Variable-Rate Prescription Map",
        ],
        terrainDescription: terrainDesc,
        areaAcres: area,
        baseRatePerAcre,
      },
    };
  }
}

export default DroneMappingCostEstimationService;
