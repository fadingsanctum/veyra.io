"use client";

interface ProgressCrackProps {
  percent: number;
  status: "queued" | "running" | "done" | "error";
}

interface AshSpec {
  id: number;
  left: number;
  delay: number;
  drift: number;
}

/** Precomputed at module load so no impure calls happen during render. */
const ASH_SPECS: AshSpec[] = Array.from({ length: 10 }, (_, i) => ({
  id: i,
  left: 30 + Math.random() * 40,
  delay: Math.random() * 0.6,
  drift: (Math.random() - 0.5) * 60,
}));

/** A filling crack of ember light — not a generic progress bar. */
export function ProgressCrack({ percent, status }: ProgressCrackProps) {
  const done = status === "done";
  const error = status === "error";

  return (
    <div className="relative">
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-elevated">
        {/* ember fill */}
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            width: `${done ? 100 : error ? 100 : percent}%`,
            background: "linear-gradient(90deg, var(--accent-blood), var(--accent-ember) 60%, var(--crack-core))",
            boxShadow: "0 0 12px var(--ember-glow)",
            transition: "width 0.4s ease",
            opacity: error ? 0.35 : 1,
          }}
        />
        {/* leading ember head */}
        {!done && !error && (
          <span
            className="absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full"
            style={{
              left: `calc(${percent}% - 7px)`,
              background: "var(--crack-core)",
              boxShadow: "0 0 14px 3px var(--ember-glow)",
              transition: "left 0.4s ease",
            }}
          />
        )}
      </div>

      {/* ash settle burst on completion */}
      {done && (
        <div className="pointer-events-none absolute inset-x-0 -top-2 h-6 overflow-visible" aria-hidden="true">
          {ASH_SPECS.map((a) => (
            <span
              key={a.id}
              className="absolute top-0 h-1 w-1 rounded-full bg-ember/80"
              style={
                {
                  left: `${a.left}%`,
                  "--ash-drift": `${a.drift}px`,
                  animation: `ash-settle 1.1s ease-out ${a.delay}s forwards`,
                  opacity: 0,
                } as React.CSSProperties
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
