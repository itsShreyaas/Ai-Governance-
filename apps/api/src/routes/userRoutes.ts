import { Router, type RequestHandler } from "express";
import {
  CreateUserSchema,
  ToolIdParamsSchema,
  UpdateUserSchema,
  UserListQuerySchema,
  UserRole,
  type UserListQuery,
} from "@aegisai/shared";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireCsrfHeader } from "../middleware/requireCsrfHeader.js";
import { requireRole } from "../middleware/requireRole.js";
import { validate } from "../middleware/validate.js";
import { createUser, listUsers, updateUser } from "../services/userService.js";

const router = Router();
const adminOnly = requireRole(UserRole.Admin);

const listHandler: RequestHandler = async (_req, res) => {
  res.status(200).json(await listUsers(res.locals["query"] as UserListQuery));
};

const createHandler: RequestHandler = async (req, res) => {
  res.status(201).json(await createUser(req.body, req.authUser!));
};

const updateHandler: RequestHandler = async (req, res) => {
  const params = res.locals["params"] as { id: string };
  res.status(200).json(await updateUser(params.id, req.body, req.authUser!));
};

router.get("/", requireAuth, adminOnly, validate(UserListQuerySchema, "query"), listHandler);
router.post("/", requireAuth, adminOnly, requireCsrfHeader, validate(CreateUserSchema), createHandler);
router.patch(
  "/:id",
  requireAuth,
  adminOnly,
  requireCsrfHeader,
  validate(ToolIdParamsSchema, "params"),
  validate(UpdateUserSchema),
  updateHandler
);

export { router as userRouter };