import { readFileSync } from "node:fs";
import { join } from "node:path";
import publicAnalyticsIndex from "@/public/analytics/index.json";

type KpiSummary = {
  net_sales?: number;
  gross_profit?: number;
  gross_margin_percent?: number;
  units_sold?: number;
  store_count?: number;
  department_count?: number;
};

type KpiReport = {
  report_month?: string;
  summary?: KpiSummary;
};

type AnalyticsSnapshot = {
  months: string[];
  selectedMonth: string | null;
  report: KpiReport | null;
  quicklookPath: string | null;
};

type AnalyticsAssistantContext = {
  selectedMonth: string | null;
  months: string[];
  data: Record<string, unknown> | null;
};

type AnalyticsIndexReportEntry = {
  report_month?: string;
  summary?: KpiSummary;
  quicklook_path?: string;
  json_path?: string;
};

type AnalyticsIndexPayload = {
  months?: unknown;
  reports?: Record<string, AnalyticsIndexReportEntry>;
};

const MONTH_REGEX = /^20\d{2}-\d{2}$/;

function safeParseMonth(value: string | undefined): string | null {
  if (!value) return null;
  return MONTH_REGEX.test(value) ? value : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function toPublicJsonPath(reportEntry: AnalyticsIndexReportEntry, month: string): string {
  if (typeof reportEntry.json_path === "string" && reportEntry.json_path.startsWith("/analytics/")) {
    return reportEntry.json_path;
  }
  return `/analytics/kpi_${month}.json`;
}

function readKpiJsonForMonth(indexPayload: AnalyticsIndexPayload, month: string): Record<string, unknown> | null {
  const reportEntry = indexPayload.reports?.[month] ?? {};
  const publicJsonPath = toPublicJsonPath(reportEntry, month);
  const relativePath = publicJsonPath.replace(/^\//, "");
  const absolutePath = join(process.cwd(), "public", relativePath);
  try {
    const raw = readFileSync(absolutePath, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    return asRecord(parsed);
  } catch {
    return null;
  }
}

function toNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function pickTopRows(
  rows: unknown,
  sortKey: string,
  keepKeys: string[],
  topN: number
): Array<Record<string, unknown>> {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => asRecord(row))
    .filter((row): row is Record<string, unknown> => row !== null)
    .sort((a, b) => {
      const av = toNumber(a[sortKey]) ?? Number.NEGATIVE_INFINITY;
      const bv = toNumber(b[sortKey]) ?? Number.NEGATIVE_INFINITY;
      return bv - av;
    })
    .slice(0, topN)
    .map((row) => {
      const picked: Record<string, unknown> = {};
      keepKeys.forEach((key) => {
        if (row[key] !== undefined) {
          picked[key] = row[key];
        }
      });
      return picked;
    });
}

function compactReportData(data: Record<string, unknown>, month: string): Record<string, unknown> {
  const summary = asRecord(data.summary) ?? {};
  const monthOverMonth = asRecord(data.month_over_month) ?? {};

  return {
    report_month: month,
    summary: {
      net_sales: summary.net_sales,
      gross_profit: summary.gross_profit,
      gross_margin_percent: summary.gross_margin_percent,
      units_sold: summary.units_sold,
      stock_units: summary.stock_units,
      estimated_stock_value: summary.estimated_stock_value,
      stock_margin_value: summary.stock_margin_value,
      store_count: summary.store_count,
      department_count: summary.department_count
    },
    month_over_month: monthOverMonth,
    store_share_top: pickTopRows(
      data.store_share,
      "net_sales",
      ["filial", "net_sales", "gross_profit", "gross_margin_percent", "estimated_stock_value"],
      8
    ),
    department_share_top: pickTopRows(
      data.department_share,
      "net_sales",
      ["avdelning", "net_sales", "gross_profit", "gross_margin_percent", "estimated_stock_value", "units_sold"],
      10
    ),
    low_margin_high_sales_top: pickTopRows(
      data.low_margin_high_sales_top_n,
      "net_sales",
      ["filial", "avdelning", "varutext", "artnr", "ean", "net_sales", "gross_profit", "gross_margin_percent", "units_sold"],
      10
    ),
    margin_risk_items_top: pickTopRows(
      data.margin_risk_items_top_n,
      "net_sales",
      ["filial", "avdelning", "varutext", "artnr", "ean", "net_sales", "gross_profit", "gross_margin_percent", "units_sold"],
      10
    ),
    inventory_hotspots_top: pickTopRows(
      data.inventory_hotspots_top_n,
      "estimated_stock_value",
      ["filial", "avdelning", "estimated_stock_value", "net_sales", "stock_to_sales_ratio"],
      10
    )
  };
}

export function listAvailableKpiMonths(): string[] {
  const payload = publicAnalyticsIndex as AnalyticsIndexPayload;
  const rawMonths: unknown[] = Array.isArray(payload.months)
    ? payload.months
    : [];
  return rawMonths
    .map((month) => safeParseMonth(typeof month === "string" ? month : undefined))
    .filter((month): month is string => month !== null)
    .sort();
}

function selectMonth(months: string[], requestedMonth: string | undefined): string {
  const normalizedRequested = safeParseMonth(requestedMonth);
  if (normalizedRequested && months.includes(normalizedRequested)) {
    return normalizedRequested;
  }
  return months[months.length - 1];
}

export function getAnalyticsSnapshot(requestedMonth: string | undefined): AnalyticsSnapshot {
  const indexPayload = publicAnalyticsIndex as AnalyticsIndexPayload;
  const months = listAvailableKpiMonths();
  if (months.length > 0) {
    const selectedMonth = selectMonth(months, requestedMonth);
    const reportEntry = indexPayload.reports?.[selectedMonth] ?? {};
    const quicklookPath =
      typeof reportEntry.quicklook_path === "string" && reportEntry.quicklook_path.startsWith("/analytics/")
        ? reportEntry.quicklook_path
        : `/analytics/kpi_${selectedMonth}_quicklook.html`;

    return {
      months,
      selectedMonth,
      report: {
        report_month: selectedMonth,
        summary: reportEntry.summary
      },
      quicklookPath
    };
  }

  return {
    months: [],
    selectedMonth: null,
    report: null,
    quicklookPath: null
  };
}

export function getAnalyticsAssistantContext(requestedMonth: string | undefined): AnalyticsAssistantContext {
  const indexPayload = publicAnalyticsIndex as AnalyticsIndexPayload;
  const months = listAvailableKpiMonths();
  if (months.length === 0) {
    return {
      months: [],
      selectedMonth: null,
      data: null
    };
  }

  const selectedMonth = selectMonth(months, requestedMonth);
  const reportData = readKpiJsonForMonth(indexPayload, selectedMonth);
  if (!reportData) {
    return {
      months,
      selectedMonth,
      data: null
    };
  }

  return {
    months,
    selectedMonth,
    data: compactReportData(reportData, selectedMonth)
  };
}
