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
import { RequestStatus } from "../generated/prisma/enums";

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

    return {
      id: f.id,
      farmerId: f.farmerId,
      fieldName: f.fieldName,
      cropType: f.cropType,
      locationCoordinates: f.locationCoordinates as number[][],
      area: Number(f.area),
      province: f.province,
      district: f.district,
      city: f.city,
      village: f.village,
      totalServiceRequests,
      activeRequests,
      completedRequests,
      owner: {
        userId: f.farmerId,
        fullName: user ? `${user.firstName} ${user.lastName}`.trim() : "Unknown Farmer",
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
   * Access: Admin can view all fields; Farmers see only their own registered fields.
   */
  public static async getAllFields(
    query: FieldQueryDTO,
    requestUser?: JwtPayload
  ): Promise<PaginatedFieldsResponseDTO> {
    if (!requestUser) {
      throw AppError.unauthorized("Authentication required.");
    }

    const { page, limit, skip } = getPaginationOffsets(query.page, query.limit);
    const { search, cropType, district, province, farmerId, sortBy = "createdAt", sortOrder = "desc" } = query;

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
   */
  public static async createField(
    dto: CreateFieldInputDTO,
    requestUser?: JwtPayload
  ): Promise<FieldDetailDTO> {
    if (!requestUser) {
      throw AppError.unauthorized("Authentication required.");
    }

    let targetFarmerId = dto.farmerId;
    const userRole = requestUser.role.toLowerCase();

    if (userRole === "farmer") {
      targetFarmerId = requestUser.userId;
    } else if (!targetFarmerId) {
      throw AppError.badRequest("farmerId is required when creating a field as Admin.");
    }

    // Verify farmer profile exists
    const farmer = await prisma.farmerProfile.findUnique({
      where: { userId: targetFarmerId },
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
    });

    if (!farmer) {
      throw AppError.notFound(`Farmer with ID ${targetFarmerId} not found.`);
    }

    const newField = await prisma.field.create({
      data: {
        farmerId: targetFarmerId,
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

    const updatedField = await prisma.field.update({
      where: { id: fieldId },
      data: {
        fieldName: dto.fieldName,
        cropType: dto.cropType,
        area: dto.area,
        locationCoordinates: dto.locationCoordinates
          ? (dto.locationCoordinates as any)
          : undefined,
        province: dto.province,
        district: dto.district,
        city: dto.city,
        village: dto.village,
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
   * Safeguard: Blocks deletion if active/in-progress missions or service requests exist.
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
          where: {
            status: {
              in: [
                RequestStatus.PENDING,
                RequestStatus.ASSIGNED,
                RequestStatus.IN_PROGRESS,
              ],
            },
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

    if (field.serviceRequests.length > 0) {
      throw AppError.badRequest(
        `Cannot delete field "${field.fieldName}" because it has ${field.serviceRequests.length} active or in-progress service requests.`
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
