import mongoose from "mongoose";
import { AuditEventType, AuditSeverity, ApprovalStatus } from "@aegisai/shared";
import type { CreateToolInput, ToolDecisionInput, ToolListQuery, UpdateToolInput } from "@aegisai/shared";
import { HttpError } from "../middleware/httpError.js";
import { Tool, type ITool } from "../models/Tool.js";
import { appendAuditEvent } from "./auditService.js";
import { paginate } from "./pagination.js";

export interface ToolActor {
  id: string;
  department: string;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function listTools(query: ToolListQuery) {
  const filter: Record<string, unknown> = { archivedAt: null };
  if (query.approvalStatus != null) filter.approvalStatus = query.approvalStatus;
  if (query.riskLevel != null) filter.riskLevel = query.riskLevel;
  if (query.category != null) filter.category = query.category;
  if (query.ownerDepartment != null) filter.ownerDepartment = query.ownerDepartment;
  if (query.dataSensitivity != null) filter.dataSensitivity = query.dataSensitivity;
  if (query.search != null && query.search.length > 0) {
    const search = new RegExp(escapeRegex(query.search), "i");
    filter.$or = [{ name: search }, { vendor: search }, { description: search }];
  }

  return paginate(
    Tool.find(filter).sort({ [query.sort]: query.direction === "asc" ? 1 : -1, _id: 1 }).lean(),
    Tool.countDocuments(filter),
    query.page,
    query.limit
  );
}

export async function createTool(input: CreateToolInput, actor: ToolActor) {
  const session = await mongoose.startSession();
  let created: Awaited<ReturnType<typeof Tool.create>>[number] | undefined;
  try {
    await session.withTransaction(async () => {
      const [tool] = await Tool.create([input], { session });
      if (tool == null) throw new Error("Tool creation failed");
      await appendAuditEvent(
        {
          eventType: AuditEventType.ToolSubmission,
          severity: AuditSeverity.Info,
          toolId: tool._id.toString(),
          actorId: actor.id,
          department: actor.department,
          details: `Tool registered: ${tool.name}`,
        },
        session
      );
      created = tool;
    });
    if (created == null) throw new Error("Tool creation transaction did not complete");
    return created;
  } finally {
    await session.endSession();
  }
}

export async function updateTool(id: string, input: UpdateToolInput, actor: ToolActor) {
  const session = await mongoose.startSession();
  let updated: ITool | null = null;
  try {
    await session.withTransaction(async () => {
      updated = await Tool.findOneAndUpdate(
        { _id: id, archivedAt: null },
        { $set: input },
        { new: true, runValidators: true, session }
      );
      if (updated == null) throw new HttpError(404, "TOOL_NOT_FOUND", "Tool was not found");
      await appendAuditEvent(
        {
          eventType: AuditEventType.ToolUpdated,
          severity: AuditSeverity.Info,
          toolId: id,
          actorId: actor.id,
          department: actor.department,
          details: `Tool updated: ${updated.name}`,
        },
        session
      );
    });
    return updated;
  } finally {
    await session.endSession();
  }
}

export async function decideTool(id: string, input: ToolDecisionInput, actor: ToolActor) {
  const session = await mongoose.startSession();
  let updated: ITool | null = null;
  try {
    await session.withTransaction(async () => {
      updated = await applyToolDecision(id, input, actor, session);
    });
    return updated;
  } finally {
    await session.endSession();
  }
}

export async function applyToolDecision(
  id: string,
  input: ToolDecisionInput,
  actor: ToolActor,
  session: mongoose.ClientSession
): Promise<ITool> {
  const updated = await Tool.findOneAndUpdate(
    { _id: id, archivedAt: null },
    { $set: { approvalStatus: input.approvalStatus, lastReviewed: new Date() } },
    { new: true, runValidators: true, session }
  );
  if (updated == null) throw new HttpError(404, "TOOL_NOT_FOUND", "Tool was not found");
  await appendAuditEvent(
    {
      eventType: AuditEventType.ToolDecision,
      severity: input.approvalStatus === ApprovalStatus.Rejected ? AuditSeverity.Warning : AuditSeverity.Info,
      toolId: id,
      actorId: actor.id,
      department: actor.department,
      details: `Tool decision: ${input.approvalStatus}. Reason: ${input.reason}`,
    },
    session
  );
  return updated;
}