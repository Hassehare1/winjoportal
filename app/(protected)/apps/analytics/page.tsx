import { getAnalyticsSnapshot } from "@/features/analytics/server/reports";

type AnalyticsPageProps = {
  searchParams: Promise<{
    month?: string | string[];
  }>;
};

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

export default async function AnalyticsPage({ searchParams }: AnalyticsPageProps) {
  const params = await searchParams;
  const month = Array.isArray(params.month) ? params.month[0] : params.month;
  const snapshot = getAnalyticsSnapshot(month);
  const summary = snapshot.report?.summary;

  return (
    <section className="space-y-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-sky-700">Analytics</p>
        <h1 className="mt-2 font-heading text-3xl font-bold text-slate-900">Intern KPI-preview</h1>
        <p className="mt-3 max-w-3xl text-slate-600">
          Enkel intern sida for att visa senaste KPI-quicklook med avdelningsfilter.
        </p>
      </header>

      {snapshot.selectedMonth ? (
        <>
          <form method="get" className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
            <label htmlFor="month" className="space-y-2">
              <span className="block text-sm font-semibold text-slate-800">Manad</span>
              <select
                id="month"
                name="month"
                defaultValue={snapshot.selectedMonth}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              >
                {snapshot.months.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-800"
            >
              Visa
            </button>
          </form>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <article className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500">Nettoforsaljning</p>
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
              <p className="text-xs text-slate-500">Salda enheter</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{formatNumber(summary?.units_sold)}</p>
            </article>
          </div>

          {snapshot.quicklookHtml ? (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
              <iframe
                title={`KPI quicklook ${snapshot.selectedMonth}`}
                srcDoc={snapshot.quicklookHtml}
                className="h-[1100px] w-full border-0"
              />
            </div>
          ) : (
            <article className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              Quicklook-HTML hittades inte for vald manad. Kor KPI-generatorn igen.
            </article>
          )}
        </>
      ) : (
        <article className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Inga KPI-rapporter hittades. Kor analytics-pipelinen forst:
          <br />
          <code>
            python services\analytics\scripts\ingest_all_months.py --input-dir
            &quot;...&quot; --output-root &quot;services\analytics\data&quot; --build-curated --generate-kpis
          </code>
        </article>
      )}

      {snapshot.quicklookPath ? (
        <p className="text-xs text-slate-500">Kalla: {snapshot.quicklookPath}</p>
      ) : null}
    </section>
  );
}
