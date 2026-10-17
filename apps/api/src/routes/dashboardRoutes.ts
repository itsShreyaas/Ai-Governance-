import { Router, type RequestHandler } from "express";
import { UserRole } from "@aegisai/shared";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";
import { getDashboard } from "../services/dashboardService.js";

const router = Router();

const dashboardHandler: RequestHandler = async (_req, res) => {
  res.status(200).json(await getDashboard());
};

router.get("/", requireAuth, requireRole(UserRole.Admin, UserRole.Compliance, UserRole.Auditor), dashboardHandler);

export { router as dashboardRouter };