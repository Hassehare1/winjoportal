import { SectionCard } from "@/components/ui/section-card";

export default function DashboardPage() {
  return (
    <section className="space-y-8">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-sky-700">
          Dashboard
        </p>
        <h1 className="mt-2 font-heading text-4xl font-bold text-slate-900">
          Välkommen till Client Portal
        </h1>
        <p className="mt-3 max-w-2xl text-slate-600">
          Portalens struktur är modulär så att nya appar kan läggas till utan att påverka hela systemet.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SectionCard
          href="/apps/games"
          title="Spel"
          description="Placeholder för spelmodul."
          status="Coming soon"
        />
        <SectionCard
          href="/apps/prompt-optimizer"
          title="Promptoptimerare"
          description="MVP som bygger en förbättrad prompt."
          status="Klar"
        />
        <SectionCard
          href="/fortnox"
          title="Fortnox"
          description="Förberedd för separat skyddad access."
          status="Placeholder"
        />
        <SectionCard
          href="/about"
          title="About / Kontakt"
          description="Enkel informations- och kontaktsida."
          status="Klar"
        />
      </div>
    </section>
  );
}
