import type { ErrorRequestHandler } from "express";
import { logger } from "../services/logger.js";
import { HttpError } from "./httpError.js";

export const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
  if (error instanceof HttpError) {
    res.status(error.status).json({ status: error.status, code: error.code, message: error.message });
    return;
  }

  if (isParserError(error, "entity.too.large")) {
    res.status(413).json({ status: 413, code: "PAYLOAD_TOO_LARGE", message: "Request body exceeds the allowed size" });
    return;
  }

  if (error instanceof SyntaxError || isParserError(error, "entity.parse.failed")) {
    res.status(400).json({ status: 400, code: "INVALID_JSON", message: "Request body contains invalid JSON" });
    return;
  }

  logger.error({ error }, "Unhandled request error");
  res.status(500).json({ status: 500, code: "INTERNAL_ERROR", message: "An unexpected error occurred" });
};

function isParserError(error: unknown, type: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "type" in error &&
    error.type === type
  );
}