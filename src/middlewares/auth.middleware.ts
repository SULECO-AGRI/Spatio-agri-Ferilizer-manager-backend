import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { verifyAccessToken } from "../utils/jwt";
import { AppError } from "../utils/AppError";

export const authenticate = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(
      AppError.unauthorized("Authorization token is missing or malformed.", "TOKEN_MISSING")
    );
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = verifyAccessToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return next(
        AppError.unauthorized("Token expired. Please refresh your session.", "TOKEN_EXPIRED")
      );
    }
    return next(AppError.unauthorized("Invalid or expired token.", "TOKEN_INVALID"));
  }
};

export const authorize = (...allowedRoles: string[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(AppError.unauthorized("Authentication required."));
    }

    const hasRole = allowedRoles.some(
      (role) => role.toLowerCase() === req.user?.role.toLowerCase()
    );

    if (!hasRole) {
      return next(
        AppError.forbidden(
          `Access restricted to [${allowedRoles.join(", ")}] roles.`
        )
      );
    }

    next();
  };
};
