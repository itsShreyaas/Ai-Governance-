/**
 * Zod INPUT schemas — what clients send to the API.
 *
 * Rules (per the plan):
 * - Server-controlled fields (approvalStatus, riskLevel, score, etc.) are
 *   ABSENT from create/update schemas.  They appear only on the read-shape
 *   (the TS types in types.ts), which the API populates from the DB.
 * - Every schema uses z.object() with strict mode (.strict()) so unknown
 *   keys are rejected (protects against mass-assignment / T6).
 */

import { z } from "zod";
import {
  ApprovalStatus,
  AssessmentFramework,
  AssessmentStatus,
  AuditEventType,
  AuditSeverity,
  DataSensitivity,
  EuRiskClass,
  PolicyVerdict,
  RequestStatus,
  RiskLevel,
  UserRole,
} from "./enums.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const enumValues = <T extends Record<string, string>>(obj: T) =>
  Object.values(obj) as [string, ...string[]];

export function paginatedQuerySchema<
  const SortFields extends readonly [string, ...string[]],
  Filters extends z.ZodRawShape,
>(sortFields: SortFields, filters: Filters, defaultSort: SortFields[number]) {
  return z
    .object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
      sort: z.enum(sortFields).default(defaultSort),
      direction: z.enum(["asc", "desc"]).default("desc"),
      ...filters,
    })
    .strict();
}

export const UserRoleSchema = z.enum(enumValues(UserRole));
const ManageableUserRoleSchema = z.enum([
  UserRole.Admin,
  UserRole.Compliance,
  UserRole.Requester,
  UserRole.Employee,
  UserRole.Auditor,
]);

// ─── User ─────────────────────────────────────────────────────────────────────
// Server-controlled: isActive (defaults true), passwordHash (set by auth service)
export const LoginSchema = z
  .object({
    email: z.string().email().toLowerCase(),
    password: z.string().min(1).max(128),
  })
  .strict();

export const AccessTokenSchema = z.string().regex(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
export const RefreshTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{64}$/);
export const CsrfHeaderSchema = z.literal("1");

export const CreateUserSchema = z
  .object({
    name: z.string().min(1).max(200),
    email: z.string().email().toLowerCase(),
    department: z.string().min(1).max(100),
    role: ManageableUserRoleSchema,
    password: z.string().min(12).max(128),
  })
  .strict();

export const UpdateUserSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    department: z.string().min(1).max(100).optional(),
    role: ManageableUserRoleSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

export const UserListQuerySchema = paginatedQuerySchema(
  ["createdAt", "name", "email", "department", "role"] as const,
  {
    role: z.enum(enumValues(UserRole)).optional(),
    department: z.string().min(1).max(100).optional(),
    isActive: z.enum(["true", "false"]).transform((value) => value === "true").optional(),
  },
  "createdAt"
);

// ─── Tool ────────────────────────────────────────────────────────────────────
// Server-controlled: approvalStatus, riskLevel, complianceScore, lastReviewed, archivedAt
export const CreateToolSchema = z
  .object({
    name: z.string().min(1).max(200),
    vendor: z.string().min(1).max(200),
    category: z.string().min(1).max(100),
    description: z.string().max(2000).optional(),
    ownerDepartment: z.string().min(1).max(100),
    dataSensitivity: z.enum(enumValues(DataSensitivity)),
    userCount: z.number().int().min(0),
    personalData: z.boolean().default(false),
  })
  .strict();

export const UpdateToolSchema = CreateToolSchema.partial().strict();

// Admins/Compliance use this to record a governance decision on an existing tool
export const ToolDecisionSchema = z
  .object({
    approvalStatus: z.enum([
      ApprovalStatus.Approved,
      ApprovalStatus.Restricted,
      ApprovalStatus.Rejected,
      ApprovalStatus.Revoked,
    ]),
    reason: z.string().min(1).max(2000),
  })
  .strict();

export const ToolIdParamsSchema = z.object({ id: z.string().regex(/^[a-f\d]{24}$/i) }).strict();

export const ToolListQuerySchema = paginatedQuerySchema(
  ["createdAt", "name", "updatedAt", "approvalStatus"] as const,
  {
    search: z.string().max(200).optional(),
    approvalStatus: z.enum(enumValues(ApprovalStatus)).optional(),
    riskLevel: z.enum(enumValues(RiskLevel)).optional(),
    category: z.string().max(100).optional(),
    ownerDepartment: z.string().max(100).optional(),
    dataSensitivity: z.enum(enumValues(DataSensitivity)).optional(),
  },
  "createdAt"
);

// ─── Policy ──────────────────────────────────────────────────────────────────
// Server-controlled: version (auto-increment), author (from session)
export const CreatePolicySchema = z
  .object({
    toolCategory: z.string().min(1).max(100),
    department: z.string().min(1).max(100),
    sensitivityTier: z.enum(enumValues(DataSensitivity)),
    verdict: z.enum(enumValues(PolicyVerdict)),
    conditions: z.string().max(2000).optional(),
    effectiveFrom: z.coerce.date(),
    personalData: z.boolean().default(false),
  })
  .strict();

// ─── Assessment ───────────────────────────────────────────────────────────────
// Server-controlled: riskLevel, score (computed by scoring function), assessor (from session)
export const AssessmentAnswerSchema = z
  .object({
    questionId: z.string().min(1),
    value: z.union([z.string(), z.number(), z.boolean()]),
  })
  .strict();

export const CreateAssessmentSchema = z
  .object({
    toolId: z.string().min(1), // ObjectId as string; API converts to ObjectId
    framework: z.enum(enumValues(AssessmentFramework)),
    answers: z.array(AssessmentAnswerSchema).min(1),
    euRiskClass: z.enum(enumValues(EuRiskClass)).optional(),
    status: z.enum(enumValues(AssessmentStatus)).default(AssessmentStatus.Draft),
    reviewDate: z.coerce.date().optional(),
  })
  .strict();

// ─── Tool Request ─────────────────────────────────────────────────────────────
// Server-controlled: status (starts as Submitted), reviewer, submittedAt, decidedAt
export const CreateRequestSchema = z
  .object({
    toolId: z.string().regex(/^[a-f\d]{24}$/i).optional(), // absent if tool not yet in registry
    toolName: z.string().min(1).max(200).optional(), // used when toolId is absent
    useCase: z.string().min(1).max(2000),
    dataTypes: z.array(z.string().min(1)).min(1),
  })
  .strict()
  .refine((d) => (d.toolId !== undefined) !== (d.toolName !== undefined), {
    message: "Provide either toolId or toolName, but not both",
  });

export const RequestListQuerySchema = paginatedQuerySchema(
  ["createdAt", "submittedAt", "status"] as const,
  {
    status: z.enum(enumValues(RequestStatus)).optional(),
  },
  "submittedAt"
);

export const UpdateRequestSchema = z
  .object({
    reviewer: z.string().regex(/^[a-f\d]{24}$/i).optional(),
    status: z.enum(enumValues(RequestStatus)).optional(),
  })
  .strict()
  .refine((input) => input.reviewer !== undefined || input.status !== undefined, {
    message: "At least one of reviewer or status is required",
  });

export const RequestDecisionSchema = z
  .object({
    status: z.enum([
      RequestStatus.Approved,
      RequestStatus.Restricted,
      RequestStatus.Rejected,
    ]),
    reason: z.string().min(1).max(2000),
  })
  .strict();

const auditFilterShape = {
  eventType: z.enum(enumValues(AuditEventType)).optional(),
  toolId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  actor: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
};

function validateAuditDateRange(
  filters: { from?: Date; to?: Date },
  context: z.RefinementCtx
): void {
  if (filters.from != null && filters.to != null && filters.from > filters.to) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "from must be earlier than or equal to to" });
  }
}

export const AuditListQuerySchema = paginatedQuerySchema(
  ["timestamp", "eventType", "severity", "sequence"] as const,
  auditFilterShape,
  "timestamp"
)
  .superRefine(validateAuditDateRange);

export const AuditExportQuerySchema = z
  .object(auditFilterShape)
  .strict()
  .superRefine(validateAuditDateRange);

export const DashboardResponseSchema = z
  .object({
    kpis: z.object({
      totalTools: z.number().int().nonnegative(),
      approvedTools: z.number().int().nonnegative(),
      pendingTools: z.number().int().nonnegative(),
      restrictedTools: z.number().int().nonnegative(),
      toolsAddedThisMonth: z.number().int().nonnegative(),
      avgReviewDays: z.number().nonnegative().nullable(),
      openAssessments: z.number().int().nonnegative(),
    }).strict(),
    statusChartData: z.array(z.object({
      name: z.enum(enumValues(ApprovalStatus)),
      value: z.number().int().nonnegative(),
      color: z.string(),
    }).strict()),
    riskChartData: z.array(z.object({
      level: z.string(),
      count: z.number().int().nonnegative(),
      fill: z.string(),
      percentage: z.number().min(0).max(100),
    }).strict()),
    toolsNeedingReview: z.array(z.object({
      id: z.string(),
      name: z.string(),
      vendor: z.string().nullable(),
      approvalStatus: z.string(),
      riskLevel: z.enum(enumValues(RiskLevel)).nullable(),
      ownerDepartment: z.string().nullable(),
      complianceScore: z.number().nullable(),
      iconColor: z.string().nullable(),
      submittedAt: z.date(),
      waitingOn: z.string().nullable(),
    }).strict()).max(5),
    recentAudits: z.array(z.object({
      id: z.string(),
      eventType: z.enum(enumValues(AuditEventType)),
      actorName: z.string().nullable(),
      actorAvatar: z.string(),
      toolName: z.string().nullable(),
      timestamp: z.date(),
      severity: z.enum(enumValues(AuditSeverity)),
    }).strict()).max(10),
  })
  .strict();

// ─── Audit Event (internal — not exposed to clients directly) ─────────────────
// This schema is used ONLY by the audit service to validate what it builds
// internally before inserting.  It is not a client-facing input schema.
export const InternalAuditEventInputSchema = z
  .object({
    eventType: z.enum(enumValues(AuditEventType)),
    severity: z.enum(enumValues(AuditSeverity)),
    toolId: z.string().optional(),
    actorId: z.string().optional(), // ObjectId as string
    department: z.string().max(100).optional(),
    details: z.string().max(5000),
  })
  .strict();

// ─── Settings (single document) ──────────────────────────────────────────────
const ScoreWeightsSchema = z
  .object({
    nistAiRmf: z.number().min(0).max(1),
    iso42001: z.number().min(0).max(1),
    euAiAct: z.number().min(0).max(1),
  })
  .strict()
  .refine((weights) => Math.abs(weights.nistAiRmf + weights.iso42001 + weights.euAiAct - 1) <= 0.001, {
    message: "Score weights must sum to 1",
  });

export const UpdateSettingsSchema = z
  .object({
    organizationName: z.string().min(1).max(200).optional(),
    departments: z.array(z.string().min(1)).optional(),
    sensitivityTiers: z.array(z.string().min(1)).optional(),
    enabledFrameworks: z.array(z.enum(enumValues(AssessmentFramework))).optional(),
    scoreWeights: ScoreWeightsSchema.optional(),
    slackWebhookUrl: z
      .string()
      .url()
      .refine((url) => new URL(url).protocol === "https:", "Slack webhook URL must use HTTPS")
      .optional()
      .nullable(),
    smtpUrl: z.string().optional().nullable(),
  })
  .strict()
  .refine((settings) => Object.keys(settings).length > 0, {
    message: "At least one settings field must be provided",
  });

// ─── Inferred TS types ────────────────────────────────────────────────────────
export type CreateUserInput = z.infer<typeof CreateUserSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type AccessTokenInput = z.infer<typeof AccessTokenSchema>;
export type RefreshTokenInput = z.infer<typeof RefreshTokenSchema>;
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
export type UserListQuery = z.infer<typeof UserListQuerySchema>;
export type CreateToolInput = z.infer<typeof CreateToolSchema>;
export type UpdateToolInput = z.infer<typeof UpdateToolSchema>;
export type ToolDecisionInput = z.infer<typeof ToolDecisionSchema>;
export type ToolListQuery = z.infer<typeof ToolListQuerySchema>;
export type CreatePolicyInput = z.infer<typeof CreatePolicySchema>;
export type CreateAssessmentInput = z.infer<typeof CreateAssessmentSchema>;
export type CreateRequestInput = z.infer<typeof CreateRequestSchema>;
export type RequestListQuery = z.infer<typeof RequestListQuerySchema>;
export type UpdateRequestInput = z.infer<typeof UpdateRequestSchema>;
export type AuditListQuery = z.infer<typeof AuditListQuerySchema>;
export type AuditExportQuery = z.infer<typeof AuditExportQuerySchema>;
export type DashboardResponse = z.infer<typeof DashboardResponseSchema>;
export type RequestDecisionInput = z.infer<typeof RequestDecisionSchema>;
export type InternalAuditEventInput = z.infer<typeof InternalAuditEventInputSchema>;
export type UpdateSettingsInput = z.infer<typeof UpdateSettingsSchema>;
