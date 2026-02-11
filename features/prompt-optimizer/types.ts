export type PromptOptimizerInput = {
  goal: string;
  context: string;
  input: string;
  constraints: string;
  tone: string;
};

export type PromptValidationResult = {
  valid: boolean;
  error?: string;
};
