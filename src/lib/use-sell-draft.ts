"use client";

import { useMemo, useSyncExternalStore } from "react";

// A half-filled Sell form survives a closed tab or a dropped connection, kept on this device only.
// Only the quick answers are kept (event, ticket, price...), never notes or anything personal.
const KEY = "restix-sell-draft";
const WEEK = 7 * 24 * 60 * 60 * 1000;

export interface SellDraft {
  eventId: string;
  ticketTypeId: string;
  format: string;
  quantity: number;
  price: string;
  meetup: string;
  negotiable: boolean;
}

function read(): string | null {
  try {
    const raw = localStorage.getItem(KEY);
    const at = raw ? Number((JSON.parse(raw) as { at?: number }).at) : NaN;
    return Number.isFinite(at) && Date.now() - at <= WEEK ? raw : null; // older than a week: forgotten
  } catch {
    return null; // private window or blocked storage: no drafts, nothing breaks
  }
}

export function saveSellDraft(draft: SellDraft | null) {
  try {
    if (draft) localStorage.setItem(KEY, JSON.stringify({ ...draft, at: Date.now() }));
    else localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

/** The draft saved on this device, or null (also null during server rendering). */
export function useSellDraft(): SellDraft | null {
  const raw = useSyncExternalStore(() => () => {}, read, () => null);
  return useMemo(() => {
    if (!raw) return null;
    try {
      const d = JSON.parse(raw) as Partial<SellDraft> & { at?: number };
      if (typeof d.eventId !== "string" || !d.eventId) return null;
      return {
        eventId: d.eventId,
        ticketTypeId: String(d.ticketTypeId ?? ""),
        format: String(d.format ?? ""),
        quantity: Number(d.quantity) || 1,
        price: String(d.price ?? ""),
        meetup: String(d.meetup ?? ""),
        negotiable: d.negotiable !== false,
      };
    } catch {
      return null;
    }
  }, [raw]);
}
