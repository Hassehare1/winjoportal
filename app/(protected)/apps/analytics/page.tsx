import { getAnalyticsSnapshot } from "@/features/analytics/server/reports";
import { AnalyticsRefreshButton } from "@/features/analytics/components/analytics-refresh-button";
import { AnalyticsAiAssistant } from "@/features/analytics/components/analytics-ai-assistant";

function formatNumber(value: number | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "-";
  }
  return new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 0 }).format(value);
}

function formatPercent(value: number | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "-";
  }
  return `${value.toFixed(2)}%`;
}

export default async function AnalyticsPage() {
  const snapshot = getAnalyticsSnapshot(undefined);
  const summary = snapshot.report?.summary;

  return (
    <section className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px] 2xl:grid-cols-[minmax(0,1fr)_460px] xl:items-start">
        <div className="space-y-6">
          <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-start">
            <header>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-sky-700">Analytics</p>
              <h1 className="mt-2 font-heading text-3xl font-bold text-slate-900">Intern KPI-preview</h1>
              <p className="mt-3 max-w-3xl text-slate-600">
                Enkel intern sida för att visa senaste KPI-quicklook med avdelningsfilter.
              </p>
            </header>
            <div className="lg:min-w-[300px]">
              <AnalyticsRefreshButton compact />
            </div>
          </div>

          {snapshot.selectedMonth ? (
            <>
              <article className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Total senaste inlästa period</p>
                <p className="mt-1 text-sm text-slate-700">
                  Period: <span className="font-semibold text-slate-900">{snapshot.selectedMonth}</span>
                </p>
              </article>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <article className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-xs text-slate-500">Nettoförsäljning</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">{formatNumber(summary?.net_sales)}</p>
                </article>
                <article className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-xs text-slate-500">TB</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">{formatNumber(summary?.gross_profit)}</p>
                </article>
                <article className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-xs text-slate-500">TB %</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">{formatPercent(summary?.gross_margin_percent)}</p>
                </article>
                <article className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-xs text-slate-500">Sålda enheter</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">{formatNumber(summary?.units_sold)}</p>
                </article>
              </div>

              {snapshot.quicklookPath && snapshot.quicklookPath.startsWith("/analytics/") ? (
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
                  <iframe
                    title={`KPI quicklook ${snapshot.selectedMonth}`}
                    src={snapshot.quicklookPath}
                    className="h-[1100px] w-full border-0"
                  />
                </div>
              ) : (
                <article className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  Quicklook-HTML hittades inte för vald månad. Kör KPI-generatorn igen.
                </article>
              )}
            </>
          ) : (
            <article className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              Inga KPI-rapporter hittades. Kör analytics-pipelinen först:
              <br />
              <code>
                python services\analytics\scripts\ingest_all_months.py --input-dir
                &quot;...&quot; --output-root &quot;services\analytics\data&quot; --build-curated --generate-kpis
              </code>
            </article>
          )}

          {snapshot.quicklookPath ? (
            <p className="text-xs text-slate-500">Källa: {snapshot.quicklookPath}</p>
          ) : null}
        </div>
        <div className="xl:sticky xl:top-20">
          <AnalyticsAiAssistant selectedMonth={snapshot.selectedMonth} />
        </div>
      </div>
    </section>
  );
}
