import type { RequestHandler } from "express";
import type { ZodType } from "zod";
import { HttpError } from "./httpError.js";

export function validate(schema: ZodType): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(new HttpError(400, "VALIDATION_ERROR", "Request validation failed"));
      return;
    }
    req.body = result.data;
    next();
  };
}