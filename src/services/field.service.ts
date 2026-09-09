import prisma from "../config/prisma";
import {
  FieldQueryDTO,
  FieldDetailDTO,
  CreateFieldInputDTO,
  UpdateFieldInputDTO,
  PaginatedFieldsResponseDTO,
} from "../types/field.types";
import { JwtPayload } from "../types/auth.types";
import { AppError } from "../utils/AppError";
import { getPaginationOffsets, buildPaginationMeta } from "../utils/pagination";
import { RequestStatus, MissionStatus } from "../generated/prisma/enums";

export class FieldService {
  /**
   * Helper: Map Prisma field with relations to FieldDetailDTO
   */
  private static mapFieldDetail(f: any): FieldDetailDTO {
    const serviceRequests = f.serviceRequests || [];
    let activeRequests = 0;
    let completedRequests = 0;

    for (const req of serviceRequests) {
      if (
        req.status === RequestStatus.PENDING ||
        req.status === RequestStatus.ASSIGNED ||
        req.status === RequestStatus.IN_PROGRESS
      ) {
        activeRequests++;
      } else if (req.status === RequestStatus.COMPLETED) {
        completedRequests++;
      }
    }

    const totalServiceRequests =
      f._count?.serviceRequests !== undefined
        ? f._count.serviceRequests
        : serviceRequests.length;

    const user = f.farmer?.user;
    const farmerFullName = user
      ? `${user.firstName} ${user.lastName}`.trim()
      : "Unknown Farmer";

    return {
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
      totalServiceRequests,
      activeRequests,
      completedRequests,
      owner: {
        id: f.farmerId,
        userId: f.farmerId,
        fullName: farmerFullName,
        email: user?.email || "",
        mobile: user?.mobile || "",
        nic: f.farmer?.nic || null,
        address: f.farmer?.address || null,
      },
      createdAt: f.createdAt,
      updatedAt: f.updatedAt,
    };
  }

  /**
   * 1. GET ALL FIELDS (Paginated, Searchable, Filterable, Sortable)
   * Query Params: page, limit, search, farmerId, cropType, province, district.
   * Search filter checks: field_name, city, village, or related farmer name / email / mobile.
   */
  public static async getAllFields(
    query: FieldQueryDTO,
    requestUser?: JwtPayload
  ): Promise<PaginatedFieldsResponseDTO> {
    if (!requestUser) {
      throw AppError.unauthorized("Authentication required.");
    }

    const { page, limit, skip } = getPaginationOffsets(query.page, query.limit);
    const {
      search,
      cropType,
      district,
      province,
      farmerId,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = query;

    const whereClause: any = {};

    // RBAC & IDOR: Farmers strictly limited to their own fields
    const userRole = requestUser.role.toLowerCase();
    if (userRole === "farmer") {
      whereClause.farmerId = requestUser.userId;
    } else if (farmerId) {
      whereClause.farmerId = farmerId;
    }

    if (cropType && cropType.trim()) {
      whereClause.cropType = { contains: cropType.trim(), mode: "insensitive" };
    }

    if (district && district.trim()) {
      whereClause.district = { contains: district.trim(), mode: "insensitive" };
    }

    if (province && province.trim()) {
      whereClause.province = { contains: province.trim(), mode: "insensitive" };
    }

    if (search && search.trim()) {
      const term = search.trim();
      whereClause.OR = [
        { fieldName: { contains: term, mode: "insensitive" } },
        { city: { contains: term, mode: "insensitive" } },
        { village: { contains: term, mode: "insensitive" } },
        { cropType: { contains: term, mode: "insensitive" } },
        {
          farmer: {
            user: {
              OR: [
                { firstName: { contains: term, mode: "insensitive" } },
                { lastName: { contains: term, mode: "insensitive" } },
                { email: { contains: term, mode: "insensitive" } },
                { mobile: { contains: term, mode: "insensitive" } },
              ],
            },
          },
        },
      ];
    }

    const orderBy: any = {};
    if (sortBy === "fieldName") orderBy.fieldName = sortOrder;
    else if (sortBy === "area") orderBy.area = sortOrder;
    else if (sortBy === "cropType") orderBy.cropType = sortOrder;
    else orderBy.createdAt = sortOrder;

    const [total, fields] = await Promise.all([
      prisma.field.count({ where: whereClause }),
      prisma.field.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy,
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
          serviceRequests: {
            select: { status: true },
          },
          _count: {
            select: { serviceRequests: true },
          },
        },
      }),
    ]);

    const items = fields.map((f) => this.mapFieldDetail(f));
    const pagination = buildPaginationMeta(total, page, limit);

    return { fields: items, pagination };
  }

  /**
   * 2. GET FIELD BY ID
   * Access: Admin or the owner Farmer
   */
  public static async getFieldById(
    fieldId: number,
    requestUser?: JwtPayload
  ): Promise<FieldDetailDTO> {
    if (!requestUser) {
      throw AppError.unauthorized("Authentication required.");
    }

    const field = await prisma.field.findUnique({
      where: { id: fieldId },
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
        serviceRequests: {
          select: { status: true },
        },
        _count: {
          select: { serviceRequests: true },
        },
      },
    });

    if (!field) {
      throw AppError.notFound(`Field with ID ${fieldId} not found.`);
    }

    // RBAC: Check ownership if caller is Farmer
    if (
      requestUser.role.toLowerCase() === "farmer" &&
      field.farmerId !== requestUser.userId
    ) {
      throw AppError.forbidden("Access denied. You do not own this field.");
    }

    return this.mapFieldDetail(field);
  }

  /**
   * 3. GET FIELDS BY FARMER ID
   * Access: Admin or the respective Farmer
   */
  public static async getFieldsByFarmerId(
    farmerId: number,
    query: FieldQueryDTO,
    requestUser?: JwtPayload
  ): Promise<PaginatedFieldsResponseDTO> {
    return this.getAllFields({ ...query, farmerId }, requestUser);
  }

  /**
   * 4. CREATE FIELD
   * Access: Admin (for any farmerId) or Farmer (for their own account)
   * Validates target user is a FARMER.
   */
  public static async createField(
    dto: CreateFieldInputDTO,
    requestUser?: JwtPayload
  ): Promise<FieldDetailDTO> {
    if (!requestUser) {
      throw AppError.unauthorized("Authentication required.");
    }

    let targetFarmerId = dto.farmerId ?? dto.farmer_id;
    const userRole = requestUser.role.toLowerCase();

    if (userRole === "farmer") {
      targetFarmerId = requestUser.userId;
    } else if (!targetFarmerId) {
      throw AppError.badRequest("farmer_id is required.");
    }

    // Verify target user exists and role is FARMER
    const farmerUser = await prisma.user.findFirst({
      where: {
        userId: targetFarmerId,
        role: {
          name: {
            equals: "Farmer",
            mode: "insensitive",
          },
        },
      },
      include: {
        farmerProfile: true,
      },
    });

    if (!farmerUser) {
      throw AppError.badRequest(
        `User with ID ${targetFarmerId} is not a valid Farmer.`
      );
    }

    // Ensure farmer profile exists to satisfy foreign key constraints
    if (!farmerUser.farmerProfile) {
      await prisma.farmerProfile.create({
        data: {
          userId: targetFarmerId,
        },
      });
    }

    const fieldName = (dto.fieldName ?? dto.field_name)!.trim();
    const cropType = (dto.cropType ?? dto.crop_type)!.trim();
    const locationCoordinates =
      dto.locationCoordinates ?? dto.location_coordinates;

    const newField = await prisma.field.create({
      data: {
        farmerId: targetFarmerId,
        fieldName,
        cropType,
        area: dto.area,
        locationCoordinates: locationCoordinates as any,
        province: dto.province.trim(),
        district: dto.district.trim(),
        city: dto.city.trim(),
        village: dto.village.trim(),
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
        _count: {
          select: { serviceRequests: true },
        },
      },
    });

    return this.mapFieldDetail(newField);
  }

  /**
   * 5. UPDATE FIELD
   * Access: Admin or the owner Farmer
   */
  public static async updateField(
    fieldId: number,
    dto: UpdateFieldInputDTO,
    requestUser?: JwtPayload
  ): Promise<FieldDetailDTO> {
    if (!requestUser) {
      throw AppError.unauthorized("Authentication required.");
    }

    const existingField = await prisma.field.findUnique({
      where: { id: fieldId },
    });

    if (!existingField) {
      throw AppError.notFound(`Field with ID ${fieldId} not found.`);
    }

    if (
      requestUser.role.toLowerCase() === "farmer" &&
      existingField.farmerId !== requestUser.userId
    ) {
      throw AppError.forbidden("Access denied. You do not own this field.");
    }

    const fieldName = dto.fieldName ?? dto.field_name;
    const cropType = dto.cropType ?? dto.crop_type;
    const locationCoordinates =
      dto.locationCoordinates ?? dto.location_coordinates;

    const updatedField = await prisma.field.update({
      where: { id: fieldId },
      data: {
        fieldName: fieldName !== undefined ? fieldName.trim() : undefined,
        cropType: cropType !== undefined ? cropType.trim() : undefined,
        area: dto.area !== undefined ? dto.area : undefined,
        locationCoordinates:
          locationCoordinates !== undefined
            ? (locationCoordinates as any)
            : undefined,
        province:
          dto.province !== undefined ? dto.province.trim() : undefined,
        district:
          dto.district !== undefined ? dto.district.trim() : undefined,
        city: dto.city !== undefined ? dto.city.trim() : undefined,
        village: dto.village !== undefined ? dto.village.trim() : undefined,
        updatedAt: new Date(),
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
        serviceRequests: {
          select: { status: true },
        },
        _count: {
          select: { serviceRequests: true },
        },
      },
    });

    return this.mapFieldDetail(updatedField);
  }

  /**
   * 6. DELETE FIELD
   * Access: Admin or the owner Farmer
   * Safeguard: Check if any active service_requests or missions reference this field ID.
   * If referenced, rejects deletion with HTTP 409 Conflict:
   * "Cannot delete field with linked active service requests or missions."
   */
  public static async deleteField(
    fieldId: number,
    requestUser?: JwtPayload
  ): Promise<{ id: number; fieldName: string; farmerId: number }> {
    if (!requestUser) {
      throw AppError.unauthorized("Authentication required.");
    }

    const field = await prisma.field.findUnique({
      where: { id: fieldId },
      include: {
        serviceRequests: {
          include: {
            missions: true,
          },
        },
      },
    });

    if (!field) {
      throw AppError.notFound(`Field with ID ${fieldId} not found.`);
    }

    if (
      requestUser.role.toLowerCase() === "farmer" &&
      field.farmerId !== requestUser.userId
    ) {
      throw AppError.forbidden("Access denied. You do not own this field.");
    }

    // Check active service requests or active missions
    const hasActiveServiceRequests = field.serviceRequests.some(
      (sr) =>
        sr.status === RequestStatus.PENDING ||
        sr.status === RequestStatus.ASSIGNED ||
        sr.status === RequestStatus.IN_PROGRESS
    );

    const hasActiveMissions = field.serviceRequests.some((sr) =>
      (sr.missions || []).some(
        (m) =>
          m.status === MissionStatus.SCHEDULED ||
          m.status === MissionStatus.IN_PROGRESS
      )
    );

    if (hasActiveServiceRequests || hasActiveMissions) {
      throw AppError.conflict(
        "Cannot delete field with linked active service requests or missions."
      );
    }

    await prisma.field.delete({
      where: { id: fieldId },
    });

    return {
      id: field.id,
      fieldName: field.fieldName,
      farmerId: field.farmerId,
    };
  }
}

