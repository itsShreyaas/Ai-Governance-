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
  UserRole,
} from "./enums.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const enumValues = <T extends Record<string, string>>(obj: T) =>
  Object.values(obj) as [string, ...string[]];

// ─── User ─────────────────────────────────────────────────────────────────────
// Server-controlled: isActive (defaults true), passwordHash (set by auth service)
export const CreateUserSchema = z
  .object({
    name: z.string().min(1).max(200),
    email: z.string().email().toLowerCase(),
    department: z.string().min(1).max(100),
    role: z.enum(enumValues(UserRole)),
    password: z.string().min(12).max(128).optional(), // absent for system users
  })
  .strict();

export const UpdateUserSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    department: z.string().min(1).max(100).optional(),
    role: z.enum(enumValues(UserRole)).optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

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
    toolId: z.string().optional(), // absent if tool not yet in registry
    toolName: z.string().max(200).optional(), // used when toolId is absent
    useCase: z.string().min(1).max(2000),
    dataTypes: z.array(z.string().min(1)).min(1),
  })
  .strict()
  .refine((d) => d.toolId !== undefined || d.toolName !== undefined, {
    message: "Either toolId or toolName is required",
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

// ─── Audit Event (internal — not exposed to clients directly) ─────────────────
// This schema is used ONLY by the audit service to validate what it builds
// internally before inserting.  It is not a client-facing input schema.
export const InternalAuditEventInputSchema = z
  .object({
    eventType: z.enum(enumValues(AuditEventType)),
    severity: z.enum(enumValues(AuditSeverity)),
    toolId: z.string().optional(),
    actorId: z.string(), // ObjectId as string
    department: z.string().max(100).optional(),
    details: z.string().max(5000),
  })
  .strict();

// ─── Settings (single document) ──────────────────────────────────────────────
export const UpdateSettingsSchema = z
  .object({
    organizationName: z.string().min(1).max(200).optional(),
    departments: z.array(z.string().min(1)).optional(),
    sensitivityTiers: z.array(z.string().min(1)).optional(),
    enabledFrameworks: z.array(z.enum(enumValues(AssessmentFramework))).optional(),
    scoreWeights: z
      .object({
        nistAiRmf: z.number().min(0).max(1),
        iso42001: z.number().min(0).max(1),
        euAiAct: z.number().min(0).max(1),
      })
      .optional(),
    slackWebhookUrl: z.string().url().optional().nullable(),
    smtpUrl: z.string().optional().nullable(),
  })
  .strict();

// ─── Inferred TS types ────────────────────────────────────────────────────────
export type CreateUserInput = z.infer<typeof CreateUserSchema>;
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
export type CreateToolInput = z.infer<typeof CreateToolSchema>;
export type UpdateToolInput = z.infer<typeof UpdateToolSchema>;
export type ToolDecisionInput = z.infer<typeof ToolDecisionSchema>;
export type CreatePolicyInput = z.infer<typeof CreatePolicySchema>;
export type CreateAssessmentInput = z.infer<typeof CreateAssessmentSchema>;
export type CreateRequestInput = z.infer<typeof CreateRequestSchema>;
export type RequestDecisionInput = z.infer<typeof RequestDecisionSchema>;
export type InternalAuditEventInput = z.infer<typeof InternalAuditEventInputSchema>;
export type UpdateSettingsInput = z.infer<typeof UpdateSettingsSchema>;
