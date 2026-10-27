import jwt from "jsonwebtoken";
import { JwtPayload } from "../types/auth.types";

const JWT_SECRET = process.env.JWT_SECRET;

// Fail-fast security guard: Ensure JWT_SECRET is explicitly configured
if (!JWT_SECRET) {
  throw new Error("FATAL: JWT_SECRET environment variable is missing.");
}

const secretKey = JWT_SECRET;
const refreshSecretKey = process.env.JWT_REFRESH_SECRET || `${JWT_SECRET}_refresh_sec`;

// Access token default: 30 minutes; Refresh token default: 7 days
export const DEFAULT_ACCESS_TOKEN_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || "30m";
export const DEFAULT_REFRESH_TOKEN_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || "7d";

/**
 * Generates short-lived Access Token (default 30m)
 */
export const generateAccessToken = (
  payload: JwtPayload,
  expiresIn: string = DEFAULT_ACCESS_TOKEN_EXPIRES_IN
): string => {
  return jwt.sign(payload, secretKey, {
    expiresIn: (expiresIn as any) || "30m",
  });
};

/**
 * Generates longer-lived Refresh Token (default 7d)
 */
export const generateRefreshToken = (
  payload: JwtPayload,
  expiresIn: string = DEFAULT_REFRESH_TOKEN_EXPIRES_IN
): string => {
  return jwt.sign(payload, refreshSecretKey, {
    expiresIn: (expiresIn as any) || "7d",
  });
};

/**
 * Backward-compatible helper for generating access token
 */
export const generateToken = (
  payload: JwtPayload,
  expiresIn: string = DEFAULT_ACCESS_TOKEN_EXPIRES_IN
): string => {
  return generateAccessToken(payload, expiresIn);
};

/**
 * Verifies and decodes an Access Token
 */
export const verifyAccessToken = (token: string): JwtPayload => {
  return jwt.verify(token, secretKey) as JwtPayload;
};

/**
 * Verifies and decodes a Refresh Token
 */
export const verifyRefreshToken = (token: string): JwtPayload => {
  return jwt.verify(token, refreshSecretKey) as JwtPayload;
};

/**
 * Backward-compatible helper for verifying access token
 */
export const verifyToken = (token: string): JwtPayload => {
  return verifyAccessToken(token);
};
