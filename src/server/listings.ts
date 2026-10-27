import "server-only";
import {
  effectiveStatus, eventCloseTime, publishDecision, sellerCan,
  type EventFacts, type ListingStatus, type SellerAction, type TicketFormat, type HandoverMethod,
} from "@/lib/listing-rules";
import type { ListingInput } from "@/lib/validation";
import { asSystem, asUser, pgCode, PG, type Tx } from "./db";
import { available } from "./events";
import { track } from "./analytics";
import { allow } from "./rate-limit";

export interface ListingCard {
  id: string;
  eventId: string;
  eventSlug: string;
  eventName: string;
  eventStartsAt: Date;
  eventEndsAt: Date | null;
  eventStatus: EventFacts["status"];
  transferPolicy: EventFacts["transferPolicy"];
  eventIsFixture: boolean;
  ticketTypeName: string;
  faceValuePaise: number | null;
  format: TicketFormat;
  quantity: number;
  askingPricePaise: number;
  originalPricePaise: number | null;
  priceNegotiable: boolean;
  handoverMethod: HandoverMethod;
  meetupArea: string | null;
  status: ListingStatus;
  expiresAt: Date;
  publishedAt: Date | null;
  createdAt: Date;
  sellerId: string;
  sellerName: string;
  sellerVerified: boolean;
}

export interface ListingDetail extends ListingCard {
  ticketTypeId: string;
  handoverNotes: string | null;
  sellerNotes: string | null;
  statusReason: string | null;
  reviewedAt: Date | null;
  version: number;
  updatedAt: Date;
  sellerMemberSince: Date;
  sellerActiveListings: number;
  eventVenue: string | null;
}

export function eventFacts(l: Pick<ListingCard, "eventStatus" | "transferPolicy" | "eventStartsAt" | "eventEndsAt">): EventFacts {
  return { status: l.eventStatus, transferPolicy: l.transferPolicy, startsAt: l.eventStartsAt, endsAt: l.eventEndsAt };
}

/** The status a person should see, accounting for expiry and cancelled events. */
export function displayStatus(l: ListingCard, now = new Date()): ListingStatus {
  return effectiveStatus(l, eventFacts(l), now);
}

const CARD_COLUMNS = (tx: Tx) => tx`
  l.id, l.event_id, e.slug as event_slug, e.name as event_name, e.starts_at as event_starts_at,
  e.ends_at as event_ends_at, e.status as event_status, e.transfer_policy, e.is_fixture as event_is_fixture,
  t.name as ticket_type_name, t.face_value_paise, l.format, l.quantity, l.asking_price_paise, l.original_price_paise,
  l.price_negotiable, l.handover_method, l.meetup_area, l.status, l.expires_at, l.published_at, l.created_at,
  l.seller_id, p.display_name as seller_name, (p.email_verified_at is not null) as seller_verified`;

const CARD_FROM = (tx: Tx) => tx`
  restix.ticket_listings l
  join restix.events e on e.id = l.event_id
  join restix.ticket_types t on t.id = l.ticket_type_id
  join restix.profiles p on p.id = l.seller_id`;

export const SORTS = {
  newest: "Newest",
  price_asc: "Price: low to high",
  price_desc: "Price: high to low",
  soonest: "Event date: soonest",
} as const;
export type SortKey = keyof typeof SORTS;

export interface SearchFilters {
  q?: string;
  event?: string; // slug
  category?: string;
  format?: TicketFormat;
  minPaise?: number;
  maxPaise?: number;
  from?: Date;
  to?: Date;
  sort?: SortKey;
  page?: number;
}

export const PAGE_SIZE = 18;

function likePattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/** The WHERE clause for browsing: available, in the viewer's college, plus the chosen filters. */
function filterSql(tx: Tx, f: SearchFilters, includeFormat = true) {
  return tx`
    ${available(tx)}
    and e.college_id = restix.my_college_id()
    ${f.q ? tx`and (e.name ilike ${likePattern(f.q)} or t.name ilike ${likePattern(f.q)} or e.venue ilike ${likePattern(f.q)})` : tx``}
    ${f.event ? tx`and e.slug = ${f.event}` : tx``}
    ${f.category ? tx`and e.category = ${f.category}` : tx``}
    ${includeFormat && f.format ? tx`and l.format = ${f.format}` : tx``}
    ${f.minPaise !== undefined ? tx`and l.asking_price_paise >= ${f.minPaise}` : tx``}
    ${f.maxPaise !== undefined ? tx`and l.asking_price_paise <= ${f.maxPaise}` : tx``}
    ${f.from ? tx`and e.starts_at >= ${f.from}` : tx``}
    ${f.to ? tx`and e.starts_at < ${f.to}` : tx``}`;
}

/** Available listings for the viewer's college, filtered and paged. RLS scopes the rows. */
export async function searchListings(viewerId: string, f: SearchFilters): Promise<{ items: ListingCard[]; total: number; page: number; pages: number }> {
  await maybeExpire();
  const page = Math.max(1, Math.min(f.page ?? 1, 500));
  return asUser(viewerId, async (tx) => {
    const where = filterSql(tx, f);
    const order = {
      newest: tx`l.published_at desc nulls last, l.created_at desc`,
      price_asc: tx`l.asking_price_paise asc, l.created_at desc`,
      price_desc: tx`l.asking_price_paise desc, l.created_at desc`,
      soonest: tx`e.starts_at asc, l.asking_price_paise asc`,
    }[f.sort ?? "newest"];
    const [{ total }] = await tx<{ total: number }[]>`select count(*)::int as total from ${CARD_FROM(tx)} where ${where}`;
    const items = await tx<ListingCard[]>`
      select ${CARD_COLUMNS(tx)} from ${CARD_FROM(tx)} where ${where}
      order by ${order}, l.id
      limit ${PAGE_SIZE} offset ${(page - 1) * PAGE_SIZE}`;
    return { items, total, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
  });
}

/** Available listings per format under the same filters (format excluded), for the filter cards. */
export async function formatCounts(viewerId: string, f: SearchFilters): Promise<Record<string, number>> {
  return asUser(viewerId, async (tx) => {
    const rows = await tx<{ format: string; n: number }[]>`
      select l.format, count(*)::int as n from ${CARD_FROM(tx)}
      where ${filterSql(tx, f, false)}
      group by l.format`;
    return Object.fromEntries(rows.map((r) => [r.format, r.n]));
  });
}

/** Most recently published available listings, for the signed-in home. */
export async function recentListings(viewerId: string, limit = 6): Promise<ListingCard[]> {
  return (await searchListings(viewerId, { sort: "newest" })).items.slice(0, limit);
}

export async function getListing(viewerId: string, id: string): Promise<ListingDetail | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  return asUser(viewerId, async (tx) => {
    const [row] = await tx<ListingDetail[]>`
      select ${CARD_COLUMNS(tx)}, l.ticket_type_id, l.handover_notes, l.seller_notes, l.status_reason, l.reviewed_at,
             l.version, l.updated_at, p.created_at as seller_member_since, e.venue as event_venue,
             (select count(*)::int from restix.ticket_listings x join restix.events xe on xe.id = x.event_id
               where x.seller_id = l.seller_id and x.status = 'active' and x.expires_at > now()
                 and coalesce(xe.ends_at, xe.starts_at) > now()) as seller_active_listings
      from ${CARD_FROM(tx)} where l.id = ${id}`;
    return row ?? null;
  });
}

export async function myListings(viewerId: string): Promise<(ListingCard & { openInquiries: number; version: number })[]> {
  return asUser(viewerId, (tx) => tx<(ListingCard & { openInquiries: number; version: number })[]>`
    select ${CARD_COLUMNS(tx)}, l.version,
           (select count(*)::int from restix.inquiries i where i.listing_id = l.id and i.status = 'pending') as open_inquiries
    from ${CARD_FROM(tx)} where l.seller_id = ${viewerId}
    order by l.updated_at desc`);
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export type WriteResult<T = { id: string }> =
  | ({ ok: true; message?: string } & T)
  | { ok: false; error: string; field?: string };

interface EventRow extends EventFacts { id: string; collegeId: string; name: string }

async function loadEventForListing(tx: Tx, eventId: string, ticketTypeId: string): Promise<{ event: EventRow; faceValuePaise: number | null } | null> {
  const [row] = await tx<(EventRow & { faceValuePaise: number | null })[]>`
    select e.id, e.college_id, e.name, e.status, e.transfer_policy, e.starts_at, e.ends_at, t.face_value_paise
    from restix.events e join restix.ticket_types t on t.event_id = e.id
    where e.id = ${eventId} and t.id = ${ticketTypeId} and e.college_id = restix.my_college_id()`;
  if (!row) return null;
  const { faceValuePaise, ...event } = row;
  return { event, faceValuePaise };
}

function defaultExpiry(event: EventFacts): Date {
  return eventCloseTime(event);
}

export async function createListing(viewerId: string, input: ListingInput, intent: "draft" | "publish"): Promise<WriteResult> {
  if (!(await allow("createListing", viewerId))) {
    return { ok: false, error: "You've created a lot of listings today. Try again tomorrow." };
  }
  try {
    const result = await asUser(viewerId, async (tx): Promise<WriteResult> => {
      const loaded = await loadEventForListing(tx, input.eventId, input.ticketTypeId);
      if (!loaded) return { ok: false, error: "That event or ticket type isn't available.", field: "eventId" };
      const { event, faceValuePaise } = loaded;
      const expiresAt = input.expiresAt ?? defaultExpiry(event);
      let status: ListingStatus = "draft";
      let message: string | undefined;
      if (intent === "publish") {
        const decision = publishDecision(
          { status: "draft", expiresAt, askingPricePaise: input.askingPrice, originalPricePaise: input.originalPrice, faceValuePaise },
          event,
        );
        if (!decision.ok) return { ok: false, error: decision.reason };
        status = decision.status;
        message = decision.ok && decision.status === "pending_review" ? decision.note : undefined;
      } else if (expiresAt > eventCloseTime(event)) {
        return { ok: false, error: "A listing can't stay open after the event ends.", field: "expiresAt" };
      }
      const [row] = await tx<{ id: string }[]>`
        insert into restix.ticket_listings (event_id, ticket_type_id, seller_id, format, quantity, asking_price_paise,
          original_price_paise, price_negotiable, handover_method, meetup_area, handover_notes, seller_notes, status,
          expires_at, published_at)
        values (${event.id}, ${input.ticketTypeId}, ${viewerId}, ${input.format}, ${input.quantity}, ${input.askingPrice},
          ${input.originalPrice}, ${input.priceNegotiable}, ${input.handoverMethod}, ${input.meetupArea},
          ${input.handoverNotes}, ${input.sellerNotes}, ${status}, ${expiresAt},
          ${status === "active" ? new Date() : null})
        returning id`;
      return { ok: true, id: row.id, message };
    });
    if (result.ok) {
      await track("listing_created", { userId: viewerId, listingId: result.id, eventId: input.eventId, props: { format: input.format, intent } });
      if (intent === "publish") await track("listing_published", { userId: viewerId, listingId: result.id, eventId: input.eventId, props: { review: !!result.message } });
    }
    return result;
  } catch (err) {
    return writeError(err);
  }
}

export async function updateListing(viewerId: string, id: string, expectedVersion: number, input: ListingInput): Promise<WriteResult> {
  if (!(await allow("editListing", viewerId))) return { ok: false, error: "Too many edits in a short time. Wait a few minutes." };
  try {
    const result = await asUser(viewerId, async (tx): Promise<WriteResult> => {
      const [current] = await tx<{ status: ListingStatus; version: number; eventId: string; expiresAt: Date }[]>`
        select status, version, event_id, expires_at from restix.ticket_listings
        where id = ${id} and seller_id = ${viewerId} for update`;
      if (!current) return { ok: false, error: "Listing not found." };
      if (current.version !== expectedVersion) return { ok: false, error: STALE };
      if (input.eventId !== current.eventId) return { ok: false, error: "A listing's event can't be changed. Create a new listing instead.", field: "eventId" };
      const loaded = await loadEventForListing(tx, input.eventId, input.ticketTypeId);
      if (!loaded) return { ok: false, error: "That ticket type isn't available.", field: "ticketTypeId" };
      const status = effectiveStatus(current, loaded.event);
      if (!sellerCan("edit", status)) return { ok: false, error: `A ${status.replace("_", " ")} listing can't be edited.` };
      const expiresAt = input.expiresAt ?? current.expiresAt;
      let nextStatus = current.status;
      if (status === "active" || status === "paused" || status === "pending_review") {
        const decision = publishDecision(
          { status, expiresAt, askingPricePaise: input.askingPrice, originalPricePaise: input.originalPrice, faceValuePaise: loaded.faceValuePaise },
          loaded.event,
        );
        if (!decision.ok) return { ok: false, error: decision.reason };
        // A live listing whose event now needs review goes back to review.
        if (decision.status === "pending_review" && status !== "paused") nextStatus = "pending_review";
      } else if (expiresAt > eventCloseTime(loaded.event)) {
        return { ok: false, error: "A listing can't stay open after the event ends.", field: "expiresAt" };
      }
      const rows = await tx`
        update restix.ticket_listings set
          ticket_type_id = ${input.ticketTypeId}, format = ${input.format}, quantity = ${input.quantity},
          asking_price_paise = ${input.askingPrice}, original_price_paise = ${input.originalPrice},
          price_negotiable = ${input.priceNegotiable}, handover_method = ${input.handoverMethod},
          meetup_area = ${input.meetupArea}, handover_notes = ${input.handoverNotes}, seller_notes = ${input.sellerNotes},
          expires_at = ${expiresAt}, status = ${nextStatus}, version = version + 1
        where id = ${id} and version = ${expectedVersion}
        returning id`;
      if (rows.length === 0) return { ok: false, error: STALE };
      return { ok: true, id };
    });
    if (result.ok) await track("listing_edited", { userId: viewerId, listingId: id });
    return result;
  } catch (err) {
    return writeError(err);
  }
}

const NEXT_STATUS: Partial<Record<SellerAction, ListingStatus>> = {
  pause: "paused",
  resume: "active",
  mark_sold: "sold",
  mark_unavailable: "unavailable",
  withdraw: "draft",
};

export async function sellerAction(viewerId: string, id: string, expectedVersion: number, action: SellerAction): Promise<WriteResult> {
  if (!(await allow("editListing", viewerId))) return { ok: false, error: "Too many changes in a short time. Wait a few minutes." };
  try {
    const result = await asUser(viewerId, async (tx): Promise<WriteResult & { closed?: boolean; published?: boolean }> => {
      const [row] = await tx<(ListingCard & { version: number; inquiries: number })[]>`
        select ${CARD_COLUMNS(tx)}, l.version,
          (select count(*)::int from restix.inquiries i where i.listing_id = l.id) as inquiries
        from ${CARD_FROM(tx)} where l.id = ${id} and l.seller_id = ${viewerId} for update of l`;
      if (!row) return { ok: false, error: "Listing not found." };
      if (row.version !== expectedVersion) return { ok: false, error: STALE };
      const status = displayStatus(row);
      if (!sellerCan(action, status)) {
        return { ok: false, error: `You can't ${action.replace("_", " ")} a listing that is ${status.replace("_", " ")}.` };
      }

      if (action === "delete") {
        // Deleting would erase buyers' conversations; keep the history and close it instead.
        if (row.inquiries > 0) {
          return { ok: false, error: "Buyers have contacted you about this listing, so it can't be deleted. Mark it sold or unavailable instead." };
        }
        const [{ openReports }] = await tx<{ openReports: number }[]>`
          select count(*)::int as open_reports from restix.reports where listing_id = ${id} and status in ('open', 'in_review')`;
        if (openReports > 0) {
          return { ok: false, error: "This listing has an open report, so it can't be deleted until a moderator reviews it. You can mark it unavailable instead." };
        }
        await tx`delete from restix.ticket_listings where id = ${id} and version = ${expectedVersion}`;
        return { ok: true, id, closed: true };
      }

      let next: ListingStatus;
      if (action === "publish") {
        const decision = publishDecision(row, eventFacts(row));
        if (!decision.ok) return { ok: false, error: decision.reason };
        // A moderator rejected it once: it goes back to them, never straight live.
        next = status === "rejected" ? "pending_review" : decision.status;
      } else if (action === "resume") {
        const decision = publishDecision(row, eventFacts(row));
        if (!decision.ok) return { ok: false, error: decision.reason };
        next = decision.status;
      } else {
        next = NEXT_STATUS[action]!;
      }

      const updated = await tx`
        update restix.ticket_listings
        set status = ${next}, version = version + 1,
            published_at = case when ${next} = 'active' and published_at is null then now() else published_at end
        where id = ${id} and version = ${expectedVersion} returning id`;
      if (updated.length === 0) return { ok: false, error: STALE };

      // Closing a listing closes its open conversations so buyers aren't left waiting.
      if (next === "sold" || next === "unavailable") {
        await tx`update restix.inquiries set status = 'closed', responded_at = coalesce(responded_at, now())
                 where listing_id = ${id} and status = 'pending'`;
      }
      const message = next === "pending_review" ? "Sent to moderators for a quick policy check." : undefined;
      return { ok: true, id, message, closed: next === "sold" || next === "unavailable", published: next === "active" && action === "publish" };
    });
    if (result.ok) {
      if (result.closed) await track("listing_closed", { userId: viewerId, listingId: action === "delete" ? null : id, props: { action } });
      if (result.published) await track("listing_published", { userId: viewerId, listingId: id });
    }
    return result.ok ? { ok: true, id: result.id, message: result.message } : result;
  } catch (err) {
    return writeError(err);
  }
}

const STALE = "This listing changed since you opened it (maybe in another tab). Reload the page to see the latest version.";

function writeError(err: unknown): { ok: false; error: string } {
  const code = pgCode(err);
  if (code === PG.serializationFailure) return { ok: false, error: STALE };
  if (code === PG.insufficientPrivilege) return { ok: false, error: "You don't have permission to do that." };
  if (code === PG.checkViolation) return { ok: false, error: "Some values are out of range. Check the form and try again." };
  console.error("listing write failed", err instanceof Error ? err.message : err);
  return { ok: false, error: "Something went wrong saving your listing. Nothing was changed; please try again." };
}

/**
 * Keeps stored statuses tidy. Reads never depend on it (they compare expires_at with
 * now()), so it runs at most every five minutes, whenever someone searches.
 */
async function maybeExpire(): Promise<void> {
  try {
    await asSystem(async (tx) => {
      const [{ due }] = await tx<{ due: boolean }[]>`select restix.hit_rate_limit('system:expire-sweep', 1, 300) as due`;
      if (due) await tx`select restix.expire_listings()`;
    });
  } catch (err) {
    console.error("expire sweep failed", err instanceof Error ? err.message : err);
  }
}
