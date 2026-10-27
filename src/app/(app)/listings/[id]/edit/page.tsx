import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireBrowser } from "@/server/auth/viewer";
import { displayStatus, getListing } from "@/server/listings";
import { listableEvents } from "@/server/events";
import { eventCloseTime, sellerCan } from "@/lib/listing-rules";
import { toLocalInput } from "@/lib/format";
import { ListingForm } from "../../listing-form";
import { PageTitle, Panel } from "@/components/ui/bits";

export const metadata: Metadata = { title: "Edit listing" };

export default async function EditListingPage({ params }: PageProps<"/listings/[id]/edit">) {
  const { id } = await params;
  const viewer = await requireBrowser(`/listings/${id}/edit`);
  const listing = await getListing(viewer.id, id);
  if (!listing || listing.sellerId !== viewer.id) notFound();
  if (!sellerCan("edit", displayStatus(listing))) redirect(`/listings/${id}`);

  const events = (await listableEvents(viewer.id)).filter((e) => e.id === listing.eventId);
  if (events.length === 0) redirect(`/listings/${id}`);
  const formEvents = events.map((e) => ({
    id: e.id, name: e.name, startsAt: e.startsAt.toISOString(), closesAt: eventCloseTime(e).toISOString(), status: e.status,
    transferPolicy: e.transferPolicy, policySource: e.policySource, isFixture: e.isFixture, ticketTypes: e.ticketTypes,
  }));

  return (
    <>
      <PageTitle title="Edit listing" sub={`${listing.eventName} · ${listing.ticketTypeName}`} />
      <Panel className="max-w-3xl p-5 sm:p-7">
        <ListingForm
          editing
          events={formEvents}
          defaults={{
            listingId: listing.id,
            version: listing.version,
            eventId: listing.eventId,
            ticketTypeId: listing.ticketTypeId,
            format: listing.format,
            quantity: listing.quantity,
            askingPricePaise: listing.askingPricePaise,
            originalPricePaise: listing.originalPricePaise,
            priceNegotiable: listing.priceNegotiable,
            handoverMethod: listing.handoverMethod,
            meetupArea: listing.meetupArea,
            handoverNotes: listing.handoverNotes,
            sellerNotes: listing.sellerNotes,
            expiresAt: toLocalInput(listing.expiresAt),
          }}
        />
      </Panel>
    </>
  );
}
