type JsonRecord = Record<string, unknown>;

export type RiskRadarCell = {
  store: string;
  department: string;
  netSales: number;
  grossProfit: number;
  grossMarginPercent: number;
  estimatedStockValue: number;
  stockToSalesRatio: number;
  riskScore: number;
  severity: "Low" | "Medium" | "High";
  reason: string;
};

export type RiskRadarModel = {
  stores: string[];
  departments: string[];
  cells: RiskRadarCell[];
  highRiskCount: number;
  highRiskNetSales: number;
  highRiskStockValue: number;
  averageRiskScore: number;
  topRisks: RiskRadarCell[];
};

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

function toText(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function cleanStoreName(raw: string): string {
  return raw.replace(/^EBB[_\-\s]*/i, "").trim();
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function getSeverity(score: number): "Low" | "Medium" | "High" {
  if (score >= 70) return "High";
  if (score >= 45) return "Medium";
  return "Low";
}

function toReason(params: { marginPct: number; stockToSalesRatio: number; netSalesScale: number }) {
  const reasons: string[] = [];
  if (params.marginPct < 40) {
    reasons.push("låg TB%");
  }
  if (params.stockToSalesRatio > 2.2) {
    reasons.push("hög lagerbindning");
  }
  if (params.netSalesScale > 0.45) {
    reasons.push("stor försäljningsexponering");
  }
  if (reasons.length === 0) {
    return "balanserad profil";
  }
  return reasons.join(", ");
}

export function buildRiskRadarModel(rawData: JsonRecord | null): RiskRadarModel {
  const rows = asRows(rawData?.store_department_breakdown);
  if (rows.length === 0) {
    return {
      stores: [],
      departments: [],
      cells: [],
      highRiskCount: 0,
      highRiskNetSales: 0,
      highRiskStockValue: 0,
      averageRiskScore: 0,
      topRisks: []
    };
  }

  const maxNetSales = rows.reduce((max, row) => Math.max(max, toNumber(row.net_sales)), 1);
  const cells: RiskRadarCell[] = rows.map((row) => {
    const store = cleanStoreName(toText(row.filial, "Okänd butik"));
    const department = toText(row.avdelning, "Okänd avdelning");
    const netSales = toNumber(row.net_sales);
    const grossProfit = toNumber(row.gross_profit);
    const estimatedStockValue = toNumber(row.estimated_stock_value);

    const grossMarginPercent = netSales > 0 ? (grossProfit / netSales) * 100 : 0;
    const stockToSalesRatio = netSales > 0 ? estimatedStockValue / netSales : 0;

    const marginRisk = clamp((45 - grossMarginPercent) / 45, 0, 1);
    const stockRisk = clamp((stockToSalesRatio - 1.2) / 2.5, 0, 1);
    const netSalesScale = clamp(netSales / maxNetSales, 0, 1);
    const riskScore = Math.round((marginRisk * 0.45 + stockRisk * 0.35 + netSalesScale * 0.2) * 100);
    const severity = getSeverity(riskScore);

    return {
      store,
      department,
      netSales,
      grossProfit,
      grossMarginPercent,
      estimatedStockValue,
      stockToSalesRatio,
      riskScore,
      severity,
      reason: toReason({ marginPct: grossMarginPercent, stockToSalesRatio, netSalesScale })
    };
  });

  const highRiskCells = cells.filter((cell) => cell.severity === "High");
  const totalRiskScore = cells.reduce((sum, cell) => sum + cell.riskScore, 0);

  return {
    stores: Array.from(new Set(cells.map((cell) => cell.store))).sort(),
    departments: Array.from(new Set(cells.map((cell) => cell.department))).sort(),
    cells,
    highRiskCount: highRiskCells.length,
    highRiskNetSales: highRiskCells.reduce((sum, cell) => sum + cell.netSales, 0),
    highRiskStockValue: highRiskCells.reduce((sum, cell) => sum + cell.estimatedStockValue, 0),
    averageRiskScore: cells.length > 0 ? totalRiskScore / cells.length : 0,
    topRisks: [...cells].sort((a, b) => b.riskScore - a.riskScore).slice(0, 8)
  };
}

