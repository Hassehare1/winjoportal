import { getAnalyticsRawContext } from "@/features/analytics/server/reports";
import { MarginalLabPanel } from "@/features/marginal-lab/components/marginal-lab-panel";
import { deriveMarginalLabDefaults } from "@/features/marginal-lab/lib/model";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function toNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export default function MarginalLabPage() {
  const rawContext = getAnalyticsRawContext(undefined);

  if (!rawContext.selectedMonth || !rawContext.data) {
    return (
      <section className="space-y-4">
        <header>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-sky-700">Marginal-Labbet</p>
          <h1 className="mt-2 font-heading text-3xl font-bold text-slate-900">Scenarioverktyg för pris, mix och lager</h1>
        </header>
        <article className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Ingen analytics-data hittades. Synka först `public/analytics` och uppdatera sidan.
        </article>
      </section>
    );
  }

  const summary = asRecord(rawContext.data.summary);
  const defaults = deriveMarginalLabDefaults({
    netSales: summary ? toNumber(summary.net_sales) ?? undefined : undefined,
    grossMarginPercent: summary ? toNumber(summary.gross_margin_percent) ?? undefined : undefined,
    estimatedStockValue: summary ? toNumber(summary.estimated_stock_value) ?? undefined : undefined
  });

  return (
    <section className="space-y-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-sky-700">Marginal-Labbet</p>
        <h1 className="mt-2 font-heading text-4xl font-bold text-slate-900">Scenarioverktyg för pris, mix och lager</h1>
        <p className="mt-3 max-w-3xl text-slate-600">
          Testa olika antaganden och se direkt hur de påverkar bruttovinst, kapitalbindning och frigjort kassaflöde.
          Byggd för snabba, datadrivna beslut innan du ändrar något i drift.
        </p>
      </header>

      <MarginalLabPanel selectedMonth={rawContext.selectedMonth} defaults={defaults} />
    </section>
  );
}
