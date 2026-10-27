/** The ResTix mark: a wristband seen flat, band and snap tab. Drawn, not lettered. */
export function Mark({ className = "size-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect x="1" y="9" width="20" height="14" rx="3" fill="var(--color-accent)" />
      <path d="M23 9h4a4 4 0 0 1 4 4v6a4 4 0 0 1-4 4h-4z" fill="var(--color-accent-ink)" />
      <circle cx="27" cy="16" r="1.8" fill="var(--color-accent-soft)" />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-bold tracking-[-0.02em] ${className}`}>
      <Mark />
      <span>ResTix</span>
    </span>
  );
}
