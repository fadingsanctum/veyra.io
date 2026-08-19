"use client";

import { useEngine } from "@/store/downloader";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

export function EnginePill() {
  const { engineStatus } = useEngine();

  if (engineStatus === "checking") {
    return (
      <div className="flex items-center gap-2 rounded-full border border-rust bg-void/50 px-3 py-1 shadow-sm">
        <Loader2 size={12} className="animate-spin text-dim" />
        <span className="font-mono text-[10px] uppercase tracking-wider text-dim">Engine: Checking</span>
      </div>
    );
  }

  if (engineStatus === "connected") {
    return (
      <div className="flex items-center gap-2 rounded-full border border-ember/30 bg-ember/10 px-3 py-1 shadow-sm">
        <div className="h-1.5 w-1.5 rounded-full bg-ember shadow-[0_0_8px_var(--ember-glow)]" />
        <span className="font-mono text-[10px] uppercase tracking-wider text-ember">Engine: Connected</span>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex items-center gap-2 rounded-full border border-blood/30 bg-blood/10 px-3 py-1 shadow-sm"
    >
      <AlertCircle size={12} className="text-blood" />
      <span className="font-mono text-[10px] uppercase tracking-wider text-blood">Engine: Disconnected</span>
      <a 
        href="/VeyraSetup.exe" 
        download
        className="ml-1 rounded-full bg-blood px-2 py-0.5 text-[9px] font-bold text-bone hover:bg-ember"
      >
        Install
      </a>
    </motion.div>
  );
}
