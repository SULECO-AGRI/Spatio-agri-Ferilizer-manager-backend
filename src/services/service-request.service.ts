import prisma from "../config/prisma";
import {
  CreateServiceRequestDTO,
  ServiceRequestQueryDTO,
  AssignPilotDTO,
  UpdateServiceRequestStatusDTO,
  ServiceRequestListItemDTO,
  ServiceRequestDetailDTO,
  PaginatedServiceRequestsResponseDTO,
  CursorPaginatedServiceRequestsResponseDTO,
} from "../types/service-request.types";
import { PaginationMeta } from "../types/farmer.types";
import { JwtPayload } from "../types/auth.types";
import { AppError } from "../utils/AppError";
import { logActivity } from "../utils/activityLogger";
import {
  getPaginationOffsets,
  buildPaginationMeta,
  decodeCursor,
  encodeCursor,
} from "../utils/pagination";
import {
  RequestStatus,
  RequestPriority,
  ServiceType,
  MissionStatus,
  PilotStatus,
} from "../generated/prisma/enums";

export class ServiceRequestService {
  /**
   * 1. CREATE SERVICE REQUEST (Farmer Only)
   */
  public static async createServiceRequest(
    farmerUserId: number,
    dto: CreateServiceRequestDTO
  ): Promise<ServiceRequestListItemDTO> {
    // 1. Verify field exists and belongs to the authenticated farmer (IDOR defense)
    const field = await prisma.field.findFirst({
      where: {
        id: dto.fieldId,
        farmerId: farmerUserId,
      },
      include: {
        farmer: {
          include: {
            user: {
              select: {
                userId: true,
                firstName: true,
                lastName: true,
                email: true,
                mobile: true,
              },
            },
          },
        },
      },
    });

    if (!field) {
      throw AppError.notFound(
        `Field with ID ${dto.fieldId} not found or does not belong to your account.`
      );
    }

    // 2. Calculate estimated cost if not specified (Standard agricultural rate: LKR 2,500/acre)
    const areaVal = Number(field.area) || 1;
    const estimatedCost =
      dto.estimatedCost !== undefined
        ? dto.estimatedCost
        : Number((areaVal * 2500).toFixed(2));

    // 3. Generate unique request code: REQ-YYYY-XXXXX
    const year = new Date().getFullYear();
    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    const requestCode = `REQ-${year}-${randomSuffix}`;

    // 4. Create ServiceRequest in database
    const newRequest = await prisma.serviceRequest.create({
      data: {
        requestCode,
        fieldId: dto.fieldId,
        serviceType: dto.serviceType as ServiceType,
        preferredDate: new Date(dto.preferredDate),
        priority: (dto.priority || "MEDIUM") as RequestPriority,
        status: RequestStatus.PENDING,
        estimatedCost,
      },
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
                    email: true,
                    mobile: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const farmerUser = newRequest.field.farmer.user;

    // Log persistent audit trail
    logActivity({
      userId: farmerUserId,
      action: "REQUEST_CREATED",
      entityType: "SERVICE_REQUEST",
      entityId: newRequest.requestId,
      details: `Service request ${newRequest.requestCode} created for ${newRequest.field.fieldName} (${newRequest.field.cropType}).`,
    });

    return {
      requestId: newRequest.requestId,
      requestCode: newRequest.requestCode,
      serviceType: newRequest.serviceType,
      preferredDate: newRequest.preferredDate,
      priority: newRequest.priority,
      status: newRequest.status,
      estimatedCost: Number(newRequest.estimatedCost),
      farmer: {
        userId: farmerUser.userId,
        fullName: `${farmerUser.firstName} ${farmerUser.lastName}`.trim(),
        email: farmerUser.email,
        mobile: farmerUser.mobile,
        nic: newRequest.field.farmer.nic,
        address: newRequest.field.farmer.address,
      },
      field: {
        id: newRequest.field.id,
        fieldName: newRequest.field.fieldName,
        cropType: newRequest.field.cropType,
        area: Number(newRequest.field.area),
        district: newRequest.field.district,
        province: newRequest.field.province,
        city: newRequest.field.city,
        village: newRequest.field.village,
      },
      assignedPilot: null,
      mission: null,
      createdAt: newRequest.createdAt,
      updatedAt: newRequest.updatedAt,
    };
  }

  /**
   * 2. GET ALL SERVICE REQUESTS (Cursor or Offset Pagination)
   */
  public static async getAllServiceRequests(
    query: ServiceRequestQueryDTO,
    requestUser?: JwtPayload
  ): Promise<PaginatedServiceRequestsResponseDTO | CursorPaginatedServiceRequestsResponseDTO> {
    if (!requestUser) {
      throw AppError.unauthorized("Authentication required.");
    }

    // Keyset / Cursor Pagination branch
    if (query.cursor !== undefined || (query.take !== undefined && query.page === undefined)) {
      return this.getServiceRequestsCursor(query, requestUser);
    }

    // Standard Offset Pagination branch
    const { page, limit, skip } = getPaginationOffsets(query.page, query.limit);

    const userRole = requestUser.role.toLowerCase();

    // Base filter according to RBAC
    const whereClause: any = {};

    if (userRole === "farmer") {
      whereClause.field = {
        farmerId: requestUser.userId,
      };
    } else if (userRole === "pilot") {
      whereClause.missions = {
        some: {
          pilotId: requestUser.userId,
        },
      };
    } else if (userRole === "admin") {
      if (query.farmerId) {
        whereClause.field = {
          farmerId: Number(query.farmerId),
        };
      }
    }

    if (query.status) {
      whereClause.status = query.status as RequestStatus;
    }

    if (query.priority) {
      whereClause.priority = query.priority as RequestPriority;
    }

    if (query.serviceType) {
      whereClause.serviceType = query.serviceType as ServiceType;
    }

    if (query.fieldId) {
      whereClause.fieldId = Number(query.fieldId);
    }

    if (query.startDate || query.endDate) {
      whereClause.preferredDate = {};
      if (query.startDate) {
        whereClause.preferredDate.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        whereClause.preferredDate.lte = new Date(query.endDate);
      }
    }

    if (query.search && query.search.trim() !== "") {
      const searchTerm = query.search.trim();
      whereClause.OR = [
        { requestCode: { contains: searchTerm, mode: "insensitive" } },
        {
          field: {
            OR: [
              { fieldName: { contains: searchTerm, mode: "insensitive" } },
              { cropType: { contains: searchTerm, mode: "insensitive" } },
              { district: { contains: searchTerm, mode: "insensitive" } },
              {
                farmer: {
                  user: {
                    OR: [
                      { firstName: { contains: searchTerm, mode: "insensitive" } },
                      { lastName: { contains: searchTerm, mode: "insensitive" } },
                      { mobile: { contains: searchTerm, mode: "insensitive" } },
                    ],
                  },
                },
              },
            ],
          },
        },
      ];
    }

    // Dynamic sorting
    const sortBy = query.sortBy || "createdAt";
    const sortOrder = query.sortOrder || "desc";
    const orderBy: any = { [sortBy]: sortOrder };

    // Base query for summary counts (scoped by user permissions)
    const baseScopeWhere =
      userRole === "farmer"
        ? { field: { farmerId: requestUser.userId } }
        : userRole === "pilot"
        ? { missions: { some: { pilotId: requestUser.userId } } }
        : {};

    const [total, requests, summaryCounts] = await Promise.all([
      prisma.serviceRequest.count({ where: whereClause }),
      prisma.serviceRequest.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy,
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
                      email: true,
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
      }),
      prisma.serviceRequest.groupBy({
        by: ["status"],
        where: baseScopeWhere,
        _count: { status: true },
      }),
    ]);

    let totalPending = 0;
    let totalAssigned = 0;
    let totalInProgress = 0;
    let totalCompleted = 0;
    let totalCancelled = 0;

    for (const sc of summaryCounts) {
      if (sc.status === RequestStatus.PENDING) totalPending = sc._count.status;
      if (sc.status === RequestStatus.ASSIGNED) totalAssigned = sc._count.status;
      if (sc.status === RequestStatus.IN_PROGRESS) totalInProgress = sc._count.status;
      if (sc.status === RequestStatus.COMPLETED) totalCompleted = sc._count.status;
      if (sc.status === RequestStatus.CANCELLED) totalCancelled = sc._count.status;
    }

    const items: ServiceRequestListItemDTO[] = requests.map((req) => {
      const farmerUser = req.field.farmer.user;
      const latestMission = req.missions[0] || null;
      const assignedPilot =
        latestMission && latestMission.pilot
          ? {
              userId: latestMission.pilot.userId,
              fullName: `${latestMission.pilot.user.firstName} ${latestMission.pilot.user.lastName}`.trim(),
              mobile: latestMission.pilot.user.mobile,
              licenceNumber: latestMission.pilot.licenceNumber,
              status: latestMission.pilot.status,
            }
          : null;

      return {
        requestId: req.requestId,
        requestCode: req.requestCode,
        serviceType: req.serviceType,
        preferredDate: req.preferredDate,
        priority: req.priority,
        status: req.status,
        estimatedCost: Number(req.estimatedCost),
        farmer: {
          userId: farmerUser.userId,
          fullName: `${farmerUser.firstName} ${farmerUser.lastName}`.trim(),
          email: farmerUser.email,
          mobile: farmerUser.mobile,
          nic: req.field.farmer.nic,
          address: req.field.farmer.address,
        },
        field: {
          id: req.field.id,
          fieldName: req.field.fieldName,
          cropType: req.field.cropType,
          area: Number(req.field.area),
          district: req.field.district,
          province: req.field.province,
          city: req.field.city,
          village: req.field.village,
        },
        assignedPilot,
        mission: latestMission
          ? {
              missionId: latestMission.missionId,
              status: latestMission.status,
              startedAt: latestMission.startedAt,
              completedAt: latestMission.completedAt,
            }
          : null,
        createdAt: req.createdAt,
        updatedAt: req.updatedAt,
      };
    });

    const pagination = buildPaginationMeta(total, page, limit);

    return {
      requests: items,
      summary: {
        totalPending,
        totalAssigned,
        totalInProgress,
        totalCompleted,
        totalCancelled,
      },
      pagination,
    };
  }

  /**
   * Keyset / Cursor-Based Pagination for High-Performance Scalable Access
   */
  public static async getServiceRequestsCursor(
    query: ServiceRequestQueryDTO,
    requestUser?: JwtPayload
  ): Promise<CursorPaginatedServiceRequestsResponseDTO> {
    if (!requestUser) {
      throw AppError.unauthorized("Authentication required.");
    }

    const limit = Math.min(Math.max(query.take || query.limit || 20, 1), 100);
    const isForward = query.direction !== "backward";
    const userRole = requestUser.role.toLowerCase();

    // Base filter according to RBAC
    const whereClause: any = {};

    if (userRole === "farmer") {
      whereClause.field = {
        farmerId: requestUser.userId,
      };
    } else if (userRole === "pilot") {
      whereClause.missions = {
        some: {
          pilotId: requestUser.userId,
        },
      };
    } else if (userRole === "admin") {
      if (query.farmerId) {
        whereClause.field = {
          farmerId: Number(query.farmerId),
        };
      }
    }

    if (query.status) {
      whereClause.status = query.status as RequestStatus;
    }

    if (query.priority) {
      whereClause.priority = query.priority as RequestPriority;
    }

    if (query.serviceType) {
      whereClause.serviceType = query.serviceType as ServiceType;
    }

    if (query.fieldId) {
      whereClause.fieldId = Number(query.fieldId);
    }

    if (query.startDate || query.endDate) {
      whereClause.preferredDate = {};
      if (query.startDate) {
        whereClause.preferredDate.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        whereClause.preferredDate.lte = new Date(query.endDate);
      }
    }

    if (query.search && query.search.trim() !== "") {
      const searchTerm = query.search.trim();
      whereClause.OR = [
        { requestCode: { contains: searchTerm, mode: "insensitive" } },
        {
          field: {
            OR: [
              { fieldName: { contains: searchTerm, mode: "insensitive" } },
              { cropType: { contains: searchTerm, mode: "insensitive" } },
              { district: { contains: searchTerm, mode: "insensitive" } },
              {
                farmer: {
                  user: {
                    OR: [
                      { firstName: { contains: searchTerm, mode: "insensitive" } },
                      { lastName: { contains: searchTerm, mode: "insensitive" } },
                      { mobile: { contains: searchTerm, mode: "insensitive" } },
                    ],
                  },
                },
              },
            ],
          },
        },
      ];
    }

    // Keyset cursor condition (createdAt, requestId)
    if (query.cursor) {
      const decoded = decodeCursor(query.cursor);
      if (decoded) {
        if (isForward) {
          whereClause.AND = [
            ...(whereClause.AND || []),
            {
              OR: [
                { createdAt: { lt: decoded.createdAt } },
                {
                  createdAt: decoded.createdAt,
                  requestId: { lt: decoded.id },
                },
              ],
            },
          ];
        } else {
          whereClause.AND = [
            ...(whereClause.AND || []),
            {
              OR: [
                { createdAt: { gt: decoded.createdAt } },
                {
                  createdAt: decoded.createdAt,
                  requestId: { gt: decoded.id },
                },
              ],
            },
          ];
        }
      }
    }

    // Base query for summary counts (scoped by user permissions)
    const baseScopeWhere =
      userRole === "farmer"
        ? { field: { farmerId: requestUser.userId } }
        : userRole === "pilot"
        ? { missions: { some: { pilotId: requestUser.userId } } }
        : {};

    const [requests, summaryCounts] = await Promise.all([
      prisma.serviceRequest.findMany({
        where: whereClause,
        take: limit + 1, // Fetch limit + 1 to detect next/previous page
        orderBy: [
          { createdAt: isForward ? "desc" : "asc" },
          { requestId: isForward ? "desc" : "asc" },
        ],
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
                      email: true,
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
      }),
      prisma.serviceRequest.groupBy({
        by: ["status"],
        where: baseScopeWhere,
        _count: { status: true },
      }),
    ]);

    let totalPending = 0;
    let totalAssigned = 0;
    let totalInProgress = 0;
    let totalCompleted = 0;
    let totalCancelled = 0;

    for (const sc of summaryCounts) {
      if (sc.status === RequestStatus.PENDING) totalPending = sc._count.status;
      if (sc.status === RequestStatus.ASSIGNED) totalAssigned = sc._count.status;
      if (sc.status === RequestStatus.IN_PROGRESS) totalInProgress = sc._count.status;
      if (sc.status === RequestStatus.COMPLETED) totalCompleted = sc._count.status;
      if (sc.status === RequestStatus.CANCELLED) totalCancelled = sc._count.status;
    }

    const hasExtraRow = requests.length > limit;
    const rawResultRows = hasExtraRow ? requests.slice(0, limit) : requests;
    if (!isForward) {
      rawResultRows.reverse();
    }

    const items: ServiceRequestListItemDTO[] = rawResultRows.map((req) => {
      const farmerUser = req.field.farmer.user;
      const latestMission = req.missions[0] || null;
      const assignedPilot =
        latestMission && latestMission.pilot
          ? {
              userId: latestMission.pilot.userId,
              fullName: `${latestMission.pilot.user.firstName} ${latestMission.pilot.user.lastName}`.trim(),
              mobile: latestMission.pilot.user.mobile,
              licenceNumber: latestMission.pilot.licenceNumber,
              status: latestMission.pilot.status,
            }
          : null;

      return {
        requestId: req.requestId,
        requestCode: req.requestCode,
        serviceType: req.serviceType,
        preferredDate: req.preferredDate,
        priority: req.priority,
        status: req.status,
        estimatedCost: Number(req.estimatedCost),
        farmer: {
          userId: farmerUser.userId,
          fullName: `${farmerUser.firstName} ${farmerUser.lastName}`.trim(),
          email: farmerUser.email,
          mobile: farmerUser.mobile,
          nic: req.field.farmer.nic,
          address: req.field.farmer.address,
        },
        field: {
          id: req.field.id,
          fieldName: req.field.fieldName,
          cropType: req.field.cropType,
          area: Number(req.field.area),
          district: req.field.district,
          province: req.field.province,
          city: req.field.city,
          village: req.field.village,
        },
        assignedPilot,
        mission: latestMission
          ? {
              missionId: latestMission.missionId,
              status: latestMission.status,
              startedAt: latestMission.startedAt,
              completedAt: latestMission.completedAt,
            }
          : null,
        createdAt: req.createdAt,
        updatedAt: req.updatedAt,
      };
    });

    const startCursor =
      items.length > 0
        ? encodeCursor({
            id: items[0].requestId,
            createdAt: items[0].createdAt,
          })
        : null;

    const endCursor =
      items.length > 0
        ? encodeCursor({
            id: items[items.length - 1].requestId,
            createdAt: items[items.length - 1].createdAt,
          })
        : null;

    const pageInfo = {
      hasNextPage: isForward ? hasExtraRow : !!query.cursor,
      hasPreviousPage: isForward ? !!query.cursor : hasExtraRow,
      startCursor,
      endCursor,
      count: items.length,
    };

    return {
      requests: items,
      summary: {
        totalPending,
        totalAssigned,
        totalInProgress,
        totalCompleted,
        totalCancelled,
      },
      pageInfo,
    };
  }

  /**
   * 3. GET SINGLE SERVICE REQUEST BY ID (Detailed View with Farmer & Mission info)
   */
  public static async getServiceRequestById(
    requestId: number,
    requestUser?: JwtPayload
  ): Promise<ServiceRequestDetailDTO> {
    if (!requestUser) {
      throw AppError.unauthorized("Authentication required.");
    }

    const request = await prisma.serviceRequest.findUnique({
      where: { requestId },
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
                    email: true,
                    mobile: true,
                  },
                },
              },
            },
          },
        },
        missions: {
          include: {
            assignedByUser: {
              select: {
                userId: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
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
            payment: true,
            review: true,
          },
        },
      },
    });

    if (!request) {
      throw AppError.notFound(`Service request with ID ${requestId} not found.`);
    }

    // IDOR Protection: Farmer can only access own request; Pilot can access assigned request
    const userRole = requestUser.role.toLowerCase();
    if (userRole === "farmer" && request.field.farmerId !== requestUser.userId) {
      throw AppError.forbidden("Access denied. You can only view your own service requests.");
    }
    if (
      userRole === "pilot" &&
      !request.missions.some((m) => m.pilotId === requestUser.userId)
    ) {
      throw AppError.forbidden("Access denied. You can only view service requests assigned to you.");
    }

    const farmerUser = request.field.farmer.user;

    return {
      requestId: request.requestId,
      requestCode: request.requestCode,
      serviceType: request.serviceType,
      preferredDate: request.preferredDate,
      priority: request.priority,
      status: request.status,
      estimatedCost: Number(request.estimatedCost),
      farmer: {
        userId: farmerUser.userId,
        fullName: `${farmerUser.firstName} ${farmerUser.lastName}`.trim(),
        email: farmerUser.email,
        mobile: farmerUser.mobile,
        nic: request.field.farmer.nic,
        address: request.field.farmer.address,
        memberSince: request.field.farmer.memberSince,
      },
      field: {
        id: request.field.id,
        fieldName: request.field.fieldName,
        cropType: request.field.cropType,
        area: Number(request.field.area),
        locationCoordinates: request.field.locationCoordinates,
        district: request.field.district,
        province: request.field.province,
        city: request.field.city,
        village: request.field.village,
        createdAt: request.field.createdAt,
      },
      missions: request.missions.map((m) => ({
        missionId: m.missionId,
        status: m.status,
        startedAt: m.startedAt,
        completedAt: m.completedAt,
        areaSpread: m.areaSpread ? Number(m.areaSpread) : null,
        pilotNotes: m.pilotNotes,
        assignedBy: m.assignedByUser
          ? {
              userId: m.assignedByUser.userId,
              fullName: `${m.assignedByUser.firstName} ${m.assignedByUser.lastName}`.trim(),
              email: m.assignedByUser.email,
            }
          : null,
        pilot: m.pilot
          ? {
              userId: m.pilot.userId,
              fullName: `${m.pilot.user.firstName} ${m.pilot.user.lastName}`.trim(),
              mobile: m.pilot.user.mobile,
              licenceNumber: m.pilot.licenceNumber,
              status: m.pilot.status,
              ratings: m.pilot.ratings ? Number(m.pilot.ratings) : null,
            }
          : null,
        payment: m.payment
          ? {
              paymentId: m.payment.paymentId,
              totalAmount: Number(m.payment.totalAmount),
              companyCommission: Number(m.payment.companyCommission),
              pilotEarnings: Number(m.payment.pilotEarnings),
              paymentStatus: m.payment.paymentStatus,
              paymentMethod: m.payment.paymentMethod,
              payoutStatus: m.payment.payoutStatus,
              paidAt: m.payment.paidAt,
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
      })),
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
    };
  }

  /**
   * 4. ASSIGN PILOT TO SERVICE REQUEST & SCHEDULE MISSION (Admin Only)
   */
  public static async assignPilot(
    requestId: number,
    adminUserId: number,
    dto: AssignPilotDTO
  ): Promise<ServiceRequestDetailDTO> {
    // 1. Verify service request exists and is in assignable state
    const serviceRequest = await prisma.serviceRequest.findUnique({
      where: { requestId },
      include: { missions: true },
    });

    if (!serviceRequest) {
      throw AppError.notFound(`Service request with ID ${requestId} not found.`);
    }

    if (
      serviceRequest.status === RequestStatus.COMPLETED ||
      serviceRequest.status === RequestStatus.CANCELLED ||
      serviceRequest.status === RequestStatus.REJECTED
    ) {
      throw AppError.badRequest(
        `Cannot assign pilot. Service request is already in '${serviceRequest.status}' state.`
      );
    }

    // 2. Verify pilot exists and is not suspended
    const pilot = await prisma.user.findFirst({
      where: {
        userId: dto.pilotId,
        role: { name: "Pilot" },
      },
      include: { pilotProfile: true },
    });

    if (!pilot || !pilot.pilotProfile) {
      throw AppError.notFound(`Pilot with ID ${dto.pilotId} not found.`);
    }

    if (pilot.pilotProfile.status === PilotStatus.SUSPENDED) {
      throw AppError.badRequest("Cannot assign a suspended pilot to a mission.");
    }

    // 3. Atomic state transition: Schedule mission and update request status to ASSIGNED
    await prisma.$transaction(async (tx) => {
      const existingMission = serviceRequest.missions[0];

      if (existingMission) {
        // Reassign existing mission
        await tx.mission.update({
          where: { missionId: existingMission.missionId },
          data: {
            pilotId: dto.pilotId,
            assignedBy: adminUserId,
            status: MissionStatus.SCHEDULED,
            pilotNotes: dto.pilotNotes || existingMission.pilotNotes,
          },
        });
      } else {
        // Create new mission record
        await tx.mission.create({
          data: {
            requestId,
            pilotId: dto.pilotId,
            assignedBy: adminUserId,
            status: MissionStatus.SCHEDULED,
            pilotNotes: dto.pilotNotes || null,
          },
        });
      }

      await tx.serviceRequest.update({
        where: { requestId },
        data: {
          status: RequestStatus.ASSIGNED,
        },
      });
    });

    logActivity({
      userId: adminUserId,
      action: "PILOT_ASSIGNED",
      entityType: "SERVICE_REQUEST",
      entityId: requestId,
      details: `Pilot ${pilot.firstName} ${pilot.lastName} (${pilot.pilotProfile.licenceNumber}) assigned to request ${serviceRequest.requestCode}.`,
    });

    return this.getServiceRequestById(requestId, {
      userId: adminUserId,
      email: "admin@fertilizer.com",
      role: "Admin",
    });
  }

  /**
   * 5. UPDATE SERVICE REQUEST STATUS (Admin, or Farmer for Cancellation)
   */
  public static async updateStatus(
    requestId: number,
    dto: UpdateServiceRequestStatusDTO,
    requestUser?: JwtPayload
  ): Promise<ServiceRequestDetailDTO> {
    if (!requestUser) {
      throw AppError.unauthorized("Authentication required.");
    }

    const serviceRequest = await prisma.serviceRequest.findUnique({
      where: { requestId },
      include: { field: true },
    });

    if (!serviceRequest) {
      throw AppError.notFound(`Service request with ID ${requestId} not found.`);
    }

    const userRole = requestUser.role.toLowerCase();

    // Farmers can only cancel their own PENDING requests
    if (userRole === "farmer") {
      if (serviceRequest.field.farmerId !== requestUser.userId) {
        throw AppError.forbidden("Access denied. You can only update your own service requests.");
      }
      if (dto.status !== RequestStatus.CANCELLED) {
        throw AppError.forbidden("Farmers are only permitted to cancel pending requests.");
      }
      if (serviceRequest.status !== RequestStatus.PENDING) {
        throw AppError.badRequest("Only PENDING requests can be cancelled by the farmer.");
      }
    }

    await prisma.serviceRequest.update({
      where: { requestId },
      data: {
        status: dto.status as RequestStatus,
      },
    });

    logActivity({
      userId: requestUser.userId,
      action: `REQUEST_${dto.status}`,
      entityType: "SERVICE_REQUEST",
      entityId: requestId,
      details: `Service request ${serviceRequest.requestCode} status updated to ${dto.status} by ${requestUser.role}.`,
    });

    return this.getServiceRequestById(requestId, requestUser);
  }
}
