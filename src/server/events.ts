import "server-only";
import type { EventStatus, TransferPolicy } from "@/lib/listing-rules";
import { asSystem, asUser, type Tx } from "./db";

export interface EventSummary {
  id: string;
  slug: string;
  name: string;
  category: string;
  venue: string | null;
  startsAt: Date;
  endsAt: Date | null;
  status: EventStatus;
  transferPolicy: TransferPolicy;
  policySource: string | null;
  isFixture: boolean;
  availableListings: number;
  availableTickets: number;
  lowestPricePaise: number | null;
}

export interface TicketType {
  id: string;
  name: string;
  faceValuePaise: number | null;
}

export interface EventDetail extends EventSummary {
  description: string | null;
  policyUpdatedAt: Date | null;
  ticketTypes: TicketType[];
}

// A listing is "available" when its stored status is active, it has not expired, and its
// event is still ahead and not cancelled. The same predicate is used everywhere.
export const available = (tx: Tx) => tx`l.status = 'active' and l.expires_at > now()
  and e.status in ('scheduled', 'postponed') and coalesce(e.ends_at, e.starts_at) > now()`;

/** Upcoming events for a college with live availability, for signed-in students. */
export async function listUpcomingEvents(viewerId: string, opts: { includePast?: boolean } = {}): Promise<EventSummary[]> {
  return asUser(viewerId, (tx) => tx<EventSummary[]>`
    select e.id, e.slug, e.name, e.category, e.venue, e.starts_at, e.ends_at, e.status, e.transfer_policy,
           e.policy_source, e.is_fixture,
           count(l.id)::int as available_listings,
           coalesce(sum(l.quantity), 0)::int as available_tickets,
           min(l.asking_price_paise)::int as lowest_price_paise
    from restix.events e
    left join restix.ticket_listings l on l.event_id = e.id and ${available(tx)}
    where e.college_id = restix.my_college_id()
      and (${opts.includePast ?? false} or coalesce(e.ends_at, e.starts_at) > now())
    group by e.id
    order by e.starts_at`);
}

/**
 * The public landing page's view of a college: upcoming events and how many tickets are
 * available, with no listing, seller or student data. Runs with system privileges, so it
 * selects only these aggregate columns.
 */
export async function publicUpcomingEvents(collegeSlug?: string): Promise<{ college: { name: string; shortName: string } | null; events: EventSummary[] }> {
  return asSystem(async (tx) => {
    const [college] = collegeSlug
      ? await tx<{ id: string; name: string; shortName: string }[]>`
          select id, name, short_name from restix.colleges where slug = ${collegeSlug}`
      : await tx<{ id: string; name: string; shortName: string }[]>`
          select id, name, short_name from restix.colleges order by created_at limit 1`;
    if (!college) return { college: null, events: [] };
    const events = await tx<EventSummary[]>`
      select e.id, e.slug, e.name, e.category, e.venue, e.starts_at, e.ends_at, e.status, e.transfer_policy,
             e.policy_source, e.is_fixture,
             count(l.id)::int as available_listings,
             coalesce(sum(l.quantity), 0)::int as available_tickets,
             min(l.asking_price_paise)::int as lowest_price_paise
      from restix.events e
      left join restix.ticket_listings l on l.event_id = e.id and ${available(tx)}
      where e.college_id = ${college.id} and coalesce(e.ends_at, e.starts_at) > now()
        and e.status <> 'cancelled'
      group by e.id
      order by e.starts_at
      limit 8`;
    return { college: { name: college.name, shortName: college.shortName }, events };
  });
}

export async function getEventBySlug(viewerId: string, slug: string): Promise<EventDetail | null> {
  return asUser(viewerId, async (tx) => {
    const [event] = await tx<EventDetail[]>`
      select e.id, e.slug, e.name, e.category, e.venue, e.description, e.starts_at, e.ends_at, e.status,
             e.transfer_policy, e.policy_source, e.policy_updated_at, e.is_fixture,
             (select count(*)::int from restix.ticket_listings l where l.event_id = e.id and ${available(tx)}) as available_listings,
             (select coalesce(sum(l.quantity), 0)::int from restix.ticket_listings l where l.event_id = e.id and ${available(tx)}) as available_tickets,
             (select min(l.asking_price_paise)::int from restix.ticket_listings l where l.event_id = e.id and ${available(tx)}) as lowest_price_paise
      from restix.events e
      where e.college_id = restix.my_college_id() and e.slug = ${slug}`;
    if (!event) return null;
    event.ticketTypes = await tx<TicketType[]>`
      select id, name, face_value_paise from restix.ticket_types where event_id = ${event.id} order by sort_order, name`;
    return event;
  });
}

/** Events a seller can currently list for, with their ticket types (for the listing form). */
export async function listableEvents(viewerId: string): Promise<(EventSummary & { ticketTypes: TicketType[] })[]> {
  return asUser(viewerId, async (tx) => {
    const events = await tx<(EventSummary & { ticketTypes: TicketType[] })[]>`
      select e.id, e.slug, e.name, e.category, e.venue, e.starts_at, e.ends_at, e.status, e.transfer_policy,
             e.policy_source, e.is_fixture, 0 as available_listings, 0 as available_tickets, null as lowest_price_paise
      from restix.events e
      where e.college_id = restix.my_college_id() and coalesce(e.ends_at, e.starts_at) > now()
      order by e.starts_at`;
    const types = await tx<(TicketType & { eventId: string })[]>`
      select id, event_id, name, face_value_paise from restix.ticket_types
      where event_id = any(${events.map((e) => e.id)}::uuid[]) order by sort_order, name`;
    for (const e of events) e.ticketTypes = types.filter((t) => t.eventId === e.id);
    return events;
  });
}

