import argon2 from "argon2";
import crypto from "node:crypto";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { RequestStatus, UserRole } from "@aegisai/shared";
import { AuditEvent } from "../models/AuditEvent.js";
import { Counter } from "../models/Counter.js";
import { RefreshToken } from "../models/RefreshToken.js";
import { Request as ToolRequest } from "../models/Request.js";
import { Settings } from "../models/Settings.js";
import { Tool } from "../models/Tool.js";
import { User } from "../models/User.js";

const roles = [
  UserRole.Admin,
  UserRole.Compliance,
  UserRole.Requester,
  UserRole.Employee,
  UserRole.Auditor,
] as const;
type MatrixRole = (typeof roles)[number];

interface RoleFixture {
  role: MatrixRole;
  id: string;
  email: string;
  accessCookie: string;
}

interface RequestSetup {
  path?: string;
  body?: Record<string, unknown>;
  cookie?: string | null;
  csrf?: boolean;
}

interface RouteCase {
  name: string;
  method: "get" | "post" | "patch";
  path: string;
  allowed: readonly MatrixRole[];
  successStatus: number;
  unauthenticatedStatus: number;
  prepare?: (fixture?: RoleFixture) => Promise<RequestSetup>;
}

const password = "correct-horse-battery-staple";
let mongo: MongoMemoryReplSet;
let app: typeof import("../app.js").app;
let createAccessToken: typeof import("../services/authTokens.js").createAccessToken;
let createRefreshToken: typeof import("../services/authTokens.js").createRefreshToken;
let hashRefreshToken: typeof import("../services/authTokens.js").hashRefreshToken;
let refreshExpiration: typeof import("../services/authTokens.js").refreshExpiration;
const fixtures = new Map<MatrixRole, RoleFixture>();

async function refreshCookie(fixture: RoleFixture): Promise<string> {
  const token = createRefreshToken();
  await RefreshToken.create({
    userId: fixture.id,
    tokenHash: hashRefreshToken(token),
    familyId: crypto.randomUUID(),
    expiresAt: refreshExpiration(),
  });
  return `aegis_refresh=${token}`;
}

async function prepareTool(): Promise<string> {
  const tool = await Tool.create({
    name: "Role matrix tool",
    vendor: "Example",
    category: "Productivity",
    ownerDepartment: "Security",
    dataSensitivity: "Internal Only",
    userCount: 1,
  });
  return tool._id.toString();
}

async function prepareRequest(): Promise<string> {
  const requester = fixtures.get(UserRole.Requester);
  if (requester == null) throw new Error("Requester fixture is missing");
  const record = await ToolRequest.create({
    toolName: "Role matrix request",
    requester: requester.id,
    useCase: "Verify route permissions",
    dataTypes: ["Internal"],
    status: RequestStatus.Submitted,
  });
  return record._id.toString();
}

const routeCases: RouteCase[] = [
  {
    name: "POST /auth/login",
    method: "post",
    path: "/api/v1/auth/login",
    allowed: roles,
    successStatus: 200,
    unauthenticatedStatus: 401,
    prepare: async (fixture) => ({
      csrf: true,
      body: {
        email: fixture?.email ?? "missing@example.test",
        password,
      },
    }),
  },
  {
    name: "POST /auth/refresh",
    method: "post",
    path: "/api/v1/auth/refresh",
    allowed: roles,
    successStatus: 200,
    unauthenticatedStatus: 401,
    prepare: async (fixture) => ({
      cookie: fixture == null ? null : await refreshCookie(fixture),
      csrf: true,
    }),
  },
  {
    name: "POST /auth/logout",
    method: "post",
    path: "/api/v1/auth/logout",
    allowed: roles,
    successStatus: 204,
    unauthenticatedStatus: 401,
    prepare: async (fixture) => ({
      cookie: fixture == null ? null : await refreshCookie(fixture),
      csrf: true,
    }),
  },
  {
    name: "GET /auth/me",
    method: "get",
    path: "/api/v1/auth/me",
    allowed: roles,
    successStatus: 200,
    unauthenticatedStatus: 401,
  },
  {
    name: "GET /tools",
    method: "get",
    path: "/api/v1/tools",
    allowed: [UserRole.Admin, UserRole.Compliance, UserRole.Requester, UserRole.Auditor],
    successStatus: 200,
    unauthenticatedStatus: 401,
  },
  {
    name: "POST /tools",
    method: "post",
    path: "/api/v1/tools",
    allowed: [UserRole.Admin, UserRole.Compliance],
    successStatus: 201,
    unauthenticatedStatus: 401,
    prepare: async () => ({
      csrf: true,
      body: {
        name: "New role matrix tool",
        vendor: "Example",
        category: "Productivity",
        ownerDepartment: "Security",
        dataSensitivity: "Internal Only",
        userCount: 1,
      },
    }),
  },
  {
    name: "PATCH /tools/:id",
    method: "patch",
    path: "/api/v1/tools",
    allowed: [UserRole.Admin, UserRole.Compliance],
    successStatus: 200,
    unauthenticatedStatus: 401,
    prepare: async () => ({
      path: `/api/v1/tools/${await prepareTool()}`,
      csrf: true,
      body: { userCount: 2 },
    }),
  },
  {
    name: "POST /tools/:id/decision",
    method: "post",
    path: "/api/v1/tools",
    allowed: [UserRole.Admin, UserRole.Compliance],
    successStatus: 200,
    unauthenticatedStatus: 401,
    prepare: async () => ({
      path: `/api/v1/tools/${await prepareTool()}/decision`,
      csrf: true,
      body: { approvalStatus: "Approved", reason: "Role matrix test" },
    }),
  },
  {
    name: "POST /requests",
    method: "post",
    path: "/api/v1/requests",
    allowed: [UserRole.Requester, UserRole.Admin, UserRole.Compliance],
    successStatus: 201,
    unauthenticatedStatus: 401,
    prepare: async () => ({
      csrf: true,
      body: {
        toolName: "Role matrix request",
        useCase: "Verify route permissions",
        dataTypes: ["Internal"],
      },
    }),
  },
  {
    name: "GET /requests",
    method: "get",
    path: "/api/v1/requests",
    allowed: [UserRole.Requester, UserRole.Admin, UserRole.Compliance, UserRole.Auditor],
    successStatus: 200,
    unauthenticatedStatus: 401,
  },
  {
    name: "PATCH /requests/:id",
    method: "patch",
    path: "/api/v1/requests",
    allowed: [UserRole.Admin, UserRole.Compliance],
    successStatus: 200,
    unauthenticatedStatus: 401,
    prepare: async (fixture) => {
      if (fixture == null) return { path: "/api/v1/requests/not-an-id", csrf: true, body: {} };
      return {
        path: `/api/v1/requests/${await prepareRequest()}`,
        csrf: true,
        body: { reviewer: fixture.id, status: RequestStatus.InReview },
      };
    },
  },
  {
    name: "GET /audit",
    method: "get",
    path: "/api/v1/audit",
    allowed: [UserRole.Admin, UserRole.Compliance, UserRole.Auditor],
    successStatus: 200,
    unauthenticatedStatus: 401,
  },
  {
    name: "GET /audit/export",
    method: "get",
    path: "/api/v1/audit/export",
    allowed: [UserRole.Admin, UserRole.Compliance, UserRole.Auditor],
    successStatus: 200,
    unauthenticatedStatus: 401,
  },
  {
    name: "GET /audit/verify",
    method: "get",
    path: "/api/v1/audit/verify",
    allowed: [UserRole.Admin, UserRole.Auditor],
    successStatus: 200,
    unauthenticatedStatus: 401,
  },
  {
    name: "GET /dashboard",
    method: "get",
    path: "/api/v1/dashboard",
    allowed: [UserRole.Admin, UserRole.Compliance, UserRole.Auditor],
    successStatus: 200,
    unauthenticatedStatus: 401,
  },
  {
    name: "GET /settings",
    method: "get",
    path: "/api/v1/settings",
    allowed: [UserRole.Admin],
    successStatus: 200,
    unauthenticatedStatus: 401,
  },
  {
    name: "PATCH /settings",
    method: "patch",
    path: "/api/v1/settings",
    allowed: [UserRole.Admin],
    successStatus: 200,
    unauthenticatedStatus: 401,
    prepare: async () => ({ csrf: true, body: { organizationName: "Role matrix" } }),
  },
  {
    name: "GET /users",
    method: "get",
    path: "/api/v1/users",
    allowed: [UserRole.Admin],
    successStatus: 200,
    unauthenticatedStatus: 401,
  },
  {
    name: "POST /users",
    method: "post",
    path: "/api/v1/users",
    allowed: [UserRole.Admin],
    successStatus: 201,
    unauthenticatedStatus: 401,
    prepare: async (fixture) => ({
      csrf: true,
      body: {
        name: "Role matrix created user",
        email: `created-${fixture?.role ?? "anonymous"}@example.test`,
        department: "Security",
        role: UserRole.Employee,
        password: "long-enough-test-password",
      },
    }),
  },
  {
    name: "PATCH /users/:id",
    method: "patch",
    path: "/api/v1/users",
    allowed: [UserRole.Admin],
    successStatus: 200,
    unauthenticatedStatus: 401,
    prepare: async (fixture) => ({
      path: `/api/v1/users/${fixture?.id ?? new mongoose.Types.ObjectId().toString()}`,
      csrf: true,
      body: { name: "Updated role matrix user" },
    }),
  },
];

async function sendRoute(route: RouteCase, fixture?: RoleFixture) {
  const setup = (await route.prepare?.(fixture)) ?? {};
  const path = setup.path ?? route.path;
  let call = request(app)[route.method](path);
  const cookie = setup.cookie === null ? undefined : setup.cookie ?? fixture?.accessCookie;
  if (cookie != null) call = call.set("Cookie", cookie);
  if (setup.csrf) call = call.set("x-aegis-csrf", "1");
  if (setup.body != null) call = call.send(setup.body);
  return call;
}

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  process.env.PORT = "3000";
  process.env.JWT_ACCESS_SECRET = "a".repeat(64);
  process.env.JWT_REFRESH_SECRET = "b".repeat(64);
  process.env.CLIENT_ORIGIN = "http://localhost:5173";
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  await mongoose.connect(mongo.getUri("aegisai"));
  ({ app } = await import("../app.js"));
  ({ createAccessToken, createRefreshToken, hashRefreshToken, refreshExpiration } = await import("../services/authTokens.js"));

  for (const role of roles) {
    const user = await User.create({
      name: `${role} Route Tester`,
      email: `${role.toLowerCase()}-route@example.test`,
      department: "Security",
      role,
      passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
    });
    fixtures.set(role, {
      role,
      id: user._id.toString(),
      email: user.email,
      accessCookie: `aegis_access=${await createAccessToken(user._id.toString())}`,
    });
  }
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
    ToolRequest.deleteMany({}),
    Settings.deleteMany({}),
    Tool.deleteMany({}),
  ]);
});

describe("route authorization matrix", () => {
  it.each(routeCases)("$name checks every role and unauthenticated access", async (route) => {
    for (const role of roles) {
      const fixture = fixtures.get(role);
      if (fixture == null) throw new Error(`Missing ${role} fixture`);
      const response = await sendRoute(route, fixture);
      const expected = route.allowed.includes(role) ? route.successStatus : 403;
      expect(response.status, `${route.name} as ${role}`).toBe(expected);
    }

    const unauthenticated = await sendRoute(route);
    expect(unauthenticated.status, `${route.name} unauthenticated`).toBe(route.unauthenticatedStatus);
  });
});
