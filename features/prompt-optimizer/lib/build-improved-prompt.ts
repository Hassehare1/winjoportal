import { PromptOptimizerInput, PromptValidationResult } from "@/features/prompt-optimizer/types";

export function normalizePromptInputValue(value: string) {
  return value.trim();
}

export function validatePromptOptimizerInput(input: PromptOptimizerInput): PromptValidationResult {
  if (!normalizePromptInputValue(input.goal)) {
    return { valid: false, error: "Mal maste fyllas i." };
  }

  if (!normalizePromptInputValue(input.input)) {
    return { valid: false, error: "Input maste fyllas i." };
  }

  return { valid: true };
}

export function buildImprovedPrompt(input: PromptOptimizerInput): string {
  const goal = normalizePromptInputValue(input.goal);
  const context = normalizePromptInputValue(input.context) || "Ingen extra kontext angiven.";
  const rawInput = normalizePromptInputValue(input.input);
  const constraints = normalizePromptInputValue(input.constraints) || "Inga sarskilda begransningar.";
  const tone = normalizePromptInputValue(input.tone) || "Professionell och tydlig.";

  return [
    "Du ar en expertassistent. Leverera ett valstrukturerat svar med hog precision.",
    "",
    "## Mal",
    goal,
    "",
    "## Kontext",
    context,
    "",
    "## Input",
    rawInput,
    "",
    "## Begransningar",
    constraints,
    "",
    "## Ton",
    tone,
    "",
    "## Leveransformat",
    "1. Borja med en kort sammanfattning.",
    "2. Ge darefter en steg-for-steg-losning.",
    "3. Avsluta med eventuella risker och nasta rekommenderade steg."
  ].join("\n");
}
