import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, MapPin } from "lucide-react";
import { requireBrowser } from "@/server/auth/viewer";
import { getEventBySlug } from "@/server/events";
import { displayStatus, searchListings } from "@/server/listings";
import { EVENT_CATEGORIES } from "@/server/event-admin";
import { formatDateTime, formatLongDate, formatTime } from "@/lib/format";
import { formatPaise } from "@/lib/money";
import { bandStyle } from "@/lib/tint";
import { Wristband } from "@/components/wristband";
import { FixtureTag, PolicyPill } from "@/components/listing-bits";
import { EmptyState, Notice, Panel, Pill } from "@/components/ui/bits";
import { ButtonLink } from "@/components/ui/button";
import { TrackView } from "@/components/track";

export const metadata: Metadata = { title: "Event" };

const POLICY_TEXT = {
  allowed: "The organisers allow tickets to be resold or transferred.",
  face_value_only: "Tickets may be resold at face value or less. Listings asking more are blocked.",
  prohibited: "The organisers don't allow resale or transfer. ResTix doesn't accept listings for this event.",
  unknown: "Nobody has confirmed the resale rules yet. Listings are checked by a moderator before they go live.",
} as const;

export default async function EventPage({ params }: PageProps<"/events/[slug]">) {
  const { slug } = await params;
  const viewer = await requireBrowser(`/events/${slug}`);
  if (!/^[a-z0-9-]{2,80}$/.test(slug)) notFound();
  const event = await getEventBySlug(viewer.id, slug);
  if (!event) notFound();
  const { items, total } = await searchListings(viewer.id, { event: slug, sort: "price_asc" });
  const canList = event.transferPolicy !== "prohibited" && (event.status === "scheduled" || event.status === "postponed") && (event.endsAt ?? event.startsAt) > new Date();
  const style = bandStyle(event.id) as React.CSSProperties;

  return (
    <>
      <TrackView name="event_viewed" eventId={event.id} />
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted">
        <Link href="/events" className="hover:text-ink">Events</Link>
      </nav>
      <header style={style} className="mb-6 rounded-[var(--radius-card)] bg-[var(--band)] px-5 py-6 sm:px-7">
        <div className="flex flex-wrap items-center gap-2">
          <PolicyPill policy={event.transferPolicy} />
          {event.status === "cancelled" && <Pill tone="negative">Cancelled</Pill>}
          {event.status === "postponed" && <Pill tone="warning">Postponed</Pill>}
          {event.isFixture && <FixtureTag />}
        </div>
        <h1 className="mt-3 text-2xl font-bold tracking-[-0.01em] sm:text-[32px]">{event.name}</h1>
        <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-[var(--band-ink)]">
          <li className="flex items-center gap-1.5">
            <CalendarDays className="size-4" aria-hidden />
            {formatDateTime(event.startsAt)}{event.endsAt ? ` – ${formatTime(event.endsAt)}` : ""}
          </li>
          {event.venue && <li className="flex items-center gap-1.5"><MapPin className="size-4" aria-hidden />{event.venue}</li>}
          <li>{EVENT_CATEGORIES[event.category as keyof typeof EVENT_CATEGORIES] ?? event.category}</li>
        </ul>
        {event.description && <p className="mt-4 max-w-2xl text-[15px] leading-relaxed">{event.description}</p>}
      </header>

      {event.status === "cancelled" && (
        <Notice tone="error" className="mb-6" title="This event was cancelled">
          Listings for it are no longer available. If you bought a ticket from someone here, sort out any refund directly with them; ResTix can&apos;t recover payments.
        </Notice>
      )}
      {event.status === "postponed" && (
        <Notice tone="warning" className="mb-6" title="This event was postponed">
          Check the new date with the organisers before buying or selling. Listings stay up unless the seller takes them down.
        </Notice>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section aria-labelledby="listings-heading">
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <h2 id="listings-heading" className="text-lg font-semibold">
              {total ? `${total} ${total === 1 ? "listing" : "listings"}, cheapest first` : "Listings"}
            </h2>
            {canList && <ButtonLink href={`/sell?event=${event.slug}`} size="sm">Sell yours</ButtonLink>}
          </div>
          {items.length === 0 ? (
            <EmptyState title={canList ? "no one's selling yet" : "no listings"}>
              {canList ? "If you've got a spare, you'd be the first." : "Tickets for this event can't be listed on ResTix."}
            </EmptyState>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {items.map((l) => (
                <li key={l.id}>
                  <Wristband listing={l} status={displayStatus(l)} href={`/listings/${l.id}`} showEvent={false} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="flex flex-col gap-4">
          <Panel className="p-5">
            <h2 className="font-semibold">Resale rules</h2>
            <p className="mt-2 text-sm leading-relaxed">{POLICY_TEXT[event.transferPolicy]}</p>
            {event.policySource && (
              <p className="mt-2 text-[13px] text-muted">
                Source: {event.policySource}
                {event.policyUpdatedAt ? ` (updated ${formatLongDate(event.policyUpdatedAt)})` : ""}
              </p>
            )}
          </Panel>
          {event.ticketTypes.length > 0 && (
            <Panel className="p-5">
              <h2 className="font-semibold">Ticket types</h2>
              <ul className="mt-2 divide-y divide-rule text-sm">
                {event.ticketTypes.map((t) => (
                  <li key={t.id} className="flex justify-between gap-4 py-2">
                    <span>{t.name}</span>
                    <span className="num text-muted">{t.faceValuePaise !== null ? `face value ${formatPaise(t.faceValuePaise)}` : "—"}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </aside>
      </div>
    </>
  );
}
