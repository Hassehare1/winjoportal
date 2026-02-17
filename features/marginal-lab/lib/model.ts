export type MarginalLabInputs = {
  netSales: number;
  marginPct: number;
  discountPct: number;
  returnRatePct: number;
  mixLiftPctPoints: number;
  stockDaysNow: number;
  targetStockDays: number;
  stockCostNow: number;
};

export type MarginalLabResult = {
  normalized: MarginalLabInputs;
  baselineGrossProfit: number;
  adjustedNetSales: number;
  adjustedGrossProfit: number;
  adjustedMarginPct: number;
  monthlyGrossProfitDelta: number;
  monthlyGrossProfitDeltaPct: number;
  scenarioCogs: number;
  baselineStockCost: number;
  scenarioStockCost: number;
  releasedCash: number;
  additionalCashNeed: number;
  baselineStockMarginValue: number;
  baselineStockMarginPct: number;
  scenarioStockMarginValue: number;
  scenarioStockMarginPct: number;
  healthScore: number;
};

type SummarySeed = {
  netSales?: number;
  grossMarginPercent?: number;
  estimatedStockValue?: number;
};

const DEFAULT_INPUTS: MarginalLabInputs = {
  netSales: 4_800_000,
  marginPct: 49.5,
  discountPct: 6,
  returnRatePct: 2.8,
  mixLiftPctPoints: 1.5,
  stockDaysNow: 74,
  targetStockDays: 55,
  stockCostNow: 5_300_000
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

function toStockMarginValue(stockCost: number, marginRatio: number): number {
  if (stockCost <= 0) return 0;
  if (marginRatio <= 0) return 0;
  if (marginRatio >= 0.99) return 0;
  return stockCost * (marginRatio / (1 - marginRatio));
}

function toStockMarginPct(stockCost: number, stockMarginValue: number): number {
  const salesValue = stockCost + stockMarginValue;
  if (salesValue <= 0) return 0;
  return (stockMarginValue / salesValue) * 100;
}

export function deriveMarginalLabDefaults(seed: SummarySeed): MarginalLabInputs {
  const netSales = Math.max(0, toNumber(seed.netSales));
  const marginPct = clamp(toNumber(seed.grossMarginPercent), 0, 95);

  const normalizedNetSales = netSales > 0 ? netSales : DEFAULT_INPUTS.netSales;
  const normalizedMarginPct = marginPct > 0 ? marginPct : DEFAULT_INPUTS.marginPct;
  const marginRatio = pctToRatio(normalizedMarginPct);
  const cogsNow = Math.max(0, normalizedNetSales * (1 - marginRatio));

  const stockCostFromSeed = Math.max(0, toNumber(seed.estimatedStockValue));
  const stockCostNow =
    stockCostFromSeed > 0 ? stockCostFromSeed : Math.max(0, (cogsNow / 30) * DEFAULT_INPUTS.stockDaysNow);

  const stockDaysNow =
    cogsNow > 0 && stockCostNow > 0 ? clamp((stockCostNow / cogsNow) * 30, 1, 365) : DEFAULT_INPUTS.stockDaysNow;

  return {
    netSales: normalizedNetSales,
    marginPct: normalizedMarginPct,
    discountPct: DEFAULT_INPUTS.discountPct,
    returnRatePct: DEFAULT_INPUTS.returnRatePct,
    mixLiftPctPoints: DEFAULT_INPUTS.mixLiftPctPoints,
    stockDaysNow,
    targetStockDays: clamp(Math.min(stockDaysNow, DEFAULT_INPUTS.targetStockDays), 1, 365),
    stockCostNow
  };
}

export function sanitizeMarginalLabInputs(input: Partial<MarginalLabInputs>): MarginalLabInputs {
  const netSales = Math.max(0, toNumber(input.netSales ?? DEFAULT_INPUTS.netSales));
  const marginPct = clamp(toNumber(input.marginPct ?? DEFAULT_INPUTS.marginPct), 0, 95);
  const discountPct = clamp(toNumber(input.discountPct ?? DEFAULT_INPUTS.discountPct), 0, 95);
  const returnRatePct = clamp(toNumber(input.returnRatePct ?? DEFAULT_INPUTS.returnRatePct), 0, 95);
  const mixLiftPctPoints = clamp(toNumber(input.mixLiftPctPoints ?? DEFAULT_INPUTS.mixLiftPctPoints), -30, 30);
  const stockDaysNow = clamp(toNumber(input.stockDaysNow ?? DEFAULT_INPUTS.stockDaysNow), 1, 365);
  const targetStockDays = clamp(toNumber(input.targetStockDays ?? DEFAULT_INPUTS.targetStockDays), 1, 365);
  const stockCostNow = Math.max(0, toNumber(input.stockCostNow ?? DEFAULT_INPUTS.stockCostNow));

  return {
    netSales,
    marginPct,
    discountPct,
    returnRatePct,
    mixLiftPctPoints,
    stockDaysNow,
    targetStockDays,
    stockCostNow
  };
}

export function runMarginalLabScenario(input: Partial<MarginalLabInputs>): MarginalLabResult {
  const normalized = sanitizeMarginalLabInputs(input);

  const baselineMarginRatio = pctToRatio(normalized.marginPct);
  const baselineGrossProfit = normalized.netSales * baselineMarginRatio;
  const baselineCogs = Math.max(0, normalized.netSales - baselineGrossProfit);

  const discountMultiplier = 1 - normalized.discountPct / 100;
  const returnMultiplier = 1 - normalized.returnRatePct / 100;
  const adjustedNetSales = Math.max(0, normalized.netSales * discountMultiplier * returnMultiplier);

  const adjustedMarginPct = clamp(normalized.marginPct + normalized.mixLiftPctPoints, 0, 95);
  const adjustedMarginRatio = pctToRatio(adjustedMarginPct);
  const adjustedGrossProfit = adjustedNetSales * adjustedMarginRatio;
  const scenarioCogs = Math.max(0, adjustedNetSales - adjustedGrossProfit);

  const monthlyGrossProfitDelta = adjustedGrossProfit - baselineGrossProfit;
  const monthlyGrossProfitDeltaPct = baselineGrossProfit > 0 ? (monthlyGrossProfitDelta / baselineGrossProfit) * 100 : 0;

  const baselineStockCost =
    normalized.stockCostNow > 0 ? normalized.stockCostNow : Math.max(0, (baselineCogs / 30) * normalized.stockDaysNow);
  const scenarioStockCost = Math.max(0, (scenarioCogs / 30) * normalized.targetStockDays);

  const releasedCash = Math.max(0, baselineStockCost - scenarioStockCost);
  const additionalCashNeed = Math.max(0, scenarioStockCost - baselineStockCost);

  const baselineStockMarginValue = toStockMarginValue(baselineStockCost, baselineMarginRatio);
  const scenarioStockMarginValue = toStockMarginValue(scenarioStockCost, adjustedMarginRatio);

  const baselineStockMarginPct = toStockMarginPct(baselineStockCost, baselineStockMarginValue);
  const scenarioStockMarginPct = toStockMarginPct(scenarioStockCost, scenarioStockMarginValue);

  const marginScore = clamp((adjustedMarginPct / 55) * 100, 0, 100);
  const discountScore = clamp(100 - normalized.discountPct * 2.2, 0, 100);
  const returnScore = clamp(100 - normalized.returnRatePct * 4.5, 0, 100);
  const stockScore = clamp(100 - normalized.targetStockDays * 0.9, 0, 100);
  const healthScore = Math.round(marginScore * 0.45 + discountScore * 0.2 + returnScore * 0.15 + stockScore * 0.2);

  return {
    normalized,
    baselineGrossProfit,
    adjustedNetSales,
    adjustedGrossProfit,
    adjustedMarginPct,
    monthlyGrossProfitDelta,
    monthlyGrossProfitDeltaPct,
    scenarioCogs,
    baselineStockCost,
    scenarioStockCost,
    releasedCash,
    additionalCashNeed,
    baselineStockMarginValue,
    baselineStockMarginPct,
    scenarioStockMarginValue,
    scenarioStockMarginPct,
    healthScore
  };
}
