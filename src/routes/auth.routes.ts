import { Router } from "express";
import { AuthController } from "../controllers/auth.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { authLimiter } from "../middlewares/rateLimiter";

const router = Router();

// Registration Routes (Protected by distributed Redis rate limiter)
router.post("/register/farmer", authLimiter, AuthController.registerFarmer);
router.post("/register/pilot", authLimiter, AuthController.registerPilot);

// Login Route (Protected by distributed Redis rate limiter)
router.post("/login", authLimiter, AuthController.login);

// Current User Profile Route
router.get("/me", authenticate, AuthController.getMe);

export default router;
