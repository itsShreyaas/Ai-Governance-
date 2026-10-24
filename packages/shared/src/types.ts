/**
 * TypeScript types for the full DB document shapes (read side).
 * These include server-controlled fields that are absent from input schemas.
 */

import type {
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

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface UserDoc {
  _id: string;
  name: string;
  email: string;
  department: string;
  role: UserRole;
  passwordHash?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ToolDoc {
  _id: string;
  name: string;
  vendor: string;
  category: string;
  description?: string;
  approvalStatus: ApprovalStatus;
  riskLevel: RiskLevel;
  ownerDepartment: string;
  dataSensitivity: DataSensitivity;
  userCount: number;
  complianceScore: number;
  lastReviewed?: Date;
  personalData: boolean;
  archivedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PolicyDoc {
  _id: string;
  toolCategory: string;
  department: string;
  sensitivityTier: DataSensitivity;
  verdict: PolicyVerdict;
  conditions?: string;
  version: number;
  effectiveFrom: Date;
  author: string; // User ObjectId
  personalData: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AssessmentAnswer {
  questionId: string;
  value: string | number | boolean;
}

export interface AssessmentDoc {
  _id: string;
  toolId: string;
  framework: AssessmentFramework;
  answers: AssessmentAnswer[];
  riskLevel: RiskLevel;
  score: number;
  euRiskClass?: EuRiskClass;
  assessor: string; // User ObjectId
  status: AssessmentStatus;
  reviewDate?: Date;
  evidence: string[]; // GridFS file ids
  createdAt: Date;
  updatedAt: Date;
}

export interface RequestDoc {
  _id: string;
  toolId?: string;
  toolName?: string;
  requester: string; // User ObjectId
  useCase: string;
  dataTypes: string[];
  status: RequestStatus;
  reviewer?: string; // User ObjectId
  submittedAt: Date;
  decidedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuditEventDoc {
  _id: string;
  sequence: number;
  timestamp: Date;
  eventType: AuditEventType;
  severity: AuditSeverity;
  toolId?: string;
  actor?: string; // User ObjectId; absent for unauthenticated events
  department?: string;
  details: string;
  previousHash: string;
  hash: string;
}

export interface CounterDoc {
  _id: string; // e.g. "auditEvents"
  seq: number;
}

export interface RefreshTokenDoc {
  _id: string;
  userId: string;
  tokenHash: string;
  familyId: string;
  expiresAt: Date;
  revokedAt?: Date | null;
  createdAt: Date;
}

export interface SettingsDoc {
  _id: string;
  organizationName: string;
  departments: string[];
  sensitivityTiers: string[];
  enabledFrameworks: AssessmentFramework[];
  scoreWeights: {
    nistAiRmf: number;
    iso42001: number;
    euAiAct: number;
  };
  slackWebhookUrl?: string | null;
  smtpUrl?: string | null;
  updatedAt: Date;
}
