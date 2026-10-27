"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Hand } from "lucide-react";
import { toggleWant } from "@/app/(app)/events/actions";

/**
 * "I want a ticket": one tap to tell sellers you're looking. The count goes up at once and
 * settles when the server answers. Nobody sees who's looking, only how many.
 */
export function WantButton({ eventId, wanted, count }: { eventId: string; wanted: boolean; count: number }) {
  const [state, setState] = useState({ wanted, count });
  const [optimistic, setOptimistic] = useOptimistic(state);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();

  const toggle = () => {
    const next = { wanted: !optimistic.wanted, count: optimistic.count + (optimistic.wanted ? -1 : 1) };
    setError(null);
    start(async () => {
      setOptimistic(next);
      const r = await toggleWant(eventId, next.wanted);
      if (r.ok) setState(next);
      else setError(r.error ?? "That didn't save.");
    });
  };

  return (
    <span className="inline-flex flex-col">
      <button
        type="button"
        onClick={toggle}
        aria-pressed={optimistic.wanted}
        className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold transition-[background-color,color,transform] duration-200 active:scale-95 ${
          optimistic.wanted ? "bg-sticker text-sticker-ink" : "bg-white/20 text-white backdrop-blur-sm hover:bg-white/30"
        }`}
      >
        <Hand className={`size-4 ${optimistic.wanted ? "want-wave" : ""}`} aria-hidden />
        {optimistic.wanted ? "You're looking" : "I want a ticket"}
        {optimistic.count > 0 && <span className="num opacity-80">· {optimistic.count}</span>}
      </button>
      {error && <span role="alert" className="mt-1 text-[12px] text-white">{error}</span>}
    </span>
  );
}
