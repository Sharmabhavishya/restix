"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Heart } from "lucide-react";
import { toggleSaved } from "@/app/(app)/listings/actions";

/**
 * Heart a listing to keep it on your watchlist. Flips at once and settles when the server
 * answers; if the server says no, it flips back and says why.
 */
export function SaveButton({ listingId, saved, label = false }: { listingId: string; saved: boolean; label?: boolean }) {
  const [state, setState] = useState(saved);
  const [optimistic, setOptimistic] = useOptimistic(state);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();

  const toggle = () => {
    const next = !optimistic;
    setError(null);
    start(async () => {
      setOptimistic(next);
      const result = await toggleSaved(listingId, next);
      if (result.ok) setState(Boolean(result.saved));
      else setError(result.error ?? "Couldn't save that.");
    });
  };

  return (
    <span className="relative inline-flex flex-col items-center">
      <button
        type="button"
        onClick={toggle}
        aria-pressed={optimistic}
        aria-label={optimistic ? "Saved. Remove from saved" : "Save this listing"}
        className={`save-heart group/save inline-flex h-10 min-w-10 items-center justify-center gap-1.5 rounded-full border px-2.5 text-sm font-medium transition-colors duration-150 ${
          optimistic ? "border-accent-track bg-accent-soft text-accent-strong" : "border-border bg-surface text-muted hover:border-control-hover hover:text-ink"
        }`}
      >
        <Heart className={`size-[18px] ${optimistic ? "save-pop fill-current" : ""}`} strokeWidth={2} aria-hidden />
        {label && <span>{optimistic ? "Saved" : "Save"}</span>}
      </button>
      {error && (
        <span role="alert" className="absolute top-full right-0 z-10 mt-1 w-48 rounded-[var(--radius-control)] bg-primary px-2 py-1 text-[12px] text-on-primary">
          {error}
        </span>
      )}
    </span>
  );
}
