import { Router, type RequestHandler } from "express";
import {
  CreateRequestSchema,
  RequestListQuerySchema,
  ToolIdParamsSchema,
  UpdateRequestSchema,
  UserRole,
  type RequestListQuery,
} from "@aegisai/shared";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireCsrfHeader } from "../middleware/requireCsrfHeader.js";
import { requireRole } from "../middleware/requireRole.js";
import { validate } from "../middleware/validate.js";
import { createRequest, listRequests, reviewRequest } from "../services/requestService.js";

const router = Router();
const createRoles = [UserRole.Requester, UserRole.Admin, UserRole.Compliance];
const readRoles = [UserRole.Requester, UserRole.Admin, UserRole.Compliance, UserRole.Auditor];

const createHandler: RequestHandler = async (req, res) => {
  const record = await createRequest(req.body, req.authUser!);
  res.status(201).json(record);
};

const listHandler: RequestHandler = async (req, res) => {
  const query = res.locals["query"] as RequestListQuery;
  res.status(200).json(await listRequests(query, req.authUser!));
};

const updateHandler: RequestHandler = async (req, res) => {
  const params = res.locals["params"] as { id: string };
  const record = await reviewRequest(params.id, req.body, req.authUser!);
  res.status(200).json(record);
};

router.post(
  "/",
  requireAuth,
  requireRole(...createRoles),
  requireCsrfHeader,
  validate(CreateRequestSchema),
  createHandler
);
router.get(
  "/",
  requireAuth,
  requireRole(...readRoles),
  validate(RequestListQuerySchema, "query"),
  listHandler
);
router.patch(
  "/:id",
  requireAuth,
  requireRole(UserRole.Admin, UserRole.Compliance),
  requireCsrfHeader,
  validate(ToolIdParamsSchema, "params"),
  validate(UpdateRequestSchema),
  updateHandler
);

export { router as requestRouter };