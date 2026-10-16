import type { RequestHandler } from "express";
import type { UserRole } from "@aegisai/shared";
import { HttpError } from "./httpError.js";

export function requireRole(...roles: UserRole[]): RequestHandler {
  return (req, _res, next) => {
    if (req.authUser == null || !roles.includes(req.authUser.role)) {
      next(new HttpError(403, "FORBIDDEN", "You do not have permission to perform this action"));
      return;
    }
    next();
  };
}