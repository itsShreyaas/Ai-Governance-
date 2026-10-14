import { describe, it, expect } from "vitest";
import {
  CreateToolSchema,
  CreateUserSchema,
  CreateAssessmentSchema,
  CreateRequestSchema,
  ToolDecisionSchema,
  ApprovalStatus,
  DataSensitivity,
  UserRole,
  AssessmentFramework,
} from "../src/index.js";

describe("Shared Zod Schemas — Server-Controlled Field Protection", () => {
  it("CreateToolSchema: rejects server-controlled fields (approvalStatus, riskLevel, complianceScore, lastReviewed)", () => {
    const invalidPayload = {
      name: "Super LLM",
      vendor: "Acme",
      category: "LLM",
      ownerDepartment: "Engineering",
      dataSensitivity: DataSensitivity.Confidential,
      userCount: 10,
      personalData: false,
      // Attempted mass-assignment attacks:
      approvalStatus: ApprovalStatus.Approved,
      riskLevel: "Low",
      complianceScore: 100,
      lastReviewed: new Date(),
    };

    const result = CreateToolSchema.safeParse(invalidPayload);
    expect(result.success).toBe(false);
  });

  it("CreateToolSchema: succeeds with valid input fields", () => {
    const validPayload = {
      name: "ChatGPT Enterprise",
      vendor: "OpenAI",
      category: "LLM / General Assistant",
      ownerDepartment: "Product & Engineering",
      dataSensitivity: DataSensitivity.Confidential,
      userCount: 420,
      personalData: false,
      description: "Enterprise workspace",
    };

    const result = CreateToolSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it("CreateUserSchema: rejects extra server-controlled or unknown fields", () => {
    const invalidUser = {
      name: "Test Admin",
      email: "test@acmecorp.com",
      department: "InfoSec",
      role: UserRole.Admin,
      password: "password12345678",
      isActive: true, // server-controlled field
    };

    const result = CreateUserSchema.safeParse(invalidUser);
    expect(result.success).toBe(false);
  });

  it("CreateAssessmentSchema: rejects server-controlled score and riskLevel", () => {
    const invalidAssessment = {
      toolId: "64f1a2b3c4d5e6f7a8b9c0d1",
      framework: AssessmentFramework.NistAiRmf,
      answers: [{ questionId: "q1", value: "yes" }],
      // Attempted server-controlled overrides:
      score: 95,
      riskLevel: "Low",
    };

    const result = CreateAssessmentSchema.safeParse(invalidAssessment);
    expect(result.success).toBe(false);
  });

  it("CreateRequestSchema: requires either toolId or toolName", () => {
    const missingBoth = {
      useCase: "Coding assistant",
      dataTypes: ["Source Code"],
    };
    expect(CreateRequestSchema.safeParse(missingBoth).success).toBe(false);

    const withToolName = {
      toolName: "New Tool X",
      useCase: "Coding assistant",
      dataTypes: ["Source Code"],
    };
    expect(CreateRequestSchema.safeParse(withToolName).success).toBe(true);
  });

  it("ToolDecisionSchema: only permits valid decision statuses", () => {
    expect(
      ToolDecisionSchema.safeParse({
        approvalStatus: ApprovalStatus.Approved,
        reason: "Compliant after review",
      }).success
    ).toBe(true);

    expect(
      ToolDecisionSchema.safeParse({
        approvalStatus: "InvalidStatus",
        reason: "Test",
      }).success
    ).toBe(false);
  });
});
