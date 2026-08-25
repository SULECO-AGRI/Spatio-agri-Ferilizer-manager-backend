import { Request, Response } from "express";
import { ServiceRequestService } from "../services/service-request.service";
import {
  ServiceRequestCacheService,
  SERVICE_REQUEST_CACHE_TTL,
} from "../services/service-request-cache.service";
import { CacheService } from "../utils/cache";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/AppError";
import { sendSuccess, sendCreated, sendPaginated } from "../utils/response";

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

      // Event-driven cache purging on new request creation
      ServiceRequestCacheService.invalidateServiceRequestCaches(
        result.requestId
      ).catch((err) => {
        console.warn("[ServiceRequestController] Cache invalidation warning:", err.message);
      });

      sendCreated(
        res,
        { serviceRequest: result },
        "Service request submitted successfully."
      );
    }
  );

  /**
   * GET /service-requests
   * List all service requests (Admin sees all; Farmer sees own; Pilot sees assigned)
   * Supports both Keyset/Cursor and Offset Pagination with Cache-Aside enabled
   */
  public static getAllServiceRequests = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const isCursorMode =
        req.query.cursor !== undefined ||
        (req.query.take !== undefined && req.query.page === undefined);

      const cacheKey = isCursorMode
        ? ServiceRequestCacheService.buildCursorCacheKey(
            req.query as any,
            req.user
          )
        : ServiceRequestCacheService.buildListCacheKey(
            req.query as any,
            req.user
          );

      const { data: result } = await CacheService.getCachedOrFetch({
        key: cacheKey,
        ttlSeconds: SERVICE_REQUEST_CACHE_TTL.LIST_SECONDS,
        fetchFn: () =>
          ServiceRequestService.getAllServiceRequests(
            req.query as any,
            req.user
          ),
        res,
      });

      if ("pageInfo" in result) {
        sendSuccess(res, {
          requests: result.requests,
          pageInfo: result.pageInfo,
          summary: result.summary,
        });
        return;
      }

      sendPaginated(
        res,
        "requests",
        result.requests,
        result.pagination,
        { summary: result.summary }
      );
    }
  );

  /**
   * GET /service-requests/:id
   * Get single service request details with full farmer, field, mission & pilot info
   * Cache-Aside enabled with X-Cache header and RBAC guard
   */
  public static getServiceRequestById = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const requestId = Number(req.params.id);
      const cacheKey = ServiceRequestCacheService.buildDetailCacheKey(requestId);

      const { data: result } = await CacheService.getCachedOrFetch({
        key: cacheKey,
        ttlSeconds: SERVICE_REQUEST_CACHE_TTL.DETAIL_SECONDS,
        fetchFn: () =>
          ServiceRequestService.getServiceRequestById(requestId, req.user),
        res,
      });

      // Post-cache RBAC verification to prevent cross-tenant data leaks
      const currentUser = req.user;
      if (currentUser) {
        const userRole = currentUser.role.toLowerCase();
        if (userRole === "farmer" && result.farmer.userId !== currentUser.userId) {
          throw AppError.forbidden("Access denied. You can only view your own service requests.");
        }
        if (
          userRole === "pilot" &&
          !result.missions.some((m) => m.pilot?.userId === currentUser.userId)
        ) {
          throw AppError.forbidden("Access denied. You can only view service requests assigned to you.");
        }
      }

      sendSuccess(res, { serviceRequest: result });
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

      // Event-driven cache purging on pilot assignment
      ServiceRequestCacheService.invalidateServiceRequestCaches(
        requestId
      ).catch((err) => {
        console.warn("[ServiceRequestController] Cache invalidation warning:", err.message);
      });

      sendSuccess(
        res,
        { serviceRequest: result },
        "Pilot assigned and mission scheduled successfully."
      );
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

      // Event-driven cache purging on status lifecycle transition
      ServiceRequestCacheService.invalidateServiceRequestCaches(
        requestId
      ).catch((err) => {
        console.warn("[ServiceRequestController] Cache invalidation warning:", err.message);
      });

      sendSuccess(
        res,
        { serviceRequest: result },
        "Service request status updated successfully."
      );
    }
  );
}
