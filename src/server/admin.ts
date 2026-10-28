import "server-only";
import { asUser, type Tx } from "./db";
import { audit, guarded } from "./moderation";

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
      select (select count(*)::int from restix.profiles) as users,
             (select count(*)::int from restix.profiles where created_at > now() - interval '7 days') as new_users,
             (select count(*)::int from restix.profiles where status <> 'active') as restricted,
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
  createdAt: Date; listings: number; requests: number;
}

/** Every account with its contact details, for an admin's spreadsheet. Logged as an export. */
export async function exportAccounts(adminId: string): Promise<ExportRow[] | null> {
  return asUser(adminId, async (tx) => {
    if (!(await isAdmin(tx, adminId))) return null;
    const rows = await tx<ExportRow[]>`
      select p.display_name, pp.email, pp.whatsapp_number, p.status, r.role, p.created_at,
             (select count(*)::int from restix.ticket_listings l where l.seller_id = p.id) as listings,
             (select count(*)::int from restix.inquiries i where i.buyer_id = p.id) as requests
      from restix.profiles p
      left join restix.profile_private pp on pp.user_id = p.id
      left join restix.admin_roles r on r.user_id = p.id
      order by p.created_at`;
    await audit(tx, adminId, { action: "export_users", reason: "Exported accounts to a spreadsheet", metadata: { rows: rows.length } });
    return rows;
  });
}
