"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Download, Loader2, Trash2, X, XCircle } from "lucide-react";
import type { Job } from "@/lib/types";
import { formatBytes } from "@/lib/format";
import { ProgressCrack } from "./progress-crack";

interface QueueViewProps {
  jobs: Job[];
  onCancel: (id: string) => void;
  onSave: (job: Job) => void;
}

const STATUS_META: Record<Job["status"], { label: string; icon: typeof Loader2 }> = {
  queued: { label: "Queued", icon: Loader2 },
  running: { label: "Downloading", icon: Loader2 },
  done: { label: "Ready", icon: CheckCircle2 },
  error: { label: "Failed", icon: XCircle },
};

export function QueueView({ jobs, onCancel, onSave }: QueueViewProps) {
  return (
    <section aria-label="Download queue" className="mt-8 w-full">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.24em] text-dim">
          Queue <span className="text-ember">({jobs.length})</span>
        </h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-dim/60">
          concurrent · {jobs.some((j) => j.status === "running") ? "active" : "idle"}
        </span>
      </div>

      <ul className="space-y-3">
        <AnimatePresence initial={false}>
          {jobs.map((job) => {
            const meta = STATUS_META[job.status];
            const Icon = meta.icon;
            return (
              <motion.li
                key={job.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                transition={{ duration: 0.25 }}
                className="rounded-lg border border-rust bg-panel/80 p-3.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-bone">
                      {job.title ?? job.url}
                    </p>
                    <p className="font-mono mt-0.5 truncate text-[11px] text-dim">
                      {job.format}
                      {job.size ? ` · ${formatBytes(job.size)}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {job.status === "done" && (
                      <>
                        <button
                          onClick={() => onSave(job)}
                          className="flex h-8 items-center gap-1.5 rounded-md bg-blood px-3 text-xs font-medium text-bone transition-colors hover:bg-ember"
                          aria-label={`Save ${job.filename ?? "file"}`}
                        >
                          <Download size={13} /> Save
                        </button>
                        <button
                          onClick={() => onCancel(job.id)}
                          className="flex h-8 w-8 items-center justify-center rounded-md border border-rust text-dim transition-colors hover:border-ember/60 hover:text-ember"
                          aria-label={`Clear ${job.filename ?? "item"} from the queue`}
                          title="Clear"
                        >
                          <X size={14} />
                        </button>
                      </>
                    )}
                    {(job.status === "queued" || job.status === "running") && (
                      <button
                        onClick={() => onCancel(job.id)}
                        className="flex h-8 items-center gap-1 rounded-md border border-rust px-2.5 text-xs text-dim transition-colors hover:border-blood/60 hover:text-blood"
                        aria-label="Cancel download"
                      >
                        <Trash2 size={13} /> Cancel
                      </button>
                    )}
                    {job.status === "error" && (
                      <button
                        onClick={() => onCancel(job.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-md border border-rust text-dim transition-colors hover:text-blood"
                        aria-label="Dismiss"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-3">
                  <ProgressCrack percent={job.progress} status={job.status} />
                </div>

                <div className="font-mono mt-2 flex items-center justify-between text-[10px] uppercase tracking-[0.16em] text-dim">
                  <span className={`flex items-center gap-1.5 ${job.status === "error" ? "text-blood" : job.status === "done" ? "text-ember" : ""}`}>
                    <Icon size={11} className={job.status === "running" ? "animate-[pulse-dot_1.4s_ease-in-out_infinite]" : ""} />
                    {job.status === "error" ? job.error ?? "Failed" : meta.label}
                    {job.status === "done" && job.filename ? ` · ${job.filename}` : ""}
                  </span>
                  {job.status === "running" && (
                    <span>
                      {Math.floor(job.progress)}%{job.speed ? ` · ${job.speed}` : ""}
                      {job.eta ? ` · ETA ${job.eta}` : ""}
                    </span>
                  )}
                </div>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
    </section>
  );
}
