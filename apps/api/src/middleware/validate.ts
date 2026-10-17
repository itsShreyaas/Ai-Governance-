import type { RequestHandler } from "express";
import type { ZodType } from "zod";
import { HttpError } from "./httpError.js";

export function validate(schema: ZodType, source: "body" | "query" | "params" = "body"): RequestHandler {
  return (req, res, next) => {
    const result = schema.safeParse(source === "body" ? req.body : req[source]);
    if (!result.success) {
      next(new HttpError(400, "VALIDATION_ERROR", "Request validation failed"));
      return;
    }
    if (source === "body") req.body = result.data;
    else res.locals[source] = result.data;
    next();
  };
}