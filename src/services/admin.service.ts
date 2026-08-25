import prisma from "../config/prisma";
import {
  DashboardMetricsDTO,
  RecentActivityItemDTO,
  TodayScheduleItemDTO,
  AdminDashboardOverviewDTO,
} from "../types/admin.types";
import {
  RequestStatus,
  RequestPriority,
  MissionStatus,
  PilotStatus,
  PaymentStatus,
} from "../generated/prisma/enums";

export class AdminService {
  /**
   * Helper: Get Start and End timestamps of Today
   */
  private static getTodayBounds(): { startOfDay: Date; endOfDay: Date } {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    return { startOfDay, endOfDay };
  }

  /**
   * 1. GET DASHBOARD METRICS & KPIS
   * - Number of pending requests
   * - Number of active missions
   * - Number of available pilots
   * - Today's total revenue breakdown (total, company, pilot)
   * - Mission success rate in the last 90 days
   */
  public static async getMetrics(
    periodDays: number = 90
  ): Promise<DashboardMetricsDTO> {
    const { startOfDay, endOfDay } = this.getTodayBounds();
    const days = Math.max(1, Math.min(365, periodDays));
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [
      pendingRequests,
      activeMissions,
      availablePilots,
      todayRevenueAgg,
      periodMissionGroups,
      totalPeriodMissions,
    ] = await Promise.all([
      // 1. Pending service requests
      prisma.serviceRequest.count({
        where: { status: RequestStatus.PENDING },
      }),

      // 2. Active missions currently in progress
      prisma.mission.count({
        where: { status: MissionStatus.IN_PROGRESS },
      }),

      // 3. Available pilots on active duty
      prisma.pilotProfile.count({
        where: { status: PilotStatus.ACTIVE },
      }),

      // 4. Payments aggregated directly in PostgreSQL
      prisma.payment.aggregate({
        where: {
          paymentStatus: PaymentStatus.COMPLETED,
          createdAt: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
        _sum: {
          totalAmount: true,
          companyCommission: true,
          pilotEarnings: true,
        },
      }),

      // 5. Mission status counts aggregated directly in PostgreSQL
      prisma.mission.groupBy({
        by: ["status"],
        where: {
          createdAt: { gte: cutoffDate },
        },
        _count: {
          status: true,
        },
      }),

      // 6. Total missions in period
      prisma.mission.count({
        where: {
          createdAt: { gte: cutoffDate },
        },
      }),
    ]);

    // Calculate today's revenue totals from DB aggregation
    const todayTotalAmount = Number(todayRevenueAgg._sum.totalAmount || 0);
    const todayCompanyCommission = Number(todayRevenueAgg._sum.companyCommission || 0);
    const todayPilotEarnings = Number(todayRevenueAgg._sum.pilotEarnings || 0);

    // Calculate period success rate from DB groups
    let completedCount = 0;
    let failedCount = 0;

    for (const g of periodMissionGroups) {
      if (g.status === MissionStatus.COMPLETED) completedCount = g._count.status;
      if (g.status === MissionStatus.FAILED) failedCount = g._count.status;
    }

    const totalFinished = completedCount + failedCount;
    const ratePercentage =
      totalFinished > 0
        ? Number(((completedCount / totalFinished) * 100).toFixed(1))
        : 100.0;

    return {
      pendingRequests,
      activeMissions,
      availablePilots,
      todayRevenue: {
        totalAmount: Number(todayTotalAmount.toFixed(2)),
        companyCommission: Number(todayCompanyCommission.toFixed(2)),
        pilotEarnings: Number(todayPilotEarnings.toFixed(2)),
        currency: "LKR",
      },
      missionSuccessRate90Days: {
        ratePercentage,
        totalMissions: totalPeriodMissions,
        completed: completedCount,
        failed: failedCount,
        periodDays: days,
      },
    };
  }

  /**
   * 2. GET RECENT ACTIVITIES FEED (Latest 6 activities with synthesized fallback)
   */
  public static async getRecentActivities(
    limit: number = 6
  ): Promise<RecentActivityItemDTO[]> {
    const rawLogs = await prisma.activityLog.findMany({
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            userId: true,
            firstName: true,
            lastName: true,
            role: {
              select: { name: true },
            },
          },
        },
      },
    });

    const activities: RecentActivityItemDTO[] = rawLogs.map((log) => ({
      id: `LOG-${log.logId}`,
      action: log.action,
      title: log.action.replace(/_/g, " "),
      description: log.details,
      timestamp: log.createdAt,
      entityType: log.entityType,
      entityId: log.entityId,
      actor: {
        userId: log.user?.userId || null,
        name: log.user
          ? `${log.user.firstName} ${log.user.lastName}`.trim()
          : "System",
        role: log.user?.role?.name || "System",
      },
    }));

    // If fewer than requested limit, synthesize live events from recent records
    if (activities.length < limit) {
      const needed = limit - activities.length;

      const [recentRequests, recentMissions, recentPayments] =
        await Promise.all([
          prisma.serviceRequest.findMany({
            take: needed,
            orderBy: { createdAt: "desc" },
            include: {
              field: {
                include: {
                  farmer: {
                    include: {
                      user: {
                        select: {
                          userId: true,
                          firstName: true,
                          lastName: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          }),
          prisma.mission.findMany({
            take: needed,
            orderBy: { updatedAt: "desc" },
            include: {
              serviceRequest: { select: { requestCode: true } },
              pilot: {
                include: {
                  user: {
                    select: {
                      userId: true,
                      firstName: true,
                      lastName: true,
                    },
                  },
                },
              },
            },
          }),
          prisma.payment.findMany({
            take: needed,
            orderBy: { createdAt: "desc" },
            include: {
              mission: {
                include: {
                  serviceRequest: { select: { requestCode: true } },
                },
              },
            },
          }),
        ]);

      for (const req of recentRequests) {
        const farmer = req.field.farmer.user;
        activities.push({
          id: `REQ-${req.requestId}`,
          action: "REQUEST_CREATED",
          title: "Service Request Submitted",
          description: `New spraying request ${req.requestCode} created for ${req.field.fieldName} (${req.field.cropType}).`,
          timestamp: req.createdAt,
          entityType: "SERVICE_REQUEST",
          entityId: req.requestId,
          actor: {
            userId: farmer.userId,
            name: `${farmer.firstName} ${farmer.lastName}`.trim(),
            role: "Farmer",
          },
        });
      }

      for (const m of recentMissions) {
        const pilotName = m.pilot
          ? `${m.pilot.user.firstName} ${m.pilot.user.lastName}`.trim()
          : "Assigned Pilot";
        activities.push({
          id: `MSN-${m.missionId}`,
          action: `MISSION_${m.status}`,
          title: `Mission ${m.status}`,
          description: `Mission #${m.missionId} for ${m.serviceRequest.requestCode} is currently ${m.status}.`,
          timestamp: m.updatedAt,
          entityType: "MISSION",
          entityId: m.missionId,
          actor: {
            userId: m.pilot?.userId || null,
            name: pilotName,
            role: "Pilot",
          },
        });
      }

      for (const p of recentPayments) {
        activities.push({
          id: `PAY-${p.paymentId}`,
          action: "PAYMENT_RECORDED",
          title: "Payment Processed",
          description: `Payment of LKR ${Number(p.totalAmount).toLocaleString()} recorded for ${p.mission.serviceRequest.requestCode}.`,
          timestamp: p.createdAt,
          entityType: "PAYMENT",
          entityId: p.paymentId,
          actor: {
            userId: null,
            name: "Payment Gateway",
            role: "System",
          },
        });
      }
    }

    // Sort descending by timestamp and slice to exact limit
    activities.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return activities.slice(0, limit);
  }

  /**
   * 3. GET TODAY'S FLIGHT & MISSION SCHEDULE
   */
  public static async getTodaySchedule(
    filters?: {
      date?: string;
      status?: RequestStatus;
      priority?: RequestPriority;
    }
  ): Promise<TodayScheduleItemDTO[]> {
    let startOfDay: Date;
    let endOfDay: Date;

    if (filters?.date) {
      startOfDay = new Date(filters.date);
      startOfDay.setHours(0, 0, 0, 0);
      endOfDay = new Date(filters.date);
      endOfDay.setHours(23, 59, 59, 999);
    } else {
      const bounds = this.getTodayBounds();
      startOfDay = bounds.startOfDay;
      endOfDay = bounds.endOfDay;
    }

    const whereClause: any = {};

    if (filters?.status) {
      whereClause.status = filters.status;
    } else {
      whereClause.OR = [
        {
          preferredDate: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
        {
          status: {
            in: [RequestStatus.IN_PROGRESS, RequestStatus.ASSIGNED],
          },
        },
      ];
    }

    if (filters?.priority) {
      whereClause.priority = filters.priority;
    }

    // Query requests with filters
    const serviceRequests = await prisma.serviceRequest.findMany({
      where: whereClause,
      orderBy: [{ priority: "desc" }, { preferredDate: "asc" }],
      include: {
        field: {
          include: {
            farmer: {
              include: {
                user: {
                  select: {
                    userId: true,
                    firstName: true,
                    lastName: true,
                    mobile: true,
                  },
                },
              },
            },
          },
        },
        missions: {
          include: {
            pilot: {
              include: {
                user: {
                  select: {
                    userId: true,
                    firstName: true,
                    lastName: true,
                    mobile: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const scheduleItems: TodayScheduleItemDTO[] = serviceRequests.map((sr) => {
      const farmerUser = sr.field.farmer.user;
      const latestMission = sr.missions[0] || null;
      const pilot = latestMission?.pilot || null;

      return {
        requestId: sr.requestId,
        requestCode: sr.requestCode,
        missionId: latestMission ? latestMission.missionId : null,
        serviceType: sr.serviceType,
        priority: sr.priority,
        status: sr.status,
        preferredDate: sr.preferredDate,
        farmer: {
          userId: farmerUser.userId,
          fullName: `${farmerUser.firstName} ${farmerUser.lastName}`.trim(),
          mobile: farmerUser.mobile,
          village: sr.field.village,
          district: sr.field.district,
        },
        field: {
          id: sr.field.id,
          fieldName: sr.field.fieldName,
          cropType: sr.field.cropType,
          area: Number(sr.field.area),
          locationCoordinates: sr.field.locationCoordinates,
        },
        pilot: pilot
          ? {
              userId: pilot.userId,
              fullName: `${pilot.user.firstName} ${pilot.user.lastName}`.trim(),
              mobile: pilot.user.mobile,
              licenceNumber: pilot.licenceNumber,
              status: pilot.status,
            }
          : null,
      };
    });

    return scheduleItems;
  }

  /**
   * 4. GET ALL-IN-ONE AGGREGATED DASHBOARD OVERVIEW
   */
  public static async getDashboardOverview(): Promise<AdminDashboardOverviewDTO> {
    const [metrics, recentActivities, todaySchedule] = await Promise.all([
      this.getMetrics(),
      this.getRecentActivities(6),
      this.getTodaySchedule(),
    ]);

    return {
      metrics,
      recentActivities,
      todaySchedule,
    };
  }
}
