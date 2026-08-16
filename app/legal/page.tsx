import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = {
  title: "Legal",
  description: "Terms of service and copyright / fair-use disclaimer for Veyra.io.",
};

const SECTIONS: { id: string; title: string; body: React.ReactNode }[] = [
  {
    id: "service",
    title: "1 · What Veyra is",
    body: (
      <>
        Veyra.io is a media downloader that surfaces formats a platform already serves. It does
        not host, re-encode, or redistribute content — it pulls what a URL already publicly
        exposes, on demand, for the person who pasted it. Veyra does not store or share the files
        it produces; downloads are served directly to your browser and swept from the worker
        within hours.
      </>
    ),
  },
  {
    id: "terms",
    title: "2 · Terms of use",
    body: (
      <>
        You may use Veyra only for lawful purposes. You agree not to use it to circumvent access
        controls, to download content you do not have a right to download, or in any way that
        violates a platform&apos;s terms of service, applicable law, or the rights of others. Veyra is
        provided “as is”, without warranty of any kind — availability, format lists, and behavior
        depend on third-party platforms we do not control.
      </>
    ),
  },
  {
    id: "disclaimer",
    title: "3 · Copyright & fair use",
    body: (
      <>
        Downloading does not equal owning. Content is the property of its creator and rightsholder,
        and copyright protections apply regardless of what tool produced the file. Before you
        download, make sure you have the right to — for example: content you created yourself,
        content explicitly licensed for reuse (Creative Commons, public domain, royalty-free),
        or content where the rightsholder has granted permission.
      </>
    ),
  },
  {
    id: "limits",
    title: "4 · Limitations of liability",
    body: (
      <>
        To the maximum extent permitted by law, Veyra.io and its creator are not liable for how
        the tool is used, for files downloaded through it, or for any damages arising from use.
        We may change, suspend, or discontinue the service at any time.
      </>
    ),
  },
  {
    id: "privacy",
    title: "5 · Privacy",
    body: (
      <>
        Settings and download history live in your own browser (localStorage) and never leave your
        machine. The worker sees only the URLs you submit and the platform data it must fetch to
        serve them. We do not run analytics, tracking pixels, or sell data.
      </>
    ),
  },
];

export default function LegalPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <PageHeader
        kicker="Terms"
        title="Legal"
        description="The short version: be a good person, only download what you have the right to, and everything lives in your browser."
      />

      <div className="mt-10 space-y-8">
        {SECTIONS.map((s) => (
          <section key={s.id} id={s.id === "disclaimer" ? "disclaimer" : undefined} className="scroll-mt-24">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.24em] text-ember">{s.title}</h2>
            <div className="mt-3 text-sm leading-relaxed text-dim">{s.body}</div>
          </section>
        ))}
      </div>

      <div className="mt-12 rounded-xl border border-rust bg-panel/60 p-5">
        <p className="text-xs leading-relaxed text-dim">
          <span className="font-semibold text-bone">A note, not a lecture:</span> the fastest way
          to respect creators is to download only what you own, have permission for, or what is
          licensed for reuse — Creative Commons, public domain, your own uploads. Veyra was built
          for that. Anything else is on you.
        </p>
      </div>

      <p className="mt-8 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-dim/60">
        © {new Date().getFullYear()} Veyra.io
      </p>
    </main>
  );
}
