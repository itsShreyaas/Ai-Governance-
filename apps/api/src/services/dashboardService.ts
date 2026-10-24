import { ApprovalStatus, AssessmentStatus, RiskLevel, RequestStatus } from "@aegisai/shared";
import type { DashboardResponse } from "@aegisai/shared";
import { Assessment } from "../models/Assessment.js";
import { AuditEvent } from "../models/AuditEvent.js";
import { Request } from "../models/Request.js";
import { Tool } from "../models/Tool.js";
import { DashboardResponseSchema } from "@aegisai/shared";

const DAY_MS = 24 * 60 * 60 * 1000;
const statusColors: Record<string, string> = {
  [ApprovalStatus.Approved]: "#1B4D3E",
  [ApprovalStatus.PendingReview]: "#D97706",
  [ApprovalStatus.Restricted]: "#DC2626",
  [ApprovalStatus.Rejected]: "#991B1B",
  [ApprovalStatus.Revoked]: "#525252",
};
const riskColors: Record<string, string> = {
  [RiskLevel.Low]: "#15803D",
  [RiskLevel.Medium]: "#D97706",
  [RiskLevel.High]: "#DC2626",
};

export async function getDashboard(now = new Date()): Promise<DashboardResponse> {
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  const [toolStats, reviewStats, pendingReview, recentActivity, openAssessments] = await Promise.all([
    Tool.aggregate([
      { $match: { archivedAt: null } },
      {
        $facet: {
          kpis: [
            {
              $group: {
                _id: null,
                totalTools: { $sum: 1 },
                approvedTools: { $sum: { $cond: [{ $eq: ["$approvalStatus", ApprovalStatus.Approved] }, 1, 0] } },
                pendingTools: { $sum: { $cond: [{ $eq: ["$approvalStatus", ApprovalStatus.PendingReview] }, 1, 0] } },
                restrictedTools: { $sum: { $cond: [{ $eq: ["$approvalStatus", ApprovalStatus.Restricted] }, 1, 0] } },
                toolsAddedThisMonth: {
                  $sum: {
                    $cond: [
                      { $and: [{ $gte: ["$createdAt", monthStart] }, { $lt: ["$createdAt", nextMonthStart] }] },
                      1,
                      0,
                    ],
                  },
                },
              },
            },
            { $project: { _id: 0 } },
          ],
          byStatus: [{ $group: { _id: "$approvalStatus", count: { $sum: 1 } } }],
          byRisk: [{ $group: { _id: "$riskLevel", count: { $sum: 1 } } }],
        },
      },
    ]),
    Request.aggregate([
      {
        $match: {
          status: { $in: [RequestStatus.Approved, RequestStatus.Restricted, RequestStatus.Rejected] },
          decidedAt: { $type: "date" },
        },
      },
      {
        $group: {
          _id: null,
          avgReviewDays: {
            $avg: { $divide: [{ $subtract: ["$decidedAt", "$submittedAt"] }, DAY_MS] },
          },
        },
      },
    ]),
    Tool.aggregate([
      {
        $match: {
          archivedAt: null,
          $or: [
            { approvalStatus: ApprovalStatus.PendingReview },
            { riskLevel: RiskLevel.High },
          ],
        },
      },
      {
        $project: {
          id: { $toString: "$_id" },
          name: 1,
          vendor: 1,
          approvalStatus: 1,
          riskLevel: 1,
          ownerDepartment: 1,
          complianceScore: 1,
          iconColor: { $literal: null },
          submittedAt: "$createdAt",
          waitingOn: { $literal: null },
          kind: { $literal: "tool" },
        },
      },
      {
        $unionWith: {
          coll: Request.collection.name,
          pipeline: [
            { $match: { status: { $in: [RequestStatus.Submitted, RequestStatus.InReview] } } },
            {
              $lookup: {
                from: Tool.collection.name,
                localField: "toolId",
                foreignField: "_id",
                as: "linkedTool",
              },
            },
            { $unwind: { path: "$linkedTool", preserveNullAndEmptyArrays: true } },
            {
              $lookup: {
                from: "users",
                localField: "reviewer",
                foreignField: "_id",
                pipeline: [{ $project: { name: 1 } }],
                as: "reviewerRecord",
              },
            },
            { $unwind: { path: "$reviewerRecord", preserveNullAndEmptyArrays: true } },
            {
              $lookup: {
                from: "users",
                localField: "requester",
                foreignField: "_id",
                pipeline: [{ $project: { department: 1 } }],
                as: "requesterRecord",
              },
            },
            { $unwind: { path: "$requesterRecord", preserveNullAndEmptyArrays: true } },
            {
              $project: {
                id: { $toString: "$_id" },
                name: { $ifNull: ["$linkedTool.name", "$toolName"] },
                vendor: { $ifNull: ["$linkedTool.vendor", null] },
                approvalStatus: "$status",
                riskLevel: { $ifNull: ["$linkedTool.riskLevel", null] },
                ownerDepartment: { $ifNull: ["$linkedTool.ownerDepartment", "$requesterRecord.department"] },
                complianceScore: { $ifNull: ["$linkedTool.complianceScore", null] },
                iconColor: { $literal: null },
                submittedAt: 1,
                waitingOn: { $ifNull: ["$reviewerRecord.name", null] },
                kind: { $literal: "request" },
              },
            },
          ],
        },
      },
      { $sort: { submittedAt: 1, id: 1 } },
      { $limit: 5 },
      {
        $project: {
          _id: 0,
          id: 1,
          name: 1,
          vendor: 1,
          approvalStatus: 1,
          riskLevel: 1,
          ownerDepartment: 1,
          complianceScore: 1,
          iconColor: 1,
          submittedAt: 1,
          waitingOn: 1,
        },
      },
    ]),
    AuditEvent.aggregate([
      { $sort: { timestamp: -1, sequence: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "users",
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
          id: { $toString: "$_id" },
          eventType: 1,
          actorName: { $ifNull: ["$actorRecord.name", null] },
          toolName: { $ifNull: ["$toolRecord.name", null] },
          timestamp: 1,
          severity: 1,
        },
      },
    ]),
    Assessment.countDocuments({
      status: { $in: [AssessmentStatus.Draft, AssessmentStatus.Submitted] },
    }),
  ]);

  const stats = toolStats[0] ?? { kpis: [], byStatus: [], byRisk: [] };
  const kpis = stats.kpis[0] ?? {
    totalTools: 0,
    approvedTools: 0,
    pendingTools: 0,
    restrictedTools: 0,
    toolsAddedThisMonth: 0,
  };
  const statusCounts = new Map<string, number>(
    stats.byStatus.map((row: { _id: string; count: number }) => [row._id, row.count])
  );
  const riskCounts = new Map<string, number>(
    stats.byRisk.map((row: { _id: string; count: number }) => [row._id, row.count])
  );
  const totalTools = kpis.totalTools;

  return DashboardResponseSchema.parse({
    kpis: {
      ...kpis,
      avgReviewDays: reviewStats[0]?.avgReviewDays ?? null,
      openAssessments,
    },
    statusChartData: Object.values(ApprovalStatus).map((name) => ({
      name,
      value: statusCounts.get(name) ?? 0,
      color: statusColors[name]!,
    })),
    riskChartData: Object.values(RiskLevel).map((risk) => {
      const count = riskCounts.get(risk) ?? 0;
      return {
        level: `${risk} Risk`,
        count,
        fill: riskColors[risk]!,
        percentage: totalTools === 0 ? 0 : Math.round((count / totalTools) * 100),
      };
    }),
    toolsNeedingReview: pendingReview,
    recentAudits: recentActivity.map((event: {
      id: string;
      eventType: string;
      actorName: string | null;
      toolName: string | null;
      timestamp: Date;
      severity: string;
    }) => ({
      id: event.id,
      eventType: event.eventType,
      actorName: event.actorName,
      actorAvatar: event.actorName?.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() ?? "",
      toolName: event.toolName,
      timestamp: event.timestamp,
      severity: event.severity,
    })),
  });
}