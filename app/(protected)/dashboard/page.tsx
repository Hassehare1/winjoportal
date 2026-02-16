import { SectionCard } from "@/components/ui/section-card";
import { getBuildUpdatedLabel } from "@/features/meta/server/build-meta";

export default function DashboardPage() {
  const updatedAt = getBuildUpdatedLabel();

  return (
    <section className="space-y-8">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-sky-700">Dashboard</p>
        <h1 className="mt-2 font-heading text-4xl font-bold text-slate-900">Välkommen till Client Portal</h1>
        <p className="mt-3 max-w-2xl text-slate-600">
          Portalens struktur är modulär så att nya appar kan läggas till utan att påverka hela systemet.
        </p>
        <p className="mt-3 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
          Senast uppdaterad: {updatedAt}
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <SectionCard
          href="/apps/lonsamhetskollen"
          title="Lönsamhetskollen"
          description="Interaktiv riskanalys som driver bokningar."
          status="Klar"
        />
        <SectionCard href="/apps/games" title="Spel" description="Winjo Invaders är nu klar och spelbar." status="Klar" />
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
          description="Placeholder tills nästa version av infosidan är klar."
          status="Placeholder"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <SectionCard
          href="/apps/analytics"
          title="Analytics"
          description="Intern KPI-preview med snabb filtrering per avdelning."
          status="Klar"
        />
        <SectionCard
          href="/apps/riskradar-360"
          title="Riskradar 360"
          description="Visuell riskkarta för butik x avdelning med prioriterad åtgärdslista."
          status="Ny"
        />
      </div>
    </section>
  );
}
