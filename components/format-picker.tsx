"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";

interface Option {
  id: string;
  label: string;
  sub?: string;
}

interface FormatPickerProps {
  label: string;
  options: Option[];
  value: string;
  onChange: (id: string) => void;
  mono?: boolean;
}

/** Bottom sheet on mobile, anchored dropdown on md+. Options stagger in. */
export function FormatPicker({ label, options, value, onChange, mono }: FormatPickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.id === value);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative w-full">
      <span className="font-mono mb-1.5 block text-[10px] uppercase tracking-[0.22em] text-dim">
        {label}
      </span>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex w-full items-center justify-between gap-3 rounded-lg border border-rust bg-elevated px-3.5 py-2.5 text-left transition-colors hover:border-ember/50 ${
          open ? "border-ember/60 shadow-ember" : ""
        }`}
      >
        <span className="min-w-0">
          <span className={`block truncate text-sm text-bone ${mono ? "font-mono" : ""}`}>
            {selected?.label ?? "Select…"}
          </span>
          {selected?.sub && (
            <span className="font-mono block truncate text-[11px] text-dim">{selected.sub}</span>
          )}
        </span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-dim transition-transform duration-200 ${open ? "rotate-180 text-ember" : ""}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.16 }}
            role="listbox"
            className="fixed inset-x-0 bottom-0 z-50 max-h-[62vh] overflow-y-auto rounded-t-2xl border border-b-0 border-rust bg-elevated p-2 shadow-card md:absolute md:inset-x-auto md:bottom-auto md:top-full md:left-0 md:mt-2 md:max-h-80 md:w-80 md:rounded-lg md:border-b md:shadow-ember"
          >
            <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-rust md:hidden" />
            {options.map((o, i) => (
              <motion.button
                key={o.id}
                type="button"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.16, delay: Math.min(i * 0.03, 0.3) }}
                role="option"
                aria-selected={o.id === value}
                onClick={() => {
                  onChange(o.id);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-3 rounded-md px-3 py-2.5 text-left transition-colors ${
                  o.id === value ? "bg-blood/20 text-bone" : "text-bone/85 hover:bg-panel"
                }`}
              >
                <span className="min-w-0">
                  <span className={`block truncate text-sm ${mono ? "font-mono" : ""}`}>{o.label}</span>
                  {o.sub && <span className="font-mono block truncate text-[11px] text-dim">{o.sub}</span>}
                </span>
                {o.id === value && <Check size={15} className="shrink-0 text-ember" />}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
