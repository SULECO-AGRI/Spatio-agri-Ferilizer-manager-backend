/**
 * ==============================================================================
 * SPATIO-AGRI PRECISION FERTILIZER MANAGEMENT SYSTEM
 * Types: Cost Estimation Engine
 * File: src/types/cost-estimation.types.ts
 * ==============================================================================
 */

export type PriorityLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface CostEstimationParams {
  area: number; // in acres
  cropType: string;
  serviceType?: string; // FERTILIZING, DRONE_MAPPING, etc.
  mappingType?: string; // RGB_SURVEY, MULTISPECTRAL, etc.
  priority?: PriorityLevel;
}

export interface CostEstimationBreakdown {
  area: number;
  cropType: string;
  cropCategory: string;
  serviceType: string;
  priority: PriorityLevel;
  baseRatePerAcre: number;
  cropMultiplier: number;
  areaDiscountPercent: number;
  areaDiscountAmount: number;
  priorityMultiplier: number;
  minimumFee: number;
  isMinimumFeeApplied: boolean;
  rawCalculatedCost: number;
  totalEstimatedCost: number;
  currency: string;
  breakdownSummary: string;
  details?: Record<string, any>;
}

export interface EstimateCostQueryParams {
  fieldId?: number;
  area?: number;
  cropType?: string;
  serviceType?: string;
  priority?: PriorityLevel;
}
