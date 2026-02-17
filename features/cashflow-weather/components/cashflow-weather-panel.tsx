"use client";

import { useMemo, useState } from "react";
import {
  CashflowWeatherInputs,
  CashflowWeatherLevel,
  runCashflowWeather,
  sanitizeCashflowWeatherInputs
} from "@/features/cashflow-weather/lib/model";

type CashflowWeatherPanelProps = {
  selectedMonth: string | null;
  defaults: CashflowWeatherInputs;
};

type FormState = {
  arDays: string;
  targetArDays: string;
  apDays: string;
  fixedCostsMonthly: string;
  monthlyTrendPct: string;
  cashBuffer: string;
  creditLine: string;
};

const integerInputFormatter = new Intl.NumberFormat("sv-SE", {
  maximumFractionDigits: 0
});

function parseLocalizedNumber(value: string): number | null {
  const normalized = value
    .replace(/\u00A0/g, " ")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^0-9.-]/g, "");

  if (!normalized || normalized === "-" || normalized === "." || normalized === "-.") {
    return null;
  }

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function toInputNumber(value: string, fallback: number): number {
  const parsed = parseLocalizedNumber(value);
  return parsed ?? fallback;
}

function formatIntegerInputValue(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return integerInputFormatter.format(Math.round(value));
}

function formatTrendInputValue(value: number): string {
  if (!Number.isFinite(value)) return "0,0";
  return value.toFixed(1).replace(".", ",");
}

function formatGroupedIntegerField(rawValue: string): string {
  const digits = rawValue.replace(/[^\d]/g, "");
  if (!digits) return "";
  return formatIntegerInputValue(Number(digits));
}

function formatTrendField(rawValue: string): string {
  const hasLeadingMinus = rawValue.trim().startsWith("-");
  const cleaned = rawValue
    .replace(/\u00A0/g, " ")
    .replace(/\s/g, "")
    .replace(/[^\d,.-]/g, "")
    .replace(/-/g, "")
    .replace(/\./g, ",");

  if (!cleaned) {
    return hasLeadingMinus ? "-" : "";
  }

  const parts = cleaned.split(",");
  const integerDigits = (parts[0] ?? "").replace(/[^\d]/g, "");
  const decimalDigits = (parts[1] ?? "").replace(/[^\d]/g, "").slice(0, 1);

  const integerFormatted = integerDigits ? formatIntegerInputValue(Number(integerDigits)) : "0";

  let formatted = integerFormatted;
  if (cleaned.endsWith(",") && decimalDigits.length === 0) {
    formatted = `${integerFormatted},`;
  } else if (decimalDigits.length > 0) {
    formatted = `${integerFormatted},${decimalDigits}`;
  }

  return hasLeadingMinus ? `-${formatted}` : formatted;
}

function formatSek(value: number): string {
  return new Intl.NumberFormat("sv-SE", {
    maximumFractionDigits: 0
  }).format(value);
}

function formatSignedSek(value: number): string {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${formatSek(Math.abs(value))}`;
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function weatherTone(weather: CashflowWeatherLevel) {
  if (weather === "Sun") {
    return {
      label: "Sol",
      card: "border-emerald-200 bg-emerald-50",
      text: "text-emerald-700"
    };
  }
  if (weather === "Storm") {
    return {
      label: "Storm",
      card: "border-red-200 bg-red-50",
      text: "text-red-700"
    };
  }
  return {
    label: "Moln",
    card: "border-amber-200 bg-amber-50",
    text: "text-amber-700"
  };
}

export function CashflowWeatherPanel({ selectedMonth, defaults }: CashflowWeatherPanelProps) {
  const [formState, setFormState] = useState<FormState>({
    arDays: formatIntegerInputValue(defaults.arDays),
    targetArDays: formatIntegerInputValue(defaults.targetArDays),
    apDays: formatIntegerInputValue(defaults.apDays),
    fixedCostsMonthly: formatIntegerInputValue(defaults.fixedCostsMonthly),
    monthlyTrendPct: formatTrendInputValue(defaults.monthlyTrendPct),
    cashBuffer: formatIntegerInputValue(defaults.cashBuffer),
    creditLine: formatIntegerInputValue(defaults.creditLine)
  });

  const mergedInputs = useMemo<Partial<CashflowWeatherInputs>>(
    () => ({
      ...defaults,
      arDays: toInputNumber(formState.arDays, defaults.arDays),
      targetArDays: toInputNumber(formState.targetArDays, defaults.targetArDays),
      apDays: toInputNumber(formState.apDays, defaults.apDays),
      fixedCostsMonthly: toInputNumber(formState.fixedCostsMonthly, defaults.fixedCostsMonthly),
      monthlyTrendPct: toInputNumber(formState.monthlyTrendPct, defaults.monthlyTrendPct),
      cashBuffer: toInputNumber(formState.cashBuffer, defaults.cashBuffer),
      creditLine: toInputNumber(formState.creditLine, defaults.creditLine)
    }),
    [defaults, formState]
  );

  const result = useMemo(() => runCashflowWeather(mergedInputs), [mergedInputs]);

  function normalizeEditableFields() {
    const normalized = sanitizeCashflowWeatherInputs(mergedInputs);
    setFormState({
      arDays: formatIntegerInputValue(normalized.arDays),
      targetArDays: formatIntegerInputValue(normalized.targetArDays),
      apDays: formatIntegerInputValue(normalized.apDays),
      fixedCostsMonthly: formatIntegerInputValue(normalized.fixedCostsMonthly),
      monthlyTrendPct: formatTrendInputValue(normalized.monthlyTrendPct),
      cashBuffer: formatIntegerInputValue(normalized.cashBuffer),
      creditLine: formatIntegerInputValue(normalized.creditLine)
    });
  }

  const summaryTone = weatherTone(result.summaryLevel);
  const day90 = result.points[result.points.length - 1];

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <article className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-4">
          <h2 className="font-heading text-3xl font-bold text-slate-900">Så använder du Cashflow Weather</h2>
          <ol className="mt-3 space-y-1 text-slate-700">
            <li>1. Verifiera nuläget för kundfordringar, trend och fasta kostnader.</li>
            <li>2. Justera antaganden för 30/60/90 dagar och följ väderskiftet.</li>
            <li>3. Prioritera åtgärder där vädret går mot Moln eller Storm.</li>
          </ol>
          <p className="mt-3 text-sm text-slate-600">Resultatet är en styrsignal för kassaflöde, inte bokfört utfall.</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-700">Begrepp i samma KPI-terminologi</h3>
          <ul className="mt-2 space-y-1 text-sm text-slate-700">
            <li><span className="font-semibold text-slate-900">Kundfordringar (dagar)</span>: dagar från försäljning till inbetalning.</li>
            <li><span className="font-semibold text-slate-900">Mål AR-dagar</span>: önskad nivå för kundfordringar i dagar.</li>
            <li><span className="font-semibold text-slate-900">Leverantörsskulder (AP-dagar)</span>: dagar till leverantörsbetalning (finansierar lager/inköp).</li>
            <li><span className="font-semibold text-slate-900">Fasta kostnader / månad</span>: kostnader som inte följer försäljningstakten.</li>
            <li><span className="font-semibold text-slate-900">Försäljningstrend (% / månad)</span>: förväntad månadsförändring i nettoförsäljning.</li>
            <li><span className="font-semibold text-slate-900">Kassabuffert</span>: likvida medel att möta svängningar i rörelsekapital.</li>
            <li><span className="font-semibold text-slate-900">Kreditram</span>: tillgänglig checkkredit/rörelsekredit som kan täcka tillfälliga kassagap.</li>
          </ul>
        </div>

        {result.warnings.length > 0 ? (
          <article className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-[0.1em] text-amber-800">Viktiga antagandevarningar</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-900">
              {result.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </article>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-3">
          <article className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Dataperiod</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{selectedMonth ?? "-"}</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Nettoförsäljning (månad)</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{formatSek(result.normalized.netSales)}</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Lagerdagar (beräknat)</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{result.inventoryDays.toFixed(1)} dagar</p>
          </article>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="font-semibold text-slate-800">Kundfordringar (dagar)</span>
            <p className="text-xs text-slate-500">Påverkar nivån i "Kundfordringar (nu)".</p>
            <input
              inputMode="numeric"
              value={formState.arDays}
              onChange={(event) =>
                setFormState((current) => ({ ...current, arDays: formatGroupedIntegerField(event.target.value) }))
              }
              onBlur={normalizeEditableFields}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900"
              placeholder="24"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-semibold text-slate-800">Mål AR-dagar</span>
            <p className="text-xs text-slate-500">Lägre nivå frigör kapital från kundfordringar.</p>
            <input
              inputMode="numeric"
              value={formState.targetArDays}
              onChange={(event) =>
                setFormState((current) => ({ ...current, targetArDays: formatGroupedIntegerField(event.target.value) }))
              }
              onBlur={normalizeEditableFields}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900"
              placeholder="24"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-semibold text-slate-800">Leverantörsskulder (AP-dagar)</span>
            <p className="text-xs text-slate-500">Högre nivå innebär mer leverantörskredit och lägre kapitalbindning.</p>
            <input
              inputMode="numeric"
              value={formState.apDays}
              onChange={(event) =>
                setFormState((current) => ({ ...current, apDays: formatGroupedIntegerField(event.target.value) }))
              }
              onBlur={normalizeEditableFields}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900"
              placeholder="30"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-semibold text-slate-800">Fasta kostnader / månad (SEK)</span>
            <p className="text-xs text-slate-500">Exempel: lön, hyra, administration.</p>
            <input
              inputMode="numeric"
              value={formState.fixedCostsMonthly}
              onChange={(event) =>
                setFormState((current) => ({
                  ...current,
                  fixedCostsMonthly: formatGroupedIntegerField(event.target.value)
                }))
              }
              onBlur={normalizeEditableFields}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900"
              placeholder="1 850 000"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-semibold text-slate-800">Försäljningstrend (% / månad)</span>
            <p className="text-xs text-slate-500">Positivt värde stärker kassaflödet, negativt pressar.</p>
            <input
              inputMode="decimal"
              value={formState.monthlyTrendPct}
              onChange={(event) =>
                setFormState((current) => ({ ...current, monthlyTrendPct: formatTrendField(event.target.value) }))
              }
              onBlur={normalizeEditableFields}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900"
              placeholder="0,0"
            />
          </label>

          <label className="space-y-1 text-sm sm:col-span-2">
            <span className="font-semibold text-slate-800">Kassabuffert (SEK)</span>
            <p className="text-xs text-slate-500">Likvida medel som redan finns tillgängliga.</p>
            <input
              inputMode="numeric"
              value={formState.cashBuffer}
              onChange={(event) =>
                setFormState((current) => ({ ...current, cashBuffer: formatGroupedIntegerField(event.target.value) }))
              }
              onBlur={normalizeEditableFields}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900"
              placeholder="1 500 000"
            />
          </label>

          <label className="space-y-1 text-sm sm:col-span-2">
            <span className="font-semibold text-slate-800">Kreditram (SEK)</span>
            <p className="text-xs text-slate-500">Täckning av tillfälliga underskott efter rörelsekapitalpåverkan.</p>
            <input
              inputMode="numeric"
              value={formState.creditLine}
              onChange={(event) =>
                setFormState((current) => ({ ...current, creditLine: formatGroupedIntegerField(event.target.value) }))
              }
              onBlur={normalizeEditableFields}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900"
              placeholder="1 000 000"
            />
          </label>
        </div>
      </article>

      <article className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">Kassaväder</p>
            <h2 className="mt-1 font-heading text-3xl font-bold text-slate-900">Prognos 30 / 60 / 90 dagar</h2>
          </div>
          <span
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-semibold ${summaryTone.card} ${summaryTone.text}`}
          >
            <span>{summaryTone.label}</span>
          </span>
        </header>

        <div className="grid gap-3 md:grid-cols-3">
          {result.points.map((point) => {
            const tone = weatherTone(point.weather);
            return (
              <article key={point.horizonDays} className={`rounded-xl border p-3 ${tone.card}`}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">{point.horizonDays} dagar</p>
                  <p className={`text-sm font-semibold ${tone.text}`}>{tone.label}</p>
                </div>
                <p className="mt-2 text-xs text-slate-600">Riskscore</p>
                <p className="text-xl font-semibold text-slate-900">{point.riskScore}/100</p>
                <p className="mt-2 text-xs text-slate-600">Kassaeffekt</p>
                <p className="text-base font-semibold text-slate-900">{formatSek(point.netCash)}</p>
                <p className="mt-1 text-xs text-slate-600">Kassamarginal: {formatPercent(point.netCashMarginPct)}</p>
                <p className="mt-1 text-xs text-slate-600">Kreditutnyttjande: {formatSek(point.creditUsed)}</p>
                {point.uncoveredDeficit > 0 ? (
                  <p className="mt-1 text-xs font-semibold text-red-700">Ofinansierat gap: {formatSek(point.uncoveredDeficit)}</p>
                ) : null}
              </article>
            );
          })}
        </div>

        <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-700">Nyckeltal</h3>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-600">Bruttovinst / månad</dt>
              <dd className="font-semibold text-slate-900">{formatSek(result.grossProfitMonthly)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-600">COGS / månad</dt>
              <dd className="font-semibold text-slate-900">{formatSek(result.cogsMonthly)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-600">Kundfordringar (nu)</dt>
              <dd className="font-semibold text-slate-900">{formatSek(result.arBalanceNow)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-600">Leverantörsskulder (nu)</dt>
              <dd className="font-semibold text-slate-900">{formatSek(result.apBalanceNow)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-600">Nettorörelsekapital (nu)</dt>
              <dd className="font-semibold text-slate-900">{formatSek(result.netWorkingCapitalNow)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-600">Frigörbar AR-potential</dt>
              <dd className="font-semibold text-emerald-700">{formatSek(result.arReleasePotential)}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-slate-500">
            Formel lagerdagar: <span className="font-semibold">(Lagerestimat / COGS) × 30</span>. Formeln återanvänder samma lagerdefinition som övriga analytics-vyer.
          </p>
        </article>

        <article className="rounded-xl border border-slate-200 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-700">Kassabrygga 90 dagar</h3>
          <p className="mt-1 text-xs text-slate-500">Visar vilka delar som driver kassaeffekten i 90-dagarsläget.</p>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-600">Driftskassa före rörelsekapital</dt>
              <dd className="font-semibold text-slate-900">{formatSignedSek(day90.operatingCashBeforeWorkingCapital)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-600">Δ Kundfordringar</dt>
              <dd className={day90.deltaArBalance >= 0 ? "font-semibold text-red-700" : "font-semibold text-emerald-700"}>
                {formatSignedSek(day90.deltaArBalance)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-600">Δ Lager</dt>
              <dd className={day90.deltaInventoryCost >= 0 ? "font-semibold text-red-700" : "font-semibold text-emerald-700"}>
                {formatSignedSek(day90.deltaInventoryCost)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-600">Δ Leverantörsskulder</dt>
              <dd className={day90.deltaApBalance >= 0 ? "font-semibold text-emerald-700" : "font-semibold text-red-700"}>
                {formatSignedSek(day90.deltaApBalance)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-2">
              <dt className="text-slate-700">Kassa före finansiering</dt>
              <dd className={day90.netCashBeforeFunding >= 0 ? "font-semibold text-emerald-700" : "font-semibold text-red-700"}>
                {formatSignedSek(day90.netCashBeforeFunding)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-600">Kreditutnyttjande</dt>
              <dd className="font-semibold text-slate-900">{formatSignedSek(day90.creditUsed)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-600">Kassa efter finansiering</dt>
              <dd className={day90.netCash >= 0 ? "font-semibold text-emerald-700" : "font-semibold text-red-700"}>
                {formatSignedSek(day90.netCash)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-600">Ofinansierat gap</dt>
              <dd className={day90.uncoveredDeficit > 0 ? "font-semibold text-red-700" : "font-semibold text-slate-900"}>
                {formatSek(day90.uncoveredDeficit)}
              </dd>
            </div>
          </dl>
        </article>

        <article className="rounded-xl border border-slate-200 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-700">Rekommenderade nästa steg</h3>
          <ul className="mt-2 space-y-2 text-sm text-slate-700">
            {result.recommendations.map((item) => (
              <li key={item.id} className="rounded-lg bg-slate-50 px-3 py-2">
                <p className="font-semibold text-slate-900">{item.title}</p>
                <p className="mt-1">{item.detail}</p>
              </li>
            ))}
          </ul>
        </article>
      </article>
    </div>
  );
}
