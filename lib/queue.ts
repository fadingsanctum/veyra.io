/**
 * In-memory job queue for downloads.
 *
 * Downloads are long-running, so they must never hold an HTTP connection
 * open for minutes. POST /api/download enqueues a job and returns instantly;
 * the client polls GET /api/jobs/[id] for progress and fetches the finished
 * file from GET /api/jobs/[id]/file.
 *
 * Jobs live in a temp dir under the OS temp folder and are swept after a few
 * hours. For production, swap this module for a Redis-backed queue + a
 * separate worker container (Railway/Render/Fly.io) — the API surface stays
 * identical.
 */
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { bootstrapEngine, startDownload, classifyError } from "./engine";
import type { Job } from "./types";

const JOBS_ROOT = path.join(os.tmpdir(), "veyra-jobs");
const MAX_CONCURRENT = Math.max(1, Number(process.env.VEYRA_MAX_CONCURRENT || 3));
const JOB_TTL_MS = 6 * 60 * 60 * 1000; // sweep finished jobs after 6h

interface QueuedSpec {
  url: string;
  format: string;
  mergeFormat?: string;
  extractAudio?: boolean;
  audioFormat?: string;
  filenameTemplate: string;
}

class JobQueue {
  private jobs = new Map<string, Job>();
  private specs = new Map<string, QueuedSpec>();
  private waiters: string[] = [];
  private active = 0;
  maxConcurrent = MAX_CONCURRENT;
  private sweepTimer: NodeJS.Timeout | null = null;

  constructor() {
    try {
      fs.mkdirSync(JOBS_ROOT, { recursive: true });
    } catch {
      /* tmp dir issues — jobs will fail to write and surface as errors */
    }
  }

  enqueue(spec: QueuedSpec): Job {
    const id = randomUUID();
    const job: Job = {
      id,
      url: spec.url,
      title: null,
      format: spec.format,
      status: "queued",
      progress: 0,
      speed: null,
      eta: null,
      filename: null,
      size: null,
      error: null,
      errorRaw: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.jobs.set(id, job);
    this.specs.set(id, spec);
    this.waiters.push(id);
    this.pump();
    this.scheduleSweep();
    return job;
  }

  get(id: string): Job | undefined {
    return this.jobs.get(id);
  }

  list(): Job[] {
    return [...this.jobs.values()].sort((a, b) => b.createdAt - a.createdAt);
  }

  remove(id: string): boolean {
    const job = this.jobs.get(id);
    if (!job) return false;
    if (job.status === "queued") {
      this.waiters = this.waiters.filter((w) => w !== id);
    }
    this.jobs.delete(id);
    this.specs.delete(id);
    try {
      fs.rmSync(jobDir(id), { recursive: true, force: true });
    } catch {
      /* already gone */
    }
    return true;
  }

  private pump() {
    while (this.active < this.maxConcurrent && this.waiters.length > 0) {
      const id = this.waiters.shift()!;
      const job = this.jobs.get(id);
      const spec = this.specs.get(id);
      if (!job || !spec) continue;
      this.active++;
      job.status = "running";
      job.updatedAt = Date.now();
      this.runJob(id, spec).finally(() => {
        this.active--;
        this.pump();
      });
    }
  }

  private async runJob(id: string, spec: QueuedSpec): Promise<void> {
    const job = this.jobs.get(id);
    if (!job) return;

    const dir = jobDir(id);
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch (e) {
      this.fail(job, `Could not create temp directory: ${(e as Error).message}`);
      return;
    }

    // Auto-install the engine if it isn't present yet — the first job on a
    // fresh worker waits for the install so it succeeds instead of failing.
    // If the install fails, the spawn below ENOENTs and surfaces engine_missing.
    await bootstrapEngine();

    const proc = startDownload({
      url: spec.url,
      format: spec.format,
      mergeFormat: spec.mergeFormat,
      extractAudio: spec.extractAudio,
      audioFormat: spec.audioFormat,
      filenameTemplate: spec.filenameTemplate,
      jobDir: dir,
      onLine: (line) => this.handleLine(job, line),
    });

    const timeout = setTimeout(() => {
      proc.kill("SIGKILL");
      this.fail(job, "Download timed out after 30 minutes.");
    }, 30 * 60 * 1000);

    proc.on("error", (err) => {
      clearTimeout(timeout);
      this.fail(job, err.message);
    });

    proc.on("close", (code) => {
      clearTimeout(timeout);
      if (job.status === "error") return;
      if (code === 0) {
        // Finalize: locate the largest file in the job dir (merged/converted output)
        try {
          const files = fs.readdirSync(dir).filter((f) => !f.startsWith("."));
          const stats = files
            .map((f) => ({ name: f, stat: fs.statSync(path.join(dir, f)) }))
            .filter((f) => f.stat.isFile())
            .sort((a, b) => b.stat.size - a.stat.size);
          if (stats.length > 0) {
            const top = stats[0];
            job.filename = top.name;
            job.size = top.stat.size;
            job.progress = 100;
          }
        } catch {
          /* dir vanished */
        }
        if (!job.filename) {
          this.fail(job, "The engine finished but no output file was found.");
          return;
        }
        job.status = "done";
        job.progress = 100;
        job.speed = null;
        job.eta = null;
        job.updatedAt = Date.now();
      } else {
        // Prefer the engine's own ERROR line (captured in handleLine) over a
        // generic exit-code message, so the real cause stays visible.
        const raw = job.errorRaw?.trim() || `The download engine exited with code ${code}.`;
        this.fail(job, raw);
      }
    });
  }

  private handleLine(job: Job, line: string) {
    if (job.status === "error") return;

    // Capture the destination line for the final filename
    if (line.startsWith("[download] Destination:")) {
      const name = line.slice(line.indexOf(":") + 1).trim();
      if (name) {
        job.filename = path.basename(name);
        if (!job.title) job.title = job.filename.replace(/\.[^.]+$/, "");
      }
    }

    // Progress lines: [download]  42.3% of 25.32MiB at 1.24MiB/s ETA 00:20
    const m = line.match(/\[download\]\s+([\d.]+)%(?:\s+of\s+([\d.]+)([a-zA-Z]+))?(?:\s+at\s+([\d.]+)([a-zA-Z/]+))?(?:\s+ETA\s+([\d:]+))?/);
    if (m) {
      const pct = Math.min(99.5, parseFloat(m[1]));
      job.progress = Math.max(job.progress, pct);
      if (m[4] && m[5]) job.speed = `${m[4]} ${m[5]}`;
      if (m[6]) job.eta = m[6];
      job.updatedAt = Date.now();
      return;
    }

    // Playlist-style lines are not expected (single URL per job), but capture errors
    if (line.startsWith("ERROR:")) {
      const raw = line.slice(6).trim();
      job.error = raw;
      job.errorRaw = raw;
    }
  }

  private fail(job: Job, message: string) {
    if (job.status === "error" || job.status === "done") return;
    const cls = classifyError(message);
    job.status = "error";
    job.errorRaw = message;
    job.error = cls.message;
    job.updatedAt = Date.now();
  }

  private scheduleSweep() {
    if (this.sweepTimer) return;
    this.sweepTimer = setInterval(() => {
      const cutoff = Date.now() - JOB_TTL_MS;
      for (const job of this.jobs.values()) {
        if ((job.status === "done" || job.status === "error") && job.updatedAt < cutoff) {
          this.remove(job.id);
        }
      }
    }, 10 * 60 * 1000);
    this.sweepTimer.unref();
  }
}

function jobDir(id: string): string {
  return path.join(JOBS_ROOT, id);
}

export const jobQueue = new JobQueue();
