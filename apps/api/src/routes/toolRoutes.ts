import { Router, type RequestHandler } from "express";
import {
  CreateToolSchema,
  ToolDecisionSchema,
  ToolIdParamsSchema,
  ToolListQuerySchema,
  UpdateToolSchema,
  UserRole,
  type ToolListQuery,
} from "@aegisai/shared";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireCsrfHeader } from "../middleware/requireCsrfHeader.js";
import { requireRole } from "../middleware/requireRole.js";
import { validate } from "../middleware/validate.js";
import { createTool, decideTool, listTools, updateTool } from "../services/toolService.js";

const router = Router();
const readerRoles = [UserRole.Admin, UserRole.Compliance, UserRole.Requester, UserRole.Auditor];
const managerRoles = [UserRole.Admin, UserRole.Compliance];

const listHandler: RequestHandler = async (_req, res) => {
  const query = res.locals["query"] as ToolListQuery;
  res.status(200).json(await listTools(query));
};

const createHandler: RequestHandler = async (req, res) => {
  const tool = await createTool(req.body, req.authUser!);
  res.status(201).json(tool);
};

const updateHandler: RequestHandler = async (req, res) => {
  const params = res.locals["params"] as { id: string };
  const tool = await updateTool(params.id, req.body, req.authUser!);
  res.status(200).json(tool);
};

const decisionHandler: RequestHandler = async (req, res) => {
  const params = res.locals["params"] as { id: string };
  const tool = await decideTool(params.id, req.body, req.authUser!);
  res.status(200).json(tool);
};

router.get("/", requireAuth, requireRole(...readerRoles), validate(ToolListQuerySchema, "query"), listHandler);
router.post(
  "/",
  requireAuth,
  requireRole(...managerRoles),
  requireCsrfHeader,
  validate(CreateToolSchema),
  createHandler
);
router.patch(
  "/:id",
  requireAuth,
  requireRole(...managerRoles),
  requireCsrfHeader,
  validate(ToolIdParamsSchema, "params"),
  validate(UpdateToolSchema),
  updateHandler
);
router.post(
  "/:id/decision",
  requireAuth,
  requireRole(...managerRoles),
  requireCsrfHeader,
  validate(ToolIdParamsSchema, "params"),
  validate(ToolDecisionSchema),
  decisionHandler
);

export { router as toolRouter };