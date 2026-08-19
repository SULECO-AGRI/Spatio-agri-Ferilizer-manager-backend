import { Router } from "express";
import rateLimit from "express-rate-limit";
import { AuthController } from "../controllers/auth.controller";
import { authenticate } from "../middlewares/auth.middleware";

const router = Router();

// Dedicated strict rate limiter for login attempts (15 mins, max 15 attempts/IP)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    status: "error",
    message: "Too many login attempts. Please try again after 15 minutes.",
  },
});

// Registration Routes
router.post("/register/farmer", AuthController.registerFarmer);
router.post("/register/pilot", AuthController.registerPilot);

// Login Route (Role verified: Admin, Pilot, Farmer) with dedicated rate limiter
router.post("/login", loginLimiter, AuthController.login);

// Current User Profile Route
router.get("/me", authenticate, AuthController.getMe);

export default router;
