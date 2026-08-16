export function PageHeader({ kicker, title, description }: { kicker: string; title: string; description?: string }) {
  return (
    <div className="border-b border-rust pb-10">
      <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-ember">{kicker}</p>
      <h1 className="font-display mt-3 text-3xl font-bold uppercase tracking-[0.1em] text-bone sm:text-4xl">
        {title}
      </h1>
      {description && (
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-dim sm:text-base">{description}</p>
      )}
    </div>
  );
}
