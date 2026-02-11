"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  Bottleneck,
  BusinessModel,
  ImprovementAction
} from "@/features/profitability-check/types";

type FormState = {
  industry: string;
  businessModel: BusinessModel;
  annualRevenueSek: string;
  grossMarginPercent: string;
  payrollCostSek: string;
  fixedCostsSek: string;
  arDays: string;
  inventoryDays: string;
  topCustomerSharePercent: string;
  target12m: string;
  bottleneck: Bottleneck;
};

type AnalysisResponse = {
  riskScore: number;
  riskLevel: "Low" | "Medium" | "High";
  riskDrivers: Array<{
    id: string;
    label: string;
    points: number;
    detail: string;
  }>;
  operatingMarginPercent: number;
  cashConversionDays: number;
  potentialRangeSek: {
    min: number;
    max: number;
    midpoint: number;
  };
  summary: string;
  actions: ImprovementAction[];
  source: "openai" | "rules";
  error?: string;
};

const initialFormState: FormState = {
  industry: "",
  businessModel: "consulting",
  annualRevenueSek: "",
  grossMarginPercent: "",
  payrollCostSek: "",
  fixedCostsSek: "",
  arDays: "",
  inventoryDays: "0",
  topCustomerSharePercent: "",
  target12m: "",
  bottleneck: "pricing"
};

function toNumber(value: string) {
  const parsed = Number.parseFloat(value.replace(",", "."));
  if (!Number.isFinite(parsed)) return 0;
  return parsed;
}

function formatSek(value: number) {
  return new Intl.NumberFormat("sv-SE", {
    style: "currency",
    currency: "SEK",
    maximumFractionDigits: 0
  }).format(value);
}

function riskTone(score: number) {
  if (score >= 70) {
    return "bg-red-500";
  }
  if (score >= 40) {
    return "bg-amber-500";
  }
  return "bg-emerald-500";
}

export function ProfitabilityCheckForm() {
  const [formData, setFormData] = useState<FormState>(initialFormState);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResponse | null>(null);

  const businessModelOptions = useMemo(
    () => [
      { value: "consulting", label: "Konsult / tjanster" },
      { value: "retail", label: "Retail / handel" },
      { value: "subscription", label: "Abonnemang / SaaS" },
      { value: "project", label: "Projektbaserad verksamhet" },
      { value: "manufacturing", label: "Produktion / tillverkning" }
    ] satisfies Array<{ value: BusinessModel; label: string }>,
    []
  );

  const bottleneckOptions = useMemo(
    () => [
      { value: "pricing", label: "Prissattning / marginal" },
      { value: "utilization", label: "Belaggning / kapacitetsutnyttjande" },
      { value: "cashflow", label: "Kassaflode / kapitalbindning" },
      { value: "overhead", label: "Overhead / fasta kostnader" },
      { value: "sales", label: "Nyforsaljning / kundmix" }
    ] satisfies Array<{ value: Bottleneck; label: string }>,
    []
  );

  function updateField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setFormData((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      const payload = {
        industry: formData.industry,
        businessModel: formData.businessModel,
        annualRevenueSek: toNumber(formData.annualRevenueSek),
        grossMarginPercent: toNumber(formData.grossMarginPercent),
        payrollCostSek: toNumber(formData.payrollCostSek),
        fixedCostsSek: toNumber(formData.fixedCostsSek),
        arDays: toNumber(formData.arDays),
        inventoryDays: toNumber(formData.inventoryDays),
        topCustomerSharePercent: toNumber(formData.topCustomerSharePercent),
        target12m: formData.target12m,
        bottleneck: formData.bottleneck
      };

      const response = await fetch("/api/profitability-check", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const responseBody = (await response.json().catch(() => ({}))) as AnalysisResponse;
      if (!response.ok) {
        throw new Error(responseBody.error || "Analysen misslyckades.");
      }

      setResult(responseBody);
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Okant fel.";
      setError(message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-card"
        noValidate
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="industry" className="block text-sm font-semibold text-slate-800">
              Bransch
            </label>
            <input
              id="industry"
              name="industry"
              value={formData.industry}
              onChange={(event) => updateField("industry", event.target.value)}
              placeholder="Ex: Grossist, bygg, SaaS, konsult"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="businessModel" className="block text-sm font-semibold text-slate-800">
              Affarsmodell
            </label>
            <select
              id="businessModel"
              name="businessModel"
              value={formData.businessModel}
              onChange={(event) => updateField("businessModel", event.target.value as BusinessModel)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            >
              {businessModelOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="annualRevenueSek" className="block text-sm font-semibold text-slate-800">
              Omsattning (SEK / ar)
            </label>
            <input
              id="annualRevenueSek"
              name="annualRevenueSek"
              inputMode="numeric"
              value={formData.annualRevenueSek}
              onChange={(event) => updateField("annualRevenueSek", event.target.value)}
              placeholder="15000000"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="grossMarginPercent" className="block text-sm font-semibold text-slate-800">
              Bruttomarginal (%)
            </label>
            <input
              id="grossMarginPercent"
              name="grossMarginPercent"
              inputMode="decimal"
              value={formData.grossMarginPercent}
              onChange={(event) => updateField("grossMarginPercent", event.target.value)}
              placeholder="34"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="payrollCostSek" className="block text-sm font-semibold text-slate-800">
              Personalkostnad (SEK / ar)
            </label>
            <input
              id="payrollCostSek"
              name="payrollCostSek"
              inputMode="numeric"
              value={formData.payrollCostSek}
              onChange={(event) => updateField("payrollCostSek", event.target.value)}
              placeholder="4200000"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="fixedCostsSek" className="block text-sm font-semibold text-slate-800">
              Fasta kostnader (SEK / ar)
            </label>
            <input
              id="fixedCostsSek"
              name="fixedCostsSek"
              inputMode="numeric"
              value={formData.fixedCostsSek}
              onChange={(event) => updateField("fixedCostsSek", event.target.value)}
              placeholder="1800000"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="arDays" className="block text-sm font-semibold text-slate-800">
              Kundfordringar (dagar)
            </label>
            <input
              id="arDays"
              name="arDays"
              inputMode="decimal"
              value={formData.arDays}
              onChange={(event) => updateField("arDays", event.target.value)}
              placeholder="52"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="inventoryDays" className="block text-sm font-semibold text-slate-800">
              Lagerdagar
            </label>
            <input
              id="inventoryDays"
              name="inventoryDays"
              inputMode="decimal"
              value={formData.inventoryDays}
              onChange={(event) => updateField("inventoryDays", event.target.value)}
              placeholder="0"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="topCustomerSharePercent" className="block text-sm font-semibold text-slate-800">
              Storsta kund (% av oms)
            </label>
            <input
              id="topCustomerSharePercent"
              name="topCustomerSharePercent"
              inputMode="decimal"
              value={formData.topCustomerSharePercent}
              onChange={(event) => updateField("topCustomerSharePercent", event.target.value)}
              placeholder="28"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="bottleneck" className="block text-sm font-semibold text-slate-800">
            Storsta flaskhals idag
          </label>
          <select
            id="bottleneck"
            name="bottleneck"
            value={formData.bottleneck}
            onChange={(event) => updateField("bottleneck", event.target.value as Bottleneck)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
          >
            {bottleneckOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="target12m" className="block text-sm font-semibold text-slate-800">
            Mal kommande 12 manader
          </label>
          <textarea
            id="target12m"
            name="target12m"
            rows={3}
            value={formData.target12m}
            onChange={(event) => updateField("target12m", event.target.value)}
            placeholder="Ex: Oka EBIT till 12%, korta AR till 35 dagar och minska beroendet av toppkund."
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            required
          />
        </div>

        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center justify-center rounded-lg bg-sky-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {pending ? "Analyserar..." : "Kor lonsamhetskollen"}
        </button>
      </form>

      <aside className="rounded-2xl border border-slate-200 bg-slate-950 p-6 shadow-card">
        <h2 className="font-heading text-xl font-bold text-white">Resultat</h2>
        {!result ? (
          <p className="mt-3 text-sm text-slate-300">
            Fyll i data och kor analysen for att fa riskscore, effektestimat och tre rekommenderade atgarder.
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Riskscore</p>
                <p className="text-xs text-slate-400">Kalla: {result.source === "openai" ? "OpenAI" : "Rule engine"}</p>
              </div>
              <p className="mt-2 font-heading text-3xl font-bold text-white">{result.riskScore}/100</p>
              <div className="mt-3 h-2 rounded-full bg-slate-800">
                <div
                  className={`h-2 rounded-full transition-all ${riskTone(result.riskScore)}`}
                  style={{ width: `${result.riskScore}%` }}
                />
              </div>
              <p className="mt-2 text-sm text-slate-300">Riskniva: {result.riskLevel}</p>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <article className="rounded-lg border border-slate-800 bg-slate-900 p-3">
                <p className="text-xs text-slate-400">Potential 3-6 man</p>
                <p className="mt-1 text-sm font-semibold text-white">
                  {formatSek(result.potentialRangeSek.min)} - {formatSek(result.potentialRangeSek.max)}
                </p>
              </article>
              <article className="rounded-lg border border-slate-800 bg-slate-900 p-3">
                <p className="text-xs text-slate-400">Rorelsemarginal</p>
                <p className="mt-1 text-sm font-semibold text-white">{result.operatingMarginPercent}%</p>
              </article>
              <article className="rounded-lg border border-slate-800 bg-slate-900 p-3">
                <p className="text-xs text-slate-400">Kassacykel</p>
                <p className="mt-1 text-sm font-semibold text-white">{result.cashConversionDays} dagar</p>
              </article>
            </div>

            <p className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-200">
              {result.summary}
            </p>

            <div className="space-y-3">
              {result.actions.map((action, index) => (
                <article key={`${action.title}-${index}`} className="rounded-lg border border-slate-800 bg-slate-900 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-sm font-semibold text-white">{action.title}</h3>
                    <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[11px] font-semibold text-slate-300">
                      {action.priority}
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-slate-300">{action.why}</p>
                  <p className="mt-2 text-xs text-slate-400">
                    Forsta steg: <span className="text-slate-200">{action.firstStep}</span>
                  </p>
                  <p className="mt-2 text-xs font-medium text-sky-300">
                    Estimerad effekt: {formatSek(action.impactHintSek)}
                  </p>
                </article>
              ))}
            </div>

            <a
              href="mailto:hello@example.com?subject=Boka%2060%20min%20lonsamhetsgenomgang"
              className="inline-flex w-full items-center justify-center rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700"
            >
              Boka 60 min genomgang
            </a>
          </div>
        )}
      </aside>
    </div>
  );
}
