// WhatsApp deep links with a message already written. Pure, so the wording is tested.
import { formatPaise } from "./money";

const E164 = /^\+[1-9]\d{7,14}$/;

/** wa.me link to one number, or to the share sheet when `e164` is null. Null for a malformed number. */
export function waLink(e164: string | null, text: string): string | null {
  if (e164 !== null && !E164.test(e164)) return null;
  const to = e164 ? e164.slice(1) : "";
  return `https://wa.me/${to}?text=${encodeURIComponent(text)}`;
}

export interface ChatContext {
  buyerName: string;
  sellerName: string;
  eventName: string;
  ticketTypeName: string;
  quantity: number;
  askingPricePaise: number;
  agreedPricePaise: number | null;
}

/** What the buyer's first WhatsApp message says, so nobody has to explain which ticket they mean. */
export function buyerOpener(c: ChatContext): string {
  const first = c.sellerName.trim().split(/\s+/)[0] || "there";
  const what = `${c.eventName} (${c.ticketTypeName})`;
  const price = c.agreedPricePaise !== null
    ? `listed at ${formatPaise(c.askingPricePaise)}, and we agreed ${formatPaise(c.agreedPricePaise)}${c.quantity > 1 ? " each" : ""}`
    : `listed at ${formatPaise(c.askingPricePaise)}${c.quantity > 1 ? " each" : ""}`;
  const qty = c.quantity > 1 ? ` for ${c.quantity} tickets` : "";
  return `Hey ${first}! It's ${c.buyerName} from ResTix. About your ${what}${qty}, ${price}. Is it still on? When works for the handover on campus?`;
}

/** What a seller posts in their group chats to send people to the listing. */
export function sellerShare(l: { eventName: string; ticketTypeName: string; askingPricePaise: number; quantity: number; url: string; college: string }): string {
  const qty = l.quantity > 1 ? `${l.quantity}x ` : "";
  return `Selling ${qty}${l.eventName} (${l.ticketTypeName}) for ${formatPaise(l.askingPricePaise)}${l.quantity > 1 ? " each" : ""} on ResTix. ${l.college} students can grab it here: ${l.url}`;
}
