import type { NextRequest } from "next/server";

type Entry = {
  count: number;
  windowStartMs: number;
};

const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 10;
const CACHE_TTL_MS = 10 * 60_000;
const entries = new Map<string, Entry>();

function nowMs() {
  return Date.now();
}

function cleanupStaleEntries() {
  const now = nowMs();
  for (const [key, value] of entries.entries()) {
    if (now - value.windowStartMs > CACHE_TTL_MS) {
      entries.delete(key);
    }
  }
}

export function getClientKey(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }
  return "unknown";
}

export function evaluatePromptRateLimit(clientKey: string): {
  allowed: boolean;
  retryAfterSeconds?: number;
} {
  cleanupStaleEntries();
  const now = nowMs();
  const current = entries.get(clientKey);

  if (!current) {
    entries.set(clientKey, {
      count: 1,
      windowStartMs: now
    });
    return { allowed: true };
  }

  const withinWindow = now - current.windowStartMs < WINDOW_MS;
  if (!withinWindow) {
    entries.set(clientKey, {
      count: 1,
      windowStartMs: now
    });
    return { allowed: true };
  }

  if (current.count >= MAX_REQUESTS_PER_WINDOW) {
    const retryAfterSeconds = Math.ceil((WINDOW_MS - (now - current.windowStartMs)) / 1000);
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, retryAfterSeconds)
    };
  }

  current.count += 1;
  entries.set(clientKey, current);
  return { allowed: true };
}
