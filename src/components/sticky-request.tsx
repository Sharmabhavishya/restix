"use client";

import { useEffect, useState } from "react";

/**
 * On a phone, the request form is a few screens below the top of a listing. This bar sticks to the
 * bottom with the price and a button that scrolls to the form, and goes away once the form is on
 * screen (or has been scrolled past). Hidden on wider screens, where the form sits beside the listing.
 */
export function StickyRequest({ target, price, unit }: { target: string; price: string; unit: string }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const el = document.getElementById(target);
    if (!el) return;
    // Show while the form is still below the screen; hide once it's visible or behind us.
    const io = new IntersectionObserver(([entry]) => setShow(!entry.isIntersecting && entry.boundingClientRect.top > 0), { threshold: 0.05 });
    io.observe(el);
    return () => io.disconnect();
  }, [target]);

  return (
    <div
      inert={!show}
      className={`fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur md:hidden motion-safe:transition-transform motion-safe:duration-300 ${
        show ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <div className="mx-auto flex max-w-lg items-center justify-between gap-4">
        <p className="leading-tight">
          <span className="num block text-xl font-bold">{price}</span>
          <span className="block text-[12px] text-muted">{unit}</span>
        </p>
        <a
          href={`#${target}`}
          onClick={(e) => {
            e.preventDefault();
            document.getElementById(target)?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
          }}
          className="inline-flex h-12 items-center justify-center rounded-[var(--radius-control)] bg-buy px-6 text-base font-semibold text-white active:scale-[0.98]"
        >
          Request this ticket
        </a>
      </div>
    </div>
  );
}
