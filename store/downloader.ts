"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { HistoryEntry, Job, ResolveResult } from "@/lib/types";

/* ------------------------- resolve flow ------------------------- */

interface DownloaderState {
  url: string;
  status: "idle" | "probing" | "resolved" | "error";
  result: ResolveResult | null;
  error: { code: string; message: string } | null;
  lastResolvedUrl: string | null;
  setUrl: (url: string) => void;
  resolve: (url: string) => Promise<void>;
  clear: () => void;
}

export const useDownloader = create<DownloaderState>()((set) => ({
  url: "",
  status: "idle",
  result: null,
  error: null,
  lastResolvedUrl: null,

  setUrl: (url) => set({ url }),

  resolve: async (url) => {
    set({ status: "probing", error: null, result: null, url, lastResolvedUrl: url });
    try {
      const res = await fetch("/api/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        set({
          status: "error",
          error: data.error ?? { code: "unknown", message: "Could not resolve that link." },
        });
        return;
      }
      const result: ResolveResult =
        data.kind === "playlist"
          ? { kind: "playlist", playlist: data.playlist }
          : { kind: "video", video: data.video };
      set({ status: "resolved", result });
    } catch {
      set({
        status: "error",
        error: { code: "network", message: "Could not reach the resolve service. Try again." },
      });
    }
  },

  clear: () => set({ status: "idle", result: null, error: null, url: "", lastResolvedUrl: null }),
}));

/* ----------------------- jobs + history ------------------------- */

interface JobsState {
  jobs: Job[];
  history: HistoryEntry[];
  upsertJob: (job: Job) => void;
  removeJob: (id: string) => void;
  addHistory: (entry: HistoryEntry) => void;
  clearHistory: () => void;
}

export const useJobs = create<JobsState>()(
  persist(
    (set) => ({
      jobs: [],
      history: [],
      upsertJob: (job) =>
        set((s) => {
          const exists = s.jobs.some((j) => j.id === job.id);
          return { jobs: exists ? s.jobs.map((j) => (j.id === job.id ? job : j)) : [job, ...s.jobs] };
        }),
      removeJob: (id) => set((s) => ({ jobs: s.jobs.filter((j) => j.id !== id) })),
      addHistory: (entry) =>
        set((s) => ({ history: [entry, ...s.history].slice(0, 100) })),
      clearHistory: () => set({ history: [] }),
    }),
    {
      name: "veyra-history",
      partialize: (s) => ({ history: s.history }),
    },
  ),
);
