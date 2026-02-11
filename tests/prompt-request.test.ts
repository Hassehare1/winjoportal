import { describe, expect, it } from "vitest";
import { parsePromptOptimizerRequest } from "../features/prompt-optimizer/server/prompt-request";

describe("prompt request parser", () => {
  it("parses valid payload and keeps supported mode", () => {
    const parsed = parsePromptOptimizerRequest({
      goal: "Skapa ett säljmail",
      context: "B2B",
      input: "Produktlansering i april",
      constraints: "Max 120 ord",
      tone: "Trygg",
      mode: "advanced"
    });

    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.mode).toBe("advanced");
      expect(parsed.value.goal).toBe("Skapa ett säljmail");
    }
  });

  it("defaults to balanced mode for unsupported mode", () => {
    const parsed = parsePromptOptimizerRequest({
      goal: "Skapa prompt",
      input: "Hej",
      mode: "invalid"
    });

    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.mode).toBe("balanced");
    }
  });

  it("returns validation error when goal is missing", () => {
    const parsed = parsePromptOptimizerRequest({
      goal: "",
      input: "Hej"
    });

    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.error).toContain("Mal");
    }
  });
});
