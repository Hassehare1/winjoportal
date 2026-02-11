import { PromptOptimizerForm } from "@/features/prompt-optimizer/components/prompt-optimizer-form";

export default function PromptOptimizerPage() {
  return (
    <section className="space-y-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-sky-700">
          Promptoptimerare
        </p>
        <h1 className="mt-2 font-heading text-3xl font-bold text-slate-900">
          Bygg en forbattrad prompt
        </h1>
        <p className="mt-3 max-w-2xl text-slate-600">
          OpenAI-driven promptoptimering med server-side API, validering och fallback for hog tillganglighet.
        </p>
      </header>
      <PromptOptimizerForm />
    </section>
  );
}
