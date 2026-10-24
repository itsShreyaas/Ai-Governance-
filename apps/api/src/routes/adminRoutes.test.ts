import argon2 from "argon2";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AssessmentFramework, AuditEventType, UserRole } from "@aegisai/shared";
import { app } from "../app.js";
import { AuditEvent } from "../models/AuditEvent.js";
import { Counter } from "../models/Counter.js";
import { RefreshToken } from "../models/RefreshToken.js";
import { Settings } from "../models/Settings.js";
import { User } from "../models/User.js";
import { updateUser } from "../services/userService.js";

const password = "correct-horse-battery-staple";
const tokenHash = "a".repeat(64);
let mongo: MongoMemoryReplSet;
const cookieCache = new Map<string, string>();

function responseCookies(response: request.Response): string[] {
  const cookies: unknown = response.headers["set-cookie"];
  if (Array.isArray(cookies) && cookies.every((cookie: unknown) => typeof cookie === "string")) return cookies;
  return typeof cookies === "string" ? [cookies] : [];
}

async function createUser(email: string, role: (typeof UserRole)[keyof typeof UserRole] = UserRole.Admin) {
  return User.create({
    name: email.split("@")[0]!,
    email,
    department: "Security",
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
    Counter.deleteMany({}),
    RefreshToken.deleteMany({}),
    Settings.deleteMany({}),
    User.deleteMany({}),
  ]);
});

describe("Admin settings and user routes", () => {
  it("creates default settings on first read and never returns secret values", async () => {
    const admin = await createUser("settings-admin@example.test");
    const response = await request(app).get("/api/v1/settings").set("Cookie", await login(admin.email));
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      organizationName: "Acme Global",
      scoreWeights: { nistAiRmf: 0.4, iso42001: 0.35, euAiAct: 0.25 },
      slackWebhookConfigured: false,
      smtpConfigured: false,
    });
    expect(await Settings.countDocuments({})).toBe(1);
    expect(response.body).not.toHaveProperty("slackWebhookUrl");
    expect(response.body).not.toHaveProperty("smtpUrl");
  });

  it("updates settings, validates weight totals, and excludes secrets from response and audit", async () => {
    const admin = await createUser("settings-update@example.test");
    const cookie = await login(admin.email);
    const invalidWeights = await request(app)
      .patch("/api/v1/settings")
      .set("Cookie", cookie)
      .set("x-aegis-csrf", "1")
      .send({ scoreWeights: { nistAiRmf: 0.5, iso42001: 0.25, euAiAct: 0.1 } });
    expect(invalidWeights.status).toBe(400);

    const invalidSlackUrl = await request(app)
      .patch("/api/v1/settings")
      .set("Cookie", cookie)
      .set("x-aegis-csrf", "1")
      .send({ slackWebhookUrl: "http://hooks.example.test/secret" });
    expect(invalidSlackUrl.status).toBe(400);

    const response = await request(app)
      .patch("/api/v1/settings")
      .set("Cookie", cookie)
      .set("x-aegis-csrf", "1")
      .send({
        organizationName: "Aegis North",
        enabledFrameworks: [AssessmentFramework.Iso42001],
        scoreWeights: { nistAiRmf: 0.5, iso42001: 0.3, euAiAct: 0.2005 },
        slackWebhookUrl: "https://hooks.example.test/secret-slack-token",
        smtpUrl: "smtp://mail-user:secret-smtp-password@mail.example.test",
      });
    expect(response.status).toBe(200);
    expect(response.body.organizationName).toBe("Aegis North");
    expect(response.body.slackWebhookConfigured).toBe(true);
    expect(response.body.smtpConfigured).toBe(true);
    expect(JSON.stringify(response.body)).not.toMatch(/secret-slack-token|secret-smtp-password|slackWebhookUrl|smtpUrl/);
    const event = await AuditEvent.findOne({ eventType: AuditEventType.SettingsUpdated });
    expect(event?.details).toContain("secret settings changed");
    expect(event?.details).not.toMatch(/secret-slack-token|secret-smtp-password/);
    const readBack = await request(app).get("/api/v1/settings").set("Cookie", cookie);
    expect(readBack.body.slackWebhookConfigured).toBe(true);
    expect(readBack.body.smtpConfigured).toBe(true);
  });

  it("creates users with hashed passwords and paginates/filters safe public fields", async () => {
    const admin = await createUser("users-admin@example.test");
    const cookie = await login(admin.email);
    const created = await request(app)
      .post("/api/v1/users")
      .set("Cookie", cookie)
      .set("x-aegis-csrf", "1")
      .send({
        name: "Jordan Lee",
        email: "jordan@example.test",
        department: "Engineering",
        role: UserRole.Employee,
        password: "initial-password-123",
      });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ email: "jordan@example.test", isActive: true, role: UserRole.Employee });
    expect(created.body).not.toHaveProperty("passwordHash");
    expect(created.body).not.toHaveProperty("failedLoginAttempts");
    expect(await argon2.verify((await User.findById(created.body.id))!.passwordHash!, "initial-password-123")).toBe(true);
    const createEvent = await AuditEvent.findOne({ eventType: AuditEventType.UserCreated });
    expect(createEvent?.details).toBe("User created");
    expect(createEvent?.details).not.toContain("initial-password-123");

    const employee = await createUser("hr-one@example.test", UserRole.Employee);
    await User.updateOne({ _id: employee._id }, { department: "HR" });
    const list = await request(app)
      .get("/api/v1/users?role=Employee&department=Engineering&isActive=true&page=1&limit=1")
      .set("Cookie", cookie);
    expect(list.status).toBe(200);
    expect(list.body).toMatchObject({ total: 1, page: 1, limit: 1 });
    expect(list.body.data[0]).toMatchObject({ id: created.body.id, name: "Jordan Lee", isActive: true });
    expect(JSON.stringify(list.body)).not.toMatch(/passwordHash|failedLoginAttempts|lockoutUntil|password/);
  });

  it("rejects invalid users, system-role assignment, and duplicate emails", async () => {
    const admin = await createUser("validation-admin@example.test");
    const cookie = await login(admin.email);
    const invalid = await request(app)
      .post("/api/v1/users")
      .set("Cookie", cookie)
      .set("x-aegis-csrf", "1")
      .send({ name: "Short", email: "short@example.test", department: "IT", role: UserRole.Employee, password: "short" });
    expect(invalid.status).toBe(400);
    const systemRole = await request(app)
      .post("/api/v1/users")
      .set("Cookie", cookie)
      .set("x-aegis-csrf", "1")
      .send({ name: "System", email: "system-api@example.test", department: "IT", role: UserRole.System, password });
    expect(systemRole.status).toBe(400);
    const duplicate = await request(app)
      .post("/api/v1/users")
      .set("Cookie", cookie)
      .set("x-aegis-csrf", "1")
      .send({ name: "Admin Duplicate", email: admin.email, department: "IT", role: UserRole.Employee, password });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.code).toBe("DUPLICATE_EMAIL");
  });

  it("updates permitted user fields and rejects email/password changes", async () => {
    const admin = await createUser("patch-admin@example.test");
    const target = await createUser("patch-target@example.test", UserRole.Employee);
    const cookie = await login(admin.email);
    const forbiddenFields = await request(app)
      .patch(`/api/v1/users/${target._id}`)
      .set("Cookie", cookie)
      .set("x-aegis-csrf", "1")
      .send({ email: "new@example.test", password: "new-password-123" });
    expect(forbiddenFields.status).toBe(400);
    const response = await request(app)
      .patch(`/api/v1/users/${target._id}`)
      .set("Cookie", cookie)
      .set("x-aegis-csrf", "1")
      .send({ name: "Updated Name", department: "Compliance" });
    expect(response.status).toBe(200);
    expect(response.body.name).toBe("Updated Name");
    expect(response.body).not.toHaveProperty("passwordHash");
  });

  it("returns not found for a missing user update and validates update fields", async () => {
    const admin = await createUser("missing-user-admin@example.test");
    const cookie = await login(admin.email);
    const missingId = new mongoose.Types.ObjectId().toString();

    const invalid = await request(app)
      .patch(`/api/v1/users/${missingId}`)
      .set("Cookie", cookie)
      .set("x-aegis-csrf", "1")
      .send({ role: UserRole.System });
    expect(invalid.status).toBe(400);

    const missing = await request(app)
      .patch(`/api/v1/users/${missingId}`)
      .set("Cookie", cookie)
      .set("x-aegis-csrf", "1")
      .send({ name: "Not found" });
    expect(missing.status).toBe(404);
    expect(missing.body.code).toBe("USER_NOT_FOUND");
  });

  it("prevents an admin from demoting or deactivating their own account", async () => {
    const admin = await createUser("self-admin@example.test");
    const cookie = await login(admin.email);
    const demote = await request(app)
      .patch(`/api/v1/users/${admin._id}`)
      .set("Cookie", cookie)
      .set("x-aegis-csrf", "1")
      .send({ role: UserRole.Employee });
    expect(demote.status).toBe(409);
    const deactivate = await request(app)
      .patch(`/api/v1/users/${admin._id}`)
      .set("Cookie", cookie)
      .set("x-aegis-csrf", "1")
      .send({ isActive: false });
    expect(deactivate.status).toBe(409);
  });

  it("protects the last active admin from demotion or deactivation", async () => {
    const admin = await createUser("last-admin@example.test");
    const actor = {
      id: new mongoose.Types.ObjectId().toString(),
      department: "Security",
    };
    await expect(updateUser(admin._id.toString(), { role: UserRole.Compliance }, actor))
      .rejects.toMatchObject({ status: 409, code: "LAST_ADMIN_REQUIRED" });
    await expect(updateUser(admin._id.toString(), { isActive: false }, actor))
      .rejects.toMatchObject({ status: 409, code: "LAST_ADMIN_REQUIRED" });
    expect((await User.findById(admin._id))?.isActive).toBe(true);
  });

  it("revokes refresh tokens with user deactivation and does not edit system users", async () => {
    const admin = await createUser("deactivation-admin@example.test");
    const target = await createUser("deactivation-target@example.test", UserRole.Employee);
    await RefreshToken.create({
      userId: target._id,
      tokenHash,
      familyId: "target-session-family",
      expiresAt: new Date(Date.now() + 86_400_000),
      revokedAt: null,
    });
    const cookie = await login(admin.email);
    const deactivated = await request(app)
      .patch(`/api/v1/users/${target._id}`)
      .set("Cookie", cookie)
      .set("x-aegis-csrf", "1")
      .send({ isActive: false });
    expect(deactivated.status).toBe(200);
    expect((await RefreshToken.findOne({ tokenHash }))?.revokedAt).toBeInstanceOf(Date);
    expect(await AuditEvent.countDocuments({ eventType: AuditEventType.UserUpdated })).toBe(1);

    const system = await createUser("system-user@example.test", UserRole.System);
    const rejected = await request(app)
      .patch(`/api/v1/users/${system._id}`)
      .set("Cookie", cookie)
      .set("x-aegis-csrf", "1")
      .send({ name: "Mutated system" });
    expect(rejected.status).toBe(403);
    expect((await User.findById(system._id))?.name).toBe("system-user");
  });

  it("requires authentication, CSRF on writes, and denies every non-Admin role", async () => {
    expect((await request(app).get("/api/v1/settings")).status).toBe(401);
    const admin = await createUser("csrf-admin@example.test");
    const missingCsrf = await request(app)
      .patch("/api/v1/settings")
      .set("Cookie", await login(admin.email))
      .send({ organizationName: "No CSRF" });
    expect(missingCsrf.status).toBe(403);
    expect(missingCsrf.body.code).toBe("CSRF_HEADER_REQUIRED");

    const roles = [UserRole.Compliance, UserRole.Requester, UserRole.Employee, UserRole.Auditor, UserRole.System];
    for (const role of roles) {
      const user = await createUser(`denied-${role.toLowerCase()}@example.test`, role);
      const cookie = await login(user.email);
      expect((await request(app).get("/api/v1/settings").set("Cookie", cookie)).status).toBe(403);
      expect((await request(app).patch("/api/v1/settings").set("Cookie", cookie).set("x-aegis-csrf", "1").send({ organizationName: "Denied" })).status).toBe(403);
      expect((await request(app).get("/api/v1/users").set("Cookie", cookie)).status).toBe(403);
      expect((await request(app).post("/api/v1/users").set("Cookie", cookie).set("x-aegis-csrf", "1").send({})).status).toBe(403);
      expect((await request(app).patch(`/api/v1/users/${new mongoose.Types.ObjectId()}`).set("Cookie", cookie).set("x-aegis-csrf", "1").send({ name: "Denied" })).status).toBe(403);
    }
  });
});