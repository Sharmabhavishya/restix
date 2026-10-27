/**
 * The ResTix logo: the name in Bricolage Grotesque, with a tilted ticket stub standing in for the
 * dot of the i. That ticket is the only "small" mark; there is no separate monogram.
 *
 * Everything is sized in em, so the logo scales with the font size it's given. The ticket takes
 * its colour from `--dot` (the accent by default); the letters follow currentColor.
 */
export function TicketDot({ className = "", perforation = true }: { className?: string; perforation?: boolean }) {
  return (
    <svg viewBox="0 0 28 18" className={className} aria-hidden>
      <path
        // A rounded ticket with a half-circle notch bitten out of each end.
        d="M4 0H24A4 4 0 0 1 28 4V5.8A3.2 3.2 0 0 0 28 12.2V14A4 4 0 0 1 24 18H4A4 4 0 0 1 0 14V12.2A3.2 3.2 0 0 0 0 5.8V4A4 4 0 0 1 4 0Z"
        fill="var(--dot, var(--color-accent))"
      />
      {perforation && (
        <path d="M19.5 4V14" stroke="#fff" strokeOpacity=".75" strokeWidth="1.5" strokeDasharray="0.1 2.7" strokeLinecap="round" />
      )}
    </svg>
  );
}

/** The dotless i with the ticket on top, for setting inside a word. */
export function TicketI({ className = "" }: { className?: string }) {
  return (
    <span className={`relative inline-block ${className}`}>
      ı
      <TicketDot className="logo-dot absolute top-[-0.03em] left-1/2 w-[0.31em] -translate-x-1/2 -rotate-[14deg]" />
    </span>
  );
}

/** The full logo. Screen readers hear "ResTix"; the dotless i is for eyes only. */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`wordmark inline-block font-display leading-none font-extrabold tracking-[-0.02em] ${className}`}>
      <span className="sr-only">ResTix</span>
      <span aria-hidden>
        rest<TicketI />x
      </span>
    </span>
  );
}
