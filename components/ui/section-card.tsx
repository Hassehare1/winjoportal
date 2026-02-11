import Link from "next/link";

type SectionCardProps = {
  href: string;
  title: string;
  description: string;
  status: string;
};

export function SectionCard({ href, title, description, status }: SectionCardProps) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-card transition hover:-translate-y-0.5 hover:border-sky-300"
    >
      <p className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-700">
        {status}
      </p>
      <h2 className="mt-4 font-heading text-2xl font-bold text-slate-900">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">{description}</p>
      <p className="mt-4 text-sm font-semibold text-sky-700 transition group-hover:text-sky-800">Öppna modul</p>
    </Link>
  );
}
