import {
  PromptOptimizerInput,
  PromptOptimizerMode,
  PromptOptimizerRequest
} from "@/features/prompt-optimizer/types";
import {
  normalizePromptInputValue,
  validatePromptOptimizerInput
} from "@/features/prompt-optimizer/lib/build-improved-prompt";

const MODE_SET = new Set<PromptOptimizerMode>(["compact", "balanced", "advanced"]);
const MAX_FIELD_LENGTH = 5000;

type ParseResult =
  | {
      ok: true;
      value: PromptOptimizerRequest;
    }
  | {
      ok: false;
      error: string;
    };

function sanitizeField(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  const normalized = normalizePromptInputValue(value);
  if (normalized.length > MAX_FIELD_LENGTH) {
    return normalized.slice(0, MAX_FIELD_LENGTH);
  }

  return normalized;
}

function parseMode(value: unknown): PromptOptimizerMode {
  if (typeof value === "string" && MODE_SET.has(value as PromptOptimizerMode)) {
    return value as PromptOptimizerMode;
  }
  return "balanced";
}

export function parsePromptOptimizerRequest(payload: unknown): ParseResult {
  if (typeof payload !== "object" || payload === null) {
    return {
      ok: false,
      error: "Ogiltig request-body."
    };
  }

  const raw = payload as Partial<PromptOptimizerInput> & { mode?: unknown };
  const parsed: PromptOptimizerRequest = {
    goal: sanitizeField(raw.goal),
    context: sanitizeField(raw.context),
    input: sanitizeField(raw.input),
    constraints: sanitizeField(raw.constraints),
    tone: sanitizeField(raw.tone),
    mode: parseMode(raw.mode)
  };

  const validation = validatePromptOptimizerInput(parsed);
  if (!validation.valid) {
    return {
      ok: false,
      error: validation.error ?? "Ogiltig input."
    };
  }

  return {
    ok: true,
    value: parsed
  };
}
