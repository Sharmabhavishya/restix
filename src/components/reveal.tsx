"use client";

import { useEffect } from "react";

/**
 * Entrance motion for the landing page. Content is visible without JavaScript; once this
 * mounts, only elements still below the fold are held back and then rise in, staggered,
 * as they enter. Respects prefers-reduced-motion.
 */
export function Reveal() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const els = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    const pending = els.filter((el) => el.getBoundingClientRect().top > window.innerHeight * 0.92);
    for (const el of pending) el.classList.add("reveal-pending");
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLElement;
          el.classList.add("reveal-in");
          el.classList.remove("reveal-pending");
          io.unobserve(el);
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    for (const el of pending) io.observe(el);
    return () => io.disconnect();
  }, []);
  return null;
}
