"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { MediaType } from "@/lib/types";

export type ThemeName = "dark" | "dim" | "light";

export interface Settings {
  theme: ThemeName;
  defaultType: MediaType;
  defaultQuality: string;
  defaultContainer: string;
  audioFormat: string;
  autoDownload: boolean;
  concurrentLimit: number;
  filenameTemplate: string;
  reducedMotion: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  theme: "dark",
  defaultType: "video+audio",
  defaultQuality: "auto",
  defaultContainer: "mp4",
  audioFormat: "mp3",
  autoDownload: true,
  concurrentLimit: 3,
  filenameTemplate: "%(title)s.%(ext)s",
  reducedMotion: false,
};

function systemPrefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

interface SettingsStore extends Settings {
  set: (patch: Partial<Settings>) => void;
  setTheme: (theme: ThemeName) => void;
  cycleTheme: () => void;
  reset: () => void;
}

export const useSettings = create<SettingsStore>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      reducedMotion: systemPrefersReducedMotion(),
      set: (patch) => set(patch),
      setTheme: (theme) => set({ theme }),
      cycleTheme: () =>
        set((s) => {
          const order: ThemeName[] = ["dark", "dim", "light"];
          const next = order[(order.indexOf(s.theme) + 1) % order.length];
          return { theme: next };
        }),
      reset: () => set({ ...DEFAULT_SETTINGS, reducedMotion: systemPrefersReducedMotion() }),
    }),
    {
      name: "veyra-settings",
    },
  ),
);

export { DEFAULT_SETTINGS };
