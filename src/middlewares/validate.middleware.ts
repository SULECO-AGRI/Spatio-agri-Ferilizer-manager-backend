import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";
import { AppError } from "../utils/AppError";

type RequestLocation = "body" | "query" | "params";

/**
 * Higher-order middleware to validate incoming request data against a Zod schema.
 * Replaces unvalidated request data with safe, parsed, and coerced values from Zod.
 */
export const validate = (schema: ZodSchema, location: RequestLocation = "body") => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const parsedData = schema.parse(req[location]);
      req[location] = parsedData;
      next();
    } catch (error: any) {
      if (error instanceof ZodError || error?.name === "ZodError") {
        const issues = error.issues || error.errors || [];
        const errorMessages = issues.map((issue: any) => {
          const path = issue.path ? issue.path.join(".") : "";
          return path ? `${path}: ${issue.message}` : issue.message;
        });

        return next(
          AppError.badRequest(
            `Validation error in request ${location}: ${errorMessages.join("; ") || error.message}`
          )
        );
      }
      return next(error);
    }
  };
};

export const validateBody = (schema: ZodSchema) => validate(schema, "body");
export const validateQuery = (schema: ZodSchema) => validate(schema, "query");
export const validateParams = (schema: ZodSchema) => validate(schema, "params");
