import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, MapPin } from "lucide-react";
import { requireBrowser } from "@/server/auth/viewer";
import { getEventBySlug } from "@/server/events";
import { displayStatus, searchListings } from "@/server/listings";
import { formatDateTime, formatTime } from "@/lib/format";
import { formatPaise } from "@/lib/money";
import { TicketCard } from "@/components/ticket-card";
import { EmptyState, Notice, Panel } from "@/components/ui/bits";
import { TrackView } from "@/components/track";
import { ShareButton } from "@/components/share-button";
import { EventPoster } from "@/components/event-poster";
import { WantButton } from "@/components/want-button";
import { SaveButton } from "@/components/save-button";

export const metadata: Metadata = { title: "Event" };

export default async function EventPage({ params }: PageProps<"/events/[slug]">) {
  const { slug } = await params;
  const viewer = await requireBrowser(`/events/${slug}`);
  if (!/^[a-z0-9-]{2,80}$/.test(slug)) notFound();
  const event = await getEventBySlug(viewer.id, slug);
  if (!event) notFound();
  const { items, total } = await searchListings(viewer.id, { event: slug, sort: "price_asc" });
  const resaleOk = event.transferPolicy === "allowed" || event.transferPolicy === "face_value_only";
  const canList = resaleOk && (event.status === "scheduled" || event.status === "postponed") && (event.endsAt ?? event.startsAt) > new Date();

  return (
    <>
      <TrackView name="event_viewed" eventId={event.id} />
      <div className="mb-4 flex items-center justify-between gap-4">
        <nav aria-label="Breadcrumb" className="[&_a]:tap text-sm text-muted">
          <Link href="/events" className="hover:text-ink">Events</Link>
        </nav>
        <ShareButton path={`/events/${event.slug}`} title={`${event.name} on ResTix`} text={`Tickets for ${event.name} on ResTix. Student sign-in needed.`} />
      </div>
      <div className="mb-6">
        <EventPoster event={event} size="hero">
          {canList && <WantButton eventId={event.id} wanted={Boolean(event.iWant)} count={event.wantCount ?? 0} />}
          {canList && (
            <Link href={`/sell?event=${event.slug}`} className="inline-flex h-8 items-center rounded-full bg-white px-3.5 text-[13px] font-semibold text-[#111827] transition-transform hover:scale-[1.03]">
              Sell yours
            </Link>
          )}
        </EventPoster>
        <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 px-1 text-sm text-muted">
          <li className="flex items-center gap-1.5">
            <CalendarDays className="size-4" aria-hidden />
            {formatDateTime(event.startsAt)}{event.endsAt ? ` – ${formatTime(event.endsAt)}` : ""}
          </li>
          {event.venue && <li className="flex items-center gap-1.5"><MapPin className="size-4" aria-hidden />{event.venue}</li>}
        </ul>
        {event.description && <p className="mt-3 max-w-2xl px-1 text-[15px] leading-relaxed whitespace-pre-line text-ink-soft">{event.description}</p>}
      </div>

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

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section aria-labelledby="listings-heading">
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <h2 id="listings-heading" className="text-lg font-semibold">
              {total ? `${total} ${total === 1 ? "listing" : "listings"}, cheapest first` : "Listings"}
            </h2>
          </div>
          {items.length === 0 ? (
            <EmptyState title={canList ? "no one's selling yet" : "no listings"}>
              {canList ? "If you've got a spare, you'd be the first." : "Listings for this event aren't open on ResTix."}
            </EmptyState>
          ) : (
            <ul className="flex flex-col gap-4">
              {items.map((l) => (
                <li key={l.id}>
                  <TicketCard
                    listing={l}
                    status={displayStatus(l)}
                    href={`/listings/${l.id}`}
                    showEvent={false}
                    aside={l.sellerId === viewer.id ? undefined : <SaveButton listingId={l.id} saved={Boolean(l.saved)} />}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="flex flex-col gap-4">
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
