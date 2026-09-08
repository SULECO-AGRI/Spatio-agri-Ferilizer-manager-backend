import prisma from "../config/prisma";
import { PilotStatus } from "../generated/prisma/enums";
import {
  RegisterFarmerDTO,
  RegisterPilotDTO,
  LoginDTO,
  AuthResponse,
  AuthUserResponse,
  ProfileData,
} from "../types/auth.types";
import { generateToken } from "../utils/jwt";
import { AppError } from "../utils/AppError";
import { hashPassword, comparePassword } from "../utils/password";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface UserWithRelations {
  userId: number;
  email: string;
  password?: string;
  firstName: string;
  lastName: string;
  mobile: string;
  role: { name: string };
  farmerProfile?: any;
  pilotProfile?: any;
  adminProfile?: any;
  createdAt: Date;
  updatedAt: Date;
}

export class AuthService {
  /**
   * Helper to sanitize and format user response object
   */
  private static formatUserResponse(user: UserWithRelations): AuthUserResponse {
    let profile: ProfileData = null;

    if (user.farmerProfile) {
      profile = {
        userId: user.farmerProfile.userId,
        nic: user.farmerProfile.nic,
        address: user.farmerProfile.address,
        memberSince: user.farmerProfile.memberSince,
      };
    } else if (user.pilotProfile) {
      profile = {
        userId: user.pilotProfile.userId,
        licenceNumber: user.pilotProfile.licenceNumber,
        status: user.pilotProfile.status,
        ratings: user.pilotProfile.ratings,
        completedMissions: user.pilotProfile.completedMissions,
        totalFlightHours: user.pilotProfile.totalFlightHours,
      };
    } else if (user.adminProfile) {
      profile = {
        userId: user.adminProfile.userId,
        department: user.adminProfile.department,
        accessLevel: user.adminProfile.accessLevel,
        createdAt: user.adminProfile.createdAt,
      };
    }

    return {
      userId: user.userId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      mobile: user.mobile,
      role: user.role ? user.role.name : "Unknown",
      profile,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  /**
   * Register a new Farmer with 1:1 FarmerProfile
   */
  public static async registerFarmer(dto: RegisterFarmerDTO): Promise<AuthResponse> {
    const { email, password, firstName, lastName, mobile, nic, address } = dto;

    if (!email || !password || !firstName || !lastName || !mobile) {
      throw AppError.badRequest("Missing required fields: email, password, firstName, lastName, and mobile are required.");
    }

    if (!EMAIL_REGEX.test(email)) {
      throw AppError.badRequest("Invalid email address format.");
    }

    if (password.length < 8) {
      throw AppError.badRequest("Password must be at least 8 characters long.");
    }

    // Check duplicate email or mobile
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { mobile }],
      },
    });

    if (existingUser) {
      throw AppError.conflict(
        existingUser.email === email
          ? "An account with this email already exists."
          : "An account with this mobile number already exists."
      );
    }

    // Check duplicate NIC if provided
    if (nic) {
      const existingNic = await prisma.farmerProfile.findUnique({
        where: { nic },
      });
      if (existingNic) {
        throw AppError.conflict("A farmer profile with this NIC already exists.");
      }
    }

    // Find Farmer role
    const farmerRole = await prisma.role.findUnique({
      where: { name: "Farmer" },
    });

    if (!farmerRole) {
      throw AppError.internal("Farmer role not configured in database.");
    }

    // Hash password using centralized utility
    const hashedPassword = await hashPassword(password);

    // Create user and profile in an atomic transaction
    const newUser = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          firstName,
          lastName,
          mobile,
          roleId: farmerRole.roleId,
        },
      });

      const profile = await tx.farmerProfile.create({
        data: {
          userId: user.userId,
          nic: nic || null,
          address: address || null,
        },
      });

      return {
        ...user,
        role: farmerRole,
        farmerProfile: profile,
      };
    });

    const userResponse = this.formatUserResponse(newUser);
    const token = generateToken({
      userId: userResponse.userId,
      email: userResponse.email,
      role: userResponse.role,
    });

    return {
      user: userResponse,
      token,
    };
  }

  /**
   * Register a new Pilot with 1:1 PilotProfile
   */
  public static async registerPilot(dto: RegisterPilotDTO): Promise<AuthResponse> {
    const { email, password, firstName, lastName, mobile, licenceNumber, totalFlightHours } = dto;

    if (!email || !password || !firstName || !lastName || !mobile || !licenceNumber) {
      throw AppError.badRequest(
        "Missing required fields: email, password, firstName, lastName, mobile, and licenceNumber are required."
      );
    }

    if (!EMAIL_REGEX.test(email)) {
      throw AppError.badRequest("Invalid email address format.");
    }

    if (password.length < 8) {
      throw AppError.badRequest("Password must be at least 8 characters long.");
    }

    // Check duplicate email or mobile
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { mobile }],
      },
    });

    if (existingUser) {
      throw AppError.conflict(
        existingUser.email === email
          ? "An account with this email already exists."
          : "An account with this mobile number already exists."
      );
    }

    // Check duplicate licenceNumber
    const existingLicence = await prisma.pilotProfile.findUnique({
      where: { licenceNumber },
    });
    if (existingLicence) {
      throw AppError.conflict("A pilot with this license number already exists.");
    }

    // Find Pilot role
    const pilotRole = await prisma.role.findUnique({
      where: { name: "Pilot" },
    });

    if (!pilotRole) {
      throw AppError.internal("Pilot role not configured in database.");
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user and profile in an atomic transaction
    const newUser = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          firstName,
          lastName,
          mobile,
          roleId: pilotRole.roleId,
        },
      });

      const profile = await tx.pilotProfile.create({
        data: {
          userId: user.userId,
          licenceNumber,
          status: PilotStatus.INACTIVE,
          totalFlightHours: totalFlightHours || 0.0,
        },
      });

      return {
        ...user,
        role: pilotRole,
        pilotProfile: profile,
      };
    });

    const userResponse = this.formatUserResponse(newUser);
    const token = generateToken({
      userId: userResponse.userId,
      email: userResponse.email,
      role: userResponse.role,
    });

    return {
      user: userResponse,
      token,
    };
  }

  /**
   * Verify credentials and log in (Admin, Pilot, Farmer)
   */
  public static async login(dto: LoginDTO): Promise<AuthResponse> {
    const { email, password } = dto;

    if (!email || !password) {
      throw AppError.badRequest("Both email and password are required.");
    }

    // Fetch user with role and profile associations
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { mobile: email }],
      },
      include: {
        role: true,
        farmerProfile: true,
        pilotProfile: true,
        adminProfile: true,
      },
    });

    if (!user) {
      throw AppError.unauthorized("Invalid email or password.");
    }

    // Verify password hash
    const isPasswordValid = await comparePassword(password, user.password);
    if (!isPasswordValid) {
      throw AppError.unauthorized("Invalid email or password.");
    }

    const userResponse = this.formatUserResponse(user);
    const token = generateToken({
      userId: userResponse.userId,
      email: userResponse.email,
      role: userResponse.role,
    });

    return {
      user: userResponse,
      token,
    };
  }

  /**
   * Get current authenticated user details
   */
  public static async getMe(userId: number): Promise<AuthUserResponse> {
    const user = await prisma.user.findUnique({
      where: { userId },
      include: {
        role: true,
        farmerProfile: true,
        pilotProfile: true,
        adminProfile: true,
      },
    });

    if (!user) {
      throw AppError.notFound("User not found.");
    }

    return this.formatUserResponse(user);
  }
}
