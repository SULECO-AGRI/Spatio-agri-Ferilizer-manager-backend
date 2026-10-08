/**
 * ==============================================================================
 * SPATIO-AGRI PRECISION FERTILIZER MANAGEMENT SYSTEM
 * Dynamic Cost Estimation Engine (Router / Orchestrator)
 * File: src/services/cost-estimation.service.ts
 * ==============================================================================
 */

import {
  CostEstimationParams,
  CostEstimationBreakdown,
  PriorityLevel,
} from "../types/cost-estimation.types";
import { FertilizerCostEstimationService } from "./fertilizer-cost-estimation.service";
import { DroneMappingCostEstimationService } from "./drone-mapping-cost-estimation.service";

export class CostEstimationService {
  /**
   * Currency used across the system
   */
  public static readonly CURRENCY = "LKR";

  /**
   * References to individual specialized estimators for direct access
   */
  public static readonly fertilizer = FertilizerCostEstimationService;
  public static readonly droneMapping = DroneMappingCostEstimationService;

  /**
   * Determines if the given serviceType corresponds to Drone Mapping
   */
  public static isDroneMapping(serviceType?: string): boolean {
    if (!serviceType) return false;
    const normalized = serviceType.toUpperCase().replace(/[\s\-_]+/g, "");
    return normalized.includes("MAPPING") || normalized.includes("MAP");
  }

  /**
   * Main Cost Calculation Router
   * Dynamically delegates to either Fertilizer or Drone Mapping cost estimation engines
   *
   * @param params Parameters including field area (acres), crop type, service type and priority
   * @returns Detailed CostEstimationBreakdown
   */
  public static calculateEstimatedCost(
    params: CostEstimationParams
  ): CostEstimationBreakdown {
    if (this.isDroneMapping(params.serviceType)) {
      return DroneMappingCostEstimationService.calculateEstimatedCost(params);
    }

    return FertilizerCostEstimationService.calculateEstimatedCost(params);
  }

  /**
   * Backward compatibility proxy for crop classification
   */
  public static classifyCrop(cropType: string) {
    return FertilizerCostEstimationService.classifyCrop(cropType);
  }

  /**
   * Backward compatibility proxy for area discount
   */
  public static getAreaDiscountPercent(areaAcres: number) {
    return FertilizerCostEstimationService.getAreaDiscountPercent(areaAcres);
  }
}

export default CostEstimationService;
