import argon2 from "argon2";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AuditEventType, AuditSeverity, RequestStatus, UserRole } from "@aegisai/shared";
import { app } from "../app.js";
import { Request as ToolRequest } from "../models/Request.js";
import { Tool } from "../models/Tool.js";
import { User } from "../models/User.js";
import { appendAuditEvent } from "../services/auditService.js";

const password = "correct-horse-battery-staple";
let mongo: MongoMemoryReplSet;
let adminCookie: string;

function responseCookies(response: request.Response): string[] {
  const cookies: unknown = response.headers["set-cookie"];
  if (Array.isArray(cookies) && cookies.every((cookie: unknown) => typeof cookie === "string")) return cookies;
  return typeof cookies === "string" ? [cookies] : [];
}

const listRoutes = [
  { name: "tools", path: "/api/v1/tools", total: 2 },
  { name: "requests", path: "/api/v1/requests", total: 2 },
  { name: "audit events", path: "/api/v1/audit", total: 3 },
  { name: "users", path: "/api/v1/users", total: 3 },
] as const;

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  process.env.PORT = "3000";
  process.env.JWT_ACCESS_SECRET = "a".repeat(64);
  process.env.JWT_REFRESH_SECRET = "b".repeat(64);
  process.env.CLIENT_ORIGIN = "http://localhost:5173";
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  await mongoose.connect(mongo.getUri("aegisai"));

  const admin = await User.create({
    name: "Pagination Admin",
    email: "pagination-admin@example.test",
    department: "Platform",
    role: UserRole.Admin,
    passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
  });
  const loginResponse = await request(app)
    .post("/api/v1/auth/login")
    .set("x-aegis-csrf", "1")
    .send({ email: admin.email, password });
  const cookie = responseCookies(loginResponse).find((value) => value.startsWith("aegis_access="));
  if (cookie == null) throw new Error("Login did not issue an access cookie");
  adminCookie = cookie.split(";")[0]!;

  const secondUser = await User.create({
    name: "Pagination Employee",
    email: "pagination-employee@example.test",
    department: "Platform",
    role: UserRole.Employee,
    passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
  });
  await User.create({
    name: "Pagination Reviewer",
    email: "pagination-reviewer@example.test",
    department: "Compliance",
    role: UserRole.Compliance,
    passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
  });

  for (const name of ["Alpha tool", "Beta tool"]) {
    await Tool.create({
      name,
      vendor: "Pagination vendor",
      category: "Productivity",
      ownerDepartment: "Platform",
      dataSensitivity: "Internal Only",
      userCount: 1,
    });
  }
  for (const toolName of ["Alpha request", "Beta request"]) {
    await ToolRequest.create({
      toolName,
      requester: secondUser._id,
      useCase: "Pagination coverage",
      dataTypes: ["Internal"],
      status: RequestStatus.Submitted,
    });
  }
  for (const details of ["Alpha audit", "Beta audit"]) {
    await appendAuditEvent({
      eventType: AuditEventType.ToolSubmission,
      severity: AuditSeverity.Info,
      actorId: admin._id.toString(),
      details,
    });
  }
}, 120_000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

describe.each(listRoutes)("pagination for $name", ({ path, total }) => {
  it("applies page and limit defaults with the common response envelope", async () => {
    const response = await request(app).get(path).set("Cookie", adminCookie);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ total, page: 1, limit: 20 });
    expect(Object.keys(response.body).sort()).toEqual(["data", "limit", "page", "total"]);
  });

  it("rejects limits above 100", async () => {
    const response = await request(app).get(`${path}?limit=101`).set("Cookie", adminCookie);
    expect(response.status).toBe(400);
    expect(response.body.code).toBe("VALIDATION_ERROR");
  });

  it("rejects page and limit values below one", async () => {
    const invalidPage = await request(app).get(`${path}?page=0`).set("Cookie", adminCookie);
    expect(invalidPage.status).toBe(400);
    expect(invalidPage.body.code).toBe("VALIDATION_ERROR");

    const invalidLimit = await request(app).get(`${path}?limit=0`).set("Cookie", adminCookie);
    expect(invalidLimit.status).toBe(400);
    expect(invalidLimit.body.code).toBe("VALIDATION_ERROR");
  });

  it("returns an empty page beyond the end and preserves the filtered total", async () => {
    const response = await request(app).get(`${path}?page=99&limit=1`).set("Cookie", adminCookie);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ data: [], total, page: 99, limit: 1 });
  });

  it("rejects sort fields not allow-listed for the route", async () => {
    const response = await request(app).get(`${path}?sort=notAField`).set("Cookie", adminCookie);
    expect(response.status).toBe(400);
    expect(response.body.code).toBe("VALIDATION_ERROR");
  });

  it("rejects dollar-prefixed query keys", async () => {
    const response = await request(app).get(`${path}?%24where=1`).set("Cookie", adminCookie);
    expect(response.status).toBe(400);
    expect(response.body.code).toBe("VALIDATION_ERROR");
  });
});