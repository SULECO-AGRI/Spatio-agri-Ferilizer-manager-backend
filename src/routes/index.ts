import { Router } from "express";
import healthRoutes from "./health.routes";
import authRoutes from "./auth.routes";
import farmerRoutes from "./farmer.routes";
import pilotRoutes from "./pilot.routes";

const router = Router();

router.use("/health", healthRoutes);
router.use("/auth", authRoutes);
router.use("/farmers", farmerRoutes);
router.use("/pilots", pilotRoutes);
router.use("/api/pilots", pilotRoutes);

export default router;
