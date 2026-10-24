import argon2 from "argon2";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AuditEventType, AuditSeverity, UserRole } from "@aegisai/shared";
import { app } from "../app.js";
import { AuditEvent } from "../models/AuditEvent.js";
import { Counter } from "../models/Counter.js";
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
    department: "Audit",
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

async function appendEvent(input: { actorId: string; eventType?: string; toolId?: string; details?: string; timestamp?: Date }) {
  await appendAuditEvent({
    eventType: input.eventType ?? AuditEventType.ToolSubmission,
    severity: AuditSeverity.Info,
    actorId: input.actorId,
    ...(input.toolId == null ? {} : { toolId: input.toolId }),
    details: input.details ?? "Audit test event",
  });
  if (input.timestamp != null) {
    const latest = await AuditEvent.findOne({ actor: input.actorId }).sort({ sequence: -1 });
    if (latest != null) {
      await AuditEvent.updateOne({ _id: latest._id }, { $set: { timestamp: input.timestamp } });
    }
  }
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
  await Promise.all([AuditEvent.deleteMany({}), Counter.deleteMany({}), Tool.deleteMany({}), User.deleteMany({})]);
});

describe("audit routes", () => {
  it("filters and paginates newest-first without exposing hashes or actor emails", async () => {
    const auditor = await createUser("reader@example.test", UserRole.Auditor);
    const actorA = await createUser("private-a@example.test", UserRole.Admin);
    const actorB = await createUser("private-b@example.test", UserRole.Compliance);
    const tool = await Tool.create({
      name: "Audited tool",
      vendor: "Example",
      category: "Productivity",
      ownerDepartment: "Audit",
      dataSensitivity: "Internal Only",
      userCount: 1,
    });
    await appendEvent({ actorId: actorA._id.toString(), toolId: tool._id.toString(), details: "older" });
    await appendEvent({ actorId: actorB._id.toString(), toolId: tool._id.toString(), details: "newer" });
    const cookie = await login(auditor.email);

    const filtered = await request(app)
      .get(`/api/v1/audit?eventType=${AuditEventType.ToolSubmission}&toolId=${tool._id}&actor=${actorB._id}&limit=1`)
      .set("Cookie", cookie);
    expect(filtered.status).toBe(200);
    expect(filtered.body).toMatchObject({ total: 1, page: 1, limit: 1 });
    expect(filtered.body.data[0].details).toBe("newer");
    expect(filtered.body.data[0].actor).toEqual({ id: actorB._id.toString(), name: "private-b" });
    expect(filtered.body.data[0]).not.toHaveProperty("hash");
    expect(filtered.body.data[0]).not.toHaveProperty("previousHash");
    expect(JSON.stringify(filtered.body)).not.toContain(actorB.email);

    const paginated = await request(app)
      .get("/api/v1/audit?eventType=TOOL_SUBMISSION&page=2&limit=1")
      .set("Cookie", cookie);
    expect(paginated.body.total).toBe(2);
    expect(paginated.body.data).toHaveLength(1);
    expect(paginated.body.data[0].details).toBe("older");
  });

  it("validates filters and rejects operator-prefixed and reversed date filters", async () => {
    const admin = await createUser("filter-admin@example.test", UserRole.Admin);
    const cookie = await login(admin.email);
    const operatorKey = await request(app).get("/api/v1/audit?%24where=1").set("Cookie", cookie);
    expect(operatorKey.status).toBe(400);
    const invalidType = await request(app).get("/api/v1/audit?eventType=not-an-event").set("Cookie", cookie);
    expect(invalidType.status).toBe(400);
    const reversed = await request(app)
      .get("/api/v1/audit?from=2026-10-18T00%3A00%3A00.000Z&to=2026-10-17T00%3A00%3A00.000Z")
      .set("Cookie", cookie);
    expect(reversed.status).toBe(400);

    const invalidExportFilter = await request(app)
      .get("/api/v1/audit/export?eventType=not-an-event")
      .set("Cookie", cookie);
    expect(invalidExportFilter.status).toBe(400);
  });

  it("streams formula-neutralized CSV, quotes special cells, and audits the export", async () => {
    const admin = await createUser("export-admin@example.test", UserRole.Admin);
    const tool = await Tool.create({
      name: "=1+1",
      vendor: "Example, Vendor",
      category: "Productivity",
      ownerDepartment: "Audit",
      dataSensitivity: "Internal Only",
      userCount: 1,
    });
    await appendEvent({
      actorId: admin._id.toString(),
      toolId: tool._id.toString(),
      details: 'quoted, "line"\nnext',
    });

    const response = await request(app).get("/api/v1/audit/export?eventType=TOOL_SUBMISSION").set("Cookie", await login(admin.email));
    expect(response.status).toBe(200);
    expect(response.headers["content-disposition"]).toContain("attachment");
    expect(response.headers["content-type"]).toContain("text/csv");
    expect(response.text).toContain("'=1+1");
    expect(response.text).toContain('"quoted, ""line""\nnext"');
    const exportEvent = await AuditEvent.findOne({ eventType: AuditEventType.Export });
    expect(exportEvent?.actor?.toString()).toBe(admin._id.toString());
    expect(exportEvent?.details).toContain('filters={"eventType":"TOOL_SUBMISSION"}');
    expect(exportEvent?.details).toContain("rows=1");
  });

  it("caps exports at 10,000 rows and marks truncation in a response header", async () => {
    const admin = await createUser("cap-admin@example.test", UserRole.Admin);
    const rows = Array.from({ length: 10_001 }, (_, index) => ({
      sequence: index + 1,
      timestamp: new Date(Date.UTC(2026, 0, 1) + index),
      eventType: AuditEventType.ToolSubmission,
      severity: AuditSeverity.Info,
      actor: admin._id,
      details: `row ${index + 1}`,
      previousHash: "0".repeat(64),
      hash: "1".repeat(64),
    }));
    await AuditEvent.collection.insertMany(rows);
    await Counter.create({ _id: "auditEvents", seq: rows.length });

    const response = await request(app).get("/api/v1/audit/export").set("Cookie", await login(admin.email));
    expect(response.status).toBe(200);
    expect(response.headers["x-audit-export-truncated"]).toBe("true");
    expect(response.text.split("\r\n")).toHaveLength(10_002);
    expect((await AuditEvent.countDocuments({ eventType: AuditEventType.Export }))).toBe(1);
  }, 60_000);

  it("returns only a clean verification summary and detects an edited event", async () => {
    const auditor = await createUser("verify-auditor@example.test", UserRole.Auditor);
    await appendEvent({ actorId: auditor._id.toString() });
    const cookie = await login(auditor.email);
    const clean = await request(app).get("/api/v1/audit/verify").set("Cookie", cookie);
    expect(clean.status).toBe(200);
    expect(clean.body).toEqual({ valid: true, checked: 2 });

    await AuditEvent.updateOne({ sequence: 1 }, { $set: { details: "manually edited" } });
    const broken = await request(app).get("/api/v1/audit/verify").set("Cookie", cookie);
    expect(broken.status).toBe(200);
    expect(broken.body).toEqual({ valid: false, checked: 2, firstBrokenSequence: 1 });
    expect(JSON.stringify(broken.body)).not.toMatch(/hash|computed|stored/i);
  });

  it("requires authentication and denies Requester and Employee roles", async () => {
    const unauthenticated = await request(app).get("/api/v1/audit");
    expect(unauthenticated.status).toBe(401);
    for (const [email, role] of [
      ["requester@example.test", UserRole.Requester],
      ["employee@example.test", UserRole.Employee],
    ] as const) {
      const user = await createUser(email, role);
      const denied = await request(app).get("/api/v1/audit").set("Cookie", await login(user.email));
      expect(denied.status).toBe(403);
    }
  });

  it("restricts chain verification to Admin and Auditor", async () => {
    const compliance = await createUser("verify-compliance@example.test", UserRole.Compliance);
    const denied = await request(app).get("/api/v1/audit/verify").set("Cookie", await login(compliance.email));
    expect(denied.status).toBe(403);
  });
});