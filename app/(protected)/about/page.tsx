export default function AboutPage() {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-card">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-sky-700">About / Kontakt</p>
      <h1 className="mt-2 font-heading text-3xl font-bold text-slate-900">
        Om portalen
      </h1>
      <p className="mt-4 max-w-2xl text-slate-600">
        Den här portalen används som kundyta för leveranser och interna verktyg. Arkitekturen är byggd för
        snabb utbyggnad med separata feature-moduler.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h2 className="font-semibold text-slate-900">Kontakt</h2>
          <p className="mt-2 text-sm text-slate-700">Email: hello@example.com</p>
          <p className="text-sm text-slate-700">Telefon: +46 70 000 00 00</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h2 className="font-semibold text-slate-900">Version</h2>
          <p className="mt-2 text-sm text-slate-700">Client Portal v1 (MVP)</p>
          <p className="text-sm text-slate-700">Byggd med Next.js + TypeScript + Tailwind</p>
        </article>
      </div>
    </section>
  );
}
