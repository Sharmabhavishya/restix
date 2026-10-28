import type { Metadata } from "next";
import Link from "next/link";
import { requireModerator } from "@/server/auth/viewer";
import { queueCounts, reportQueue, type ReportStatus } from "@/server/moderation";
import { REPORT_REASONS } from "@/lib/validation";
import { formatPaise } from "@/lib/money";
import { relativeTime } from "@/lib/format";
import { EmptyState, PageTitle, Panel, Pill, type Tone } from "@/components/ui/bits";

export const metadata: Metadata = { title: "Reports" };

const PRIORITY_TONE: Record<string, Tone> = { urgent: "negative", high: "negative", normal: "warning", low: "neutral" };
const TABS: { key: ReportStatus | "active"; label: string }[] = [
  { key: "active", label: "Needs attention" },
  { key: "resolved", label: "Resolved" },
  { key: "dismissed", label: "Dismissed" },
];

export default async function ReportsPage({ searchParams }: PageProps<"/admin/reports">) {
  const sp = await searchParams;
  const mod = await requireModerator();
  const tab = TABS.find((t) => t.key === sp.status)?.key ?? "active";
  const [rows, counts] = await Promise.all([reportQueue(mod.id, tab), queueCounts(mod.id)]);
  const oldest = tab === "active" && rows.length ? rows.reduce((a, b) => (a.createdAt < b.createdAt ? a : b)) : null;

  return (
    <>
      <PageTitle
        title="Reports"
        sub={
          tab === "active"
            ? counts.open + counts.inReview === 0
              ? "Queue's clear."
              : `${counts.open} new, ${counts.inReview} in review${oldest ? `. Oldest waiting since ${relativeTime(oldest.createdAt)}.` : "."}`
            : "Closed reports, newest first."
        }
      />
      <div role="tablist" className="mb-5 flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <Link
            key={t.key}
            role="tab"
            aria-selected={t.key === tab}
            href={t.key === "active" ? "/admin/reports" : `/admin/reports?status=${t.key}`}
            className={`-mb-px border-b-2 px-3 py-2.5 text-sm ${t.key === tab ? "border-accent font-medium" : "border-transparent text-muted hover:text-ink"}`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <>
          <EmptyState title={tab === "active" ? "no reports to review" : "nothing here yet"}>
            {tab === "active" ? "New reports land here, highest priority first." : undefined}
          </EmptyState>
          {tab === "active" && (
            <Panel className="mt-6">
              <h2 className="px-5 pt-5 text-[17px] font-semibold">Other queues</h2>
              <ul className="mt-2 divide-y divide-rule">
                {([
                  ["/admin/reviews", "Listings waiting for a policy check", counts.pendingListings],
                  ["/admin/appeals", "Appeals to decide", counts.openAppeals],
                  ["/admin/events", "Events suggested by students", counts.openSuggestions],
                ] as const).map(([href, label, n]) => (
                  <li key={href}>
                    <Link href={href} className="flex items-center justify-between gap-4 px-5 py-3.5 text-sm hover:bg-raised">
                      <span>{label}</span>
                      <span className={`num font-semibold ${n > 0 ? "text-accent-strong" : "text-muted"}`}>{n}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </>
      ) : (
        <Panel>
          <ul className="divide-y divide-rule">
            {rows.map((r) => {
              const snap = r.targetSnapshot as Record<string, string | number | undefined>;
              return (
                <li key={r.id}>
                  <Link href={`/admin/reports/${r.id}`} className="flex flex-col gap-1.5 px-5 py-4 hover:bg-raised sm:flex-row sm:items-center sm:gap-4">
                    <div className="flex flex-none items-center gap-2 sm:w-44">
                      <Pill tone={PRIORITY_TONE[r.priority]}>{r.priority[0].toUpperCase() + r.priority.slice(1)}</Pill>
                      {r.status === "in_review" && <Pill tone="accent">In review</Pill>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{REPORT_REASONS[r.reason]}</p>
                      <p className="truncate text-[13px] text-muted">
                        {snap.event ? `${snap.event} · ${snap.ticketType ?? ""} · ${typeof snap.askingPricePaise === "number" ? formatPaise(snap.askingPricePaise) : ""} · ` : ""}
                        {r.reportedUserName ? `seller ${r.reportedUserName}` : snap.userName ? `account ${snap.userName}` : ""}
                        {r.details ? ` · “${r.details.slice(0, 80)}${r.details.length > 80 ? "…" : ""}”` : ""}
                      </p>
                    </div>
                    <div className="flex flex-none items-center gap-3 text-[13px] text-muted sm:justify-end">
                      {r.reportsOnTarget > 1 && <span className="font-medium text-negative">{r.reportsOnTarget} open reports</span>}
                      <span>{relativeTime(r.createdAt)}</span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Panel>
      )}
    </>
  );
}
