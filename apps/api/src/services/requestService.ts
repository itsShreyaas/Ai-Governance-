import mongoose from "mongoose";
import { ApprovalStatus, AuditEventType, AuditSeverity, RequestStatus, UserRole } from "@aegisai/shared";
import type { CreateRequestInput, RequestListQuery, UpdateRequestInput } from "@aegisai/shared";
import { HttpError } from "../middleware/httpError.js";
import { Request } from "../models/Request.js";
import { Tool } from "../models/Tool.js";
import { User, type IUser } from "../models/User.js";
import type { RequestStatus as RequestStatusType } from "@aegisai/shared";
import { appendAuditEvent } from "./auditService.js";
import { applyToolDecision } from "./toolService.js";
import { paginate } from "./pagination.js";

export interface RequestActor {
  id: string;
  department: string;
  role: string;
}

export async function createRequest(input: CreateRequestInput, actor: RequestActor) {
  const session = await mongoose.startSession();
  let created: Awaited<ReturnType<typeof Request.create>>[number] | undefined;
  try {
    await session.withTransaction(async () => {
      if (input.toolId != null) {
        const tool = await Tool.findOne({ _id: input.toolId, archivedAt: null }).session(session);
        if (tool == null) throw new HttpError(404, "TOOL_NOT_FOUND", "Tool was not found");
      }

      const [record] = await Request.create(
        [
          {
            ...(input.toolId == null ? { toolName: input.toolName } : { toolId: input.toolId }),
            requester: actor.id,
            useCase: input.useCase,
            dataTypes: input.dataTypes,
            status: RequestStatus.Submitted,
            submittedAt: new Date(),
          },
        ],
        { session }
      );
      if (record == null) throw new Error("Request creation failed");

      await appendAuditEvent(
        {
          eventType: AuditEventType.RequestSubmitted,
          severity: AuditSeverity.Info,
          ...(input.toolId == null ? {} : { toolId: input.toolId }),
          actorId: actor.id,
          department: actor.department,
          details: "Tool request submitted",
        },
        session
      );
      created = record;
    });
    if (created == null) throw new Error("Request creation transaction did not complete");
    return created;
  } finally {
    await session.endSession();
  }
}

export async function listRequests(query: RequestListQuery, actor: RequestActor) {
  const filter: Record<string, unknown> = {};
  if (query.status != null) filter.status = query.status;
  if (actor.role === UserRole.Requester) filter.requester = actor.id;

  return paginate(
    Request.find(filter).sort({ [query.sort]: query.direction === "asc" ? 1 : -1, _id: 1 }).lean(),
    Request.countDocuments(filter),
    query.page,
    query.limit
  );
}

export async function reviewRequest(id: string, input: UpdateRequestInput, actor: RequestActor) {
  const session = await mongoose.startSession();
  let updated: Awaited<ReturnType<typeof Request.findById>> | null = null;
  try {
    await session.withTransaction(async () => {
      const record = await Request.findById(id).session(session);
      if (record == null) throw new HttpError(404, "REQUEST_NOT_FOUND", "Request was not found");

      const terminalStatuses = [RequestStatus.Approved, RequestStatus.Restricted, RequestStatus.Rejected];
      if (terminalStatuses.includes(record.status as (typeof terminalStatuses)[number])) {
        throw new HttpError(409, "REQUEST_FINAL", "A decided request cannot be changed");
      }

      if (input.status != null) {
        const allowedNextStatuses: RequestStatusType[] =
          record.status === RequestStatus.Submitted
            ? [RequestStatus.InReview]
            : record.status === RequestStatus.InReview
              ? terminalStatuses
              : [];
        if (!allowedNextStatuses.includes(input.status as (typeof allowedNextStatuses)[number])) {
          throw new HttpError(409, "INVALID_REQUEST_TRANSITION", "The request status transition is not allowed");
        }
      }

      const reviewerId = input.reviewer ?? record.reviewer?.toString();
      const needsReviewer = input.reviewer != null || input.status === RequestStatus.InReview ||
        (input.status != null && terminalStatuses.includes(input.status as (typeof terminalStatuses)[number]));
      let reviewer: IUser | null = null;
      if (needsReviewer) {
        if (reviewerId == null) {
          throw new HttpError(400, "REVIEWER_REQUIRED", "A reviewer is required to start or decide a review");
        }
        if (reviewerId === record.requester.toString()) {
          throw new HttpError(403, "SELF_REVIEW_DENIED", "The requester cannot review their own request");
        }
        reviewer = await User.findById(reviewerId).session(session);
        if (reviewer == null) throw new HttpError(404, "REVIEWER_NOT_FOUND", "Reviewer was not found");
        if (
          !reviewer.isActive ||
          (reviewer.role !== UserRole.Admin && reviewer.role !== UserRole.Compliance)
        ) {
          throw new HttpError(400, "INVALID_REVIEWER", "Reviewer must be an active Admin or Compliance user");
        }
        record.reviewer = reviewer._id;
      }

      if (input.status != null) {
        record.status = input.status;
        if (terminalStatuses.includes(input.status as (typeof terminalStatuses)[number])) {
          record.decidedAt = new Date();
          if (record.toolId != null && input.status !== RequestStatus.Rejected) {
            const approvalStatus = input.status === RequestStatus.Approved
              ? ApprovalStatus.Approved
              : ApprovalStatus.Restricted;
            await applyToolDecision(
              record.toolId.toString(),
              {
                approvalStatus,
                reason: `Request ${record._id.toString()} decided ${input.status}`,
              },
              actor,
              session
            );
          }
        }
      }

      await record.save({ session });
      await appendAuditEvent(
        {
          eventType: AuditEventType.RequestReviewed,
          severity: input.status === RequestStatus.Approved
            ? AuditSeverity.Success
            : input.status === RequestStatus.Rejected
              ? AuditSeverity.Warning
              : AuditSeverity.Info,
          ...(record.toolId == null ? {} : { toolId: record.toolId.toString() }),
          actorId: actor.id,
          department: actor.department,
          details: input.status == null
            ? `Reviewer assigned to request ${record._id.toString()}`
            : `Request ${record._id.toString()} moved to ${input.status}`,
        },
        session
      );
      updated = record;
    });
    return updated;
  } finally {
    await session.endSession();
  }
}