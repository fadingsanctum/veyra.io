/**
 * In-memory job queue for downloads — ported from the web app's lib/queue.ts.
 *
 * Writes into a temp subfolder during download, then moves the finished file
 * to the user's configured download folder on success.
 */
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { ChildProcess } from "node:child_process";
import { startDownload, classifyError, EngineError } from "./engine";
import type { Job } from "./types";

const JOB_TTL_MS = 6 * 60 * 60 * 1000;
const JOB_TIMEOUT_MS = 30 * 60 * 1000;

export interface QueuedSpec {
  url: string;
  format: string;
  mergeFormat?: string;
  extractAudio?: boolean;
  audioFormat?: string;
  filenameTemplate: string;
  downloadDir: string;
}

export class JobQueue {
  private jobs = new Map<string, Job>();
  private specs = new Map<string, QueuedSpec>();
  private waiters: string[] = [];
  private active = 0;
  maxConcurrent = 3;
  private sweepTimer: NodeJS.Timeout | null = null;

  enqueue(spec: QueuedSpec): { ok: true; job: Job } | { ok: false; error: { code: string; message: string } } {
    let dirOk = false;
    try {
      if (!fs.existsSync(spec.downloadDir)) fs.mkdirSync(spec.downloadDir, { recursive: true });
      dirOk = fs.existsSync(spec.downloadDir);
    } catch { dirOk = false; }
    if (!dirOk) {
      return { ok: false, error: { code: "download_dir", message: `The download folder "${spec.downloadDir}" isn't writable.` } };
    }
    const id = randomUUID();
    const job: Job = { id, url: spec.url, title: null, format: spec.format, status: "queued", progress: 0, speed: null, eta: null, filename: null, size: null, error: null, errorRaw: null, code: null, createdAt: Date.now(), updatedAt: Date.now() };
    this.jobs.set(id, job);
    this.specs.set(id, spec);
    this.waiters.push(id);
    this.pump();
    this.scheduleSweep();
    return { ok: true, job };
  }

  get(id: string): Job | undefined { return this.jobs.get(id); }
  list(): Job[] { return [...this.jobs.values()].sort((a, b) => b.createdAt - a.createdAt); }

  remove(id: string): boolean {
    const job = this.jobs.get(id);
    if (!job) return false;
    if (job.status === "queued") this.waiters = this.waiters.filter((w) => w !== id);
    this.jobs.delete(id);
    this.specs.delete(id);
    return true;
  }

  cancelRunning(id: string): boolean {
    const proc = this.running.get(id);
    if (proc) { proc.kill(); return true; }
    return false;
  }

  private running = new Map<string, ChildProcess>();

  private pump() {
    while (this.active < this.maxConcurrent && this.waiters.length > 0) {
      const id = this.waiters.shift()!;
      const job = this.jobs.get(id);
      const spec = this.specs.get(id);
      if (!job || !spec) continue;
      this.active++;
      job.status = "running";
      job.updatedAt = Date.now();
      this.runJob(id, spec).finally(() => { this.active--; this.pump(); });
    }
  }

  private async runJob(id: string, spec: QueuedSpec): Promise<void> {
    const job = this.jobs.get(id);
    if (!job) return;

    const dir = path.join(spec.downloadDir, `.veyra-tmp-${id}`);
    try { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); }
    catch (e) { this.fail(job, `Could not create a working folder: ${(e as Error).message}`); return; }

    let proc: ChildProcess;
    try {
      proc = startDownload({
        url: spec.url, format: spec.format, mergeFormat: spec.mergeFormat,
        extractAudio: spec.extractAudio, audioFormat: spec.audioFormat,
        filenameTemplate: spec.filenameTemplate, jobDir: dir,
        onLine: (line) => this.handleLine(job, line),
      });
    } catch (e) {
      if (e instanceof EngineError) this.fail(job, e.message); else this.fail(job, (e as Error).message);
      return;
    }
    this.running.set(id, proc);

    const timeout = setTimeout(() => { proc.kill("SIGKILL"); this.fail(job, "Download timed out after 30 minutes."); }, JOB_TIMEOUT_MS);

    proc.on("error", (err) => { clearTimeout(timeout); this.fail(job, err.message); });

    proc.on("close", (code) => {
      clearTimeout(timeout);
      this.running.delete(id);
      if (job.status === "error" || job.status === "done") return;

      if (code === 0) {
        try {
          const files = fs.readdirSync(dir).filter((f) => !f.startsWith("."));
          const stats = files.map((f) => ({ name: f, stat: fs.statSync(path.join(dir, f)) })).filter((f) => f.stat.isFile()).sort((a, b) => b.stat.size - a.stat.size);
          if (stats.length > 0) {
            const top = stats[0];
            const finalPath = path.join(spec.downloadDir, top.name);
            if (fs.existsSync(finalPath)) {
              const ext = path.extname(top.name);
              const base = path.basename(top.name, ext);
              const newName = `${base}-${Date.now()}${ext}`;
              fs.renameSync(path.join(dir, top.name), path.join(spec.downloadDir, newName));
              job.filename = newName;
            } else {
              fs.renameSync(path.join(dir, top.name), finalPath);
              job.filename = top.name;
            }
            job.size = top.stat.size;
            job.progress = 100;
          }
        } catch (e) { this.fail(job, `Finalizing file failed: ${(e as Error).message}`); return; }

        try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }

        if (!job.filename) { this.fail(job, "The engine finished but no output file was found."); return; }
        job.status = "done";
        job.progress = 100;
        job.speed = null;
        job.eta = null;
        job.updatedAt = Date.now();
      } else {
        const raw = job.errorRaw?.trim() || `The download engine exited with code ${code}.`;
        this.fail(job, raw);
        try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
      }
    });
  }

  private handleLine(job: Job, line: string) {
    if (job.status === "error") return;

    if (line.startsWith("[download] Destination:")) {
      const name = line.slice(line.indexOf(":") + 1).trim();
      if (name) {
        job.filename = path.basename(name);
        if (!job.title) job.title = job.filename.replace(/\.[^.]+$/, "");
      }
    }

    const m = line.match(/\[download\]\s+([\d.]+)%(?:\s+of\s+([\d.]+)([a-zA-Z]+))?(?:\s+at\s+([\d.]+)([a-zA-Z/]+))?(?:\s+ETA\s+([\d:]+))?/);
    if (m) {
      const pct = Math.min(99.5, parseFloat(m[1]));
      job.progress = Math.max(job.progress, pct);
      if (m[4] && m[5]) job.speed = `${m[4]} ${m[5]}`;
      if (m[6]) job.eta = m[6];
      job.updatedAt = Date.now();
      return;
    }

    if (line.startsWith("ERROR:")) {
      const raw = line.slice(6).trim();
      job.error = raw;
      job.errorRaw = raw;
    }
  }

  private fail(job: Job, message: string) {
    if (job.status === "error" || job.status === "done") return;
    const { code, message: friendly } = classifyError(message);
    job.status = "error";
    job.errorRaw = message;
    job.error = friendly;
    job.code = code;
    job.updatedAt = Date.now();
  }

  private scheduleSweep() {
    if (this.sweepTimer) return;
    this.sweepTimer = setInterval(() => {
      const cutoff = Date.now() - JOB_TTL_MS;
      for (const job of this.jobs.values()) { if ((job.status === "done" || job.status === "error") && job.updatedAt < cutoff) this.remove(job.id); }
    }, 10 * 60 * 1000);
    this.sweepTimer.unref();
  }
}

export const jobQueue = new JobQueue();