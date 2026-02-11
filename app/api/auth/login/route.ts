import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/features/auth/server/constants";
import { logAuthEvent } from "@/features/auth/server/logging";
import {
  evaluateLoginRateLimit,
  getClientKey,
  registerLoginFailure,
  registerLoginSuccess
} from "@/features/auth/server/rate-limit";
import { isPortalPasswordValid } from "@/features/auth/server/password";
import { buildSessionTokenForLogin } from "@/features/auth/server/session";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(request: NextRequest) {
  const clientKey = getClientKey(request);
  const rateLimit = evaluateLoginRateLimit(clientKey);

  if (!rateLimit.allowed) {
    logAuthEvent("login_blocked", {
      ip: clientKey,
      detail: `retry_after_ms=${rateLimit.retryAfterMs ?? 0}`
    });
    return NextResponse.json(
      {
        error: "För många försök. Vänta en stund innan du försöker igen."
      },
      {
        status: 429
      }
    );
  }

  if (rateLimit.waitMs > 0) {
    await sleep(rateLimit.waitMs);
  }

  try {
    const payload = (await request.json()) as { password?: string };
    if (typeof payload.password !== "string" || payload.password.length === 0) {
      return NextResponse.json(
        {
          error: "Lösenord saknas."
        },
        {
          status: 400
        }
      );
    }

    const valid = isPortalPasswordValid(payload.password);
    if (!valid) {
      registerLoginFailure(clientKey);
      logAuthEvent("login_failure", { ip: clientKey });
      return NextResponse.json(
        {
          error: "Fel lösenord."
        },
        {
          status: 401
        }
      );
    }

    registerLoginSuccess(clientKey);
    const { token, maxAge } = buildSessionTokenForLogin();
    const response = NextResponse.json({ ok: true });
    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge
    });

    logAuthEvent("login_success", { ip: clientKey });
    return response;
  } catch (error) {
    logAuthEvent("login_failure", {
      ip: clientKey,
      detail: error instanceof Error ? error.message : "unexpected_error"
    });
    return NextResponse.json(
      {
        error: "Servern kunde inte hantera inloggningen. Kontrollera konfigurationen."
      },
      {
        status: 500
      }
    );
  }
}
