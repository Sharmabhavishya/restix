import type { Metadata } from "next";
import { requireBrowser } from "@/server/auth/viewer";
import { listUpcomingEvents } from "@/server/events";
import { mySuggestions } from "@/server/event-admin";
import { SuggestForm } from "./suggest-form";
import { EmptyState, PageTitle, Panel, Pill } from "@/components/ui/bits";
import { EventPoster } from "@/components/event-poster";
import { MotionRoot } from "@/components/motion-root";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "Events" };


export default async function EventsPage() {
  const viewer = await requireBrowser("/events");
  const [events, suggestions] = await Promise.all([listUpcomingEvents(viewer.id), mySuggestions(viewer.id)]);

  return (
    <>
      <MotionRoot />
      <PageTitle
        title="Events"
        sub="what's coming up, and what's already listed."
        actions={viewer.role ? <ButtonLink href="/admin/events/new" variant="dark">Add event</ButtonLink> : <ButtonLink href="#suggest" variant="secondary">Add an event</ButtonLink>}
      />
      {events.length === 0 ? (
        <EmptyState title="no upcoming events yet">Moderators add events as they&apos;re announced. Check back soon.</EmptyState>
      ) : (
        <ul className="grid grid-cols-[minmax(0,1fr)] gap-5 sm:grid-cols-2">
          {events.map((e, i) => (
            <li key={e.id} data-reveal style={{ "--i": i % 4 } as React.CSSProperties}>
              <EventPoster event={e} href={`/events/${e.slug}`} />
            </li>
          ))}
        </ul>
      )}
      <section id="suggest" aria-labelledby="suggest-heading" className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <h2 id="suggest-heading" className="font-display text-2xl font-bold tracking-[-0.02em]">event missing?</h2>
          <p className="mt-1 max-w-md text-[15px] text-muted">
            Add it. An admin checks it&apos;s real, then it shows up here for everyone.
          </p>
          {suggestions.length > 0 && (
            <ul className="mt-5 flex flex-col gap-2 text-sm">
              {suggestions.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{s.name}</span>
                  <Pill tone={s.status === "added" ? "positive" : s.status === "declined" ? "neutral" : "warning"}>
                    {s.status === "open" ? "Waiting for approval" : s.status === "added" ? "Approved" : "Declined"}
                  </Pill>
                  {s.moderatorNote && <span className="text-muted">{s.moderatorNote}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
        <Panel className="p-5">
          {viewer.role ? (
            <div className="flex flex-col items-start gap-3">
              <p className="text-sm text-muted">You&apos;re an admin, so you can put events up straight away.</p>
              <ButtonLink href="/admin/events/new" variant="dark">Add an event</ButtonLink>
            </div>
          ) : viewer.access === "ok" ? <SuggestForm /> : <p className="text-sm text-muted">Your account can&apos;t add events right now.</p>}
        </Panel>
      </section>
    </>
  );
}
