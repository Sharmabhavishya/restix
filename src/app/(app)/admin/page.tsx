import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BarChart3, CalendarPlus, Download, ScrollText, Users } from "lucide-react";
import { requireModerator } from "@/server/auth/viewer";
import { dashboard } from "@/server/admin";
import { recentAudit } from "@/server/moderation";
import { relativeTime } from "@/lib/format";
import { Notice, PageTitle, Panel } from "@/components/ui/bits";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage({ searchParams }: PageProps<"/admin">) {
  const sp = await searchParams;
  const mod = await requireModerator();
  const admin = mod.role === "admin";
  const [d, audit] = await Promise.all([dashboard(mod.id), recentAudit(mod.id, 6)]);
  const a = d.attention;
  const n = d.numbers;

  // What's waiting on the team, most pressing first. Zero means nothing to do there.
  const attention: { label: string; count: number; href?: string; hint: string }[] = [
    { label: "Reports to review", count: a.openReports + a.inReview, href: "/admin/reports", hint: a.inReview ? `${a.inReview} already in review` : "Suspected scams, fakes, harassment" },
    { label: "Appeals to decide", count: a.openAppeals, href: "/admin/appeals", hint: "Students asking for a second look" },
    { label: "Listings to check", count: a.pendingListings, href: "/admin/reviews", hint: "Waiting on an event's resale rule" },
    { label: "Event requests", count: a.openSuggestions, href: "/admin/events", hint: "Students asking you to add an event" },
    { label: "Events on hold", count: a.unknownPolicy, href: "/admin/events", hint: "Upcoming, with no resale rule set" },
    { label: "Disputed handovers", count: a.disputes, hint: "Marked disputed in the last 30 days" },
  ];
  const waiting = attention.filter((x) => x.count > 0);
  const totalWaiting = waiting.reduce((s, x) => s + x.count, 0);

  const stats: { label: string; value: number; note?: string }[] = [
    { label: "Students", value: n.users, note: n.newUsers ? `+${n.newUsers} this week` : "none new this week" },
    { label: "Live listings", value: n.liveListings, note: `${n.liveTickets} ${n.liveTickets === 1 ? "ticket" : "tickets"} up` },
    { label: "Upcoming events", value: n.upcomingEvents },
    { label: "Requests this week", value: n.requests },
    { label: "Deals accepted this week", value: n.accepted },
    { label: "Handovers this week", value: n.handovers, note: "confirmed completed" },
  ];

  const actions = [
    { href: "/admin/events/new", label: "Add an event", icon: CalendarPlus },
    ...(admin ? [{ href: "/admin/team", label: "Manage the team", icon: Users }] : []),
    ...(admin ? [{ href: "/admin/analytics", label: "Analytics", icon: BarChart3 }] : []),
    { href: "/admin/audit", label: "Audit log", icon: ScrollText },
  ];

  return (
    <>
      <PageTitle
        title="Dashboard"
        sub={totalWaiting ? `hey ${mod.displayName.split(/\s+/)[0]}. ${totalWaiting} ${totalWaiting === 1 ? "thing needs" : "things need"} you.` : `hey ${mod.displayName.split(/\s+/)[0]}. all clear right now.`}
        actions={admin ? (
          // A plain link: the file downloads, and the download is logged.
          <a href="/api/admin/export" className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-control)] bg-primary px-4 text-sm font-medium text-on-primary hover:opacity-90">
            <Download className="size-4" aria-hidden /> Export accounts
          </a>
        ) : undefined}
      />
      {sp.notice === "admins-only" && <Notice tone="warning" className="mb-5">That page is for the admin only.</Notice>}

      <section aria-labelledby="attention-heading">
        <h2 id="attention-heading" className="mb-3 text-[13px] font-semibold tracking-wide text-muted uppercase">Needs your attention</h2>
        {waiting.length === 0 ? (
          <Panel className="p-5 text-[15px] text-ink-soft">Nothing waiting: no open reports, appeals, checks or requests.</Panel>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {waiting.map((x) => {
              const body = (
                <>
                  <span className="num font-display text-[34px] leading-none font-extrabold tracking-[-0.03em] text-accent-strong">{x.count}</span>
                  <span className="mt-2 flex items-center gap-1.5 font-semibold">
                    {x.label} {x.href && <ArrowRight className="size-4 text-muted transition-transform group-hover:translate-x-0.5" aria-hidden />}
                  </span>
                  <span className="mt-0.5 text-[13px] text-muted">{x.hint}</span>
                </>
              );
              return (
                <li key={x.label}>
                  {x.href ? (
                    <Link href={x.href} className="group flex h-full flex-col rounded-[var(--radius-card)] border border-accent-track bg-accent-soft/50 p-5 hover:border-accent">
                      {body}
                    </Link>
                  ) : (
                    <div className="flex h-full flex-col rounded-[var(--radius-card)] border border-border bg-surface p-5">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="numbers-heading" className="mt-8">
        <h2 id="numbers-heading" className="mb-3 text-[13px] font-semibold tracking-wide text-muted uppercase">ResTix right now</h2>
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {stats.map((s) => (
            <li key={s.label} className="rounded-[var(--radius-card)] border border-border bg-surface p-4">
              <p className="text-[13px] text-muted">{s.label}</p>
              <p className="num mt-1 text-[26px] leading-tight font-bold">{s.value.toLocaleString("en-IN")}</p>
              {s.note && <p className="text-[12px] text-muted">{s.note}</p>}
            </li>
          ))}
        </ul>
        {n.restricted > 0 && (
          <p className="mt-3 text-[13px] text-muted">
            {n.restricted} {n.restricted === 1 ? "account is" : "accounts are"} restricted or suspended. <Link href="/admin/users" className="underline">See accounts</Link>
          </p>
        )}
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <Panel className="p-5">
          <h2 className="text-[15px] font-semibold">Quick actions</h2>
          <ul className="mt-3 flex flex-col gap-1">
            {actions.map(({ href, label, icon: Icon }) => (
              <li key={href}>
                <Link href={href} className="flex min-h-11 items-center gap-3 rounded-[var(--radius-control)] px-2 hover:bg-raised">
                  <Icon className="size-4 text-accent-strong" aria-hidden /> {label}
                </Link>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel className="p-5">
          <h2 className="text-[15px] font-semibold">Newest students</h2>
          <ul className="mt-3 flex flex-col divide-y divide-rule">
            {d.newest.map((u) => (
              <li key={u.id} className="flex items-baseline justify-between gap-3 py-2.5 first:pt-0">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{u.displayName}</span>
                  <span className="block truncate text-[12px] text-muted">{u.email}</span>
                </span>
                <span className="flex-none text-[12px] text-muted">{relativeTime(u.createdAt)}</span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel className="p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[15px] font-semibold">Latest moderation</h2>
            <Link href="/admin/audit" className="text-[13px] underline">All</Link>
          </div>
          {audit.length === 0 ? (
            <p className="mt-3 text-[13px] text-muted">No actions yet.</p>
          ) : (
            <ul className="mt-3 flex flex-col divide-y divide-rule">
              {audit.map((r) => (
                <li key={r.id} className="py-2.5 first:pt-0">
                  <p className="text-[14px]">
                    <span className="font-medium">{r.actorName ?? "deleted account"}</span> · {r.action.replace(/_/g, " ")}
                  </p>
                  <p className="truncate text-[12px] text-muted">{relativeTime(r.createdAt)} · {r.reason}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
