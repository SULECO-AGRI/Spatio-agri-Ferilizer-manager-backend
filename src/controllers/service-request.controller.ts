import { Request, Response } from "express";
import { ServiceRequestService } from "../services/service-request.service";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/AppError";

export class ServiceRequestController {
  /**
   * POST /service-requests
   * Create a new service request for a registered field (Farmer Only)
   */
  public static createServiceRequest = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      if (!req.user) {
        throw AppError.unauthorized("Authentication required.");
      }

      const result = await ServiceRequestService.createServiceRequest(
        req.user.userId,
        req.body
      );

      res.status(201).json({
        status: "success",
        message: "Service request submitted successfully.",
        data: {
          serviceRequest: result,
        },
      });
    }
  );

  /**
   * GET /service-requests
   * List all service requests (Admin sees all; Farmer sees own; Pilot sees assigned)
   */
  public static getAllServiceRequests = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const result = await ServiceRequestService.getAllServiceRequests(
        req.query as any,
        req.user
      );

      res.status(200).json({
        status: "success",
        data: {
          requests: result.requests,
          summary: result.summary,
          pagination: result.pagination,
        },
      });
    }
  );

  /**
   * GET /service-requests/:id
   * Get single service request details with full farmer, field, mission & pilot info
   */
  public static getServiceRequestById = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const requestId = Number(req.params.id);
      const result = await ServiceRequestService.getServiceRequestById(
        requestId,
        req.user
      );

      res.status(200).json({
        status: "success",
        data: {
          serviceRequest: result,
        },
      });
    }
  );

  /**
   * POST /service-requests/:id/assign
   * Assign a pilot to a service request and schedule mission (Admin Only)
   */
  public static assignPilot = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      if (!req.user) {
        throw AppError.unauthorized("Authentication required.");
      }

      const requestId = Number(req.params.id);
      const result = await ServiceRequestService.assignPilot(
        requestId,
        req.user.userId,
        req.body
      );

      res.status(200).json({
        status: "success",
        message: "Pilot assigned and mission scheduled successfully.",
        data: {
          serviceRequest: result,
        },
      });
    }
  );

  /**
   * PATCH /service-requests/:id/status
   * Update service request status (Admin or Farmer cancellation)
   */
  public static updateStatus = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const requestId = Number(req.params.id);
      const result = await ServiceRequestService.updateStatus(
        requestId,
        req.body,
        req.user
      );

      res.status(200).json({
        status: "success",
        message: "Service request status updated successfully.",
        data: {
          serviceRequest: result,
        },
      });
    }
  );
}
