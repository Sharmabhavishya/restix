import "server-only";
import { asUser, pgCode, PG, type Tx } from "./db";
import { track } from "./analytics";
import { allow } from "./rate-limit";

export type OfferStatus = "open" | "accepted" | "declined" | "superseded" | "withdrawn";

export interface Offer {
  id: string;
  inquiryId: string;
  fromUser: string;
  amountPaise: number;
  status: OfferStatus;
  createdAt: Date;
  decidedAt: Date | null;
}

type Result = { ok: true; message?: string } | { ok: false; error: string };

// The database raises these (prefix before the colon); everything else is a generic failure.
const REASONS: Record<string, string> = {
  offer_closed: "This conversation is closed, so offers are off.",
  offer_agreed: "You've already agreed a price on this one.",
  offer_above_asking: "Offers can't go above the asking price.",
  offer_above_face: "This event only allows resale at face value, so offers can't go above it.",
  offer_fixed: "This seller isn't taking offers. Ask about the listed price instead.",
  offer_decided: "That offer has already been answered.",
};

/** A readable reason when the database refused an offer for one of its rules, else null. */
export function offerError(err: unknown): string | null {
  const msg = err instanceof Error ? err.message : "";
  const key = msg.split(":")[0];
  return REASONS[key] ?? null;
}

/** Offers on the given conversations, oldest first, grouped by inquiry. RLS limits it to the viewer's own. */
export async function offersFor(viewerId: string, inquiryIds: string[]): Promise<Map<string, Offer[]>> {
  const map = new Map<string, Offer[]>();
  if (inquiryIds.length === 0) return map;
  const rows = await asUser(viewerId, (tx) => tx<Offer[]>`
    select id, inquiry_id, from_user, amount_paise, status, created_at, decided_at
    from restix.offers where inquiry_id = any(${inquiryIds}::uuid[])
    order by created_at`);
  for (const r of rows) map.set(r.inquiryId, [...(map.get(r.inquiryId) ?? []), r]);
  return map;
}

/** Inserts an offer inside an existing transaction (used when an inquiry opens with one). */
export async function insertOffer(tx: Tx, viewerId: string, inquiryId: string, amountPaise: number) {
  await tx`insert into restix.offers (inquiry_id, from_user, amount_paise) values (${inquiryId}, ${viewerId}, ${amountPaise})`;
}

export async function makeOffer(viewerId: string, input: { inquiryId: string; amountPaise: number }): Promise<Result> {
  if (!(await allow("offer", viewerId))) return { ok: false, error: "That's a lot of offers in a short time. Give it a few minutes." };
  try {
    await asUser(viewerId, (tx) => insertOffer(tx, viewerId, input.inquiryId, input.amountPaise));
    await track("offer_made", { userId: viewerId, props: { amount_paise: input.amountPaise } });
    return { ok: true };
  } catch (err) {
    const why = offerError(err);
    if (why) return { ok: false, error: why };
    if (pgCode(err) === PG.insufficientPrivilege) return { ok: false, error: "You can't make offers on this conversation." };
    console.error("offer failed", err instanceof Error ? err.message : err);
    return { ok: false, error: "Your offer wasn't sent because of a server error. Please try again." };
  }
}

export async function decideOffer(viewerId: string, input: { offerId: string; decision: "accept" | "decline" | "withdraw" }): Promise<Result> {
  if (!(await allow("offer", viewerId))) return { ok: false, error: "Too many changes in a short time. Give it a few minutes." };
  const status = input.decision === "accept" ? "accepted" : input.decision === "decline" ? "declined" : "withdrawn";
  try {
    const rows = await asUser(viewerId, (tx) => tx<{ amountPaise: number }[]>`
      update restix.offers set status = ${status} where id = ${input.offerId} and status = 'open' returning amount_paise`);
    if (rows.length === 0) return { ok: false, error: "That offer has already been answered." };
    if (status === "accepted") await track("offer_accepted", { userId: viewerId, props: { amount_paise: rows[0].amountPaise } });
    return { ok: true };
  } catch (err) {
    const why = offerError(err);
    if (why) return { ok: false, error: why };
    if (pgCode(err) === PG.insufficientPrivilege) return { ok: false, error: "Only the other person can answer this offer." };
    console.error("offer decision failed", err instanceof Error ? err.message : err);
    return { ok: false, error: "That didn't save because of a server error. Please try again." };
  }
}

/** Open offers the viewer has to answer, on conversations still going: part of the inbox badge. */
export async function offersWaiting(viewerId: string): Promise<number> {
  const [row] = await asUser(viewerId, (tx) => tx<{ n: number }[]>`
    select count(*)::int as n
    from restix.offers o join restix.inquiries i on i.id = o.inquiry_id
    where o.status = 'open' and o.from_user <> ${viewerId}
      and ${viewerId} in (i.buyer_id, i.seller_id) and i.status in ('pending', 'accepted')`);
  return row.n;
}
