"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, Search } from "lucide-react";

/** Searchable list of every platform Veyra's engine can reach.
 *  Data comes live from the engine via /api/sites. */
export function SiteSearch({ initialCount }: { initialCount: number }) {
  const [query, setQuery] = useState("");
  const [sites, setSites] = useState<string[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/sites")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d.ok && Array.isArray(d.sites)) setSites(d.sites);
        else setFailed(true);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const results = useMemo(() => {
    if (!sites) return null;
    const q = query.trim().toLowerCase();
    if (!q) return sites.slice(0, 24);
    return sites.filter((s) => s.toLowerCase().includes(q)).slice(0, 60);
  }, [sites, query]);

  return (
    <div>
      <div className="relative">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-dim" aria-hidden="true" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${initialCount.toLocaleString()} sites — try “xhamster”, “instagram”, “soundcloud”…`}
          aria-label="Search supported sites"
          className="h-11 w-full rounded-lg border border-rust bg-void/70 pl-9 pr-3 font-mono text-sm text-bone outline-none transition-colors focus:border-ember/60"
        />
      </div>

      <div className="mt-4">
        {sites === null && !failed && (
          <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-dim">
            <Loader2 size={12} className="animate-spin text-ember" /> Loading extractor list…
          </p>
        )}
        {failed && (
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-dim">
            Couldn&apos;t load the extractor list — the count above comes straight from Veyra&apos;s engine.
          </p>
        )}
        {results !== null && (
          <>
            <p className="font-mono mb-3 text-[11px] uppercase tracking-[0.18em] text-dim/70">
              {query.trim()
                ? `${results.length} match${results.length === 1 ? "" : "es"}`
                : `Showing ${Math.min(results.length, 24)} of ${initialCount.toLocaleString()}`}
            </p>
            <div className="flex max-h-72 flex-wrap gap-2 overflow-y-auto rounded-lg border border-rust bg-void/50 p-3">
              {results.length === 0 && (
                <p className="px-1 py-2 text-xs text-dim">
                  No platform matches “{query}”. It may be a site Veyra doesn&apos;t cover yet — it&apos;ll
                  appear here automatically after an engine update.
                </p>
              )}
              {results.map((site) => (
                <span
                  key={site}
                  className="flex items-center gap-1.5 rounded-md border border-rust/70 bg-elevated px-2.5 py-1 font-mono text-[11px] text-bone/85"
                >
                  <Check size={11} className="text-ember" aria-hidden="true" />
                  {site}
                </span>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
