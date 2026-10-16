import type { RequestHandler } from "express";
import { AccessTokenSchema } from "@aegisai/shared";
import { User } from "../models/User.js";
import { HttpError } from "./httpError.js";
import { verifyAccessToken } from "../services/authTokens.js";

export const requireAuth: RequestHandler = async (req, _res, next) => {
  const tokenResult = AccessTokenSchema.safeParse(req.cookies?.aegis_access);
  if (!tokenResult.success) {
    next(new HttpError(401, "UNAUTHENTICATED", "Authentication is required"));
    return;
  }

  const userId = await verifyAccessToken(tokenResult.data);
  if (userId == null) {
    next(new HttpError(401, "UNAUTHENTICATED", "Authentication is required"));
    return;
  }

  const user = await User.findById(userId).lean();
  if (user == null || !user.isActive) {
    next(new HttpError(401, "UNAUTHENTICATED", "Authentication is required"));
    return;
  }

  req.authUser = {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    department: user.department,
    role: user.role,
  };
  next();
};