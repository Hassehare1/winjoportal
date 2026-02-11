import { PromptOptimizerInput, PromptValidationResult } from "@/features/prompt-optimizer/types";

function normalize(value: string) {
  return value.trim();
}

export function validatePromptOptimizerInput(input: PromptOptimizerInput): PromptValidationResult {
  if (!normalize(input.goal)) {
    return { valid: false, error: "Mål måste fyllas i." };
  }

  if (!normalize(input.input)) {
    return { valid: false, error: "Input måste fyllas i." };
  }

  return { valid: true };
}

export function buildImprovedPrompt(input: PromptOptimizerInput): string {
  const goal = normalize(input.goal);
  const context = normalize(input.context) || "Ingen extra kontext angiven.";
  const rawInput = normalize(input.input);
  const constraints = normalize(input.constraints) || "Inga särskilda begränsningar.";
  const tone = normalize(input.tone) || "Professionell och tydlig.";

  return [
    "Du är en expertassistent. Leverera ett välstrukturerat svar med hög precision.",
    "",
    "## Mål",
    goal,
    "",
    "## Kontext",
    context,
    "",
    "## Input",
    rawInput,
    "",
    "## Begränsningar",
    constraints,
    "",
    "## Ton",
    tone,
    "",
    "## Leveransformat",
    "1. Börja med en kort sammanfattning.",
    "2. Ge därefter en steg-för-steg-lösning.",
    "3. Avsluta med eventuella risker och nästa rekommenderade steg."
  ].join("\n");
}
