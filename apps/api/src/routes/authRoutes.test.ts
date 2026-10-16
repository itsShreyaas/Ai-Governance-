import argon2 from "argon2";
import cookieParser from "cookie-parser";
import express, { type Express } from "express";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { UserRole } from "@aegisai/shared";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";
import { errorHandler } from "../middleware/errorHandler.js";
import { AuditEvent } from "../models/AuditEvent.js";
import { Counter } from "../models/Counter.js";
import { RefreshToken } from "../models/RefreshToken.js";
import { User } from "../models/User.js";

const testPassword = "correct-horse-battery-staple";
const testEmail = "admin@example.test";
let mongo: MongoMemoryReplSet;
let app: Express;

function cookiePair(response: request.Response, name: string): string {
  const matchingCookie = responseCookies(response).find((cookie) => cookie.startsWith(`${name}=`));
  if (matchingCookie == null) throw new Error(`Missing ${name} cookie`);
  return matchingCookie.split(";")[0] ?? "";
}

function responseCookies(response: request.Response): string[] {
  const cookies: unknown = response.headers["set-cookie"];
  if (Array.isArray(cookies) && cookies.every((cookie: unknown) => typeof cookie === "string")) {
    return cookies;
  }
  return typeof cookies === "string" ? [cookies] : [];
}

async function createUser(role: UserRole = UserRole.Admin): Promise<void> {
  const passwordHash = await argon2.hash(testPassword, { type: argon2.argon2id });
  await User.create({
    name: "Test Admin",
    email: testEmail,
    department: "Security",
    role,
    passwordHash,
  });
}

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  process.env.PORT = "3000";
  process.env.JWT_ACCESS_SECRET = "a".repeat(64);
  process.env.JWT_REFRESH_SECRET = "b".repeat(64);
  process.env.CLIENT_ORIGIN = "http://localhost:5173";

  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  process.env.MONGODB_URI = mongo.getUri("aegisai");
  await mongoose.connect(process.env.MONGODB_URI);

  ({ app } = await import("../app.js"));
}, 120_000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await Promise.all([
    AuditEvent.deleteMany({}),
    Counter.deleteMany({}),
    RefreshToken.deleteMany({}),
    User.deleteMany({}),
  ]);
});

describe("authentication routes", () => {
  it("logs in and issues secure httpOnly access and refresh cookies", async () => {
    await createUser();

    const response = await request(app)
      .post("/api/v1/auth/login")
      .set("x-aegis-csrf", "1")
      .send({ email: testEmail, password: testPassword });

    expect(response.status).toBe(200);
    expect(response.body.user.email).toBe(testEmail);
    expect(response.body.user).not.toHaveProperty("passwordHash");
    const cookies = responseCookies(response);
    expect(cookies).toEqual(
      expect.arrayContaining([
        expect.stringContaining("aegis_access="),
        expect.stringContaining("aegis_refresh="),
      ])
    );
    for (const cookie of cookies) {
      expect(cookie).toContain("HttpOnly");
      expect(cookie).toContain("Secure");
      expect(cookie).toContain("SameSite=Strict");
    }
    expect(await AuditEvent.countDocuments({ eventType: "LOGIN" })).toBe(1);
    const refreshRecord = await RefreshToken.findOne({});
    expect(refreshRecord?.tokenHash).toHaveLength(64);
  });

  it("returns the same generic error for invalid credentials and audits a known account failure", async () => {
    await createUser();

    const response = await request(app)
      .post("/api/v1/auth/login")
      .set("x-aegis-csrf", "1")
      .send({ email: testEmail, password: "incorrect-password" });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      status: 401,
      code: "INVALID_CREDENTIALS",
      message: "Email or password is incorrect",
    });
    expect((await User.findOne({ email: testEmail }))?.failedLoginAttempts).toBe(1);
    expect(await AuditEvent.countDocuments({ eventType: "LOGIN_FAILED" })).toBe(1);
  });

  it("locks an account after five failed password attempts", async () => {
    await createUser();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await request(app)
        .post("/api/v1/auth/login")
        .set("x-aegis-csrf", "1")
        .send({ email: testEmail, password: "incorrect-password" });
      expect(response.status).toBe(401);
    }

    const lockedUser = await User.findOne({ email: testEmail });
    expect(lockedUser?.failedLoginAttempts).toBe(5);
    expect(lockedUser?.lockoutUntil?.getTime()).toBeGreaterThan(Date.now());
  });

  it("rotates refresh tokens and revokes the complete family when the old token is reused", async () => {
    await createUser();
    const loginResponse = await request(app)
      .post("/api/v1/auth/login")
      .set("x-aegis-csrf", "1")
      .send({ email: testEmail, password: testPassword });
    const oldRefreshCookie = cookiePair(loginResponse, "aegis_refresh");

    const refreshResponse = await request(app)
      .post("/api/v1/auth/refresh")
      .set("x-aegis-csrf", "1")
      .set("Cookie", oldRefreshCookie);

    expect(refreshResponse.status).toBe(200);
    const newRefreshCookie = cookiePair(refreshResponse, "aegis_refresh");
    expect(newRefreshCookie).not.toBe(oldRefreshCookie);
    const recordsAfterRotation = await RefreshToken.find({}).sort({ createdAt: 1 });
    expect(recordsAfterRotation).toHaveLength(2);
    expect(recordsAfterRotation[0]?.revokedAt).toBeInstanceOf(Date);
    expect(recordsAfterRotation[1]?.revokedAt).toBeNull();

    const reuseResponse = await request(app)
      .post("/api/v1/auth/refresh")
      .set("x-aegis-csrf", "1")
      .set("Cookie", oldRefreshCookie);

    expect(reuseResponse.status).toBe(401);
    expect(await RefreshToken.countDocuments({ revokedAt: null })).toBe(0);
  });

  it("denies an authenticated employee on an admin-only route", async () => {
    await createUser(UserRole.Employee);
    const loginResponse = await request(app)
      .post("/api/v1/auth/login")
      .set("x-aegis-csrf", "1")
      .send({ email: testEmail, password: testPassword });
    const accessCookie = cookiePair(loginResponse, "aegis_access");
    const protectedApp = express();
    protectedApp.use(cookieParser());
    protectedApp.get("/admin", requireAuth, requireRole(UserRole.Admin), (_req, res) => {
      res.status(200).json({ ok: true });
    });
    protectedApp.use(errorHandler);

    const response = await request(protectedApp).get("/admin").set("Cookie", accessCookie);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      status: 403,
      code: "FORBIDDEN",
      message: "You do not have permission to perform this action",
    });
  });

  it("rejects cookie-authenticated state changes without the shared CSRF header", async () => {
    const response = await request(app)
      .post("/api/v1/auth/logout");

    expect(response.status).toBe(403);
    expect(response.body.code).toBe("CSRF_HEADER_REQUIRED");
  });
});