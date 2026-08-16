"use client";

import { Check, History, Moon, MoonStar, RotateCcw, Sun } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { useSettings, type ThemeName } from "@/store/settings";
import { useJobs } from "@/store/downloader";
import { AUDIO_FORMATS, VIDEO_CONTAINERS, formatBytes } from "@/lib/format";
import type { MediaType } from "@/lib/types";

const THEMES: { id: ThemeName; label: string; icon: typeof Moon }[] = [
  { id: "dark", label: "Dark", icon: Moon },
  { id: "dim", label: "Dim", icon: MoonStar },
  { id: "light", label: "Light", icon: Sun },
];

const TYPES: { id: MediaType; label: string; explain: string }[] = [
  { id: "video+audio", label: "Video + Audio", explain: "a normal video file, picture and sound together" },
  { id: "video", label: "Video only", explain: "just the picture, no sound — good for edits" },
  { id: "audio", label: "Audio only", explain: "just the sound, as an MP3 or similar" },
];

const QUALITIES = [
  { id: "auto", label: "Best available", explain: "whatever the source has at its highest quality" },
  { id: "2160", label: "4K (2160p)", explain: "only if the source actually offers it" },
  { id: "1440", label: "1440p", explain: "between 1080p and 4K" },
  { id: "1080", label: "1080p", explain: "full HD" },
  { id: "720", label: "720p", explain: "HD, smaller files" },
  { id: "480", label: "480p", explain: "smaller still" },
  { id: "360", label: "360p", explain: "small files, fast downloads" },
];

const CONTAINER_EXPLAIN: Record<string, string> = {
  mp4: "plays on everything — phones, TVs, browsers",
  webm: "open format, smaller files, works in browsers",
  mkv: "keeps every audio/video track, for players like VLC",
};

const AUDIO_EXPLAIN: Record<string, string> = {
  mp3: "the classic — plays anywhere",
  m4a: "Apple-friendly, great quality per size",
  opus: "best quality per size, modern players",
  wav: "uncompressed, huge files, studio quality",
  flac: "lossless, for audiophiles",
};

const FILENAME_TOKENS = [
  { token: "%(title)s", meaning: "video title" },
  { token: "%(uploader)s", meaning: "channel / uploader name" },
  { token: "%(upload_date)s", meaning: "date, e.g. 20260816" },
  { token: "%(id)s", meaning: "video ID" },
  { token: "%(ext)s", meaning: "file type, e.g. mp4" },
];

/** Build a pattern from plain checkboxes: Title - Channel (Date) .ext */
function buildPattern(fields: { title: boolean; uploader: boolean; date: boolean; id: boolean }): string {
  const parts: string[] = [];
  if (fields.title) parts.push("%(title)s");
  if (fields.uploader) parts.push("%(uploader)s");
  if (fields.date) parts.push("%(upload_date)s");
  if (fields.id) parts.push("%(id)s");
  const core = parts.length ? parts.join(" - ") : "%(title)s";
  return `${core}.%(ext)s`;
}

const SAMPLE: Record<string, string> = {
  "%(title)s": "My First Video",
  "%(uploader)s": "Example Channel",
  "%(upload_date)s": "20260816",
  "%(id)s": "abc123",
  "%(ext)s": "mp4",
};

function previewFilename(template: string): string {
  const out = template.replace(/%(title|uploader|upload_date|id|ext)s/g, (m) => SAMPLE[m] ?? m);
  return out.trim() || "file.mp4";
}

function CheckField({
  label,
  note,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  note?: string;
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={disabled ? undefined : onChange}
      disabled={disabled}
      className="flex items-center justify-between gap-3 rounded-md border border-rust/70 px-3 py-2.5 text-left transition-colors hover:border-ember/50 disabled:cursor-default disabled:opacity-70"
    >
      <span className="flex items-center gap-2.5">
        <span
          className={`flex h-4 w-4 items-center justify-center rounded-[4px] border transition-colors ${
            checked ? "border-ember bg-ember text-void" : "border-rust bg-void"
          }`}
          aria-hidden="true"
        >
          {checked && <Check size={11} strokeWidth={3} />}
        </span>
        <span className="text-xs text-bone">{label}</span>
      </span>
      {note && <span className="text-[10px] text-dim">{note}</span>}
    </button>
  );
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

/* ------------------------- building blocks ------------------------- */

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-b border-rust/70 py-5 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="max-w-[36ch]">
        <p className="text-sm font-medium text-bone">{label}</p>
        {hint && <p className="mt-1 text-xs leading-relaxed text-dim">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string; explain?: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          title={o.explain}
          className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
            value === o.id
              ? "border-ember/60 bg-blood/20 text-bone shadow-ember"
              : "border-rust text-dim hover:text-bone"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors ${
        checked ? "border-ember/60 bg-blood/50" : "border-rust bg-elevated"
      }`}
    >
      <span
        className={`absolute top-0.5 h-[18px] w-[18px] rounded-full transition-all ${
          checked ? "left-[22px] bg-ember" : "left-0.5 bg-dim"
        }`}
      />
    </button>
  );
}

/* ------------------------------ page ------------------------------ */

export default function SettingsPage() {
  const s = useSettings();
  const history = useJobs((st) => st.history);
  const clearHistory = useJobs((st) => st.clearHistory);
  const template = s.filenameTemplate;

  // Plain-language checkboxes derived from the stored pattern.
  const hasToken = (tok: string) => template.includes(tok);
  const fields = {
    title: true,
    uploader: hasToken("%(uploader)s"),
    date: hasToken("%(upload_date)s"),
    id: hasToken("%(id)s"),
  };
  const toggleField = (key: "uploader" | "date" | "id") => {
    s.set({ filenameTemplate: buildPattern({ ...fields, [key]: !fields[key] }) });
  };

  return (
    <main className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
      <PageHeader
        kicker="Preferences"
        title="Settings"
        description="Everything here is saved in your browser. These are your defaults — you can still change any of them on a single download."
      />

      {/* ------------------------- Appearance ------------------------- */}
      <div className="mt-8 rounded-xl border border-rust bg-panel/60 p-5 sm:p-7">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.24em] text-ember">Appearance</h2>

        <Row label="Theme" hint="Dark is the signature Veyra look. Dim softens it; Light flips to warm paper.">
          <Segmented
            options={THEMES.map((t) => ({ id: t.id, label: t.label }))}
            value={s.theme}
            onChange={(theme) => s.setTheme(theme)}
          />
        </Row>

        <Row
          label="Calm mode (reduced motion)"
          hint="Switches off animations and movement. On by default if your device already asks for less motion."
        >
          <div className="flex items-center gap-3">
            <Toggle checked={s.reducedMotion} onChange={(v) => s.set({ reducedMotion: v })} label="Calm mode" />
            <span className="text-xs text-dim">{s.reducedMotion ? "On" : "Off"}</span>
          </div>
        </Row>
      </div>

      {/* ------------------------- Downloads ------------------------- */}
      <div className="mt-6 rounded-xl border border-rust bg-panel/60 p-5 sm:p-7">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.24em] text-ember">Downloads</h2>

        <Row label="What to grab by default" hint="Preselected every time you paste a link. You can switch it per download.">
          <Segmented
            options={TYPES.map((t) => ({ id: t.id, label: t.label, explain: t.explain }))}
            value={s.defaultType}
            onChange={(t) => s.set({ defaultType: t })}
          />
        </Row>

        <Row label="Default quality" hint="The quality preselected when you paste a link. Hover the options for what each means.">
          <Segmented
            options={QUALITIES.map((q) => ({ id: q.id, label: q.label, explain: q.explain }))}
            value={s.defaultQuality}
            onChange={(q) => s.set({ defaultQuality: q })}
          />
        </Row>

        <Row label="Video file type" hint="mp4 plays on everything; webm is smaller and open; mkv keeps every track.">
          <Segmented
            options={VIDEO_CONTAINERS.map((c) => ({ id: c, label: c.toUpperCase(), explain: CONTAINER_EXPLAIN[c] }))}
            value={s.defaultContainer}
            onChange={(c) => s.set({ defaultContainer: c })}
          />
        </Row>

        <Row label="Audio file type" hint="Only used when you download audio. Hover the options for the differences.">
          <Segmented
            options={AUDIO_FORMATS.map((c) => ({ id: c, label: c.toUpperCase(), explain: AUDIO_EXPLAIN[c] }))}
            value={s.audioFormat}
            onChange={(c) => s.set({ audioFormat: c })}
          />
        </Row>

        <Row
          label="When a download finishes"
          hint="Auto-download saves the file straight to your downloads. Ask first shows you a Save button instead."
        >
          <Segmented
            options={[
              { id: "true", label: "Save automatically" },
              { id: "false", label: "Ask me first" },
            ]}
            value={String(s.autoDownload)}
            onChange={(v) => s.set({ autoDownload: v === "true" })}
          />
        </Row>

        <Row
          label="Downloads at the same time"
          hint="How many files Veyra processes side by side. More = faster batches, heavier on the server."
        >
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => s.set({ concurrentLimit: n })}
                className={`font-mono h-9 w-9 rounded-md border text-sm transition-colors ${
                  s.concurrentLimit === n
                    ? "border-ember/60 bg-blood/20 text-ember shadow-ember"
                    : "border-rust text-dim hover:text-bone"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </Row>
      </div>

      {/* ------------------------- File names ------------------------- */}
      <div className="mt-6 rounded-xl border border-rust bg-panel/60 p-5 sm:p-7">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.24em] text-ember">File names</h2>

        <div className="mt-4">
          <p className="text-sm font-medium text-bone">What should a downloaded file be called?</p>
          <p className="mt-1 text-xs text-dim">Tick what you want in the name — you&apos;ll see a live example below.</p>

          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <CheckField
              label="Video title"
              note="always included"
              checked
              disabled
              onChange={() => {}}
            />
            <CheckField
              label="Channel / uploader"
              note="e.g. Example Channel"
              checked={fields.uploader}
              onChange={() => toggleField("uploader")}
            />
            <CheckField
              label="Date"
              note="e.g. 20260816"
              checked={fields.date}
              onChange={() => toggleField("date")}
            />
            <CheckField
              label="Short video ID"
              note="keeps names unique"
              checked={fields.id}
              onChange={() => toggleField("id")}
            />
          </div>

          <p className="font-mono mt-4 rounded-lg border border-rust bg-void/40 px-4 py-3 text-xs text-bone">
            <span className="text-ember">Example:</span> {previewFilename(template)}
          </p>

          <details className="group mt-4">
            <summary className="cursor-pointer select-none text-xs text-dim transition-colors hover:text-bone">
              Advanced — edit the pattern directly
            </summary>
            <div className="mt-3">
              <input
                value={template}
                onChange={(e) => s.set({ filenameTemplate: e.target.value })}
                className="w-full rounded-md border border-rust bg-void/70 px-3 py-2 font-mono text-xs text-bone outline-none focus:border-ember/60"
                aria-label="Advanced file name pattern"
              />
              <div className="mt-2 flex flex-wrap gap-2">
                {FILENAME_TOKENS.map((t) => (
                  <button
                    key={t.token}
                    onClick={() => s.set({ filenameTemplate: template + t.token })}
                    className="rounded-md border border-rust/70 px-2.5 py-1.5 transition-colors hover:border-ember/50"
                    title={t.meaning}
                  >
                    <span className="font-mono text-[11px] text-ember">{t.token}</span>
                    <span className="ml-1.5 text-[10px] text-dim">{t.meaning}</span>
                  </button>
                ))}
              </div>
            </div>
          </details>
        </div>
      </div>

      {/* ------------------------- History ------------------------- */}
      <div className="mt-6 rounded-xl border border-rust bg-panel/60 p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.24em] text-ember">History</h2>
          <button
            onClick={clearHistory}
            disabled={history.length === 0}
            className="flex items-center gap-2 rounded-md border border-rust px-3.5 py-2 text-xs text-dim transition-colors hover:border-blood/60 hover:text-blood disabled:cursor-not-allowed disabled:opacity-40"
          >
            <History size={14} /> Clear history
          </button>
        </div>

        {history.length === 0 ? (
          <p className="mt-4 rounded-lg border border-rust/60 bg-void/40 px-4 py-6 text-center text-xs text-dim">
            Nothing downloaded yet — files you save from Veyra show up here.
          </p>
        ) : (
          <ul className="mt-4 max-h-80 divide-y divide-rust/60 overflow-y-auto rounded-lg border border-rust bg-void/40">
            {history.map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-bone">{h.title}</p>
                  <p className="font-mono mt-0.5 truncate text-[10px] uppercase tracking-[0.12em] text-dim">
                    {h.format}
                  </p>
                </div>
                <div className="font-mono shrink-0 text-right text-[10px] text-dim">
                  {h.size ? <span className="block">{formatBytes(h.size)}</span> : null}
                  <span className="block">{relativeTime(h.downloadedAt)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ------------------------- Reset ------------------------- */}
      <div className="mt-8 flex justify-end">
        <button
          onClick={() => s.reset()}
          className="flex items-center gap-2 rounded-md border border-rust px-4 py-2 text-xs text-dim transition-colors hover:text-bone"
        >
          <RotateCcw size={13} /> Restore all defaults
        </button>
      </div>
    </main>
  );
}
