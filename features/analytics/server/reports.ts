import { readdirSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";

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
const FALLBACK_MONTH = "2024-02";
const FALLBACK_DIR = resolve(process.cwd(), "features", "analytics", "assets");
const FALLBACK_REPORT_PATH = resolve(FALLBACK_DIR, `kpi_${FALLBACK_MONTH}.json`);
const FALLBACK_QUICKLOOK_PATH = resolve(FALLBACK_DIR, `kpi_${FALLBACK_MONTH}_quicklook.html`);

function isPathInside(basePath: string, targetPath: string): boolean {
  const rel = relative(basePath, targetPath);
  return !rel.startsWith("..") && !isAbsolute(rel);
}

function safeParseMonth(value: string | undefined): string | null {
  if (!value) return null;
  return MONTH_REGEX.test(value) ? value : null;
}

export function listAvailableKpiMonths(): string[] {
  try {
    const entries = readdirSync(REPORTS_DIR, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name.match(/^kpi_(20\d{2}-\d{2})\.json$/)?.[1] ?? null)
      .filter((value): value is string => value !== null)
      .sort();
  } catch {
    return [];
  }
}

function readKpiReportFromPath(reportPath: string): KpiReport | null {
  try {
    const raw = readFileSync(reportPath, "utf8");
    return JSON.parse(raw) as KpiReport;
  } catch {
    return null;
  }
}

function readKpiReport(month: string): KpiReport | null {
  return readKpiReportFromPath(resolve(REPORTS_DIR, `kpi_${month}.json`));
}

function resolveQuicklookPath(month: string, report: KpiReport | null): string {
  const fallbackPath = resolve(REPORTS_DIR, `kpi_${month}_quicklook.html`);
  const candidate = report?.quicklook_html_path;
  if (!candidate) return fallbackPath;

  const candidatePath = isAbsolute(candidate) ? resolve(candidate) : resolve(REPORTS_DIR, candidate);
  return isPathInside(process.cwd(), candidatePath) ? candidatePath : fallbackPath;
}

function readQuicklookHtml(path: string): string | null {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

function loadFallbackSnapshot(): {
  month: string;
  report: KpiReport | null;
  quicklookHtml: string | null;
  quicklookPath: string;
} {
  const report = readKpiReportFromPath(FALLBACK_REPORT_PATH);
  const reportMonth = safeParseMonth(report?.report_month) ?? FALLBACK_MONTH;
  return {
    month: reportMonth,
    report,
    quicklookHtml: readQuicklookHtml(FALLBACK_QUICKLOOK_PATH),
    quicklookPath: FALLBACK_QUICKLOOK_PATH
  };
}

export function getAnalyticsSnapshot(requestedMonth: string | undefined): AnalyticsSnapshot {
  const fallback = loadFallbackSnapshot();
  const months = listAvailableKpiMonths();
  if (months.length === 0) {
    if (fallback.quicklookHtml) {
      return {
        months: [fallback.month],
        selectedMonth: fallback.month,
        report: fallback.report ?? { report_month: fallback.month },
        quicklookHtml: fallback.quicklookHtml,
        quicklookPath: fallback.quicklookPath,
        usingFallback: true
      };
    }

    return {
      months,
      selectedMonth: null,
      report: null,
      quicklookHtml: null,
      quicklookPath: null,
      usingFallback: false
    };
  }

  const normalizedRequested = safeParseMonth(requestedMonth);
  const selectedMonth =
    normalizedRequested && months.includes(normalizedRequested)
      ? normalizedRequested
      : months[months.length - 1];

  let report = readKpiReport(selectedMonth);
  let quicklookPath = resolveQuicklookPath(selectedMonth, report);
  let quicklookHtml = readQuicklookHtml(quicklookPath);
  let usingFallback = false;

  if (!quicklookHtml && fallback.quicklookHtml) {
    report = report ?? fallback.report ?? { report_month: fallback.month };
    quicklookPath = fallback.quicklookPath;
    quicklookHtml = fallback.quicklookHtml;
    usingFallback = true;
  }

  return {
    months,
    selectedMonth,
    report,
    quicklookHtml,
    quicklookPath,
    usingFallback
  };
}
