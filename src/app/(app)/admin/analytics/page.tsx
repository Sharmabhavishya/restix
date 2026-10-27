import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { requireAdmin } from "@/server/auth/viewer";
import { computeMetrics, type Ratio } from "@/server/metrics";
import { FORMAT_LABEL, STATUS_LABEL, type ListingStatus, type TicketFormat } from "@/lib/listing-rules";
import { formatDayMonth, formatLongDate, fromLocalInput, toLocalInput } from "@/lib/format";
import { BarList, Columns, RunningTotal } from "@/components/charts";
import { PageTitle, Panel, PanelHeader } from "@/components/ui/bits";
import { Input } from "@/components/ui/field";
import { buttonClass } from "@/components/ui/button";

export const metadata: Metadata = { title: "Analytics" };

const PRESETS = [["7", "7 days"], ["30", "30 days"], ["90", "90 days"]] as const;
const DAY = 86_400_000;

function pct(r: Ratio): ReactNode {
  if (r.denominator === 0) return <span className="text-muted">—</span>;
  return (
    <>
      {((r.numerator / r.denominator) * 100).toFixed(1)}%
      <span className="ml-1.5 text-[13px] font-normal text-muted">{r.numerator} of {r.denominator}</span>
    </>
  );
}

function hours(h: number | null): ReactNode {
  if (h === null) return <span className="text-muted">—</span>;
  if (h < 1) return `${Math.round(h * 60)} min`;
  if (h < 48) return `${h.toFixed(1)} h`;
  return `${(h / 24).toFixed(1)} days`;
}

function Kpi({ label, value, note }: { label: string; value: ReactNode; note?: string }) {
  return (
    <div className="flex flex-col gap-1 px-5 py-4">
      <span className="text-[13px] text-muted">{label}</span>
      <span className="num text-2xl leading-tight font-semibold">{value}</span>
      {note && <span className="text-[12px] text-muted">{note}</span>}
    </div>
  );
}

/** The date range from the query string: a preset number of days, or a custom from/to. */
function analyticsRange(sp: Record<string, string | string[] | undefined>) {
  const days = typeof sp.days === "string" && /^\d{1,3}$/.test(sp.days) ? Math.min(365, Math.max(1, Number(sp.days))) : 30;
  const customFrom = typeof sp.from === "string" ? fromLocalInput(`${sp.from}T00:00`) : null;
  const customTo = typeof sp.to === "string" ? fromLocalInput(`${sp.to}T00:00`) : null;
  const to = customTo ? new Date(customTo.getTime() + DAY) : new Date(Math.ceil(Date.now() / DAY) * DAY);
  const earliest = new Date(to.getTime() - 366 * DAY);
  const from = customFrom && customFrom < to ? (customFrom < earliest ? earliest : customFrom) : new Date(to.getTime() - days * DAY);
  return { days, customFrom, from, to };
}

export default async function AnalyticsPage({ searchParams }: PageProps<"/admin/analytics">) {
  const sp = await searchParams;
  const admin = await requireAdmin();
  const { days, customFrom, from, to } = analyticsRange(sp);
  const m = await computeMetrics(admin.id, { from, to });

  const daily = m.daily.map((d) => ({ label: formatDayMonth(new Date(`${d.day}T12:00:00Z`)), listings: d.listings, inquiries: d.inquiries }));
  const status = m.listingStatusNow;
  const views = Object.fromEntries(m.views.map((v) => [v.name, v]));
  const outcome = (party: string, o: string) => m.outcomes.find((x) => x.party === party && x.outcome === o)?.count ?? 0;
  const nothingYet = m.accounts.total === 0 && m.listings.createdInRange === 0 && m.activeUsers === 0;

  return (
    <>
      <PageTitle
        title="Analytics"
        sub={`${formatLongDate(from)} – ${formatLongDate(new Date(to.getTime() - 1))}. Recorded activity only; sample events are excluded. Definitions in docs/ANALYTICS.md.`}
      />
      <div className="mb-6 flex flex-wrap items-end gap-2">
        {PRESETS.map(([d, label]) => (
          <Link key={d} href={`/admin/analytics?days=${d}`} className={buttonClass(!customFrom && String(days) === d ? "dark" : "secondary", "sm")}>
            {label}
          </Link>
        ))}
        <form method="get" className="flex flex-wrap items-center gap-2">
          <div className="w-40"><Input type="date" name="from" aria-label="From" defaultValue={toLocalInput(from).slice(0, 10)} className="h-8 text-sm" /></div>
          <div className="w-40"><Input type="date" name="to" aria-label="To" defaultValue={toLocalInput(new Date(to.getTime() - DAY)).slice(0, 10)} className="h-8 text-sm" /></div>
          <button className={buttonClass("secondary", "sm")}>Apply</button>
        </form>
      </div>

      {nothingYet && (
        <p className="mb-6 rounded-[var(--radius-card)] border border-dashed border-control px-5 py-4 text-sm text-muted">
          No recorded activity in this range yet. Numbers appear here as students sign in, list and contact each other; nothing is estimated or backfilled.
        </p>
      )}

      <Panel className="mb-6 grid grid-cols-2 divide-rule max-md:[&>*:nth-child(n+3)]:border-t md:grid-cols-4 md:divide-x">
        <Kpi label="Verified accounts" value={m.accounts.verified.toLocaleString("en-IN")} note={`${m.accounts.newInRange} new in range · ${m.accounts.total} total`} />
        <Kpi label="Active students" value={m.activeUsers.toLocaleString("en-IN")} note="unique accounts with any activity" />
        <Kpi label="Listings published" value={m.listings.publishedInRange.toLocaleString("en-IN")} note={`${m.listings.uniqueEvents} events · ${m.listings.createdInRange} created`} />
        <Kpi label="Contact requests" value={m.inquiries.created.toLocaleString("en-IN")} note={`${m.inquiries.accepted} accepted by sellers`} />
      </Panel>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="Listings published per day" />
          <div className="px-4 pb-4"><Columns points={daily.map((d) => ({ label: d.label, value: d.listings }))} title="Listings published per day" /></div>
        </Panel>
        <Panel>
          <PanelHeader title="Listings published, running total" />
          <div className="px-4 pb-4"><RunningTotal points={daily.map((d) => ({ label: d.label, value: d.listings }))} title="Listings published, running total" /></div>
        </Panel>
        <Panel>
          <PanelHeader title="Contact requests per day" />
          <div className="px-4 pb-4"><Columns points={daily.map((d) => ({ label: d.label, value: d.inquiries }))} title="Contact requests per day" /></div>
        </Panel>
        <Panel>
          <PanelHeader title="Contact requests, running total" />
          <div className="px-4 pb-4"><RunningTotal points={daily.map((d) => ({ label: d.label, value: d.inquiries }))} title="Contact requests, running total" /></div>
        </Panel>
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        <Panel>
          <PanelHeader title="Does listing lead to contact?" />
          <dl className="flex flex-col gap-4 px-5 pb-5 text-sm">
            <div><dt className="text-muted">Listings with at least one request</dt><dd className="num mt-1 text-xl font-semibold">{pct(m.inquiryConversion)}</dd></div>
            <div><dt className="text-muted">Median time to first request</dt><dd className="num mt-1 text-xl font-semibold">{hours(m.medianHoursToFirstInquiry)}</dd></div>
            <div><dt className="text-muted">Students active on 2+ days</dt><dd className="num mt-1 text-xl font-semibold">{pct(m.repeatUsers)}</dd></div>
          </dl>
        </Panel>
        <Panel>
          <PanelHeader title="Reported outcomes" sub="Self-reported after contact. Not verified handovers." />
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 px-5 pb-5 text-sm">
            <div><dt className="text-muted">Buyers: handed over</dt><dd className="num font-semibold">{outcome("buyer", "completed")}</dd></div>
            <div><dt className="text-muted">Sellers: handed over</dt><dd className="num font-semibold">{outcome("seller", "completed")}</dd></div>
            <div><dt className="text-muted">Didn&apos;t happen</dt><dd className="num font-semibold">{outcome("buyer", "not_completed") + outcome("seller", "not_completed")}</dd></div>
            <div><dt className="text-muted">Disputed</dt><dd className={`num font-semibold ${outcome("buyer", "disputed") + outcome("seller", "disputed") > 0 ? "text-negative" : ""}`}>{outcome("buyer", "disputed") + outcome("seller", "disputed")}</dd></div>
            <div className="col-span-2 border-t border-rule pt-3"><dt className="text-muted">Both sides confirmed a handover</dt><dd className="num text-xl font-semibold">{m.bothConfirmedCompleted}</dd></div>
          </dl>
        </Panel>
        <Panel>
          <PanelHeader title="Trust & safety" />
          <dl className="flex flex-col gap-4 px-5 pb-5 text-sm">
            <div><dt className="text-muted">Reports per 100 listings</dt><dd className="num mt-1 text-xl font-semibold">{m.reports.ratePer100Listings === null ? <span className="text-muted">—</span> : m.reports.ratePer100Listings.toFixed(1)}<span className="ml-1.5 text-[13px] font-normal text-muted">{m.reports.submitted} reports</span></dd></div>
            <div><dt className="text-muted">Median time to close a report</dt><dd className="num mt-1 text-xl font-semibold">{hours(m.moderation.medianHoursToResolve)}<span className="ml-1.5 text-[13px] font-normal text-muted">{m.moderation.resolvedInRange} closed</span></dd></div>
            <div><dt className="text-muted">Open right now</dt><dd className={`num mt-1 text-xl font-semibold ${m.reports.open > 0 ? "text-negative" : ""}`}>{m.reports.open}</dd></div>
          </dl>
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel>
          <PanelHeader title="Listings by event" sub="Created in range" />
          <div className="px-5 pb-5"><BarList rows={m.listingsByEvent.map((r) => ({ label: r.name, value: r.count }))} empty="No listings in this range." /></div>
        </Panel>
        <Panel>
          <PanelHeader title="Listings by format" sub="Created in range" />
          <div className="px-5 pb-5"><BarList rows={m.listingsByFormat.map((r) => ({ label: FORMAT_LABEL[r.format as TicketFormat] ?? r.format, value: r.count }))} empty="No listings in this range." /></div>
        </Panel>
        <Panel>
          <PanelHeader title="All listings, status now" sub="Every listing ever, by current status" />
          <ul className="divide-y divide-rule px-5 pb-3 text-sm">
            {(["active", "pending_review", "paused", "sold", "unavailable", "expired", "removed", "rejected", "draft"] as ListingStatus[]).map((s) => (
              <li key={s} className="flex justify-between py-2"><span>{STATUS_LABEL[s]}</span><span className={`num ${status[s] ? "font-medium" : "text-muted"}`}>{status[s] ?? 0}</span></li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel className="mt-6">
        <PanelHeader title="Page views" sub="Views count visits; unique viewers count distinct accounts or anonymous browsers. Approximate by design (browsers can block it)." />
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[12px] text-muted"><th className="px-5 py-2 text-left font-normal">Page</th><th className="px-5 py-2 text-right font-normal">Views</th><th className="px-5 py-2 text-right font-normal">Unique viewers</th></tr>
          </thead>
          <tbody className="divide-y divide-rule">
            {([["landing_viewed", "Landing page"], ["event_viewed", "Event pages"], ["listing_viewed", "Listing pages"]] as const).map(([k, label]) => (
              <tr key={k}>
                <td className="px-5 py-2.5">{label}</td>
                <td className="num px-5 py-2.5 text-right">{views[k]?.views ?? 0}</td>
                <td className="num px-5 py-2.5 text-right">{views[k]?.uniqueViewers ?? 0}</td>
              </tr>
            ))}
            <tr><td className="px-5 py-2.5">Searches with filters</td><td className="num px-5 py-2.5 text-right">{m.searches}</td><td className="px-5 py-2.5 text-right text-muted">—</td></tr>
          </tbody>
        </table>
      </Panel>
    </>
  );
}
