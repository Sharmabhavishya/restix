import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, Clock, Flame, Lock, MapPin, Sparkles } from "lucide-react";
import { requireBrowser } from "@/server/auth/viewer";
import { displayStatus, getListing } from "@/server/listings";
import { myInquiryFor } from "@/server/inquiries";
import { FORMAT_LABEL, HANDOVER_LABEL, STATUS_LABEL, sellerCan, type TicketFormat } from "@/lib/listing-rules";
import { dealFor, REF_LABEL } from "@/lib/deal";
import { formatDateTime, formatLongDate, relativeTime } from "@/lib/format";
import { formatPaise } from "@/lib/money";
import { bandStyle } from "@/lib/tint";
import { ContactForm, OwnerActions, ReportForm } from "./listing-panels";
import { FixtureTag, StatusPill, VerifiedEmail } from "@/components/listing-bits";
import { PRICE_TONE } from "@/components/ticket-card";
import { SaveButton } from "@/components/save-button";
import { coverUrl } from "@/server/event-covers";
import { KeyValue, Notice, Panel } from "@/components/ui/bits";
import { ButtonLink } from "@/components/ui/button";
import { privateProfile } from "@/server/profile";
import { TrackView } from "@/components/track";
import { ShareButton } from "@/components/share-button";

export const metadata: Metadata = { title: "Listing" };

// What to check before paying, by kind of ticket.
const CHECK_TIP: Record<TicketFormat, string> = {
  wristband: "Look at the wristband before you pay: uncut, unworn, the right event.",
  paper: "Look at the ticket before you pay: right event, right date, stub not torn off.",
  qr: "Get the QR before you pay and check the name and date on it. A screenshot can be sent to more than one person.",
  email: "Check the booking email shows the right event, and whether the name on it is checked at entry.",
  app: "Have the seller start the transfer in the app, and accept it before you pay.",
  pass: "Check the pass in person before you pay: right event, nobody else's photo on it.",
  token: "Count the tokens and check they're for this event before you pay.",
  other: "Check the ticket before you pay.",
};

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
  const deal = dealFor(listing);
  // The buyer's own saved number, for the "share if they say yes" choice.
  const priv = mine ? null : await privateProfile(viewer.id);

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
          <div className="flex flex-none items-center gap-2">
          {!mine && <SaveButton listingId={listing.id} saved={Boolean(listing.saved)} label />}
          <ShareButton
            path={`/listings/${listing.id}`}
            title={`${listing.eventName} on ResTix`}
            text={`${listing.ticketTypeName} for ${listing.eventName}, ${formatPaise(listing.askingPricePaise)}${listing.quantity > 1 ? " each" : ""}. Student sign-in needed to see it.`}
          />
          </div>
        )}
      </div>

      {saved && mine && <Notice tone="success" className="mb-5">{saved}</Notice>}

      {/* The object header is the ticket itself: body, perforation, stub. */}
      {listing.eventCoverVersion ? (
        <Link href={`/events/${listing.eventSlug}`} aria-label={`${listing.eventName}: event page`} className="group block overflow-hidden rounded-t-[14px]">
          {/* eslint-disable-next-line @next/next/no-img-element -- served by our own cover route */}
          <img src={coverUrl(listing.eventId, listing.eventCoverVersion)} alt="" className="h-36 w-full object-cover transition-transform duration-1000 ease-[var(--ease-out-expo)] group-hover:scale-[1.04] sm:h-48" />
        </Link>
      ) : null}
      <header style={style} className={`mb-6 flex flex-col overflow-hidden sm:flex-row ${listing.eventCoverVersion ? "rounded-b-[14px]" : "rounded-[14px]"}`}>
        <div className="flex-1 bg-[var(--band)] px-5 py-5 sm:px-7 sm:py-6">
          <div className="flex flex-wrap items-center gap-2">
            {status !== "active" && <StatusPill status={status} />}
            <span className="inline-flex h-6 items-center rounded-full bg-surface/70 px-2.5 text-[12px] font-semibold text-[var(--band-ink)]">{FORMAT_LABEL[listing.format]}</span>
            {listing.eventIsFixture && <FixtureTag />}
          </div>
          <h1 className="mt-3 font-display text-[28px] leading-[1.05] font-extrabold tracking-[-0.02em] text-balance sm:text-[38px]">{listing.eventName}</h1>
          <p className="mt-2 text-[15px] text-[var(--band-ink)]">
            {listing.ticketTypeName} · {listing.quantity} {listing.quantity === 1 ? "ticket" : "tickets"}
          </p>
          <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-[var(--band-ink)]">
            <li className="flex items-center gap-1.5"><CalendarDays className="size-4" aria-hidden />{formatDateTime(listing.eventStartsAt)}</li>
            {listing.eventVenue && <li className="flex items-center gap-1.5"><MapPin className="size-4" aria-hidden />{listing.eventVenue}</li>}
          </ul>
        </div>
        <div className="flex items-center justify-between gap-6 border-t-2 border-dashed border-[color-mix(in_oklab,var(--band-ink)_30%,transparent)] bg-[var(--band-strong)] px-5 py-4 sm:w-64 sm:flex-col sm:items-end sm:justify-center sm:border-t-0 sm:border-l-2 sm:px-7 sm:py-6">
          <div className="sm:text-right">
            <p className={`num font-display text-4xl leading-none font-extrabold ${deal.tier ? PRICE_TONE[deal.tier] : ""}`}>{formatPaise(listing.askingPricePaise)}</p>
            <p className="mt-1.5 text-[13px] text-[var(--band-ink)]">
              {listing.quantity > 1 ? "per ticket" : "asking"}
              {listing.priceNegotiable ? " · open to offers" : ""}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1 text-right text-[13px] text-[var(--band-ink)]">
            {listing.bulkMinQuantity && listing.bulkPricePaise !== null && (
              <span className="font-semibold text-price-low">{listing.bulkMinQuantity}+ for {formatPaise(listing.bulkPricePaise)} each</span>
            )}
            {deal.ref && <span>{deal.ref.source === "face" ? `face value ${formatPaise(deal.ref.paise)}` : `going rate ~${formatPaise(deal.ref.paise)}`}</span>}
          </div>
        </div>
      </header>

      {status === "active" && deal.alert && (
        <div className="deal-banner mb-6 flex items-center gap-3 rounded-[12px] bg-buy px-4 py-3 text-white">
          {deal.tier === "steal" ? <Flame className="size-5 flex-none" aria-hidden /> : <Sparkles className="size-5 flex-none" aria-hidden />}
          <p className="text-[15px]">
            <span className="font-bold">{deal.tier === "steal" ? "Steal alert." : "Good deal alert."}</span>{" "}
            {deal.saving}% under {REF_LABEL[deal.ref!.source]}.
          </p>
        </div>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
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
              <li><VerifiedEmail />: the seller signed in with a verified college Google account. That proves the email, not enrolment.</li>
              <li>
                <span className="font-medium">The ticket itself isn&apos;t checked by ResTix.</span>{" "}
                {listing.reviewedAt ? "A moderator approved this listing, which isn't the same as checking the ticket. " : ""}
                {CHECK_TIP[listing.format]}
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
            {listing.sellerVerified && <div className="mt-3"><VerifiedEmail /></div>}

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
                  <p className="flex gap-2 text-[13px] text-muted">
                    <Lock className="mt-0.5 size-4 flex-none" aria-hidden />
                    Your number stays private. A buyer only gets your WhatsApp after you accept their request.
                  </p>
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
                <ContactForm
                  listingId={listing.id}
                  maxQuantity={listing.quantity}
                  sellerName={listing.sellerName}
                  negotiable={listing.priceNegotiable}
                  askingPricePaise={listing.askingPricePaise}
                  bulkMinQuantity={listing.bulkMinQuantity}
                  bulkPricePaise={listing.bulkPricePaise}
                  savedWhatsapp={priv?.whatsappNumber ?? null}
                />
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
