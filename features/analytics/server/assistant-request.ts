type AnalyticsAssistantRequest = {
  question: string;
  month?: string;
};

type ParseResult =
  | {
      ok: true;
      value: AnalyticsAssistantRequest;
    }
  | {
      ok: false;
      error: string;
    };

const MONTH_REGEX = /^20\d{2}-\d{2}$/;

export function parseAnalyticsAssistantRequest(raw: unknown): ParseResult {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      ok: false,
      error: "Ogiltig request-body."
    };
  }

  const payload = raw as Record<string, unknown>;
  const question = typeof payload.question === "string" ? payload.question.trim() : "";
  const monthRaw = typeof payload.month === "string" ? payload.month.trim() : "";

  if (question.length < 3) {
    return {
      ok: false,
      error: "Frågan är för kort."
    };
  }

  if (question.length > 500) {
    return {
      ok: false,
      error: "Frågan är för lång (max 500 tecken)."
    };
  }

  if (monthRaw && !MONTH_REGEX.test(monthRaw)) {
    return {
      ok: false,
      error: "Ogiltig månad. Använd format YYYY-MM."
    };
  }

  return {
    ok: true,
    value: {
      question,
      month: monthRaw || undefined
    }
  };
}
