import argon2 from "argon2";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AuditEvent } from "../models/AuditEvent.js";
import { Counter } from "../models/Counter.js";
import { Tool } from "../models/Tool.js";
import { User } from "../models/User.js";
import { app } from "../app.js";

const password = "correct-horse-battery-staple";
const adminEmail = "registry-admin@example.test";
let mongo: MongoMemoryReplSet;

function responseCookies(response: request.Response): string[] {
  const cookies: unknown = response.headers["set-cookie"];
  if (Array.isArray(cookies) && cookies.every((cookie: unknown) => typeof cookie === "string")) return cookies;
  return typeof cookies === "string" ? [cookies] : [];
}

async function login(email = adminEmail, userPassword = password): Promise<string> {
  const response = await request(app)
    .post("/api/v1/auth/login")
    .set("x-aegis-csrf", "1")
    .send({ email, password: userPassword });
  const accessCookie = responseCookies(response).find((cookie) => cookie.startsWith("aegis_access="));
  if (accessCookie == null) throw new Error("Login did not issue an access cookie");
  return accessCookie.split(";")[0]!;
}

async function createUser(email: string, role: "Admin" | "Employee" = "Admin"): Promise<void> {
  await User.create({
    name: "Registry User",
    email,
    department: "Security",
    role,
    passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
  });
}

const newTool = {
  name: "Review Assistant",
  vendor: "Example Vendor",
  category: "Productivity",
  description: "<script>plain text</script>",
  ownerDepartment: "Security",
  dataSensitivity: "Internal Only",
  userCount: 12,
};

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
  await Promise.all([AuditEvent.deleteMany({}), Counter.deleteMany({}), Tool.deleteMany({}), User.deleteMany({})]);
});

describe("tool registry routes", () => {
  it("creates, edits, decides, and returns paginated tools with audit events", async () => {
    await createUser(adminEmail);
    const cookie = await login();
    const created = await request(app)
      .post("/api/v1/tools")
      .set("Cookie", cookie)
      .set("x-aegis-csrf", "1")
      .send(newTool);

    expect(created.status).toBe(201);
    expect(created.body.description).toBe(newTool.description);
    expect(await AuditEvent.countDocuments({ toolId: created.body._id })).toBe(1);

    const updated = await request(app)
      .patch(`/api/v1/tools/${created.body._id}`)
      .set("Cookie", cookie)
      .set("x-aegis-csrf", "1")
      .send({ userCount: 20 });
    expect(updated.status).toBe(200);
    expect(updated.body.userCount).toBe(20);

    const decision = await request(app)
      .post(`/api/v1/tools/${created.body._id}/decision`)
      .set("Cookie", cookie)
      .set("x-aegis-csrf", "1")
      .send({ approvalStatus: "Approved", reason: "Review complete" });
    expect(decision.status).toBe(200);
    expect(decision.body.approvalStatus).toBe("Approved");
    expect(await AuditEvent.countDocuments({ toolId: created.body._id })).toBe(3);

    const listed = await request(app).get("/api/v1/tools?page=1&limit=1&search=review").set("Cookie", cookie);
    expect(listed.status).toBe(200);
    expect(listed.body).toMatchObject({ total: 1, page: 1, limit: 1 });
    expect(listed.body.data[0]._id).toBe(created.body._id);
  });

  it("rejects invalid tool input", async () => {
    await createUser(adminEmail);
    const response = await request(app)
      .post("/api/v1/tools")
      .set("Cookie", await login())
      .set("x-aegis-csrf", "1")
      .send({ ...newTool, userCount: -1 });
    expect(response.status).toBe(400);
    expect(response.body.code).toBe("VALIDATION_ERROR");
  });

  it("rejects server-controlled fields on tool create, update, and decisions", async () => {
    await createUser(adminEmail);
    const cookie = await login();
    const maliciousCreate = await request(app)
      .post("/api/v1/tools")
      .set("Cookie", cookie)
      .set("x-aegis-csrf", "1")
      .send({
        ...newTool,
        approvalStatus: "Approved",
        riskLevel: "Low",
        complianceScore: 100,
      });
    expect(maliciousCreate.status).toBe(400);
    expect(await Tool.countDocuments({})).toBe(0);

    const tool = await Tool.create({
      name: newTool.name,
      vendor: newTool.vendor,
      category: newTool.category,
      ownerDepartment: newTool.ownerDepartment,
      dataSensitivity: newTool.dataSensitivity,
      userCount: newTool.userCount,
    });
    const maliciousUpdate = await request(app)
      .patch(`/api/v1/tools/${tool._id}`)
      .set("Cookie", cookie)
      .set("x-aegis-csrf", "1")
      .send({ approvalStatus: "Approved", riskLevel: "Low", complianceScore: 100 });
    expect(maliciousUpdate.status).toBe(400);
    expect(await Tool.findById(tool._id)).toMatchObject({
      approvalStatus: "Pending Review",
      riskLevel: "Medium",
      complianceScore: 0,
    });

    const maliciousDecision = await request(app)
      .post(`/api/v1/tools/${tool._id}/decision`)
      .set("Cookie", cookie)
      .set("x-aegis-csrf", "1")
      .send({ approvalStatus: "Approved", reason: "Review complete", riskLevel: "Low", complianceScore: 100 });
    expect(maliciousDecision.status).toBe(400);
    expect((await Tool.findById(tool._id))?.approvalStatus).toBe("Pending Review");
  });

  it("returns not found for missing tool updates and decisions and validates their inputs", async () => {
    await createUser(adminEmail);
    const cookie = await login();
    const missingId = new mongoose.Types.ObjectId().toString();

    const invalidUpdate = await request(app)
      .patch(`/api/v1/tools/${missingId}`)
      .set("Cookie", cookie)
      .set("x-aegis-csrf", "1")
      .send({ userCount: -1 });
    expect(invalidUpdate.status).toBe(400);

    const missingUpdate = await request(app)
      .patch(`/api/v1/tools/${missingId}`)
      .set("Cookie", cookie)
      .set("x-aegis-csrf", "1")
      .send({ userCount: 1 });
    expect(missingUpdate.status).toBe(404);
    expect(missingUpdate.body.code).toBe("TOOL_NOT_FOUND");

    const invalidDecision = await request(app)
      .post(`/api/v1/tools/${missingId}/decision`)
      .set("Cookie", cookie)
      .set("x-aegis-csrf", "1")
      .send({ approvalStatus: "Pending Review", reason: "" });
    expect(invalidDecision.status).toBe(400);

    const missingDecision = await request(app)
      .post(`/api/v1/tools/${missingId}/decision`)
      .set("Cookie", cookie)
      .set("x-aegis-csrf", "1")
      .send({ approvalStatus: "Approved", reason: "Reviewed" });
    expect(missingDecision.status).toBe(404);
    expect(missingDecision.body.code).toBe("TOOL_NOT_FOUND");
  });

  it("requires authentication", async () => {
    const response = await request(app).get("/api/v1/tools");
    expect(response.status).toBe(401);
  });

  it("denies employees from managing tools", async () => {
    const email = "registry-employee@example.test";
    await createUser(email, "Employee");
    const response = await request(app)
      .post("/api/v1/tools")
      .set("Cookie", await login(email))
      .set("x-aegis-csrf", "1")
      .send(newTool);
    expect(response.status).toBe(403);
  });
});