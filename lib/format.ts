import type { MediaType, VideoInfo } from "./types";

/** A single selectable row in the format dropdown. */
export interface FormatChoice {
  id: string; // stable id used for selection state
  label: string;
  sub: string;
  format: string; // the engine -f string
  height: number | null;
  ext: string | null;
}

export const VIDEO_CONTAINERS = ["mp4", "webm", "mkv"] as const;
export const AUDIO_FORMATS = ["mp3", "m4a", "opus", "wav", "flac"] as const;

const PRESET_HEIGHTS = [2160, 1440, 1080, 720, 480, 360];

export function formatBytes(bytes: number | null): string {
  if (!bytes || bytes <= 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 100 ? 0 : 1)} ${units[i]}`;
}

export function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return "";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const mm = String(m).padStart(h ? 2 : 1, "0");
  const ss = String(s).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function formatViews(views: number | null): string {
  if (!views || views <= 0) return "";
  if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1)}M views`;
  if (views >= 1_000) return `${(views / 1_000).toFixed(1)}K views`;
  return `${views} views`;
}

function kbps(v: number | null): string {
  return v ? `${Math.round(v)} kbps` : "";
}

function maxHeight(formats: VideoInfo["formats"]): number {
  return Math.max(0, ...formats.map((f) => f.height ?? 0));
}

/** Build the dropdown rows for a given media type. */
export function buildChoices(video: VideoInfo, type: MediaType): FormatChoice[] {
  const formats = video.formats ?? [];
  const hasVideo = (f: (typeof formats)[number]) => !!f.vcodec;
  const hasAudio = (f: (typeof formats)[number]) => !!f.acodec;

  if (type === "video+audio") {
    const out: FormatChoice[] = [
      {
        id: "auto",
        label: "Best quality (auto)",
        sub: "Highest video + best audio, merged",
        format: "bestvideo+bestaudio/best",
        height: null,
        ext: null,
      },
    ];

    // Progressive single-file formats (video + audio in one track)
    const progressive = formats
      .filter((f) => hasVideo(f) && hasAudio(f))
      .sort((a, b) => (b.height ?? 0) - (a.height ?? 0) || (b.tbr ?? 0) - (a.tbr ?? 0));

    const seen = new Set<number>();
    for (const f of progressive) {
      const h = f.height ?? 0;
      if (seen.has(h)) continue;
      seen.add(h);
      out.push({
        id: `f-${f.format_id}`,
        label: h ? `${h}p · ${f.ext}` : `${f.ext}`,
        sub: `${f.ext} · ${kbps(f.tbr)}${formatBytes(f.filesize) ? " · " + formatBytes(f.filesize) : ""}`,
        format: f.format_id,
        height: h,
        ext: f.ext,
      });
    }

    // If the source has no progressive formats, offer height presets instead
    if (progressive.length === 0) {
      const max = maxHeight(formats);
      for (const h of PRESET_HEIGHTS) {
        if (h <= max) {
          out.push({
            id: `h-${h}`,
            label: `${h}p (best effort)`,
            sub: `Best video ≤ ${h}p + best audio`,
            format: `bestvideo[height<=${h}]+bestaudio/best[height<=${h}]`,
            height: h,
            ext: null,
          });
        }
      }
    }

    return out;
  }

  if (type === "video") {
    const out: FormatChoice[] = [
      {
        id: "auto",
        label: "Best video (no audio)",
        sub: "Highest quality video stream only",
        format: "bestvideo/best",
        height: null,
        ext: null,
      },
    ];

    const videoOnly = formats
      .filter((f) => hasVideo(f) && !hasAudio(f))
      .sort((a, b) => (b.height ?? 0) - (a.height ?? 0) || (b.tbr ?? 0) - (a.tbr ?? 0));

    for (const f of videoOnly) {
      out.push({
        id: `f-${f.format_id}`,
        label: f.height ? `${f.height}p · ${f.ext}` : `${f.ext}`,
        sub: `${kbps(f.tbr)}${formatBytes(f.filesize) ? " · " + formatBytes(f.filesize) : ""}`,
        format: f.format_id,
        height: f.height,
        ext: f.ext,
      });
    }

    // Fallback: some sources only expose single-file formats
    const progressive = formats
      .filter((f) => hasVideo(f) && hasAudio(f))
      .sort((a, b) => (b.height ?? 0) - (a.height ?? 0));
    for (const f of progressive.slice(0, 6)) {
      out.push({
        id: `f-${f.format_id}`,
        label: f.height ? `${f.height}p · ${f.ext}` : f.ext,
        sub: `single-file (includes audio)`,
        format: f.format_id,
        height: f.height,
        ext: f.ext,
      });
    }

    return out;
  }

  // audio
  const out: FormatChoice[] = [
    {
      id: "auto",
      label: "Best audio (auto)",
      sub: "Best audio stream, converted to your chosen format",
      format: "bestaudio/best",
      height: null,
      ext: null,
    },
  ];

  const audioOnly = formats
    .filter((f) => !hasVideo(f) && hasAudio(f))
    .sort((a, b) => (b.abr ?? b.tbr ?? 0) - (a.abr ?? a.tbr ?? 0));

  for (const f of audioOnly) {
    out.push({
      id: `f-${f.format_id}`,
      label: `${kbps(f.abr || f.tbr)} · ${f.ext}`,
      sub: `${f.ext} · ${f.acodec?.split(".")[0] ?? ""}${formatBytes(f.filesize) ? " · " + formatBytes(f.filesize) : ""}`,
      format: f.format_id,
      height: null,
      ext: f.ext,
    });
  }

  return out;
}

export interface DownloadPayload {
  url: string;
  format: string;
  mergeFormat?: string; // mp4 | webm | mkv
  extractAudio?: boolean;
  audioFormat?: string; // mp3 | m4a | opus | wav | flac
  filenameTemplate?: string;
}

/** Build the /api/download payload from the UI selections. */
export function buildDownloadPayload(
  url: string,
  type: MediaType,
  choice: FormatChoice,
  container: string,
  filenameTemplate: string,
): DownloadPayload {
  const payload: DownloadPayload = {
    url,
    format: choice.format,
    filenameTemplate,
  };

  if (type === "audio") {
    payload.extractAudio = true;
    payload.audioFormat = container;
  } else if (container !== "mp4" || choice.format.includes("+")) {
    // Only meaningful when merging (or when the user explicitly picked a container)
    payload.mergeFormat = container;
  }

  return payload;
}
