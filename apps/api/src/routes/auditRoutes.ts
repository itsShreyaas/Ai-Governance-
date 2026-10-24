import { once } from "node:events";
import { Router, type RequestHandler } from "express";
import { AuditExportQuerySchema, AuditListQuerySchema, UserRole, type AuditExportQuery, type AuditListQuery } from "@aegisai/shared";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";
import { validate } from "../middleware/validate.js";
import { createAuditExport, getAuditVerification, listAuditEvents } from "../services/auditQueryService.js";

const router = Router();
const auditReaders = [UserRole.Admin, UserRole.Compliance, UserRole.Auditor];
const verificationReaders = [UserRole.Admin, UserRole.Auditor];

const listHandler: RequestHandler = async (_req, res) => {
  const query = res.locals["query"] as AuditListQuery;
  res.status(200).json(await listAuditEvents(query));
};

const exportHandler: RequestHandler = async (req, res) => {
  const filters = res.locals["query"] as AuditExportQuery;
  const result = await createAuditExport(filters, req.authUser!);
  res.status(200);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="audit-export.csv"');
  if (result.truncated) res.setHeader("X-Audit-Export-Truncated", "true");
  res.flushHeaders();
  res.write("sequence,timestamp,eventType,severity,toolId,toolName,actorId,actorName,department,details\r\n");
  for await (const row of result.cursor) {
    const line = [
      row.sequence,
      row.timestamp.toISOString(),
      row.eventType,
      row.severity,
      row.toolId?.toString(),
      row.toolName,
      row.actorId?.toString(),
      row.actorName,
      row.department,
      row.details,
    ].map(csvCell).join(",");
    if (!res.write(`${line}\r\n`)) await once(res, "drain");
  }
  res.end();
};

const verifyHandler: RequestHandler = async (_req, res) => {
  res.status(200).json(await getAuditVerification());
};

router.get("/", requireAuth, requireRole(...auditReaders), validate(AuditListQuerySchema, "query"), listHandler);
router.get(
  "/export",
  requireAuth,
  requireRole(...auditReaders),
  validate(AuditExportQuerySchema, "query"),
  exportHandler
);
router.get("/verify", requireAuth, requireRole(...verificationReaders), verifyHandler);

function csvCell(value: string | number | undefined): string {
  const text = value == null ? "" : String(value);
  const safeText = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return /[",\r\n]/.test(safeText) ? `"${safeText.replace(/"/g, '""')}"` : safeText;
}

export { router as auditRouter };