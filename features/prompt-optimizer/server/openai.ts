import { PromptOptimizerRequest } from "@/features/prompt-optimizer/types";

type OpenAIResponsesApiOutput = {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
  error?: {
    message?: string;
  };
};

function getOpenAiApiKey() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY saknas i environment.");
  }
  return apiKey;
}

function getOpenAiModel() {
  return process.env.OPENAI_MODEL || "gpt-4.1-mini";
}

function buildInstruction(mode: PromptOptimizerRequest["mode"]) {
  if (mode === "compact") {
    return [
      "Skriv en kort men stark prompt.",
      "Undvik onodig text.",
      "Returnera endast den optimerade prompten, inget annat."
    ].join(" ");
  }

  if (mode === "advanced") {
    return [
      "Skriv en avancerad prompt med tydlig struktur, antaganden och kvalitetskrav.",
      "Inkludera output-format med numrerade steg.",
      "Returnera endast den optimerade prompten, inget annat."
    ].join(" ");
  }

  return [
    "Skriv en balanserad prompt med tydlig uppgift, kontext, constraints och ton.",
    "Returnera endast den optimerade prompten, inget annat."
  ].join(" ");
}

function buildInputText(request: PromptOptimizerRequest) {
  return [
    "Du ar expert pa prompt engineering.",
    buildInstruction(request.mode),
    "",
    "MAL:",
    request.goal,
    "",
    "KONTEXT:",
    request.context || "Ingen extra kontext angiven.",
    "",
    "INPUT:",
    request.input,
    "",
    "BEGRANSNINGAR:",
    request.constraints || "Inga begransningar angivna.",
    "",
    "TON:",
    request.tone || "Professionell och tydlig."
  ].join("\n");
}

export async function generateOptimizedPromptWithOpenAi(request: PromptOptimizerRequest) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getOpenAiApiKey()}`
    },
    body: JSON.stringify({
      model: getOpenAiModel(),
      input: buildInputText(request),
      temperature: 0.3,
      max_output_tokens: 900
    })
  });

  const payload = (await response.json().catch(() => null)) as OpenAIResponsesApiOutput | null;
  if (!response.ok) {
    throw new Error(payload?.error?.message || "OpenAI-anrop misslyckades.");
  }

  const textFromOutputText = payload?.output_text?.trim();
  const textFromOutputArray = payload?.output
    ?.flatMap((segment) => segment.content || [])
    .filter((part) => part.type === "output_text" || part.type === "text")
    .map((part) => part.text || "")
    .join("\n")
    .trim();
  const text = textFromOutputText || textFromOutputArray;
  if (!text) {
    throw new Error("Tomt svar fran OpenAI.");
  }

  return text;
}
