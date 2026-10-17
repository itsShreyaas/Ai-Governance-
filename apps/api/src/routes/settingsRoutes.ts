import { Router, type RequestHandler } from "express";
import { UpdateSettingsSchema, UserRole } from "@aegisai/shared";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireCsrfHeader } from "../middleware/requireCsrfHeader.js";
import { requireRole } from "../middleware/requireRole.js";
import { validate } from "../middleware/validate.js";
import { getSettings, updateSettings } from "../services/settingsService.js";

const router = Router();
const adminOnly = requireRole(UserRole.Admin);

const readHandler: RequestHandler = async (_req, res) => {
  res.status(200).json(await getSettings());
};

const updateHandler: RequestHandler = async (req, res) => {
  res.status(200).json(await updateSettings(req.body, req.authUser!));
};

router.get("/", requireAuth, adminOnly, readHandler);
router.patch("/", requireAuth, adminOnly, requireCsrfHeader, validate(UpdateSettingsSchema), updateHandler);

export { router as settingsRouter };