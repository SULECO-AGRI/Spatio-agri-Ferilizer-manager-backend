import { Router } from "express";
import { SystemSettingController } from "../controllers/system-setting.controller";
import { authenticate } from "../middlewares/auth.middleware";

const router = Router();

/**
 * @route   GET /settings
 * @desc    Retrieve dynamic pricing and pilot commission settings
 * @access  Authenticated (Admin, Pilot, Farmer)
 */
router.get("/", authenticate, SystemSettingController.getSettings);

export default router;