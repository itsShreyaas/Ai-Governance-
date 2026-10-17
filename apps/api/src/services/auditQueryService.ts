import mongoose from "mongoose";
import { AuditEventType, AuditSeverity } from "@aegisai/shared";
import type { AuditExportQuery, AuditListQuery } from "@aegisai/shared";
import { AuditEvent } from "../models/AuditEvent.js";
import { Tool } from "../models/Tool.js";
import { User } from "../models/User.js";
import { appendAuditEvent, verifyChain } from "./auditService.js";
import { paginate } from "./pagination.js";

type AuditFilters = Omit<AuditExportQuery, "from" | "to"> & { from?: Date; to?: Date };

export interface AuditActor {
  id: string;
  department: string;
  role: string;
}

export interface AuditCsvRow {
  sequence: number;
  timestamp: Date;
  eventType: string;
  severity: string;
  toolId?: mongoose.Types.ObjectId;
  toolName?: string;
  actorId: mongoose.Types.ObjectId;
  actorName?: string;
  department?: string;
  details: string;
}

function toMongoFilter(filters: AuditFilters, throughSequence?: number): Record<string, unknown> {
  const query: Record<string, unknown> = {};
  if (filters.eventType != null) query.eventType = filters.eventType;
  if (filters.toolId != null) query.toolId = new mongoose.Types.ObjectId(filters.toolId);
  if (filters.actor != null) query.actor = new mongoose.Types.ObjectId(filters.actor);
  if (filters.from != null || filters.to != null) {
    const timestamp: Record<string, Date> = {};
    if (filters.from != null) timestamp.$gte = filters.from;
    if (filters.to != null) timestamp.$lte = filters.to;
    query.timestamp = timestamp;
  }
  if (throughSequence != null) query.sequence = { $lte: throughSequence };
  return query;
}

export async function listAuditEvents(query: AuditListQuery) {
  const filters: AuditFilters = {
    ...(query.eventType == null ? {} : { eventType: query.eventType }),
    ...(query.toolId == null ? {} : { toolId: query.toolId }),
    ...(query.actor == null ? {} : { actor: query.actor }),
    ...(query.from == null ? {} : { from: query.from }),
    ...(query.to == null ? {} : { to: query.to }),
  };
  const mongoFilter = toMongoFilter(filters);
  const result = await paginate(
    AuditEvent.find(mongoFilter)
      .select("sequence timestamp eventType severity toolId actor department details")
      .sort({ [query.sort]: query.direction === "asc" ? 1 : -1, _id: 1 })
      .populate("actor", "name")
      .lean(),
    AuditEvent.countDocuments(mongoFilter),
    query.page,
    query.limit
  );

  const data = result.data.map((event) => {
    const actorRecord = event.actor as unknown as { _id?: mongoose.Types.ObjectId; name?: string };
    const actorId = actorRecord?._id?.toString() ?? String(event.actor);
    return {
      sequence: event.sequence,
      timestamp: event.timestamp,
      eventType: event.eventType,
      severity: event.severity,
      ...(event.toolId == null ? {} : { toolId: event.toolId.toString() }),
      actor: { id: actorId, name: actorRecord?.name ?? null },
      ...(event.department == null ? {} : { department: event.department }),
      details: event.details,
    };
  });

  return { ...result, data };
}

export async function createAuditExport(filters: AuditExportQuery, actor: AuditActor) {
  const latest = await AuditEvent.findOne({}, { sequence: 1 }).sort({ sequence: -1 }).lean();
  const throughSequence = latest?.sequence ?? 0;
  const mongoFilter = toMongoFilter(filters, throughSequence);
  const total = await AuditEvent.countDocuments(mongoFilter);
  const rowCount = Math.min(total, 10_000);
  const truncated = total > rowCount;

  const cursor = AuditEvent.aggregate<AuditCsvRow>([
    { $match: mongoFilter },
    { $sort: { timestamp: -1, sequence: -1 } },
    { $limit: 10_000 },
    {
      $lookup: {
        from: User.collection.name,
        localField: "actor",
        foreignField: "_id",
        pipeline: [{ $project: { name: 1 } }],
        as: "actorRecord",
      },
    },
    { $unwind: { path: "$actorRecord", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: Tool.collection.name,
        localField: "toolId",
        foreignField: "_id",
        pipeline: [{ $project: { name: 1 } }],
        as: "toolRecord",
      },
    },
    { $unwind: { path: "$toolRecord", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        sequence: 1,
        timestamp: 1,
        eventType: 1,
        severity: 1,
        toolId: 1,
        toolName: "$toolRecord.name",
        actorId: "$actor",
        actorName: "$actorRecord.name",
        department: 1,
        details: 1,
      },
    },
  ]).cursor({ batchSize: 200 });

  await appendAuditEvent({
    eventType: AuditEventType.Export,
    severity: AuditSeverity.Info,
    actorId: actor.id,
    department: actor.department,
    details: `Audit export; filters=${JSON.stringify(filters)}; rows=${rowCount}`,
  });

  return { cursor, rowCount, truncated };
}

export async function getAuditVerification() {
  const result = await verifyChain();
  return {
    valid: result.ok,
    checked: result.totalEvents,
    ...(result.firstBadSequence == null ? {} : { firstBrokenSequence: result.firstBadSequence }),
  };
}

