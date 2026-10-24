import argon2 from "argon2";
import crypto from "node:crypto";
import mongoose from "mongoose";
import { AuditEventType, AuditSeverity } from "@aegisai/shared";
import type { LoginInput } from "@aegisai/shared";
import { RefreshToken } from "../models/RefreshToken.js";
import { User } from "../models/User.js";
import { HttpError } from "../middleware/httpError.js";
import { appendAuditEvent } from "./auditService.js";
import {
  createAccessToken,
  createRefreshToken,
  hashRefreshToken,
  refreshExpiration,
} from "./authTokens.js";
import { logger } from "./logger.js";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;
const DUMMY_PASSWORD_HASH = argon2.hash(crypto.randomBytes(32).toString("hex"), { type: argon2.argon2id });

async function passwordMatches(hash: string | undefined, password: string): Promise<boolean> {
  if (hash == null) return false;
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    name: string;
    email: string;
    department: string;
    role: string;
  };
}

function publicUser(user: { _id: mongoose.Types.ObjectId; name: string; email: string; department: string; role: string }) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    department: user.department,
    role: user.role,
  };
}

export async function login(input: LoginInput): Promise<AuthSession> {
  const session = await mongoose.startSession();
  let outcome: AuthSession | "invalid" = "invalid";

  try {
    await session.withTransaction(async () => {
      const user = await User.findOne({ email: input.email }).session(session);
      if (user == null) {
        await passwordMatches(await DUMMY_PASSWORD_HASH, input.password);
        await appendAuditEvent(
          {
            eventType: AuditEventType.LoginFailed,
            severity: AuditSeverity.Warning,
            details: "Failed login attempt",
          },
          session
        );
        return;
      }

      const isLocked = user.lockoutUntil != null && user.lockoutUntil.getTime() > Date.now();
      const validPassword = !isLocked && await passwordMatches(user.passwordHash, input.password);
      if (!user.isActive || !validPassword) {
        if (user.isActive && !isLocked && user.passwordHash != null) {
          const nextAttempts = user.failedLoginAttempts + 1;
          const lockoutUntil = nextAttempts >= MAX_FAILED_ATTEMPTS ? new Date(Date.now() + LOCKOUT_MS) : null;
          await User.updateOne(
            { _id: user._id },
            { $inc: { failedLoginAttempts: 1 }, ...(lockoutUntil == null ? {} : { $set: { lockoutUntil } }) },
            { session }
          );
        }
        if (user.isActive) {
          await appendAuditEvent(
            {
              eventType: AuditEventType.LoginFailed,
              severity: AuditSeverity.Warning,
              actorId: user._id.toString(),
              department: user.department,
              details: "Failed login attempt",
            },
            session
          );
        }
        return;
      }

      await User.updateOne(
        { _id: user._id },
        { $set: { failedLoginAttempts: 0, lockoutUntil: null } },
        { session }
      );

      const refreshToken = createRefreshToken();
      await RefreshToken.create(
        [{
          userId: user._id,
          tokenHash: hashRefreshToken(refreshToken),
          familyId: crypto.randomUUID(),
          expiresAt: refreshExpiration(),
        }],
        { session }
      );
      await appendAuditEvent(
        {
          eventType: AuditEventType.Login,
          severity: AuditSeverity.Success,
          actorId: user._id.toString(),
          department: user.department,
          details: "User signed in",
        },
        session
      );

      outcome = {
        accessToken: await createAccessToken(user._id.toString()),
        refreshToken,
        user: publicUser(user),
      };
    });
  } finally {
    await session.endSession();
  }

  if (outcome === "invalid") {
    logger.warn({ event: "login_failed" }, "Authentication attempt failed");
    throw new HttpError(401, "INVALID_CREDENTIALS", "Email or password is incorrect");
  }
  return outcome;
}

export type RefreshOutcome = { session: AuthSession } | { error: "invalid" | "reuse" };

export async function refresh(refreshToken: string): Promise<RefreshOutcome> {
  const tokenHash = hashRefreshToken(refreshToken);
  const session = await mongoose.startSession();
  let outcome: RefreshOutcome = { error: "invalid" };

  try {
    await session.withTransaction(async () => {
      const storedToken = await RefreshToken.findOne({ tokenHash }).session(session);
      if (storedToken == null) return;

      const now = new Date();
      if (storedToken.revokedAt != null) {
        await RefreshToken.updateMany(
          { familyId: storedToken.familyId, revokedAt: null },
          { $set: { revokedAt: now } },
          { session }
        );
        await appendAuditEvent(
          {
            eventType: AuditEventType.AccessRevocation,
            severity: AuditSeverity.Critical,
            actorId: storedToken.userId.toString(),
            details: "Refresh token reuse detected; session family revoked",
          },
          session
        );
        outcome = { error: "reuse" };
        return;
      }

      if (storedToken.expiresAt <= now) return;
      const user = await User.findById(storedToken.userId).session(session);
      if (user == null || !user.isActive) {
        await RefreshToken.updateMany(
          { familyId: storedToken.familyId, revokedAt: null },
          { $set: { revokedAt: now } },
          { session }
        );
        await appendAuditEvent(
          {
            eventType: AuditEventType.AccessRevocation,
            severity: AuditSeverity.Warning,
            actorId: storedToken.userId.toString(),
            ...(user == null ? {} : { department: user.department }),
            details: "Inactive or missing user session revoked",
          },
          session
        );
        return;
      }

      const replacementToken = createRefreshToken();
      await RefreshToken.updateOne(
        { _id: storedToken._id, revokedAt: null },
        { $set: { revokedAt: now } },
        { session }
      );
      await RefreshToken.create(
        [{
          userId: user._id,
          tokenHash: hashRefreshToken(replacementToken),
          familyId: storedToken.familyId,
          expiresAt: refreshExpiration(),
        }],
        { session }
      );
      await appendAuditEvent(
        {
          eventType: AuditEventType.SessionRefresh,
          severity: AuditSeverity.Info,
          actorId: user._id.toString(),
          department: user.department,
          details: "Refresh token rotated",
        },
        session
      );
      outcome = {
        session: {
          accessToken: await createAccessToken(user._id.toString()),
          refreshToken: replacementToken,
          user: publicUser(user),
        },
      };
    });
  } finally {
    await session.endSession();
  }

  if (outcome.error === "reuse") {
    logger.warn({ event: "refresh_reuse_detected" }, "Refresh token reuse revoked a token family");
  }
  return outcome;
}

export async function logout(refreshToken: string): Promise<void> {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const storedToken = await RefreshToken.findOne({ tokenHash: hashRefreshToken(refreshToken) }).session(session);
      if (storedToken == null || storedToken.revokedAt != null) return;

      const now = new Date();
      await RefreshToken.updateMany(
        { familyId: storedToken.familyId, revokedAt: null },
        { $set: { revokedAt: now } },
        { session }
      );
      const user = await User.findById(storedToken.userId).session(session);
      await appendAuditEvent(
        {
          eventType: AuditEventType.Logout,
          severity: AuditSeverity.Info,
          actorId: storedToken.userId.toString(),
          ...(user == null ? {} : { department: user.department }),
          details: "User signed out",
        },
        session
      );
    });
  } finally {
    await session.endSession();
  }
}