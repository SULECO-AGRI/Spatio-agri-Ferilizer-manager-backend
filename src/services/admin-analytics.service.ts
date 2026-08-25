import prisma from "../config/prisma";
import {
  CompletedMissionsAnalyticsDTO,
  RevenueAnalyticsDTO,
  PilotFleetPerformanceDTO,
  FarmerGrowthAnalyticsDTO,
  PilotPerformanceTableQueryDTO,
  PilotPerformanceTableRowDTO,
  PaginatedPilotPerformanceTableResponseDTO,
} from "../types/admin-analytics.types";
import { PaginationMeta } from "../types/farmer.types";
import { getPaginationOffsets, buildPaginationMeta } from "../utils/pagination";
import {
  MissionStatus,
  PilotStatus,
  PaymentStatus,
} from "../generated/prisma/enums";

export class AdminAnalyticsService {
  /**
   * Helper: Date Boundaries for Today, This Month, and Last Month
   */
  private static getDateRanges() {
    const now = new Date();

    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);

    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    return {
      startOfToday,
      startOfThisMonth,
      startOfLastMonth,
      endOfLastMonth,
    };
  }

  /**
   * 1. GET COMPLETED MISSIONS ANALYTICS
   */
  public static async getCompletedMissionsAnalytics(): Promise<CompletedMissionsAnalyticsDTO> {
    const { startOfToday, startOfThisMonth, startOfLastMonth, endOfLastMonth } =
      this.getDateRanges();

    const [
      totalCompletedMissions,
      totalAllMissions,
      completedToday,
      completedThisMonth,
      completedLastMonth,
    ] = await Promise.all([
      prisma.mission.count({ where: { status: MissionStatus.COMPLETED } }),
      prisma.mission.count(),
      prisma.mission.count({
        where: {
          status: MissionStatus.COMPLETED,
          completedAt: { gte: startOfToday },
        },
      }),
      prisma.mission.count({
        where: {
          status: MissionStatus.COMPLETED,
          completedAt: { gte: startOfThisMonth },
        },
      }),
      prisma.mission.count({
        where: {
          status: MissionStatus.COMPLETED,
          completedAt: { gte: startOfLastMonth, lte: endOfLastMonth },
        },
      }),
    ]);

    let monthOverMonthGrowthPercentage = 0;
    if (completedLastMonth > 0) {
      monthOverMonthGrowthPercentage = Number(
        (((completedThisMonth - completedLastMonth) / completedLastMonth) * 100).toFixed(1)
      );
    } else if (completedThisMonth > 0) {
      monthOverMonthGrowthPercentage = 100.0;
    }

    const completionRatePercentage =
      totalAllMissions > 0
        ? Number(((totalCompletedMissions / totalAllMissions) * 100).toFixed(1))
        : 100.0;

    return {
      totalCompletedMissions,
      completedToday,
      completedThisMonth,
      completedLastMonth,
      monthOverMonthGrowthPercentage,
      completionRatePercentage,
    };
  }

  /**
   * 2. GET REVENUE ANALYTICS
   */
  public static async getRevenueAnalytics(): Promise<RevenueAnalyticsDTO> {
    const { startOfThisMonth, startOfLastMonth, endOfLastMonth } =
      this.getDateRanges();

    const [
      allPaymentsAgg,
      thisMonthAgg,
      lastMonthAgg,
      completedMissionsCount,
    ] = await Promise.all([
      prisma.payment.aggregate({
        where: { paymentStatus: PaymentStatus.COMPLETED },
        _sum: {
          totalAmount: true,
          companyCommission: true,
          pilotEarnings: true,
        },
      }),
      prisma.payment.aggregate({
        where: {
          paymentStatus: PaymentStatus.COMPLETED,
          createdAt: { gte: startOfThisMonth },
        },
        _sum: { totalAmount: true },
      }),
      prisma.payment.aggregate({
        where: {
          paymentStatus: PaymentStatus.COMPLETED,
          createdAt: { gte: startOfLastMonth, lte: endOfLastMonth },
        },
        _sum: { totalAmount: true },
      }),
      prisma.mission.count({ where: { status: MissionStatus.COMPLETED } }),
    ]);

    const totalRevenue = Number(allPaymentsAgg._sum.totalAmount || 0);
    const companyCommission = Number(allPaymentsAgg._sum.companyCommission || 0);
    const pilotEarnings = Number(allPaymentsAgg._sum.pilotEarnings || 0);
    const revenueThisMonth = Number(thisMonthAgg._sum.totalAmount || 0);
    const revenueLastMonth = Number(lastMonthAgg._sum.totalAmount || 0);

    let monthOverMonthGrowthPercentage = 0;
    if (revenueLastMonth > 0) {
      monthOverMonthGrowthPercentage = Number(
        (((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100).toFixed(1)
      );
    } else if (revenueThisMonth > 0) {
      monthOverMonthGrowthPercentage = 100.0;
    }

    const averageRevenuePerMission =
      completedMissionsCount > 0
        ? Number((totalRevenue / completedMissionsCount).toFixed(2))
        : 0;

    return {
      totalRevenue: Number(totalRevenue.toFixed(2)),
      companyCommission: Number(companyCommission.toFixed(2)),
      pilotEarnings: Number(pilotEarnings.toFixed(2)),
      revenueThisMonth: Number(revenueThisMonth.toFixed(2)),
      revenueLastMonth: Number(revenueLastMonth.toFixed(2)),
      monthOverMonthGrowthPercentage,
      averageRevenuePerMission,
      currency: "LKR",
    };
  }

  /**
   * 3. GET PILOT FLEET PERFORMANCE KPIS
   */
  public static async getPilotFleetPerformance(): Promise<PilotFleetPerformanceDTO> {
    const [profiles, topPilot] = await Promise.all([
      prisma.pilotProfile.findMany({
        include: {
          user: {
            select: { firstName: true, lastName: true },
          },
        },
      }),
      prisma.pilotProfile.findFirst({
        orderBy: [{ ratings: "desc" }, { completedMissions: "desc" }],
        include: {
          user: { select: { firstName: true, lastName: true } },
        },
      }),
    ]);

    const totalPilots = profiles.length;
    let activePilots = 0;
    let onMissionPilots = 0;
    let inactivePilots = 0;
    let totalFleetFlightHours = 0;
    let totalCompletedMissions = 0;
    let ratingsSum = 0;
    let ratedPilotsCount = 0;

    for (const p of profiles) {
      if (p.status === PilotStatus.ACTIVE) activePilots++;
      else if (p.status === PilotStatus.ON_MISSION) onMissionPilots++;
      else inactivePilots++;

      totalFleetFlightHours += Number(p.totalFlightHours || 0);
      totalCompletedMissions += p.completedMissions || 0;

      if (p.ratings) {
        ratingsSum += Number(p.ratings);
        ratedPilotsCount++;
      }
    }

    const fleetAverageRating =
      ratedPilotsCount > 0
        ? Number((ratingsSum / ratedPilotsCount).toFixed(2))
        : 5.0;

    return {
      fleetAverageRating,
      totalFleetFlightHours: Number(totalFleetFlightHours.toFixed(2)),
      totalCompletedMissions,
      totalPilots,
      activePilots,
      onMissionPilots,
      inactivePilots,
      topPerformingPilot: topPilot
        ? {
            userId: topPilot.userId,
            fullName: `${topPilot.user.firstName} ${topPilot.user.lastName}`.trim(),
            ratings: topPilot.ratings ? Number(topPilot.ratings) : null,
            completedMissions: topPilot.completedMissions,
          }
        : null,
    };
  }

  /**
   * 4. GET FARMER REGISTRATION GROWTH ANALYTICS
   */
  public static async getFarmerGrowth(): Promise<FarmerGrowthAnalyticsDTO> {
    const { startOfThisMonth, startOfLastMonth, endOfLastMonth } =
      this.getDateRanges();

    const [
      totalFarmers,
      newFarmersThisMonth,
      newFarmersLastMonth,
      activeFarmersWithFields,
      totalFieldsRegistered,
    ] = await Promise.all([
      prisma.user.count({
        where: { role: { name: "Farmer" } },
      }),
      prisma.user.count({
        where: {
          role: { name: "Farmer" },
          createdAt: { gte: startOfThisMonth },
        },
      }),
      prisma.user.count({
        where: {
          role: { name: "Farmer" },
          createdAt: { gte: startOfLastMonth, lte: endOfLastMonth },
        },
      }),
      prisma.farmerProfile.count({
        where: {
          fields: { some: {} },
        },
      }),
      prisma.field.count(),
    ]);

    let growthPercentage = 0;
    if (newFarmersLastMonth > 0) {
      growthPercentage = Number(
        (((newFarmersThisMonth - newFarmersLastMonth) / newFarmersLastMonth) * 100).toFixed(1)
      );
    } else if (newFarmersThisMonth > 0) {
      growthPercentage = 100.0;
    }

    return {
      totalFarmers,
      newFarmersThisMonth,
      newFarmersLastMonth,
      growthPercentage,
      activeFarmersWithFields,
      totalFieldsRegistered,
    };
  }

  /**
   * 5. GET PILOT PERFORMANCE TABLE DATA (Paginated, Searchable, Sortable)
   */
  public static async getPilotPerformanceTable(
    query: PilotPerformanceTableQueryDTO
  ): Promise<PaginatedPilotPerformanceTableResponseDTO> {
    const { page, limit, skip } = getPaginationOffsets(query.page, query.limit);

    const { search, status, sortBy = "completedMissions", sortOrder = "desc" } = query;

    const whereClause: any = {
      role: { name: "Pilot" },
    };

    if (status) {
      whereClause.pilotProfile = {
        status: status as PilotStatus,
      };
    }

    if (search && search.trim() !== "") {
      const searchTerm = search.trim();
      whereClause.OR = [
        { firstName: { contains: searchTerm, mode: "insensitive" } },
        { lastName: { contains: searchTerm, mode: "insensitive" } },
        { email: { contains: searchTerm, mode: "insensitive" } },
        { mobile: { contains: searchTerm, mode: "insensitive" } },
        {
          pilotProfile: {
            licenceNumber: { contains: searchTerm, mode: "insensitive" },
          },
        },
      ];
    }

    let orderBy: any = { createdAt: sortOrder };
    if (sortBy === "pilotName") {
      orderBy = { firstName: sortOrder };
    } else if (sortBy === "completedMissions") {
      orderBy = { pilotProfile: { completedMissions: sortOrder } };
    } else if (sortBy === "ratings") {
      orderBy = { pilotProfile: { ratings: sortOrder } };
    } else if (sortBy === "totalFlightHours") {
      orderBy = { pilotProfile: { totalFlightHours: sortOrder } };
    }

    const [total, pilots] = await Promise.all([
      prisma.user.count({ where: whereClause }),
      prisma.user.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy,
        select: {
          userId: true,
          firstName: true,
          lastName: true,
          email: true,
          mobile: true,
          createdAt: true,
          pilotProfile: {
            select: {
              licenceNumber: true,
              status: true,
              ratings: true,
              completedMissions: true,
              totalFlightHours: true,
              missions: {
                select: {
                  status: true,
                  payment: {
                    select: {
                      pilotEarnings: true,
                      paymentStatus: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    const items: PilotPerformanceTableRowDTO[] = pilots.map((pilot) => {
      const profile = pilot.pilotProfile;
      const missions = profile?.missions || [];

      let scheduledMissions = 0;
      let activeMissions = 0;
      let totalEarnings = 0;

      for (const m of missions) {
        if (m.status === MissionStatus.SCHEDULED) scheduledMissions++;
        if (m.status === MissionStatus.IN_PROGRESS) activeMissions++;

        if (m.payment && m.payment.paymentStatus === "COMPLETED") {
          totalEarnings += Number(m.payment.pilotEarnings || 0);
        }
      }

      const completedCount = profile?.completedMissions || 0;

      return {
        pilotId: pilot.userId,
        pilotName: `${pilot.firstName} ${pilot.lastName}`.trim(),
        email: pilot.email,
        mobile: pilot.mobile,
        licenceNumber: profile?.licenceNumber || "N/A",
        status: profile?.status || "INACTIVE",
        missions: {
          completedMissions: completedCount,
          activeMissions,
          scheduledMissions,
          totalAssigned: missions.length,
        },
        averageRatings: profile?.ratings ? Number(profile.ratings) : null,
        flightHours: profile?.totalFlightHours
          ? Number(profile.totalFlightHours)
          : 0,
        totalEarnings: Number(totalEarnings.toFixed(2)),
        createdAt: pilot.createdAt,
      };
    });

    const pagination = buildPaginationMeta(total, page, limit);

    return { pilots: items, pagination };
  }
}
