import { ProfitabilityCheckForm } from "@/features/profitability-check/components/profitability-check-form";

export default function ProfitabilityCheckPage() {
  return (
    <section className="space-y-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-sky-700">
          Lonsamhetskollen
        </p>
        <h1 className="mt-2 font-heading text-3xl font-bold text-slate-900">
          Riskscore och atgardsplan pa 2 minuter
        </h1>
        <p className="mt-3 max-w-3xl text-slate-600">
          Ett kundnara analysverktyg for ekonomikonsultation. Rule engine raknar riskscore och potential, AI
          prioriterar forbattringsatgarder for att skapa en konkret plan som leder till bokningsbara uppdrag.
        </p>
      </header>

      <ProfitabilityCheckForm />
    </section>
  );
}
