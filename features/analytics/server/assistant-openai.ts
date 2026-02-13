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

function getAnalyticsModel() {
  return process.env.OPENAI_ANALYTICS_MODEL || process.env.OPENAI_MODEL || "gpt-4.1-mini";
}

function buildInputText(question: string, contextPayload: Record<string, unknown>, month: string) {
  return [
    "Du är en strikt analytics-assistent för retaildata i en intern portal.",
    "Du får ENDAST använda datan i sektionen DATAUNDERLAG.",
    "Om svaret inte finns i underlaget, svara exakt: Jag hittar inte underlag för det i analytics-datat.",
    "Skriv kort, tydligt och på korrekt svenska (ÅÄÖ).",
    "Svara i markdown med exakt denna struktur:",
    "## Svar",
    "1-3 meningar.",
    "## Nyckeltal",
    "En markdown-tabell med kolumnerna | Nyckeltal | Värde | Kommentar |.",
    "Alla sifferuppgifter ska vara i tabellen (inte i löptext).",
    "## Rekommendation",
    "Punktlista med max 3 punkter.",
    "Hitta inte på externa fakta, antaganden eller allmän kunskap.",
    "",
    "PERIOD:",
    month,
    "",
    "FRAGA:",
    question,
    "",
    "DATAUNDERLAG (JSON):",
    JSON.stringify(contextPayload)
  ].join("\n");
}

export async function answerAnalyticsQuestionWithOpenAi(params: {
  question: string;
  month: string;
  contextPayload: Record<string, unknown>;
}) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getOpenAiApiKey()}`
    },
    body: JSON.stringify({
      model: getAnalyticsModel(),
      input: buildInputText(params.question, params.contextPayload, params.month),
      temperature: 0.1,
      max_output_tokens: 600
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
