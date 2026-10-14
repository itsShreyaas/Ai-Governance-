import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import { AuditEventType, AuditSeverity } from "@aegisai/shared";

function canonicalize(obj: Record<string, unknown>): string {
  return JSON.stringify(obj, Object.keys(obj).sort());
}

function sha256(input: string): string {
  return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

function computeHash(
  sequence: number,
  eventCanonical: string,
  previousHash: string
): string {
  return sha256(`${sequence}${eventCanonical}${previousHash}`);
}

describe("Audit Hash Chain Integrity Logic", () => {
  const GENESIS_HASH = "0".repeat(64);

  it("canonicalize: keys are strictly sorted in alphabetical order regardless of insertion order", () => {
    const objA = {
      zebra: 1,
      apple: 2,
      middle: "text",
    };
    const objB = {
      apple: 2,
      middle: "text",
      zebra: 1,
    };

    expect(canonicalize(objA)).toEqual(canonicalize(objB));
    expect(canonicalize(objA)).toBe('{"apple":2,"middle":"text","zebra":1}');
  });

  it("computes reproducible hash for sequence 1 linked to genesis hash", () => {
    const timestamp = new Date("2026-10-15T00:00:00.000Z").toISOString();
    const payload = canonicalize({
      actorId: "64f1a2b3c4d5e6f7a8b9c0d1",
      department: "InfoSec & Governance",
      details: "Test audit event",
      eventType: AuditEventType.ToolSubmission,
      sequence: 1,
      severity: AuditSeverity.Info,
      timestamp,
      toolId: "64f1a2b3c4d5e6f7a8b9c0d2",
    });

    const hash1 = computeHash(1, payload, GENESIS_HASH);
    expect(hash1).toHaveLength(64);
    expect(hash1).toMatch(/^[a-f0-9]{64}$/);

    // Re-computing with identical values yields the exact same hash
    const hash1Copy = computeHash(1, payload, GENESIS_HASH);
    expect(hash1Copy).toBe(hash1);
  });

  it("chain integrity: modifying an event payload in step 1 invalidates subsequent hashes", () => {
    const timestamp1 = new Date("2026-10-15T00:00:00.000Z").toISOString();
    const payload1 = canonicalize({
      actorId: "actor1",
      department: "Dept A",
      details: "Original Details",
      eventType: AuditEventType.ToolSubmission,
      sequence: 1,
      severity: AuditSeverity.Info,
      timestamp: timestamp1,
      toolId: "tool1",
    });
    const hash1 = computeHash(1, payload1, GENESIS_HASH);

    const timestamp2 = new Date("2026-10-15T00:01:00.000Z").toISOString();
    const payload2 = canonicalize({
      actorId: "actor2",
      department: "Dept B",
      details: "Second Event",
      eventType: AuditEventType.ApprovalGranted,
      sequence: 2,
      severity: AuditSeverity.Success,
      timestamp: timestamp2,
      toolId: "tool1",
    });
    const hash2 = computeHash(2, payload2, hash1);

    // Now simulate an attacker tampering with details in Event 1
    const tamperedPayload1 = canonicalize({
      actorId: "actor1",
      department: "Dept A",
      details: "TAMPERED DETAILS", // modified!
      eventType: AuditEventType.ToolSubmission,
      sequence: 1,
      severity: AuditSeverity.Info,
      timestamp: timestamp1,
      toolId: "tool1",
    });
    const tamperedHash1 = computeHash(1, tamperedPayload1, GENESIS_HASH);

    // Tampered hash 1 does NOT match original hash 1
    expect(tamperedHash1).not.toBe(hash1);

    // Event 2's hash (which depends on hash 1) fails validation when recomputed with tampered hash 1
    const recomputedHash2 = computeHash(2, payload2, tamperedHash1);
    expect(recomputedHash2).not.toBe(hash2);
  });
});
