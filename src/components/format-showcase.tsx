"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import type { TicketFormat } from "@/lib/listing-rules";
import { FORMAT_ICON } from "./format-icon";

export interface ShowcaseItem {
  key: TicketFormat;
  label: string;
  /** One line on how this kind of ticket changes hands. */
  note: string;
  ticket: ReactNode;
}

/** How long each format stays up while it plays on its own. */
const STEP_MS = 3200;

const REDUCE = "(prefers-reduced-motion: reduce)";
const onMotionChange = (cb: () => void) => {
  const mq = window.matchMedia(REDUCE);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

/**
 * The landing's "every kind of ticket" stage. It plays like stories: the current format's pill
 * fills up, then it moves on to the next, round and round. It holds while a finger or cursor
 * is on it or it's off screen, and carries on after. Tap a pill, use the arrow keys or swipe the
 * stage to jump. The fill's own animation drives the timing, so pausing it pauses everything.
 * With reduced motion it doesn't play on its own at all.
 */
export function FormatShowcase({ items }: { items: ShowcaseItem[] }) {
  const [active, setActive] = useState(0);
  const [inView, setInView] = useState(false);
  const [held, setHeld] = useState(false);
  // Server render and reduced motion: no autoplay.
  const motion = useSyncExternalStore(onMotionChange, () => !window.matchMedia(REDUCE).matches, () => false);
  const root = useRef<HTMLDivElement>(null);
  const row = useRef<HTMLDivElement>(null);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const swipe = useRef<number | null>(null);

  useEffect(() => {
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.35 });
    if (root.current) io.observe(root.current);
    return () => io.disconnect();
  }, []);

  // Keep the current pill in view on phones, where the row scrolls sideways. Scrolls the row only,
  // never the page.
  useEffect(() => {
    const r = row.current;
    const pill = tabs.current[active];
    if (!r || !pill || r.scrollWidth <= r.clientWidth) return;
    r.scrollTo({ left: pill.offsetLeft - (r.clientWidth - pill.offsetWidth) / 2, behavior: motion ? "smooth" : "auto" });
  }, [active, motion]);

  const go = (i: number, focus = false) => {
    const next = (i + items.length) % items.length;
    setActive(next);
    if (focus) tabs.current[next]?.focus();
  };

  const onKey = (e: KeyboardEvent) => {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    go(active + step, true);
  };

  const onSwipeEnd = (e: PointerEvent) => {
    if (swipe.current === null) return;
    const dx = e.clientX - swipe.current;
    swipe.current = null;
    if (Math.abs(dx) > 40) go(active + (dx < 0 ? 1 : -1));
  };

  const playing = motion && inView && !held;

  return (
    <div
      ref={root}
      className="flex min-w-0 flex-col gap-4 sm:gap-5"
      onPointerEnter={(e) => e.pointerType === "mouse" && setHeld(true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && setHeld(false)}
      // Keyboard users get time to read; a tap or click shouldn't stop the show.
      onFocus={(e) => e.target.matches(":focus-visible") && setHeld(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setHeld(false)}
    >
      <div
        ref={row}
        role="tablist"
        aria-label="Kinds of ticket"
        onKeyDown={onKey}
        className="fmt-row -mx-4 flex snap-x gap-2 overflow-x-auto px-4 py-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {items.map((it, i) => {
          const Icon = FORMAT_ICON[it.key];
          const on = i === active;
          return (
            <button
              key={it.key}
              ref={(el) => { tabs.current[i] = el; }}
              type="button"
              role="tab"
              id={`fmt-tab-${it.key}`}
              aria-selected={on}
              aria-controls="fmt-stage"
              tabIndex={on ? 0 : -1}
              onClick={() => go(i)}
              data-on={on}
              className="fmt-pill relative flex h-12 flex-none snap-center items-center gap-2 overflow-hidden rounded-full border py-1 pr-4 pl-1.5 text-[15px] font-semibold whitespace-nowrap"
            >
              {/* The story-style fill: it runs while this format plays, and its end moves things on. */}
              {on && motion && (
                <span
                  key={active}
                  aria-hidden
                  className="fmt-fill absolute inset-y-0 left-0"
                  style={{ animationDuration: `${STEP_MS}ms`, animationPlayState: playing ? "running" : "paused" }}
                  onAnimationEnd={() => go(active + 1)}
                />
              )}
              <span className="fmt-badge relative grid size-9 place-items-center rounded-full">
                <Icon className="size-[18px]" strokeWidth={2.1} aria-hidden />
              </span>
              <span className="relative">{it.label}</span>
            </button>
          );
        })}
      </div>

      <div
        id="fmt-stage"
        role="tabpanel"
        aria-labelledby={`fmt-tab-${items[active].key}`}
        onPointerDown={(e) => { if (e.pointerType !== "mouse") swipe.current = e.clientX; }}
        onPointerUp={onSwipeEnd}
        onPointerCancel={() => { swipe.current = null; }}
        className="fmt-stage relative touch-pan-y overflow-hidden rounded-[28px] bg-surface px-4 pt-12 pb-5 select-none sm:rounded-[32px] sm:px-10 sm:pt-16 sm:pb-8"
      >
        <div aria-hidden className="absolute inset-x-4 top-4 flex items-center justify-between sm:inset-x-10 sm:top-5">
          <span className="num text-[13px] font-semibold text-muted">
            {String(active + 1).padStart(2, "0")} <span className="text-placeholder">/ {String(items.length).padStart(2, "0")}</span>
          </span>
          <span className="text-[12px] text-muted sm:hidden">swipe ↔</span>
        </div>
        <div className="grid">
          {items.map((it, i) => (
            <div key={it.key} aria-hidden={i !== active} inert={i !== active} data-on={i === active} className="fmt-slide [grid-area:1/1]">
              <div className="mx-auto max-w-[30rem] lg:scale-[1.08]">{it.ticket}</div>
              <p className="mx-auto mt-7 max-w-[30rem] text-[15px] leading-relaxed text-ink-soft sm:mt-10 sm:text-center">
                <span className="font-display text-[19px] font-extrabold tracking-[-0.02em] text-ink">{it.label}.</span> {it.note}
              </p>
            </div>
          ))}
        </div>
        <div aria-hidden className="mt-5 flex justify-center gap-1.5 sm:mt-6">
          {items.map((it, i) => (
            <span key={it.key} className={`fmt-tick h-1.5 rounded-full ${i === active ? "w-6 bg-accent" : "w-1.5 bg-border"}`} />
          ))}
        </div>
      </div>
    </div>
  );
}
