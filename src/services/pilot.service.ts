import prisma from "../config/prisma";
import {
  PilotQueryDTO,
  PilotListItemDTO,
  PilotProfileDetailDTO,
  PilotMissionQueryDTO,
  PilotMissionItemDTO,
  CompleteMissionDTO,
  PilotPayoutQueryDTO,
  PilotPayoutsResponseDTO,
  PilotReviewQueryDTO,
  PilotReviewItemDTO,
} from "../types/pilot.types";
import { PaginatedResult } from "../types/farmer.types";
import { JwtPayload } from "../types/auth.types";
import { AppError } from "../utils/AppError";
import { logActivity } from "../utils/activityLogger";
import { getPaginationOffsets, buildPaginationMeta } from "../utils/pagination";
import { PilotStatus, MissionStatus, PayoutStatus } from "../generated/prisma/enums";

export class PilotService {
  /**
   * CSO Security Check: Enforces strict RBAC and IDOR (Insecure Direct Object Reference) defense.
   * Admins have global operational access; Pilots are restricted strictly to their assigned ID.
   */
  public static validatePilotAccess(
    requestUser: JwtPayload | undefined,
    targetPilotId: number
  ): void {
    if (!requestUser) {
      throw AppError.unauthorized("Authentication required.");
    }

    const userRole = requestUser.role.toLowerCase();

    if (userRole === "admin") {
      return; // Admin possesses global operational clearance
    }

    if (userRole === "pilot") {
      if (requestUser.userId !== targetPilotId) {
        throw AppError.forbidden(
          "Access denied. You are only authorized to access your own pilot records."
        );
      }
      return;
    }

    throw AppError.forbidden("Access restricted to Admins or the target Pilot.");
  }

  /**
   * Helper: Ensure the target user exists and has a Pilot profile
   */
  public static async validatePilotExists(pilotId: number): Promise<void> {
    const pilot = await prisma.user.findFirst({
      where: {
        userId: pilotId,
        role: {
          name: "Pilot",
        },
      },
      select: { userId: true },
    });

    if (!pilot) {
      throw AppError.notFound(`Pilot with ID ${pilotId} does not exist.`);
    }
  }

  /**
   * 1. GET ALL PILOTS (Paginated, Filterable, Searchable)
   */
  public static async getAllPilots(
    query: PilotQueryDTO
  ): Promise<PaginatedResult<PilotListItemDTO>> {
    const { page, limit, skip } = getPaginationOffsets(query.page, query.limit);

    const { search, status, sortBy = "createdAt", sortOrder = "desc" } = query;

    const whereClause: any = {
      role: {
        name: { equals: "Pilot", mode: "insensitive" },
      },
    };

    const andConditions: any[] = [];

    if (status) {
      andConditions.push({
        pilotProfile: {
          status: status as PilotStatus,
        },
      });
    }

    if (search && search.trim() !== "") {
      const searchTerm = search.trim();
      andConditions.push({
        OR: [
          { firstName: { contains: searchTerm, mode: "insensitive" } },
          { lastName: { contains: searchTerm, mode: "insensitive" } },
          { email: { contains: searchTerm, mode: "insensitive" } },
          { mobile: { contains: searchTerm, mode: "insensitive" } },
          {
            pilotProfile: {
              licenceNumber: { contains: searchTerm, mode: "insensitive" },
            },
          },
        ],
      });
    }

    if (andConditions.length > 0) {
      whereClause.AND = andConditions;
    }

    let orderBy: any = { createdAt: sortOrder };
    if (sortBy === "name") {
      orderBy = { firstName: sortOrder };
    } else if (sortBy === "ratings") {
      orderBy = { pilotProfile: { ratings: sortOrder } };
    } else if (sortBy === "completedMissions") {
      orderBy = { pilotProfile: { completedMissions: sortOrder } };
    } else if (sortBy === "totalFlightHours") {
      orderBy = { pilotProfile: { totalFlightHours: sortOrder } };
    }

    const [total, pilots] = await prisma.$transaction([
      prisma.user.count({ where: whereClause }),
      prisma.user.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy,
        select: {
          userId: true,
          email: true,
          firstName: true,
          lastName: true,
          mobile: true,
          createdAt: true,
          updatedAt: true,
          pilotProfile: {
            select: {
              licenceNumber: true,
              status: true,
              ratings: true,
              completedMissions: true,
              totalFlightHours: true,
              missions: {
                where: {
                  status: {
                    in: [MissionStatus.SCHEDULED, MissionStatus.IN_PROGRESS],
                  },
                },
                select: { missionId: true },
              },
            },
          },
        },
      }),
    ]);

    const items: PilotListItemDTO[] = pilots.map((pilot) => {
      const profile = pilot.pilotProfile;
      return {
        userId: pilot.userId,
        email: pilot.email,
        firstName: pilot.firstName,
        lastName: pilot.lastName,
        fullName: `${pilot.firstName} ${pilot.lastName}`.trim(),
        mobile: pilot.mobile,
        licenceNumber: profile?.licenceNumber || "N/A",
        status: profile?.status || "INACTIVE",
        ratings: profile?.ratings !== null && profile?.ratings !== undefined ? Number(profile.ratings) : null,
        completedMissions: profile?.completedMissions !== null && profile?.completedMissions !== undefined ? Number(profile.completedMissions) : 0,
        totalFlightHours: profile?.totalFlightHours !== null && profile?.totalFlightHours !== undefined
          ? Number(profile.totalFlightHours)
          : 0,
        activeMissionsCount: profile?.missions ? profile.missions.length : 0,
        createdAt: pilot.createdAt,
        updatedAt: pilot.updatedAt,
      };
    });

    const pagination = buildPaginationMeta(total, page, limit);

    return { items, pagination };
  }

  /**
   * 2. GET SINGLE PILOT PROFILE & PERFORMANCE METRICS
   */
  public static async getPilotById(
    pilotId: number,
    requestUser?: JwtPayload
  ): Promise<PilotProfileDetailDTO> {
    if (requestUser) {
      this.validatePilotAccess(requestUser, pilotId);
    }
    await this.validatePilotExists(pilotId);

    const user = await prisma.user.findUnique({
      where: { userId: pilotId },
      select: {
        userId: true,
        email: true,
        firstName: true,
        lastName: true,
        mobile: true,
        createdAt: true,
        updatedAt: true,
        role: {
          select: { name: true },
        },
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
            payouts: {
              where: { status: PayoutStatus.PENDING },
              select: { amount: true },
            },
            reviews: {
              select: { reviewId: true },
            },
          },
        },
      },
    });

    if (!user || !user.pilotProfile) {
      throw AppError.notFound(`Pilot profile for ID ${pilotId} not found.`);
    }

    const profile = user.pilotProfile;
    const missions = profile.missions || [];

    let scheduledMissions = 0;
    let inProgressMissions = 0;
    let failedMissions = 0;
    let totalEarnings = 0;

    for (const m of missions) {
      if (m.status === MissionStatus.SCHEDULED) scheduledMissions++;
      if (m.status === MissionStatus.IN_PROGRESS) inProgressMissions++;
      if (m.status === MissionStatus.FAILED) failedMissions++;

      if (m.payment && m.payment.paymentStatus === "COMPLETED") {
        totalEarnings += Number(m.payment.pilotEarnings || 0);
      }
    }

    const pendingPayouts = (profile.payouts || []).reduce(
      (sum, p) => sum + Number(p.amount || 0),
      0
    );

    return {
      userId: user.userId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: `${user.firstName} ${user.lastName}`.trim(),
      mobile: user.mobile,
      licenceNumber: profile.licenceNumber,
      status: profile.status,
      role: user.role.name,
      stats: {
        ratings: profile.ratings ? Number(profile.ratings) : null,
        completedMissions: profile.completedMissions,
        totalFlightHours: Number(profile.totalFlightHours || 0),
        scheduledMissions,
        inProgressMissions,
        failedMissions,
        totalEarnings: Number(totalEarnings.toFixed(2)),
        pendingPayouts: Number(pendingPayouts.toFixed(2)),
        totalReviews: (profile.reviews || []).length,
      },
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  /**
   * 3. UPDATE PILOT AVAILABILITY / DUTY STATUS
   */
  public static async updatePilotStatus(
    pilotId: number,
    status: PilotStatus,
    requestUser?: JwtPayload
  ): Promise<{ userId: number; licenceNumber: string; status: string }> {
    if (requestUser) {
      this.validatePilotAccess(requestUser, pilotId);
      // Non-admin pilots cannot suspend their own account
      if (
        requestUser.role.toLowerCase() === "pilot" &&
        status === PilotStatus.SUSPENDED
      ) {
        throw AppError.forbidden("Only Administrators can set pilot status to SUSPENDED.");
      }
    }
    await this.validatePilotExists(pilotId);

    const updated = await prisma.pilotProfile.update({
      where: { userId: pilotId },
      data: { status },
      select: {
        userId: true,
        licenceNumber: true,
        status: true,
      },
    });

    logActivity({
      userId: requestUser?.userId || pilotId,
      action: "PILOT_STATUS_UPDATED",
      entityType: "PILOT_PROFILE",
      entityId: pilotId,
      details: `Pilot status updated to ${status}.`,
    });

    return updated;
  }

  /**
   * 4. GET PILOT'S MISSION SCHEDULE & HISTORY
   */
  public static async getPilotMissions(
    pilotId: number,
    query: PilotMissionQueryDTO,
    requestUser?: JwtPayload
  ): Promise<PaginatedResult<PilotMissionItemDTO>> {
    if (requestUser) {
      this.validatePilotAccess(requestUser, pilotId);
    }
    await this.validatePilotExists(pilotId);

    const { page, limit, skip } = getPaginationOffsets(query.page, query.limit);

    const whereClause: any = {
      pilotId,
    };

    if (query.status) {
      whereClause.status = query.status as MissionStatus;
    }

    if (query.startDate || query.endDate) {
      whereClause.serviceRequest = {
        preferredDate: {},
      };
      if (query.startDate) {
        whereClause.serviceRequest.preferredDate.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        whereClause.serviceRequest.preferredDate.lte = new Date(query.endDate);
      }
    }

    const [total, missions] = await Promise.all([
      prisma.mission.count({ where: whereClause }),
      prisma.mission.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          serviceRequest: {
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
            },
          },
          payment: {
            select: {
              paymentId: true,
              totalAmount: true,
              pilotEarnings: true,
              paymentStatus: true,
              paymentMethod: true,
              payoutStatus: true,
            },
          },
          review: {
            select: {
              reviewId: true,
              rating: true,
              comment: true,
              createdAt: true,
            },
          },
        },
      }),
    ]);

    const items: PilotMissionItemDTO[] = missions.map((m) => {
      const sr = m.serviceRequest;
      const field = sr.field;
      const farmerUser = field.farmer.user;

      return {
        missionId: m.missionId,
        requestId: sr.requestId,
        requestCode: sr.requestCode,
        serviceType: sr.serviceType,
        preferredDate: sr.preferredDate,
        priority: sr.priority,
        status: m.status,
        startedAt: m.startedAt,
        completedAt: m.completedAt,
        areaSpread: m.areaSpread ? Number(m.areaSpread) : null,
        pilotNotes: m.pilotNotes,
        field: {
          id: field.id,
          fieldName: field.fieldName,
          cropType: field.cropType,
          area: Number(field.area),
          locationCoordinates: field.locationCoordinates,
          district: field.district,
          province: field.province,
          city: field.city,
          village: field.village,
        },
        farmer: {
          userId: farmerUser.userId,
          fullName: `${farmerUser.firstName} ${farmerUser.lastName}`.trim(),
          mobile: farmerUser.mobile,
          address: field.farmer.address,
        },
        payment: m.payment
          ? {
              paymentId: m.payment.paymentId,
              totalAmount: Number(m.payment.totalAmount),
              pilotEarnings: Number(m.payment.pilotEarnings),
              paymentStatus: m.payment.paymentStatus,
              paymentMethod: m.payment.paymentMethod,
              payoutStatus: m.payment.payoutStatus,
            }
          : null,
        review: m.review
          ? {
              reviewId: m.review.reviewId,
              rating: m.review.rating,
              comment: m.review.comment,
              createdAt: m.review.createdAt,
            }
          : null,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
      };
    });

    const pagination = buildPaginationMeta(total, page, limit);

    return { items, pagination };
  }

  /**
   * 5. START MISSION (Transition from SCHEDULED to IN_PROGRESS)
   */
  public static async startMission(
    pilotId: number,
    missionId: number,
    requestUser?: JwtPayload
  ): Promise<{ missionId: number; status: string; startedAt: Date }> {
    if (requestUser) {
      this.validatePilotAccess(requestUser, pilotId);
    }
    await this.validatePilotExists(pilotId);

    const mission = await prisma.mission.findUnique({
      where: { missionId },
      include: { serviceRequest: true },
    });

    if (!mission) {
      throw AppError.notFound(`Mission with ID ${missionId} not found.`);
    }

    if (mission.pilotId !== pilotId) {
      throw AppError.forbidden(`Mission ${missionId} is not assigned to pilot ${pilotId}.`);
    }

    if (mission.status !== MissionStatus.SCHEDULED) {
      throw AppError.badRequest(
        `Cannot start mission. Current status is '${mission.status}'. Only SCHEDULED missions can be started.`
      );
    }

    const startedAt = new Date();

    // Atomic multi-table state transition
    const result = await prisma.$transaction(async (tx) => {
      const updatedMission = await tx.mission.update({
        where: { missionId },
        data: {
          status: MissionStatus.IN_PROGRESS,
          startedAt,
        },
      });

      await tx.serviceRequest.update({
        where: { requestId: mission.requestId },
        data: {
          status: "IN_PROGRESS",
        },
      });

      await tx.pilotProfile.update({
        where: { userId: pilotId },
        data: {
          status: PilotStatus.ON_MISSION,
        },
      });

      return updatedMission;
    });

    logActivity({
      userId: requestUser?.userId || pilotId,
      action: "MISSION_STARTED",
      entityType: "MISSION",
      entityId: missionId,
      details: `Mission #${missionId} started for request ${mission.serviceRequest.requestCode}.`,
    });

    return {
      missionId: result.missionId,
      status: result.status,
      startedAt,
    };
  }

  /**
   * 6. COMPLETE MISSION (Atomic completion, flight hours & metrics calculation)
   */
  public static async completeMission(
    pilotId: number,
    missionId: number,
    dto: CompleteMissionDTO,
    requestUser?: JwtPayload
  ): Promise<{
    missionId: number;
    status: string;
    completedAt: Date;
    areaSpread: number;
    totalFlightHours: number;
  }> {
    if (requestUser) {
      this.validatePilotAccess(requestUser, pilotId);
    }
    await this.validatePilotExists(pilotId);

    const mission = await prisma.mission.findUnique({
      where: { missionId },
      include: { serviceRequest: true },
    });

    if (!mission) {
      throw AppError.notFound(`Mission with ID ${missionId} not found.`);
    }

    if (mission.pilotId !== pilotId) {
      throw AppError.forbidden(`Mission ${missionId} is not assigned to pilot ${pilotId}.`);
    }

    if (
      mission.status !== MissionStatus.IN_PROGRESS &&
      mission.status !== MissionStatus.SCHEDULED
    ) {
      throw AppError.badRequest(
        `Cannot complete mission. Current status is '${mission.status}'.`
      );
    }

    const completedAt = new Date();

    // Atomic transaction: Complete mission, update pilot flight hours, increment missions, reset status to ACTIVE
    const result = await prisma.$transaction(async (tx) => {
      const updatedMission = await tx.mission.update({
        where: { missionId },
        data: {
          status: MissionStatus.COMPLETED,
          completedAt,
          areaSpread: dto.areaSpread,
          pilotNotes: dto.pilotNotes || null,
        },
      });

      await tx.serviceRequest.update({
        where: { requestId: mission.requestId },
        data: {
          status: "COMPLETED",
        },
      });

      const updatedPilot = await tx.pilotProfile.update({
        where: { userId: pilotId },
        data: {
          status: PilotStatus.ACTIVE,
          completedMissions: {
            increment: 1,
          },
          totalFlightHours: {
            increment: dto.flightDurationHours,
          },
        },
        select: {
          totalFlightHours: true,
        },
      });

      return {
        updatedMission,
        updatedPilot,
      };
    });

    logActivity({
      userId: requestUser?.userId || pilotId,
      action: "MISSION_COMPLETED",
      entityType: "MISSION",
      entityId: missionId,
      details: `Mission #${missionId} completed for ${mission.serviceRequest.requestCode} with ${dto.areaSpread} acres spread.`,
    });

    return {
      missionId: result.updatedMission.missionId,
      status: result.updatedMission.status,
      completedAt,
      areaSpread: dto.areaSpread,
      totalFlightHours: Number(result.updatedPilot.totalFlightHours),
    };
  }

  /**
   * 7. GET PILOT'S FINANCIAL PAYOUTS
   */
  public static async getPilotPayouts(
    pilotId: number,
    query: PilotPayoutQueryDTO,
    requestUser?: JwtPayload
  ): Promise<PilotPayoutsResponseDTO> {
    if (requestUser) {
      this.validatePilotAccess(requestUser, pilotId);
    }
    await this.validatePilotExists(pilotId);

    const { page, limit, skip } = getPaginationOffsets(query.page, query.limit);

    const whereClause: any = { pilotId };
    if (query.status) {
      whereClause.status = query.status as PayoutStatus;
    }

    const [total, payouts, payoutGroups] = await Promise.all([
      prisma.payout.count({ where: whereClause }),
      prisma.payout.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.payout.groupBy({
        by: ["status"],
        where: { pilotId },
        _sum: { amount: true },
      }),
    ]);

    let totalSettled = 0;
    let totalPending = 0;
    let totalProcessing = 0;

    for (const g of payoutGroups) {
      const amt = Number(g._sum.amount || 0);
      if (g.status === PayoutStatus.SETTLED) totalSettled = amt;
      if (g.status === PayoutStatus.PENDING) totalPending = amt;
      if (g.status === PayoutStatus.PROCESSING) totalProcessing = amt;
    }

    const items = payouts.map((p) => ({
      payoutId: p.payoutId,
      pilotId: p.pilotId,
      periodStart: p.periodStart,
      periodEnd: p.periodEnd,
      amount: Number(p.amount),
      bankName: p.bankName,
      bankAccountNo: p.bankAccountNo,
      transactionRef: p.transactionRef,
      status: p.status,
      settledAt: p.settledAt,
      createdAt: p.createdAt,
    }));

    const pagination = buildPaginationMeta(total, page, limit);

    return {
      payouts: items,
      summary: {
        totalSettled: Number(totalSettled.toFixed(2)),
        totalPending: Number(totalPending.toFixed(2)),
        totalProcessing: Number(totalProcessing.toFixed(2)),
      },
      pagination,
    };
  }

  /**
   * 8. GET PILOT'S REVIEWS & RATINGS
   */
  public static async getPilotReviews(
    pilotId: number,
    query: PilotReviewQueryDTO,
    requestUser?: JwtPayload
  ): Promise<PaginatedResult<PilotReviewItemDTO>> {
    if (requestUser) {
      this.validatePilotAccess(requestUser, pilotId);
    }
    await this.validatePilotExists(pilotId);

    const { page, limit, skip } = getPaginationOffsets(query.page, query.limit);

    const whereClause: any = { pilotId };
    if (query.minRating !== undefined || query.maxRating !== undefined) {
      whereClause.rating = {};
      if (query.minRating !== undefined) whereClause.rating.gte = query.minRating;
      if (query.maxRating !== undefined) whereClause.rating.lte = query.maxRating;
    }

    const [total, reviews] = await Promise.all([
      prisma.review.count({ where: whereClause }),
      prisma.review.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
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
          mission: {
            include: {
              serviceRequest: {
                select: {
                  requestCode: true,
                },
              },
            },
          },
        },
      }),
    ]);

    const items: PilotReviewItemDTO[] = reviews.map((r) => ({
      reviewId: r.reviewId,
      missionId: r.missionId,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt,
      farmer: {
        userId: r.farmer.user.userId,
        fullName: `${r.farmer.user.firstName} ${r.farmer.user.lastName}`.trim(),
      },
      mission: {
        requestCode: r.mission.serviceRequest.requestCode,
        completedAt: r.mission.completedAt,
      },
    }));

    const pagination = buildPaginationMeta(total, page, limit);

    return { items, pagination };
  }
}
