import {
  Bottleneck,
  BusinessModel,
  ImprovementAction,
  ProfitabilityAssessment,
  ProfitabilityInput,
  ProfitabilityRiskDriver
} from "@/features/profitability-check/types";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function round(value: number) {
  return Math.round(value);
}

function calcTargetArDays(model: BusinessModel) {
  if (model === "subscription") return 25;
  if (model === "consulting") return 30;
  if (model === "project") return 35;
  if (model === "retail") return 20;
  return 30;
}

function calcTargetInventoryDays(model: BusinessModel) {
  if (model === "manufacturing") return 55;
  if (model === "retail") return 45;
  return 0;
}

function calcMarginUpliftPercent(bottleneck: Bottleneck) {
  if (bottleneck === "pricing") return 2.2;
  if (bottleneck === "utilization") return 1.6;
  if (bottleneck === "sales") return 1.3;
  if (bottleneck === "overhead") return 0.9;
  return 0.7;
}

function buildRiskDrivers(input: ProfitabilityInput, operatingMarginPercent: number): ProfitabilityRiskDriver[] {
  const drivers: ProfitabilityRiskDriver[] = [];

  if (input.grossMarginPercent < 22) {
    drivers.push({
      id: "gross_margin",
      label: "Bruttomarginal",
      points: 24,
      detail: "Bruttomarginalen ar lag for att finansiera fasta kostnader."
    });
  } else if (input.grossMarginPercent < 30) {
    drivers.push({
      id: "gross_margin",
      label: "Bruttomarginal",
      points: 16,
      detail: "Bruttomarginalen bor forstarkas for stabil tillvaxt."
    });
  }

  if (operatingMarginPercent < 0) {
    drivers.push({
      id: "operating_margin",
      label: "Rorelsemarginal",
      points: 26,
      detail: "Rorelsemarginalen ar negativ och pressar kassaflodet."
    });
  } else if (operatingMarginPercent < 8) {
    drivers.push({
      id: "operating_margin",
      label: "Rorelsemarginal",
      points: 14,
      detail: "Rorelsemarginalen ar tunn och kanslig for kostnadsokningar."
    });
  }

  if (input.arDays > 55) {
    drivers.push({
      id: "ar_days",
      label: "Kundfordringar (dagar)",
      points: 18,
      detail: "Lang kredittid binder kapital och okar risken."
    });
  } else if (input.arDays > 40) {
    drivers.push({
      id: "ar_days",
      label: "Kundfordringar (dagar)",
      points: 10,
      detail: "Kundfordringar kan kortas for battre kassaflode."
    });
  }

  if (input.inventoryDays > 80) {
    drivers.push({
      id: "inventory_days",
      label: "Lagerdagar",
      points: 14,
      detail: "Hoga lagernivaer binder kapital och okar inkuransrisk."
    });
  } else if (input.inventoryDays > 55) {
    drivers.push({
      id: "inventory_days",
      label: "Lagerdagar",
      points: 8,
      detail: "Lageromsattningen kan effektiviseras."
    });
  }

  if (input.topCustomerSharePercent > 45) {
    drivers.push({
      id: "customer_concentration",
      label: "Kundkoncentration",
      points: 14,
      detail: "En stor kundandel okar intaktsrisken."
    });
  } else if (input.topCustomerSharePercent > 30) {
    drivers.push({
      id: "customer_concentration",
      label: "Kundkoncentration",
      points: 8,
      detail: "Spridning av kundbas minskar risk."
    });
  }

  return drivers;
}

function buildRuleActions(
  input: ProfitabilityInput,
  riskDrivers: ProfitabilityRiskDriver[],
  potentialMidpoint: number
): ImprovementAction[] {
  const actions: ImprovementAction[] = [];
  const hasDriver = (id: string) => riskDrivers.some((driver) => driver.id === id);

  if (hasDriver("ar_days")) {
    actions.push({
      title: "Kortare kredittider och snabbare uppfoljning",
      why: "Frigor likviditet direkt och minskar behov av extern finansiering.",
      firstStep: "Infors veckovis aging-lista och tydliga betalvillkor for nya avtal.",
      impactHintSek: round(potentialMidpoint * 0.32),
      priority: "High"
    });
  }

  if (hasDriver("gross_margin") || input.bottleneck === "pricing") {
    actions.push({
      title: "Pris- och mixgenomgang per kundsegment",
      why: "Smarta justeringar i pris och erbjudande ger snabb marginaleffekt.",
      firstStep: "Identifiera topp 20 kunder med lagst marginal och justera prissattning stegvis.",
      impactHintSek: round(potentialMidpoint * 0.28),
      priority: "High"
    });
  }

  if (hasDriver("operating_margin") || input.bottleneck === "overhead") {
    actions.push({
      title: "Kostnadsstyrning med ansvar per kostnadscenter",
      why: "Minskar fasta kostnader utan att tumma pa leveransforhaga.",
      firstStep: "Satt manadsvis kostnadstak per team och folj upp avvikelse i ledningsmote.",
      impactHintSek: round(potentialMidpoint * 0.22),
      priority: "High"
    });
  }

  if (hasDriver("customer_concentration") || input.bottleneck === "sales") {
    actions.push({
      title: "Minska kundkoncentration med riktad nykundsplan",
      why: "Sprider intaktsrisk och skapar mer robust prognos.",
      firstStep: "Bygg en 90-dagars pipeline-plan med fokus pa 2 nya segment.",
      impactHintSek: round(potentialMidpoint * 0.12),
      priority: "Medium"
    });
  }

  if (hasDriver("inventory_days")) {
    actions.push({
      title: "Sank lagerdagar med ABC-klassning",
      why: "Frigor kapital och minskar inkuransrisk.",
      firstStep: "Klassificera artiklar A/B/C och satt bestallningspunkter pa nytt.",
      impactHintSek: round(potentialMidpoint * 0.2),
      priority: "Medium"
    });
  }

  if (actions.length < 3) {
    actions.push({
      title: "Ledningsdashboard for marginal och kassaflode",
      why: "Skapar snabb styrning och tydliga beslut varje vecka.",
      firstStep: "Definiera 5 nyckeltal och boka en fast 30-min uppfoljning varje vecka.",
      impactHintSek: round(potentialMidpoint * 0.1),
      priority: "Medium"
    });
  }

  return actions.slice(0, 3);
}

export function calculateProfitabilityAssessment(input: ProfitabilityInput): ProfitabilityAssessment {
  const grossProfit = input.annualRevenueSek * (input.grossMarginPercent / 100);
  const operatingProfit = grossProfit - input.payrollCostSek - input.fixedCostsSek;
  const operatingMarginPercent =
    input.annualRevenueSek > 0 ? (operatingProfit / input.annualRevenueSek) * 100 : -100;

  const riskDrivers = buildRiskDrivers(input, operatingMarginPercent);
  const riskBase = riskDrivers.reduce((sum, driver) => sum + driver.points, 8);
  const riskScore = clamp(round(riskBase), 0, 100);
  const riskLevel = riskScore >= 70 ? "High" : riskScore >= 40 ? "Medium" : "Low";

  const targetArDays = calcTargetArDays(input.businessModel);
  const targetInventoryDays = calcTargetInventoryDays(input.businessModel);

  const arReleaseSek = Math.max(0, input.arDays - targetArDays) * (input.annualRevenueSek / 365);
  const inventoryReleaseSek =
    targetInventoryDays > 0
      ? Math.max(0, input.inventoryDays - targetInventoryDays) * (input.annualRevenueSek * 0.5 / 365)
      : 0;
  const marginUpliftSek = input.annualRevenueSek * (calcMarginUpliftPercent(input.bottleneck) / 100);
  const costEfficiencySek = (input.payrollCostSek + input.fixedCostsSek) * (input.bottleneck === "overhead" ? 0.05 : 0.025);

  const midpoint = round(arReleaseSek * 0.45 + inventoryReleaseSek * 0.6 + marginUpliftSek + costEfficiencySek);
  const potentialRangeSek = {
    min: round(midpoint * 0.72),
    max: round(midpoint * 1.28),
    midpoint
  };

  const cashConversionDays = round(input.arDays + Math.max(0, input.inventoryDays));
  const summary =
    riskLevel === "High"
      ? "Bolaget har tydliga signaler pa forhojd resultat- och kassaflodesrisk. Fokus bor ligga pa omedelbara atgarder kommande 90 dagar."
      : riskLevel === "Medium"
        ? "Bolaget har en stabil grund men flera faktorer drar ned lonsamheten. Prioriterad styrning kan ge tydlig effekt inom 3-6 manader."
        : "Bolaget ser relativt robust ut. Nasta steg ar att systematisera tillvaxt och bevara marginalerna i takt med expansion.";

  const ruleActions = buildRuleActions(input, riskDrivers, midpoint);

  return {
    riskScore,
    riskLevel,
    riskDrivers: riskDrivers.sort((a, b) => b.points - a.points),
    operatingMarginPercent: Number(operatingMarginPercent.toFixed(1)),
    cashConversionDays,
    potentialRangeSek,
    summary,
    ruleActions
  };
}
