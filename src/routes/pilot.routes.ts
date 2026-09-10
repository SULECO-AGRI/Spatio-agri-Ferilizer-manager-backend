import { Router } from "express";
import { PilotController } from "../controllers/pilot.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";
import {
  validateParams,
  validateQuery,
  validateBody,
} from "../middlewares/validate.middleware";
import {
  pilotIdParamSchema,
  pilotMissionParamsSchema,
  missionIdParamSchema,
  pilotListQuerySchema,
  updatePilotStatusSchema,
  pilotMissionQuerySchema,
  completeMissionSchema,
  respondMissionSchema,
  pilotPayoutQuerySchema,
  pilotReviewQuerySchema,
} from "../validations/pilot.validation";


const router = Router();

// Mount authentication middleware globally across all pilot endpoints
router.use(authenticate);

/**
 * @route   GET /pilots
 * @desc    Get paginated directory of all pilots with search, status filters, and sorting
 * @access  Private (Admin Only)
 */
router.get(
  "/",
  authorize("Admin", "Pilot"),
  validateQuery(pilotListQuerySchema),
  PilotController.getAllPilots
);

/**
 * @route   GET /pilots/:id
 * @desc    Get comprehensive pilot profile, cumulative stats, and rating analytics
 * @access  Private (Admin or Respective Pilot)
 */
router.get(
  "/:id",
  authorize("Admin", "Pilot"),
  validateParams(pilotIdParamSchema),
  PilotController.getPilotById
);

/**
 * @route   PATCH /pilots/:id/status
 * @desc    Update pilot availability / duty status
 * @access  Private (Admin or Respective Pilot)
 */
router.patch(
  "/:id/status",
  authorize("Admin", "Pilot"),
  validateParams(pilotIdParamSchema),
  validateBody(updatePilotStatusSchema),
  PilotController.updatePilotStatus
);

/**
 * @route   GET /pilots/:id/missions
 * @desc    Get pilot's assigned mission history and schedule
 * @access  Private (Admin or Respective Pilot)
 */
router.get(
  "/:id/missions",
  authorize("Admin", "Pilot"),
  validateParams(pilotIdParamSchema),
  validateQuery(pilotMissionQuerySchema),
  PilotController.getPilotMissions
);

/**
 * @route   PATCH /pilots/:id/missions/:missionId/start
 * @desc    Start scheduled mission execution (transitions to IN_PROGRESS, sets pilot ON_MISSION)
 * @access  Private (Admin or Assigned Pilot)
 */
router.patch(
  "/:id/missions/:missionId/start",
  authorize("Admin", "Pilot"),
  validateParams(pilotMissionParamsSchema),
  PilotController.startMission
);

/**
 * @route   PATCH /pilots/:id/missions/:missionId/complete
 * @desc    Complete mission atomically (updates mission, logs flight hours, area spread, restores ACTIVE status)
 * @access  Private (Admin or Assigned Pilot)
 */
router.patch(
  "/:id/missions/:missionId/complete",
  authorize("Admin", "Pilot"),
  validateParams(pilotMissionParamsSchema),
  validateBody(completeMissionSchema),
  PilotController.completeMission
);

/**
 * @route   POST /pilots/missions/:missionId/respond
 * @desc    Pilot responds to assigned mission (Accept or Reject)
 * @access  Private (Admin or Assigned Pilot)
 */
router.post(
  "/missions/:missionId/respond",
  authorize("Admin", "Pilot"),
  validateParams(missionIdParamSchema),
  validateBody(respondMissionSchema),
  PilotController.respondToMission
);

/**
 * @route   POST /pilots/:id/missions/:missionId/respond
 * @desc    Pilot responds to assigned mission with pilotId in path (Accept or Reject)
 * @access  Private (Admin or Assigned Pilot)
 */
router.post(
  "/:id/missions/:missionId/respond",
  authorize("Admin", "Pilot"),
  validateParams(pilotMissionParamsSchema),
  validateBody(respondMissionSchema),
  PilotController.respondToMission
);


/**
 * @route   GET /pilots/:id/payouts
 * @desc    Get financial payouts and settlement ledger for the pilot
 * @access  Private (Admin or Respective Pilot)
 */
router.get(
  "/:id/payouts",
  authorize("Admin", "Pilot"),
  validateParams(pilotIdParamSchema),
  validateQuery(pilotPayoutQuerySchema),
  PilotController.getPilotPayouts
);

/**
 * @route   GET /pilots/:id/reviews
 * @desc    Get customer reviews and ratings for the pilot
 * @access  Private (Admin or Respective Pilot)
 */
router.get(
  "/:id/reviews",
  authorize("Admin", "Pilot"),
  validateParams(pilotIdParamSchema),
  validateQuery(pilotReviewQuerySchema),
  PilotController.getPilotReviews
);

/**
 * @route   DELETE /pilots/:id
 * @desc    Delete pilot profile, credentials, and user account
 * @access  Private (Admin or Respective Pilot)
 */
router.delete(
  "/:id",
  authorize("Admin", "Pilot"),
  validateParams(pilotIdParamSchema),
  PilotController.deletePilot
);

export default router;
