"use client";

import { useEffect } from "react";

/** Reports one view to /api/track after the page is actually shown (not on prefetch). */
export function TrackView({
  name,
  listingId,
  eventId,
  props,
  dedupeKey,
}: {
  name: "landing_viewed" | "search_performed" | "event_viewed" | "listing_viewed" | "inquiry_started";
  listingId?: string;
  eventId?: string;
  props?: Record<string, string | number | boolean>;
  dedupeKey?: string;
}) {
  const key = dedupeKey ?? `${name}:${listingId ?? ""}:${eventId ?? ""}`;
  useEffect(() => {
    // Don't double count a refresh within the same tab session.
    try {
      const seen = `restix:t:${key}`;
      if (sessionStorage.getItem(seen)) return;
      sessionStorage.setItem(seen, "1");
    } catch {
      /* storage unavailable: count it */
    }
    const payload = JSON.stringify({ name, listingId, eventId, props });
    fetch("/api/track", { method: "POST", headers: { "content-type": "application/json" }, body: payload, keepalive: true }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return null;
}
