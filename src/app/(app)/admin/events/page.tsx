import type { Metadata } from "next";
import Link from "next/link";
import { requireModerator } from "@/server/auth/viewer";
import { allEvents, openSuggestions } from "@/server/event-admin";
import { testEventCount } from "@/server/admin";
import { TestEvents } from "./test-events";
import { DecideSuggestion } from "../../events/suggest-form";
import { formatDateTime } from "@/lib/format";
import { FORMAT_LABEL, type TransferPolicy } from "@/lib/listing-rules";
import { FixtureTag, PolicyPill } from "@/components/listing-bits";
import { EmptyState, Notice, PageTitle, Panel, Pill } from "@/components/ui/bits";
import { ButtonLink, buttonClass } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { matchesSearch } from "@/lib/event-search";

export const metadata: Metadata = { title: "Manage events" };

export default async function AdminEventsPage({ searchParams }: PageProps<"/admin/events">) {
  const sp = await searchParams;
  const mod = await requireModerator();
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";
  const [everyEvent, suggestions, testCount] = await Promise.all([allEvents(mod.id), openSuggestions(mod.id), mod.role === "admin" ? testEventCount(mod.id) : 0]);
  const events = everyEvent.filter((e) => matchesSearch(e, q));
  const held = everyEvent.filter((e) => e.transferPolicy === "unknown" && e.status !== "cancelled").length;
  return (
    <>
      <PageTitle
        title="Events"
        sub={held ? `${held} ${held === 1 ? "event is" : "events are"} on hold and hidden from students.` : "Every event here is open for students to buy and sell."}
        actions={<ButtonLink href="/admin/events/new">Add event</ButtonLink>}
      />
      {typeof sp.saved === "string" && <Notice tone="success" className="mb-5">Saved “{sp.saved}”.</Notice>}
      {mod.role === "admin" && <TestEvents count={testCount} />}
      {sp.deleted === "1" && <Notice tone="success" className="mb-5">Event deleted, with its listings. It&apos;s recorded in the audit log.</Notice>}
      {suggestions.length > 0 && (
        <Panel className="mb-6">
          <h2 className="px-5 pt-5 pb-1 text-[17px] font-semibold">Event requests from students ({suggestions.length})</h2>
          <p className="px-5 text-[13px] text-muted">Nobody sees these until you approve. “Approve &amp; publish” puts the event live as sent; “Edit first” opens it in the editor.</p>
          <ul className="mt-2 divide-y divide-rule">
            {suggestions.map((s) => (
              <li key={s.id} className="grid gap-3 px-5 py-4 md:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">
                <div className="min-w-0">
                  <p className="font-medium">{s.name}</p>
                  <p className="text-[13px] text-muted">
                    {s.startsAt ? formatDateTime(s.startsAt) : s.happensOn ?? "date not given"}
                    {s.venue ? ` · ${s.venue}` : ""} · from {s.suggestedByName ?? "a deleted account"}
                  </p>
                  <p className="mt-1 text-[13px] text-muted">
                    Tickets: {s.ticketFormat ? FORMAT_LABEL[s.ticketFormat] : "kind not given"} · {s.ticketTypes.length ? s.ticketTypes.join(", ") : "one kind for everyone"}
                  </p>
                  {s.details && <p className="mt-1 text-sm whitespace-pre-line">{s.details}</p>}
                </div>
                <DecideSuggestion id={s.id} />
              </li>
            ))}
          </ul>
        </Panel>
      )}
      {(everyEvent.length >= 8 || q) && (
        <form method="get" role="search" className="mb-5 flex max-w-xl gap-2">
          <Input name="q" type="search" defaultValue={q} placeholder="Search events" aria-label="Search events" />
          <button className={buttonClass("dark")}>Search</button>
        </form>
      )}
      {events.length === 0 && q ? (
        <EmptyState title="no events match">Nothing matches “{q}”.</EmptyState>
      ) : events.length === 0 ? (
        <EmptyState title="no events yet" action={<ButtonLink href="/admin/events/new">Add the first one</ButtonLink>} />
      ) : (
        <Panel>
          <ul className="divide-y divide-rule">
            {events.map((e) => (
              <li key={e.id}>
                <Link href={`/admin/events/${e.id}`} className="flex flex-col gap-2 px-5 py-4 hover:bg-raised sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-medium">
                      <span className="truncate">{e.name}</span>
                      {e.isFixture && <FixtureTag />}
                    </p>
                    <p className="text-[13px] text-muted">{formatDateTime(e.startsAt)} · {e.activeListings} live · {e.pendingListings} waiting for review</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {e.status !== "scheduled" && <Pill tone={e.status === "cancelled" ? "negative" : "warning"}>{e.status}</Pill>}
                    <PolicyPill policy={e.transferPolicy as TransferPolicy} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </>
  );
}
