import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { FaqItem } from "@/components/faq";
import { SiteSearch } from "@/components/site-search";
import { extractorCount } from "@/lib/engine";
import { Link2, ListVideo, Upload } from "lucide-react";

export const metadata: Metadata = {
  title: "Help & FAQ",
  description: "How Veyra works, supported platforms, and troubleshooting.",
};

export const dynamic = "force-dynamic";

const STEPS = [
  {
    icon: Link2,
    title: "Paste any link",
    body: "Drop a URL from YouTube, Instagram, TikTok, X, SoundCloud or any of the 1,800+ platforms Veyra reaches. The link is detected the moment it appears — no 'go' click needed.",
  },
  {
    icon: ListVideo,
    title: "Pick your format",
    body: "Every format the source actually offers is listed — every resolution up to 4K/8K, every container (mp4, webm, mkv), and audio as mp3, m4a, opus, wav or flac. Nothing is hardcoded; the list comes from the real metadata.",
  },
  {
    icon: Upload,
    title: "Download",
    body: "Veyra's engine does the heavy lifting server-side. Watch the ember progress crack fill, then the file drops into your downloads. Batch playlists queue up with per-item status.",
  },
];

const FAQ: { q: string; a: React.ReactNode }[] = [
  {
    q: "Can I download playlists?",
    a: (
      <>
        Yes. Paste the playlist URL and Veyra lists its entries (first 50). “Download all (best)”
        queues the whole thing with per-item status; or click a single entry to choose formats for
        just that video. Playlists larger than 50 items are truncated to keep the queue sane.
      </>
    ),
  },
  {
    q: "Why can't I download private or age-restricted content?",
    a: (
      <>
        Veyra only works with public content. Private videos, members-only content, and
        age-restricted pages require account cookies, which Veyra deliberately never handles.
        If you get an <code className="font-mono text-ember">age_restricted</code> error, that&apos;s
        the platform guarding it — not a bug.
      </>
    ),
  },
  {
    q: "Why does some 4K content cap at a lower resolution?",
    a: (
      <>
        The source decides what it serves to a plain browser session. Some platforms only expose
        higher qualities to logged-in or app clients, and some uploaders simply never publish 4K.
        Veyra can only grab what the platform makes available — it shows you exactly that
        ceiling, honestly, rather than promising resolutions that don&apos;t exist.
      </>
    ),
  },
  {
    q: "How good is audio extraction?",
    a: (
      <>
        “Best audio” pulls the source&apos;s highest-bitrate audio stream. m4a and opus are recontained
        losslessly; mp3, wav and flac go through FFmpeg. You get the source&apos;s real bitrate — no
        artificial upsampling.
      </>
    ),
  },
  {
    q: "Why is my download slow?",
    a: (
      <>
        Two factors: the worker&apos;s bandwidth and the platform&apos;s own throttling. Larger formats
        simply take longer — check the live speed and ETA under each job. A 4K movie is a
        gigabyte-plus file; it isn&apos;t going to teleport.
      </>
    ),
  },
  {
    q: "Which sites are supported?",
    a: (
      <>
        Every platform Veyra&apos;s engine reaches — the count below is pulled live from the engine
        itself, and it grows every time the engine ships an update. New sites land automatically;
        nothing is hardcoded per platform.
      </>
    ),
  },
];

const TROUBLESHOOT: { code: string; symptom: string; fix: string }[] = [
  { code: "invalid_url", symptom: "“That doesn't look like a valid link.”", fix: "Paste the full URL including https:// — short links like bit.ly work, but raw text or search terms don't." },
  { code: "unsupported", symptom: "“This link isn't supported yet.”", fix: "The platform may be new or behind an app-only wall. Try the platform's share button to get a direct link." },
  { code: "unavailable", symptom: "“This video is unavailable.”", fix: "The video was removed, made private, or geo-blocked in the worker's region. Nothing to do on your end." },
  { code: "age_restricted", symptom: "“This content is private or age-restricted.”", fix: "Veyra never logs into accounts. Public content only — see the FAQ above." },
  { code: "network", symptom: "“Couldn't reach the platform.”", fix: "Transient network or DNS failure. Wait a moment and try again — most resolve on retry." },
  { code: "format_unavailable", symptom: "“That format isn't available.”", fix: "The source stopped serving that variant. Pick the next quality down." },
  { code: "ffmpeg", symptom: "Post-processing failed.", fix: "Merging or conversion needs FFmpeg on the worker. Pick a single-file format instead." },
  { code: "rate_limited", symptom: "“Too many requests.”", fix: "You've hit the per-IP window. Wait the stated seconds and continue." },
];

export default async function HelpPage() {
  const count = await extractorCount();

  return (
    <main className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
      <PageHeader
        kicker="Documentation"
        title="Help & FAQ"
        description="Paste → pick format → download. Three steps, every platform Veyra can reach."
      />

      {/* 3-step walkthrough */}
      <section className="mt-10">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.24em] text-ember">How it works</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <div
              key={step.title}
              className="relative rounded-xl border border-rust bg-panel/60 p-5 transition-colors hover:border-ember/40"
            >
              <span className="font-display absolute right-4 top-4 text-2xl font-black text-rust">
                {String(i + 1).padStart(2, "0")}
              </span>
              <step.icon size={20} className="text-ember" aria-hidden="true" />
              <h3 className="mt-4 text-sm font-semibold text-bone">{step.title}</h3>
              <p className="mt-2 text-xs leading-relaxed text-dim">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Supported sites */}
      <section className="mt-12 rounded-xl border border-rust bg-panel/60 p-5 sm:p-7">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.24em] text-ember">Supported sites</h2>
        <p className="mt-3 text-sm leading-relaxed text-dim">
          Veyra supports{" "}
          <span className="font-mono text-ember">
            {count > 0 ? `${count.toLocaleString()} platforms` : "1,800+ platforms"}
          </span>{" "}
          — the exact list is pulled live from Veyra&apos;s engine, so it updates itself as support
          ships. That includes the big platforms, niche communities, and adult platforms like
          XHamster, XVideos, PornHub, RedTube and SpankBang.
        </p>
        <div className="mt-5">
          <SiteSearch initialCount={count} />
        </div>
      </section>

      {/* FAQ */}
      <section className="mt-12">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.24em] text-ember">FAQ</h2>
        <div className="mt-4 rounded-xl border border-rust bg-panel/60 px-5">
          {FAQ.map((f) => (
            <FaqItem key={f.q} q={f.q}>
              {f.a}
            </FaqItem>
          ))}
        </div>
      </section>

      {/* Troubleshooting */}
      <section className="mt-12">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.24em] text-ember">Troubleshooting</h2>
        <div className="mt-4 overflow-x-auto rounded-xl border border-rust">
          <table className="w-full min-w-[560px] border-collapse bg-panel/60 text-left text-sm">
            <thead>
              <tr className="border-b border-rust">
                <th className="font-mono px-4 py-3 text-[10px] uppercase tracking-[0.18em] text-dim">Error</th>
                <th className="font-mono px-4 py-3 text-[10px] uppercase tracking-[0.18em] text-dim">What you see</th>
                <th className="font-mono px-4 py-3 text-[10px] uppercase tracking-[0.18em] text-dim">Fix</th>
              </tr>
            </thead>
            <tbody>
              {TROUBLESHOOT.map((t) => (
                <tr key={t.code} className="border-b border-rust/60 last:border-b-0">
                  <td className="font-mono px-4 py-3 align-top text-[11px] text-ember">{t.code}</td>
                  <td className="px-4 py-3 align-top text-xs text-bone/85">{t.symptom}</td>
                  <td className="px-4 py-3 align-top text-xs leading-relaxed text-dim">{t.fix}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="mt-10 text-center text-xs text-dim">
        Still stuck?{" "}
        <Link href="/connect" className="text-ember transition-colors hover:text-bone">
          Reach out on the Connect page
        </Link>
        .
      </p>
    </main>
  );
}
