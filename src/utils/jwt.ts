import jwt from "jsonwebtoken";
import { JwtPayload } from "../types/auth.types";

const isProduction = process.env.NODE_ENV === "production";
const JWT_SECRET = process.env.JWT_SECRET;

// Fail-fast security guard: Never allow undefined JWT_SECRET in production
if (isProduction && !JWT_SECRET) {
  throw new Error("FATAL: JWT_SECRET environment variable is missing in production.");
}

const secretKey = JWT_SECRET || "default_development_jwt_secret_key_123456789";
const DEFAULT_JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

/**
 * Generates a signed JWT token with configurable expiration
 */
export const generateToken = (
  payload: JwtPayload,
  expiresIn: string = DEFAULT_JWT_EXPIRES_IN
): string => {
  return jwt.sign(payload, secretKey, {
    expiresIn: (expiresIn as any) || "7d",
  });
};

/**
 * Verifies and decodes a JWT token
 */
export const verifyToken = (token: string): JwtPayload => {
  return jwt.verify(token, secretKey) as JwtPayload;
};
