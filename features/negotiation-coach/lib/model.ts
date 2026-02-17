export type NegotiationLever =
  | "purchase_cost"
  | "price_lift"
  | "payment_terms"
  | "moq_stock"
  | "returns";

export type PrioritizeBy = "balanced" | "tb" | "cash" | "low_risk";

export const ALL_NEGOTIATION_LEVERS: NegotiationLever[] = [
  "purchase_cost",
  "price_lift",
  "payment_terms",
  "moq_stock",
  "returns"
];

export type NegotiationSourceRow = {
  reportMonth: string;
  reportYear: string;
  reportMonthNumber: number;
  store: string;
  department: string;
  supplier: string;
  articleNumber: string;
  ean: string;
  articleText: string;
  netSales: number;
  grossProfit: number;
  grossMarginPercent: number;
  unitsSold: number;
  returnUnits: number;
  returnRowCount: number;
  negativeMarginRowCount: number;
  estimatedStockValue: number;
  stockToSalesRatio: number;
  returnRatePercent: number;
};

export type NegotiationPackage = {
  id: "base" | "target" | "aggressive";
  label: string;
  purchaseCostImprovementPct: number;
  priceLiftPct: number;
  apDaysGain: number;
  stockReleasePct: number;
  returnReductionPct: number;
  tbLift: number;
  cashLift: number;
  totalImpact: number;
  riskScore: number;
};

export type NegotiationCandidate = {
  key: string;
  store: string;
  department: string;
  supplier: string;
  articleNumber: string;
  ean: string;
  articleText: string;
  periods: number;
  netSales: number;
  grossProfit: number;
  grossMarginPercent: number;
  returnRatePercent: number;
  stockToSalesRatio: number;
  estimatedStockValue: number;
  baseRiskScore: number;
  opportunityScore: number;
  priorityScore: number;
  recommendedPackageId: NegotiationPackage["id"];
  packages: NegotiationPackage[];
};

export type NegotiationCoachModel = {
  candidates: NegotiationCandidate[];
  totals: {
    candidateCount: number;
    netSales: number;
    grossProfit: number;
    targetTbPotential: number;
    targetCashPotential: number;
    targetTotalPotential: number;
  };
};

type JsonRecord = Record<string, unknown>;

export type SupplierLeverOverride = {
  supplier: string;
  purchaseCostImprovementPct: number | null;
  priceLiftPct: number | null;
  apDaysGain: number | null;
  stockReleasePct: number | null;
  returnReductionPct: number | null;
};

type BuildModelInput = {
  selectedLevers: NegotiationLever[];
  prioritizeBy: PrioritizeBy;
  supplierOverrides?: SupplierLeverOverride[];
};

type PackageProfile = {
  id: NegotiationPackage["id"];
  label: string;
  purchaseCostImprovementPct: number;
  priceLiftPct: number;
  apDaysGain: number;
  stockReleasePct: number;
  returnReductionPct: number;
  executionRisk: number;
};

const PACKAGE_PROFILES: PackageProfile[] = [
  {
    id: "base",
    label: "Bas",
    purchaseCostImprovementPct: 1.2,
    priceLiftPct: 0.4,
    apDaysGain: 3,
    stockReleasePct: 4,
    returnReductionPct: 10,
    executionRisk: 18
  },
  {
    id: "target",
    label: "Mål",
    purchaseCostImprovementPct: 2.5,
    priceLiftPct: 0.9,
    apDaysGain: 7,
    stockReleasePct: 9,
    returnReductionPct: 18,
    executionRisk: 28
  },
  {
    id: "aggressive",
    label: "Aggressiv",
    purchaseCostImprovementPct: 4.2,
    priceLiftPct: 1.5,
    apDaysGain: 12,
    stockReleasePct: 14,
    returnReductionPct: 30,
    executionRisk: 40
  }
];

const TARGET_PROFILE = PACKAGE_PROFILES.find((profile) => profile.id === "target") ?? PACKAGE_PROFILES[1] ?? PACKAGE_PROFILES[0];

function asRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as JsonRecord;
}

function asRows(value: unknown): JsonRecord[] {
  if (!Array.isArray(value)) return [];
  return value.map((row) => asRecord(row)).filter((row): row is JsonRecord => row !== null);
}

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

function toText(value: unknown, fallback = ""): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (trimmed.length === 0) return fallback;

  return trimmed
    .replaceAll("Ã¥", "å")
    .replaceAll("Ã¤", "ä")
    .replaceAll("Ã¶", "ö")
    .replaceAll("Ã…", "Å")
    .replaceAll("Ã„", "Ä")
    .replaceAll("Ã–", "Ö")
    .replaceAll("Ã©", "é");
}

function normalizeStoreName(rawStore: string): string {
  const withoutPrefix = rawStore.replace(/^EBB[_\-\s]*/i, "");
  return withoutPrefix.replaceAll("_", " ").trim();
}

function parseMonth(reportMonth: string): number {
  const match = /^(\d{4})-(\d{2})$/.exec(reportMonth);
  if (!match) return 0;
  const month = Number(match[2]);
  if (!Number.isFinite(month) || month < 1 || month > 12) return 0;
  return month;
}

function parseYear(reportMonth: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(reportMonth);
  if (!match) return "";
  return match[1];
}

function toPreferredAbs(current: number, next: number): number {
  return Math.abs(next) > Math.abs(current) ? next : current;
}

function toSourceRowKey(parts: {
  reportMonth: string;
  store: string;
  department: string;
  supplier: string;
  articleNumber: string;
  ean: string;
  articleText: string;
}): string {
  return [
    parts.reportMonth,
    parts.store,
    parts.department,
    parts.supplier || "-",
    parts.articleNumber || "-",
    parts.ean || "-",
    parts.articleText || "-"
  ].join("::");
}

function buildStockRatioMap(rawData: JsonRecord): Map<string, number> {
  const rows = asRows(rawData.time_store_department_breakdown);
  const output = new Map<string, number>();
  rows.forEach((row) => {
    const reportMonth = toText(row.report_month, toText(rawData.report_month));
    const store = normalizeStoreName(toText(row.filial));
    const department = toText(row.avdelning);
    if (!reportMonth || !store || !department) return;
    const netSales = toNumber(row.net_sales);
    const stock = toNumber(row.estimated_stock_value);
    const ratio = netSales > 0 ? stock / netSales : 0;
    output.set(`${reportMonth}::${store}::${department}`, ratio);
  });
  return output;
}

function upsertSourceRow(
  map: Map<string, NegotiationSourceRow>,
  row: {
    reportMonth: string;
    store: string;
    department: string;
    supplier: string;
    articleNumber: string;
    ean: string;
    articleText: string;
    reportYear: string;
    reportMonthNumber: number;
    netSales: number;
    grossProfit: number;
    grossMarginPercent: number;
    unitsSold: number;
    returnUnits: number;
    returnRowCount: number;
    negativeMarginRowCount: number;
    stockToSalesRatio: number;
    estimatedStockValue: number;
  }
) {
  const key = toSourceRowKey(row);
  const existing = map.get(key);
  if (!existing) {
    const returnRatePercent =
      row.unitsSold + row.returnUnits > 0 ? (row.returnUnits / (row.unitsSold + row.returnUnits)) * 100 : 0;
    map.set(key, {
      ...row,
      returnRatePercent
    });
    return;
  }

  const mergedUnitsSold = Math.max(existing.unitsSold, row.unitsSold);
  const mergedReturnUnits = Math.max(existing.returnUnits, row.returnUnits);
  const mergedNetSales = toPreferredAbs(existing.netSales, row.netSales);
  const mergedGrossProfit = toPreferredAbs(existing.grossProfit, row.grossProfit);
  const mergedGrossMarginPercent =
    mergedNetSales > 0 ? (mergedGrossProfit / mergedNetSales) * 100 : toPreferredAbs(existing.grossMarginPercent, row.grossMarginPercent);

  const returnRatePercent =
    mergedUnitsSold + mergedReturnUnits > 0
      ? (mergedReturnUnits / (mergedUnitsSold + mergedReturnUnits)) * 100
      : existing.returnRatePercent;

  map.set(key, {
    ...existing,
    netSales: mergedNetSales,
    grossProfit: mergedGrossProfit,
    grossMarginPercent: mergedGrossMarginPercent,
    unitsSold: mergedUnitsSold,
    returnUnits: mergedReturnUnits,
    returnRowCount: Math.max(existing.returnRowCount, row.returnRowCount),
    negativeMarginRowCount: Math.max(existing.negativeMarginRowCount, row.negativeMarginRowCount),
    stockToSalesRatio: Math.max(existing.stockToSalesRatio, row.stockToSalesRatio),
    estimatedStockValue: Math.max(existing.estimatedStockValue, row.estimatedStockValue),
    returnRatePercent
  });
}

function buildRowsFromDataset(
  rawData: JsonRecord,
  datasetKey: "time_low_margin_high_sales_top_n" | "time_margin_risk_items_top_n" | "time_return_risk_items_top_n",
  stockRatios: Map<string, number>,
  output: Map<string, NegotiationSourceRow>
) {
  const rows = asRows(rawData[datasetKey]);
  const fallbackMonth = toText(rawData.report_month);
  rows.forEach((row) => {
    const reportMonth = toText(row.report_month, fallbackMonth);
    const store = normalizeStoreName(toText(row.filial, "Okänd butik"));
    const department = toText(row.avdelning, "Okänd avdelning");
    const supplier = toText(row.huvudleverantor, "Okänd leverantör");
    const articleNumber = toText(row.artnr, "okänd-artikel");
    const ean = toText(row.ean);
    const articleText = toText(row.varutext, "Artikel saknar namn");
    const reportYear = toText(row.report_year, parseYear(reportMonth));
    const reportMonthNumberRaw = toNumber(row.report_month_number);
    const reportMonthNumber =
      reportMonthNumberRaw >= 1 && reportMonthNumberRaw <= 12 ? reportMonthNumberRaw : parseMonth(reportMonth);

    const netSales = toNumber(row.net_sales);
    const grossProfit = toNumber(row.gross_profit);
    const grossMarginPercentRaw = toNumber(row.gross_margin_percent);
    const grossMarginPercent =
      netSales > 0 ? (grossProfit / netSales) * 100 : clamp(grossMarginPercentRaw, -200, 200);

    const unitsRaw = toNumber(row.units_sold);
    const unitsSold = unitsRaw > 0 ? unitsRaw : 0;
    const returnUnits = unitsRaw < 0 ? Math.abs(unitsRaw) : 0;
    const returnRowCount = toNumber(row.return_row_count);
    const negativeMarginRowCount = toNumber(row.negative_margin_row_count);

    const ratioKey = `${reportMonth}::${store}::${department}`;
    const stockToSalesRatio = stockRatios.get(ratioKey) ?? 0;
    const estimatedStockValue = Math.max(0, netSales) * stockToSalesRatio;

    upsertSourceRow(output, {
      reportMonth,
      reportYear,
      reportMonthNumber,
      store,
      department,
      supplier,
      articleNumber,
      ean,
      articleText,
      netSales,
      grossProfit,
      grossMarginPercent,
      unitsSold,
      returnUnits,
      returnRowCount,
      negativeMarginRowCount,
      stockToSalesRatio,
      estimatedStockValue
    });
  });
}

export function buildNegotiationSourceRows(rawData: JsonRecord | null): NegotiationSourceRow[] {
  if (!rawData) return [];

  const stockRatios = buildStockRatioMap(rawData);
  const merged = new Map<string, NegotiationSourceRow>();

  buildRowsFromDataset(rawData, "time_low_margin_high_sales_top_n", stockRatios, merged);
  buildRowsFromDataset(rawData, "time_margin_risk_items_top_n", stockRatios, merged);
  buildRowsFromDataset(rawData, "time_return_risk_items_top_n", stockRatios, merged);

  return [...merged.values()].sort((a, b) => b.netSales - a.netSales);
}

function computeBaseRiskScore(row: NegotiationSourceRow, maxNetSales: number): number {
  const marginRisk = clamp(((44 - row.grossMarginPercent) / 44) * 100, 0, 100);
  const stockRisk = clamp(((row.stockToSalesRatio - 1.8) / 2.2) * 100, 0, 100);
  const returnRisk = clamp(((row.returnRatePercent - 8) / 20) * 100, 0, 100);
  const scaleRisk = clamp((row.netSales / maxNetSales) * 100, 0, 100);
  return Math.round(marginRisk * 0.35 + stockRisk * 0.25 + returnRisk * 0.2 + scaleRisk * 0.2);
}

function computeOpportunityScore(row: NegotiationSourceRow, maxNetSales: number): number {
  const marginGap = clamp(((46 - row.grossMarginPercent) / 46) * 100, 0, 100);
  const stockPressure = clamp(((row.stockToSalesRatio - 1.6) / 2.4) * 100, 0, 100);
  const returnPressure = clamp(((row.returnRatePercent - 6) / 24) * 100, 0, 100);
  const scale = clamp((row.netSales / maxNetSales) * 100, 0, 100);
  return Math.round(marginGap * 0.4 + stockPressure * 0.25 + returnPressure * 0.2 + scale * 0.15);
}

function buildScenarioPackage(
  row: NegotiationSourceRow,
  profile: PackageProfile,
  levers: Set<NegotiationLever>,
  baseRiskScore: number,
  supplierOverrideMap: Map<string, SupplierLeverOverride>
): NegotiationPackage {
  const supplierOverride = supplierOverrideMap.get(row.supplier);
  const purchaseCostRatio = TARGET_PROFILE.purchaseCostImprovementPct > 0 ? profile.purchaseCostImprovementPct / TARGET_PROFILE.purchaseCostImprovementPct : 1;
  const priceLiftRatio = TARGET_PROFILE.priceLiftPct > 0 ? profile.priceLiftPct / TARGET_PROFILE.priceLiftPct : 1;
  const apDaysRatio = TARGET_PROFILE.apDaysGain > 0 ? profile.apDaysGain / TARGET_PROFILE.apDaysGain : 1;
  const stockReleaseRatio = TARGET_PROFILE.stockReleasePct > 0 ? profile.stockReleasePct / TARGET_PROFILE.stockReleasePct : 1;
  const returnReductionRatio = TARGET_PROFILE.returnReductionPct > 0 ? profile.returnReductionPct / TARGET_PROFILE.returnReductionPct : 1;

  const supplierPurchaseCost = supplierOverride?.purchaseCostImprovementPct;
  const supplierPriceLift = supplierOverride?.priceLiftPct;
  const supplierApDays = supplierOverride?.apDaysGain;
  const supplierStockRelease = supplierOverride?.stockReleasePct;
  const supplierReturnReduction = supplierOverride?.returnReductionPct;

  const profilePurchaseCost =
    supplierPurchaseCost === null || supplierPurchaseCost === undefined
      ? profile.purchaseCostImprovementPct
      : supplierPurchaseCost * purchaseCostRatio;
  const profilePriceLift =
    supplierPriceLift === null || supplierPriceLift === undefined ? profile.priceLiftPct : supplierPriceLift * priceLiftRatio;
  const profileApDays =
    supplierApDays === null || supplierApDays === undefined ? profile.apDaysGain : supplierApDays * apDaysRatio;
  const profileStockRelease =
    supplierStockRelease === null || supplierStockRelease === undefined
      ? profile.stockReleasePct
      : supplierStockRelease * stockReleaseRatio;
  const profileReturnReduction =
    supplierReturnReduction === null || supplierReturnReduction === undefined
      ? profile.returnReductionPct
      : supplierReturnReduction * returnReductionRatio;

  const netSales = Math.max(0, row.netSales);
  const cogs = Math.max(0, netSales - row.grossProfit);
  const marginRatio = clamp(row.grossMarginPercent / 100, 0, 0.95);
  const estimatedReturnSales = netSales * (row.returnRatePercent / 100);

  const purchaseCostImprovementPct = levers.has("purchase_cost") ? profilePurchaseCost : 0;
  const priceLiftPct = levers.has("price_lift") ? profilePriceLift : 0;
  const apDaysGain = levers.has("payment_terms") ? profileApDays : 0;
  const stockReleasePct = levers.has("moq_stock") ? profileStockRelease : 0;
  const returnReductionPct = levers.has("returns") ? profileReturnReduction : 0;

  const tbFromPurchase = cogs * (purchaseCostImprovementPct / 100);
  const tbFromPrice = netSales * (priceLiftPct / 100);
  const tbFromReturns = estimatedReturnSales * marginRatio * (returnReductionPct / 100);
  const tbLift = Math.max(0, tbFromPurchase + tbFromPrice + tbFromReturns);

  const cashFromAp = (cogs / 30) * apDaysGain;
  const cashFromStock = row.estimatedStockValue * (stockReleasePct / 100);
  const cashLift = Math.max(0, cashFromAp + cashFromStock);
  const totalImpact = tbLift + cashLift;

  const leverCount = levers.size;
  const complexityPenalty = leverCount >= 4 ? 8 : leverCount === 3 ? 5 : 2;
  const riskScore = Math.round(clamp(baseRiskScore * 0.55 + profile.executionRisk + complexityPenalty, 0, 100));

  return {
    id: profile.id,
    label: profile.label,
    purchaseCostImprovementPct,
    priceLiftPct,
    apDaysGain,
    stockReleasePct,
    returnReductionPct,
    tbLift,
    cashLift,
    totalImpact,
    riskScore
  };
}

function selectRecommendedPackage(
  packages: NegotiationPackage[],
  prioritizeBy: PrioritizeBy
): NegotiationPackage["id"] {
  if (packages.length === 0) return "target";
  let best = packages[0];
  packages.slice(1).forEach((pkg) => {
    const bestScore =
      prioritizeBy === "tb"
        ? best.tbLift
        : prioritizeBy === "cash"
          ? best.cashLift
          : prioritizeBy === "low_risk"
            ? (100 - best.riskScore) * 0.65 + best.totalImpact * 0.35
            : best.totalImpact * 0.7 + (100 - best.riskScore) * 0.3;

    const nextScore =
      prioritizeBy === "tb"
        ? pkg.tbLift
        : prioritizeBy === "cash"
          ? pkg.cashLift
          : prioritizeBy === "low_risk"
            ? (100 - pkg.riskScore) * 0.65 + pkg.totalImpact * 0.35
            : pkg.totalImpact * 0.7 + (100 - pkg.riskScore) * 0.3;

    if (nextScore > bestScore) {
      best = pkg;
    }
  });
  return best.id;
}

function asPackageMap(packages: NegotiationPackage[]): Record<NegotiationPackage["id"], NegotiationPackage> {
  const fallback = packages[0];
  return {
    base: packages.find((pkg) => pkg.id === "base") ?? fallback,
    target: packages.find((pkg) => pkg.id === "target") ?? fallback,
    aggressive: packages.find((pkg) => pkg.id === "aggressive") ?? fallback
  };
}

export function buildNegotiationCoachModel(rows: NegotiationSourceRow[], input: BuildModelInput): NegotiationCoachModel {
  if (rows.length === 0) {
    return {
      candidates: [],
      totals: {
        candidateCount: 0,
        netSales: 0,
        grossProfit: 0,
        targetTbPotential: 0,
        targetCashPotential: 0,
        targetTotalPotential: 0
      }
    };
  }

  const grouped = new Map<string, NegotiationSourceRow & { periods: Set<string> }>();
  rows.forEach((row) => {
    const key = [row.store, row.department, row.supplier, row.articleNumber, row.ean || "-", row.articleText].join("::");
    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, {
        ...row,
        periods: new Set([row.reportMonth])
      });
      return;
    }

    existing.periods.add(row.reportMonth);
    existing.netSales += row.netSales;
    existing.grossProfit += row.grossProfit;
    existing.unitsSold = Math.max(existing.unitsSold, row.unitsSold);
    existing.returnUnits += row.returnUnits;
    existing.returnRowCount += row.returnRowCount;
    existing.negativeMarginRowCount += row.negativeMarginRowCount;
    existing.estimatedStockValue += row.estimatedStockValue;
    existing.stockToSalesRatio =
      existing.netSales > 0 ? existing.estimatedStockValue / existing.netSales : Math.max(existing.stockToSalesRatio, row.stockToSalesRatio);
    existing.grossMarginPercent = existing.netSales > 0 ? (existing.grossProfit / existing.netSales) * 100 : existing.grossMarginPercent;
    existing.returnRatePercent =
      existing.unitsSold + existing.returnUnits > 0
        ? (existing.returnUnits / (existing.unitsSold + existing.returnUnits)) * 100
        : existing.returnRatePercent;
  });

  const groupedRows = [...grouped.values()];
  const maxNetSales = Math.max(1, ...groupedRows.map((row) => row.netSales));
  const leverSet = new Set(input.selectedLevers);
  const supplierOverrideMap = new Map<string, SupplierLeverOverride>();
  (input.supplierOverrides ?? []).forEach((override) => {
    const supplier = override.supplier.trim();
    if (!supplier) return;
    supplierOverrideMap.set(supplier, override);
  });

  const candidates: NegotiationCandidate[] = groupedRows.map((row) => {
    const baseRiskScore = computeBaseRiskScore(row, maxNetSales);
    const opportunityScore = computeOpportunityScore(row, maxNetSales);
    const packages = PACKAGE_PROFILES.map((profile) =>
      buildScenarioPackage(row, profile, leverSet, baseRiskScore, supplierOverrideMap)
    );
    const recommendedPackageId = selectRecommendedPackage(packages, input.prioritizeBy);

    return {
      key: [row.store, row.department, row.supplier, row.articleNumber, row.ean || "-", row.articleText].join("::"),
      store: row.store,
      department: row.department,
      supplier: row.supplier,
      articleNumber: row.articleNumber,
      ean: row.ean,
      articleText: row.articleText,
      periods: row.periods.size,
      netSales: row.netSales,
      grossProfit: row.grossProfit,
      grossMarginPercent: row.grossMarginPercent,
      returnRatePercent: row.returnRatePercent,
      stockToSalesRatio: row.stockToSalesRatio,
      estimatedStockValue: row.estimatedStockValue,
      baseRiskScore,
      opportunityScore,
      priorityScore: 0,
      recommendedPackageId,
      packages
    };
  });

  const packageMaps = candidates.map((candidate) => asPackageMap(candidate.packages));
  const maxTargetTb = Math.max(1, ...packageMaps.map((pkg) => pkg.target.tbLift));
  const maxTargetCash = Math.max(1, ...packageMaps.map((pkg) => pkg.target.cashLift));
  const maxTargetTotal = Math.max(1, ...packageMaps.map((pkg) => pkg.target.totalImpact));

  candidates.forEach((candidate) => {
    const packageMap = asPackageMap(candidate.packages);
    const target = packageMap.target;
    const normalizedTb = (target.tbLift / maxTargetTb) * 100;
    const normalizedCash = (target.cashLift / maxTargetCash) * 100;
    const normalizedTotal = (target.totalImpact / maxTargetTotal) * 100;
    const lowRiskBoost = 100 - target.riskScore;

    candidate.priorityScore = Math.round(
      input.prioritizeBy === "tb"
        ? normalizedTb * 0.65 + candidate.opportunityScore * 0.35
        : input.prioritizeBy === "cash"
          ? normalizedCash * 0.65 + candidate.opportunityScore * 0.35
          : input.prioritizeBy === "low_risk"
            ? lowRiskBoost * 0.55 + normalizedTotal * 0.25 + candidate.opportunityScore * 0.2
            : normalizedTotal * 0.5 + candidate.opportunityScore * 0.3 + lowRiskBoost * 0.2
    );
  });

  candidates.sort((a, b) => b.priorityScore - a.priorityScore);

  const totals = candidates.reduce(
    (acc, candidate) => {
      const packageMap = asPackageMap(candidate.packages);
      acc.candidateCount += 1;
      acc.netSales += candidate.netSales;
      acc.grossProfit += candidate.grossProfit;
      acc.targetTbPotential += packageMap.target.tbLift;
      acc.targetCashPotential += packageMap.target.cashLift;
      acc.targetTotalPotential += packageMap.target.totalImpact;
      return acc;
    },
    {
      candidateCount: 0,
      netSales: 0,
      grossProfit: 0,
      targetTbPotential: 0,
      targetCashPotential: 0,
      targetTotalPotential: 0
    }
  );

  return {
    candidates,
    totals
  };
}
