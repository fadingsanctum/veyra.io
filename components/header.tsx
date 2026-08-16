"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Moon, MoonStar, Menu, Sun, X } from "lucide-react";
import { Emblem } from "./emblem";
import { useSettings, type ThemeName } from "@/store/settings";

const NAV = [
  { href: "/", label: "Downloader" },
  { href: "/settings", label: "Settings" },
  { href: "/help", label: "Help" },
  { href: "/connect", label: "Connect" },
  { href: "/legal", label: "Legal" },
];

const THEME_ICON: Record<ThemeName, typeof Moon> = {
  dark: Moon,
  dim: MoonStar,
  light: Sun,
};

export function Header() {
  const pathname = usePathname();
  const theme = useSettings((s) => s.theme);
  const cycleTheme = useSettings((s) => s.cycleTheme);
  const [open, setOpen] = useState(false);
  const ThemeIcon = THEME_ICON[theme];

  return (
    <header className="glass sticky top-0 z-50">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="group flex items-center gap-2.5" aria-label="Veyra.io — home">
          <span className="text-bone transition-colors duration-300 group-hover:text-ember">
            <Emblem size={26} />
          </span>
          <span className="font-display text-lg font-bold tracking-[0.22em] text-bone">
            VEYRA<span className="text-blood">.io</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          {NAV.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded px-3 py-1.5 text-sm transition-colors ${
                  active
                    ? "text-ember"
                    : "text-dim hover:bg-elevated hover:text-bone"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <button
            onClick={cycleTheme}
            className="flex h-9 w-9 items-center justify-center rounded border border-rust text-dim transition-colors hover:border-ember/60 hover:text-ember"
            aria-label={`Theme: ${theme} — click to change`}
            title={`Theme: ${theme}`}
          >
            <ThemeIcon size={16} />
          </button>
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex h-9 w-9 items-center justify-center rounded border border-rust text-dim transition-colors hover:text-bone md:hidden"
            aria-label="Toggle menu"
            aria-expanded={open}
          >
            {open ? <X size={16} /> : <Menu size={16} />}
          </button>
        </div>
      </div>

      {open && (
        <nav className="border-t border-rust bg-void/95 px-4 py-3 md:hidden" aria-label="Mobile">
          <div className="flex flex-col gap-1">
            {NAV.map((item) => {
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={`rounded px-3 py-2 text-sm ${
                    active ? "text-ember" : "text-dim hover:bg-elevated hover:text-bone"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </header>
  );
}
