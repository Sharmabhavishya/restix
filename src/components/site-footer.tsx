import Link from "next/link";
import { TicketDot } from "./logo";

const LETTERS = ["r", "e", "s", "t"];

/**
 * The landing page's sign-off: a line, the links, and the logo set huge and cropped by the page
 * edge. Letters hop on hover and the ticket dot bobs; all CSS, no script.
 */
export function SiteFooter({ year }: { year: number }) {
  return (
    <footer className="relative overflow-hidden bg-accent-deep text-white">
      <div className="mx-auto max-w-[1200px] px-4 pt-16 sm:px-6 md:pt-20">
        <div className="grid gap-10 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <div>
            <p className="font-display text-[clamp(1.75rem,3.4vw,2.75rem)] leading-[1] font-extrabold tracking-[-0.03em]">see you at the next one.</p>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-white/80">
              ResTix connects students and keeps their numbers private until a deal is on. Payments and handovers happen between you, never through us. Not affiliated with any event organiser unless an event says so.
            </p>
          </div>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 text-[15px] text-white/85">
            <Link href="/safety" className="hover:text-white">Safety</Link>
            <Link href="/privacy" className="hover:text-white">Privacy</Link>
            <Link href="/terms" className="hover:text-white">Terms</Link>
            <Link href="/sign-in" className="hover:text-white">Sign in</Link>
          </nav>
        </div>
        <p className="mt-10 text-[13px] text-white/70">© {year} ResTix</p>
      </div>

      {/* The logo, enormous, cut off by the bottom of the page. */}
      <div aria-hidden className="relative mx-auto mt-10 max-w-[1200px] px-2 select-none sm:px-4">
        <p
          className="footer-word flex translate-y-[16%] font-display text-[clamp(6rem,30vw,26rem)] leading-[0.8] font-extrabold tracking-[-0.03em] text-white"
          style={{ "--dot": "var(--color-sticker)" } as React.CSSProperties}
        >
          {LETTERS.map((l, i) => (
            <span key={i} style={{ "--i": i } as React.CSSProperties} className="footer-letter inline-block">
              {l}
            </span>
          ))}
          <span className="footer-letter relative inline-block">
            ı
            <TicketDot className="footer-dot absolute top-[-0.05em] left-1/2 w-[0.31em] -translate-x-1/2 -rotate-[14deg]" />
          </span>
          <span className="footer-letter inline-block">x</span>
        </p>
      </div>
    </footer>
  );
}
