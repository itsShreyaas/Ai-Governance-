/**
 * Audit Service — the ONLY writer of AuditEvent documents.
 *
 * Algorithm (from TECH_STACK section 6):
 *   h_n = SHA256( n || canonical(event_n) || h_(n-1) )
 *
 * canonical(event) = JSON.stringify with keys sorted alphabetically;
 *                    timestamp as ISO-8601 UTC string.
 * Genesis previousHash = "0".repeat(64)  (decision U14)
 *
 * Every append runs inside a MongoDB transaction so that if the outer
 * operation (e.g. a tool update) rolls back, no orphan audit event is left.
 * Callers must pass an active ClientSession.
 *
 * UPDATE and DELETE are never called here — the model has no such methods,
 * and the DB role will additionally block them at the database level.
 */

import crypto from "node:crypto";
import mongoose from "mongoose";
import { InternalAuditEventInputSchema, type InternalAuditEventInput } from "@aegisai/shared";
import { AuditEvent } from "../models/AuditEvent.js";
import { Counter } from "../models/Counter.js";

const COUNTER_KEY = "auditEvents";
const GENESIS_HASH = "0".repeat(64);

// ─── Canonical JSON ────────────────────────────────────────────────────────────

/**
 * Produces a deterministic JSON string: keys alphabetically sorted at every
 * level, timestamp serialized as ISO-8601 UTC.
 */
function canonicalize(obj: Record<string, unknown>): string {
  return JSON.stringify(obj, Object.keys(obj).sort());
}

// ─── Hash ─────────────────────────────────────────────────────────────────────

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

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Appends one audit event to the chain.
 *
 * Must be called INSIDE an existing Mongoose session/transaction, or a fresh
 * transaction is started internally.
 *
 * @param input   Validated event payload (InternalAuditEventInput)
 * @param session An active ClientSession. If omitted, the function starts its own.
 * @returns       The inserted AuditEvent document id.
 */
export async function appendAuditEvent(
  input: InternalAuditEventInput,
  session?: mongoose.ClientSession
): Promise<string> {
  // Validate input with Zod before touching the DB
  const parsed = InternalAuditEventInputSchema.parse(input);

  const ownSession = session == null;
  const sess =
    session ?? (await mongoose.startSession());

  try {
    if (ownSession) sess.startTransaction();

    // 1. Increment sequence counter atomically
    const counter = await Counter.findOneAndUpdate(
      { _id: COUNTER_KEY },
      { $inc: { seq: 1 } },
      { upsert: true, new: true, session: sess }
    );
    if (counter == null) throw new Error("Failed to increment audit counter");
    const sequence: number = counter.seq;

    // 2. Read the previous hash (last event by sequence)
    const prev = await AuditEvent.findOne(
      { sequence: sequence - 1 },
      { hash: 1 },
      { session: sess }
    ).lean();
    const previousHash: string = prev?.hash ?? GENESIS_HASH;

    // 3. Build canonical event JSON for hashing
    const timestamp = new Date();
    const canonicalPayload = canonicalize({
      actorId: parsed.actorId ?? null,
      department: parsed.department ?? null,
      details: parsed.details,
      eventType: parsed.eventType,
      sequence,
      severity: parsed.severity,
      timestamp: timestamp.toISOString(),
      toolId: parsed.toolId ?? null,
    });

    // 4. Compute hash
    const hash = computeHash(sequence, canonicalPayload, previousHash);

    // 5. Insert — the only place in the codebase that calls AuditEvent.create
    const [doc] = await AuditEvent.create(
      [
        {
          sequence,
          timestamp,
          eventType: parsed.eventType,
          severity: parsed.severity,
          toolId: parsed.toolId ?? undefined,
          ...(parsed.actorId == null ? {} : { actor: parsed.actorId }),
          department: parsed.department,
          details: parsed.details,
          previousHash,
          hash,
        },
      ],
      { session: sess }
    );

    if (ownSession) await sess.commitTransaction();

    return (doc._id as mongoose.Types.ObjectId).toString();
  } catch (err) {
    if (ownSession) await sess.abortTransaction();
    throw err;
  } finally {
    if (ownSession) await sess.endSession();
  }
}

// ─── Verify ───────────────────────────────────────────────────────────────────

export interface VerifyResult {
  ok: boolean;
  totalEvents: number;
  firstBadSequence?: number;
  error?: string;
}

/**
 * Recomputes every hash in the chain and returns the first mismatch.
 * Read-only — never writes.
 */
export async function verifyChain(): Promise<VerifyResult> {
  const events = await AuditEvent.find({})
    .sort({ sequence: 1 })
    .lean();

  let previousHash = GENESIS_HASH;

  for (const ev of events) {
    const canonicalPayload = canonicalize({
      actorId: ev.actor?.toString() ?? null,
      department: ev.department ?? null,
      details: ev.details,
      eventType: ev.eventType,
      sequence: ev.sequence,
      severity: ev.severity,
      timestamp: ev.timestamp.toISOString(),
      toolId: ev.toolId ? ev.toolId.toString() : null,
    });

    const expected = computeHash(ev.sequence, canonicalPayload, previousHash);

    if (expected !== ev.hash) {
      return {
        ok: false,
        totalEvents: events.length,
        firstBadSequence: ev.sequence,
        error: `Hash mismatch at sequence ${ev.sequence}: stored=${ev.hash}, computed=${expected}`,
      };
    }

    if (ev.previousHash !== previousHash) {
      return {
        ok: false,
        totalEvents: events.length,
        firstBadSequence: ev.sequence,
        error: `previousHash mismatch at sequence ${ev.sequence}`,
      };
    }

    previousHash = ev.hash;
  }

  return { ok: true, totalEvents: events.length };
}
