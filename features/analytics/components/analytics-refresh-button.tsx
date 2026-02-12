"use client";

import { FormEvent, useState } from "react";

type RefreshApiResponse = {
  ok?: boolean;
  message?: string;
  error?: string;
  detail?: string;
};

export function AnalyticsRefreshButton() {
  const [adminKey, setAdminKey] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatusMessage(null);
    setStatusError(null);

    if (!adminKey.trim()) {
      setStatusError("Admin-nyckel saknas.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/analytics/refresh", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ adminKey: adminKey.trim() })
      });

      const payload = (await response.json().catch(() => ({}))) as RefreshApiResponse;
      if (!response.ok) {
        setStatusError(payload.error ?? "Kunde inte starta datahamtning.");
        return;
      }

      setStatusMessage(payload.message ?? "Datahamtning startad.");
      setAdminKey("");
    } catch {
      setStatusError("Natverksfel. Forsok igen.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-900">Datauppdatering</h2>
      <form onSubmit={handleSubmit} className="mt-3 flex flex-wrap items-end gap-3">
        <label htmlFor="analyticsAdminKey" className="space-y-1">
          <span className="block text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Admin-nyckel</span>
          <input
            id="analyticsAdminKey"
            type="password"
            value={adminKey}
            onChange={(event) => setAdminKey(event.target.value)}
            className="w-64 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
            autoComplete="off"
            placeholder="Ange admin-nyckel"
          />
        </label>
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center justify-center rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {isSubmitting ? "Startar..." : "Hamta data"}
        </button>
      </form>
      <p className="mt-2 text-xs text-slate-500">Endast admin far trycka pa Hamta data.</p>
      {statusMessage ? <p className="mt-2 text-sm text-emerald-700">{statusMessage}</p> : null}
      {statusError ? <p className="mt-2 text-sm text-red-600">{statusError}</p> : null}
    </article>
  );
}

