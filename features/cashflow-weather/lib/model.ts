export type CashflowWeatherInputs = {
  netSales: number;
  marginPct: number;
  estimatedStockValue: number;
  monthlyTrendPct: number;
  fixedCostsMonthly: number;
  arDays: number;
  targetArDays: number;
  apDays: number;
  cashBuffer: number;
  creditLine: number;
};

export type CashflowWeatherLevel = "Sun" | "Cloud" | "Storm";

export type CashflowWeatherPoint = {
  horizonDays: 30 | 60 | 90;
  projectedNetSales: number;
  projectedGrossProfit: number;
  projectedCogs: number;
  projectedFixedCosts: number;
  projectedArBalance: number;
  projectedInventoryCost: number;
  projectedApBalance: number;
  projectedNetWorkingCapital: number;
  deltaArBalance: number;
  deltaInventoryCost: number;
  deltaApBalance: number;
  netWorkingCapitalDelta: number;
  operatingCashBeforeWorkingCapital: number;
  netCashBeforeFunding: number;
  creditUsed: number;
  creditHeadroom: number;
  netCash: number;
  uncoveredDeficit: number;
  netCashMarginPct: number;
  riskScore: number;
  weather: CashflowWeatherLevel;
};

export type CashflowWeatherRecommendation = {
  id: string;
  title: string;
  detail: string;
};

export type CashflowWeatherResult = {
  normalized: CashflowWeatherInputs;
  grossProfitMonthly: number;
  cogsMonthly: number;
  inventoryDays: number;
  arBalanceNow: number;
  apBalanceNow: number;
  netWorkingCapitalNow: number;
  arReleasePotential: number;
  points: CashflowWeatherPoint[];
  summaryLevel: CashflowWeatherLevel;
  recommendations: CashflowWeatherRecommendation[];
  warnings: string[];
};

type SummarySeed = {
  netSales?: number;
  grossMarginPercent?: number;
  estimatedStockValue?: number;
  trendPct?: number;
};

const DEFAULT_INPUTS: CashflowWeatherInputs = {
  netSales: 4_800_000,
  marginPct: 49.5,
  estimatedStockValue: 5_300_000,
  monthlyTrendPct: 0,
  fixedCostsMonthly: 1_850_000,
  arDays: 34,
  targetArDays: 24,
  apDays: 30,
  cashBuffer: 0,
  creditLine: 1_000_000
};

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function pctToRatio(value: number): number {
  return clamp(value, 0, 95) / 100;
}

function toLevelSortValue(level: CashflowWeatherLevel): number {
  if (level === "Storm") return 3;
  if (level === "Cloud") return 2;
  return 1;
}

function deriveWeatherLevel(riskScore: number, netCashMarginPct: number, uncoveredDeficit: number): CashflowWeatherLevel {
  if (uncoveredDeficit > 0) return "Storm";
  if (riskScore >= 65 || netCashMarginPct < -3) return "Storm";
  if (riskScore >= 35 || netCashMarginPct < 1) return "Cloud";
  return "Sun";
}

function buildRecommendations(result: CashflowWeatherResult): CashflowWeatherRecommendation[] {
  const output: CashflowWeatherRecommendation[] = [];
  const { normalized, inventoryDays } = result;
  const day90 = result.points[result.points.length - 1];

  if (normalized.arDays > normalized.targetArDays + 2) {
    output.push({
      id: "ar-days",
      title: "Kortare kundfordringstid",
      detail: `Sank AR-dagar mot malet ${normalized.targetArDays} dagar for att friga kapital snabbare.`
    });
  }

  if (normalized.apDays < 30) {
    output.push({
      id: "ap-days",
      title: "Forhandla leverantorsvillkor",
      detail: "Kort leverantorskredit pressar kassan. Testa langre betalningsvillkor pa inkop med hog volym."
    });
  }

  if (inventoryDays > 70) {
    output.push({
      id: "inventory-days",
      title: "Sank lagerdagar",
      detail: "Lagerbindningen ar hog relativt COGS. Prioritera artiklar med lag omsattning i inkoopsstopp."
    });
  }

  if (normalized.fixedCostsMonthly > result.grossProfitMonthly * 0.9) {
    output.push({
      id: "cost-base",
      title: "Stabilare kostnadsbas",
      detail: "Fasta kostnader ligger nara eller over manadens bruttovinst. Laas kritiska kostnader och pausa ovrigt."
    });
  }

  if (normalized.monthlyTrendPct < 0) {
    output.push({
      id: "sales-trend",
      title: "Bryt negativ forsaljningstrend",
      detail: "Negativ trend forstarker kassapress over 60-90 dagar. Starta riktad kampanj i hogmarginalsortiment."
    });
  }

  if (day90 && day90.creditUsed > 0 && normalized.creditLine > 0) {
    output.push({
      id: "credit-usage",
      title: "Sakra finansiering for tillvaxten",
      detail: "Kreditramen bor matcha prognostiserat rorelsekapitalbehov for att undvika kassastopp."
    });
  }

  if (day90 && day90.uncoveredDeficit > 0) {
    output.push({
      id: "uncovered-gap",
      title: "Stang finansieringsgapet",
      detail: "Prognosen visar ofinansierat underskott. Kombinera lagersankning, AR-atgard och extra finansiering."
    });
  }

  if (day90 && day90.weather === "Storm") {
    output.push({
      id: "storm-plan",
      title: "90-dagars kassaplan",
      detail: "Satt veckovisa kassamoten med tydlig plan for lager, kundfordringar och kostnadsatgarder."
    });
  }

  if (output.length === 0) {
    output.push({
      id: "monitor",
      title: "Fortsatt overvaka varje vecka",
      detail: "Nuvarande antaganden ser stabila ut. Behall disciplin pa AR-dagar, lagerdagar och kostnadsnivaa."
    });
  }

  return output.slice(0, 3);
}

export function deriveCashflowWeatherDefaults(seed: SummarySeed): CashflowWeatherInputs {
  const netSalesFromSeed = Math.max(0, toNumber(seed.netSales));
  const marginFromSeed = clamp(toNumber(seed.grossMarginPercent), 0, 95);
  const stockFromSeed = Math.max(0, toNumber(seed.estimatedStockValue));
  const trendFromSeed = clamp(toNumber(seed.trendPct), -35, 35);

  const netSales = netSalesFromSeed > 0 ? netSalesFromSeed : DEFAULT_INPUTS.netSales;
  const marginPct = marginFromSeed > 0 ? marginFromSeed : DEFAULT_INPUTS.marginPct;
  const grossProfit = netSales * pctToRatio(marginPct);
  const cogs = Math.max(0, netSales - grossProfit);

  const estimatedStockValue =
    stockFromSeed > 0 ? stockFromSeed : Math.max(DEFAULT_INPUTS.estimatedStockValue, (cogs / 30) * 70);

  const fixedCostsMonthly = clamp(grossProfit * 0.78, 0, grossProfit * 1.3 || DEFAULT_INPUTS.fixedCostsMonthly);

  return {
    netSales,
    marginPct,
    estimatedStockValue,
    monthlyTrendPct: trendFromSeed,
    fixedCostsMonthly: fixedCostsMonthly > 0 ? fixedCostsMonthly : DEFAULT_INPUTS.fixedCostsMonthly,
    arDays: DEFAULT_INPUTS.arDays,
    targetArDays: DEFAULT_INPUTS.targetArDays,
    apDays: DEFAULT_INPUTS.apDays,
    cashBuffer: DEFAULT_INPUTS.cashBuffer,
    creditLine: Math.max(DEFAULT_INPUTS.creditLine, netSales * 0.25)
  };
}

export function sanitizeCashflowWeatherInputs(input: Partial<CashflowWeatherInputs>): CashflowWeatherInputs {
  return {
    netSales: Math.max(0, toNumber(input.netSales ?? DEFAULT_INPUTS.netSales)),
    marginPct: clamp(toNumber(input.marginPct ?? DEFAULT_INPUTS.marginPct), 0, 95),
    estimatedStockValue: Math.max(0, toNumber(input.estimatedStockValue ?? DEFAULT_INPUTS.estimatedStockValue)),
    monthlyTrendPct: clamp(toNumber(input.monthlyTrendPct ?? DEFAULT_INPUTS.monthlyTrendPct), -35, 35),
    fixedCostsMonthly: Math.max(0, toNumber(input.fixedCostsMonthly ?? DEFAULT_INPUTS.fixedCostsMonthly)),
    arDays: clamp(toNumber(input.arDays ?? DEFAULT_INPUTS.arDays), 0, 180),
    targetArDays: clamp(toNumber(input.targetArDays ?? DEFAULT_INPUTS.targetArDays), 0, 180),
    apDays: clamp(toNumber(input.apDays ?? DEFAULT_INPUTS.apDays), 0, 180),
    cashBuffer: Math.max(0, toNumber(input.cashBuffer ?? DEFAULT_INPUTS.cashBuffer)),
    creditLine: Math.max(0, toNumber(input.creditLine ?? DEFAULT_INPUTS.creditLine))
  };
}

export function runCashflowWeather(input: Partial<CashflowWeatherInputs>): CashflowWeatherResult {
  const normalized = sanitizeCashflowWeatherInputs(input);
  const marginRatio = pctToRatio(normalized.marginPct);
  const grossProfitMonthly = normalized.netSales * marginRatio;
  const cogsMonthly = Math.max(0, normalized.netSales - grossProfitMonthly);
  const inventoryDays = cogsMonthly > 0 ? clamp((normalized.estimatedStockValue / cogsMonthly) * 30, 0, 365) : 0;

  const arBalanceNow = normalized.netSales * (normalized.arDays / 30);
  const apBalanceNow = cogsMonthly * (normalized.apDays / 30);
  const netWorkingCapitalNow = normalized.estimatedStockValue + arBalanceNow - apBalanceNow;
  const arTargetBalance = normalized.netSales * (normalized.targetArDays / 30);
  const arReleasePotential = Math.max(0, arBalanceNow - arTargetBalance);
  const monthlyTrendRatio = normalized.monthlyTrendPct / 100;

  const horizons: Array<30 | 60 | 90> = [30, 60, 90];
  const points: CashflowWeatherPoint[] = horizons.map((horizonDays) => {
    const months = horizonDays / 30;
    const projectedNetSales = Math.max(0, normalized.netSales * Math.pow(1 + monthlyTrendRatio, months));
    const projectedGrossProfit = projectedNetSales * marginRatio;
    const projectedCogs = Math.max(0, projectedNetSales - projectedGrossProfit);
    const projectedFixedCosts = normalized.fixedCostsMonthly * months;

    const projectedArBalance = projectedNetSales * (normalized.arDays / 30);
    const projectedInventoryCost = (projectedCogs / 30) * inventoryDays;
    const projectedApBalance = projectedCogs * (normalized.apDays / 30);
    const projectedNetWorkingCapital = projectedArBalance + projectedInventoryCost - projectedApBalance;
    const deltaArBalance = projectedArBalance - arBalanceNow;
    const deltaInventoryCost = projectedInventoryCost - normalized.estimatedStockValue;
    const deltaApBalance = projectedApBalance - apBalanceNow;
    const netWorkingCapitalDelta = projectedNetWorkingCapital - netWorkingCapitalNow;

    const operatingCashBeforeWorkingCapital = projectedGrossProfit - projectedFixedCosts;
    const netCashBeforeFunding =
      operatingCashBeforeWorkingCapital - Math.max(0, netWorkingCapitalDelta) + normalized.cashBuffer;
    const creditUsed = netCashBeforeFunding < 0 ? Math.min(normalized.creditLine, -netCashBeforeFunding) : 0;
    const creditHeadroom = Math.max(0, normalized.creditLine - creditUsed);
    const netCash = netCashBeforeFunding + creditUsed;
    const uncoveredDeficit = Math.max(0, -netCash);
    const netCashMarginPct = projectedNetSales > 0 ? (netCash / projectedNetSales) * 100 : 0;

    const inventoryRisk = clamp(((inventoryDays - 55) / 70) * 100, 0, 100);
    const arRisk = clamp(((normalized.arDays - normalized.targetArDays) / 60) * 100, 0, 100);
    const trendRisk = clamp(-normalized.monthlyTrendPct * 3.2, 0, 100);
    const costRisk =
      projectedGrossProfit > 0 ? clamp(((projectedFixedCosts / projectedGrossProfit) - 0.8) * 140, 0, 100) : 100;
    const fundingRisk =
      uncoveredDeficit > 0
        ? 100
        : normalized.creditLine > 0
          ? clamp((creditUsed / normalized.creditLine) * 100, 0, 100)
          : creditUsed > 0
            ? 100
            : 0;

    const riskScore = Math.round(
      inventoryRisk * 0.18 + arRisk * 0.18 + trendRisk * 0.14 + costRisk * 0.2 + fundingRisk * 0.3
    );
    const weather = deriveWeatherLevel(riskScore, netCashMarginPct, uncoveredDeficit);

    return {
      horizonDays,
      projectedNetSales,
      projectedGrossProfit,
      projectedCogs,
      projectedFixedCosts,
      projectedArBalance,
      projectedInventoryCost,
      projectedApBalance,
      projectedNetWorkingCapital,
      deltaArBalance,
      deltaInventoryCost,
      deltaApBalance,
      netWorkingCapitalDelta,
      operatingCashBeforeWorkingCapital,
      netCashBeforeFunding,
      creditUsed,
      creditHeadroom,
      netCash,
      uncoveredDeficit,
      netCashMarginPct,
      riskScore,
      weather
    };
  });

  const summaryLevel = points.reduce<CashflowWeatherLevel>((current, point) => {
    return toLevelSortValue(point.weather) > toLevelSortValue(current) ? point.weather : current;
  }, "Sun");

  const warnings: string[] = [];
  if (normalized.monthlyTrendPct > 10) {
    warnings.push(
      "Hog tillvaxttrend vald. Kontrollera att lager, kundfordringar och finansiering ar synkade sa att tillvaxt inte skapar kassachock."
    );
  }
  if (normalized.creditLine <= 0) {
    warnings.push("Kreditram ar 0. Eventuella kassaunderskott maste tackas helt av kassabuffert eller operativt kassaflode.");
  }
  if (normalized.apDays <= 0) {
    warnings.push("Leverantorsskulder (AP-dagar) ar 0. Det ar ett konservativt antagande som kan ge onodigt hard kassabild.");
  }

  const result: CashflowWeatherResult = {
    normalized,
    grossProfitMonthly,
    cogsMonthly,
    inventoryDays,
    arBalanceNow,
    apBalanceNow,
    netWorkingCapitalNow,
    arReleasePotential,
    points,
    summaryLevel,
    recommendations: [],
    warnings
  };

  result.recommendations = buildRecommendations(result);
  return result;
}
