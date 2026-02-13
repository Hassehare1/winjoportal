import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/features/auth/server/constants";
import { readPortalSessionFromToken } from "@/features/auth/server/session";
import { evaluatePromptRateLimit, getClientKey } from "@/features/prompt-optimizer/server/rate-limit";
import { parseAnalyticsAssistantRequest } from "@/features/analytics/server/assistant-request";
import { getAnalyticsAssistantContext } from "@/features/analytics/server/reports";
import { answerAnalyticsQuestionWithOpenAi } from "@/features/analytics/server/assistant-openai";
import { buildAnalyticsFallbackAnswer } from "@/features/analytics/server/assistant-fallback";

export async function POST(request: NextRequest) {
  const clientKey = getClientKey(request);
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

  const rateLimit = evaluatePromptRateLimit(clientKey);
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
  const parsed = parseAnalyticsAssistantRequest(body);
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

  const context = getAnalyticsAssistantContext(parsed.value.month);
  if (!context.selectedMonth || !context.data) {
    return NextResponse.json(
      {
        error: "Kunde inte lasa KPI-underlaget."
      },
      {
        status: 404
      }
    );
  }

  try {
    const answer = await answerAnalyticsQuestionWithOpenAi({
      question: parsed.value.question,
      month: context.selectedMonth,
      contextPayload: context.data
    });

    return NextResponse.json({
      answer,
      selectedMonth: context.selectedMonth,
      source: "openai"
    });
  } catch (error) {
    console.warn(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        scope: "analytics_assistant",
        event: "generate_fallback",
        ip: clientKey,
        detail: error instanceof Error ? error.message : "unknown_error"
      })
    );

    return NextResponse.json({
      answer: buildAnalyticsFallbackAnswer(parsed.value.question, context.selectedMonth, context.data),
      selectedMonth: context.selectedMonth,
      source: "rules"
    });
  }
}
