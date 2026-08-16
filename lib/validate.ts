/**
 * Server-side validation. Never trust raw client input — everything that
 * touches a shell command goes through here first. The engine is always
 * spawned with an args array (no shell: true), and these checks are a second layer.
 */

/** Return a normalized URL string, or null if the input is not a plain http(s) URL. */
export function sanitizeUrl(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (trimmed.length < 8 || trimmed.length > 2048) return null;
  // Reject raw whitespace / control characters — must be a plain URL
  if (/[\s\u0000-\u001f\u007f"']/.test(trimmed)) return null;

  let u: URL;
  try {
    u = new URL(trimmed);
  } catch {
    return null;
  }

  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  if (u.username || u.password) return null;
  if (!u.hostname.includes(".") && u.hostname !== "localhost") return null;
  return u.toString();
}

/** Allowlist of characters permitted in an engine -f format string. */
const FORMAT_STRING_RE = /^[a-zA-Z0-9_+./,\[\]()<>=!-]*$/;

export function sanitizeFormatString(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (trimmed.length === 0 || trimmed.length > 500) return null;
  if (!FORMAT_STRING_RE.test(trimmed)) return null;
  return trimmed;
}

/** Engine output template — only allow known %(...)s tokens and safe text. */
const TEMPLATE_TOKEN_RE = /^[a-zA-Z0-9_%().\s-]*$/;

export function sanitizeFilenameTemplate(input: unknown): string {
  if (typeof input !== "string" || input.length > 200) return "%(title)s.%(ext)s";
  if (!TEMPLATE_TOKEN_RE.test(input)) return "%(title)s.%(ext)s";
  return input.trim() || "%(title)s.%(ext)s";
}

const CONTAINERS = new Set(["mp4", "webm", "mkv", "mp3", "m4a", "opus", "wav", "flac"]);

export function sanitizeContainer(input: unknown): string | null {
  if (typeof input === "string" && CONTAINERS.has(input)) return input;
  return null;
}

export function sanitizeBool(input: unknown): boolean {
  return input === true;
}
