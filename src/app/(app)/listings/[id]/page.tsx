import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, Clock, MapPin } from "lucide-react";
import { requireBrowser } from "@/server/auth/viewer";
import { displayStatus, getListing } from "@/server/listings";
import { myInquiryFor } from "@/server/inquiries";
import { FORMAT_LABEL, HANDOVER_LABEL, STATUS_LABEL, sellerCan } from "@/lib/listing-rules";
import { formatDateTime, formatLongDate, relativeTime } from "@/lib/format";
import { formatPaise } from "@/lib/money";
import { bandStyle } from "@/lib/tint";
import { ContactForm, OwnerActions, ReportForm } from "./listing-panels";
import { FixtureTag, PolicyPill, StatusPill, VerifiedEmail } from "@/components/listing-bits";
import { KeyValue, Notice, Panel } from "@/components/ui/bits";
import { ButtonLink } from "@/components/ui/button";
import { TrackView } from "@/components/track";
import { ShareButton } from "@/components/share-button";

export const metadata: Metadata = { title: "Listing" };

const SAVED: Record<string, string> = {
  publish: "Your listing is live. We'll show requests in Inquiries.",
  draft: "Saved as a draft. Publish it when you're ready.",
  review: "Sent for a quick policy check. You'll see it go live here once a moderator approves it.",
  edited: "Changes saved.",
};

export default async function ListingPage({ params, searchParams }: PageProps<"/listings/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const viewer = await requireBrowser(`/listings/${id}`);
  const listing = await getListing(viewer.id, id);
  if (!listing) notFound();

  const status = displayStatus(listing);
  const mine = listing.sellerId === viewer.id;
  const inquiry = mine ? null : await myInquiryFor(viewer.id, listing.id);
  const saved = typeof sp.saved === "string" ? SAVED[sp.saved] : undefined;
  const style = bandStyle(listing.eventId) as React.CSSProperties;
  const savings = listing.originalPricePaise !== null ? listing.originalPricePaise - listing.askingPricePaise : null;

  return (
    <>
      {!mine && <TrackView name="listing_viewed" listingId={listing.id} eventId={listing.eventId} />}
      <div className="mb-4 flex items-center justify-between gap-4">
        <nav aria-label="Breadcrumb" className="min-w-0 truncate text-sm text-muted">
          <Link href="/tickets" className="hover:text-ink">Tickets</Link>
          <span aria-hidden> / </span>
          <Link href={`/events/${listing.eventSlug}`} className="hover:text-ink">{listing.eventName}</Link>
        </nav>
        {status === "active" && (
          <ShareButton
            path={`/listings/${listing.id}`}
            title={`${listing.eventName} on ResTix`}
            text={`${listing.ticketTypeName} for ${listing.eventName}, ${formatPaise(listing.askingPricePaise)}${listing.quantity > 1 ? " each" : ""}. Campus sign-in needed to see it.`}
          />
        )}
      </div>

      {saved && mine && <Notice tone="success" className="mb-5">{saved}</Notice>}

      {/* The object header is the ticket itself. */}
      <header style={style} className="mb-6 flex flex-col gap-[3px] sm:flex-row">
        <div className="flex-1 rounded-t-[var(--radius-card)] bg-[var(--band)] px-5 py-5 sm:rounded-l-[var(--radius-card)] sm:rounded-tr-none sm:px-7">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={status} />
            <PolicyPill policy={listing.transferPolicy} />
            {listing.eventIsFixture && <FixtureTag />}
          </div>
          <h1 className="mt-3 text-2xl leading-tight font-bold tracking-[-0.01em] sm:text-[32px]">{listing.eventName}</h1>
          <p className="mt-1 text-[15px] text-[var(--band-ink)]">
            {listing.ticketTypeName} · {FORMAT_LABEL[listing.format]} · {listing.quantity} {listing.quantity === 1 ? "ticket" : "tickets"}
          </p>
          <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-[var(--band-ink)]">
            <li className="flex items-center gap-1.5"><CalendarDays className="size-4" aria-hidden />{formatDateTime(listing.eventStartsAt)}</li>
            {listing.eventVenue && <li className="flex items-center gap-1.5"><MapPin className="size-4" aria-hidden />{listing.eventVenue}</li>}
          </ul>
        </div>
        <div className="flex items-center justify-between gap-6 rounded-b-[var(--radius-card)] bg-[var(--band-strong)] px-5 py-4 sm:w-60 sm:flex-col sm:items-end sm:justify-center sm:rounded-r-full sm:rounded-bl-none sm:py-5 sm:pr-12">
          <div className="sm:text-right">
            <p className="num text-3xl leading-none font-bold">{formatPaise(listing.askingPricePaise)}</p>
            <p className="mt-1 text-[13px] text-[var(--band-ink)]">
              {listing.quantity > 1 ? "per ticket" : "asking"}
              {listing.priceNegotiable ? " · open to offers" : ""}
            </p>
          </div>
          {listing.originalPricePaise !== null && (
            <p className="text-[13px] text-[var(--band-ink)] sm:text-right">
              paid {formatPaise(listing.originalPricePaise)}
              {savings !== null && savings > 0 ? ` · ${formatPaise(savings)} under` : ""}
            </p>
          )}
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-6">
          <Panel className="p-5 sm:p-6">
            <h2 className="mb-2 text-[17px] font-semibold">Handover</h2>
            <KeyValue
              items={[
                { label: "How", value: HANDOVER_LABEL[listing.handoverMethod] },
                { label: "Where", value: listing.meetupArea ?? <span className="text-muted">Agree with the seller</span> },
                { label: "Listing closes", value: <span title={formatLongDate(listing.expiresAt)}>{formatDateTime(listing.expiresAt)}</span> },
                { label: "Listed", value: relativeTime(listing.publishedAt ?? listing.createdAt) },
              ]}
            />
            {listing.handoverNotes && <p className="mt-4 text-[15px] leading-relaxed whitespace-pre-line">{listing.handoverNotes}</p>}
            {listing.sellerNotes && (
              <div className="mt-4 border-t border-rule pt-4">
                <h3 className="mb-1 text-sm font-medium text-muted">From the seller</h3>
                <p className="text-[15px] leading-relaxed whitespace-pre-line">{listing.sellerNotes}</p>
              </div>
            )}
          </Panel>

          <Panel className="p-5 sm:p-6">
            <h2 className="mb-3 text-[17px] font-semibold">What&apos;s verified, and what isn&apos;t</h2>
            <ul className="flex flex-col gap-3 text-[15px]">
              <li><VerifiedEmail college={viewer.collegeShortName} />: the seller signed in with a verified {viewer.collegeShortName} Google account. That proves the email, not enrolment.</li>
              <li>
                <span className="font-medium">Resale policy:</span> {listing.transferPolicy === "allowed" ? "the event's organisers allow resale" : listing.transferPolicy === "face_value_only" ? "resale is allowed at face value only" : listing.transferPolicy === "unknown" ? "not confirmed yet" : "resale isn't allowed"}. This is about the event, not this specific ticket.
              </li>
              <li>
                <span className="font-medium">The ticket itself isn&apos;t checked by ResTix.</span>{" "}
                {listing.reviewedAt ? "A moderator approved this listing against the event's resale rules, which isn't the same as checking the ticket. " : ""}
                Look at the wristband or ticket before you pay.
              </li>
            </ul>
          </Panel>
        </div>

        <aside className="flex flex-col gap-6">
          <Panel className="p-5 sm:p-6">
            <h2 className="text-[17px] font-semibold">{mine ? "Your listing" : "Seller"}</h2>
            <div className="mt-3 flex items-center gap-3">
              <span aria-hidden className="flex size-10 items-center justify-center rounded-full bg-[var(--band-strong)] font-semibold" style={style}>
                {listing.sellerName.slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="truncate font-medium">{listing.sellerName}</p>
                <p className="text-[13px] text-muted">
                  on ResTix since {formatLongDate(listing.sellerMemberSince)} · {listing.sellerActiveListings} live {listing.sellerActiveListings === 1 ? "listing" : "listings"}
                </p>
              </div>
            </div>
            {listing.sellerVerified && <div className="mt-3"><VerifiedEmail college={viewer.collegeShortName} /></div>}

            <div className="mt-5 border-t border-rule pt-5">
              {mine ? (
                <div className="flex flex-col gap-3">
                  {listing.statusReason && (status === "removed" || status === "rejected") && (
                    <Notice tone="warning" title={STATUS_LABEL[status]}>{listing.statusReason}</Notice>
                  )}
                  {sellerCan("edit", status) && (
                    <ButtonLink href={`/listings/${listing.id}/edit`} variant="secondary">Edit details</ButtonLink>
                  )}
                  <OwnerActions listingId={listing.id} version={listing.version} status={status} />
                </div>
              ) : inquiry && (inquiry.status === "pending" || inquiry.status === "accepted") ? (
                <Notice tone={inquiry.status === "accepted" ? "success" : "info"} title={inquiry.status === "accepted" ? "The seller said yes" : "Request sent"}>
                  {inquiry.status === "accepted" ? "Their contact details are in " : "Waiting for the seller. Check "}
                  <Link href="/inquiries" className="font-medium underline">Inquiries</Link>.
                </Notice>
              ) : status !== "active" ? (
                <p className="text-sm text-muted">This listing is {STATUS_LABEL[status].toLowerCase()}, so you can&apos;t contact the seller about it.</p>
              ) : viewer.access !== "ok" ? (
                <Notice tone="warning">Your account can&apos;t contact sellers right now. See your account page.</Notice>
              ) : (
                <ContactForm listingId={listing.id} maxQuantity={listing.quantity} sellerName={listing.sellerName} />
              )}
            </div>
          </Panel>

          {!mine && (
            <div className="flex flex-col gap-3 px-1">
              <p className="flex gap-2 text-[13px] text-muted">
                <Clock className="mt-0.5 size-4 flex-none" aria-hidden />
                ResTix doesn&apos;t handle payments. Pay at the handover, in person, after you&apos;ve seen the ticket.
              </p>
              {viewer.access === "ok" && <ReportForm listingId={listing.id} />}
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
