// Listing lifecycle rules shared by the server actions and the UI. The database
// enforces ownership and moderator-only statuses independently (see the migration).

export const LISTING_STATUSES = [
  "draft", "pending_review", "active", "paused", "sold", "unavailable", "expired", "removed", "rejected",
] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

export type TransferPolicy = "allowed" | "face_value_only" | "prohibited" | "unknown";
export type EventStatus = "scheduled" | "postponed" | "cancelled" | "completed";

export interface EventFacts {
  status: EventStatus;
  transferPolicy: TransferPolicy;
  startsAt: Date;
  endsAt: Date | null;
}

export interface ListingFacts {
  status: ListingStatus;
  expiresAt: Date;
  askingPricePaise: number;
  originalPricePaise: number | null;
}

/** The last moment a listing for this event may stay open. */
export function eventCloseTime(event: Pick<EventFacts, "startsAt" | "endsAt">): Date {
  return event.endsAt ?? event.startsAt;
}

/**
 * What a listing really is right now. The stored status can lag behind time (a listing
 * past its expiry, an event that got cancelled), so every read goes through this.
 */
export function effectiveStatus(listing: Pick<ListingFacts, "status" | "expiresAt">, event: EventFacts, now = new Date()): ListingStatus {
  const open = listing.status === "active" || listing.status === "paused" || listing.status === "pending_review" || listing.status === "draft";
  if (!open) return listing.status;
  if (listing.expiresAt <= now || eventCloseTime(event) <= now || event.status === "completed") return "expired";
  if (event.status === "cancelled") return "unavailable";
  return listing.status;
}

export function isAvailable(listing: Pick<ListingFacts, "status" | "expiresAt">, event: EventFacts, now = new Date()): boolean {
  return effectiveStatus(listing, event, now) === "active";
}

export type PublishDecision =
  | { ok: true; status: "active" | "pending_review"; note?: string }
  | { ok: false; reason: string };

/** Decides whether a listing can go live, needs moderator review, or is blocked — and why. */
export function publishDecision(listing: ListingFacts, event: EventFacts, now = new Date()): PublishDecision {
  if (event.status === "cancelled") return { ok: false, reason: "This event has been cancelled, so tickets can't be listed." };
  if (event.status === "completed" || eventCloseTime(event) <= now) return { ok: false, reason: "This event is over." };
  if (listing.expiresAt <= now) return { ok: false, reason: "The listing's end date is already in the past." };
  if (listing.expiresAt > eventCloseTime(event)) {
    return { ok: false, reason: "A listing can't stay open after the event ends." };
  }
  switch (event.transferPolicy) {
    case "prohibited":
      return { ok: false, reason: "The organisers don't allow tickets for this event to be resold or transferred." };
    case "face_value_only":
      if (listing.originalPricePaise === null) {
        return { ok: false, reason: "This event only allows resale at face value. Add the original price you paid." };
      }
      if (listing.askingPricePaise > listing.originalPricePaise) {
        return { ok: false, reason: "This event only allows resale at or below face value. Lower your asking price." };
      }
      return { ok: true, status: "active" };
    case "unknown":
      return {
        ok: true,
        status: "pending_review",
        note: "Nobody has confirmed yet whether this event allows resale, so a moderator will check before it goes live.",
      };
    case "allowed":
      return { ok: true, status: "active" };
  }
}

export type SellerAction = "publish" | "pause" | "resume" | "mark_sold" | "mark_unavailable" | "withdraw" | "edit" | "delete";

const SELLER_ACTIONS: Record<SellerAction, readonly ListingStatus[]> = {
  publish: ["draft", "rejected"],
  pause: ["active"],
  resume: ["paused"],
  mark_sold: ["active", "paused"],
  mark_unavailable: ["active", "paused", "pending_review"],
  withdraw: ["pending_review"],
  edit: ["draft", "pending_review", "active", "paused", "rejected"],
  delete: ["draft", "pending_review", "active", "paused", "sold", "unavailable", "expired", "rejected"],
};

/** Whether the seller may take `action` on a listing whose effective status is `status`. */
export function sellerCan(action: SellerAction, status: ListingStatus): boolean {
  return SELLER_ACTIONS[action].includes(status);
}

export function sellerActionsFor(status: ListingStatus): SellerAction[] {
  return (Object.keys(SELLER_ACTIONS) as SellerAction[]).filter((a) => sellerCan(a, status));
}

export const STATUS_LABEL: Record<ListingStatus, string> = {
  draft: "Draft",
  pending_review: "In review",
  active: "Available",
  paused: "Paused",
  sold: "Sold",
  unavailable: "Unavailable",
  expired: "Expired",
  removed: "Removed",
  rejected: "Not approved",
};

export const POLICY_LABEL: Record<TransferPolicy, string> = {
  allowed: "Resale allowed",
  face_value_only: "Face value only",
  prohibited: "No resale",
  unknown: "Policy unconfirmed",
};

export const FORMAT_LABEL = {
  wristband: "Wristband",
  digital: "Digital ticket",
  paper: "Paper ticket",
  other: "Other",
} as const;
export type TicketFormat = keyof typeof FORMAT_LABEL;

export const HANDOVER_LABEL = {
  in_person: "In person on campus",
  digital_transfer: "Digital transfer",
  either: "In person or digital",
} as const;
export type HandoverMethod = keyof typeof HANDOVER_LABEL;
