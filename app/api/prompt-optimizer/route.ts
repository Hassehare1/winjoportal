import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/features/auth/server/constants";
import { readPortalSessionFromToken } from "@/features/auth/server/session";
import { parsePromptOptimizerRequest } from "@/features/prompt-optimizer/server/prompt-request";
import { evaluatePromptRateLimit, getClientKey } from "@/features/prompt-optimizer/server/rate-limit";
import { generateOptimizedPromptWithOpenAi } from "@/features/prompt-optimizer/server/openai";

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
  const parsed = parsePromptOptimizerRequest(body);
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

  try {
    const prompt = await generateOptimizedPromptWithOpenAi(parsed.value);
    console.info(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        scope: "prompt_optimizer",
        event: "generate_success",
        ip: clientKey,
        mode: parsed.value.mode
      })
    );

    return NextResponse.json({
      prompt
    });
  } catch (error) {
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        scope: "prompt_optimizer",
        event: "generate_error",
        ip: clientKey,
        mode: parsed.value.mode,
        detail: error instanceof Error ? error.message : "unknown_error"
      })
    );

    return NextResponse.json(
      {
        error: "Kunde inte generera prompt just nu. Kontrollera OpenAI-konfigurationen."
      },
      {
        status: 502
      }
    );
  }
}
