import { NextFunction, Request, Response } from "express";

export const errorHandler = (
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const statusCode = typeof err.statusCode === "number" ? err.statusCode : 500;
  const isProduction = process.env.NODE_ENV === "production";
  const isOperational = statusCode < 500 || err.isOperational === true;

  if (statusCode >= 500) {
    console.error("Internal Server Error:", err);
  }

  const errorMessage = isProduction && !isOperational
    ? "Internal server error"
    : err.message || "An unexpected error occurred";

  res.status(statusCode).json({
    status: statusCode >= 500 ? "error" : "fail",
    message: errorMessage,
    ...(isProduction ? {} : { stack: err.stack }),
  });
};
