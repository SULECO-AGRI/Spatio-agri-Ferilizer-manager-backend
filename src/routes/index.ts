import { Router } from "express";
import healthRoutes from "./health.routes";
import authRoutes from "./auth.routes";
import farmerRoutes from "./farmer.routes";
import fieldRoutes from "./field.routes";
import pilotRoutes from "./pilot.routes";
import serviceRequestRoutes from "./service-request.routes";
import adminRoutes from "./admin.routes";
import adminAnalyticsRoutes from "./admin-analytics.routes";

const router = Router();

router.use("/health", healthRoutes);
router.use("/api/health", healthRoutes);
router.use("/auth", authRoutes);
router.use("/api/auth", authRoutes);
router.use("/farmers", farmerRoutes);
router.use("/api/farmers", farmerRoutes);
router.use("/fields", fieldRoutes);
router.use("/api/fields", fieldRoutes);
router.use("/pilots", pilotRoutes);
router.use("/api/pilots", pilotRoutes);
router.use("/pilot", pilotRoutes);
router.use("/api/pilot", pilotRoutes);
router.use("/service-requests", serviceRequestRoutes);
router.use("/api/service-requests", serviceRequestRoutes);
router.use("/admin/analytics", adminAnalyticsRoutes);
router.use("/api/admin/analytics", adminAnalyticsRoutes);
router.use("/admin", adminRoutes);
router.use("/api/admin", adminRoutes);

export default router;

