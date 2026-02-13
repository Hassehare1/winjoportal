"use client";

import { FormEvent, useMemo, useState } from "react";

type AnalyticsAiAssistantProps = {
  selectedMonth: string | null;
};

type AssistantApiResponse = {
  answer?: string;
  error?: string;
  selectedMonth?: string;
  source?: "openai" | "rules";
};

export function AnalyticsAiAssistant({ selectedMonth }: AnalyticsAiAssistantProps) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [answeredMonth, setAnsweredMonth] = useState<string | null>(null);
  const [source, setSource] = useState<"openai" | "rules" | null>(null);

  const suggestions = useMemo(
    () => [
      "Vilken butik har hogst lagertackning i senaste perioden och varfor?",
      "Sammanfatta topp 3 risker i datan just nu.",
      "Vilka avdelningar har lagst TB % och hur stor ar nettoforaljningen dar?",
      "Finns negativ marginal i risklistan och vilka artiklar driver den?",
      "Vilken butik har hogst lagerestimat relativt sin forsaljning?",
      "Ge 3 konkreta atgarder for att minska lagerdagar utan att skada TB."
    ],
    []
  );

  async function ask(inputQuestion: string) {
    const trimmed = inputQuestion.trim();
    if (trimmed.length < 3) {
      setError("Skriv en lite langre fraga.");
      return;
    }

    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/analytics/assistant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          question: trimmed,
          month: selectedMonth || undefined
        })
      });

      const payload = (await response.json().catch(() => ({}))) as AssistantApiResponse;
      if (!response.ok) {
        throw new Error(payload.error || "Kunde inte hamta svar.");
      }

      setAnswer(payload.answer || "Inget svar mottogs.");
      setAnsweredMonth(payload.selectedMonth || selectedMonth);
      setSource(payload.source || null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Okant fel.");
    } finally {
      setPending(false);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await ask(question);
  }

  return (
    <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-sky-700">AI Assistent</p>
        <h2 className="font-heading text-xl font-bold text-slate-900">Fragor pa din KPI-data</h2>
        <p className="text-xs text-slate-600">
          Snabb modell, strikt datalage. Svarar endast utifran KPI-underlaget for vald period.
        </p>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {suggestions.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => {
              setQuestion(item);
              void ask(item);
            }}
            disabled={pending}
            className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1.5 text-left text-xs font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {item}
          </button>
        ))}
      </div>

      <form onSubmit={onSubmit} className="mt-4 space-y-2">
        <label htmlFor="analytics-ai-question" className="block text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
          Egen fraga
        </label>
        <textarea
          id="analytics-ai-question"
          rows={4}
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ex: Vilken avdelning bor jag agera pa forst denna manad?"
          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
        />
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center justify-center rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {pending ? "Analyserar..." : "Frag assistenten"}
        </button>
      </form>

      {error ? (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}

      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Svar</p>
        {answeredMonth ? <p className="mt-1 text-xs text-slate-500">Dataperiod: {answeredMonth}</p> : null}
        {source ? <p className="mt-1 text-xs text-slate-500">Kalla: {source === "openai" ? "OpenAI" : "Rule engine"}</p> : null}
        <pre className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-800">
          {answer || "Inget svar an. Klicka pa ett forslag eller skriv en egen fraga."}
        </pre>
      </div>
    </aside>
  );
}
