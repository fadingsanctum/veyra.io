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
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { FlatEntry, FormatInfo, PlaylistInfo, ResolveResult, VideoInfo } from "./types";

const RESOLVE_TIMEOUT_MS = 90_000;

/*
 * Engine binary discovery.
 *
 * The engine is spawned by name (yt-dlp), which fails with `spawn yt-dlp ENOENT`
 * when it isn't on the process PATH — common when it's installed via pip into a
 * user Scripts dir, pipx, or a Homebrew prefix that isn't exported to this
 * process. We resolve the binary once, in order of preference:
 *
 *   1. VEYRA_ENGINE_PATH (explicit path or name)
 *   2. PATH lookup
 *   3. common install locations for the current platform
 *
 * If nothing is found we fall back to the bare name and let the spawn fail,
 * which classifyError() turns into a clear `engine_missing` error.
 */

const ENGINE_NAME = "yt-dlp";
const ENGINE_NAME_WIN = "yt-dlp.exe";

/**
 * Self-bootstrap: when the engine is missing we download the official yt-dlp
 * binary into ~/.veyra/bin (once per machine/container) and use that. This
 * makes fresh workers work with zero manual setup. Set VEYRA_NO_AUTO_BOOTSTRAP=1
 * to disable (e.g. air-gapped hosts that must fail loudly instead).
 */
const BOOTSTRAP_ENABLED = process.env.VEYRA_NO_AUTO_BOOTSTRAP !== "1";
const BOOTSTRAP_DIR = path.join(os.homedir(), ".veyra", "bin");
let bootstrapPromise: Promise<string | null> | null = null;

/** Official static binaries, per platform. */
function bootstrapUrl(): string {
  const base = "https://github.com/yt-dlp/yt-dlp/releases/latest/download";
  if (process.platform === "win32") return `${base}/yt-dlp.exe`;
  if (process.platform === "darwin") return `${base}/yt-dlp_macos`;
  return `${base}/${process.arch === "arm64" ? "yt-dlp_linux_aarch64" : "yt-dlp_linux"}`;
}

async function downloadEngine(): Promise<string | null> {
  const url = bootstrapUrl();
  const target = path.join(BOOTSTRAP_DIR, process.platform === "win32" ? ENGINE_NAME_WIN : ENGINE_NAME);
  try {
    fs.mkdirSync(BOOTSTRAP_DIR, { recursive: true });
    const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(120_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(target, buf);
    if (process.platform !== "win32") fs.chmodSync(target, 0o755);

    // Verify it actually runs before trusting it.
    const version = await new Promise<string>((resolve, reject) => {
      execFile(target, ["--version"], { timeout: 30_000, windowsHide: true }, (err, stdout) => {
        if (err) reject(err);
        else resolve(stdout.trim());
      });
    });
    console.warn(`[veyra] Download engine auto-installed (yt-dlp ${version}) at ${target}`);
    return target;
  } catch (e) {
    console.warn(
      `[veyra] Could not auto-install the download engine: ${(e as Error).message}. ` +
        `Install yt-dlp manually or set VEYRA_ENGINE_PATH to the binary.`,
    );
    try {
      fs.rmSync(target, { force: true });
    } catch {
      /* ignore */
    }
    return null;
  }
}

/**
 * Ensure the engine binary exists. Resolves immediately when one is already
 * available; otherwise starts (once) the auto-install and waits for it.
 * Returns the binary path, or null if the engine is unavailable.
 */
export function bootstrapEngine(): Promise<string | null> {
  if (resolveEngine().found) return Promise.resolve(engineBinary());
  if (!BOOTSTRAP_ENABLED) return Promise.resolve(null);
  if (!bootstrapPromise) {
    bootstrapPromise = downloadEngine().then((binary) => {
      if (binary) cachedResolve = { binary, found: true };
      return binary;
    });
  }
  return bootstrapPromise;
}

/** Directories where the engine commonly lands without being on PATH. */
function commonEngineDirs(): string[] {
  const home = os.homedir();
  const dirs = [path.join(home, ".local", "bin"), path.join(home, "bin"), "/opt/homebrew/bin", "/usr/local/bin"];

  if (process.platform === "win32") {
    const localAppData = process.env.LOCALAPPDATA;
    const appData = process.env.APPDATA;
    if (localAppData) {
      // pip installs: %LOCALAPPDATA%\Programs\Python\Python3xx\Scripts
      const pyRoot = path.join(localAppData, "Programs", "Python");
      try {
        for (const entry of fs.readdirSync(pyRoot)) {
          if (/^Python\d+/.test(entry)) dirs.push(path.join(pyRoot, entry, "Scripts"));
        }
      } catch {
        /* no per-user Python install */
      }
      // WinGet shims
      dirs.push(path.join(localAppData, "Microsoft", "WinGet", "Links"));
    }
    if (appData) {
      // pip --user installs: %APPDATA%\Python\Python3xx\Scripts
      const pyRoot = path.join(appData, "Python");
      try {
        for (const entry of fs.readdirSync(pyRoot)) {
          if (/^Python\d+/.test(entry)) dirs.push(path.join(pyRoot, entry, "Scripts"));
        }
      } catch {
        /* no user-site Python */
      }
    }
    if (home) dirs.push(path.join(home, ".local", "bin")); // Git-Bash / MSYS world
  }

  return dirs;
}

function isExecutable(file: string): boolean {
  try {
    fs.accessSync(file, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function findInDir(dir: string): string | null {
  const names = process.platform === "win32" ? [ENGINE_NAME_WIN, ENGINE_NAME] : [ENGINE_NAME];
  for (const name of names) {
    const candidate = path.join(dir, name);
    if (isExecutable(candidate)) return candidate;
  }
  return null;
}

function findOnPath(name = ENGINE_NAME): string | null {
  const pathVar = process.env.PATH ?? "";
  const sep = process.platform === "win32" ? ";" : ":";
  for (const dir of pathVar.split(sep)) {
    if (!dir) continue;
    const candidate = path.join(dir, name);
    if (isExecutable(candidate)) return candidate;
  }
  return null;
}

let cachedResolve: { binary: string; found: boolean } | null = null;

function resolveEngine(): { binary: string; found: boolean } {
  if (cachedResolve) return cachedResolve;

  // 1. Explicit env var. A path must exist; a bare name is trusted (the OS
  //    resolves it via PATH), but resolved to an absolute path when possible.
  const env = process.env.VEYRA_ENGINE_PATH?.trim();
  if (env) {
    const looksLikePath = path.isAbsolute(env) || env.includes("/") || env.includes("\\");
    if (looksLikePath) {
      cachedResolve = { binary: env, found: isExecutable(env) };
      return cachedResolve;
    }
    const onPath = findOnPath(env);
    cachedResolve = onPath ? { binary: onPath, found: true } : { binary: env, found: true };
    return cachedResolve;
  }

  // 2. PATH lookup (try the .exe variant too on Windows)
  const pathNames = process.platform === "win32" ? [ENGINE_NAME, ENGINE_NAME_WIN] : [ENGINE_NAME];
  for (const name of pathNames) {
    const onPath = findOnPath(name);
    if (onPath) {
      cachedResolve = { binary: onPath, found: true };
      return cachedResolve;
    }
  }

  // 3. Common install locations
  for (const dir of commonEngineDirs()) {
    const found = findInDir(dir);
    if (found) {
      cachedResolve = { binary: found, found: true };
      return cachedResolve;
    }
  }

  // 4. Give up — spawn will fail with ENOENT, surfaced as `engine_missing`.
  cachedResolve = { binary: ENGINE_NAME, found: false };
  // Kick off the auto-install in the background so it's ready for the next call.
  if (BOOTSTRAP_ENABLED) void bootstrapEngine();
  return cachedResolve;
}

/** Absolute path (or bare name) to use when spawning the engine. */
export function engineBinary(): string {
  return resolveEngine().binary;
}

/** Whether a usable engine binary was found on this server. */
export function engineAvailable(): boolean {
  return resolveEngine().found;
}

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
  if (s.includes("enoent") || s.includes("not recognized as an internal or external command")) {
    return {
      code: "engine_missing",
      message:
        "Veyra's download engine isn't installed on this server. Install yt-dlp and make sure it's on PATH, or set VEYRA_ENGINE_PATH to the binary.",
    };
  }
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
      engineBinary(),
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
  await bootstrapEngine();
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
  await bootstrapEngine();
  const list = await new Promise<string[]>((resolve) => {
    execFile(engineBinary(), ["--list-extractors"], { timeout: 30_000, windowsHide: true }, (err, stdout) => {
      if (err) {
        // Don't cache a failure — the engine may be installed or bootstrapped later.
        resolve([]);
        return;
      }
      resolve(stdout.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#")));
    });
  });
  if (list.length > 0) cachedExtractors = list;
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

  const proc = spawn(engineBinary(), args, { windowsHide: true });
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
