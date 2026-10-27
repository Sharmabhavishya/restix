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
  /** The ticket type's face value, when the organisers published one. */
  faceValuePaise?: number | null;
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
      if (listing.faceValuePaise != null && listing.askingPricePaise > listing.faceValuePaise) {
        return { ok: false, reason: "This event only allows resale at or below the ticket's face value. Lower your asking price." };
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
  paper: "Paper ticket",
  qr: "QR e-ticket",
  email: "Email ticket",
  app: "App transfer",
  pass: "Pass or lanyard",
  token: "Token or coupon",
  other: "Other",
} as const;
export type TicketFormat = keyof typeof FORMAT_LABEL;
export const FORMATS = Object.keys(FORMAT_LABEL) as TicketFormat[];

/** One line on what each format is, for the picker. */
export const FORMAT_HINT: Record<TicketFormat, string> = {
  wristband: "Fabric or silicone band",
  paper: "Printed ticket or stub",
  qr: "PDF or screenshot with a QR code",
  email: "Booking email in your name",
  app: "Sent inside a ticketing app",
  pass: "Entry card, pass or lanyard",
  token: "Food, drink or entry coupon",
  other: "Something else",
};

export const HANDOVER_LABEL = {
  in_person: "In person",
  digital_transfer: "Sent digitally",
  either: "In person or digitally",
} as const;
export type HandoverMethod = keyof typeof HANDOVER_LABEL;

const PHYSICAL: readonly TicketFormat[] = ["wristband", "paper", "pass", "token"];

/** Handover methods that make sense for a format (the database enforces the same pairs). */
export function handoversFor(format: TicketFormat): HandoverMethod[] {
  if (PHYSICAL.includes(format)) return ["in_person"];
  if (format === "app") return ["digital_transfer"];
  return ["digital_transfer", "in_person", "either"];
}

/** The handover a quick listing gets when the seller doesn't pick one. */
export function defaultHandover(format: TicketFormat): HandoverMethod {
  return handoversFor(format)[0];
}

/** Old saved searches and links still say "digital"; that meant a QR e-ticket. */
export function parseFormat(value: string | undefined): TicketFormat | undefined {
  if (value === "digital") return "qr";
  return (FORMATS as readonly string[]).includes(value ?? "") ? (value as TicketFormat) : undefined;
}

/** The per-ticket price for buying `quantity`, with the multi-ticket deal applied when it kicks in. */
export function unitPrice(
  l: { askingPricePaise: number; bulkMinQuantity: number | null; bulkPricePaise: number | null },
  quantity: number,
): number {
  return l.bulkMinQuantity !== null && l.bulkPricePaise !== null && quantity >= l.bulkMinQuantity ? l.bulkPricePaise : l.askingPricePaise;
}
