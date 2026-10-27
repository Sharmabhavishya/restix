"use client";

import { useEffect } from "react";

/**
 * Scroll reveals that work in every browser. Marks the page as motion-capable (so nothing is ever
 * hidden without script), then lets each `[data-reveal]` element rise in the first time it enters
 * the viewport. Does nothing at all for people who prefer reduced motion.
 */
export function MotionRoot() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
    const root = document.documentElement;
    const els = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    // Anything already on screen shows at once; only what's below the fold waits for its turn.
    const vh = window.innerHeight;
    for (const el of els) if (el.getBoundingClientRect().top > vh * 0.92) el.classList.add("reveal-wait");
    root.classList.add("js-motion");
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const el = e.target as HTMLElement;
          el.classList.replace("reveal-wait", "reveal-run");
          io.unobserve(el);
          const i = Number(getComputedStyle(el).getPropertyValue("--i")) || 0;
          window.setTimeout(() => el.classList.remove("reveal-run"), 1100 + i * 90);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
    );
    for (const el of els) if (el.classList.contains("reveal-wait")) io.observe(el);
    return () => {
      io.disconnect();
      root.classList.remove("js-motion");
    };
  }, []);
  return null;
}
