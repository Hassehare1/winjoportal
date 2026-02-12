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
