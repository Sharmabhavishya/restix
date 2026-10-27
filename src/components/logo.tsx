/**
 * The ResTix mark: a ticket stub, slapped on at an angle like a sticker. Notched sides and a
 * perforation say "ticket" at any size; the smile and the butter-yellow sparkle say campus.
 * Drawn on a 32-unit grid; colours come from tokens so it follows light and dark mode.
 */
const TICKET = "M5 7H27A3 3 0 0 1 30 10V13A3 3 0 0 0 30 19V22A3 3 0 0 1 27 25H5A3 3 0 0 1 2 22V19A3 3 0 0 0 2 13V10A3 3 0 0 1 5 7Z";
const SPARKLE = "M26.5 0.8L27.7 4.1L31 5.3L27.7 6.5L26.5 9.8L25.3 6.5L22 5.3L25.3 4.1Z";

export function Mark({
  className = "size-6",
  sparkle = true,
  mono = false,
}: {
  className?: string;
  sparkle?: boolean;
  /** One colour (currentColor), for overlays on photos and video. */
  mono?: boolean;
}) {
  const face = mono ? "rgb(0 0 0 / 0.38)" : "#fdf2f7";
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <g transform="rotate(-10 16 16)">
        <path d={TICKET} fill={mono ? "currentColor" : "var(--color-accent)"} />
        <path d="M21 9.5V22.5" stroke={face} strokeWidth="1.6" strokeDasharray="1.6 1.9" strokeLinecap="round" />
        <path d="M8.2 18.6c1.8 1.9 5 1.9 6.8 0" stroke={face} strokeWidth="1.7" fill="none" strokeLinecap="round" />
        <circle cx="9.6" cy="13.6" r="1.2" fill={face} />
        <circle cx="13.6" cy="13.6" r="1.2" fill={face} />
      </g>
      {sparkle && !mono && (
        <path d={SPARKLE} fill="var(--color-sticker)" stroke="var(--color-sticker-ink)" strokeWidth="0.9" strokeLinejoin="round" className="mark-sparkle" />
      )}
    </svg>
  );
}

/** Mark plus the name, lowercase like a handle. Wiggles a little on hover. */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`group/logo inline-flex items-center gap-2 font-bold tracking-[-0.04em] ${className}`}>
      <Mark className="size-7 transition-transform duration-300 ease-[var(--ease-out-expo)] group-hover/logo:-rotate-12 group-hover/logo:scale-110" />
      <span>restix</span>
    </span>
  );
}
