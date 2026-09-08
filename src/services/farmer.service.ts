import prisma from "../config/prisma";
import {
  FarmerQueryDTO,
  FarmerListItemDTO,
  FarmerProfileDetailDTO,
  FarmerFieldDTO,
  CreateFieldDTO,
  FarmerFieldsQueryDTO,
  FarmerServiceHistoryQueryDTO,
  FarmerServiceRequestDTO,
  FarmerPaymentQueryDTO,
  FarmerPaymentsResponseDTO,
  FarmerPaymentItemDTO,
  PaginatedResult,
} from "../types/farmer.types";
import { JwtPayload } from "../types/auth.types";
import { AppError } from "../utils/AppError";
import { getPaginationOffsets, buildPaginationMeta } from "../utils/pagination";

export class FarmerService {
  /**
   * CSO Access Control: IDOR (Insecure Direct Object Reference) Protection
   * Admins have universal read access; Farmers are restricted strictly to their own ID.
   */
  public static validateFarmerAccess(
    requestUser: JwtPayload | undefined,
    targetFarmerId: number
  ): void {
    if (!requestUser) {
      throw AppError.unauthorized("Authentication required.");
    }

    const userRole = requestUser.role.toLowerCase();

    if (userRole === "admin") {
      return; // Admin possesses full clearance
    }

    if (userRole === "farmer") {
      if (requestUser.userId !== targetFarmerId) {
        throw AppError.forbidden(
          "Access denied. You are only authorized to access your own farmer records."
        );
      }
      return;
    }

    throw AppError.forbidden("Access restricted to Admins or the target Farmer.");
  }

  /**
   * Helper: Ensure the target user exists and has a Farmer role
   */
  public static async validateFarmerExists(farmerId: number): Promise<void> {
    const farmer = await prisma.user.findFirst({
      where: {
        userId: farmerId,
        role: {
          name: "Farmer",
        },
      },
      select: { userId: true },
    });

    if (!farmer) {
      throw AppError.notFound(`Farmer with ID ${farmerId} does not exist.`);
    }
  }

  /**
   * 1. GET ALL FARMERS (Admin Only - Paginated, Searchable, Sortable)
   */
  public static async getAllFarmers(
    query: FarmerQueryDTO
  ): Promise<PaginatedResult<FarmerListItemDTO>> {
    const { page, limit, skip } = getPaginationOffsets(query.page, query.limit);

    const { search, sortBy = "createdAt", sortOrder = "desc" } = query;

    // Secure search filters with SQL/NoSQL injection defense
    const whereClause: any = {
      role: {
        name: "Farmer",
      },
    };

    if (search && search.trim() !== "") {
      const searchTerm = search.trim();
      whereClause.OR = [
        { firstName: { contains: searchTerm, mode: "insensitive" } },
        { lastName: { contains: searchTerm, mode: "insensitive" } },
        { email: { contains: searchTerm, mode: "insensitive" } },
        { mobile: { contains: searchTerm, mode: "insensitive" } },
        {
          farmerProfile: {
            OR: [
              { nic: { contains: searchTerm, mode: "insensitive" } },
              { address: { contains: searchTerm, mode: "insensitive" } },
            ],
          },
        },
      ];
    }

    // Whitelisted dynamic sorting
    let orderBy: any = { createdAt: sortOrder };
    if (sortBy === "name") {
      orderBy = { firstName: sortOrder };
    } else if (sortBy === "email") {
      orderBy = { email: sortOrder };
    } else if (sortBy === "memberSince") {
      orderBy = { farmerProfile: { memberSince: sortOrder } };
    }

    // Parallel fetch ensuring zero sensitive data (like password) is exposed
    const [total, farmers] = await Promise.all([
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
          farmerProfile: {
            select: {
              nic: true,
              address: true,
              memberSince: true,
              fields: {
                select: {
                  area: true,
                  _count: {
                    select: { serviceRequests: true },
                  },
                },
              },
            },
          },
        },
      }),
    ]);

    const items: FarmerListItemDTO[] = farmers.map((farmer) => {
      const profile = farmer.farmerProfile;
      const fields = profile?.fields || [];
      const totalFields = fields.length;
      const totalArea = fields.reduce(
        (sum, f) => sum + (f.area ? Number(f.area) : 0),
        0
      );
      const totalServiceRequests = fields.reduce(
        (sum, f) => sum + (f._count?.serviceRequests || 0),
        0
      );

      return {
        userId: farmer.userId,
        email: farmer.email,
        fullName: `${farmer.firstName} ${farmer.lastName}`.trim(),
        firstName: farmer.firstName,
        lastName: farmer.lastName,
        mobile: farmer.mobile,
        nic: profile?.nic || null,
        address: profile?.address || null,
        memberSince: profile?.memberSince || farmer.createdAt,
        totalFields,
        totalArea: Number(totalArea.toFixed(2)),
        totalServiceRequests,
        createdAt: farmer.createdAt,
        updatedAt: farmer.updatedAt,
      };
    });

    const pagination = buildPaginationMeta(total, page, limit);

    return { items, pagination };
  }

  /**
   * 2. GET SINGLE FARMER PROFILE DETAILS & HIGH-LEVEL STATS
   */
  public static async getFarmerById(
    farmerId: number,
    requestUser?: JwtPayload
  ): Promise<FarmerProfileDetailDTO> {
    if (requestUser) {
      this.validateFarmerAccess(requestUser, farmerId);
    }
    await this.validateFarmerExists(farmerId);

    const user = await prisma.user.findUnique({
      where: { userId: farmerId },
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
        farmerProfile: {
          select: {
            nic: true,
            address: true,
            memberSince: true,
            fields: {
              select: {
                area: true,
                serviceRequests: {
                  select: {
                    requestId: true,
                    status: true,
                    missions: {
                      select: {
                        payment: {
                          select: {
                            totalAmount: true,
                            paymentStatus: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            reviews: {
              select: { rating: true },
            },
          },
        },
      },
    });

    if (!user || !user.farmerProfile) {
      throw AppError.notFound(`Farmer profile for ID ${farmerId} not found.`);
    }

    const fields = user.farmerProfile.fields || [];
    const reviews = user.farmerProfile.reviews || [];

    const totalFields = fields.length;
    const totalAreaAcres = fields.reduce(
      (sum, f) => sum + (f.area ? Number(f.area) : 0),
      0
    );

    let totalServiceRequests = 0;
    let completedRequests = 0;
    let pendingRequests = 0;
    let totalSpent = 0;

    for (const field of fields) {
      for (const req of field.serviceRequests) {
        totalServiceRequests++;
        if (req.status === "COMPLETED") completedRequests++;
        if (req.status === "PENDING") pendingRequests++;

        for (const m of req.missions) {
          if (m.payment && m.payment.paymentStatus === "COMPLETED") {
            totalSpent += Number(m.payment.totalAmount || 0);
          }
        }
      }
    }

    const averageRatingGiven =
      reviews.length > 0
        ? Number(
            (
              reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
            ).toFixed(1)
          )
        : null;

    return {
      userId: user.userId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: `${user.firstName} ${user.lastName}`.trim(),
      mobile: user.mobile,
      nic: user.farmerProfile.nic,
      address: user.farmerProfile.address,
      memberSince: user.farmerProfile.memberSince,
      role: user.role.name,
      stats: {
        totalFields,
        totalAreaAcres: Number(totalAreaAcres.toFixed(2)),
        totalServiceRequests,
        completedRequests,
        pendingRequests,
        totalSpent: Number(totalSpent.toFixed(2)),
        averageRatingGiven,
      },
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  /**
   * 3. GET FARMER'S AGRICULTURAL FIELDS
   */
  public static async getFarmerFields(
    farmerId: number,
    query: FarmerFieldsQueryDTO,
    requestUser?: JwtPayload
  ): Promise<FarmerFieldDTO[]> {
    if (requestUser) {
      this.validateFarmerAccess(requestUser, farmerId);
    }
    await this.validateFarmerExists(farmerId);

    const whereClause: any = {
      farmerId,
    };

    if (query.cropType) {
      whereClause.cropType = { contains: query.cropType, mode: "insensitive" };
    }
    if (query.district) {
      whereClause.district = { contains: query.district, mode: "insensitive" };
    }
    if (query.province) {
      whereClause.province = { contains: query.province, mode: "insensitive" };
    }

    const fields = await prisma.field.findMany({
      where: whereClause,
      include: {
        _count: {
          select: { serviceRequests: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return fields.map((f) => ({
      id: f.id,
      farmerId: f.farmerId,
      fieldName: f.fieldName,
      cropType: f.cropType,
      locationCoordinates: f.locationCoordinates,
      area: Number(f.area),
      province: f.province,
      district: f.district,
      city: f.city,
      village: f.village,
      totalRequests: f._count.serviceRequests,
      createdAt: f.createdAt,
      updatedAt: f.updatedAt,
    }));
  }

  /**
   * 3.1 CREATE AGRICULTURAL FIELD FOR A FARMER
   * Access: Admin (can add field for any farmer) or Farmer (can add field for their own account only)
   */
  public static async createField(
    farmerId: number,
    dto: CreateFieldDTO,
    requestUser?: JwtPayload
  ): Promise<FarmerFieldDTO> {
    if (requestUser) {
      this.validateFarmerAccess(requestUser, farmerId);
    }
    await this.validateFarmerExists(farmerId);

    const newField = await prisma.field.create({
      data: {
        farmerId,
        fieldName: dto.fieldName,
        cropType: dto.cropType,
        area: dto.area,
        locationCoordinates: dto.locationCoordinates as any,
        province: dto.province,
        district: dto.district,
        city: dto.city,
        village: dto.village,
      },
      include: {
        _count: {
          select: { serviceRequests: true },
        },
      },
    });

    return {
      id: newField.id,
      farmerId: newField.farmerId,
      fieldName: newField.fieldName,
      cropType: newField.cropType,
      locationCoordinates: newField.locationCoordinates,
      area: Number(newField.area),
      province: newField.province,
      district: newField.district,
      city: newField.city,
      village: newField.village,
      totalRequests: newField._count.serviceRequests,
      createdAt: newField.createdAt,
      updatedAt: newField.updatedAt,
    };
  }

  /**
   * 4. GET FARMER'S SERVICE & MISSION HISTORY
   */
  public static async getFarmerServiceHistory(
    farmerId: number,
    query: FarmerServiceHistoryQueryDTO,
    requestUser?: JwtPayload
  ): Promise<PaginatedResult<FarmerServiceRequestDTO>> {
    if (requestUser) {
      this.validateFarmerAccess(requestUser, farmerId);
    }
    await this.validateFarmerExists(farmerId);

    const { page, limit, skip } = getPaginationOffsets(query.page, query.limit);

    const whereClause: any = {
      field: {
        farmerId,
      },
    };

    if (query.status) {
      whereClause.status = query.status;
    }
    if (query.priority) {
      whereClause.priority = query.priority;
    }
    if (query.serviceType) {
      whereClause.serviceType = query.serviceType;
    }
    if (query.fieldId) {
      whereClause.fieldId = Number(query.fieldId);
    }

    const [total, requests] = await Promise.all([
      prisma.serviceRequest.count({ where: whereClause }),
      prisma.serviceRequest.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          field: true,
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
              payment: {
                select: {
                  paymentId: true,
                  totalAmount: true,
                  paymentStatus: true,
                  paymentMethod: true,
                  paidAt: true,
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
          },
        },
      }),
    ]);

    const items: FarmerServiceRequestDTO[] = requests.map((req) => ({
      requestId: req.requestId,
      requestCode: req.requestCode,
      fieldId: req.fieldId,
      fieldName: req.field.fieldName,
      cropType: req.field.cropType,
      fieldLocation: {
        district: req.field.district,
        province: req.field.province,
        city: req.field.city,
        village: req.field.village,
      },
      serviceType: req.serviceType,
      preferredDate: req.preferredDate,
      priority: req.priority,
      status: req.status,
      estimatedCost: Number(req.estimatedCost),
      createdAt: req.createdAt,
      updatedAt: req.updatedAt,
      missions: req.missions.map((m) => ({
        missionId: m.missionId,
        status: m.status,
        startedAt: m.startedAt,
        completedAt: m.completedAt,
        areaSpread: m.areaSpread ? Number(m.areaSpread) : null,
        pilotNotes: m.pilotNotes,
        pilot: m.pilot
          ? {
              userId: m.pilot.userId,
              name: `${m.pilot.user.firstName} ${m.pilot.user.lastName}`.trim(),
              mobile: m.pilot.user.mobile,
              licenceNumber: m.pilot.licenceNumber,
            }
          : null,
        payment: m.payment
          ? {
              paymentId: m.payment.paymentId,
              totalAmount: Number(m.payment.totalAmount),
              paymentStatus: m.payment.paymentStatus,
              paymentMethod: m.payment.paymentMethod,
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
      })),
    }));

    const pagination = buildPaginationMeta(total, page, limit);

    return { items, pagination };
  }

  /**
   * 5. GET FARMER'S BILLING & PAYMENT HISTORY
   */
  public static async getFarmerPayments(
    farmerId: number,
    query: FarmerPaymentQueryDTO,
    requestUser?: JwtPayload
  ): Promise<FarmerPaymentsResponseDTO> {
    if (requestUser) {
      this.validateFarmerAccess(requestUser, farmerId);
    }
    await this.validateFarmerExists(farmerId);

    const { page, limit, skip } = getPaginationOffsets(query.page, query.limit);

    const baseWhere: any = {
      mission: {
        serviceRequest: {
          field: {
            farmerId,
          },
        },
      },
    };

    const filteredWhere: any = { ...baseWhere };

    if (query.paymentStatus) {
      filteredWhere.paymentStatus = query.paymentStatus;
    }
    if (query.paymentMethod) {
      filteredWhere.paymentMethod = query.paymentMethod;
    }

    const [total, payments, paymentStatusGroups, totalTransactions] = await Promise.all([
      prisma.payment.count({ where: filteredWhere }),
      prisma.payment.findMany({
        where: filteredWhere,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          paymentId: true,
          transactionReference: true,
          totalAmount: true,
          paymentMethod: true,
          paymentStatus: true,
          paidAt: true,
          createdAt: true,
          mission: {
            select: {
              missionId: true,
              status: true,
              serviceRequest: {
                select: {
                  requestId: true,
                  requestCode: true,
                  serviceType: true,
                  preferredDate: true,
                  field: {
                    select: {
                      id: true,
                      fieldName: true,
                      cropType: true,
                      district: true,
                    },
                  },
                },
              },
              pilot: {
                select: {
                  userId: true,
                  user: {
                    select: {
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
      prisma.payment.groupBy({
        by: ["paymentStatus"],
        where: baseWhere,
        _sum: {
          totalAmount: true,
        },
      }),
      prisma.payment.count({
        where: baseWhere,
      }),
    ]);

    let totalPaid = 0;
    let totalPending = 0;

    for (const g of paymentStatusGroups) {
      const amt = Number(g._sum.totalAmount || 0);
      if (g.paymentStatus === "COMPLETED") {
        totalPaid = amt;
      } else if (g.paymentStatus === "PENDING") {
        totalPending = amt;
      }
    }

    const items: FarmerPaymentItemDTO[] = payments.map((p) => ({
      paymentId: p.paymentId,
      transactionReference: p.transactionReference,
      totalAmount: Number(p.totalAmount),
      paymentMethod: p.paymentMethod,
      paymentStatus: p.paymentStatus,
      paidAt: p.paidAt,
      createdAt: p.createdAt,
      serviceRequest: {
        requestId: p.mission.serviceRequest.requestId,
        requestCode: p.mission.serviceRequest.requestCode,
        serviceType: p.mission.serviceRequest.serviceType,
        preferredDate: p.mission.serviceRequest.preferredDate,
      },
      field: {
        fieldId: p.mission.serviceRequest.field.id,
        fieldName: p.mission.serviceRequest.field.fieldName,
        cropType: p.mission.serviceRequest.field.cropType,
        district: p.mission.serviceRequest.field.district,
      },
      mission: {
        missionId: p.mission.missionId,
        status: p.mission.status,
        pilot: p.mission.pilot
          ? {
              userId: p.mission.pilot.userId,
              name: `${p.mission.pilot.user.firstName} ${p.mission.pilot.user.lastName}`.trim(),
            }
          : null,
      },
    }));

    const pagination = buildPaginationMeta(total, page, limit);

    return {
      payments: items,
      summary: {
        totalPaid: Number(totalPaid.toFixed(2)),
        totalPending: Number(totalPending.toFixed(2)),
        totalTransactions,
      },
      pagination,
    };
  }
}
