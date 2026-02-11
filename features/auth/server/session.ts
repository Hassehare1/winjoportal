import crypto from "node:crypto";
import { SESSION_TTL_SECONDS } from "@/features/auth/server/constants";

type SessionStatus = {
  authenticated: boolean;
  expiresAt?: number;
};

function getAuthCookieSecret(): string {
  const value = process.env.AUTH_COOKIE_SECRET;
  if (!value) {
    throw new Error("AUTH_COOKIE_SECRET saknas i environment.");
  }
  return value;
}

function signPayload(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("base64url");
}

function safeStringEqual(a: string, b: string): boolean {
  const aDigest = crypto.createHash("sha256").update(a).digest();
  const bDigest = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(aDigest, bDigest);
}

export function createSignedSessionToken(expiresAtUnixSeconds: number, secret: string): string {
  const payload = `v1.${expiresAtUnixSeconds}`;
  const signature = signPayload(payload, secret);
  return `${payload}.${signature}`;
}

export function verifySignedSessionToken(
  token: string | undefined,
  secret: string,
  nowUnixSeconds = Math.floor(Date.now() / 1000)
): SessionStatus {
  if (!token) {
    return { authenticated: false };
  }

  const segments = token.split(".");
  if (segments.length !== 3) {
    return { authenticated: false };
  }

  const [version, expiresAtRaw, receivedSignature] = segments;
  if (version !== "v1") {
    return { authenticated: false };
  }

  if (!/^\d+$/.test(expiresAtRaw)) {
    return { authenticated: false };
  }

  const expectedSignature = signPayload(`${version}.${expiresAtRaw}`, secret);
  if (!safeStringEqual(receivedSignature, expectedSignature)) {
    return { authenticated: false };
  }

  const expiresAt = Number(expiresAtRaw);
  if (expiresAt <= nowUnixSeconds) {
    return { authenticated: false };
  }

  return {
    authenticated: true,
    expiresAt
  };
}

export function readPortalSessionFromToken(token: string | undefined): SessionStatus {
  try {
    const secret = getAuthCookieSecret();
    return verifySignedSessionToken(token, secret);
  } catch {
    return { authenticated: false };
  }
}

export function buildSessionTokenForLogin(): { token: string; maxAge: number } {
  const nowUnixSeconds = Math.floor(Date.now() / 1000);
  const expiresAt = nowUnixSeconds + SESSION_TTL_SECONDS;
  const token = createSignedSessionToken(expiresAt, getAuthCookieSecret());
  return {
    token,
    maxAge: SESSION_TTL_SECONDS
  };
}
