"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  buildImprovedPrompt,
  validatePromptOptimizerInput
} from "@/features/prompt-optimizer/lib/build-improved-prompt";
import {
  PromptOptimizerInput,
  PromptOptimizerMode,
  PromptOptimizerRequest
} from "@/features/prompt-optimizer/types";

const initialState: PromptOptimizerInput = {
  goal: "",
  context: "",
  input: "",
  constraints: "",
  tone: ""
};

type FieldProps = {
  id: keyof PromptOptimizerInput;
  label: string;
  placeholder: string;
  rows?: number;
  value: string;
  onChange: (next: string) => void;
};

function TextField({ id, label, placeholder, rows = 3, value, onChange }: FieldProps) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-semibold text-slate-800">
        {label}
      </label>
      <textarea
        id={id}
        name={id}
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
      />
    </div>
  );
}

type ApiResponse = {
  prompt?: string;
  error?: string;
};

export function PromptOptimizerForm() {
  const [formData, setFormData] = useState<PromptOptimizerInput>(initialState);
  const [mode, setMode] = useState<PromptOptimizerMode>("balanced");
  const [result, setResult] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const [pending, setPending] = useState(false);
  const [generatedBy, setGeneratedBy] = useState<"openai" | "fallback" | null>(null);

  const fields = useMemo(
    () => [
      {
        id: "goal" as const,
        label: "Mal",
        placeholder: "Vad vill du uppna med prompten?",
        rows: 2
      },
      {
        id: "context" as const,
        label: "Kontekst",
        placeholder: "Beskriv bakgrund, malgrupp och situation.",
        rows: 3
      },
      {
        id: "input" as const,
        label: "Input",
        placeholder: "Klistra in ra text, data eller user message har.",
        rows: 4
      },
      {
        id: "constraints" as const,
        label: "Begransningar",
        placeholder: "T.ex. maxlangd, forbjudna ord, formatkrav.",
        rows: 3
      },
      {
        id: "tone" as const,
        label: "Ton",
        placeholder: "T.ex. professionell, vanlig, teknisk.",
        rows: 2
      }
    ],
    []
  );

  function updateField(field: keyof PromptOptimizerInput, value: string) {
    setFormData((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setCopyStatus("idle");

    const validation = validatePromptOptimizerInput(formData);
    if (!validation.valid) {
      setError(validation.error ?? "Ogiltig input.");
      return;
    }

    const payload: PromptOptimizerRequest = {
      ...formData,
      mode
    };

    setPending(true);
    try {
      const response = await fetch("/api/prompt-optimizer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const responseBody = (await response.json().catch(() => ({}))) as ApiResponse;
      if (!response.ok) {
        throw new Error(responseBody.error || "Generering misslyckades.");
      }

      if (!responseBody.prompt) {
        throw new Error("Tomt svar fran servern.");
      }

      setResult(responseBody.prompt);
      setGeneratedBy("openai");
    } catch (submitError) {
      const fallbackPrompt = buildImprovedPrompt(formData);
      const message = submitError instanceof Error ? submitError.message : "Okant fel.";
      setResult(fallbackPrompt);
      setGeneratedBy("fallback");
      setError(`${message} Fallback anvandes lokalt.`);
    } finally {
      setPending(false);
    }
  }

  async function handleCopy() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-card"
        noValidate
      >
        <div className="space-y-2">
          <label htmlFor="mode" className="block text-sm font-semibold text-slate-800">
            Genereringslage
          </label>
          <select
            id="mode"
            name="mode"
            value={mode}
            onChange={(event) => setMode(event.target.value as PromptOptimizerMode)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
          >
            <option value="compact">Kompakt</option>
            <option value="balanced">Balanserad</option>
            <option value="advanced">Avancerad</option>
          </select>
        </div>

        {fields.map((field) => (
          <TextField
            key={field.id}
            id={field.id}
            label={field.label}
            placeholder={field.placeholder}
            rows={field.rows}
            value={formData[field.id]}
            onChange={(value) => updateField(field.id, value)}
          />
        ))}

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
          {pending ? "Genererar..." : "Generera forbattrad prompt"}
        </button>
      </form>

      <aside className="rounded-2xl border border-slate-200 bg-slate-950 p-6 shadow-card">
        <div className="flex items-start justify-between gap-4">
          <h2 className="font-heading text-xl font-bold text-white">Resultat</h2>
          <button
            type="button"
            onClick={handleCopy}
            disabled={!result}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-100 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Kopiera
          </button>
        </div>

        <p className="mt-2 text-xs text-slate-400">
          {copyStatus === "copied"
            ? "Kopierad."
            : copyStatus === "failed"
              ? "Kopiering misslyckades."
              : "Genererad prompt visas har."}
        </p>

        {generatedBy ? (
          <p className="mt-2 text-xs text-slate-400" role="status">
            Kalla: {generatedBy === "openai" ? "OpenAI" : "Lokal fallback"}
          </p>
        ) : null}

        <pre className="mt-4 max-h-[28rem] overflow-auto rounded-xl border border-slate-800 bg-slate-900 p-4 text-xs leading-relaxed text-slate-100">
          <code>{result || "Ingen prompt genererad an."}</code>
        </pre>
      </aside>
    </div>
  );
}
