/** Shared types between client and server. */

export type MediaType = "video+audio" | "video" | "audio";

export interface FormatInfo {
  format_id: string;
  ext: string;
  height: number | null;
  width: number | null;
  tbr: number | null; // total bitrate (kbps)
  abr: number | null; // audio bitrate (kbps)
  vcodec: string | null;
  acodec: string | null;
  format_note: string | null;
  filesize: number | null; // bytes
  fps: number | null;
}

export interface VideoInfo {
  id: string;
  title: string;
  uploader: string | null;
  duration: number | null; // seconds
  thumbnail: string | null;
  view_count: number | null;
  extractor: string | null;
  webpage_url: string;
  formats: FormatInfo[];
}

export interface FlatEntry {
  id: string;
  url: string;
  title: string;
  duration: number | null;
  thumbnail: string | null;
  uploader: string | null;
}

export interface PlaylistInfo {
  id: string;
  title: string;
  count: number;
  uploader: string | null;
  thumbnail: string | null;
  entries: FlatEntry[];
}

export type ResolveResult =
  | { kind: "video"; video: VideoInfo }
  | { kind: "playlist"; playlist: PlaylistInfo };

export interface ApiErrorBody {
  ok: false;
  error: { code: string; message: string; raw?: string | null };
}

export type JobStatus = "queued" | "running" | "done" | "error";

export interface Job {
  id: string;
  url: string;
  title: string | null;
  format: string;
  status: JobStatus;
  progress: number; // 0–100
  speed: string | null;
  eta: string | null;
  filename: string | null; // final file name on disk
  size: number | null; // bytes
  error: string | null;
  /** Raw engine stderr behind the classified error, so real causes are visible. */
  errorRaw: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface HistoryEntry {
  id: string;
  title: string;
  url: string;
  format: string;
  size: number | null;
  downloadedAt: number;
}
