import { PaginationMeta, PaginatedResult } from "./common.types";
export { PaginationMeta, PaginatedResult };



export interface FarmerQueryDTO {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: "createdAt" | "name" | "email" | "memberSince";
  sortOrder?: "asc" | "desc";
}

export interface FarmerListItemDTO {
  userId: number;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  mobile: string;
  nic: string | null;
  address: string | null;
  memberSince: Date | null;
  totalFields: number;
  totalArea: number;
  totalServiceRequests: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface FarmerStatsDTO {
  totalFields: number;
  totalAreaAcres: number;
  totalServiceRequests: number;
  completedRequests: number;
  pendingRequests: number;
  totalSpent: number;
  averageRatingGiven: number | null;
}

export interface FarmerProfileDetailDTO {
  userId: number;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  mobile: string;
  nic: string | null;
  address: string | null;
  memberSince: Date | null;
  role: string;
  stats: FarmerStatsDTO;
  createdAt: Date;
  updatedAt: Date;
}

export interface FarmerFieldDTO {
  id: number;
  farmerId: number;
  fieldName: string;
  cropType: string;
  locationCoordinates: any;
  area: number;
  province: string;
  district: string;
  city: string;
  village: string;
  totalRequests: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateFieldDTO {
  fieldName: string;
  cropType: string;
  area: number;
  locationCoordinates: number[][];
  province: string;
  district: string;
  city: string;
  village: string;
}

export interface FarmerFieldsQueryDTO {
  cropType?: string;
  district?: string;
  province?: string;
}

export interface FarmerServiceHistoryQueryDTO {
  page?: number;
  limit?: number;
  status?: string;
  priority?: string;
  serviceType?: string;
  fieldId?: number;
}

export interface ServiceMissionDTO {
  missionId: number;
  status: string;
  startedAt: Date | null;
  completedAt: Date | null;
  areaSpread: number | null;
  pilotNotes: string | null;
  pilot: {
    userId: number;
    name: string;
    mobile: string;
    licenceNumber: string;
  } | null;
  payment: {
    paymentId: number;
    totalAmount: number;
    paymentStatus: string;
    paymentMethod: string;
    paidAt: Date | null;
  } | null;
  review: {
    reviewId: number;
    rating: number;
    comment: string | null;
    createdAt: Date;
  } | null;
}

export interface FarmerServiceRequestDTO {
  requestId: number;
  requestCode: string;
  fieldId: number;
  fieldName: string;
  cropType: string;
  fieldLocation: {
    district: string;
    province: string;
    city: string;
    village: string;
  };
  serviceType: string;
  preferredDate: Date;
  priority: string;
  status: string;
  estimatedCost: number;
  createdAt: Date;
  updatedAt: Date;
  missions: ServiceMissionDTO[];
}

export interface FarmerPaymentQueryDTO {
  page?: number;
  limit?: number;
  paymentStatus?: string;
  paymentMethod?: string;
}

export interface FarmerPaymentItemDTO {
  paymentId: number;
  transactionReference: string | null;
  totalAmount: number;
  paymentMethod: string;
  paymentStatus: string;
  paidAt: Date | null;
  createdAt: Date;
  serviceRequest: {
    requestId: number;
    requestCode: string;
    serviceType: string;
    preferredDate: Date;
  };
  field: {
    fieldId: number;
    fieldName: string;
    cropType: string;
    district: string;
  };
  mission: {
    missionId: number;
    status: string;
    pilot: {
      userId: number;
      name: string;
    } | null;
  };
}

export interface FarmerPaymentSummaryDTO {
  totalPaid: number;
  totalPending: number;
  totalTransactions: number;
}

export interface FarmerPaymentsResponseDTO {
  payments: FarmerPaymentItemDTO[];
  summary: FarmerPaymentSummaryDTO;
  pagination: PaginationMeta;
}
