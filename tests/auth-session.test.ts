import { describe, expect, it } from "vitest";
import { createSignedSessionToken, verifySignedSessionToken } from "../features/auth/server/session";

describe("session token", () => {
  it("accepts a valid signed token", () => {
    const secret = "test-secret-123";
    const expiresAt = Math.floor(Date.now() / 1000) + 120;
    const token = createSignedSessionToken(expiresAt, secret);

    const result = verifySignedSessionToken(token, secret);

    expect(result.authenticated).toBe(true);
    expect(result.expiresAt).toBe(expiresAt);
  });

  it("rejects a tampered token", () => {
    const secret = "test-secret-123";
    const expiresAt = Math.floor(Date.now() / 1000) + 120;
    const token = createSignedSessionToken(expiresAt, secret);
    const tamperedToken = `${token}tampered`;

    const result = verifySignedSessionToken(tamperedToken, secret);

    expect(result.authenticated).toBe(false);
  });
});
