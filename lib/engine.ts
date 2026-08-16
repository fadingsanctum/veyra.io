/**
 * Server-only wrapper around Veyra's download engine binary.
 *
 * We always shell out to the real engine (never a JS reimplementation) so every
 * platform it supports — 1800+ extractors — works automatically as the engine
 * updates. It is invoked with an args array and no shell, so no user input is
 * ever interpolated into a shell string.
 */
import { execFile, spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import path from "node:path";
import type { FlatEntry, FormatInfo, PlaylistInfo, ResolveResult, VideoInfo } from "./types";

/** Path to the engine binary. Defaults to the standard executable name. */
const ENGINE = process.env.VEYRA_ENGINE_PATH || "yt-dlp";
const RESOLVE_TIMEOUT_MS = 90_000;

export class EngineError extends Error {
  code: string;
  stderr: string;
  constructor(code: string, message: string, stderr: string) {
    super(message);
    this.code = code;
    this.stderr = stderr;
  }
}

/** Classify engine stderr so /help troubleshooting can be data-driven. */
export function classifyError(stderr: string): { code: string; message: string } {
  const s = stderr.toLowerCase();
  if (s.includes("unsupported url")) {
    return { code: "unsupported", message: "This link isn't supported yet. Try a direct link from the platform's share button." };
  }
  if (s.includes("video unavailable") || s.includes("is unavailable") || s.includes("has been removed")) {
    return { code: "unavailable", message: "This video is unavailable — it may have been removed or made private." };
  }
  if (s.includes("sign in to confirm") || s.includes("age-restricted") || s.includes("age restricted") || s.includes("log in")) {
    return { code: "age_restricted", message: "This content is private or age-restricted. Veyra only downloads public content you have permission to access." };
  }
  if (s.includes("timed out") || s.includes("connection") || s.includes("unable to download webpage") || s.includes("network") || s.includes("errno")) {
    return {
      code: "network",
      message:
        "The platform didn't respond — it may be temporarily down, or blocked by your network or region. Try the link on a different network (a VPS worker usually fixes this).",
    };
  }
  if (s.includes("ffmpeg") || s.includes("postprocessing")) {
    return { code: "ffmpeg", message: "Post-processing failed — FFmpeg may not be installed on the worker. Try a single-file format instead." };
  }
  if (s.includes("requested format is not available")) {
    return { code: "format_unavailable", message: "That format isn't available for this media. Pick another quality." };
  }
  const firstLine = stderr.split("\n").map((l) => l.trim()).filter(Boolean)[0] ?? "Unknown error";
  return { code: "unknown", message: firstLine.slice(0, 300) };
}

function runEngineJson(args: string[]): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    execFile(
      ENGINE,
      args,
      { timeout: RESOLVE_TIMEOUT_MS, maxBuffer: 128 * 1024 * 1024, windowsHide: true },
      (err, stdout, stderr) => {
        if (err) {
          const cls = classifyError(stderr || String(err.message));
          reject(new EngineError(cls.code, cls.message, stderr));
          return;
        }
        try {
          resolve(JSON.parse(stdout));
        } catch {
          reject(new EngineError("parse", "The engine returned malformed metadata.", stdout.slice(0, 500)));
        }
      },
    );
  });
}

function summarizeFormats(formats: unknown): FormatInfo[] {
  if (!Array.isArray(formats)) return [];
  return formats
    .filter((f): f is Record<string, unknown> => !!f && typeof f === "object")
    .map((f) => ({
      format_id: String(f.format_id ?? ""),
      ext: String(f.ext ?? "?"),
      height: typeof f.height === "number" ? f.height : null,
      width: typeof f.width === "number" ? f.width : null,
      tbr: typeof f.tbr === "number" ? f.tbr : null,
      abr: typeof f.abr === "number" ? f.abr : null,
      vcodec: typeof f.vcodec === "string" && f.vcodec !== "none" ? f.vcodec : null,
      acodec: typeof f.acodec === "string" && f.acodec !== "none" ? f.acodec : null,
      format_note: typeof f.format_note === "string" ? f.format_note : null,
      filesize: typeof f.filesize === "number" ? f.filesize : typeof f.filesize_approx === "number" ? f.filesize_approx : null,
      fps: typeof f.fps === "number" ? f.fps : null,
    }))
    .filter((f) => f.format_id);
}

function pickThumbnail(thumbs: unknown): string | null {
  if (!Array.isArray(thumbs) || thumbs.length === 0) return null;
  const sorted = [...thumbs].sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
    const aw = typeof a.width === "number" ? a.width : 0;
    const bw = typeof b.width === "number" ? b.width : 0;
    return bw - aw;
  });
  const t = sorted[0] as Record<string, unknown>;
  return typeof t?.url === "string" ? t.url : null;
}

function summarizeVideo(raw: Record<string, unknown>): VideoInfo {
  return {
    id: String(raw.id ?? ""),
    title: String(raw.title ?? "Untitled"),
    uploader: typeof raw.uploader === "string" ? raw.uploader : typeof raw.channel === "string" ? raw.channel : null,
    duration: typeof raw.duration === "number" ? raw.duration : null,
    thumbnail: pickThumbnail(raw.thumbnails) ?? (typeof raw.thumbnail === "string" ? raw.thumbnail : null),
    view_count: typeof raw.view_count === "number" ? raw.view_count : null,
    extractor: typeof raw.extractor === "string" ? raw.extractor : null,
    webpage_url: typeof raw.webpage_url === "string" ? raw.webpage_url : String(raw.id),
    formats: summarizeFormats(raw.formats),
  };
}

/**
 * Probe a URL cheaply first (--flat-playlist), then pull full metadata for a
 * single video. Playlists come back with their entries; single videos with
 * their full format list.
 */
export async function probeUrl(rawUrl: string): Promise<ResolveResult> {
  const flat = await runEngineJson(["--flat-playlist", "-J", "--no-warnings", rawUrl]);

  const isPlaylist = flat._type === "playlist" || (Array.isArray(flat.entries) && (flat.entries as unknown[]).length > 0);
  if (isPlaylist) {
    const entries = (Array.isArray(flat.entries) ? flat.entries : [])
      .filter((e): e is Record<string, unknown> => !!e && typeof e === "object" && !!e.id && !!e.url)
      .map((e) => ({
        id: String(e.id),
        url: String(e.url),
        title: String(e.title ?? "Untitled"),
        duration: typeof e.duration === "number" ? e.duration : null,
        thumbnail: typeof e.thumbnail === "string" ? e.thumbnail : null,
        uploader: typeof e.uploader === "string" ? e.uploader : null,
      })) as FlatEntry[];

    const playlist: PlaylistInfo = {
      id: String(flat.id ?? ""),
      title: String(flat.title ?? "Playlist"),
      count: typeof flat.playlist_count === "number" ? flat.playlist_count : entries.length,
      uploader: typeof flat.uploader === "string" ? flat.uploader : null,
      thumbnail: pickThumbnail(flat.thumbnails) ?? (typeof flat.thumbnail === "string" ? flat.thumbnail : null),
      entries,
    };
    return { kind: "playlist", playlist };
  }

  const full = await runEngineJson(["-J", "--no-playlist", "--no-warnings", rawUrl]);
  return { kind: "video", video: summarizeVideo(full) };
}

/** Full extractor list — pulled from the engine once per server boot. */
let cachedExtractors: string[] | null = null;

export async function extractors(): Promise<string[]> {
  if (cachedExtractors) return cachedExtractors;
  const list = await new Promise<string[]>((resolve) => {
    execFile(ENGINE, ["--list-extractors"], { timeout: 30_000, windowsHide: true }, (err, stdout) => {
      if (err) {
        resolve([]);
        return;
      }
      resolve(stdout.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#")));
    });
  });
  cachedExtractors = list;
  return list;
}

export async function extractorCount(): Promise<number> {
  return (await extractors()).length;
}

export interface DownloadOptions {
  url: string;
  format: string;
  mergeFormat?: string;
  extractAudio?: boolean;
  audioFormat?: string;
  filenameTemplate: string;
  jobDir: string;
  onLine: (line: string) => void;
}

/** Spawn a real download; lines are emitted for progress parsing. */
export function startDownload(opts: DownloadOptions): ChildProcess {
  const args = [
    "--newline",
    "--progress",
    "--no-warnings",
    "--no-mtime",
    "-f",
    opts.format,
    "-o",
    path.join(opts.jobDir, opts.filenameTemplate),
  ];

  if (opts.extractAudio) {
    args.push("-x", "--audio-format", opts.audioFormat ?? "mp3");
  } else if (opts.mergeFormat) {
    args.push("--merge-output-format", opts.mergeFormat);
  }

  args.push(opts.url);

  const proc = spawn(ENGINE, args, { windowsHide: true });
  let buf = "";
  proc.stdout?.on("data", (chunk: Buffer) => {
    buf += chunk.toString("utf8");
    let idx: number;
    while ((idx = buf.indexOf("\n")) !== -1) {
      const line = buf.slice(0, idx).replace(/\r$/, "");
      buf = buf.slice(idx + 1);
      opts.onLine(line);
    }
  });
  proc.stderr?.on("data", (chunk: Buffer) => {
    const text = chunk.toString("utf8");
    // progress lines can land on stderr too
    for (const line of text.split(/\r?\n/)) {
      if (line.trim()) opts.onLine(line);
    }
  });
  proc.on("close", () => {
    if (buf.trim()) opts.onLine(buf.trim());
  });
  return proc;
}
