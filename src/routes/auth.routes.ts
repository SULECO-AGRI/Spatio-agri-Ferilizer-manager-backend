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

// Token Refresh Route (Silent token refresh with rotation)
router.post("/refresh", authLimiter, AuthController.refreshToken);

// Logout Route (Revokes active refresh token)
router.post("/logout", AuthController.logout);

// Current User Profile Route
router.get("/me", authenticate, AuthController.getMe);

export default router;
