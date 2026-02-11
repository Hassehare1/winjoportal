import type { NextRequest } from "next/server";

type AttemptRecord = {
  failCount: number;
  blockedUntilMs: number;
  lastSeenMs: number;
};

type RateLimitDecision = {
  allowed: boolean;
  waitMs: number;
  retryAfterMs?: number;
};

const attempts = new Map<string, AttemptRecord>();
const MAX_FAILURES_BEFORE_BLOCK = 6;
const BLOCK_DURATION_MS = 60_000;
const MAX_DELAY_MS = 2_000;
const ENTRY_TTL_MS = 10 * 60_000;

function nowMs() {
  return Date.now();
}

function getOrCreateRecord(key: string): AttemptRecord {
  const existing = attempts.get(key);
  if (existing) {
    return existing;
  }

  const record: AttemptRecord = {
    failCount: 0,
    blockedUntilMs: 0,
    lastSeenMs: nowMs()
  };

  attempts.set(key, record);
  return record;
}

function cleanupExpiredEntries() {
  const now = nowMs();
  for (const [key, record] of attempts.entries()) {
    if (now - record.lastSeenMs > ENTRY_TTL_MS) {
      attempts.delete(key);
    }
  }
}

export function getClientKey(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const firstIp = forwarded.split(",")[0]?.trim();
    if (firstIp) {
      return firstIp;
    }
  }
  return "unknown";
}

export function evaluateLoginRateLimit(clientKey: string): RateLimitDecision {
  cleanupExpiredEntries();
  const record = getOrCreateRecord(clientKey);
  const now = nowMs();
  record.lastSeenMs = now;

  if (record.blockedUntilMs > now) {
    return {
      allowed: false,
      waitMs: 0,
      retryAfterMs: record.blockedUntilMs - now
    };
  }

  const waitMs = Math.min(250 * 2 ** record.failCount, MAX_DELAY_MS);
  return {
    allowed: true,
    waitMs
  };
}

export function registerLoginSuccess(clientKey: string) {
  attempts.delete(clientKey);
}

export function registerLoginFailure(clientKey: string) {
  const record = getOrCreateRecord(clientKey);
  record.failCount += 1;
  record.lastSeenMs = nowMs();

  if (record.failCount >= MAX_FAILURES_BEFORE_BLOCK) {
    record.blockedUntilMs = nowMs() + BLOCK_DURATION_MS;
  }

  attempts.set(clientKey, record);
}
