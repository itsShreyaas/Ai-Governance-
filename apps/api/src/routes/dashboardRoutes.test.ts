import argon2 from "argon2";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  ApprovalStatus,
  AssessmentFramework,
  AssessmentStatus,
  AuditEventType,
  AuditSeverity,
  RequestStatus,
  RiskLevel,
  UserRole,
} from "@aegisai/shared";
import { app } from "../app.js";
import { Assessment } from "../models/Assessment.js";
import { AuditEvent } from "../models/AuditEvent.js";
import { Counter } from "../models/Counter.js";
import { Request as ToolRequest } from "../models/Request.js";
import { Tool } from "../models/Tool.js";
import { User } from "../models/User.js";
import { appendAuditEvent } from "../services/auditService.js";

const password = "correct-horse-battery-staple";
let mongo: MongoMemoryReplSet;
const cookieCache = new Map<string, string>();

function responseCookies(response: request.Response): string[] {
  const cookies: unknown = response.headers["set-cookie"];
  if (Array.isArray(cookies) && cookies.every((cookie: unknown) => typeof cookie === "string")) return cookies;
  return typeof cookies === "string" ? [cookies] : [];
}

async function createUser(email: string, role: (typeof UserRole)[keyof typeof UserRole]) {
  return User.create({
    name: email.split("@")[0]!,
    email,
    department: "Dashboard",
    role,
    passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
  });
}

async function login(email: string): Promise<string> {
  const cached = cookieCache.get(email);
  if (cached != null) return cached;
  const response = await request(app)
    .post("/api/v1/auth/login")
    .set("x-aegis-csrf", "1")
    .send({ email, password });
  const cookie = responseCookies(response).find((value) => value.startsWith("aegis_access="));
  if (cookie == null) throw new Error("Login did not issue an access cookie");
  const accessCookie = cookie.split(";")[0]!;
  cookieCache.set(email, accessCookie);
  return accessCookie;
}

async function makeTool(input: {
  name: string;
  approvalStatus?: string;
  riskLevel?: string;
  createdAt?: Date;
  archivedAt?: Date | null;
}) {
  return Tool.create({
    name: input.name,
    vendor: "Dashboard Vendor",
    category: "Productivity",
    ownerDepartment: "Security",
    dataSensitivity: "Internal Only",
    userCount: 10,
    approvalStatus: input.approvalStatus ?? ApprovalStatus.PendingReview,
    riskLevel: input.riskLevel ?? RiskLevel.Medium,
    ...(input.createdAt == null ? {} : { createdAt: input.createdAt }),
    ...(input.archivedAt === undefined ? {} : { archivedAt: input.archivedAt }),
  });
}

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  process.env.PORT = "3000";
  process.env.JWT_ACCESS_SECRET = "a".repeat(64);
  process.env.JWT_REFRESH_SECRET = "b".repeat(64);
  process.env.CLIENT_ORIGIN = "http://localhost:5173";
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  await mongoose.connect(mongo.getUri("aegisai"));
}, 120_000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  cookieCache.clear();
  await Promise.all([
    AuditEvent.deleteMany({}),
    Assessment.deleteMany({}),
    Counter.deleteMany({}),
    ToolRequest.deleteMany({}),
    Tool.deleteMany({}),
    User.deleteMany({}),
  ]);
});

describe("dashboard route", () => {
  it("aggregates KPI, status/risk, pending review, and activity data without sensitive fields", async () => {
    const admin = await createUser("dashboard-admin@example.test", UserRole.Admin);
    const reviewer = await createUser("reviewer@example.test", UserRole.Compliance);
    const approved = await makeTool({ name: "Approved tool", approvalStatus: ApprovalStatus.Approved, riskLevel: RiskLevel.Low });
    const elevatedRisk = await makeTool({ name: "Elevated risk tool", approvalStatus: ApprovalStatus.Approved, riskLevel: RiskLevel.High });
    const pending = await makeTool({ name: "Pending tool", approvalStatus: ApprovalStatus.PendingReview, riskLevel: RiskLevel.High });
    await Assessment.create([
      {
        toolId: approved._id,
        framework: AssessmentFramework.NistAiRmf,
        answers: [],
        assessor: reviewer._id,
        status: AssessmentStatus.Draft,
      },
      {
        toolId: pending._id,
        framework: AssessmentFramework.Iso42001,
        answers: [],
        assessor: reviewer._id,
        status: AssessmentStatus.Submitted,
      },
      {
        toolId: elevatedRisk._id,
        framework: AssessmentFramework.EuAiAct,
        answers: [],
        assessor: reviewer._id,
        status: AssessmentStatus.Approved,
      },
    ]);
    await makeTool({ name: "Restricted tool", approvalStatus: ApprovalStatus.Restricted, riskLevel: RiskLevel.Medium });
    const archived = await makeTool({ name: "Archived tool", approvalStatus: ApprovalStatus.Approved, archivedAt: new Date() });
    const requestDoc = await ToolRequest.create({
      toolId: pending._id,
      requester: reviewer._id,
      reviewer: reviewer._id,
      useCase: "Review pending tool",
      dataTypes: ["Internal"],
      status: RequestStatus.InReview,
      submittedAt: new Date(Date.now() - 5 * 86_400_000),
    });
    await ToolRequest.create({
      toolName: "New requested tool",
      requester: admin._id,
      useCase: "New tool review",
      dataTypes: ["Internal"],
      status: RequestStatus.Submitted,
      submittedAt: new Date(Date.now() - 10 * 86_400_000),
    });
    await ToolRequest.create({
      requester: admin._id,
      useCase: "Decided request",
      dataTypes: ["Internal"],
      status: RequestStatus.Approved,
      submittedAt: new Date(Date.now() - 4 * 86_400_000),
      decidedAt: new Date(Date.now() - 2 * 86_400_000),
    });
    await appendAuditEvent({
      eventType: AuditEventType.ToolSubmission,
      severity: AuditSeverity.Info,
      actorId: admin._id.toString(),
      toolId: approved._id.toString(),
      details: "do not expose this text",
    });

    const response = await request(app).get("/api/v1/dashboard").set("Cookie", await login(admin.email));
    expect(response.status).toBe(200);
    expect(response.body.kpis).toMatchObject({
      totalTools: 4,
      approvedTools: 2,
      pendingTools: 1,
      restrictedTools: 1,
      avgReviewDays: 2,
      openAssessments: 2,
    });
    expect(response.body.statusChartData).toHaveLength(Object.values(ApprovalStatus).length);
    expect(response.body.statusChartData.find((item: { name: string }) => item.name === ApprovalStatus.Revoked).value).toBe(0);
    expect(response.body.riskChartData).toHaveLength(Object.values(RiskLevel).length);
    expect(response.body.toolsNeedingReview.map((item: { id: string }) => item.id)).toContain(requestDoc._id.toString());
    expect(response.body.toolsNeedingReview.map((item: { id: string }) => item.id)).toContain(elevatedRisk._id.toString());
    expect(response.body.toolsNeedingReview.find((item: { id: string }) => item.id === requestDoc._id.toString()).waitingOn)
      .toBe(reviewer.name);
    expect(response.body.recentAudits[0]).toMatchObject({ eventType: AuditEventType.Login, actorName: admin.name });
    expect(response.body.recentAudits.some((item: { toolName: string }) => item.toolName === approved.name)).toBe(true);
    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toMatch(/hash|email|password|do not expose this text/i);
    expect(archived).toBeTruthy();
  });

  it("returns zero counts and null average when the database is empty", async () => {
    const auditor = await createUser("empty-auditor@example.test", UserRole.Auditor);
    const response = await request(app).get("/api/v1/dashboard").set("Cookie", await login(auditor.email));
    expect(response.status).toBe(200);
    expect(response.body.kpis).toEqual({
      totalTools: 0,
      approvedTools: 0,
      pendingTools: 0,
      restrictedTools: 0,
      toolsAddedThisMonth: 0,
      avgReviewDays: null,
      openAssessments: 0,
    });
    expect(response.body.statusChartData.every((item: { value: number }) => item.value === 0)).toBe(true);
    expect(response.body.riskChartData.every((item: { count: number; percentage: number }) => item.count === 0 && item.percentage === 0)).toBe(true);
    expect(response.body.toolsNeedingReview).toEqual([]);
    expect(response.body.recentAudits).toHaveLength(1);
    expect(JSON.stringify(response.body)).not.toMatch(/NaN|Infinity/);
  });

  it("uses UTC calendar-month boundaries and averages all decided review durations", async () => {
    const admin = await createUser("dates-admin@example.test", UserRole.Admin);
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    await makeTool({ name: "Before month", createdAt: new Date(monthStart.getTime() - 1) });
    await makeTool({ name: "At month boundary", createdAt: monthStart });
    await makeTool({ name: "At next month boundary", createdAt: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)) });
    await ToolRequest.create([
      {
        requester: admin._id,
        toolName: "Two day review",
        useCase: "Review",
        dataTypes: ["Internal"],
        status: RequestStatus.Approved,
        submittedAt: new Date("2026-10-01T00:00:00.000Z"),
        decidedAt: new Date("2026-10-03T00:00:00.000Z"),
      },
      {
        requester: admin._id,
        toolName: "Four day review",
        useCase: "Review",
        dataTypes: ["Internal"],
        status: RequestStatus.Rejected,
        submittedAt: new Date("2026-10-01T00:00:00.000Z"),
        decidedAt: new Date("2026-10-05T00:00:00.000Z"),
      },
      {
        requester: admin._id,
        toolName: "Still open",
        useCase: "Review",
        dataTypes: ["Internal"],
        status: RequestStatus.InReview,
        submittedAt: new Date("2026-10-01T00:00:00.000Z"),
      },
    ]);

    const response = await request(app).get("/api/v1/dashboard").set("Cookie", await login(admin.email));
    expect(response.body.kpis.toolsAddedThisMonth).toBe(1);
    expect(response.body.kpis.avgReviewDays).toBe(3);
  });

  it("requires authentication and denies Requester and Employee roles", async () => {
    const unauthenticated = await request(app).get("/api/v1/dashboard");
    expect(unauthenticated.status).toBe(401);
    for (const [email, role] of [
      ["dashboard-requester@example.test", UserRole.Requester],
      ["dashboard-employee@example.test", UserRole.Employee],
    ] as const) {
      const user = await createUser(email, role);
      const denied = await request(app).get("/api/v1/dashboard").set("Cookie", await login(user.email));
      expect(denied.status).toBe(403);
    }
  });
});