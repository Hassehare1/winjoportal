import type { NextRequest } from "next/server";

type Entry = {
  count: number;
  windowStartMs: number;
};

const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 8;
const CLEANUP_TTL_MS = 8 * 60_000;
const entries = new Map<string, Entry>();

function nowMs() {
  return Date.now();
}

function cleanup() {
  const now = nowMs();
  for (const [key, value] of entries.entries()) {
    if (now - value.windowStartMs > CLEANUP_TTL_MS) {
      entries.delete(key);
    }
  }
}

export function getRateLimitClientKey(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }
  return "unknown";
}

export function evaluateProfitabilityRateLimit(clientKey: string): {
  allowed: boolean;
  retryAfterSeconds?: number;
} {
  cleanup();
  const now = nowMs();
  const entry = entries.get(clientKey);

  if (!entry) {
    entries.set(clientKey, { count: 1, windowStartMs: now });
    return { allowed: true };
  }

  const withinWindow = now - entry.windowStartMs < WINDOW_MS;
  if (!withinWindow) {
    entries.set(clientKey, { count: 1, windowStartMs: now });
    return { allowed: true };
  }

  if (entry.count >= MAX_REQUESTS_PER_WINDOW) {
    const retryAfterSeconds = Math.ceil((WINDOW_MS - (now - entry.windowStartMs)) / 1000);
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, retryAfterSeconds)
    };
  }

  entry.count += 1;
  entries.set(clientKey, entry);
  return { allowed: true };
}
