import { describe, expect, it } from "vitest";
import { formatPromptOutput } from "../features/prompt-optimizer/lib/format-output";

describe("prompt output formatting", () => {
  it("converts escaped newlines to real newlines", () => {
    const input = "Rad 1\\n\\n## Mal\\nPunkt";
    const output = formatPromptOutput(input);

    expect(output).toContain("Rad 1\n\n## Mal\nPunkt");
  });

  it("collapses excessive blank lines", () => {
    const input = "A\n\n\n\nB";
    const output = formatPromptOutput(input);

    expect(output).toBe("A\n\nB");
  });
});
