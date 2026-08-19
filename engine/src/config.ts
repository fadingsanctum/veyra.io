/**
 * Local engine configuration.
 *
 * The download destination is user-configurable (defaults to the OS Downloads
 * folder) and persisted to %LOCALAPPDATA%\Veyra\config.json. The engine also
 * resolves the bundled binaries (yt-dlp, ffmpeg) relative to the executable so
 * no PATH/environment fiddling is ever needed.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const ENGINE_VERSION = "1.0.0";
export const DEFAULT_PORT = 9911;

export const DATA_DIR = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), ".veyra"), "Veyra");
export const CONFIG_FILE = path.join(DATA_DIR, "config.json");

/** Directory next to the engine executable.
 *  - Compiled exe: process.execPath = veyra-engine.exe, so dirname = install root.
 *  - bun run:      process.execPath = bun.exe, so we fall back to engine/src cwd.
 */
export function appRoot(): string {
  const execDir = path.dirname(process.execPath);
  // If yt-dlp.exe exists next to process.execPath, that's the install dir
  const candidateName = process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp";
  if (fs.existsSync(path.join(execDir, "bin", candidateName))) {
    return execDir;
  }
  // Fallback: assume we're running from the engine/ source dir (bun run dev)
  // Walk up from cwd to find the engine root (has a bin/ folder)
  let dir = process.cwd();
  for (let i = 0; i < 5; i++) {
    if (fs.existsSync(path.join(dir, "bin", candidateName))) return dir;
    dir = path.dirname(dir);
  }
  return execDir;
}

export function binaryDir(): string {
  return path.join(appRoot(), "bin");
}

/** Platform-specific binary names inside bin/ — future non-Windows builds reuse this. */
export function engineBinaryPath(): string {
  const name = process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp";
  return path.join(binaryDir(), name);
}

export function ffmpegBinaryPath(): string {
  return path.join(binaryDir(), process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg");
}

export function ffprobeBinaryPath(): string {
  return path.join(binaryDir(), process.platform === "win32" ? "ffprobe.exe" : "ffprobe");
}

export interface EngineConfig {
  downloadDir: string;
  port: number;
  maxConcurrent: number;
}

export function defaultDownloadDir(): string {
  return path.join(os.homedir(), "Downloads");
}

export function loadConfig(): EngineConfig {
  const defaults: EngineConfig = { downloadDir: defaultDownloadDir(), port: DEFAULT_PORT, maxConcurrent: 3 };
  try {
    const raw = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
    if (typeof raw.downloadDir === "string" && raw.downloadDir.trim()) defaults.downloadDir = raw.downloadDir;
    if (typeof raw.port === "number" && raw.port >= 1 && raw.port <= 65535) defaults.port = raw.port;
    if (typeof raw.maxConcurrent === "number" && raw.maxConcurrent >= 1 && raw.maxConcurrent <= 8) defaults.maxConcurrent = raw.maxConcurrent;
  } catch {
    /* first run — defaults are fine */
  }
  return defaults;
}

export function saveConfig(cfg: EngineConfig): void {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), { mode: 0o600 });
  } catch (e) {
    console.warn(`[veyra-engine] Could not persist config: ${(e as Error).message}`);
  }
}

/**
 * Validate a user-supplied download directory. Must exist (or be creatable)
 * and must be a real directory — the engine refuses to treat arbitrary file
 * paths or nested fake paths as a download destination.
 */
export function resolveDownloadDir(input: string): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed || trimmed.length > 2048) return null;

  let resolved: string;
  try {
    resolved = path.resolve(trimmed);
  } catch {
    return null;
  }

  // Never allow clearing to the filesystem root or the temp overlay.
  const root = path.parse(resolved).root;
  if (resolved === root) return null;

  try {
    if (!fs.existsSync(resolved)) {
      fs.mkdirSync(resolved, { recursive: true });
    }
    const stat = fs.statSync(resolved);
    if (!stat.isDirectory()) return null;
  } catch {
    return null;
  }
  return resolved;
}