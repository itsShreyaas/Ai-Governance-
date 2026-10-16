import crypto from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { env } from "../config/env.js";

const accessKey = new TextEncoder().encode(env.JWT_ACCESS_SECRET);

export function createRefreshToken(): string {
  return crypto.randomBytes(48).toString("base64url");
}

export function hashRefreshToken(token: string): string {
  return crypto.createHmac("sha256", env.JWT_REFRESH_SECRET).update(token).digest("hex");
}

export async function createAccessToken(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(accessKey);
}

export async function verifyAccessToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, accessKey, { algorithms: ["HS256"] });
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

export function refreshExpiration(): Date {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
}
