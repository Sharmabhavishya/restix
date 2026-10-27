// WhatsApp deep links with the first message already written. Pure, so the wording is tested.
//
// They only ever appear after a seller accepts a request: until then nobody's number is shared.
// Every message ends with a short "sent via ResTix" line, so the deal is credited to the site.
import { formatPaise } from "./money";
import type { TicketFormat } from "./listing-rules";

const E164 = /^\+[1-9]\d{7,14}$/;

/** wa.me link to one number. Null for a missing or malformed number. */
export function waLink(e164: string | null, text: string): string | null {
  if (e164 === null || !E164.test(e164)) return null;
  return `https://wa.me/${e164.slice(1)}?text=${encodeURIComponent(text)}`;
}

export interface DealContext {
  buyerName: string;
  sellerName: string;
  eventName: string;
  ticketTypeName: string;
  quantity: number;
  /** Price per ticket the two agreed on: an accepted offer, the multi-ticket deal, or the asking price. */
  unitPricePaise: number;
  format: TicketFormat;
  /** Where ResTix lives, e.g. "restix.app", for the sign-off. */
  site: string;
}

const SENT_ONLINE: readonly TicketFormat[] = ["qr", "email", "app"];

const first = (name: string) => name.trim().split(/\s+/)[0] || "there";

function tickets(c: DealContext): string {
  return c.quantity === 1 ? `a ticket (${c.ticketTypeName})` : `${c.quantity} tickets (${c.ticketTypeName})`;
}

function price(c: DealContext): string {
  return c.quantity === 1
    ? formatPaise(c.unitPricePaise)
    : `${formatPaise(c.unitPricePaise)} each (${formatPaise(c.unitPricePaise * c.quantity)} in total)`;
}

function signOff(c: DealContext): string {
  return `\n\nSent via ResTix · ${c.site}`;
}

/** The seller's first message to the buyer they just accepted. */
export function sellerOpener(c: DealContext): string {
  const next = SENT_ONLINE.includes(c.format)
    ? "I'll send it over, and you can pay once you've got it. Does that work?"
    : "When and where works for you to meet?";
  return `Hi ${first(c.buyerName)}! I've accepted your request for ${tickets(c)} to ${c.eventName} on ResTix. Let's close it at ${price(c)}. ${next}${signOff(c)}`;
}

/** The buyer's first message to the seller who accepted them. */
export function buyerOpener(c: DealContext): string {
  const next = SENT_ONLINE.includes(c.format)
    ? "Could you send it over? I'll pay as soon as I've got it."
    : "When and where works for you to meet?";
  return `Hi ${first(c.sellerName)}! You accepted my request for ${tickets(c)} to ${c.eventName} on ResTix. Happy to close it at ${price(c)}. ${next}${signOff(c)}`;
}
