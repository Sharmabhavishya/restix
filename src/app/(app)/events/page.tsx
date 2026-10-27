import type { Metadata } from "next";
import Link from "next/link";
import { requireBrowser } from "@/server/auth/viewer";
import { listUpcomingEvents } from "@/server/events";
import { EVENT_CATEGORIES, mySuggestions } from "@/server/event-admin";
import { SuggestForm } from "./suggest-form";
import { formatTime, TIME_ZONE } from "@/lib/format";
import { formatPaise } from "@/lib/money";
import { bandStyle } from "@/lib/tint";
import { FixtureTag, PolicyPill } from "@/components/listing-bits";
import { EmptyState, PageTitle, Panel, Pill } from "@/components/ui/bits";

export const metadata: Metadata = { title: "Events" };

const dayFmt = new Intl.DateTimeFormat("en-IN", { timeZone: TIME_ZONE, day: "numeric" });
const monFmt = new Intl.DateTimeFormat("en-IN", { timeZone: TIME_ZONE, month: "short" });
const wdFmt = new Intl.DateTimeFormat("en-IN", { timeZone: TIME_ZONE, weekday: "short" });

export default async function EventsPage() {
  const viewer = await requireBrowser("/events");
  const [events, suggestions] = await Promise.all([listUpcomingEvents(viewer.id), mySuggestions(viewer.id)]);

  return (
    <>
      <PageTitle title="Events" sub={`What's coming up at ${viewer.collegeShortName}, and whether tickets can be resold.`} />
      {events.length === 0 ? (
        <EmptyState title="no upcoming events yet">Moderators add events as they&apos;re announced. Check back soon.</EmptyState>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {events.map((e) => (
            <li key={e.id}>
              <Link
                href={`/events/${e.slug}`}
                style={bandStyle(e.id) as React.CSSProperties}
                className="group flex items-stretch gap-[3px] rounded-[var(--radius-card)] focus-visible:outline-offset-4"
              >
                <div className="flex w-16 flex-none flex-col items-center justify-center rounded-l-[var(--radius-card)] bg-[var(--band-strong)] py-3 text-center sm:w-20">
                  <span className="text-[12px] text-[var(--band-ink)]">{wdFmt.format(e.startsAt)}</span>
                  <span className="num text-2xl leading-none font-bold">{dayFmt.format(e.startsAt)}</span>
                  <span className="text-[12px] text-[var(--band-ink)]">{monFmt.format(e.startsAt)}</span>
                </div>
                <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 rounded-r-[var(--radius-card)] bg-[var(--band)] px-4 py-3 transition-colors group-hover:bg-[var(--band-strong)] sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-semibold">
                      <span className="truncate">{e.name}</span>
                      {e.isFixture && <FixtureTag />}
                    </p>
                    <p className="truncate text-[13px] text-[var(--band-ink)]">
                      {EVENT_CATEGORIES[e.category as keyof typeof EVENT_CATEGORIES] ?? e.category} · {formatTime(e.startsAt)}
                      {e.venue ? ` · ${e.venue}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:flex-none sm:justify-end">
                    {e.status === "cancelled" && <Pill tone="negative">Cancelled</Pill>}
                    {e.status === "postponed" && <Pill tone="warning">Postponed</Pill>}
                    <PolicyPill policy={e.transferPolicy} />
                    <span className="num text-[13px] whitespace-nowrap">
                      {e.availableTickets > 0
                        ? `${e.availableTickets} ${e.availableTickets === 1 ? "ticket" : "tickets"} from ${formatPaise(e.lowestPricePaise!)}`
                        : <span className="text-[var(--band-ink)]">none listed</span>}
                    </span>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <section id="suggest" aria-labelledby="suggest-heading" className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <h2 id="suggest-heading" className="text-lg font-semibold">event missing?</h2>
          <p className="mt-1 max-w-md text-[15px] text-muted">
            Tell the mods. They add events once they know the resale rules, so nobody lists tickets they shouldn&apos;t.
          </p>
          {suggestions.length > 0 && (
            <ul className="mt-5 flex flex-col gap-2 text-sm">
              {suggestions.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{s.name}</span>
                  <Pill tone={s.status === "added" ? "positive" : s.status === "declined" ? "neutral" : "warning"}>
                    {s.status === "open" ? "Waiting" : s.status === "added" ? "Added" : "Declined"}
                  </Pill>
                  {s.moderatorNote && <span className="text-muted">{s.moderatorNote}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
        <Panel className="p-5">
          {viewer.access === "ok" ? <SuggestForm /> : <p className="text-sm text-muted">Your account can&apos;t suggest events right now.</p>}
        </Panel>
      </section>
    </>
  );
}
