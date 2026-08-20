import { Router } from "express";
import healthRoutes from "./health.routes";
import authRoutes from "./auth.routes";
import farmerRoutes from "./farmer.routes";
import pilotRoutes from "./pilot.routes";
import serviceRequestRoutes from "./service-request.routes";
import adminRoutes from "./admin.routes";

const router = Router();

router.use("/health", healthRoutes);
router.use("/auth", authRoutes);
router.use("/farmers", farmerRoutes);
router.use("/pilots", pilotRoutes);
router.use("/api/pilots", pilotRoutes);
router.use("/service-requests", serviceRequestRoutes);
router.use("/api/service-requests", serviceRequestRoutes);
router.use("/admin", adminRoutes);
router.use("/api/admin", adminRoutes);

export default router;
