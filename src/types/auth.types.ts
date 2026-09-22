export interface RegisterFarmerDTO {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  mobile: string;
  nic?: string;
  address?: string;
}

export interface RegisterPilotDTO {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  mobile: string;
  licenceNumber?: string;
  serviceArea?: any;
  service_area?: any;
  coverageArea?: any;
  locationCoordinates?: any;
  location_coordinates?: any;
  totalFlightHours?: number;
}

export interface LoginDTO {
  email: string;
  password: string;
}

export interface JwtPayload {
  userId: number;
  email: string;
  role: string;
}

export interface FarmerProfileData {
  userId: number;
  nic: string | null;
  address: string | null;
  memberSince: Date;
}

export interface PilotProfileData {
  userId: number;
  licenceNumber: string | null;
  serviceArea?: any;
  status: string;
  ratings: any;
  completedMissions: number;
  totalFlightHours: any;
}

export interface AdminProfileData {
  userId: number;
  department: string | null;
  accessLevel: string | null;
  createdAt: Date;
}

export type ProfileData =
  | FarmerProfileData
  | PilotProfileData
  | AdminProfileData
  | null;

export interface AuthUserResponse {
  userId: number;
  email: string;
  firstName: string;
  lastName: string;
  mobile: string;
  role: string;
  profile: ProfileData;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthResponse {
  user: AuthUserResponse;
  token: string;
}
