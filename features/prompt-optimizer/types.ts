export type PromptOptimizerInput = {
  goal: string;
  context: string;
  input: string;
  constraints: string;
  tone: string;
};

export type PromptOptimizerMode = "compact" | "balanced" | "advanced";

export type PromptOptimizerRequest = PromptOptimizerInput & {
  mode: PromptOptimizerMode;
};

export type PromptValidationResult = {
  valid: boolean;
  error?: string;
};
