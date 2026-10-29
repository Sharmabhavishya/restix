import "server-only";
import { asUser, type Tx } from "./db";
import { audit, guarded } from "./moderation";
import type { TicketFormat } from "@/lib/listing-rules";

// Admin-level tools: the dashboard, the team list, deleting events and exporting accounts.
// Everything runs as the signed-in moderator (RLS applies); the admin-only ones re-check the role
// in the same transaction, and every change or export is written to the audit log.

type Result = { ok: true; message?: string } | { ok: false; error: string };

async function isAdmin(tx: Tx, userId: string): Promise<boolean> {
  const [me] = await tx<{ role: string }[]>`select role from restix.admin_roles where user_id = ${userId}`;
  return me?.role === "admin";
}

export interface Dashboard {
  attention: { openReports: number; inReview: number; pendingListings: number; openAppeals: number; openSuggestions: number; disputes: number; unknownPolicy: number };
  numbers: {
    users: number; newUsers: number; restricted: number;
    liveListings: number; liveTickets: number; upcomingEvents: number;
    requests: number; accepted: number; handovers: number;
  };
  newest: { id: string; displayName: string; email: string | null; createdAt: Date }[];
}

/** Everything on the dashboard, in one round trip per section. "This week" is the last 7 days. */
export async function dashboard(modId: string): Promise<Dashboard> {
  return asUser(modId, async (tx) => {
    const [attention] = await tx<Dashboard["attention"][]>`
      select (select count(*)::int from restix.reports where status = 'open') as open_reports,
             (select count(*)::int from restix.reports where status = 'in_review') as in_review,
             (select count(*)::int from restix.ticket_listings where status = 'pending_review' and expires_at > now()) as pending_listings,
             (select count(*)::int from restix.appeals where status = 'open') as open_appeals,
             (select count(*)::int from restix.event_suggestions where status = 'open') as open_suggestions,
             (select count(distinct inquiry_id)::int from restix.transaction_confirmations
               where outcome = 'disputed' and created_at > now() - interval '30 days') as disputes,
             (select count(*)::int from restix.events where transfer_policy = 'unknown' and starts_at > now()) as unknown_policy`;
    const [numbers] = await tx<Dashboard["numbers"][]>`
      select (select count(*)::int from restix.profiles where college_id = restix.my_college_id()) as users,
             (select count(*)::int from restix.profiles where college_id = restix.my_college_id() and created_at > now() - interval '7 days') as new_users,
             (select count(*)::int from restix.profiles where college_id = restix.my_college_id() and status <> 'active') as restricted,
             (select count(*)::int from restix.ticket_listings where status = 'active' and expires_at > now()) as live_listings,
             (select coalesce(sum(quantity), 0)::int from restix.ticket_listings where status = 'active' and expires_at > now()) as live_tickets,
             (select count(*)::int from restix.events where starts_at > now() and status = 'scheduled') as upcoming_events,
             (select count(*)::int from restix.inquiries where created_at > now() - interval '7 days') as requests,
             (select count(*)::int from restix.inquiries where responded_at > now() - interval '7 days' and status in ('accepted', 'closed')) as accepted,
             (select count(distinct inquiry_id)::int from restix.transaction_confirmations
               where outcome = 'completed' and created_at > now() - interval '7 days') as handovers`;
    const newest = await tx<Dashboard["newest"]>`
      select p.id, p.display_name, pp.email, p.created_at
      from restix.profiles p left join restix.profile_private pp on pp.user_id = p.id
      where p.college_id = restix.my_college_id()
      order by p.created_at desc limit 6`;
    return { attention, numbers, newest };
  });
}

export interface TeamMember { id: string; displayName: string; email: string | null; role: "moderator" | "admin"; grantedAt: Date }

/** Everyone with a role, admins first. */
export async function team(modId: string): Promise<TeamMember[]> {
  return asUser(modId, (tx) => tx<TeamMember[]>`
    select p.id, p.display_name, pp.email, r.role, r.granted_at
    from restix.admin_roles r
    join restix.profiles p on p.id = r.user_id
    left join restix.profile_private pp on pp.user_id = p.id
    order by r.role = 'admin' desc, r.granted_at`);
}

/**
 * Deletes an event and everything hanging off it (ticket types, listings, requests, offers,
 * saves, wants, cover). Admins only, and the name must be typed back to confirm. The audit entry
 * is written first and keeps the event's name, since its link is cleared when the row goes.
 */
export async function deleteEvent(adminId: string, input: { eventId: string; confirmName: string; reason: string }): Promise<Result> {
  return guarded(adminId, async (tx) => {
    if (!(await isAdmin(tx, adminId))) return { ok: false, error: "Only admins can delete events." };
    const [event] = await tx<{ name: string; slug: string; listings: number }[]>`
      select e.name, e.slug, (select count(*)::int from restix.ticket_listings l where l.event_id = e.id) as listings
      from restix.events e where e.id = ${input.eventId}`;
    if (!event) return { ok: false, error: "That event no longer exists." };
    if (input.confirmName.trim().toLowerCase() !== event.name.trim().toLowerCase()) {
      return { ok: false, error: "Type the event's name exactly to confirm." };
    }
    await audit(tx, adminId, {
      action: "delete_event", reason: input.reason, eventId: input.eventId,
      metadata: { name: event.name, slug: event.slug, listings: event.listings },
    });
    await tx`delete from restix.events where id = ${input.eventId}`;
    return { ok: true, message: `Deleted ${event.name}${event.listings ? ` and its ${event.listings} listing${event.listings === 1 ? "" : "s"}` : ""}.` };
  });
}

export interface ExportRow {
  displayName: string; email: string | null; whatsappNumber: string | null; status: string; role: string | null;
  createdAt: Date; listings: number; liveListings: number; requests: number; reportsAgainst: number;
}

/** Every account with its contact details, for an admin's spreadsheet. Logged as an export. */
export async function exportAccounts(adminId: string): Promise<ExportRow[] | null> {
  return asUser(adminId, async (tx) => {
    if (!(await isAdmin(tx, adminId))) return null;
    const rows = await tx<ExportRow[]>`
      select p.display_name, pp.email, pp.whatsapp_number, p.status, r.role, p.created_at,
             (select count(*)::int from restix.ticket_listings l where l.seller_id = p.id) as listings,
             (select count(*)::int from restix.ticket_listings l where l.seller_id = p.id and l.status = 'active' and l.expires_at > now()) as live_listings,
             (select count(*)::int from restix.inquiries i where i.buyer_id = p.id) as requests,
             (select count(*)::int from restix.reports x where x.reported_user_id = p.id) as reports_against
      from restix.profiles p
      left join restix.profile_private pp on pp.user_id = p.id
      left join restix.admin_roles r on r.user_id = p.id
      where p.college_id = restix.my_college_id()
      order by p.created_at`;
    await audit(tx, adminId, { action: "export_users", reason: "Exported accounts to a spreadsheet", metadata: { rows: rows.length } });
    return rows;
  });
}

// ---------------------------------------------------------------------------
// The accounts directory
// ---------------------------------------------------------------------------

export type AccountFilter = "all" | "flagged" | "team";
export const ACCOUNTS_PER_PAGE = 25;

export interface Account {
  id: string; displayName: string; email: string | null; whatsappNumber: string | null; status: string; role: string | null;
  createdAt: Date; listings: number; liveListings: number; requests: number; reportsAgainst: number;
}

/** Everyone on ResTix (in the moderator's college), newest first, with what they've done. */
export async function listAccounts(modId: string, opts: { q: string; show: AccountFilter; page: number }): Promise<{ rows: Account[]; total: number }> {
  const pattern = `%${opts.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  return asUser(modId, async (tx) => {
    // Moderators need to identify people, not phone them: numbers are for the admin, whose export is logged.
    const seeNumbers = await isAdmin(tx, modId);
    const where = tx`where p.college_id = restix.my_college_id()
      ${opts.q ? tx`and (p.display_name ilike ${pattern} or pp.email ilike ${pattern})` : tx``}
      ${opts.show === "team" ? tx`and r.role is not null` : tx``}
      ${opts.show === "flagged" ? tx`and (p.status <> 'active' or exists (select 1 from restix.reports x where x.reported_user_id = p.id))` : tx``}`;
    const rows = await tx<Account[]>`
      select p.id, p.display_name, pp.email, ${seeNumbers ? tx`pp.whatsapp_number` : tx`null::text`} as whatsapp_number, p.status, r.role, p.created_at,
             (select count(*)::int from restix.ticket_listings l where l.seller_id = p.id) as listings,
             (select count(*)::int from restix.ticket_listings l where l.seller_id = p.id and l.status = 'active' and l.expires_at > now()) as live_listings,
             (select count(*)::int from restix.inquiries i where i.buyer_id = p.id) as requests,
             (select count(*)::int from restix.reports x where x.reported_user_id = p.id) as reports_against
      from restix.profiles p
      left join restix.profile_private pp on pp.user_id = p.id
      left join restix.admin_roles r on r.user_id = p.id
      ${where}
      order by p.created_at desc
      limit ${ACCOUNTS_PER_PAGE} offset ${Math.max(0, opts.page - 1) * ACCOUNTS_PER_PAGE}`;
    const [{ total }] = await tx<{ total: number }[]>`
      select count(*)::int as total
      from restix.profiles p
      left join restix.profile_private pp on pp.user_id = p.id
      left join restix.admin_roles r on r.user_id = p.id
      ${where}`;
    return { rows, total };
  });
}

// ---------------------------------------------------------------------------
// Test events: sample events (flagged `is_fixture`, so they're labelled "sample" everywhere and
// left out of the real numbers) for trying things out on the live site.
// ---------------------------------------------------------------------------

const TEST_POOL: { name: string; format: TicketFormat; category: string; venue: string; policy: "allowed" | "face_value_only" | "prohibited" | "unknown"; types: [string, number | null][] }[] = [
  { name: "Neon Night", format: "wristband", category: "party", venue: "Main Lawn", policy: "allowed", types: [["Entry", 40000], ["Entry + drink", 60000]] },
  { name: "Campus Sound Fest", format: "wristband", category: "fest", venue: "Open Air Theatre", policy: "allowed", types: [["Day pass", 80000], ["VIP", 150000]] },
  { name: "Standup Saturday", format: "qr", category: "concert", venue: "Auditorium", policy: "face_value_only", types: [["General", 30000], ["Front row", 50000]] },
  { name: "Retro Prom", format: "paper", category: "prom", venue: "Grand Hall", policy: "allowed", types: [["Couple", 120000], ["Single", 70000]] },
  { name: "Hackathon Finals", format: "pass", category: "workshop", venue: "Innovation Lab", policy: "unknown", types: [["Spectator", null]] },
  { name: "Inter-college Cricket Final", format: "app", category: "sports", venue: "Sports Ground", policy: "allowed", types: [["Stand", 20000], ["Pavilion", 45000]] },
  { name: "Silent Disco", format: "wristband", category: "party", venue: "Library Lawn", policy: "prohibited", types: [["Headphones + entry", 50000]] },
  { name: "Open Mic Night", format: "qr", category: "concert", venue: "Cafe Courtyard", policy: "allowed", types: [["Entry", 15000]] },
  { name: "Freshers Bash", format: "wristband", category: "party", venue: "Hostel Ground", policy: "face_value_only", types: [["Entry", 35000], ["Group of 4", 120000]] },
  { name: "Film Festival Gala", format: "pass", category: "other", venue: "Mini Theatre", policy: "allowed", types: [["All-access", 90000], ["Single screening", 25000]] },
  { name: "Food Carnival", format: "token", category: "fest", venue: "Central Plaza", policy: "allowed", types: [["Coupons x5", 25000]] },
  { name: "Battle of Bands", format: "qr", category: "concert", venue: "Open Air Theatre", policy: "unknown", types: [["Normal", 40000], ["Fan pit", 70000]] },
];
const MAX_TEST_EVENTS = 30;
const TEST_BATCH = 6;

const pick = <T,>(items: T[], n: number): T[] => [...items].sort(() => Math.random() - 0.5).slice(0, n);

export async function testEventCount(modId: string): Promise<number> {
  const [row] = await asUser(modId, (tx) => tx<{ n: number }[]>`
    select count(*)::int as n from restix.events where is_fixture and slug like 'test-%' and college_id = restix.my_college_id()`);
  return row.n;
}

/**
 * Adds a handful of random sample events: mixed kinds, dates in the next month and every resale
 * rule (so the "not allowed", "face value only" and "waiting for a check" paths can all be tried).
 * Each is named "[Test] ..." and labelled sample. Admins only.
 */
export async function createTestEvents(adminId: string): Promise<Result> {
  return guarded(adminId, async (tx) => {
    if (!(await isAdmin(tx, adminId))) return { ok: false, error: "Only admins can add test events." };
    const [{ n }] = await tx<{ n: number }[]>`select count(*)::int as n from restix.events where is_fixture and slug like 'test-%' and college_id = restix.my_college_id()`;
    if (n + TEST_BATCH > MAX_TEST_EVENTS) return { ok: false, error: `There are already ${n} test events. Remove them first.` };
    for (const t of pick(TEST_POOL, TEST_BATCH)) {
      const start = new Date(Date.now() + (2 + Math.floor(Math.random() * 28)) * 86_400_000);
      start.setUTCHours(10 + Math.floor(Math.random() * 6), 30, 0, 0); // evenings in IST
      const end = new Date(start.getTime() + 5 * 3_600_000);
      const slug = `test-${t.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${Math.random().toString(36).slice(2, 6)}`.slice(0, 80);
      const restricted = t.policy === "face_value_only" || t.policy === "prohibited";
      const [e] = await tx<{ id: string }[]>`
        insert into restix.events (college_id, slug, name, category, venue, description, starts_at, ends_at, status,
                                   transfer_policy, policy_source, policy_updated_at, ticket_format, is_fixture, created_by)
        values (restix.my_college_id(), ${slug}, ${`[Test] ${t.name}`}, ${t.category}, ${t.venue},
                'A made-up event for trying ResTix out. It is labelled sample and is not a real event.',
                ${start}, ${end}, 'scheduled', ${t.policy}, ${restricted ? "Test event" : null},
                ${restricted ? new Date() : null}, ${t.format}, true, ${adminId})
        returning id`;
      for (const [i, [name, face]] of t.types.entries()) {
        await tx`insert into restix.ticket_types (event_id, name, face_value_paise, sort_order) values (${e.id}, ${name}, ${face}, ${i})`;
      }
    }
    await audit(tx, adminId, { action: "create_event", reason: `Added ${TEST_BATCH} test events`, metadata: { test: true, count: TEST_BATCH } });
    return { ok: true, message: `Added ${TEST_BATCH} test events. They're labelled sample.` };
  });
}

/** Removes every test event (and anything listed or requested on them). Admins only. */
export async function removeTestEvents(adminId: string): Promise<Result> {
  return guarded(adminId, async (tx) => {
    if (!(await isAdmin(tx, adminId))) return { ok: false, error: "Only admins can remove test events." };
    const gone = await tx`delete from restix.events where is_fixture and slug like 'test-%' and college_id = restix.my_college_id() returning id`;
    if (gone.length === 0) return { ok: false, error: "There are no test events to remove." };
    await audit(tx, adminId, { action: "delete_event", reason: `Removed ${gone.length} test events`, metadata: { test: true, count: gone.length } });
    return { ok: true, message: `Removed ${gone.length} test ${gone.length === 1 ? "event" : "events"}.` };
  });
}
