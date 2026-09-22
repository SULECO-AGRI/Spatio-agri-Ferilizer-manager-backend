import { PaginationMeta } from "./common.types";
import { PageInfo } from "../utils/pagination";

export interface CreateServiceRequestDTO {
  fieldId: number;
  serviceType: "FERTILIZING";
  preferredDate: string; // YYYY-MM-DD
  priority?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  estimatedCost?: number;
}

export interface ServiceRequestStatusCountsDTO {
  pending: number;
  assigned: number;
  inProgress: number;
  completed: number;
  cancelled: number;
  rejected: number;
  total: number;
}

export interface ServiceRequestQueryDTO {
  page?: number;
  limit?: number;
  cursor?: string;
  take?: number;
  direction?: "forward" | "backward";
  search?: string;
  status?: "PENDING" | "ASSIGNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "REJECTED";
  priority?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  serviceType?: "FERTILIZING";
  fieldId?: number;
  farmerId?: number;
  startDate?: string;
  endDate?: string;
  sortBy?: "createdAt" | "preferredDate" | "priority" | "status" | "estimatedCost";
  sortOrder?: "asc" | "desc";
}

export interface AssignPilotDTO {
  pilotId: number;
  pilotNotes?: string;
}

export interface UpdateServiceRequestStatusDTO {
  status: "PENDING" | "ASSIGNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "REJECTED";
}

export interface ServiceRequestListItemDTO {
  requestId: number;
  requestCode: string;
  serviceType: string;
  preferredDate: Date;
  priority: string;
  status: string;
  estimatedCost: number;
  farmer: {
    userId: number;
    fullName: string;
    email: string;
    mobile: string;
    nic: string | null;
    address: string | null;
  };
  field: {
    id: number;
    fieldName: string;
    cropType: string;
    area: number;
    district: string;
    province: string;
    city: string;
    village: string;
  };
  assignedPilot: {
    userId: number;
    fullName: string;
    mobile: string;
    licenceNumber: string | null;
    status: string;
  } | null;
  mission: {
    missionId: number;
    status: string;
    startedAt: Date | null;
    completedAt: Date | null;
  } | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ServiceRequestDetailDTO {
  requestId: number;
  requestCode: string;
  serviceType: string;
  preferredDate: Date;
  priority: string;
  status: string;
  estimatedCost: number;
  farmer: {
    userId: number;
    fullName: string;
    email: string;
    mobile: string;
    nic: string | null;
    address: string | null;
    memberSince: Date | null;
  };
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
    createdAt: Date;
  };
  missions: {
    missionId: number;
    status: string;
    startedAt: Date | null;
    completedAt: Date | null;
    areaSpread: number | null;
    pilotNotes: string | null;
    assignedBy: {
      userId: number;
      fullName: string;
      email: string;
    } | null;
    pilot: {
      userId: number;
      fullName: string;
      mobile: string;
      licenceNumber: string | null;
      status: string;
      ratings: number | null;
    } | null;
    payment: {
      paymentId: number;
      totalAmount: number;
      companyCommission: number;
      pilotEarnings: number;
      paymentStatus: string;
      paymentMethod: string;
      payoutStatus: string;
      paidAt: Date | null;
    } | null;
    review: {
      reviewId: number;
      rating: number;
      comment: string | null;
      createdAt: Date;
    } | null;
    createdAt: Date;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginatedServiceRequestsResponseDTO {
  requests: ServiceRequestListItemDTO[];
  summary: {
    totalPending: number;
    totalAssigned: number;
    totalInProgress: number;
    totalCompleted: number;
    totalCancelled: number;
  };
  pagination: PaginationMeta;
}

export interface CursorPaginatedServiceRequestsResponseDTO {
  requests: ServiceRequestListItemDTO[];
  summary: {
    totalPending: number;
    totalAssigned: number;
    totalInProgress: number;
    totalCompleted: number;
    totalCancelled: number;
  };
  pageInfo: PageInfo;
}

export interface CandidatePilotDTO {
  pilotId: number;
  fullName: string;
  email: string;
  mobile: string;
  licenceNumber: string | null;
  serviceArea?: any;
  status: string;
  rating: number;
  distanceKm: number;
  completedMissions: number;
  totalFlightHours: number;
  matchScore: number;
  scoreBreakdown: {
    distanceScore: number;
    ratingScore: number;
    experienceScore: number;
  };
}

export interface CandidatePilotsResponseDTO {
  requestId: number;
  requestCode: string;
  preferredDate: Date;
  field: {
    id: number;
    fieldName: string;
    cropType: string;
    area: number;
    district: string;
    province: string;
    city: string;
    coordinates: {
      lat: number;
      lng: number;
    };
  };
  totalCandidates: number;
  candidates: CandidatePilotDTO[];
}

