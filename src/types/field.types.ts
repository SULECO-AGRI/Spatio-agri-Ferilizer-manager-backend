import { PaginationMeta } from "./farmer.types";

export interface FieldQueryDTO {
  page?: number;
  limit?: number;
  search?: string;
  cropType?: string;
  district?: string;
  province?: string;
  farmerId?: number;
  sortBy?: "fieldName" | "area" | "createdAt" | "cropType";
  sortOrder?: "asc" | "desc";
}

export interface FieldOwnerDTO {
  userId: number;
  fullName: string;
  email: string;
  mobile: string;
  nic: string | null;
  address: string | null;
}

export interface FieldDetailDTO {
  id: number;
  farmerId: number;
  fieldName: string;
  cropType: string;
  locationCoordinates: number[][];
  area: number;
  province: string;
  district: string;
  city: string;
  village: string;
  totalServiceRequests: number;
  activeRequests: number;
  completedRequests: number;
  owner: FieldOwnerDTO;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateFieldInputDTO {
  farmerId?: number; // Optional if Farmer creates for self; required or derived
  fieldName: string;
  cropType: string;
  area: number;
  locationCoordinates: number[][];
  province: string;
  district: string;
  city: string;
  village: string;
}

export interface UpdateFieldInputDTO {
  fieldName?: string;
  cropType?: string;
  area?: number;
  locationCoordinates?: number[][];
  province?: string;
  district?: string;
  city?: string;
  village?: string;
}

export interface PaginatedFieldsResponseDTO {
  fields: FieldDetailDTO[];
  pagination: PaginationMeta;
}
