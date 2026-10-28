"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

export interface ShowcaseItem {
  key: string;
  label: string;
  /** One line on how this kind of ticket changes hands. */
  note: string;
  ticket: ReactNode;
}

/**
 * The landing's "every kind of ticket" stage: a row of format pills and one ticket at a time,
 * shown large. It steps through on its own while it's on screen, and stops for good the moment
 * someone picks a format. All tickets are rendered (stacked in one grid cell), so the stage
 * keeps the height of the tallest and swaps by fading, never by reflowing.
 */
export function FormatShowcase({ items }: { items: ShowcaseItem[] }) {
  const [active, setActive] = useState(0);
  const [auto, setAuto] = useState(true);
  const stage = useRef<HTMLDivElement>(null);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (!auto || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let timer: number | undefined;
    const io = new IntersectionObserver(([entry]) => {
      window.clearInterval(timer);
      if (entry.isIntersecting) timer = window.setInterval(() => setActive((i) => (i + 1) % items.length), 2800);
    }, { threshold: 0.4 });
    if (stage.current) io.observe(stage.current);
    return () => {
      io.disconnect();
      window.clearInterval(timer);
    };
  }, [auto, items.length]);

  const pick = (i: number, focus = false) => {
    setAuto(false);
    setActive(i);
    if (focus) tabs.current[i]?.focus();
  };

  const onKey = (e: KeyboardEvent) => {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    pick((active + step + items.length) % items.length, true);
  };

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <div role="tablist" aria-label="Kinds of ticket" onKeyDown={onKey} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
        {items.map((it, i) => (
          <button
            key={it.key}
            ref={(el) => { tabs.current[i] = el; }}
            type="button"
            role="tab"
            id={`fmt-tab-${it.key}`}
            aria-selected={i === active}
            aria-controls="fmt-stage"
            tabIndex={i === active ? 0 : -1}
            onClick={() => pick(i)}
            className={`fmt-pill h-11 flex-none rounded-full border px-4 text-[15px] font-semibold whitespace-nowrap ${
              i === active ? "border-primary bg-primary text-on-primary" : "border-border bg-surface text-ink hover:border-control-hover"
            }`}
          >
            {it.label}
          </button>
        ))}
      </div>

      <div
        ref={stage}
        id="fmt-stage"
        role="tabpanel"
        aria-labelledby={`fmt-tab-${items[active].key}`}
        onPointerEnter={() => setAuto(false)}
        className="fmt-stage relative overflow-hidden rounded-[32px] bg-surface px-5 pt-14 pb-6 sm:px-10 sm:pt-16 sm:pb-8"
      >
        <span aria-hidden className="num absolute top-5 left-6 text-[13px] font-semibold text-muted sm:left-10">
          {String(active + 1).padStart(2, "0")} <span className="text-placeholder">/ {String(items.length).padStart(2, "0")}</span>
        </span>
        <div className="grid">
          {items.map((it, i) => (
            <div key={it.key} aria-hidden={i !== active} inert={i !== active} data-on={i === active} className="fmt-slide [grid-area:1/1]">
              <div className="mx-auto max-w-[30rem] lg:scale-[1.08]">{it.ticket}</div>
              <p className="mx-auto mt-10 max-w-[30rem] text-center text-[15px] leading-relaxed text-ink-soft">
                <span className="font-display text-[19px] font-extrabold tracking-[-0.02em] text-ink">{it.label}.</span> {it.note}
              </p>
            </div>
          ))}
        </div>
        {/* Progress: one tick per format, the current one stretched. */}
        <div aria-hidden className="mt-6 flex justify-center gap-1.5">
          {items.map((it, i) => (
            <span key={it.key} className={`fmt-tick h-1.5 rounded-full ${i === active ? "w-6 bg-accent" : "w-1.5 bg-border"}`} />
          ))}
        </div>
      </div>
    </div>
  );
}
