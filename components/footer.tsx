import Link from "next/link";
import { Emblem } from "./emblem";

const CREATOR_LINKS = [
  { label: "GitHub", href: "https://github.com/fadingsanctum" },
  { label: "YouTube — main", href: "https://youtube.com/@soul_lifestyle0900" },
  { label: "YouTube — Luma Editz", href: "https://youtube.com/@lumaeditz0" },
  { label: "Fiverr", href: "https://www.fiverr.com/shaik_muzammil0" },
  { label: "Portfolio / Soullabs", href: "https://soullabs-com.vercel.app/" },
];

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-rust bg-panel/60">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-4 py-14 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="text-bone">
              <Emblem size={24} />
            </span>
            <span className="font-display text-base font-bold tracking-[0.22em] text-bone">
              VEYRA<span className="text-blood">.io</span>
            </span>
          </div>
          <p className="mt-3 max-w-[24ch] text-sm leading-relaxed text-dim">
            One URL box. Every platform Veyra reaches. Every format it can produce.
          </p>
        </div>

        <div>
          <h3 className="font-mono text-xs uppercase tracking-[0.2em] text-dim">Product</h3>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link className="text-bone/80 transition-colors hover:text-ember" href="/">Downloader</Link></li>
            <li><Link className="text-bone/80 transition-colors hover:text-ember" href="/settings">Settings</Link></li>
            <li><Link className="text-bone/80 transition-colors hover:text-ember" href="/help">Help & FAQ</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="font-mono text-xs uppercase tracking-[0.2em] text-dim">Legal</h3>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link className="text-bone/80 transition-colors hover:text-ember" href="/legal">Terms of Service</Link></li>
            <li><Link className="text-bone/80 transition-colors hover:text-ember" href="/legal#disclaimer">Copyright & fair use</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="font-mono text-xs uppercase tracking-[0.2em] text-dim">Creator</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {CREATOR_LINKS.map((l) => (
              <li key={l.label}>
                <a
                  className="text-bone/80 transition-colors hover:text-ember"
                  href={l.href}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-rust">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-dim sm:flex-row sm:px-6">
          <span>© {year} Veyra.io — built by SOUL — AMEEN</span>
          <span className="font-mono">
            Veyra engine · 1,800+ platforms
          </span>
        </div>
      </div>
    </footer>
  );
}
