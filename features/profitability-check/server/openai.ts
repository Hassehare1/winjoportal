import {
  ImprovementAction,
  ProfitabilityAssessment,
  ProfitabilityInput
} from "@/features/profitability-check/types";

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

type AiActionPayload = {
  title?: string;
  why?: string;
  first_step?: string;
  impact_hint_sek?: number;
  priority?: "High" | "Medium";
};

type AiResponsePayload = {
  summary?: string;
  actions?: AiActionPayload[];
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

function extractJsonObject(raw: string) {
  const first = raw.indexOf("{");
  const last = raw.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) {
    throw new Error("Kunde inte hitta JSON i OpenAI-svar.");
  }
  return raw.slice(first, last + 1);
}

function mapActions(actions: AiActionPayload[] | undefined, fallback: ImprovementAction[]) {
  if (!actions || actions.length === 0) {
    return fallback;
  }

  const mapped = actions
    .slice(0, 3)
    .map((item, index) => {
      const base = fallback[index] || fallback[0];
      return {
        title: item.title?.trim() || base.title,
        why: item.why?.trim() || base.why,
        firstStep: item.first_step?.trim() || base.firstStep,
        impactHintSek:
          typeof item.impact_hint_sek === "number" && Number.isFinite(item.impact_hint_sek)
            ? Math.max(0, Math.round(item.impact_hint_sek))
            : base.impactHintSek,
        priority: item.priority === "High" ? "High" : "Medium"
      } as ImprovementAction;
    })
    .filter((action) => action.title && action.why && action.firstStep);

  return mapped.length > 0 ? mapped : fallback;
}

function buildAiInputText(input: ProfitabilityInput, assessment: ProfitabilityAssessment) {
  return [
    "Du ar ekonomikonsult och ska ge handlingsbara forslag till en SME-klient.",
    "Svara med strikt JSON och inget annat.",
    "JSON-format:",
    '{"summary":"...", "actions":[{"title":"...", "why":"...", "first_step":"...", "impact_hint_sek":12345, "priority":"High"}]}',
    "Skriv pa svenska men utan markdown.",
    "Max 3 actions.",
    "",
    "INDATA:",
    `Bransch: ${input.industry}`,
    `Affarsmodell: ${input.businessModel}`,
    `Omsattning (SEK): ${input.annualRevenueSek}`,
    `Bruttomarginal (%): ${input.grossMarginPercent}`,
    `Personalkostnad (SEK): ${input.payrollCostSek}`,
    `Fasta kostnader (SEK): ${input.fixedCostsSek}`,
    `Kundfordringar (dagar): ${input.arDays}`,
    `Lagerdagar: ${input.inventoryDays}`,
    `Storsta kund (% av oms): ${input.topCustomerSharePercent}`,
    `Mal 12 manader: ${input.target12m}`,
    `Flaskhals: ${input.bottleneck}`,
    "",
    "REGELBASERAT UNDERLAG:",
    `Riskscore: ${assessment.riskScore} (${assessment.riskLevel})`,
    `Rorelsemarginal (%): ${assessment.operatingMarginPercent}`,
    `Kassacykel (dagar): ${assessment.cashConversionDays}`,
    `Potential 3-6 man (SEK, midpoint): ${assessment.potentialRangeSek.midpoint}`,
    "Rule actions:",
    ...assessment.ruleActions.map(
      (action, index) =>
        `${index + 1}. ${action.title} | why=${action.why} | first_step=${action.firstStep} | impact_hint_sek=${action.impactHintSek}`
    )
  ].join("\n");
}

export async function generateProfitabilityAiSuggestions(
  input: ProfitabilityInput,
  assessment: ProfitabilityAssessment
): Promise<{
  summary: string;
  actions: ImprovementAction[];
}> {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getOpenAiApiKey()}`
    },
    body: JSON.stringify({
      model: getOpenAiModel(),
      input: buildAiInputText(input, assessment),
      temperature: 0.2,
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
  const rawText = textFromOutputText || textFromOutputArray;
  if (!rawText) {
    throw new Error("Tomt svar fran OpenAI.");
  }

  const parsed = JSON.parse(extractJsonObject(rawText)) as AiResponsePayload;
  const summary = parsed.summary?.trim() || assessment.summary;
  const actions = mapActions(parsed.actions, assessment.ruleActions);

  return {
    summary,
    actions
  };
}
