import argon2 from "argon2";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ApprovalStatus, RequestStatus, UserRole } from "@aegisai/shared";
import { app } from "../app.js";
import { AuditEvent } from "../models/AuditEvent.js";
import { Counter } from "../models/Counter.js";
import { Request as ToolRequest } from "../models/Request.js";
import { Tool } from "../models/Tool.js";
import { User } from "../models/User.js";

const password = "correct-horse-battery-staple";
let mongo: MongoMemoryReplSet;
const cookiesByEmail = new Map<string, string>();

function responseCookies(response: request.Response): string[] {
  const cookies: unknown = response.headers["set-cookie"];
  if (Array.isArray(cookies) && cookies.every((cookie: unknown) => typeof cookie === "string")) return cookies;
  return typeof cookies === "string" ? [cookies] : [];
}

async function createUser(email: string, role: (typeof UserRole)[keyof typeof UserRole]) {
  return User.create({
    name: email.split("@")[0]!,
    email,
    department: "Security",
    role,
    passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
  });
}

async function login(email: string): Promise<string> {
  const cachedCookie = cookiesByEmail.get(email);
  if (cachedCookie != null) return cachedCookie;
  const response = await request(app)
    .post("/api/v1/auth/login")
    .set("x-aegis-csrf", "1")
    .send({ email, password });
  const cookie = responseCookies(response).find((value) => value.startsWith("aegis_access="));
  if (cookie == null) throw new Error("Login did not issue an access cookie");
  const accessCookie = cookie.split(";")[0]!;
  cookiesByEmail.set(email, accessCookie);
  return accessCookie;
}

const newRequest = {
  toolName: "New review tool <script>kept as text</script>",
  useCase: "Summarize internal documents",
  dataTypes: ["Internal documents"],
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
  cookiesByEmail.clear();
  await Promise.all([
    AuditEvent.deleteMany({}),
    Counter.deleteMany({}),
    ToolRequest.deleteMany({}),
    Tool.deleteMany({}),
    User.deleteMany({}),
  ]);
});

describe("request routes", () => {
  it("creates a submitted request using the session requester and appends an audit event", async () => {
    const requester = await createUser("requester@example.test", UserRole.Requester);
    const created = await request(app)
      .post("/api/v1/requests")
      .set("Cookie", await login(requester.email))
      .set("x-aegis-csrf", "1")
      .send(newRequest);
    expect(created.status).toBe(201);
    expect(created.body.requester).toBe(requester._id.toString());
    expect(created.body.status).toBe(RequestStatus.Submitted);
    expect(created.body.toolName).toBe(newRequest.toolName);
    expect(await AuditEvent.countDocuments({ eventType: "REQUEST_SUBMITTED" })).toBe(1);

    const existingTool = await Tool.create({
      name: "Registered tool",
      vendor: "Example vendor",
      category: "Productivity",
      ownerDepartment: "Security",
      dataSensitivity: "Internal Only",
      userCount: 4,
    });
    const linked = await request(app)
      .post("/api/v1/requests")
      .set("Cookie", await login(requester.email))
      .set("x-aegis-csrf", "1")
      .send({
        toolId: existingTool._id.toString(),
        useCase: "Assess registered tool",
        dataTypes: ["Internal"],
      });
    expect(linked.status).toBe(201);
    expect(linked.body.toolId).toBe(existingTool._id.toString());
    expect(linked.body).not.toHaveProperty("toolName");
    expect(await AuditEvent.countDocuments({ eventType: "REQUEST_SUBMITTED" })).toBe(2);
  });

  it("rejects invalid input and references to unknown tools", async () => {
    const admin = await createUser("admin@example.test", UserRole.Admin);
    const cookie = await login(admin.email);
    const spoofedRequester = await request(app)
      .post("/api/v1/requests")
      .set("Cookie", cookie)
      .set("x-aegis-csrf", "1")
      .send({ ...newRequest, requester: new mongoose.Types.ObjectId().toString() });
    expect(spoofedRequester.status).toBe(400);

    const invalid = await request(app)
      .post("/api/v1/requests")
      .set("Cookie", cookie)
      .set("x-aegis-csrf", "1")
      .send({ useCase: "Missing tool choice", dataTypes: ["Internal"] });
    expect(invalid.status).toBe(400);

    const unknownTool = await request(app)
      .post("/api/v1/requests")
      .set("Cookie", cookie)
      .set("x-aegis-csrf", "1")
      .send({ ...newRequest, toolName: undefined, toolId: new mongoose.Types.ObjectId().toString() });
    expect(unknownTool.status).toBe(404);
    expect(unknownTool.body.code).toBe("TOOL_NOT_FOUND");
  });

  it("requires authentication and the CSRF header for creation", async () => {
    const unauthenticated = await request(app).get("/api/v1/requests");
    expect(unauthenticated.status).toBe(401);

    const requester = await createUser("csrf-requester@example.test", UserRole.Requester);
    const missingCsrf = await request(app)
      .post("/api/v1/requests")
      .set("Cookie", await login(requester.email))
      .send(newRequest);
    expect(missingCsrf.status).toBe(403);
    expect(missingCsrf.body.code).toBe("CSRF_HEADER_REQUIRED");
  });

  it("denies Employee access to the request list", async () => {
    const employee = await createUser("employee@example.test", UserRole.Employee);
    const response = await request(app).get("/api/v1/requests").set("Cookie", await login(employee.email));
    expect(response.status).toBe(403);
  });

  it("filters and paginates requests for authorized roles", async () => {
    const admin = await createUser("list-admin@example.test", UserRole.Admin);
    const requester = await createUser("list-requester@example.test", UserRole.Requester);
    await ToolRequest.create([
      {
        requester: requester._id,
        toolName: "Submitted tool",
        useCase: "First use",
        dataTypes: ["Internal"],
        status: RequestStatus.Submitted,
      },
      {
        requester: requester._id,
        toolName: "In review tool",
        useCase: "Second use",
        dataTypes: ["Internal"],
        status: RequestStatus.InReview,
      },
    ]);

    const response = await request(app)
      .get("/api/v1/requests?page=1&limit=1&status=Submitted")
      .set("Cookie", await login(admin.email));
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ total: 1, page: 1, limit: 1 });
    expect(response.body.data[0].status).toBe(RequestStatus.Submitted);
  });

  it("does not let a Requester read another user's request", async () => {
    const requester = await createUser("owner@example.test", UserRole.Requester);
    const otherRequester = await createUser("other@example.test", UserRole.Requester);
    await ToolRequest.create({
      requester: otherRequester._id,
      toolName: "Private request",
      useCase: "Private use case",
      dataTypes: ["Confidential"],
    });

    const response = await request(app).get("/api/v1/requests").set("Cookie", await login(requester.email));
    expect(response.status).toBe(200);
    expect(response.body.total).toBe(0);
    expect(response.body.data).toHaveLength(0);
  });

  it("moves Submitted requests to In review with an eligible reviewer", async () => {
    const requester = await createUser("transition-requester@example.test", UserRole.Requester);
    const reviewer = await createUser("transition-reviewer@example.test", UserRole.Admin);
    const submitted = await request(app)
      .post("/api/v1/requests")
      .set("Cookie", await login(requester.email))
      .set("x-aegis-csrf", "1")
      .send(newRequest);

    const response = await request(app)
      .patch(`/api/v1/requests/${submitted.body._id}`)
      .set("Cookie", await login(reviewer.email))
      .set("x-aegis-csrf", "1")
      .send({ reviewer: reviewer._id.toString(), status: RequestStatus.InReview });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe(RequestStatus.InReview);
    expect(response.body.reviewer).toBe(reviewer._id.toString());
    expect(response.body.decidedAt).toBeUndefined();
    expect(await AuditEvent.countDocuments({ eventType: "REQUEST_REVIEWED" })).toBe(1);
  });

  it("rejects invalid status transitions with 409", async () => {
    const requester = await createUser("invalid-transition-requester@example.test", UserRole.Requester);
    const reviewer = await createUser("invalid-transition-reviewer@example.test", UserRole.Admin);
    const reviewerCookie = await login(reviewer.email);
    const submitted = await request(app)
      .post("/api/v1/requests")
      .set("Cookie", await login(requester.email))
      .set("x-aegis-csrf", "1")
      .send(newRequest);

    const serverFields = await request(app)
      .patch(`/api/v1/requests/${submitted.body._id}`)
      .set("Cookie", reviewerCookie)
      .set("x-aegis-csrf", "1")
      .send({
        reviewer: reviewer._id.toString(),
        status: RequestStatus.InReview,
        requester: requester._id.toString(),
        submittedAt: new Date().toISOString(),
        decidedAt: new Date().toISOString(),
      });
    expect(serverFields.status).toBe(400);

    const response = await request(app)
      .patch(`/api/v1/requests/${submitted.body._id}`)
      .set("Cookie", reviewerCookie)
      .set("x-aegis-csrf", "1")
      .send({ reviewer: reviewer._id.toString(), status: RequestStatus.Approved });

    expect(response.status).toBe(409);
    expect(response.body.code).toBe("INVALID_REQUEST_TRANSITION");

    const missingId = new mongoose.Types.ObjectId().toString();
    const invalidUpdate = await request(app)
      .patch(`/api/v1/requests/${missingId}`)
      .set("Cookie", reviewerCookie)
      .set("x-aegis-csrf", "1")
      .send({ status: "Unknown" });
    expect(invalidUpdate.status).toBe(400);

    const missingRequest = await request(app)
      .patch(`/api/v1/requests/${missingId}`)
      .set("Cookie", reviewerCookie)
      .set("x-aegis-csrf", "1")
      .send({ reviewer: reviewer._id.toString() });
    expect(missingRequest.status).toBe(404);
    expect(missingRequest.body.code).toBe("REQUEST_NOT_FOUND");
  });

  it("locks decided requests against further changes", async () => {
    const requester = await createUser("final-requester@example.test", UserRole.Requester);
    const reviewer = await createUser("final-reviewer@example.test", UserRole.Admin);
    const submitted = await request(app)
      .post("/api/v1/requests")
      .set("Cookie", await login(requester.email))
      .set("x-aegis-csrf", "1")
      .send(newRequest);
    await request(app)
      .patch(`/api/v1/requests/${submitted.body._id}`)
      .set("Cookie", await login(reviewer.email))
      .set("x-aegis-csrf", "1")
      .send({ reviewer: reviewer._id.toString(), status: RequestStatus.InReview });
    const approved = await request(app)
      .patch(`/api/v1/requests/${submitted.body._id}`)
      .set("Cookie", await login(reviewer.email))
      .set("x-aegis-csrf", "1")
      .send({ status: RequestStatus.Approved });
    expect(approved.status).toBe(200);
    expect(approved.body.decidedAt).toBeTruthy();

    const locked = await request(app)
      .patch(`/api/v1/requests/${submitted.body._id}`)
      .set("Cookie", await login(reviewer.email))
      .set("x-aegis-csrf", "1")
      .send({ reviewer: reviewer._id.toString() });
    expect(locked.status).toBe(409);
    expect(locked.body.code).toBe("REQUEST_FINAL");
  });

  it("blocks self-review and unknown reviewers", async () => {
    const requester = await createUser("self-review@example.test", UserRole.Admin);
    const submitted = await request(app)
      .post("/api/v1/requests")
      .set("Cookie", await login(requester.email))
      .set("x-aegis-csrf", "1")
      .send(newRequest);
    const selfReview = await request(app)
      .patch(`/api/v1/requests/${submitted.body._id}`)
      .set("Cookie", await login(requester.email))
      .set("x-aegis-csrf", "1")
      .send({ reviewer: requester._id.toString(), status: RequestStatus.InReview });
    expect(selfReview.status).toBe(403);
    expect(selfReview.body.code).toBe("SELF_REVIEW_DENIED");

    const otherRequester = await createUser("unknown-reviewer-owner@example.test", UserRole.Requester);
    const otherSubmitted = await request(app)
      .post("/api/v1/requests")
      .set("Cookie", await login(otherRequester.email))
      .set("x-aegis-csrf", "1")
      .send(newRequest);
    const unknownReviewer = await request(app)
      .patch(`/api/v1/requests/${otherSubmitted.body._id}`)
      .set("Cookie", await login(requester.email))
      .set("x-aegis-csrf", "1")
      .send({ reviewer: new mongoose.Types.ObjectId().toString(), status: RequestStatus.InReview });
    expect(unknownReviewer.status).toBe(404);
    expect(unknownReviewer.body.code).toBe("REVIEWER_NOT_FOUND");
  });


  it("updates linked tool approval and writes decision audit in the review transaction", async () => {
    const requester = await createUser("linked-requester@example.test", UserRole.Requester);
    const reviewer = await createUser("linked-reviewer@example.test", UserRole.Compliance);
    const tool = await Tool.create({
      name: "Linked tool",
      vendor: "Example vendor",
      category: "Productivity",
      ownerDepartment: "Security",
      dataSensitivity: "Internal Only",
      userCount: 3,
    });
    const submitted = await request(app)
      .post("/api/v1/requests")
      .set("Cookie", await login(requester.email))
      .set("x-aegis-csrf", "1")
      .send({ toolId: tool._id.toString(), useCase: "Review", dataTypes: ["Internal"] });
    await request(app)
      .patch(`/api/v1/requests/${submitted.body._id}`)
      .set("Cookie", await login(reviewer.email))
      .set("x-aegis-csrf", "1")
      .send({ reviewer: reviewer._id.toString(), status: RequestStatus.InReview });

    const approved = await request(app)
      .patch(`/api/v1/requests/${submitted.body._id}`)
      .set("Cookie", await login(reviewer.email))
      .set("x-aegis-csrf", "1")
      .send({ status: RequestStatus.Approved });
    const updatedTool = await Tool.findById(tool._id);
    const decisionAudit = await AuditEvent.findOne({ eventType: "TOOL_DECISION", toolId: tool._id });

    expect(approved.status).toBe(200);
    expect(updatedTool?.approvalStatus).toBe(ApprovalStatus.Approved);
    expect(decisionAudit).not.toBeNull();
    expect(await AuditEvent.countDocuments({ eventType: "REQUEST_REVIEWED", toolId: tool._id })).toBe(2);
  });

  it("leaves linked tool approval unchanged when a request is rejected", async () => {
    const requester = await createUser("reject-requester@example.test", UserRole.Requester);
    const reviewer = await createUser("reject-reviewer@example.test", UserRole.Admin);
    const tool = await Tool.create({
      name: "Rejected request tool",
      vendor: "Example vendor",
      category: "Productivity",
      ownerDepartment: "Security",
      dataSensitivity: "Internal Only",
      userCount: 3,
    });
    const submitted = await request(app)
      .post("/api/v1/requests")
      .set("Cookie", await login(requester.email))
      .set("x-aegis-csrf", "1")
      .send({ toolId: tool._id.toString(), useCase: "Review", dataTypes: ["Internal"] });
    await request(app)
      .patch(`/api/v1/requests/${submitted.body._id}`)
      .set("Cookie", await login(reviewer.email))
      .set("x-aegis-csrf", "1")
      .send({ reviewer: reviewer._id.toString(), status: RequestStatus.InReview });
    await request(app)
      .patch(`/api/v1/requests/${submitted.body._id}`)
      .set("Cookie", await login(reviewer.email))
      .set("x-aegis-csrf", "1")
      .send({ status: RequestStatus.Rejected });

    expect((await Tool.findById(tool._id))?.approvalStatus).toBe(ApprovalStatus.PendingReview);
    expect(await AuditEvent.countDocuments({ eventType: "TOOL_DECISION", toolId: tool._id })).toBe(0);
  });

  it("requires authentication, authorization, and CSRF for review updates", async () => {
    const requestId = new mongoose.Types.ObjectId().toString();
    const unauthenticated = await request(app)
      .patch(`/api/v1/requests/${requestId}`)
      .set("x-aegis-csrf", "1")
      .send({ status: RequestStatus.InReview });
    expect(unauthenticated.status).toBe(401);

    const employee = await createUser("patch-employee@example.test", UserRole.Employee);
    const forbidden = await request(app)
      .patch(`/api/v1/requests/${requestId}`)
      .set("Cookie", await login(employee.email))
      .set("x-aegis-csrf", "1")
      .send({ status: RequestStatus.InReview });
    expect(forbidden.status).toBe(403);

    const admin = await createUser("patch-admin@example.test", UserRole.Admin);
    const missingCsrf = await request(app)
      .patch(`/api/v1/requests/${requestId}`)
      .set("Cookie", await login(admin.email))
      .send({ status: RequestStatus.InReview });
    expect(missingCsrf.status).toBe(403);
    expect(missingCsrf.body.code).toBe("CSRF_HEADER_REQUIRED");
  });
});