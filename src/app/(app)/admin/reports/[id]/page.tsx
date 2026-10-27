import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireModerator } from "@/server/auth/viewer";
import { reportDetail } from "@/server/moderation";
import { REPORT_REASONS } from "@/lib/validation";
import { STATUS_LABEL, type ListingStatus } from "@/lib/listing-rules";
import { formatPaise } from "@/lib/money";
import { formatDateTime, formatLongDate, relativeTime } from "@/lib/format";
import { ModForm } from "../../mod-form";
import { StatusPill } from "@/components/listing-bits";
import { KeyValue, Notice, PageTitle, Panel, PanelHeader, Pill } from "@/components/ui/bits";

export const metadata: Metadata = { title: "Report" };

const ACTION_LABEL: Record<string, string> = {
  approve_listing: "Approved listing", reject_listing: "Rejected listing", hide_listing: "Hid listing",
  restore_listing: "Restored listing", remove_listing: "Removed listing", restrict_user: "Restricted account",
  suspend_user: "Suspended account", reinstate_user: "Reinstated account", resolve_report: "Resolved report",
  dismiss_report: "Dismissed report", start_review: "Started review", update_event: "Updated event",
  create_event: "Created event", decide_appeal: "Decided appeal", grant_role: "Granted role", revoke_role: "Revoked role",
};

export default async function ReportPage({ params }: PageProps<"/admin/reports/[id]">) {
  const { id } = await params;
  const mod = await requireModerator();
  const data = await reportDetail(mod.id, id);
  if (!data) notFound();
  const { report, listing, user, related, history } = data;
  const snap = report.targetSnapshot as Record<string, string | number | null | undefined>;
  const closed = report.status === "resolved" || report.status === "dismissed";
  const isOwn = report.reportedUserId === mod.id;

  return (
    <>
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted">
        <Link href="/admin" className="hover:text-ink">Reports</Link>
      </nav>
      <PageTitle
        title={REPORT_REASONS[report.reason]}
        sub={`Reported ${relativeTime(report.createdAt)} by ${report.reporterName ?? "a deleted account"} · priority ${report.priority}`}
      />
      {isOwn && <Notice tone="warning" className="mb-6" title="This report is about you">Ask another moderator to handle it.</Notice>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex flex-col gap-6">
          <Panel>
            <PanelHeader title="What was reported" />
            <div className="px-5 pb-5">
              {report.details ? (
                <blockquote className="rounded-[var(--radius-control)] bg-raised px-4 py-3 text-[15px] whitespace-pre-line">{report.details}</blockquote>
              ) : (
                <p className="text-sm text-muted">No details given.</p>
              )}
              {snap.event && (
                <div className="mt-4">
                  <h3 className="mb-1 text-sm font-medium text-muted">Listing when reported</h3>
                  <KeyValue
                    items={[
                      { label: "Event", value: String(snap.event) },
                      { label: "Ticket", value: `${snap.ticketType ?? ""} · ${snap.format ?? ""} · ×${snap.quantity ?? "?"}` },
                      { label: "Asking", value: typeof snap.askingPricePaise === "number" ? formatPaise(snap.askingPricePaise) : "—" },
                      { label: "Seller", value: String(snap.sellerName ?? "—") },
                    ]}
                  />
                  {snap.sellerNotes && <p className="mt-3 text-sm whitespace-pre-line text-muted">Seller notes: {String(snap.sellerNotes)}</p>}
                </div>
              )}
            </div>
          </Panel>

          {listing ? (
            <Panel>
              <PanelHeader
                title="The listing now"
                action={<Link href={`/listings/${listing.id}`} className="text-sm underline">Open</Link>}
                sub={listing.statusReason ? `Status note: ${listing.statusReason}` : undefined}
              />
              <div className="flex flex-col gap-4 px-5 pb-5">
                <div className="flex items-center gap-3">
                  <StatusPill status={listing.status as ListingStatus} />
                  <span className="num text-sm">{formatPaise(listing.askingPricePaise)}</span>
                </div>
                {!isOwn && (
                  <ModForm
                    hidden={{ listingId: listing.id, reportId: report.id }}
                    reasonLabel="Reason for the listing action"
                    placeholder="e.g. Hidden while we check the payment-first request"
                    ops={
                      listing.status === "removed"
                        ? [{ op: "listing:restore", label: "Restore (as paused)" }]
                        : [
                            { op: "listing:hide", label: "Hide while reviewing" },
                            { op: "listing:remove", label: "Remove", tone: "danger" },
                          ]
                    }
                  />
                )}
              </div>
            </Panel>
          ) : report.listingId === null && snap.event ? (
            <Notice tone="info">The listing was deleted. The snapshot above is what was reported.</Notice>
          ) : null}

          {history.length > 0 && (
            <Panel>
              <PanelHeader title="History" sub="Every moderation action on this report, listing or account." />
              <ol className="divide-y divide-rule px-5 pb-3">
                {history.map((h) => (
                  <li key={h.id} className="py-3 text-sm">
                    <p>
                      <span className="font-medium">{ACTION_LABEL[h.action] ?? h.action}</span>
                      <span className="text-muted"> · {h.actorName ?? "deleted moderator"} · {formatDateTime(h.createdAt)}</span>
                    </p>
                    <p className="mt-0.5 text-muted">{h.reason}</p>
                  </li>
                ))}
              </ol>
            </Panel>
          )}
        </div>

        <aside className="flex flex-col gap-6">
          <Panel>
            <PanelHeader title="Decision" sub={closed ? `${report.status === "resolved" ? "Resolved" : "Dismissed"} by ${report.resolvedByName ?? "—"} ${report.resolvedAt ? relativeTime(report.resolvedAt) : ""}` : "Close the report with a note. Act on the listing or account separately."} />
            <div className="px-5 pb-5">
              {closed ? (
                <p className="text-sm">{report.resolutionNote}</p>
              ) : isOwn ? (
                <p className="text-sm text-muted">Another moderator must decide this one.</p>
              ) : (
                <ModForm
                  hidden={{ reportId: report.id }}
                  reasonLabel="Note"
                  placeholder="What you found and what you did"
                  ops={[
                    ...(report.status === "open" ? [{ op: "report:in_review", label: "Start review" }] : []),
                    { op: "report:resolved", label: "Resolve", tone: "dark" as const },
                    { op: "report:dismissed", label: "Dismiss" },
                  ]}
                />
              )}
            </div>
          </Panel>

          {user && (
            <Panel>
              <PanelHeader title="Reported account" />
              <div className="flex flex-col gap-4 px-5 pb-5">
                <KeyValue
                  items={[
                    { label: "Name", value: user.displayName },
                    { label: "Email", value: <span className="break-all">{user.email ?? "—"}</span> },
                    { label: "Status", value: <Pill tone={user.status === "active" ? "positive" : "negative"}>{user.status}</Pill> },
                    { label: "Joined", value: formatLongDate(user.createdAt) },
                    { label: "Listings", value: <span className="num">{user.listings}</span> },
                    { label: "Reports against", value: <span className="num">{user.reportsAgainst}</span> },
                  ]}
                />
                {user.statusReason && <p className="text-[13px] text-muted">Current status reason: {user.statusReason}</p>}
                {!isOwn && (
                  <ModForm
                    hidden={{ userId: user.id, reportId: report.id }}
                    reasonLabel="Reason for the account action"
                    placeholder="Shown to the person on their account page"
                    compact
                    ops={
                      user.status === "active"
                        ? [{ op: "user:restrict", label: "Restrict" }, { op: "user:suspend", label: "Suspend", tone: "danger" }]
                        : [{ op: "user:reinstate", label: "Reinstate" }, ...(user.status === "restricted" ? [{ op: "user:suspend", label: "Suspend", tone: "danger" as const }] : [])]
                    }
                  />
                )}
                <p className="text-[12px] text-muted">
                  Restricting stops listing, contacting and reporting but keeps browsing. Suspending takes their live listings down. Both can be appealed; prefer the lighter step for unverified claims.
                </p>
              </div>
            </Panel>
          )}

          {related.length > 0 && (
            <Panel>
              <PanelHeader title={`Other reports (${related.length})`} />
              <ul className="divide-y divide-rule px-5 pb-3 text-sm">
                {related.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                    <Link href={`/admin/reports/${r.id}`} className="underline">{REPORT_REASONS[r.reason]}</Link>
                    <span className="text-muted">{r.status.replace("_", " ")} · {relativeTime(r.createdAt)}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
          <p className="px-1 text-[12px] text-muted">Listing status now: {listing ? STATUS_LABEL[listing.status as ListingStatus] : "deleted"}.</p>
        </aside>
      </div>
    </>
  );
}
