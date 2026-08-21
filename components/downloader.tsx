"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Clock, Eye, Link2, ListVideo, Loader2, RotateCcw, Upload, X } from "lucide-react";
import { useDownloader, useJobs, useEngine } from "@/store/downloader";
import { useSettings } from "@/store/settings";
import { buildChoices, buildDownloadPayload, AUDIO_FORMATS, VIDEO_CONTAINERS, formatDuration, formatViews, type FormatChoice } from "@/lib/format";
import type { Job, MediaType, VideoInfo } from "@/lib/types";
import { FormatPicker } from "./format-picker";
import { QueueView } from "./queue-view";

const URL_RE = /https?:\/\/[^\s<>"']+/gi;
const MAX_BATCH = 50;

/** Choice used when batch-pasting multiple URLs — best quality, auto merge. */
const AUTO_CHOICE: FormatChoice = {
  id: "auto",
  label: "Best quality (auto)",
  sub: "",
  format: "bestvideo+bestaudio/best",
  height: null,
  ext: null,
};

export function Downloader() {
  const settings = useSettings();
  const { url, status, result, error, setUrl, resolve, clear } = useDownloader();
  const { engineStatus, engineUrl, checkEngine } = useEngine();
  const jobs = useJobs((s) => s.jobs);
  const upsertJob = useJobs((s) => s.upsertJob);
  const removeJob = useJobs((s) => s.removeJob);
  const addHistory = useJobs((s) => s.addHistory);

  useEffect(() => {
    checkEngine();
  }, [checkEngine]);

  const [type, setType] = useState<MediaType>(settings.defaultType);
  const [quality, setQuality] = useState("auto");
  const [container, setContainer] = useState(settings.defaultContainer);
  const [actionError, setActionError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedRef = useRef<Set<string>>(new Set());
  const jobsRef = useRef(jobs);
  useEffect(() => {
    jobsRef.current = jobs;
  }, [jobs]);

  /* ---------------- paste-and-go: auto-resolve when a URL appears ---------------- */
  const handleInput = (value: string) => {
    setUrl(value);
    const matches = [...value.matchAll(URL_RE)].map((m) => m[0]);
    if (matches.length === 0) return;

    // Batch paste: a multi-line list of URLs — queue them all at best quality.
    if (matches.length > 1) {
      for (const target of matches.slice(0, MAX_BATCH)) {
        void startDownload(target, "video+audio", AUTO_CHOICE, settings.defaultContainer);
      }
      return;
    }

    const target = matches[0];
    const st = useDownloader.getState();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (target && target !== st.lastResolvedUrl && st.status !== "probing") {
      debounceRef.current = setTimeout(() => resolve(target), 450);
    }
  };

  const triggerSave = (job: Job) => {
    if (savedRef.current.has(job.id)) return;
    savedRef.current.add(job.id);
    const { engineStatus, engineUrl } = useEngine.getState();
    if (engineStatus === "connected") {
      fetch(`${engineUrl}/v1/jobs/${job.id}/open-folder`, { method: "POST" });
    } else {
      const a = document.createElement("a");
      a.href = `/api/jobs/${job.id}/file`;
      a.download = job.filename ?? "download";
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  };

  /* ---------------- job polling + auto-save + history ---------------- */
  const hasActive = jobs.some((j) => j.status === "queued" || j.status === "running");

  useEffect(() => {
    if (!hasActive) return;
    let cancelled = false;

    const tick = async () => {
      const { engineStatus, engineUrl } = useEngine.getState();
      const isLocal = engineStatus === "connected";
      const base = isLocal ? `${engineUrl}/v1/jobs` : "/api/jobs";
      try {
        const res = await fetch(base, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled || !data.ok) return;
        const list = data.jobs as Job[];
        for (const j of list) {
          const prev = jobsRef.current.find((x) => x.id === j.id);
          upsertJob(j);
          if (!prev || prev.status !== "done") {
            if (j.status === "done") {
              addHistory({
                id: j.id,
                title: j.title ?? j.url,
                url: j.url,
                format: j.format,
                size: j.size,
                downloadedAt: Date.now(),
              });
              if (useSettings.getState().autoDownload) triggerSave(j);
            }
          }
        }
      } catch {
        /* transient — next tick */
      }
    };

    tick();
    const t = setInterval(tick, 700);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [hasActive, upsertJob, addHistory]);

  /* ---------------- selection state ---------------- */
  const video = result?.kind === "video" ? result.video : null;
  const choices = useMemo(() => (video ? buildChoices(video, type) : []), [video, type]);

  // Map the saved default quality to an actual option for this video
  // (e.g. "1080" -> the 1080p row, or "auto" if unavailable).
  const defaultQualityId = useMemo(() => {
    if (!choices.length || settings.defaultQuality === "auto") return "auto";
    const h = Number(settings.defaultQuality);
    if (!Number.isFinite(h)) return "auto";
    return choices.find((c) => c.height === h)?.id ?? "auto";
  }, [choices, settings.defaultQuality]);

  // Reset quality/container when the resolved video or download type changes.
  // Adjusting state during render is React's documented pattern for this.
  const [selectionKey, setSelectionKey] = useState("");
  const selectionKeyNext = `${video?.id ?? "none"}|${type}`;
  if (selectionKey !== selectionKeyNext) {
    setSelectionKey(selectionKeyNext);
    setQuality(defaultQualityId);
    setContainer(type === "audio" ? settings.audioFormat : settings.defaultContainer);
  }

  // If the current selection isn't available for this video, fall back to the first option.
  if (choices.length > 0 && !choices.some((c) => c.id === quality)) {
    setQuality(choices[0].id);
  }
  const chosen = choices.find((c) => c.id === quality) ?? choices[0];

  const containerOptions = (type === "audio" ? AUDIO_FORMATS : VIDEO_CONTAINERS).map((c) => ({
    id: c,
    label: c.toUpperCase(),
    sub: type === "audio" ? "audio container" : "video container",
  }));

  const startDownload = async (targetUrl: string, t: MediaType, choice: FormatChoice | undefined, cont: string) => {
    if (!choice) return;
    setStarting(true);
    setActionError(null);
    const { engineStatus: status, engineUrl: base } = useEngine.getState();
    const isLocal = status === "connected";
    const url = isLocal ? `${base}/v1/download` : "/api/download";
    try {
      const payload = buildDownloadPayload(targetUrl, t, choice, cont, settings.filenameTemplate);
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, concurrentLimit: settings.concurrentLimit }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setActionError(data.error?.message ?? "Download could not be started.");
        return;
      }
      upsertJob(data.job);
    } catch {
      setActionError("Download could not be started.");
    } finally {
      setStarting(false);
    }
  };

  const downloadBatch = async () => {
    if (result?.kind !== "playlist") return;
    const entries = result.playlist.entries.slice(0, MAX_BATCH);
    setActionError(null);
    const { engineStatus, engineUrl } = useEngine.getState();
    const isLocal = engineStatus === "connected";
    const base = isLocal ? `${engineUrl}/v1/download` : "/api/download";

    for (const e of entries) {
      try {
        const payload = buildDownloadPayload(e.url, "video+audio", { id: "auto", label: "auto", sub: "", format: "bestvideo+bestaudio/best", height: null, ext: null }, settings.defaultContainer, settings.filenameTemplate);
        const res = await fetch(base, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, concurrentLimit: settings.concurrentLimit }),
        });
        const data = await res.json();
        if (data.ok) upsertJob(data.job);
      } catch {
        /* keep going */
      }
    }
  };

  const cancelJob = async (id: string) => {
    removeJob(id);
    const { engineStatus, engineUrl } = useEngine.getState();
    const isLocal = engineStatus === "connected";
    const base = isLocal ? `${engineUrl}/v1/jobs/${id}` : `/api/jobs/${id}`;
    try {
      await fetch(base, { method: "DELETE" });
    } catch {
      /* gone */
    }
  };

  /* ---------------- sticky mini progress (mobile) ---------------- */
  const activeJob = jobs.find((j) => j.status === "running") ?? jobs.find((j) => j.status === "queued");

  return (
    <div className="w-full">
      {/* ============ URL input ============ */}
      <div
        className={`glass relative rounded-xl p-2 shadow-card transition-shadow duration-300 ${
          status === "probing" ? "shadow-ember" : "hover:shadow-ember"
        }`}
      >
        <div className="flex items-center gap-2">
          <Link2 size={17} className="ml-2 shrink-0 text-dim" aria-hidden="true" />
          <input
            type="url"
            inputMode="url"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            value={url}
            onChange={(e) => handleInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const m = url.match(URL_RE);
                if (m) resolve(m[0]);
              }
            }}
            placeholder="Paste any link — YouTube, Instagram, TikTok, X, SoundCloud…"
            aria-label="Media URL"
            className="h-11 min-w-0 flex-1 bg-transparent font-mono text-sm text-bone outline-none"
          />
          {url && (
            <button
              onClick={clear}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-dim transition-colors hover:text-bone"
              aria-label="Clear input"
            >
              <X size={15} />
            </button>
          )}
          <button
            onClick={() => {
              const m = url.match(URL_RE);
              if (m) resolve(m[0]);
            }}
            disabled={status === "probing" || !url}
            className="flex h-11 shrink-0 items-center gap-2 rounded-lg bg-blood px-4 text-sm font-semibold text-bone transition-all hover:bg-ember disabled:cursor-not-allowed disabled:opacity-40 sm:px-5"
          >
            {status === "probing" ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
            <span className="hidden sm:inline">{status === "probing" ? "Probing…" : "Resolve"}</span>
          </button>
        </div>
        {/* ember border sweep while probing */}
        {status === "probing" && (
          <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl" aria-hidden="true">
            <span
              className="absolute inset-y-0 w-1/3 animate-[scan-sweep_1.1s_ease-in-out_infinite]"
              style={{
                background: "linear-gradient(90deg, transparent, var(--ember-glow), transparent)",
              }}
            />
          </span>
        )}
      </div>

      {/* ============ resolve states ============ */}
      <AnimatePresence mode="wait">
        {status === "probing" && (
          <motion.div
            key="probing"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22 }}
            className="mt-4 rounded-lg border border-rust bg-panel/70 p-4"
          >
            <div className="flex items-center gap-3">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ember opacity-60" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-ember" />
              </span>
              <p className="font-mono text-xs text-dim">
                Probing link · pulling every available format…
              </p>
            </div>
          </motion.div>
        )}

        {status === "error" && error && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22 }}
            className="mt-4 rounded-lg border border-blood/60 bg-blood/10 p-4"
          >
            <p className="text-sm font-medium text-bone">{error.message}</p>
            {error.raw && (
              <details className="mt-2.5 group">
                <summary className="font-mono cursor-pointer select-none text-[10px] uppercase tracking-[0.18em] text-dim/70 transition-colors hover:text-dim">
                  <span className="mr-1 inline-block transition-transform group-open:rotate-90">›</span>
                  What the platform actually said
                </summary>
                <pre className="mt-2 max-h-44 overflow-auto whitespace-pre-wrap break-words rounded-md border border-rust bg-void/70 p-2.5 font-mono text-[10px] leading-relaxed text-dim">
                  {error.raw}
                </pre>
              </details>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                onClick={clear}
                className="flex items-center gap-1.5 rounded-md border border-rust px-3 py-1.5 text-xs text-dim transition-colors hover:text-bone"
              >
                <RotateCcw size={13} /> Try another link
              </button>
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-dim/70">
                code · {error.code}
              </span>
            </div>
          </motion.div>
        )}

        {status === "resolved" && result?.kind === "video" && video && (
          <motion.div
            key="video"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.28 }}
            className="mt-4 rounded-xl border border-rust bg-panel/80 p-4 shadow-card sm:p-5"
          >
            <VideoCard
              video={video}
              type={type}
              setType={setType}
              quality={quality}
              setQuality={setQuality}
              choices={choices}
              chosen={chosen}
              container={container}
              setContainer={setContainer}
              containerOptions={containerOptions}
              onDownload={() => startDownload(video.webpage_url, type, chosen, container)}
              starting={starting}
              onClear={clear}
              actionError={actionError}
            />
          </motion.div>
        )}

        {status === "resolved" && result?.kind === "playlist" && (
          <motion.div
            key="playlist"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.28 }}
            className="mt-4 rounded-xl border border-rust bg-panel/80 p-4 shadow-card sm:p-5"
          >
            <PlaylistCard
              playlist={result.playlist}
              onDownloadAll={downloadBatch}
              onPick={(entryUrl) => resolve(entryUrl)}
              starting={starting}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ============ queue ============ */}
      {jobs.length > 0 && (
        <QueueView
          jobs={jobs}
          onCancel={cancelJob}
          onSave={triggerSave}
          onOpenFolder={triggerSave}
        />
      )}

      {/* ============ sticky mini progress (mobile) ============ */}
      {activeJob && (
        <motion.div
          initial={{ y: 60 }}
          animate={{ y: 0 }}
          className="glass fixed inset-x-0 bottom-0 z-40 border-t border-rust px-4 py-2.5 md:hidden"
        >
          <div className="flex items-center gap-3">
            <Loader2 size={13} className="shrink-0 animate-spin text-ember" />
            <span className="min-w-0 flex-1 truncate text-xs text-bone">
              {activeJob.title ?? "Downloading…"}
            </span>
            <span className="font-mono shrink-0 text-[10px] text-dim">
              {Math.floor(activeJob.progress)}%
            </span>
          </div>
          <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-elevated">
            <div
              className="h-full rounded-full"
              style={{
                width: `${activeJob.progress}%`,
                background: "linear-gradient(90deg, var(--accent-blood), var(--accent-ember))",
                boxShadow: "0 0 10px var(--ember-glow)",
                transition: "width 0.4s ease",
              }}
            />
          </div>
        </motion.div>
      )}
    </div>
  );
}

/* ================================================================== */

interface VideoCardProps {
  video: VideoInfo;
  type: MediaType;
  setType: (t: MediaType) => void;
  quality: string;
  setQuality: (q: string) => void;
  choices: { id: string; label: string; sub?: string }[];
  chosen?: { id: string; label: string; sub?: string; format: string };
  container: string;
  setContainer: (c: string) => void;
  containerOptions: { id: string; label: string; sub: string }[];
  onDownload: () => void;
  starting: boolean;
  onClear: () => void;
  actionError: string | null;
}

const TYPES: { id: MediaType; label: string; hint: string }[] = [
  { id: "video+audio", label: "Video + Audio", hint: "merged" },
  { id: "video", label: "Video only", hint: "no audio" },
  { id: "audio", label: "Audio only", hint: "mp3 · opus · flac" },
];

function VideoCard(props: VideoCardProps) {
  const { video, type, setType, quality, setQuality, choices, chosen, container, setContainer, containerOptions, onDownload, starting, onClear, actionError } = props;

  return (
    <div>
      <div className="flex items-start gap-4">
        {video.thumbnail && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={video.thumbnail}
            alt=""
            loading="lazy"
            className="h-20 w-32 shrink-0 rounded-md border border-rust object-cover sm:h-24 sm:w-40"
          />
        )}
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-bone sm:text-base">
            {video.title}
          </h3>
          <div className="font-mono mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] uppercase tracking-[0.12em] text-dim">
            {video.uploader && <span className="text-bone/80">{video.uploader}</span>}
            {formatDuration(video.duration) && (
              <span className="flex items-center gap-1"><Clock size={11} />{formatDuration(video.duration)}</span>
            )}
            {formatViews(video.view_count) && (
              <span className="flex items-center gap-1"><Eye size={11} />{formatViews(video.view_count)}</span>
            )}
            {video.extractor && <span className="text-ember">{video.extractor}</span>}
          </div>
        </div>
        <button
          onClick={onClear}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-dim transition-colors hover:text-bone"
          aria-label="Clear and resolve another link"
        >
          <X size={15} />
        </button>
      </div>

      {/* type segmented control */}
      <div className="mt-5 grid grid-cols-3 gap-1.5 rounded-lg border border-rust bg-void/60 p-1.5" role="tablist" aria-label="Download type">
        {TYPES.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={type === t.id}
            onClick={() => setType(t.id)}
            className={`rounded-md px-2 py-2 text-center transition-all ${
              type === t.id ? "bg-blood/25 text-bone shadow-blood" : "text-dim hover:text-bone"
            }`}
          >
            <span className="block text-xs font-semibold sm:text-sm">{t.label}</span>
            <span className="font-mono mt-0.5 block text-[9px] uppercase tracking-[0.14em] opacity-70">
              {t.hint}
            </span>
          </button>
        ))}
      </div>

      {/* pickers */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormatPicker
          label="Quality & format"
          options={choices}
          value={quality}
          onChange={setQuality}
          mono
        />
        <FormatPicker
          label={type === "audio" ? "Audio format" : "Container"}
          options={containerOptions}
          value={container}
          onChange={setContainer}
          mono
        />
      </div>

      {/* format details */}
      {chosen && (
        <p className="font-mono mt-3 truncate text-[11px] text-dim" title={chosen.format}>
          <span className="text-ember">-f</span> {chosen.format}
          {type === "audio" && <span> · <span className="text-ember">-x</span> --audio-format {container}</span>}
          {type !== "audio" && container && chosen.format.includes("+") && (
            <span> · <span className="text-ember">--merge-output-format</span> {container}</span>
          )}
        </p>
      )}

      {actionError && (
        <p className="mt-3 rounded-md border border-blood/50 bg-blood/10 px-3 py-2 text-xs text-bone">
          {actionError}
        </p>
      )}

      <button
        onClick={onDownload}
        disabled={starting || !chosen}
        className="mt-4 flex h-12 w-full items-center justify-center gap-2.5 rounded-lg bg-blood text-sm font-semibold text-bone transition-all hover:bg-ember hover:shadow-ember disabled:cursor-not-allowed disabled:opacity-50"
      >
        {starting ? <Loader2 size={17} className="animate-spin" /> : <Upload size={17} />}
        {starting ? "Starting…" : "Download"}
      </button>
    </div>
  );
}

/* ================================================================== */

interface PlaylistCardProps {
  playlist: { title: string; count: number; uploader: string | null; thumbnail: string | null; entries: { id: string; url: string; title: string; duration: number | null }[] };
  onDownloadAll: () => void;
  onPick: (url: string) => void;
  starting: boolean;
}

function PlaylistCard({ playlist, onDownloadAll, onPick, starting }: PlaylistCardProps) {
  const visible = playlist.entries.slice(0, 50);
  return (
    <div>
      <div className="flex items-start gap-4">
        {playlist.thumbnail && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={playlist.thumbnail}
            alt=""
            loading="lazy"
            className="h-20 w-32 shrink-0 rounded-md border border-rust object-cover sm:h-24 sm:w-40"
          />
        )}
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-bone sm:text-base">{playlist.title}</h3>
          <div className="font-mono mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] uppercase tracking-[0.12em] text-dim">
            {playlist.uploader && <span className="text-bone/80">{playlist.uploader}</span>}
            <span className="flex items-center gap-1 text-ember">
              <ListVideo size={11} /> {playlist.count} videos
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          onClick={onDownloadAll}
          disabled={starting}
          className="flex h-11 items-center gap-2 rounded-lg bg-blood px-5 text-sm font-semibold text-bone transition-all hover:bg-ember disabled:opacity-50"
        >
          {starting ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
          Download all (best)
        </button>
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-dim/70">
          {playlist.count > MAX_BATCH ? `first ${MAX_BATCH} queued` : "queues the full playlist"}
        </span>
      </div>

      <div className="mt-4 max-h-72 overflow-y-auto rounded-lg border border-rust bg-void/50">
        {visible.map((e, i) => (
          <button
            key={e.id}
            onClick={() => onPick(e.url ?? "")}
            className="flex w-full items-center gap-3 border-b border-rust/60 px-3.5 py-2.5 text-left transition-colors last:border-b-0 hover:bg-elevated"
            title="Resolve this video"
          >
            <span className="font-mono w-6 shrink-0 text-right text-[10px] text-dim/60">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="min-w-0 flex-1 truncate text-xs text-bone/85">{e.title}</span>
            {e.duration && (
              <span className="font-mono shrink-0 text-[10px] text-dim">{formatDuration(e.duration)}</span>
            )}
          </button>
        ))}
        {playlist.entries.length === 0 && (
          <p className="px-4 py-6 text-center text-xs text-dim">No entries could be listed for this playlist.</p>
        )}
      </div>
    </div>
  );
}
