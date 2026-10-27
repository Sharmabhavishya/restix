import Link from "next/link";
import { Mark } from "./logo";

const LETTERS = ["r", "e", "s", "t", "i", "x"];

/**
 * The landing page's sign-off: a line, the links, and the name set huge and cropped by the page
 * edge, with the ticket stuck on like a sticker. Letters hop on hover; all CSS, no script.
 */
export function SiteFooter({ year }: { year: number }) {
  return (
    <footer className="relative overflow-hidden bg-accent-deep text-white">
      <div className="mx-auto max-w-[1200px] px-4 pt-16 sm:px-6 md:pt-20">
        <div className="grid gap-10 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <div>
            <p className="text-[clamp(1.75rem,3.4vw,2.75rem)] leading-[1] font-bold tracking-[-0.035em]">see you at the next one.</p>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-white/80">
              ResTix connects students. Payments and handovers happen between you, never through us. Not affiliated with any event organiser unless an event says so.
            </p>
          </div>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 text-[15px] text-white/85">
            <Link href="/safety" className="hover:text-white">Safety</Link>
            <Link href="/privacy" className="hover:text-white">Privacy</Link>
            <Link href="/terms" className="hover:text-white">Terms</Link>
            <Link href="/sign-in" className="hover:text-white">Sign in</Link>
          </nav>
        </div>
        <p className="mt-10 text-[13px] text-white/70">© {year} ResTix · a student project</p>
      </div>

      {/* The name, enormous, cut off by the bottom of the page. */}
      <div aria-hidden className="relative mx-auto mt-6 max-w-[1200px] px-2 select-none sm:px-4">
        <p className="footer-word flex translate-y-[18%] text-[clamp(6rem,30vw,27rem)] leading-[0.8] font-bold tracking-[-0.07em] text-white">
          {LETTERS.map((l, i) => (
            <span key={i} style={{ "--i": i } as React.CSSProperties} className="footer-letter inline-block">
              {l}
            </span>
          ))}
        </p>
        <Mark className="footer-sticker absolute top-[2%] right-[2%] size-[clamp(4.5rem,14vw,11rem)]" />
      </div>
    </footer>
  );
}
