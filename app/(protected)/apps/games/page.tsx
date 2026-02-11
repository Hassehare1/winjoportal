import { SpaceInvadersGame } from "@/features/games/components/space-invaders-game";

export default function GamesPage() {
  return (
    <section className="space-y-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-sky-700">Spel</p>
        <h1 className="mt-2 font-heading text-3xl font-bold text-slate-900">Winjo Invaders</h1>
        <p className="mt-3 max-w-2xl text-slate-600">
          Ett snabbt arkadspel i Space-Invaders-stil. Ditt skepp ar format som ett W.
        </p>
      </header>
      <SpaceInvadersGame />
    </section>
  );
}
