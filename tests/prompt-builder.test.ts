import { describe, expect, it } from "vitest";
import {
  buildImprovedPrompt,
  validatePromptOptimizerInput
} from "../features/prompt-optimizer/lib/build-improved-prompt";

describe("prompt builder", () => {
  it("returns validation error when goal is missing", () => {
    const validation = validatePromptOptimizerInput({
      goal: "",
      context: "Kundprojekt",
      input: "Bygg en plan",
      constraints: "",
      tone: ""
    });

    expect(validation.valid).toBe(false);
    expect(validation.error).toContain("Mal");
  });

  it("builds a structured prompt", () => {
    const prompt = buildImprovedPrompt({
      goal: "Skriv en lanseringsplan",
      context: "B2B SaaS",
      input: "Vi vill lansera i april",
      constraints: "Max 300 ord",
      tone: "Konsultativ"
    });

    expect(prompt).toContain("## Mal");
    expect(prompt).toContain("Skriv en lanseringsplan");
    expect(prompt).toContain("## Begransningar");
    expect(prompt).toContain("Max 300 ord");
  });
});
