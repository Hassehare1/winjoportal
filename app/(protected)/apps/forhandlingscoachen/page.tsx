import { getAnalyticsRawContext } from "@/features/analytics/server/reports";
import { NegotiationFilterToolbar } from "@/features/negotiation-coach/components/negotiation-filter-toolbar";
import {
  applyNegotiationFilters,
  getNegotiationFilterOptions,
  parseNegotiationFilters,
  type SearchParams
} from "@/features/negotiation-coach/lib/filters";
import { buildNegotiationCoachModel, buildNegotiationSourceRows, type NegotiationPackage } from "@/features/negotiation-coach/lib/model";

function formatNumber(value: number): string {
  return new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 0 }).format(value);
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function formatRatio(value: number): string {
  return `${value.toFixed(2)}x`;
}

function formatSignedNumber(value: number): string {
  const sign = value >= 0 ? "+" : "-";
  return `${sign}${formatNumber(Math.abs(value))}`;
}

function packageLabel(id: NegotiationPackage["id"]): string {
  if (id === "aggressive") return "Aggressiv";
  if (id === "target") return "Mal";
  return "Bas";
}

function riskClass(score: number): string {
  if (score >= 70) return "text-red-700";
  if (score >= 45) return "text-amber-700";
  return "text-emerald-700";
}

type FörhandlingscoachenPageProps = {
  searchParams?: SearchParams | Promise<SearchParams>;
};

async function resolveSearchParams(searchParams: FörhandlingscoachenPageProps["searchParams"]): Promise<SearchParams> {
  if (!searchParams) {
    return {};
  }
  if (typeof (searchParams as Promise<SearchParams>).then === "function") {
    return ((await searchParams) ?? {}) as SearchParams;
  }
  return searchParams;
}

export default async function FörhandlingscoachenPage({ searchParams }: FörhandlingscoachenPageProps) {
  const resolvedSearchParams = await resolveSearchParams(searchParams);
  const rawContext = getAnalyticsRawContext(undefined);

  if (!rawContext.selectedMonth || !rawContext.data) {
    return (
      <section className="space-y-4">
        <header>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-sky-700">Förhandlingscoachen</p>
          <h1 className="mt-2 font-heading text-3xl font-bold text-slate-900">Prioriterade fÃ¶rhandlingskandidater</h1>
        </header>
        <article className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Ingen analytics-data hittades. Synka fÃ¶rst `public/analytics` och uppdatera sidan.
        </article>
      </section>
    );
  }

  const sourceRows = buildNegotiationSourceRows(rawContext.data);
  const options = getNegotiationFilterOptions(sourceRows);
  const filters = parseNegotiationFilters(resolvedSearchParams, options);
  const filteredRows = applyNegotiationFilters(sourceRows, filters);
  const model = buildNegotiationCoachModel(filteredRows, {
    selectedLevers: filters.selectedLevers,
    prioritizeBy: filters.prioritizeBy,
    supplierOverrides: filters.supplierOverrides
  });

  return (
    <section className="space-y-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-sky-700">Förhandlingscoachen</p>
        <h1 className="mt-2 font-heading text-4xl font-bold text-slate-900">Prioriterade fÃ¶rhandlingskandidater</h1>
        <p className="mt-3 max-w-3xl text-slate-600">
          Filtrera pÃ¥ butik, avdelning, leverantÃ¶r och risknivÃ¥. Testa leverantÃ¶rsspakar och se direkt effekt pÃ¥
          TB-potential och kassaflÃ¶deseffekt.
        </p>
      </header>

      <NegotiationFilterToolbar
        departments={options.departments}
        suppliers={options.suppliers}
        overrideSuppliers={filters.selectedSuppliers}
        stores={options.stores}
        years={options.years}
        monthNumbers={options.monthNumbers}
        periods={options.periods}
        selectedDepartments={filters.selectedDepartments}
        selectedSuppliers={filters.selectedSuppliers}
        selectedStores={filters.selectedStores}
        selectedYears={filters.selectedYears}
        selectedMonthNumbers={filters.selectedMonthNumbers}
        selectedLevers={filters.selectedLevers}
        prioritizeBy={filters.prioritizeBy}
        searchText={filters.searchText}
        tbMin={filters.tbMin}
        tbMax={filters.tbMax}
        netMin={filters.netMin}
        netMax={filters.netMax}
        stockSalesMin={filters.stockSalesMin}
        stockSalesMax={filters.stockSalesMax}
        returnRateMin={filters.returnRateMin}
        returnRateMax={filters.returnRateMax}
        supplierOverrides={filters.supplierOverrides}
      />

      {sourceRows.length === 0 ? (
        <article className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Underlaget saknar fÃ¶rhandlingsdata i vald period.
        </article>
      ) : null}

      {filteredRows.length === 0 ? (
        <article className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Inga rader matchar valda filter. Justera urvalet och fÃ¶rsÃ¶k igen.
        </article>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Kandidater</p>
          <p className="mt-1 text-4xl font-semibold text-slate-900">{formatNumber(model.totals.candidateCount)}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Netto i urval</p>
          <p className="mt-1 text-4xl font-semibold text-slate-900">{formatNumber(model.totals.netSales)}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">TB i urval</p>
          <p className="mt-1 text-4xl font-semibold text-slate-900">{formatNumber(model.totals.grossProfit)}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">MÃ¥l: TB-potential</p>
          <p className="mt-1 text-4xl font-semibold text-emerald-700">{formatNumber(model.totals.targetTbPotential)}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">MÃ¥l: KassaflÃ¶despotential</p>
          <p className="mt-1 text-4xl font-semibold text-sky-700">{formatNumber(model.totals.targetCashPotential)}</p>
        </article>
      </div>

      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
        <h2 className="font-heading text-3xl font-bold text-slate-900">Prioriterade fÃ¶rhandlingskandidater</h2>
        <p className="mt-2 text-slate-600">
          Visar toppkandidater enligt vald prioritering. Paket visar simulerad effekt i kronor.
        </p>

        <div className="mt-4 space-y-4">
          {model.candidates.slice(0, 12).map((candidate, index) => (
            <article key={candidate.key} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-slate-500">
                    #{index + 1} | {candidate.store} | {candidate.department}
                  </p>
                  <h3 className="text-3xl font-semibold text-slate-900">
                    {candidate.articleText} ({candidate.articleNumber})
                  </h3>
                  <p className="text-sm text-slate-500">
                    EAN: {candidate.ean || "-"} | {candidate.periods} period(er)
                  </p>
                  <p className="text-sm text-slate-500">LeverantÃ¶r: {candidate.supplier}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-slate-700">Prioritet: {candidate.priorityScore}/100</p>
                  <p className={`text-sm font-semibold ${riskClass(candidate.baseRiskScore)}`}>
                    Risk: {candidate.baseRiskScore}/100
                  </p>
                </div>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <article className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                  <p className="text-xs text-slate-500">Netto</p>
                  <p className="text-2xl font-semibold text-slate-900">{formatNumber(candidate.netSales)}</p>
                </article>
                <article className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                  <p className="text-xs text-slate-500">TB %</p>
                  <p className="text-2xl font-semibold text-slate-900">{formatPercent(candidate.grossMarginPercent)}</p>
                </article>
                <article className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                  <p className="text-xs text-slate-500">Lager/fÃ¶rsÃ¤ljning</p>
                  <p className="text-2xl font-semibold text-slate-900">{formatRatio(candidate.stockToSalesRatio)}</p>
                </article>
                <article className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                  <p className="text-xs text-slate-500">Returgrad (proxy)</p>
                  <p className="text-2xl font-semibold text-slate-900">{formatPercent(candidate.returnRatePercent)}</p>
                </article>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-[0.08em] text-slate-500">
                      <th className="py-2 pr-4">Paket</th>
                      <th className="py-2 pr-4">TB-effekt</th>
                      <th className="py-2 pr-4">Kassaeffekt</th>
                      <th className="py-2 pr-4">Total</th>
                      <th className="py-2 pr-4">Risk</th>
                      <th className="py-2">Spakar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {candidate.packages.map((pkg) => {
                      const isRecommended = pkg.id === candidate.recommendedPackageId;
                      return (
                        <tr key={pkg.id} className={isRecommended ? "bg-sky-50" : "border-t border-slate-100"}>
                          <td className="py-2 pr-4 font-semibold text-slate-900">
                            {packageLabel(pkg.id)}
                            {isRecommended ? (
                              <span className="ml-2 rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-700">
                                Rek
                              </span>
                            ) : null}
                          </td>
                          <td className="py-2 pr-4 text-sky-700">{formatSignedNumber(pkg.tbLift)}</td>
                          <td className="py-2 pr-4 text-cyan-700">{formatSignedNumber(pkg.cashLift)}</td>
                          <td className="py-2 pr-4 font-semibold text-slate-900">{formatSignedNumber(pkg.totalImpact)}</td>
                          <td className={`py-2 pr-4 font-semibold ${riskClass(pkg.riskScore)}`}>{pkg.riskScore}/100</td>
                          <td className="py-2 text-slate-700">
                            Inkopspris -{pkg.purchaseCostImprovementPct.toFixed(1)}%, utpris +{pkg.priceLiftPct.toFixed(1)}%,
                            AP +{pkg.apDaysGain.toFixed(0)}d, lager -{pkg.stockReleasePct.toFixed(1)}%, retur -
                            {pkg.returnReductionPct.toFixed(0)}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </article>
          ))}

          {model.candidates.length === 0 ? (
            <article className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              Inga kandidater att visa fÃ¶r valda filter.
            </article>
          ) : null}
        </div>
      </article>
    </section>
  );
}
