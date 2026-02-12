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
};

const MONTH_REGEX = /^20\d{2}-\d{2}$/;
const REPORTS_DIR = resolve(process.cwd(), "services", "analytics", "data", "reports", "sales_monthly", "v1");

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

function readKpiReport(month: string): KpiReport | null {
  const reportPath = resolve(REPORTS_DIR, `kpi_${month}.json`);
  try {
    const raw = readFileSync(reportPath, "utf8");
    return JSON.parse(raw) as KpiReport;
  } catch {
    return null;
  }
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

export function getAnalyticsSnapshot(requestedMonth: string | undefined): AnalyticsSnapshot {
  const months = listAvailableKpiMonths();
  if (months.length === 0) {
    return {
      months,
      selectedMonth: null,
      report: null,
      quicklookHtml: null,
      quicklookPath: null
    };
  }

  const normalizedRequested = safeParseMonth(requestedMonth);
  const selectedMonth =
    normalizedRequested && months.includes(normalizedRequested)
      ? normalizedRequested
      : months[months.length - 1];

  const report = readKpiReport(selectedMonth);
  const quicklookPath = resolveQuicklookPath(selectedMonth, report);
  const quicklookHtml = readQuicklookHtml(quicklookPath);

  return {
    months,
    selectedMonth,
    report,
    quicklookHtml,
    quicklookPath
  };
}
