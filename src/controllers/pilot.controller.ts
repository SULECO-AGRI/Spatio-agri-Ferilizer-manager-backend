import { Request, Response } from "express";
import { PilotService } from "../services/pilot.service";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess, sendPaginated } from "../utils/response";

export class PilotController {
  /**
   * GET /pilots
   * Retrieve paginated set of pilots with search, status filters, and sorting (Admin Only)
   */
  public static getAllPilots = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const result = await PilotService.getAllPilots(req.query as any);
      sendPaginated(res, "pilots", result.items, result.pagination);
    }
  );

  /**
   * GET /pilots/:id
   * Retrieve single pilot comprehensive profile, analytics, and stats
   */
  public static getPilotById = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const pilotId = Number(req.params.id);
      const pilot = await PilotService.getPilotById(pilotId, req.user);
      sendSuccess(res, { pilot });
    }
  );

  /**
   * PATCH /pilots/:id/status
   * Update pilot availability / duty status
   */
  public static updatePilotStatus = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const pilotId = Number(req.params.id);
      const { status } = req.body;
      const updated = await PilotService.updatePilotStatus(
        pilotId,
        status,
        req.user
      );
      sendSuccess(res, updated, "Pilot status updated successfully.");
    }
  );

  /**
   * GET /pilots/:id/missions
   * Retrieve pilot's mission assignments and historical flights
   */
  public static getPilotMissions = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const pilotId = Number(req.params.id);
      const result = await PilotService.getPilotMissions(
        pilotId,
        req.query as any,
        req.user
      );
      sendPaginated(res, "missions", result.items, result.pagination);
    }
  );

  /**
   * PATCH /pilots/:id/missions/:missionId/start
   * Start a scheduled mission
   */
  public static startMission = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const pilotId = Number(req.params.id);
      const missionId = Number(req.params.missionId);
      const result = await PilotService.startMission(
        pilotId,
        missionId,
        req.user
      );
      sendSuccess(res, result, "Mission started successfully.");
    }
  );

  /**
   * PATCH /pilots/:id/missions/:missionId/complete
   * Complete a mission atomically
   */
  public static completeMission = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const pilotId = Number(req.params.id);
      const missionId = Number(req.params.missionId);
      const result = await PilotService.completeMission(
        pilotId,
        missionId,
        req.body,
        req.user
      );
      sendSuccess(res, result, "Mission completed successfully.");
    }
  );

  /**
   * GET /pilots/:id/payouts
   * Retrieve financial payout records and settlement ledger
   */
  public static getPilotPayouts = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const pilotId = Number(req.params.id);
      const result = await PilotService.getPilotPayouts(
        pilotId,
        req.query as any,
        req.user
      );
      sendPaginated(
        res,
        "payouts",
        result.payouts,
        result.pagination,
        { summary: result.summary }
      );
    }
  );

  /**
   * GET /pilots/:id/reviews
   * Retrieve customer performance reviews and ratings for the pilot
   */
  public static getPilotReviews = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const pilotId = Number(req.params.id);
      const result = await PilotService.getPilotReviews(
        pilotId,
        req.query as any,
        req.user
      );
      sendPaginated(res, "reviews", result.items, result.pagination);
    }
  );

  /**
   * POST /pilots/missions/:missionId/respond
   * POST /pilot/missions/:missionId/respond
   * Pilot response to assigned mission (Accept or Reject)
   */
  public static respondToMission = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const missionId = Number(req.params.missionId);
      const result = await PilotService.respondToMission(
        missionId,
        req.body,
        req.user
      );
      sendSuccess(res, result, result.message);
    }
  );

  /**
   * DELETE /pilots/:id
   * Delete pilot profile, duty credentials, and account
   */
  public static deletePilot = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const pilotId = Number(req.params.id);
      const deletedPilot = await PilotService.deletePilot(
        pilotId,
        req.user
      );
      sendSuccess(
        res,
        { pilot: deletedPilot },
        "Pilot account and associated profiles deleted successfully."
      );
    }
  );
}
