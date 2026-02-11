import { NavLinks } from "@/components/ui/nav-links";
import { LogoutButton } from "@/components/ui/logout-button";

export function PortalShell({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">Client Portal</p>
            <p className="font-heading text-lg font-bold text-slate-900">
              Leveransyta för uppdragsgivare
            </p>
          </div>
          <LogoutButton />
        </div>
        <nav className="mx-auto w-full max-w-7xl px-6 pb-4" aria-label="Huvudnavigering">
          <NavLinks />
        </nav>
      </header>

      <main className="mx-auto w-full max-w-7xl px-6 py-10">{children}</main>
    </div>
  );
}
