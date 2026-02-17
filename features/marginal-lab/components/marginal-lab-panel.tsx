"use client";

import { useMemo, useState } from "react";
import type { MarginalLabInputs } from "@/features/marginal-lab/lib/model";
import { runMarginalLabScenario } from "@/features/marginal-lab/lib/model";

type MarginalLabPanelProps = {
  selectedMonth: string | null;
  defaults: MarginalLabInputs;
};

type FormState = {
  netSales: string;
  marginPct: string;
  discountPct: string;
  returnRatePct: string;
  mixLiftPctPoints: string;
  stockDaysNow: string;
  targetStockDays: string;
  stockCostNow: string;
};

type FieldMeta = {
  key: keyof FormState;
  label: string;
  step?: string;
  helper: string;
};

const FIELD_META: FieldMeta[] = [
  { key: "netSales", label: "Nettoforsaljning (SEK/man)", step: "1", helper: "Baslinje for manaden." },
  { key: "marginPct", label: "TB % (nu)", step: "0.1", helper: "Nuvarande bruttomarginal i procent." },
  { key: "discountPct", label: "Rabatt %", step: "0.1", helper: "Antagen snittrabatt i scenario." },
  { key: "returnRatePct", label: "Returgrad %", step: "0.1", helper: "Andel returer av salj i scenario." },
  { key: "mixLiftPctPoints", label: "Mix-/prislyft i TB %-enheter", step: "0.1", helper: "Positivt lyfter TB%, negativt pressar." },
  { key: "stockDaysNow", label: "Lagerdagar (nu)", step: "1", helper: "Nuvarande omsattningshastighet i dagar." },
  { key: "targetStockDays", label: "Mallagerdagar", step: "1", helper: "Onskad lagerniva i dagar." },
  { key: "stockCostNow", label: "Lagerestimat (kostnad)", step: "1", helper: "Kostnadsvarde pa lagret i nulaget." }
];

function formatInputNumber(value: number, decimals: number): string {
  if (!Number.isFinite(value)) return "0";
  const rounded = value.toFixed(decimals);
  if (!rounded.includes(".")) return rounded;
  return rounded.replace(/\.?0+$/, "");
}

function parseInputNumber(value: string, fallback: number): number {
  const trimmed = value.trim();
  if (trimmed.length === 0) return fallback;
  const normalized = trimmed.replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toInitialForm(defaults: MarginalLabInputs): FormState {
  return {
    netSales: formatInputNumber(defaults.netSales, 0),
    marginPct: formatInputNumber(defaults.marginPct, 1),
    discountPct: formatInputNumber(defaults.discountPct, 1),
    returnRatePct: formatInputNumber(defaults.returnRatePct, 1),
    mixLiftPctPoints: formatInputNumber(defaults.mixLiftPctPoints, 1),
    stockDaysNow: formatInputNumber(defaults.stockDaysNow, 0),
    targetStockDays: formatInputNumber(defaults.targetStockDays, 0),
    stockCostNow: formatInputNumber(defaults.stockCostNow, 0)
  };
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("sv-SE", {
    maximumFractionDigits: 0
  }).format(value);
}

function formatSignedMoney(value: number): string {
  const sign = value >= 0 ? "+" : "-";
  return `${sign}${formatMoney(Math.abs(value))}`;
}

function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

function formatSignedPercent(value: number): string {
  const sign = value >= 0 ? "+" : "-";
  return `${sign}${Math.abs(value).toFixed(2)}%`;
}

export function MarginalLabPanel({ selectedMonth, defaults }: MarginalLabPanelProps) {
  const [form, setForm] = useState<FormState>(() => toInitialForm(defaults));

  const scenario = useMemo(() => {
    return runMarginalLabScenario({
      netSales: parseInputNumber(form.netSales, defaults.netSales),
      marginPct: parseInputNumber(form.marginPct, defaults.marginPct),
      discountPct: parseInputNumber(form.discountPct, defaults.discountPct),
      returnRatePct: parseInputNumber(form.returnRatePct, defaults.returnRatePct),
      mixLiftPctPoints: parseInputNumber(form.mixLiftPctPoints, defaults.mixLiftPctPoints),
      stockDaysNow: parseInputNumber(form.stockDaysNow, defaults.stockDaysNow),
      targetStockDays: parseInputNumber(form.targetStockDays, defaults.targetStockDays),
      stockCostNow: parseInputNumber(form.stockCostNow, defaults.stockCostNow)
    });
  }, [defaults, form]);

  const deltaClass =
    scenario.monthlyGrossProfitDelta > 0 ? "text-emerald-700" : scenario.monthlyGrossProfitDelta < 0 ? "text-rose-700" : "text-slate-900";

  const scoreClass = scenario.healthScore >= 75 ? "text-emerald-700" : scenario.healthScore >= 55 ? "text-amber-700" : "text-rose-700";

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
        <article className="rounded-xl border border-sky-200 bg-sky-50 p-4">
          <h2 className="font-heading text-2xl font-semibold text-slate-900">Sa anvander du Marginal-Labbet</h2>
          <ol className="mt-3 space-y-1.5 text-slate-700">
            <li>1. Ange nulage for forsaljning, TB%, rabatter, returgrad och lagerdagar.</li>
            <li>2. Justera antaganden for mix/pris och onskat mal for lagerdagar.</li>
            <li>3. Jamfor direkt hur bruttovinst, kapitalbindning och kassaflode paverkas.</li>
          </ol>
          <p className="mt-3 text-sm text-slate-600">
            Data period: <span className="font-semibold text-slate-900">{selectedMonth ?? "-"}</span>. Resultatet ar en scenarioeffekt per manad, inte bokfort utfall.
          </p>
        </article>

        <div className="grid gap-3 md:grid-cols-2">
          {FIELD_META.map((field) => (
            <label key={field.key} className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">{field.label}</span>
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                type="text"
                inputMode="decimal"
                value={form[field.key]}
                onChange={(event) => {
                  const next = event.target.value;
                  setForm((prev) => ({ ...prev, [field.key]: next }));
                }}
                onBlur={() => {
                  setForm((prev) => {
                    const nextValue = parseInputNumber(prev[field.key], defaults[field.key as keyof MarginalLabInputs]);
                    const decimals = field.key === "netSales" || field.key === "stockCostNow" || field.key.includes("Days") ? 0 : 1;
                    return { ...prev, [field.key]: formatInputNumber(nextValue, decimals) };
                  });
                }}
              />
              <p className="text-xs text-slate-500">{field.helper}</p>
            </label>
          ))}
        </div>
      </div>

      <aside className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">Scenarioresultat</p>
            <h2 className="mt-1 font-heading text-3xl font-semibold text-slate-900">Effekt i vald mix</h2>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Health score</p>
            <p className={`text-3xl font-bold ${scoreClass}`}>{scenario.healthScore}/100</p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <article className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Justerad nettoforsaljning</p>
            <p className="mt-1 text-3xl font-semibold text-slate-900">{formatMoney(scenario.adjustedNetSales)}</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Justerad bruttovinst</p>
            <p className="mt-1 text-3xl font-semibold text-slate-900">{formatMoney(scenario.adjustedGrossProfit)}</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs text-slate-500">TB % efter scenario</p>
            <p className="mt-1 text-3xl font-semibold text-slate-900">{formatPercent(scenario.adjustedMarginPct)}</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Lagerestimat (kostnad)</p>
            <p className="mt-1 text-3xl font-semibold text-slate-900">{formatMoney(scenario.scenarioStockCost)}</p>
          </article>
        </div>

        <article className="rounded-xl border border-slate-200 bg-white">
          <div className="grid grid-cols-[1fr_auto] gap-2 border-b border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
            <p>Nyckeltal</p>
            <p>Varde</p>
          </div>
          <dl className="divide-y divide-slate-100 text-sm">
            <div className="grid grid-cols-[1fr_auto] gap-2 px-4 py-2">
              <dt className="text-slate-700">Manadsforandring bruttovinst</dt>
              <dd className={`font-semibold ${deltaClass}`}>
                {formatSignedMoney(scenario.monthlyGrossProfitDelta)} ({formatSignedPercent(scenario.monthlyGrossProfitDeltaPct)})
              </dd>
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-2 px-4 py-2">
              <dt className="text-slate-700">COGS i scenario</dt>
              <dd className="font-semibold text-slate-900">{formatMoney(scenario.scenarioCogs)}</dd>
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-2 px-4 py-2">
              <dt className="text-slate-700">Frigjort kassaflode via lagerdagar</dt>
              <dd className="font-semibold text-emerald-700">{formatMoney(scenario.releasedCash)}</dd>
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-2 px-4 py-2">
              <dt className="text-slate-700">Okat kapitalbehov</dt>
              <dd className="font-semibold text-rose-700">{formatMoney(scenario.additionalCashNeed)}</dd>
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-2 px-4 py-2">
              <dt className="text-slate-700">Marginal pa lager (scenario)</dt>
              <dd className="font-semibold text-slate-900">{formatMoney(scenario.scenarioStockMarginValue)}</dd>
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-2 px-4 py-2">
              <dt className="text-slate-700">Marginal % pa lager (scenario)</dt>
              <dd className="font-semibold text-slate-900">{formatPercent(scenario.scenarioStockMarginPct)}</dd>
            </div>
          </dl>
        </article>

        <p className="text-sm text-slate-600">
          Formel frigjort kassaflode: <span className="font-semibold text-slate-900">max(0, Lagerestimat nu - ((COGS scenario / 30) x Mallagerdagar))</span>.
        </p>
      </aside>
    </div>
  );
}
