"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
};

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/apps/analytics", label: "Analytics" },
  { href: "/apps/riskradar-360", label: "Riskradar 360" },
  { href: "/apps/marginal-lab", label: "Marginal-Labbet" },
  { href: "/apps/cashflow-weather", label: "Cashflow Weather" },
  { href: "/apps/forhandlingscoachen", label: "Förhandlingscoachen" },
  { href: "/apps/lonsamhetskollen", label: "Lönsamhetskollen" },
  { href: "/apps/games", label: "Spel" },
  { href: "/apps/prompt-optimizer", label: "Promptoptimerare" },
  { href: "/fortnox", label: "Fortnox" },
  { href: "/about", label: "About" }
];

function isActivePath(currentPath: string, href: string) {
  return currentPath === href || currentPath.startsWith(`${href}/`);
}

export function NavLinks() {
  const pathname = usePathname();

  return (
    <ul className="flex flex-wrap items-center gap-2">
      {navItems.map((item) => {
        const active = isActivePath(pathname, item.href);

        return (
          <li key={item.href}>
            <Link
              href={item.href}
              className={`inline-flex rounded-lg px-3 py-2 text-sm font-medium transition ${
                active ? "bg-sky-100 text-sky-800" : "text-slate-700 hover:bg-slate-100"
              }`}
              aria-current={active ? "page" : undefined}
            >
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

