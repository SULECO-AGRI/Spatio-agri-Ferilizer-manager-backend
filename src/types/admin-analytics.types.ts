import { PaginationMeta } from "./farmer.types";

export interface CompletedMissionsAnalyticsDTO {
  totalCompletedMissions: number;
  completedToday: number;
  completedThisMonth: number;
  completedLastMonth: number;
  monthOverMonthGrowthPercentage: number;
  completionRatePercentage: number;
}

export interface RevenueAnalyticsDTO {
  totalRevenue: number;
  companyCommission: number;
  pilotEarnings: number;
  revenueThisMonth: number;
  revenueLastMonth: number;
  monthOverMonthGrowthPercentage: number;
  averageRevenuePerMission: number;
  currency: string;
}

export interface PilotFleetPerformanceDTO {
  fleetAverageRating: number;
  totalFleetFlightHours: number;
  totalCompletedMissions: number;
  totalPilots: number;
  activePilots: number;
  onMissionPilots: number;
  inactivePilots: number;
  topPerformingPilot: {
    userId: number;
    fullName: string;
    ratings: number | null;
    completedMissions: number;
  } | null;
}

export interface FarmerGrowthAnalyticsDTO {
  totalFarmers: number;
  newFarmersThisMonth: number;
  newFarmersLastMonth: number;
  growthPercentage: number;
  activeFarmersWithFields: number;
  totalFieldsRegistered: number;
}

export interface PilotPerformanceTableQueryDTO {
  page?: number;
  limit?: number;
  search?: string;
  status?: "ACTIVE" | "INACTIVE" | "ON_MISSION" | "SUSPENDED";
  sortBy?: "pilotName" | "completedMissions" | "ratings" | "totalFlightHours" | "totalEarnings" | "createdAt";
  sortOrder?: "asc" | "desc";
}

export interface PilotPerformanceTableRowDTO {
  pilotId: number;
  pilotName: string;
  email: string;
  mobile: string;
  licenceNumber: string;
  status: string;
  missions: {
    completedMissions: number;
    activeMissions: number;
    scheduledMissions: number;
    totalAssigned: number;
  };
  averageRatings: number | null;
  flightHours: number;
  totalEarnings: number;
  createdAt: Date;
}

export interface PaginatedPilotPerformanceTableResponseDTO {
  pilots: PilotPerformanceTableRowDTO[];
  pagination: PaginationMeta;
}
