import { Response } from "express";
import { PaginationMeta } from "../types/farmer.types";

/**
 * Standard Success Response Envelope
 */
export function sendSuccess<T>(
  res: Response,
  data?: T,
  message?: string,
  statusCode: number = 200
): void {
  const payload: Record<string, any> = {
    status: "success",
  };

  if (message) {
    payload.message = message;
  }

  if (data !== undefined) {
    payload.data = data;
  }

  res.status(statusCode).json(payload);
}

/**
 * Standard 201 Created Response Envelope
 */
export function sendCreated<T>(
  res: Response,
  data?: T,
  message: string = "Resource created successfully."
): void {
  sendSuccess(res, data, message, 201);
}

/**
 * Standard Paginated Response Envelope
 */
export function sendPaginated<T>(
  res: Response,
  key: string,
  items: T[],
  pagination: PaginationMeta,
  extra?: Record<string, any>,
  statusCode: number = 200
): void {
  res.status(statusCode).json({
    status: "success",
    data: {
      [key]: items,
      ...(extra || {}),
      pagination,
    },
  });
}
