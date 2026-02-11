import {
  Bottleneck,
  BusinessModel,
  ProfitabilityInput
} from "@/features/profitability-check/types";

type ParseResult =
  | {
      ok: true;
      value: ProfitabilityInput;
    }
  | {
      ok: false;
      error: string;
    };

const BUSINESS_MODELS = new Set<BusinessModel>([
  "consulting",
  "retail",
  "subscription",
  "project",
  "manufacturing"
]);

const BOTTLENECKS = new Set<Bottleneck>(["pricing", "utilization", "cashflow", "overhead", "sales"]);

function sanitizeText(value: unknown, maxLength = 260) {
  if (typeof value !== "string") {
    return "";
  }
  const normalized = value.trim();
  return normalized.slice(0, maxLength);
}

function sanitizeNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.replace(",", "."));
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

export function parseProfitabilityRequest(payload: unknown): ParseResult {
  if (typeof payload !== "object" || payload === null) {
    return {
      ok: false,
      error: "Ogiltig request-body."
    };
  }

  const raw = payload as Record<string, unknown>;
  const businessModel = sanitizeText(raw.businessModel) as BusinessModel;
  const bottleneck = sanitizeText(raw.bottleneck) as Bottleneck;

  if (!BUSINESS_MODELS.has(businessModel)) {
    return {
      ok: false,
      error: "Ogiltig affarsmodell."
    };
  }

  if (!BOTTLENECKS.has(bottleneck)) {
    return {
      ok: false,
      error: "Ogiltig flaskhals."
    };
  }

  const parsed: ProfitabilityInput = {
    industry: sanitizeText(raw.industry, 120),
    businessModel,
    annualRevenueSek: sanitizeNumber(raw.annualRevenueSek),
    grossMarginPercent: sanitizeNumber(raw.grossMarginPercent),
    payrollCostSek: sanitizeNumber(raw.payrollCostSek),
    fixedCostsSek: sanitizeNumber(raw.fixedCostsSek),
    arDays: sanitizeNumber(raw.arDays),
    inventoryDays: sanitizeNumber(raw.inventoryDays),
    topCustomerSharePercent: sanitizeNumber(raw.topCustomerSharePercent),
    target12m: sanitizeText(raw.target12m, 420),
    bottleneck
  };

  if (!parsed.industry) {
    return {
      ok: false,
      error: "Bransch maste anges."
    };
  }

  if (!parsed.target12m) {
    return {
      ok: false,
      error: "Mal for kommande 12 manader maste anges."
    };
  }

  if (parsed.annualRevenueSek <= 0) {
    return {
      ok: false,
      error: "Omsattning maste vara storre an 0."
    };
  }

  if (parsed.grossMarginPercent < 0 || parsed.grossMarginPercent > 100) {
    return {
      ok: false,
      error: "Bruttomarginal maste vara mellan 0 och 100."
    };
  }

  if (parsed.payrollCostSek < 0 || parsed.fixedCostsSek < 0) {
    return {
      ok: false,
      error: "Kostnader kan inte vara negativa."
    };
  }

  if (parsed.arDays < 0 || parsed.arDays > 365 || parsed.inventoryDays < 0 || parsed.inventoryDays > 365) {
    return {
      ok: false,
      error: "Dagar maste vara mellan 0 och 365."
    };
  }

  if (parsed.topCustomerSharePercent < 0 || parsed.topCustomerSharePercent > 100) {
    return {
      ok: false,
      error: "Kundkoncentration maste vara mellan 0 och 100."
    };
  }

  return {
    ok: true,
    value: parsed
  };
}
