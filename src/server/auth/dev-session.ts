import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../env";

// Development-only sign-in. The cookie carries an HMAC-signed identity so it cannot be
// edited by hand; it is only ever read when devAuthEnabled() is true.

export const DEV_COOKIE = "restix_dev_session";
const MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

export interface DevIdentity {
  sub: string;
  email: string;
  name: string;
  iat: number;
}

function sign(payload: string): string {
  return createHmac("sha256", env().DEV_AUTH_SECRET!).update(payload).digest("base64url");
}

export function encodeDevSession(identity: Omit<DevIdentity, "iat">): string {
  const payload = Buffer.from(JSON.stringify({ ...identity, iat: Math.floor(Date.now() / 1000) })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function decodeDevSession(value: string | undefined): DevIdentity | null {
  if (!value) return null;
  const [payload, mac] = value.split(".");
  if (!payload || !mac) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as DevIdentity;
    if (typeof data.sub !== "string" || typeof data.email !== "string") return null;
    if (Math.floor(Date.now() / 1000) - data.iat > MAX_AGE_SECONDS) return null;
    return data;
  } catch {
    return null;
  }
}

export const devCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: MAX_AGE_SECONDS,
};
