import { PaginationMeta } from "./common.types";

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
  id: number;
  userId: number;
  fullName: string;
  email: string;
  mobile: string;
  nic?: string | null;
  address?: string | null;
}

export interface FieldDetailDTO {
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
  totalServiceRequests: number;
  activeRequests: number;
  completedRequests: number;
  owner: FieldOwnerDTO;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateFieldInputDTO {
  farmer_id?: number;
  farmerId?: number;
  field_name?: string;
  fieldName?: string;
  crop_type?: string;
  cropType?: string;
  area: number;
  location_coordinates?: any;
  locationCoordinates?: any;
  province: string;
  district: string;
  city: string;
  village: string;
}

export interface UpdateFieldInputDTO {
  field_name?: string;
  fieldName?: string;
  crop_type?: string;
  cropType?: string;
  area?: number;
  location_coordinates?: any;
  locationCoordinates?: any;
  province?: string;
  district?: string;
  city?: string;
  village?: string;
}

export interface PaginatedFieldsResponseDTO {
  fields: FieldDetailDTO[];
  pagination: PaginationMeta;
}

