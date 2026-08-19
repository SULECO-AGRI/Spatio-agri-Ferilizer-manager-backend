import { NextFunction, Request, Response } from "express";

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  console.error("Unhandled Application Error:", err);

  const isProduction = process.env.NODE_ENV === "production";
  const errorMessage = isProduction
    ? "Internal server error"
    : err.message || "An unexpected error occurred";

  res.status(500).json({
    status: "error",
    message: errorMessage,
    ...(isProduction ? {} : { stack: err.stack }),
  });
};
