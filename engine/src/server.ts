/**
 * Veyra local engine — HTTP API.
 *
 * Binds strictly to 127.0.0.1 and only serves requests whose Origin belongs to
 * the Veyra website (or non-browser tooling such as curl). No arbitrary command
 * execution: every endpoint validates input exactly like lib/validate.ts.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { ENGINE_VERSION, loadConfig, saveConfig, resolveDownloadDir, engineBinaryPath } from "./config";
import { probeUrl, extractors, extractorCount, ytDlpVersion, EngineError } from "./engine";
import { jobQueue } from "./queue";
import { sanitizeUrl, sanitizeFormatString, sanitizeContainer, sanitizeBool, sanitizeFilenameTemplate } from "./validate";

process.on("uncaughtException", (err) => { console.error(`[veyra] FATAL: ${err.message}\n${err.stack}`); });
process.on("unhandledRejection", (r) => { console.error(`[veyra] UNHANDLED: ${r}`); });
process.on("SIGTERM", () => process.exit(0));
process.on("SIGINT", () => process.exit(0));

const HOST = "127.0.0.1";
const PORT = Number(process.env.VEYRA_ENGINE_PORT || loadConfig().port) || 9911;

const ALLOWED_ORIGINS = new Set<string>([
  "http://localhost:3000", "http://localhost:3001", "http://127.0.0.1:3000",
  "https://veyra.io", "https://www.veyra.io", "https://veyra-com.vercel.app", "https://veyra.vercel.app",
]);
for (const o of (process.env.VEYRA_ALLOWED_ORIGINS ?? "").split(",")) { const t = o.trim(); if (t) ALLOWED_ORIGINS.add(t); }

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" };
function ok(data: unknown): Response { return Response.json({ ok: true, ...(data as object) }, { headers: CORS }); }
function err(status: number, code: string, message: string, raw: string | null = null): Response { return Response.json({ ok: false, error: { code, message, raw } }, { status, headers: CORS }); }
function originAllowed(req: Request): boolean { const o = req.headers.get("origin"); return !o || ALLOWED_ORIGINS.has(o); }
function clientIp(req: Request): string { return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local"; }

const buckets = new Map<string, number[]>();
function reqOk(key: string, ip: string, limit: number, windowMs: number): boolean {
  const now = Date.now(); const k = `${key}:${ip}`;
  let hits = buckets.get(k) ?? []; hits = hits.filter((t) => now - t < windowMs);
  if (hits.length >= limit) return false; hits.push(now); buckets.set(k, hits); return true;
}
setInterval(() => { const now = Date.now(); for (const [k, h] of buckets) { if (h.every((t) => now - t > 3600_000)) buckets.delete(k); } }, 600_000).unref?.();

Bun.serve({
  hostname: HOST, port: PORT,
  async fetch(req) {
    if (!originAllowed(req)) return err(403, "forbidden", "This request isn't allowed.");
    const url = new URL(req.url);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    const p = url.pathname;

    try {
      if (req.method === "GET" && p === "/v1/status") {
        const [ver, cnt] = await Promise.all([ytDlpVersion(), extractorCount()]);
        return ok({ version: ENGINE_VERSION, engine: "veyra-engine", ok: true, ytDlpVersion: ver, extractors: cnt, ffmpeg: fs.existsSync(path.join(path.dirname(engineBinaryPath()), "ffmpeg.exe")), downloadDir: loadConfig().downloadDir, port: PORT });
      }

      if (req.method === "POST" && p === "/v1/probe") {
        if (!reqOk("probe", clientIp(req), 20, 60_000)) return err(429, "rate_limited", "Too many requests. Slow down.");
        const body = await req.json().catch(() => null);
        const u = typeof (body as any)?.url === "string" ? sanitizeUrl((body as any).url) : null;
        if (!u) return err(400, "invalid_url", "That doesn't look like a valid link. Paste a full URL starting with http(s)://");
        try { return ok({ ...(await probeUrl(u)) }); }
        catch (e) { if (e instanceof EngineError) return err(422, e.code, e.message, (e.stderr ?? "").slice(0, 4000) || null); return err(500, "unknown", "Unexpected error while probing the link."); }
      }

      if (req.method === "POST" && p === "/v1/download") {
        if (!reqOk("download", clientIp(req), 40, 3600_000)) return err(429, "rate_limited", "Download limit reached. Try again soon.");
        const b = (await req.json().catch(() => null) ?? {}) as Record<string, unknown>;
        const url = sanitizeUrl(b.url); if (!url) return err(400, "invalid_url", "Invalid URL.");
        const format = sanitizeFormatString(b.format); if (!format) return err(400, "invalid_format", "Invalid format selection.");
        const extractAudio = sanitizeBool(b.extractAudio);
        const audioFormat = extractAudio ? sanitizeContainer(b.audioFormat) ?? "mp3" : undefined;
        const mergeFormat = !extractAudio ? sanitizeContainer(b.mergeFormat) ?? undefined : undefined;
        const filenameTemplate = sanitizeFilenameTemplate(b.filenameTemplate);
        const cfg = loadConfig();
        if (typeof b.concurrentLimit === "number" && b.concurrentLimit >= 1 && b.concurrentLimit <= 8) jobQueue.maxConcurrent = b.concurrentLimit;
        const enq = jobQueue.enqueue({ url, format, mergeFormat, extractAudio, audioFormat, filenameTemplate, downloadDir: cfg.downloadDir });
        if (!enq.ok) return err(400, enq.error.code, enq.error.message);
        return ok({ job: enq.job });
      }

      if (req.method === "GET" && p === "/v1/jobs") return ok({ jobs: jobQueue.list() });

      const jm = p.match(/^\/v1\/jobs\/([0-9a-f-]{36})$/);
      if (jm) {
        const id = jm[1]; const job = jobQueue.get(id); if (!job) return err(404, "not_found", "Job not found.");
        if (req.method === "GET") return ok({ job });
        if (req.method === "DELETE") { jobQueue.remove(id); return ok({ deleted: true }); }
        return err(405, "method", "Method not allowed.");
      }

      const cm = p.match(/^\/v1\/jobs\/([0-9a-f-]{36})\/cancel$/);
      if (cm && req.method === "POST") { const id = cm[1]; if (!jobQueue.get(id)) return err(404, "not_found", "Job not found."); jobQueue.cancelRunning(id); jobQueue.remove(id); return ok({ cancelled: true }); }

      const om = p.match(/^\/v1\/jobs\/([0-9a-f-]{36})\/open-folder$/);
      if (om && req.method === "POST") {
        const id = om[1]; const job = jobQueue.get(id); if (!job) return err(404, "not_found", "Job not found.");
        const cfg = loadConfig(); const fp = job.filename ? path.join(cfg.downloadDir, job.filename) : null;
        if (fp && fs.existsSync(fp)) { if (process.platform === "win32") spawn("explorer.exe", ["/select,\"" + fp + "\""], { windowsHide: true }); else spawn("xdg-open", [cfg.downloadDir]); return ok({ opened: true }); }
        const dir = cfg.downloadDir;
        if (fs.existsSync(dir)) { if (process.platform === "win32") spawn("explorer.exe", [dir], { windowsHide: true }); else spawn("xdg-open", [dir]); return ok({ opened: true }); }
        return err(404, "not_found", "The file or download folder isn't available.");
      }

      if (req.method === "GET" && p === "/v1/settings") return ok({ settings: loadConfig() });
      if (req.method === "POST" && p === "/v1/settings") {
        const b = (await req.json().catch(() => null) ?? {}) as Record<string, unknown>; const cfg = loadConfig();
        if (typeof b.downloadDir === "string") { const dir = resolveDownloadDir(b.downloadDir); if (!dir) return err(400, "invalid_dir", "That download folder isn't usable."); cfg.downloadDir = dir; }
        if (typeof b.maxConcurrent === "number" && b.maxConcurrent >= 1 && b.maxConcurrent <= 8) cfg.maxConcurrent = b.maxConcurrent;
        saveConfig(cfg); return ok({ settings: cfg });
      }

      if (req.method === "GET" && p === "/v1/sites") return ok({ count: (await extractors()).length, sites: await extractors() });
      return err(404, "not_found", "Not found.");
    } catch (e) {
      console.error(`[veyra] ${(e as Error).message}`);
      return err(500, "unknown", "Unexpected engine error.");
    }
  },
});

console.log(`[veyra] listening on http://${HOST}:${PORT} (v${ENGINE_VERSION})`);
