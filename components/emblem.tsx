/** Original geometric two-wing mark — the Veyra emblem.
 *  Deliberately not any copyrighted insignia: clean angular wings
 *  meeting at a blood-red core. */

export function Emblem({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      {/* left wing */}
      <path
        d="M24 38 L8 22 L2 26 L16 44 Z"
        fill="currentColor"
        opacity="0.9"
      />
      {/* right wing */}
      <path
        d="M24 38 L40 22 L46 26 L32 44 Z"
        fill="currentColor"
        opacity="0.9"
      />
      {/* blood core */}
      <path d="M24 12 L27.5 19 L24 26 L20.5 19 Z" fill="var(--accent-blood)" />
      {/* wing tips highlight */}
      <path d="M8 22 L14 28 L10 30 Z" fill="var(--bg-void)" opacity="0.55" />
      <path d="M40 22 L34 28 L38 30 Z" fill="var(--bg-void)" opacity="0.55" />
    </svg>
  );
}
