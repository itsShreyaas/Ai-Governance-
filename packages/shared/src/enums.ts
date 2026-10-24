// ─── Approval Status ────────────────────────────────────────────────────────
export const ApprovalStatus = {
  Approved: "Approved",
  PendingReview: "Pending Review",
  Restricted: "Restricted",
  Rejected: "Rejected",
  Revoked: "Revoked",
} as const;
export type ApprovalStatus = (typeof ApprovalStatus)[keyof typeof ApprovalStatus];

// ─── Risk Level ──────────────────────────────────────────────────────────────
export const RiskLevel = {
  Low: "Low",
  Medium: "Medium",
  High: "High",
} as const;
export type RiskLevel = (typeof RiskLevel)[keyof typeof RiskLevel];

// ─── Data Sensitivity ────────────────────────────────────────────────────────
export const DataSensitivity = {
  InternalOnly: "Internal Only",
  Confidential: "Confidential",
  Restricted: "Restricted",
} as const;
export type DataSensitivity = (typeof DataSensitivity)[keyof typeof DataSensitivity];

// ─── Audit Event Type ────────────────────────────────────────────────────────
export const AuditEventType = {
  ToolSubmission: "TOOL_SUBMISSION",
  ToolUpdated: "TOOL_UPDATED",
  RequestSubmitted: "REQUEST_SUBMITTED",
  RequestReviewed: "REQUEST_REVIEWED",
  PolicyUpdate: "POLICY_UPDATE",
  ApprovalGranted: "APPROVAL_GRANTED",
  RiskEscalation: "RISK_ESCALATION",
  ComplianceScan: "COMPLIANCE_SCAN",
  AccessRevocation: "ACCESS_REVOCATION",
  ToolDecision: "TOOL_DECISION",
  UserCreated: "USER_CREATED",
  UserUpdated: "USER_UPDATED",
  RoleChanged: "ROLE_CHANGED",
  SettingsUpdated: "SETTINGS_UPDATED",
  Login: "LOGIN",
  LoginFailed: "LOGIN_FAILED",
  Logout: "LOGOUT",
  SessionRefresh: "SESSION_REFRESH",
  Export: "EXPORT",
  ChainVerifyFailed: "CHAIN_VERIFY_FAILED",
} as const;
export type AuditEventType = (typeof AuditEventType)[keyof typeof AuditEventType];

// ─── Audit Severity ──────────────────────────────────────────────────────────
export const AuditSeverity = {
  Info: "info",
  Warning: "warning",
  Success: "success",
  Critical: "critical",
} as const;
export type AuditSeverity = (typeof AuditSeverity)[keyof typeof AuditSeverity];

// ─── User Role ───────────────────────────────────────────────────────────────
export const UserRole = {
  Admin: "Admin",
  Compliance: "Compliance",
  Requester: "Requester",
  Employee: "Employee",
  Auditor: "Auditor",
  System: "system",
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

// ─── Policy Verdict ──────────────────────────────────────────────────────────
export const PolicyVerdict = {
  Allowed: "Allowed",
  Conditional: "Conditional",
  Blocked: "Blocked",
} as const;
export type PolicyVerdict = (typeof PolicyVerdict)[keyof typeof PolicyVerdict];

// ─── Assessment Framework ────────────────────────────────────────────────────
export const AssessmentFramework = {
  NistAiRmf: "NIST AI RMF",
  Iso42001: "ISO 42001",
  EuAiAct: "EU AI Act",
} as const;
export type AssessmentFramework =
  (typeof AssessmentFramework)[keyof typeof AssessmentFramework];

// ─── Assessment Status ───────────────────────────────────────────────────────
export const AssessmentStatus = {
  Draft: "Draft",
  Submitted: "Submitted",
  Approved: "Approved",
} as const;
export type AssessmentStatus = (typeof AssessmentStatus)[keyof typeof AssessmentStatus];

// ─── EU Risk Class ───────────────────────────────────────────────────────────
export const EuRiskClass = {
  Minimal: "Minimal",
  Limited: "Limited",
  High: "High",
  Unacceptable: "Unacceptable",
} as const;
export type EuRiskClass = (typeof EuRiskClass)[keyof typeof EuRiskClass];

// ─── Request Status ──────────────────────────────────────────────────────────
export const RequestStatus = {
  Submitted: "Submitted",
  InReview: "In review",
  Approved: "Approved",
  Restricted: "Restricted",
  Rejected: "Rejected",
} as const;
export type RequestStatus = (typeof RequestStatus)[keyof typeof RequestStatus];
