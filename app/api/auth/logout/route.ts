import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/features/auth/server/constants";
import { getClientKey } from "@/features/auth/server/rate-limit";
import { logAuthEvent } from "@/features/auth/server/logging";

export async function POST(request: NextRequest) {
  const clientKey = getClientKey(request);
  const response = NextResponse.json({ ok: true });

  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0
  });

  logAuthEvent("logout", { ip: clientKey });
  return response;
}
