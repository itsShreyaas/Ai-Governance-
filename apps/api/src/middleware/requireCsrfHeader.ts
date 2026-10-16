import type { RequestHandler } from "express";
import { CsrfHeaderSchema } from "@aegisai/shared";
import { HttpError } from "./httpError.js";

export const requireCsrfHeader: RequestHandler = (req, _res, next) => {
  if (!CsrfHeaderSchema.safeParse(req.get("x-aegis-csrf")).success) {
    next(new HttpError(403, "CSRF_HEADER_REQUIRED", "A valid CSRF request header is required"));
    return;
  }
  next();
};