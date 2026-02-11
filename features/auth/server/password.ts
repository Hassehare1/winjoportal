import crypto from "node:crypto";

function getPortalPassword(): string {
  const value = process.env.PORTAL_PASSWORD;
  if (!value) {
    throw new Error("PORTAL_PASSWORD saknas i environment.");
  }
  return value;
}

function sha256(value: string): Buffer {
  return crypto.createHash("sha256").update(value).digest();
}

export function isPortalPasswordValid(candidate: string): boolean {
  const expected = sha256(getPortalPassword());
  const actual = sha256(candidate);
  return crypto.timingSafeEqual(expected, actual);
}
