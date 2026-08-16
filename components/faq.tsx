"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";

interface FaqItemProps {
  q: string;
  children: React.ReactNode;
}

export function FaqItem({ q, children }: FaqItemProps) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-rust/70 last:border-b-0">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 py-4 text-left"
      >
        <span className="text-sm font-medium text-bone">{q}</span>
        <ChevronDown
          size={15}
          className={`shrink-0 text-dim transition-transform duration-200 ${open ? "rotate-180 text-ember" : ""}`}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <p className="pb-5 text-sm leading-relaxed text-dim">{children}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
