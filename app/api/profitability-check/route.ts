import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/features/auth/server/constants";
import { readPortalSessionFromToken } from "@/features/auth/server/session";
import { calculateProfitabilityAssessment } from "@/features/profitability-check/lib/scoring";
import { generateProfitabilityAiSuggestions } from "@/features/profitability-check/server/openai";
import { parseProfitabilityRequest } from "@/features/profitability-check/server/request";
import {
  evaluateProfitabilityRateLimit,
  getRateLimitClientKey
} from "@/features/profitability-check/server/rate-limit";

export async function POST(request: NextRequest) {
  const clientKey = getRateLimitClientKey(request);
  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = readPortalSessionFromToken(sessionToken);

  if (!session.authenticated) {
    return NextResponse.json(
      {
        error: "Ej inloggad."
      },
      {
        status: 401
      }
    );
  }

  const rateLimit = evaluateProfitabilityRateLimit(clientKey);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: "For manga anrop. Forsok igen om en stund."
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimit.retryAfterSeconds ?? 30)
        }
      }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = parseProfitabilityRequest(body);
  if (!parsed.ok) {
    return NextResponse.json(
      {
        error: parsed.error
      },
      {
        status: 400
      }
    );
  }

  const assessment = calculateProfitabilityAssessment(parsed.value);

  try {
    const ai = await generateProfitabilityAiSuggestions(parsed.value, assessment);
    console.info(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        scope: "profitability_check",
        event: "analyze_success",
        source: "openai",
        ip: clientKey
      })
    );

    return NextResponse.json({
      ...assessment,
      summary: ai.summary,
      actions: ai.actions,
      source: "openai"
    });
  } catch (error) {
    console.warn(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        scope: "profitability_check",
        event: "analyze_fallback",
        source: "rules",
        ip: clientKey,
        detail: error instanceof Error ? error.message : "unknown_error"
      })
    );

    return NextResponse.json({
      ...assessment,
      actions: assessment.ruleActions,
      source: "rules"
    });
  }
}
