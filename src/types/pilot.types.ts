import { PaginationMeta } from "./common.types";
import { CostEstimationBreakdown } from "./cost-estimation.types";

export interface PilotQueryDTO {
  page?: number;
  limit?: number;
  search?: string;
  status?: "ACTIVE" | "INACTIVE" | "ON_MISSION" | "SUSPENDED";
  sortBy?: "createdAt" | "name" | "ratings" | "completedMissions" | "totalFlightHours";
  sortOrder?: "asc" | "desc";
}

export interface PilotListItemDTO {
  userId: number;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  mobile: string;
  licenceNumber: string | null;
  serviceArea?: any;
  status: string;
  ratings: number | null;
  completedMissions: number;
  totalFlightHours: number;
  activeMissionsCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PilotStatsDTO {
  ratings: number | null;
  completedMissions: number;
  totalFlightHours: number;
  scheduledMissions: number;
  inProgressMissions: number;
  failedMissions: number;
  totalEarnings: number;
  pendingPayouts: number;
  totalReviews: number;
}

export interface PilotProfileDetailDTO {
  userId: number;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  mobile: string;
  licenceNumber: string | null;
  serviceArea?: any;
  status: string;
  role: string;
  stats: PilotStatsDTO;
  createdAt: Date;
  updatedAt: Date;
}

export interface PilotMissionQueryDTO {
  page?: number;
  limit?: number;
  status?: "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
  startDate?: string;
  endDate?: string;
}

export interface PilotMissionItemDTO {
  missionId: number;
  requestId: number;
  requestCode: string;
  serviceType: string;
  preferredDate: Date;
  priority: string;
  status: string;
  estimatedCost: number;
  startedAt: Date | null;
  completedAt: Date | null;
  areaSpread: number | null;
  pilotNotes: string | null;
  flightDurationHours?: number | null;
  field: {
    id: number;
    fieldName: string;
    cropType: string;
    area: number;
    locationCoordinates: any;
    district: string;
    province: string;
    city: string;
    village: string;
  };
  farmer: {
    userId: number;
    fullName: string;
    mobile: string;
    address: string | null;
  };
  payment: {
    paymentId: number;
    totalAmount: number;
    pilotEarnings: number;
    companyCommission?: number;
    pilotCommissionPercentage?: number;
    paymentStatus: string;
    paymentMethod: string;
    payoutStatus: string;
  } | null;
  costBreakdown?: CostEstimationBreakdown | null;
  pilotCommissionPercentage?: number;
  review: {
    reviewId: number;
    rating: number;
    comment: string | null;
    createdAt: Date;
  } | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CompleteMissionDTO {
  areaSpread: number;
  flightDurationHours: number;
  pilotNotes?: string;
}

export interface PilotPayoutQueryDTO {
  page?: number;
  limit?: number;
  status?: "PENDING" | "PROCESSING" | "SETTLED" | "FAILED";
}

export interface PilotPayoutItemDTO {
  payoutId: number;
  pilotId: number;
  periodStart: Date;
  periodEnd: Date;
  amount: number;
  bankName: string;
  bankAccountNo: string;
  transactionRef: string | null;
  status: string;
  settledAt: Date | null;
  createdAt: Date;
  requestCode?: string;
  missionId?: number;
  totalFarmerPayment?: number;
  companyCommission?: number;
  pilotCommissionPercentage?: number;
  serviceType?: string;
}

export interface PilotReviewQueryDTO {
  page?: number;
  limit?: number;
  minRating?: number;
  maxRating?: number;
}

export interface PilotReviewItemDTO {
  reviewId: number;
  missionId: number;
  rating: number;
  comment: string | null;
  createdAt: Date;
  farmer: {
    userId: number;
    fullName: string;
  };
  mission: {
    requestCode: string;
    completedAt: Date | null;
  };
}

export interface PilotPayoutsResponseDTO {
  payouts: PilotPayoutItemDTO[];
  summary: {
    totalSettled: number;
    totalPending: number;
    totalProcessing: number;
    completedFlights: number;
    pilotCommissionPercentage?: number;
  };
  pagination: PaginationMeta;
}

export interface RespondMissionDTO {
  action: "ACCEPT" | "REJECT";
  rejectionReason?: string;
}

export interface RespondMissionResponseDTO {
  missionId: number;
  requestId: number;
  action: "ACCEPT" | "REJECT";
  missionStatus: string;
  requestStatus: string;
  message: string;
  respondedAt: Date;
}

