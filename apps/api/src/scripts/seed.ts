/**
 * Seed script — loads mock data from src/data/mockData.js
 * (replicated here as TypeScript so the script has no dependency on the
 * frontend source tree, keeping apps/api fully independent).
 *
 * Inserts:
 *  - 1  system user ("Automated Scanner / sentinel")
 *  - 4  human users  (Marcus Brody, Elena Rostova, Sarah Chen, Devon Reed,
 *                     Alex Vance → 5 human actors)
 *  - 6  AI tools
 *  - 10 audit events (written through auditService so the chain is valid)
 *
 * Idempotent: existing data is deleted first (dev only — never in production).
 */

import "dotenv/config";
import { connectDB, disconnectDB } from "../db/connection.js";
import { User } from "../models/User.js";
import { Tool } from "../models/Tool.js";
import { AuditEvent } from "../models/AuditEvent.js";
import { Counter } from "../models/Counter.js";
import { Settings } from "../models/Settings.js";
import { appendAuditEvent } from "../services/auditService.js";
import {
  ApprovalStatus,
  AuditEventType,
  AuditSeverity,
  DataSensitivity,
  RiskLevel,
  UserRole,
} from "@aegisai/shared";

// ─── Seed Data ────────────────────────────────────────────────────────────────

const SEED_USERS = [
  {
    name: "Automated Scanner",
    email: "sentinel@acmecorp.com",
    department: "System Sentinel",
    role: UserRole.System,
  },
  {
    name: "Marcus Brody",
    email: "marcus.b@acmecorp.com",
    department: "InfoSec & Governance",
    role: UserRole.Admin,
    passwordHash: "SEED_PLACEHOLDER_NOT_USABLE",
  },
  {
    name: "Elena Rostova",
    email: "elena.r@acmecorp.com",
    department: "Legal & Compliance",
    role: UserRole.Compliance,
    passwordHash: "SEED_PLACEHOLDER_NOT_USABLE",
  },
  {
    name: "Sarah Chen",
    email: "sarah.c@acmecorp.com",
    department: "Design Systems",
    role: UserRole.Requester,
    passwordHash: "SEED_PLACEHOLDER_NOT_USABLE",
  },
  {
    name: "Devon Reed",
    email: "devon.r@acmecorp.com",
    department: "Data Science",
    role: UserRole.Requester,
    passwordHash: "SEED_PLACEHOLDER_NOT_USABLE",
  },
  {
    name: "Alex Vance",
    email: "alex.v@acmecorp.com",
    department: "Chief Compliance Office",
    role: UserRole.Compliance,
    passwordHash: "SEED_PLACEHOLDER_NOT_USABLE",
  },
] as const;

const SEED_TOOLS = [
  {
    name: "ChatGPT Enterprise",
    vendor: "OpenAI",
    category: "LLM / General Assistant",
    approvalStatus: ApprovalStatus.Approved,
    riskLevel: RiskLevel.Low,
    ownerDepartment: "Product & Engineering",
    dataSensitivity: DataSensitivity.Confidential,
    userCount: 420,
    complianceScore: 96,
    lastReviewed: new Date("2026-09-28"),
    description:
      "Dedicated enterprise LLM workspace with zero-data-retention training agreement and SSO enforcement.",
    personalData: false,
  },
  {
    name: "GitHub Copilot",
    vendor: "Microsoft / GitHub",
    category: "Code Generation",
    approvalStatus: ApprovalStatus.Approved,
    riskLevel: RiskLevel.Medium,
    ownerDepartment: "Engineering",
    dataSensitivity: DataSensitivity.Restricted,
    userCount: 280,
    complianceScore: 89,
    lastReviewed: new Date("2026-09-15"),
    description:
      "AI pair programmer integrated into developer IDEs. Telemetry filtered; public code matching blocked.",
    personalData: false,
  },
  {
    name: "Claude 3.5 Sonnet",
    vendor: "Anthropic",
    category: "LLM & Code Synthesis",
    approvalStatus: ApprovalStatus.PendingReview,
    riskLevel: RiskLevel.Medium,
    ownerDepartment: "Data Science & Legal",
    dataSensitivity: DataSensitivity.Confidential,
    userCount: 65,
    complianceScore: 82,
    lastReviewed: new Date("2026-10-04"),
    description:
      "Advanced reasoning model under vendor security evaluation for SOC 2 Type II compliance.",
    personalData: false,
  },
  {
    name: "Midjourney v6",
    vendor: "Midjourney Inc.",
    category: "Image Generation",
    approvalStatus: ApprovalStatus.Restricted,
    riskLevel: RiskLevel.High,
    ownerDepartment: "Marketing & Design",
    dataSensitivity: DataSensitivity.InternalOnly,
    userCount: 24,
    complianceScore: 61,
    lastReviewed: new Date("2026-08-19"),
    description:
      "Restricted to vetted Marketing campaigns. Prohibited for any proprietary IP, customer logos, or PII.",
    personalData: false,
  },
  {
    name: "Perplexity Enterprise",
    vendor: "Perplexity AI",
    category: "Search & Research Assistant",
    approvalStatus: ApprovalStatus.Approved,
    riskLevel: RiskLevel.Low,
    ownerDepartment: "Executive & Strategy",
    dataSensitivity: DataSensitivity.InternalOnly,
    userCount: 150,
    complianceScore: 94,
    lastReviewed: new Date("2026-10-01"),
    description:
      "Real-time conversational web index with enterprise citation verification and privacy guarantee.",
    personalData: false,
  },
  {
    name: "v0 by Vercel",
    vendor: "Vercel",
    category: "UI & Frontend Generation",
    approvalStatus: ApprovalStatus.PendingReview,
    riskLevel: RiskLevel.High,
    ownerDepartment: "Design Systems",
    dataSensitivity: DataSensitivity.Confidential,
    userCount: 45,
    complianceScore: 74,
    lastReviewed: new Date("2026-10-09"),
    description:
      "Generative UI component builder. Security assessment underway regarding code repository ingestion.",
    personalData: false,
  },
] as const;

// ─── Main ─────────────────────────────────────────────────────────────────────

async function seed() {
  await connectDB();

  console.log("⚠️  Clearing existing seed collections...");
  await Promise.all([
    AuditEvent.deleteMany({}),
    Counter.deleteMany({}),
    Tool.deleteMany({}),
    User.deleteMany({}),
    Settings.deleteMany({}),
  ]);

  // ── Users
  console.log("👤 Inserting users...");
  const insertedUsers = await User.insertMany(SEED_USERS as unknown as object[]);
  const userByEmail = new Map(
    insertedUsers.map((u) => [u.email, u._id.toString()])
  );

  // ── Tools
  console.log("🛠️  Inserting tools...");
  const insertedTools = await Tool.insertMany(SEED_TOOLS as unknown as object[]);
  const toolByName = new Map(
    insertedTools.map((t) => [t.name, t._id.toString()])
  );

  // ── Settings (single doc)
  await Settings.create({ organizationName: "Acme Global" });

  // ── Audit Events (written through auditService so the chain is valid)
  console.log("📋 Inserting audit events through audit service...");

  type EventDef = {
    eventType: AuditEventType;
    severity: AuditSeverity;
    toolName?: string;
    actorEmail: string;
    department: string;
    details: string;
    hoursAgo: number;
  };

  const auditDefs: EventDef[] = [
    {
      eventType: AuditEventType.ToolSubmission,
      severity: AuditSeverity.Info,
      toolName: "v0 by Vercel",
      actorEmail: "sarah.c@acmecorp.com",
      department: "Design Systems",
      details: "Submitted procurement request and architecture diagram for enterprise license.",
      hoursAgo: 0.2,
    },
    {
      eventType: AuditEventType.PolicyUpdate,
      severity: AuditSeverity.Warning,
      toolName: "Midjourney v6",
      actorEmail: "marcus.b@acmecorp.com",
      department: "InfoSec & Governance",
      details:
        "Restricted data ingress policy enforced: blocked prompt uploads containing client deliverables.",
      hoursAgo: 0.75,
    },
    {
      eventType: AuditEventType.ApprovalGranted,
      severity: AuditSeverity.Success,
      toolName: "Perplexity Enterprise",
      actorEmail: "elena.r@acmecorp.com",
      department: "Legal & Compliance",
      details: "Annual SOC 2 audit cleared; license auto-renewal approved for 150 seats.",
      hoursAgo: 2,
    },
    {
      eventType: AuditEventType.RiskEscalation,
      severity: AuditSeverity.Critical,
      toolName: "Midjourney v6",
      actorEmail: "sentinel@acmecorp.com",
      department: "System Sentinel",
      details: "Detected unapproved browser extension pinging external cloud endpoints.",
      hoursAgo: 4,
    },
    {
      eventType: AuditEventType.ComplianceScan,
      severity: AuditSeverity.Success,
      toolName: "ChatGPT Enterprise",
      actorEmail: "sentinel@acmecorp.com",
      department: "Governance Automation",
      details: "Daily PII tokenization verification passed. 0 data leakage flags recorded.",
      hoursAgo: 6,
    },
    {
      eventType: AuditEventType.ToolSubmission,
      severity: AuditSeverity.Info,
      toolName: "Claude 3.5 Sonnet",
      actorEmail: "devon.r@acmecorp.com",
      department: "Data Science",
      details:
        "Requested evaluation waiver for benchmarking internal customer support transcripts.",
      hoursAgo: 10,
    },
    {
      eventType: AuditEventType.AccessRevocation,
      severity: AuditSeverity.Warning,
      toolName: "Midjourney v6",
      actorEmail: "marcus.b@acmecorp.com",
      department: "InfoSec & Governance",
      details: "Revoked 6 inactive developer accounts per quarterly least-privilege policy.",
      hoursAgo: 24,
    },
    {
      eventType: AuditEventType.PolicyUpdate,
      severity: AuditSeverity.Info,
      toolName: "GitHub Copilot",
      actorEmail: "elena.r@acmecorp.com",
      department: "Legal & Compliance",
      details: "Updated code attribution clause in engineering handbook for Copilot output usage.",
      hoursAgo: 25,
    },
    {
      eventType: AuditEventType.ComplianceScan,
      severity: AuditSeverity.Success,
      toolName: "GitHub Copilot",
      actorEmail: "sentinel@acmecorp.com",
      department: "Governance Automation",
      details:
        "Verified telemetry opt-out flags active across all 280 corporate IDE installs.",
      hoursAgo: 48,
    },
    {
      eventType: AuditEventType.ApprovalGranted,
      severity: AuditSeverity.Success,
      toolName: "ChatGPT Enterprise",
      actorEmail: "alex.v@acmecorp.com",
      department: "Chief Compliance Office",
      details: "Signed revised BAA and Enterprise Data Addendum with OpenAI legal counsel.",
      hoursAgo: 72,
    },
  ];

  for (const def of auditDefs) {
    const actorId = userByEmail.get(def.actorEmail);
    if (actorId == null)
      throw new Error(`Seed: no user found for email ${def.actorEmail}`);

    const toolId = def.toolName ? toolByName.get(def.toolName) : undefined;

    await appendAuditEvent({
      eventType: def.eventType,
      severity: def.severity,
      actorId,
      toolId,
      department: def.department,
      details: def.details,
    });
  }

  console.log(
    `✅ Seed complete: ${insertedUsers.length} users, ${insertedTools.length} tools, ${auditDefs.length} audit events`
  );

  await disconnectDB();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
