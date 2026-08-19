import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../utils/jwt";
import { AppError } from "../utils/AppError";

export const authenticate = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(
      AppError.unauthorized("Authorization token is missing or malformed.")
    );
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    return next(AppError.unauthorized("Invalid or expired token."));
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
