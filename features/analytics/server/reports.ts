import { readdirSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
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
  quicklook_html_path?: string;
};

type AnalyticsSnapshot = {
  months: string[];
  selectedMonth: string | null;
  report: KpiReport | null;
  quicklookHtml: string | null;
  quicklookPath: string | null;
  usingFallback: boolean;
};

const MONTH_REGEX = /^20\d{2}-\d{2}$/;
const REPORTS_DIR = resolve(process.cwd(), "services", "analytics", "data", "reports", "sales_monthly", "v1");
const FALLBACK_DIR = resolve(process.cwd(), "features", "analytics", "assets");

function isPathInside(basePath: string, targetPath: string): boolean {
  const rel = relative(basePath, targetPath);
  return !rel.startsWith("..") && !isAbsolute(rel);
}

function safeParseMonth(value: string | undefined): string | null {
  if (!value) return null;
  return MONTH_REGEX.test(value) ? value : null;
}

function listKpiMonthsFromDir(baseDir: string): string[] {
  try {
    const entries = readdirSync(baseDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name.match(/^kpi_(20\d{2}-\d{2})\.json$/)?.[1] ?? null)
      .filter((value): value is string => value !== null)
      .sort();
  } catch {
    return [];
  }
}

export function listAvailableKpiMonths(): string[] {
  return listKpiMonthsFromDir(REPORTS_DIR);
}

function listPublicFallbackMonths(): string[] {
  const rawMonths = Array.isArray(publicAnalyticsIndex.months) ? publicAnalyticsIndex.months : [];
  return rawMonths
    .map((month) => safeParseMonth(typeof month === "string" ? month : undefined))
    .filter((month): month is string => month !== null)
    .sort();
}

function readKpiReport(baseDir: string, month: string): KpiReport | null {
  const reportPath = resolve(baseDir, `kpi_${month}.json`);
  try {
    const raw = readFileSync(reportPath, "utf8");
    return JSON.parse(raw) as KpiReport;
  } catch {
    return null;
  }
}

function resolveQuicklookPath(baseDir: string, month: string, report: KpiReport | null): string {
  const fallbackPath = resolve(baseDir, `kpi_${month}_quicklook.html`);
  const candidate = report?.quicklook_html_path;
  if (!candidate) return fallbackPath;

  const candidatePath = isAbsolute(candidate) ? resolve(candidate) : resolve(baseDir, candidate);
  return isPathInside(process.cwd(), candidatePath) ? candidatePath : fallbackPath;
}

function readQuicklookHtml(path: string): string | null {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

function selectMonth(months: string[], requestedMonth: string | undefined): string {
  const normalizedRequested = safeParseMonth(requestedMonth);
  if (normalizedRequested && months.includes(normalizedRequested)) {
    return normalizedRequested;
  }
  return months[months.length - 1];
}

function buildSnapshotFromDir(
  baseDir: string,
  requestedMonth: string | undefined,
  usingFallback: boolean
): AnalyticsSnapshot | null {
  const months = listKpiMonthsFromDir(baseDir);
  if (months.length === 0) return null;

  const selectedMonth = selectMonth(months, requestedMonth);
  const report = readKpiReport(baseDir, selectedMonth);
  const quicklookPath = resolveQuicklookPath(baseDir, selectedMonth, report);
  const quicklookHtml = readQuicklookHtml(quicklookPath);

  return {
    months,
    selectedMonth,
    report,
    quicklookHtml,
    quicklookPath,
    usingFallback
  };
}

export function getAnalyticsSnapshot(requestedMonth: string | undefined): AnalyticsSnapshot {
  const primary = buildSnapshotFromDir(REPORTS_DIR, requestedMonth, false);
  if (primary && primary.quicklookHtml) {
    return primary;
  }

  const fallback = buildSnapshotFromDir(FALLBACK_DIR, requestedMonth, true);
  if (fallback && fallback.quicklookHtml) {
    return fallback;
  }

  if (primary) {
    return primary;
  }

  const publicMonths = listPublicFallbackMonths();
  if (publicMonths.length > 0) {
    const selectedMonth = selectMonth(publicMonths, requestedMonth);
    return {
      months: publicMonths,
      selectedMonth,
      report: readKpiReport(FALLBACK_DIR, selectedMonth) ?? { report_month: selectedMonth },
      quicklookHtml: null,
      quicklookPath: `/analytics/kpi_${selectedMonth}_quicklook.html`,
      usingFallback: true
    };
  }

  return {
    months: [],
    selectedMonth: null,
    report: null,
    quicklookHtml: null,
    quicklookPath: null,
    usingFallback: false
  };
}
