import { CashflowWeatherPanel } from "@/features/cashflow-weather/components/cashflow-weather-panel";
import { deriveCashflowWeatherDefaults } from "@/features/cashflow-weather/lib/model";
import { getAnalyticsRawContext } from "@/features/analytics/server/reports";

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

export default function CashflowWeatherPage() {
  const rawContext = getAnalyticsRawContext(undefined);

  if (!rawContext.selectedMonth || !rawContext.data) {
    return (
      <section className="space-y-4">
        <header>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-sky-700">Cashflow Weather</p>
          <h1 className="mt-2 font-heading text-3xl font-bold text-slate-900">Kassaväder för 30 / 60 / 90 dagar</h1>
        </header>
        <article className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Ingen analytics-data hittades. Synka först `public/analytics` och uppdatera sidan.
        </article>
      </section>
    );
  }

  const summary = asRecord(rawContext.data.summary);
  const monthOverMonth = asRecord(rawContext.data.month_over_month);
  const defaults = deriveCashflowWeatherDefaults({
    netSales: summary ? toNumber(summary.net_sales) ?? undefined : undefined,
    grossMarginPercent: summary ? toNumber(summary.gross_margin_percent) ?? undefined : undefined,
    estimatedStockValue: summary ? toNumber(summary.estimated_stock_value) ?? undefined : undefined,
    trendPct: monthOverMonth ? toNumber(monthOverMonth.net_sales_delta_percent) ?? undefined : undefined
  });

  return (
    <section className="space-y-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-sky-700">Cashflow Weather</p>
        <h1 className="mt-2 font-heading text-4xl font-bold text-slate-900">Kassaväder för 30 / 60 / 90 dagar</h1>
        <p className="mt-3 max-w-3xl text-slate-600">
          Väderstyrning av kassaflöde baserat på lagertakt, kundfordringar, kostnader och försäljningstrend.
          Anpassa antaganden och se varningsnivå direkt innan beslut.
        </p>
      </header>

      <CashflowWeatherPanel selectedMonth={rawContext.selectedMonth} defaults={defaults} />
    </section>
  );
}
