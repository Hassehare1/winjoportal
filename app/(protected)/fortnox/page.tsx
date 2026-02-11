import { requiresFortnoxStepUpAuth } from "@/features/fortnox/server/access";

export default function FortnoxPage() {
  const stepUpReady = requiresFortnoxStepUpAuth();

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-card">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-sky-700">Fortnox</p>
      <h1 className="mt-2 font-heading text-3xl font-bold text-slate-900">
        Placeholder för integration
      </h1>
      <p className="mt-4 max-w-2xl text-slate-600">
        Route-strukturen är separerad för att kunna lägga till extra inloggning (step-up auth) för Fortnox i
        nästa steg.
      </p>
      <p className="mt-6 inline-flex rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700">
        Step-up auth aktiv: {stepUpReady ? "Ja" : "Nej (placeholder)"}
      </p>
    </section>
  );
}
