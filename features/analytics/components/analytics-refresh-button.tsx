"use client";

import { FormEvent, useState } from "react";

type RefreshApiResponse = {
  ok?: boolean;
  message?: string;
  error?: string;
  detail?: string;
  actionsUrl?: string;
};

type AnalyticsRefreshButtonProps = {
  compact?: boolean;
};

export function AnalyticsRefreshButton({ compact = false }: AnalyticsRefreshButtonProps) {
  const [adminKey, setAdminKey] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [statusDetail, setStatusDetail] = useState<string | null>(null);
  const [actionsUrl, setActionsUrl] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatusMessage(null);
    setStatusError(null);
    setStatusDetail(null);
    setActionsUrl(null);

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
        setStatusError(payload.error ?? "Kunde inte starta datahämtning.");
        setStatusDetail(payload.detail ?? null);
        setActionsUrl(payload.actionsUrl ?? null);
        return;
      }

      setStatusMessage(payload.message ?? "Datahämtning startad. Det kan ta någon minut innan nya filer syns.");
      setActionsUrl(payload.actionsUrl ?? null);
      setAdminKey("");
    } catch {
      setStatusError("Nätverksfel. Försök igen.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <article className={compact ? "rounded-xl border border-slate-200 bg-white p-3" : "rounded-xl border border-slate-200 bg-white p-4"}>
      <div className="flex items-center justify-between gap-3">
        <h2 className={compact ? "text-xs font-semibold uppercase tracking-[0.08em] text-slate-700" : "text-sm font-semibold text-slate-900"}>
          Datauppdatering
        </h2>
        <details className="group">
          <summary className="cursor-pointer select-none rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100">
            Admin
          </summary>
          <form
            onSubmit={handleSubmit}
            className={
              compact
                ? "mt-2 flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2"
                : "mt-3 flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3"
            }
          >
            <label htmlFor="analyticsAdminKey" className="space-y-1">
              <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                Admin-nyckel
              </span>
              <input
                id="analyticsAdminKey"
                type="password"
                value={adminKey}
                onChange={(event) => setAdminKey(event.target.value)}
                className={compact ? "w-44 rounded-lg border border-slate-300 px-2.5 py-2 text-sm text-slate-900" : "w-56 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"}
                autoComplete="off"
                placeholder="Ange admin-nyckel"
              />
            </label>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center justify-center rounded-lg bg-sky-700 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {isSubmitting ? "Startar..." : "Hämta data"}
            </button>
          </form>
        </details>
      </div>

      <p className={compact ? "mt-1.5 text-[11px] text-slate-500" : "mt-2 text-xs text-slate-500"}>
        Admin-nyckeln triggar GitHub Actions-jobbet som uppdaterar analytics-filerna.
      </p>
      {statusMessage ? <p className="mt-2 text-sm text-emerald-700">{statusMessage}</p> : null}
      {statusError ? <p className="mt-2 text-sm text-red-600">{statusError}</p> : null}
      {statusDetail ? <p className="mt-2 break-words text-xs text-red-500">{statusDetail}</p> : null}
      {actionsUrl ? (
        <p className="mt-2 text-xs text-slate-600">
          Actions:{" "}
          <a href={actionsUrl} target="_blank" rel="noreferrer" className="font-semibold text-sky-700 underline">
            öppna workflow
          </a>
        </p>
      ) : null}
    </article>
  );
}
