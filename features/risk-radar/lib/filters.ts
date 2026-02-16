import type { RiskRadarCell } from "@/features/risk-radar/lib/model";

export type SearchParams = Record<string, string | string[] | undefined>;
export type RiskLevel = "High" | "Medium" | "Low";

export const NONE_SENTINEL = "__none__";
export const ALL_RISK_LEVELS: RiskLevel[] = ["High", "Medium", "Low"];

export type RiskRadarSourceRow = {
  reportMonth: string;
  reportYear: string;
  reportMonthNumber: number;
  store: string;
  department: string;
  netSales: number;
  grossProfit: number;
  estimatedStockValue: number;
};

export type RiskRadarPeriodOption = {
  reportMonth: string;
  reportYear: string;
  reportMonthNumber: number;
};

export type RiskRadarFilterOptions = {
  departments: string[];
  stores: string[];
  years: string[];
  monthNumbers: number[];
  periods: RiskRadarPeriodOption[];
};

export type RiskRadarFilters = {
  selectedDepartments: string[];
  selectedStores: string[];
  selectedYears: string[];
  selectedMonthNumbers: number[];
  selectedRiskLevels: RiskLevel[];
  riskTbThreshold: number;
};

export type FilteredRiskRadarCell = RiskRadarCell & {
  derivedSeverity: RiskLevel;
};

type JsonRecord = Record<string, unknown>;

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

function toText(value: unknown, fallback = ""): string {
  if (typeof value !== "string") {
    return fallback;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function firstValue(value: string | string[] | undefined): string | null {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value) && value.length > 0) {
    return value[0];
  }
  return null;
}

function asArray(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => item.trim()).filter((item) => item.length > 0);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? [trimmed] : [];
  }
  return [];
}

function uniqueSortedStrings(values: string[]): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b, "sv-SE"));
}

function uniqueSortedNumbers(values: number[]): number[] {
  return Array.from(new Set(values)).sort((a, b) => a - b);
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function normalizeStoreName(raw: string): string {
  const withoutPrefix = raw.replace(/^EBB[_\-\s]*/i, "");
  const normalized = withoutPrefix.replaceAll("_", " ").trim();
  return normalized.length > 0 ? normalized : raw;
}

function parseMonthFromReportMonth(reportMonth: string): number {
  const match = /^(\d{4})-(\d{2})$/.exec(reportMonth);
  if (!match) return 0;
  const month = Number(match[2]);
  if (!Number.isFinite(month) || month < 1 || month > 12) return 0;
  return month;
}

function parseYearFromReportMonth(reportMonth: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(reportMonth);
  if (!match) return "";
  return match[1];
}

function parseMonthNumber(value: unknown, fallbackReportMonth: string): number {
  const explicit = Number(value);
  if (Number.isFinite(explicit) && explicit >= 1 && explicit <= 12) {
    return explicit;
  }
  return parseMonthFromReportMonth(fallbackReportMonth);
}

export function buildRiskRadarSourceRows(rawData: JsonRecord): RiskRadarSourceRow[] {
  const fallbackReportMonth = toText(rawData.report_month);
  const timeRows = asRows(rawData.time_store_department_breakdown);
  const sourceRows = timeRows.length > 0 ? timeRows : asRows(rawData.store_department_breakdown);

  return sourceRows
    .map((row) => {
      const reportMonth = toText(row.report_month, fallbackReportMonth);
      const fallbackYear = parseYearFromReportMonth(reportMonth);
      const reportYear = toText(row.report_year, fallbackYear);
      const reportMonthNumber = parseMonthNumber(row.report_month_number, reportMonth);
      const store = normalizeStoreName(toText(row.filial, "Okänd butik"));
      const department = toText(row.avdelning, "Okänd avdelning");

      return {
        reportMonth,
        reportYear,
        reportMonthNumber,
        store,
        department,
        netSales: toNumber(row.net_sales),
        grossProfit: toNumber(row.gross_profit),
        estimatedStockValue: toNumber(row.estimated_stock_value)
      } satisfies RiskRadarSourceRow;
    })
    .filter((row) => row.reportYear.length > 0 && row.reportMonthNumber >= 1 && row.reportMonthNumber <= 12);
}

export function getRiskRadarFilterOptions(rows: RiskRadarSourceRow[]): RiskRadarFilterOptions {
  const periodsMap = new Map<string, RiskRadarPeriodOption>();
  rows.forEach((row) => {
    if (row.reportMonth.length > 0) {
      periodsMap.set(row.reportMonth, {
        reportMonth: row.reportMonth,
        reportYear: row.reportYear,
        reportMonthNumber: row.reportMonthNumber
      });
    }
  });

  return {
    departments: uniqueSortedStrings(rows.map((row) => row.department)),
    stores: uniqueSortedStrings(rows.map((row) => row.store)),
    years: uniqueSortedStrings(rows.map((row) => row.reportYear)),
    monthNumbers: uniqueSortedNumbers(rows.map((row) => row.reportMonthNumber)),
    periods: [...periodsMap.values()].sort((a, b) => a.reportMonth.localeCompare(b.reportMonth))
  };
}

function parseStringSelection(
  rawValues: string[],
  availableValues: string[]
): {
  selected: string[];
  explicitNone: boolean;
} {
  const explicitNone = rawValues.includes(NONE_SENTINEL);
  const filtered = uniqueSortedStrings(rawValues.filter((value) => availableValues.includes(value)));
  if (explicitNone) {
    return { selected: [], explicitNone: true };
  }
  if (filtered.length > 0) {
    return { selected: filtered, explicitNone: false };
  }
  return { selected: [...availableValues], explicitNone: false };
}

function parseMonthSelection(
  rawValues: string[],
  availableValues: number[]
): {
  selected: number[];
  explicitNone: boolean;
} {
  const explicitNone = rawValues.includes(NONE_SENTINEL);
  const availableSet = new Set(availableValues);
  const filtered = uniqueSortedNumbers(
    rawValues
      .map((value) => Number(value.replace(",", ".")))
      .filter((value) => Number.isFinite(value) && availableSet.has(value))
  );
  if (explicitNone) {
    return { selected: [], explicitNone: true };
  }
  if (filtered.length > 0) {
    return { selected: filtered, explicitNone: false };
  }
  return { selected: [...availableValues], explicitNone: false };
}

export function computeDefaultRiskTbThreshold(totalGrossMarginPercent: number | null): number {
  const basis = typeof totalGrossMarginPercent === "number" ? totalGrossMarginPercent : 49.5;
  return Number(clamp(basis - 10, 30, 50).toFixed(1));
}

export function deriveRiskLevel(cell: RiskRadarCell, riskTbThreshold: number): RiskLevel {
  const highCutoff = riskTbThreshold - 8;
  if (cell.grossMarginPercent < highCutoff || cell.riskScore >= 70) {
    return "High";
  }
  if (cell.grossMarginPercent < riskTbThreshold || cell.riskScore >= 45) {
    return "Medium";
  }
  return "Low";
}

export function parseRiskRadarFilters(
  searchParams: SearchParams,
  options: RiskRadarFilterOptions,
  defaultRiskTbThreshold: number
): RiskRadarFilters {
  const departments = parseStringSelection(asArray(searchParams.department), options.departments);
  const stores = parseStringSelection(asArray(searchParams.store), options.stores);
  const years = parseStringSelection(asArray(searchParams.year), options.years);
  const monthNumbers = parseMonthSelection(asArray(searchParams.month_number), options.monthNumbers);

  const rawLevels = asArray(searchParams.risk_level);
  const riskLevelExplicitNone = rawLevels.includes(NONE_SENTINEL);
  const selectedRiskLevels = uniqueSortedStrings(
    rawLevels.filter((level): level is RiskLevel => ALL_RISK_LEVELS.includes(level as RiskLevel))
  ) as RiskLevel[];

  const rawThreshold = firstValue(searchParams.risk_tb_threshold);
  const parsedThreshold = rawThreshold === null ? Number.NaN : Number(rawThreshold.replace(",", "."));
  const riskTbThreshold = Number.isFinite(parsedThreshold)
    ? Number(clamp(parsedThreshold, 0, 100).toFixed(1))
    : defaultRiskTbThreshold;

  return {
    selectedDepartments: departments.selected,
    selectedStores: stores.selected,
    selectedYears: years.selected,
    selectedMonthNumbers: monthNumbers.selected,
    selectedRiskLevels: riskLevelExplicitNone
      ? []
      : selectedRiskLevels.length > 0
        ? selectedRiskLevels
        : [...ALL_RISK_LEVELS],
    riskTbThreshold
  };
}

export function filterRiskRadarSourceRows(rows: RiskRadarSourceRow[], filters: RiskRadarFilters): RiskRadarSourceRow[] {
  if (
    filters.selectedDepartments.length === 0 ||
    filters.selectedStores.length === 0 ||
    filters.selectedYears.length === 0 ||
    filters.selectedMonthNumbers.length === 0
  ) {
    return [];
  }

  const departmentSet = new Set(filters.selectedDepartments);
  const storeSet = new Set(filters.selectedStores);
  const yearSet = new Set(filters.selectedYears);
  const monthSet = new Set(filters.selectedMonthNumbers);

  return rows.filter(
    (row) =>
      departmentSet.has(row.department) &&
      storeSet.has(row.store) &&
      yearSet.has(row.reportYear) &&
      monthSet.has(row.reportMonthNumber)
  );
}

export function aggregateRiskRadarRows(rows: RiskRadarSourceRow[]): Array<Record<string, unknown>> {
  const aggregates = new Map<
    string,
    {
      filial: string;
      avdelning: string;
      net_sales: number;
      gross_profit: number;
      estimated_stock_value: number;
    }
  >();

  rows.forEach((row) => {
    const key = `${row.department}::${row.store}`;
    const current = aggregates.get(key);
    if (!current) {
      aggregates.set(key, {
        filial: row.store,
        avdelning: row.department,
        net_sales: row.netSales,
        gross_profit: row.grossProfit,
        estimated_stock_value: row.estimatedStockValue
      });
      return;
    }
    current.net_sales += row.netSales;
    current.gross_profit += row.grossProfit;
    current.estimated_stock_value += row.estimatedStockValue;
  });

  return [...aggregates.values()];
}

export function applyRiskRadarFilters(cells: RiskRadarCell[], filters: RiskRadarFilters): FilteredRiskRadarCell[] {
  if (
    filters.selectedDepartments.length === 0 ||
    filters.selectedStores.length === 0 ||
    filters.selectedRiskLevels.length === 0
  ) {
    return [];
  }

  const departmentSet = new Set(filters.selectedDepartments);
  const storeSet = new Set(filters.selectedStores);
  const riskSet = new Set(filters.selectedRiskLevels);

  return cells
    .filter((cell) => departmentSet.has(cell.department) && storeSet.has(cell.store))
    .map((cell) => {
      const derivedSeverity = deriveRiskLevel(cell, filters.riskTbThreshold);
      return {
        ...cell,
        derivedSeverity
      };
    })
    .filter((cell) => riskSet.has(cell.derivedSeverity));
}
