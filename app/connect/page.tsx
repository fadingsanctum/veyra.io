import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { Emblem } from "@/components/emblem";
import { ArrowUpRight, Briefcase, Clapperboard, Code2, MonitorPlay, Music2, Palette } from "lucide-react";

export const metadata: Metadata = {
  title: "Connect",
  description: "GitHub, YouTube, Fiverr and more.",
};

const LINKS = [
  {
    icon: Code2,
    label: "GitHub",
    handle: "@fadingsanctum",
    href: "https://github.com/fadingsanctum",
    note: "Code, experiments, open work",
  },
  {
    icon: MonitorPlay,
    label: "YouTube",
    handle: "@soul_lifestyle0900",
    href: "https://youtube.com/@soul_lifestyle0900",
    note: "Main channel — lifestyle & edits",
  },
  {
    icon: Clapperboard,
    label: "YouTube · Luma Editz",
    handle: "@lumaeditz0",
    href: "https://youtube.com/@lumaeditz0",
    note: "Second channel — edits & motion",
  },
  {
    icon: Briefcase,
    label: "Fiverr",
    handle: "shaik_muzammil0",
    href: "https://www.fiverr.com/shaik_muzammil0",
    note: "Freelance services & commissions",
  },
  {
    icon: Palette,
    label: "Portfolio · Soullabs",
    handle: "soullabs-com.vercel.app",
    href: "https://soullabs-com.vercel.app/",
    note: "Other work and projects",
  },
];

export default function ConnectPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
      <PageHeader
        kicker="Creator"
        title="Connect"
        description="Find the same energy across the web."
      />

      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {LINKS.map((l) => (
          <a
            key={l.href}
            href={l.href}
            target="_blank"
            rel="noopener noreferrer"
            className="group rounded-xl border border-rust bg-panel/60 p-5 transition-all hover:border-ember/50 hover:shadow-ember"
          >
            <div className="flex items-start justify-between">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-rust bg-elevated text-bone transition-colors group-hover:text-ember">
                <l.icon size={18} aria-hidden="true" />
              </span>
              <ArrowUpRight
                size={16}
                className="text-dim transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-ember"
              />
            </div>
            <h3 className="mt-4 text-sm font-semibold text-bone">{l.label}</h3>
            <p className="font-mono mt-1 text-[11px] text-ember">{l.handle}</p>
            <p className="mt-2 text-xs text-dim">{l.note}</p>
          </a>
        ))}

        <div className="flex flex-col items-start justify-center rounded-xl border border-blood/40 bg-blood/10 p-5 sm:col-span-2">
          <div className="flex items-center gap-3">
            <span className="text-bone">
              <Emblem size={26} />
            </span>
            <p className="text-sm font-semibold text-bone">
              Built beyond the walls<span className="text-blood">.</span>
            </p>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-dim">
            Every line of Veyra is original — the emblem, the wall, the crack of light. If this
            tool saved you time, pass it on. If you want something built, the Fiverr door is open.
          </p>
        </div>
      </div>

      <div className="mt-10 flex items-center justify-center gap-2 text-dim">
        <Music2 size={14} className="text-ember" />
        <span className="text-xs">Made with intention, at 3am, behind the walls.</span>
      </div>
    </main>
  );
}
