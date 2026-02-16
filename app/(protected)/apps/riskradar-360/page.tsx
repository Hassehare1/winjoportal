import { getAnalyticsRawContext } from "@/features/analytics/server/reports";
import { RiskRadarFilterToolbar } from "@/features/risk-radar/components/risk-radar-filter-toolbar";
import {
  aggregateRiskRadarRows,
  applyRiskRadarFilters,
  buildRiskRadarSourceRows,
  computeDefaultRiskTbThreshold,
  filterRiskRadarSourceRows,
  getRiskRadarFilterOptions,
  parseRiskRadarFilters,
  type FilteredRiskRadarCell,
  type RiskLevel,
  type SearchParams
} from "@/features/risk-radar/lib/filters";
import { buildRiskRadarModel } from "@/features/risk-radar/lib/model";

function formatNumber(value: number) {
  return new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 0 }).format(value);
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function formatRatio(value: number) {
  return `${value.toFixed(2)}x`;
}

function toNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function getSeverityClasses(severity: RiskLevel) {
  if (severity === "High") {
    return {
      badge: "border-red-200 bg-red-50 text-red-700",
      cell: "border-red-300 bg-red-50"
    };
  }
  if (severity === "Medium") {
    return {
      badge: "border-amber-200 bg-amber-50 text-amber-700",
      cell: "border-amber-300 bg-amber-50"
    };
  }
  return {
    badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
    cell: "border-emerald-300 bg-emerald-50"
  };
}

type RiskRadar360PageProps = {
  searchParams?: SearchParams | Promise<SearchParams>;
};

async function resolveSearchParams(searchParams: RiskRadar360PageProps["searchParams"]): Promise<SearchParams> {
  if (!searchParams) {
    return {};
  }
  if (typeof (searchParams as Promise<SearchParams>).then === "function") {
    return ((await searchParams) ?? {}) as SearchParams;
  }
  return searchParams;
}

export default async function RiskRadar360Page({ searchParams }: RiskRadar360PageProps) {
  const resolvedSearchParams = await resolveSearchParams(searchParams);
  const rawContext = getAnalyticsRawContext(undefined);

  if (!rawContext.selectedMonth || !rawContext.data) {
    return (
      <section className="space-y-4">
        <header>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-sky-700">Riskradar 360</p>
          <h1 className="mt-2 font-heading text-3xl font-bold text-slate-900">Riskmatris butik × avdelning</h1>
        </header>
        <article className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Ingen analytics-data hittades. Kör först KPI-pipelinen och synka `public/analytics`.
        </article>
      </section>
    );
  }

  const sourceRows = buildRiskRadarSourceRows(rawContext.data);
  const filterOptions = getRiskRadarFilterOptions(sourceRows);
  const summary = (rawContext.data.summary ?? null) as Record<string, unknown> | null;
  const totalGrossMarginPercent = summary ? toNumber(summary.gross_margin_percent) : null;
  const defaultRiskTbThreshold = computeDefaultRiskTbThreshold(totalGrossMarginPercent);
  const filters = parseRiskRadarFilters(resolvedSearchParams, filterOptions, defaultRiskTbThreshold);

  const filteredSourceRows = filterRiskRadarSourceRows(sourceRows, filters);
  const aggregatedRows = aggregateRiskRadarRows(filteredSourceRows);
  const model = buildRiskRadarModel({ store_department_breakdown: aggregatedRows });
  const filteredCells = applyRiskRadarFilters(model.cells, filters);

  const highRiskCells = filteredCells.filter((cell) => cell.derivedSeverity === "High");
  const averageRiskScore =
    filteredCells.length > 0 ? filteredCells.reduce((sum, cell) => sum + cell.riskScore, 0) / filteredCells.length : 0;

  const storesForMatrix = [...filters.selectedStores];
  const departmentsForMatrix = [...filters.selectedDepartments];

  const cellMap = new Map<string, FilteredRiskRadarCell>();
  filteredCells.forEach((cell) => {
    cellMap.set(`${cell.department}::${cell.store}`, cell);
  });

  const topRisks = [...filteredCells].sort((a, b) => b.riskScore - a.riskScore).slice(0, 10);

  return (
    <section className="space-y-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-sky-700">Riskradar 360</p>
        <h1 className="mt-2 font-heading text-3xl font-bold text-slate-900">Riskmatris butik × avdelning</h1>
        <p className="mt-3 text-slate-600">
          Period: <span className="font-semibold text-slate-900">{rawContext.selectedMonth}</span>. Varje ruta visar
          riskpoäng, TB% och lager/försäljning.
        </p>
      </header>

      <RiskRadarFilterToolbar
        departments={filterOptions.departments}
        stores={filterOptions.stores}
        years={filterOptions.years}
        monthNumbers={filterOptions.monthNumbers}
        periods={filterOptions.periods}
        selectedDepartments={filters.selectedDepartments}
        selectedStores={filters.selectedStores}
        selectedYears={filters.selectedYears}
        selectedMonthNumbers={filters.selectedMonthNumbers}
        selectedRiskLevels={filters.selectedRiskLevels}
        riskTbThreshold={filters.riskTbThreshold}
        defaultRiskTbThreshold={defaultRiskTbThreshold}
      />

      {sourceRows.length === 0 ? (
        <article className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Underlaget saknar `time_store_department_breakdown` och `store_department_breakdown` för vald period.
        </article>
      ) : null}

      {filteredSourceRows.length === 0 ? (
        <article className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Inga rader matchar valda filter. Justera urvalet och försök igen.
        </article>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Högriskzoner</p>
          <p className="mt-1 text-3xl font-semibold text-slate-900">{formatNumber(highRiskCells.length)}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Exponerad nettoförsäljning</p>
          <p className="mt-1 text-3xl font-semibold text-slate-900">
            {formatNumber(highRiskCells.reduce((sum, cell) => sum + cell.netSales, 0))}
          </p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Kapital i högriskzon</p>
          <p className="mt-1 text-3xl font-semibold text-slate-900">
            {formatNumber(highRiskCells.reduce((sum, cell) => sum + cell.estimatedStockValue, 0))}
          </p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Snittrisk i matris</p>
          <p className="mt-1 text-3xl font-semibold text-slate-900">{averageRiskScore.toFixed(1)}%</p>
        </article>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <article className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="font-heading text-2xl font-semibold text-slate-900">Riskmatris butik × avdelning</h2>
          <p className="mt-1 text-sm text-slate-600">Skalad tabell i vald period och valda filter.</p>
          {storesForMatrix.length > 0 && departmentsForMatrix.length > 0 ? (
            <div className="mt-4">
              <table className="w-full table-fixed border-separate border-spacing-2">
                <thead>
                  <tr>
                    <th className="w-44 px-2 py-1 text-left text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                      Avdelning
                    </th>
                    {storesForMatrix.map((store) => (
                      <th
                        key={store}
                        className="break-words px-2 py-1 text-left text-xs font-semibold uppercase tracking-[0.08em] text-slate-500"
                      >
                        {store}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {departmentsForMatrix.map((department) => (
                    <tr key={department}>
                      <th className="align-top px-2 py-2 text-left text-sm font-semibold text-slate-800">{department}</th>
                      {storesForMatrix.map((store) => {
                        const cell = cellMap.get(`${department}::${store}`);
                        if (!cell) {
                          return (
                            <td key={`${department}-${store}`} className="px-2 py-2 text-sm text-slate-400">
                              -
                            </td>
                          );
                        }
                        const classes = getSeverityClasses(cell.derivedSeverity);
                        return (
                          <td key={`${department}-${store}`} className="align-top px-2 py-2">
                            <div className={`rounded-lg border p-2 ${classes.cell}`}>
                              <p className="text-sm font-semibold text-slate-900">Risk {cell.riskScore}/100</p>
                              <p className="text-xs text-slate-700">TB% {formatPercent(cell.grossMarginPercent)}</p>
                              <p className="text-xs text-slate-700">L/S {formatRatio(cell.stockToSalesRatio)}</p>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <article className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
              Välj minst en avdelning och en butik för att visa matrisen.
            </article>
          )}
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="font-heading text-2xl font-semibold text-slate-900">Topp-risksignaler</h2>
          <p className="mt-1 text-sm text-slate-600">Prioriterad lista för operativa åtgärder.</p>
          <div className="mt-4 space-y-3">
            {topRisks.map((risk) => {
              const classes = getSeverityClasses(risk.derivedSeverity);
              return (
                <article key={`${risk.store}-${risk.department}`} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-base font-semibold text-slate-900">
                      {risk.store} / {risk.department}
                    </h3>
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${classes.badge}`}>
                      {risk.derivedSeverity}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-700">Orsak: {risk.reason}</p>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-slate-600">
                    <p>Risk: {risk.riskScore}/100</p>
                    <p>TB%: {formatPercent(risk.grossMarginPercent)}</p>
                    <p>L/S: {formatRatio(risk.stockToSalesRatio)}</p>
                  </div>
                </article>
              );
            })}
            {topRisks.length === 0 && (
              <article className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                Inga riskrader matchar valda filter.
              </article>
            )}
          </div>
        </article>
      </div>
    </section>
  );
}
