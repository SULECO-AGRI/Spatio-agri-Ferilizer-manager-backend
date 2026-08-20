export interface DashboardMetricsDTO {
  pendingRequests: number;
  activeMissions: number;
  availablePilots: number;
  todayRevenue: {
    totalAmount: number;
    companyCommission: number;
    pilotEarnings: number;
    currency: string;
  };
  missionSuccessRate90Days: {
    ratePercentage: number;
    totalMissions: number;
    completed: number;
    failed: number;
    periodDays: number;
  };
}

export interface RecentActivityItemDTO {
  id: string | number;
  action: string;
  title: string;
  description: string;
  timestamp: Date;
  entityType?: string;
  entityId?: string | number | null;
  actor: {
    userId?: number | null;
    name: string;
    role: string;
  };
}

export interface TodayScheduleItemDTO {
  requestId: number;
  requestCode: string;
  missionId: number | null;
  serviceType: string;
  priority: string;
  status: string;
  preferredDate: Date;
  farmer: {
    userId: number;
    fullName: string;
    mobile: string;
    village: string;
    district: string;
  };
  field: {
    id: number;
    fieldName: string;
    cropType: string;
    area: number;
    locationCoordinates: any;
  };
  pilot: {
    userId: number;
    fullName: string;
    mobile: string;
    licenceNumber: string;
    status: string;
  } | null;
}

export interface AdminDashboardOverviewDTO {
  metrics: DashboardMetricsDTO;
  recentActivities: RecentActivityItemDTO[];
  todaySchedule: TodayScheduleItemDTO[];
}
