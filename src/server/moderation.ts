import "server-only";
import type { ListingStatus } from "@/lib/listing-rules";
import type { ReportReason } from "@/lib/validation";
import { asUser, pgCode, PG, type Tx } from "./db";
import { track } from "./analytics";
import { allow } from "./rate-limit";
import { getListing } from "./listings";

type Result = { ok: true; message?: string; id?: string } | { ok: false; error: string };

// ---------------------------------------------------------------------------
// Reporting (any eligible student)
// ---------------------------------------------------------------------------

export async function submitReport(
  viewerId: string,
  input: { listingId?: string; reportedUserId?: string; reason: ReportReason; details: string | null },
): Promise<Result> {
  if (!(await allow("report", viewerId))) {
    return { ok: false, error: "You've sent several reports today. Moderators will get to them; for anything urgent, contact the campus authorities." };
  }
  let snapshot: Record<string, unknown> = {};
  let reportedUserId = input.reportedUserId ?? null;
  if (input.listingId) {
    const listing = await getListing(viewerId, input.listingId);
    if (!listing) return { ok: false, error: "That listing can't be reported (it may have been removed)." };
    if (listing.sellerId === viewerId) return { ok: false, error: "You can't report your own listing." };
    reportedUserId = listing.sellerId;
    snapshot = {
      event: listing.eventName, ticketType: listing.ticketTypeName, format: listing.format,
      askingPricePaise: listing.askingPricePaise, quantity: listing.quantity, status: listing.status,
      sellerName: listing.sellerName, sellerNotes: listing.sellerNotes,
    };
  }
  if (reportedUserId === viewerId) return { ok: false, error: "You can't report yourself." };
  try {
    const [row] = await asUser(viewerId, async (tx) => {
      if (!input.listingId && reportedUserId) {
        const [u] = await tx<{ displayName: string }[]>`select display_name from restix.profiles where id = ${reportedUserId}`;
        if (!u) return [];
        snapshot = { userName: u.displayName };
      }
      return tx<{ id: string }[]>`
        insert into restix.reports (reporter_id, listing_id, reported_user_id, reason, details, target_snapshot)
        values (${viewerId}, ${input.listingId ?? null}, ${reportedUserId}, ${input.reason}, ${input.details}, ${tx.json(snapshot as never)})
        returning id`;
    });
    if (!row) return { ok: false, error: "That account can't be reported." };
    await track("report_submitted", { userId: viewerId, listingId: input.listingId ?? null, props: { reason: input.reason } });
    return { ok: true, id: row.id, message: "Thanks. A moderator will review this. Reports are private: the seller isn't told who reported them." };
  } catch (err) {
    if (pgCode(err) === PG.uniqueViolation) return { ok: false, error: "You already have an open report about this. A moderator will review it." };
    if (pgCode(err) === PG.insufficientPrivilege) return { ok: false, error: "Your account can't send reports right now." };
    console.error("report failed", err instanceof Error ? err.message : err);
    return { ok: false, error: "Your report wasn't sent because of a server error. Please try again." };
  }
}

export async function myReports(viewerId: string) {
  return asUser(viewerId, (tx) => tx<{ id: string; reason: ReportReason; status: string; createdAt: Date; targetSnapshot: Record<string, unknown> }[]>`
    select id, reason, status, created_at, target_snapshot from restix.reports where reporter_id = ${viewerId}
    order by created_at desc limit 50`);
}

// ---------------------------------------------------------------------------
// Moderator reads
// ---------------------------------------------------------------------------

export type ReportStatus = "open" | "in_review" | "resolved" | "dismissed";

export interface QueueRow {
  id: string;
  reason: ReportReason;
  details: string | null;
  status: ReportStatus;
  priority: "low" | "normal" | "high" | "urgent";
  createdAt: Date;
  listingId: string | null;
  reportedUserId: string | null;
  reportedUserName: string | null;
  targetSnapshot: Record<string, unknown>;
  reportsOnTarget: number;
}

export async function reportQueue(modId: string, status: ReportStatus | "active" = "active"): Promise<QueueRow[]> {
  return asUser(modId, (tx) => tx<QueueRow[]>`
    select r.id, r.reason, r.details, r.status, r.priority, r.created_at, r.listing_id, r.reported_user_id,
           u.display_name as reported_user_name, r.target_snapshot,
           (select count(*)::int from restix.reports r2
             where (r2.listing_id = r.listing_id or (r.listing_id is null and r2.reported_user_id = r.reported_user_id))
               and r2.status in ('open', 'in_review')) as reports_on_target
    from restix.reports r
    left join restix.profiles u on u.id = r.reported_user_id
    where ${status === "active" ? tx`r.status in ('open', 'in_review')` : tx`r.status = ${status}`}
    order by case r.priority when 'urgent' then 0 when 'high' then 1 when 'normal' then 2 else 3 end, r.created_at
    limit 200`);
}

export async function queueCounts(modId: string) {
  const [row] = await asUser(modId, (tx) => tx<{ open: number; inReview: number; pendingListings: number; openAppeals: number; openSuggestions: number }[]>`
    select (select count(*)::int from restix.event_suggestions where status = 'open') as open_suggestions,
           (select count(*)::int from restix.reports where status = 'open') as open,
           (select count(*)::int from restix.reports where status = 'in_review') as in_review,
           (select count(*)::int from restix.ticket_listings where status = 'pending_review' and expires_at > now()) as pending_listings,
           (select count(*)::int from restix.appeals where status = 'open') as open_appeals`);
  return row;
}

export async function reportDetail(modId: string, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  return asUser(modId, async (tx) => {
    const [report] = await tx<(QueueRow & {
      reporterId: string | null; reporterName: string | null; resolutionNote: string | null;
      resolvedAt: Date | null; resolvedByName: string | null;
    })[]>`
      select r.id, r.reason, r.details, r.status, r.priority, r.created_at, r.listing_id, r.reported_user_id,
             u.display_name as reported_user_name, r.target_snapshot, 0 as reports_on_target,
             r.reporter_id, rp.display_name as reporter_name, r.resolution_note, r.resolved_at,
             rb.display_name as resolved_by_name
      from restix.reports r
      left join restix.profiles u on u.id = r.reported_user_id
      left join restix.profiles rp on rp.id = r.reporter_id
      left join restix.profiles rb on rb.id = r.resolved_by
      where r.id = ${id}`;
    if (!report) return null;
    const listing = report.listingId
      ? (await tx<{ id: string; status: ListingStatus; statusReason: string | null; askingPricePaise: number; sellerNotes: string | null; version: number }[]>`
          select id, status, status_reason, asking_price_paise, seller_notes, version from restix.ticket_listings where id = ${report.listingId}`)[0] ?? null
      : null;
    const user = report.reportedUserId
      ? (await tx<{ id: string; displayName: string; email: string | null; status: string; statusReason: string | null; createdAt: Date; listings: number; reportsAgainst: number }[]>`
          select p.id, p.display_name, pp.email, p.status, restix.profile_status_reason(p.id) as status_reason, p.created_at,
                 (select count(*)::int from restix.ticket_listings where seller_id = p.id) as listings,
                 (select count(*)::int from restix.reports where reported_user_id = p.id) as reports_against
          from restix.profiles p left join restix.profile_private pp on pp.user_id = p.id
          where p.id = ${report.reportedUserId}`)[0] ?? null
      : null;
    const related = await tx<{ id: string; reason: ReportReason; status: ReportStatus; createdAt: Date }[]>`
      select id, reason, status, created_at from restix.reports
      where id <> ${id} and ((${report.listingId}::uuid is not null and listing_id = ${report.listingId})
                          or (${report.reportedUserId}::uuid is not null and reported_user_id = ${report.reportedUserId}))
      order by created_at desc limit 20`;
    const history = await auditLog(tx, { listingId: report.listingId, userId: report.reportedUserId, reportId: id });
    return { report, listing, user, related, history };
  });
}

export interface AuditEntry {
  id: string;
  action: string;
  reason: string;
  actorName: string | null;
  createdAt: Date;
  listingId: string | null;
  userId: string | null;
  reportId: string | null;
  eventId: string | null;
  metadata: Record<string, unknown>;
}

async function auditLog(tx: Tx, scope: { listingId?: string | null; userId?: string | null; reportId?: string | null; limit?: number }) {
  const scoped = scope.listingId || scope.userId || scope.reportId;
  return tx<AuditEntry[]>`
    select m.id, m.action, m.reason, a.display_name as actor_name, m.created_at, m.listing_id, m.user_id, m.report_id,
           m.event_id, m.metadata
    from restix.moderation_actions m left join restix.profiles a on a.id = m.actor_id
    ${scoped ? tx`where (${scope.listingId ?? null}::uuid is not null and m.listing_id = ${scope.listingId ?? null})
                     or (${scope.userId ?? null}::uuid is not null and m.user_id = ${scope.userId ?? null})
                     or (${scope.reportId ?? null}::uuid is not null and m.report_id = ${scope.reportId ?? null})` : tx``}
    order by m.created_at desc limit ${scope.limit ?? 50}`;
}

export async function recentAudit(modId: string, limit = 100) {
  return asUser(modId, (tx) => auditLog(tx, { limit }));
}

export async function pendingListings(modId: string) {
  return asUser(modId, (tx) => tx<{
    id: string; eventName: string; transferPolicy: string; ticketTypeName: string; format: string; quantity: number;
    askingPricePaise: number; originalPricePaise: number | null; sellerName: string; sellerNotes: string | null;
    createdAt: Date; version: number; eventId: string; eventSlug: string;
  }[]>`
    select l.id, e.name as event_name, e.transfer_policy, t.name as ticket_type_name, l.format, l.quantity,
           l.asking_price_paise, l.original_price_paise, p.display_name as seller_name, l.seller_notes, l.created_at,
           l.version, e.id as event_id, e.slug as event_slug
    from restix.ticket_listings l
    join restix.events e on e.id = l.event_id
    join restix.ticket_types t on t.id = l.ticket_type_id
    join restix.profiles p on p.id = l.seller_id
    where l.status = 'pending_review' and l.expires_at > now()
    order by l.created_at`);
}

// ---------------------------------------------------------------------------
// Moderator writes. Each change and its audit record commit together.
// ---------------------------------------------------------------------------

export async function audit(tx: Tx, modId: string, entry: {
  action: string; reason: string; listingId?: string | null; userId?: string | null; reportId?: string | null;
  eventId?: string | null; metadata?: Record<string, unknown>;
}) {
  await tx`insert into restix.moderation_actions (actor_id, action, reason, listing_id, user_id, report_id, event_id, metadata)
           values (${modId}, ${entry.action}, ${entry.reason}, ${entry.listingId ?? null}, ${entry.userId ?? null},
                   ${entry.reportId ?? null}, ${entry.eventId ?? null}, ${tx.json((entry.metadata ?? {}) as never)})`;
}

export async function guarded(modId: string, fn: (tx: Tx) => Promise<Result>): Promise<Result> {
  if (!(await allow("moderation", modId))) return { ok: false, error: "Too many moderation actions in a short time." };
  try {
    return await asUser(modId, fn);
  } catch (err) {
    const code = pgCode(err);
    if (code === PG.insufficientPrivilege) return { ok: false, error: "You don't have permission to do that." };
    if (code === PG.checkViolation) return { ok: false, error: "Write a reason of at least a few words." };
    console.error("moderation action failed", err instanceof Error ? err.message : err);
    return { ok: false, error: "That didn't save because of a server error. Nothing was changed." };
  }
}

export type ListingModAction = "approve" | "reject" | "hide" | "remove" | "restore";

export async function moderateListing(modId: string, input: { listingId: string; action: ListingModAction; reason: string; reportId?: string | null; version?: number }): Promise<Result> {
  return guarded(modId, async (tx) => {
    const [l] = await tx<{ status: ListingStatus; expiresAt: Date; sellerId: string; version: number }[]>`
      select status, expires_at, seller_id, version from restix.ticket_listings where id = ${input.listingId} for update`;
    if (!l) return { ok: false, error: "Listing not found." };
    if (input.version !== undefined && input.version !== l.version) {
      return { ok: false, error: "The seller changed this listing after you opened it. Reload and check it again." };
    }
    if (l.sellerId === modId) return { ok: false, error: "This is your own listing. Ask another moderator." };
    let next: ListingStatus;
    let auditAction: string;
    switch (input.action) {
      case "approve":
        if (l.status !== "pending_review") return { ok: false, error: "Only listings in review can be approved." };
        next = "active"; auditAction = "approve_listing"; break;
      case "reject":
        if (l.status !== "pending_review") return { ok: false, error: "Only listings in review can be rejected." };
        next = "rejected"; auditAction = "reject_listing"; break;
      case "hide":
        if (!["active", "paused", "pending_review"].includes(l.status)) return { ok: false, error: "Only live listings can be hidden." };
        next = "removed"; auditAction = "hide_listing"; break;
      case "remove":
        if (l.status === "removed") return { ok: false, error: "Already removed." };
        next = "removed"; auditAction = "remove_listing"; break;
      case "restore":
        if (l.status !== "removed") return { ok: false, error: "Only removed listings can be restored." };
        // Restored listings come back paused so the seller confirms they are still selling.
        next = l.expiresAt > new Date() ? "paused" : "expired"; auditAction = "restore_listing"; break;
    }
    await tx`update restix.ticket_listings
             set status = ${next}, status_reason = ${input.reason}, version = version + 1,
                 reviewed_by = ${input.action === "approve" || input.action === "reject" ? modId : null},
                 reviewed_at = ${input.action === "approve" || input.action === "reject" ? new Date() : null},
                 published_at = case when ${next} = 'active' and published_at is null then now() else published_at end
             where id = ${input.listingId}`;
    if (next === "removed") {
      await tx`update restix.inquiries set status = 'closed' where listing_id = ${input.listingId} and status = 'pending'`;
    }
    await audit(tx, modId, {
      action: auditAction, reason: input.reason, listingId: input.listingId, userId: l.sellerId, reportId: input.reportId,
      metadata: { from: l.status, to: next },
    });
    return { ok: true };
  });
}

export type UserModAction = "restrict" | "suspend" | "reinstate";

export async function moderateUser(modId: string, input: { userId: string; action: UserModAction; reason: string; reportId?: string | null }): Promise<Result> {
  if (input.userId === modId) return { ok: false, error: "You can't change your own account status." };
  return guarded(modId, async (tx) => {
    const [u] = await tx<{ status: string; role: string | null }[]>`
      select p.status, r.role from restix.profiles p left join restix.admin_roles r on r.user_id = p.id where p.id = ${input.userId}`;
    if (!u) return { ok: false, error: "Account not found." };
    if (u.role) return { ok: false, error: "Moderators and admins can't restrict each other here. An admin must remove the role first." };
    const next = input.action === "restrict" ? "restricted" : input.action === "suspend" ? "suspended" : "active";
    if (u.status === next) return { ok: false, error: `The account is already ${next}.` };
    await tx`update restix.profiles set status = ${next}, status_reason = ${input.action === "reinstate" ? null : input.reason}
             where id = ${input.userId}`;
    if (next === "restricted") {
      await tx`update restix.ticket_listings set status = 'paused', status_reason = 'Paused while the seller account is restricted', version = version + 1
               where seller_id = ${input.userId} and status = 'active'`;
    }
    if (next === "suspended") {
      // A suspended seller's live listings come down while the decision stands.
      await tx`update restix.ticket_listings set status = 'removed', status_reason = 'Seller account suspended', version = version + 1
               where seller_id = ${input.userId} and status in ('active', 'paused', 'pending_review')`;
    }
    await audit(tx, modId, {
      action: input.action === "restrict" ? "restrict_user" : input.action === "suspend" ? "suspend_user" : "reinstate_user",
      reason: input.reason, userId: input.userId, reportId: input.reportId, metadata: { from: u.status, to: next },
    });
    return { ok: true };
  });
}

export async function updateReport(modId: string, input: { reportId: string; status: "in_review" | "resolved" | "dismissed"; note: string }): Promise<Result> {
  const result = await guarded(modId, async (tx) => {
    const [r] = await tx<{ status: ReportStatus; listingId: string | null; reportedUserId: string | null }[]>`
      select status, listing_id, reported_user_id from restix.reports where id = ${input.reportId} for update`;
    if (!r) return { ok: false, error: "Report not found." };
    if (r.reportedUserId === modId) return { ok: false, error: "This report is about you. Ask another moderator." };
    if (r.status === "resolved" || r.status === "dismissed") return { ok: false, error: "This report is already closed." };
    const closing = input.status !== "in_review";
    await tx`update restix.reports set status = ${input.status},
               resolution_note = ${closing ? input.note : null},
               resolved_by = ${closing ? modId : null}, resolved_at = ${closing ? new Date() : null}
             where id = ${input.reportId}`;
    await audit(tx, modId, {
      action: input.status === "in_review" ? "start_review" : input.status === "resolved" ? "resolve_report" : "dismiss_report",
      reason: input.note, reportId: input.reportId, listingId: r.listingId, userId: r.reportedUserId,
    });
    return { ok: true };
  });
  if (result.ok && input.status !== "in_review") {
    await track("report_resolved", { userId: modId, props: { outcome: input.status } });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Appeals
// ---------------------------------------------------------------------------

export async function submitAppeal(viewerId: string, input: { message: string; listingId?: string | null }): Promise<Result> {
  if (!(await allow("report", `appeal:${viewerId}`))) return { ok: false, error: "You've sent several appeals today. Please wait for a reply." };
  try {
    await asUser(viewerId, (tx) => tx`
      insert into restix.appeals (user_id, moderation_action_id, listing_id, message)
      values (${viewerId}, restix.my_latest_moderation_action(), ${input.listingId ?? null}, ${input.message})`);
    return { ok: true, message: "Appeal sent. A different moderator will look at it where possible." };
  } catch (err) {
    if (pgCode(err) === PG.uniqueViolation) return { ok: false, error: "You already have an open appeal." };
    console.error("appeal failed", err instanceof Error ? err.message : err);
    return { ok: false, error: "Your appeal wasn't sent because of a server error. Please try again." };
  }
}

export async function myAppeals(viewerId: string) {
  return asUser(viewerId, (tx) => tx<{ id: string; message: string; status: string; decisionNote: string | null; createdAt: Date; decidedAt: Date | null }[]>`
    select id, message, status, decision_note, created_at, decided_at from restix.appeals where user_id = ${viewerId}
    order by created_at desc limit 20`);
}

export async function openAppeals(modId: string) {
  return asUser(modId, (tx) => tx<{
    id: string; userId: string; userName: string; userStatus: string; message: string; createdAt: Date;
    actionName: string | null; actionReason: string | null; actionBy: string | null; actionById: string | null; listingId: string | null;
  }[]>`
    select a.id, a.user_id, p.display_name as user_name, p.status as user_status, a.message, a.created_at,
           m.action as action_name, m.reason as action_reason, mp.display_name as action_by, m.actor_id as action_by_id,
           a.listing_id
    from restix.appeals a
    join restix.profiles p on p.id = a.user_id
    left join restix.moderation_actions m on m.id = a.moderation_action_id
    left join restix.profiles mp on mp.id = m.actor_id
    where a.status = 'open' order by a.created_at`);
}

export async function decideAppeal(modId: string, input: { appealId: string; decision: "upheld" | "reversed"; note: string }): Promise<Result> {
  return guarded(modId, async (tx) => {
    const [a] = await tx<{ userId: string; status: string; actorId: string | null }[]>`
      select a.user_id, a.status, m.actor_id from restix.appeals a
      left join restix.moderation_actions m on m.id = a.moderation_action_id
      where a.id = ${input.appealId} for update of a`;
    if (!a) return { ok: false, error: "Appeal not found." };
    if (a.status !== "open") return { ok: false, error: "This appeal has already been decided." };
    if (a.userId === modId) return { ok: false, error: "You can't decide your own appeal." };
    await tx`update restix.appeals set status = ${input.decision}, decision_note = ${input.note}, decided_by = ${modId}, decided_at = now()
             where id = ${input.appealId}`;
    if (input.decision === "reversed") {
      await tx`update restix.profiles set status = 'active', status_reason = null where id = ${a.userId} and status <> 'active'`;
    }
    await audit(tx, modId, {
      action: "decide_appeal", reason: input.note, userId: a.userId,
      metadata: { appealId: input.appealId, decision: input.decision, sameModerator: a.actorId === modId },
    });
    return { ok: true, message: input.decision === "reversed" ? "Reversed: the account is active again. Restore any listings separately." : "Decision upheld." };
  });
}

// ---------------------------------------------------------------------------
// Accounts (moderator lookup)
// ---------------------------------------------------------------------------

export async function findUsers(modId: string, q: string) {
  const pattern = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  return asUser(modId, (tx) => tx<{ id: string; displayName: string; email: string | null; status: string; role: string | null; createdAt: Date; listings: number; reportsAgainst: number }[]>`
    select p.id, p.display_name, pp.email, p.status, r.role, p.created_at,
           (select count(*)::int from restix.ticket_listings where seller_id = p.id) as listings,
           (select count(*)::int from restix.reports where reported_user_id = p.id) as reports_against
    from restix.profiles p
    left join restix.profile_private pp on pp.user_id = p.id
    left join restix.admin_roles r on r.user_id = p.id
    where ${q ? tx`(p.display_name ilike ${pattern} or pp.email ilike ${pattern})` : tx`p.status <> 'active' or exists (select 1 from restix.reports x where x.reported_user_id = p.id)`}
    order by p.created_at desc limit 50`);
}

// ---------------------------------------------------------------------------
// Roles (admins only; RLS on admin_roles enforces it too)
// ---------------------------------------------------------------------------

export async function setRole(adminId: string, input: { userId: string; role: "moderator" | "admin" | null; reason: string }): Promise<Result> {
  if (input.userId === adminId) return { ok: false, error: "You can't change your own role. Ask another admin." };
  return guarded(adminId, async (tx) => {
    const [me] = await tx<{ role: string }[]>`select role from restix.admin_roles where user_id = ${adminId}`;
    if (me?.role !== "admin") return { ok: false, error: "Only admins can change roles." };
    const [target] = await tx<{ status: string; role: string | null }[]>`
      select p.status, r.role from restix.profiles p left join restix.admin_roles r on r.user_id = p.id where p.id = ${input.userId}`;
    if (!target) return { ok: false, error: "Account not found." };
    if (input.role && target.status !== "active") return { ok: false, error: "Only active accounts can be given a role." };
    await tx`delete from restix.admin_roles where user_id = ${input.userId}`;
    if (input.role) {
      await tx`insert into restix.admin_roles (user_id, role, granted_by) values (${input.userId}, ${input.role}, ${adminId})`;
    }
    await audit(tx, adminId, {
      action: input.role ? "grant_role" : "revoke_role", reason: input.reason, userId: input.userId,
      metadata: { from: target.role, to: input.role },
    });
    return { ok: true };
  });
}
