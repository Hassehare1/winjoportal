import { SectionCard } from "@/components/ui/section-card";
import { getBuildUpdatedLabel } from "@/features/meta/server/build-meta";

export default function DashboardPage() {
  const updatedAt = getBuildUpdatedLabel();

  return (
    <section className="space-y-8">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-sky-700">
          Dashboard
        </p>
        <h1 className="mt-2 font-heading text-4xl font-bold text-slate-900">Valkommen till Client Portal</h1>
        <p className="mt-3 max-w-2xl text-slate-600">
          Portalens struktur ar modular sa att nya appar kan laggas till utan att paverka hela systemet.
        </p>
        <p className="mt-3 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
          Senast uppdaterad: {updatedAt}
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <SectionCard
          href="/apps/lonsamhetskollen"
          title="Lonsamhetskollen"
          description="Interaktiv riskanalys som driver bokningar."
          status="Klar"
        />
        <SectionCard
          href="/apps/games"
          title="Spel"
          description="Winjo Invaders ar nu klar och spelbar."
          status="Klar"
        />
        <SectionCard
          href="/apps/prompt-optimizer"
          title="Promptoptimerare"
          description="MVP som bygger en forbattrad prompt."
          status="Klar"
        />
        <SectionCard
          href="/fortnox"
          title="Fortnox"
          description="Forberedd for separat skyddad access."
          status="Placeholder"
        />
        <SectionCard
          href="/about"
          title="About / Kontakt"
          description="Placeholder tills nasta version av infosidan ar klar."
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
      </div>
    </section>
  );
}
