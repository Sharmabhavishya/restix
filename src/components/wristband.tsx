import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { FORMAT_LABEL, type ListingStatus, type TicketFormat } from "@/lib/listing-rules";
import { formatDate } from "@/lib/format";
import { formatPaise } from "@/lib/money";
import { bandStyle } from "@/lib/tint";
import { FixtureTag, StatusPill } from "./listing-bits";

export interface WristbandData {
  id: string;
  eventId: string;
  eventName: string;
  eventStartsAt: Date;
  eventIsFixture?: boolean;
  ticketTypeName: string;
  format: TicketFormat;
  quantity: number;
  askingPricePaise: number;
  originalPricePaise?: number | null;
  priceNegotiable?: boolean;
  meetupArea?: string | null;
}

/**
 * ResTix's signature element: a listing drawn as the thing students actually trade. The band
 * carries the event's own tint and the ticket's facts; the snap-tab end carries the price.
 */
export function Wristband({
  listing,
  status,
  href,
  aside,
  showEvent = true,
}: {
  listing: WristbandData;
  /** Shown on the tab when the listing is not simply available. */
  status?: ListingStatus;
  href?: string;
  aside?: ReactNode;
  showEvent?: boolean;
}) {
  const style = bandStyle(listing.eventId) as CSSProperties;
  const meta = [
    showEvent ? listing.ticketTypeName : null,
    FORMAT_LABEL[listing.format],
    `${listing.quantity} ${listing.quantity === 1 ? "ticket" : "tickets"}`,
    showEvent ? formatDate(listing.eventStartsAt) : listing.meetupArea,
  ].filter(Boolean);
  const title = showEvent ? listing.eventName : listing.ticketTypeName;

  const body = (
    <>
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 rounded-l-[var(--radius-card)] bg-[var(--band)] px-4 py-3">
        <p className="flex min-w-0 items-center gap-2 text-[15px] font-semibold leading-snug text-ink">
          <span className="truncate">{title}</span>
          {listing.eventIsFixture && <FixtureTag />}
        </p>
        <p className="truncate text-[13px] text-[var(--band-ink)]">{meta.join(" · ")}</p>
      </div>
      <div className="relative flex w-[7.5rem] flex-none flex-col items-end justify-center gap-0.5 rounded-r-full bg-[var(--band-strong)] py-3 pr-8 pl-4 transition-transform duration-200 ease-[var(--ease-out-expo)] group-hover:translate-x-1 sm:w-36">
        {/* the snap */}
        <span aria-hidden className="absolute top-1/2 right-3 size-2.5 -translate-y-1/2 rounded-full border-2 border-[var(--band-ink)] opacity-50" />
        {status && status !== "active" ? (
          <StatusPill status={status} />
        ) : (
          <>
            <span className="num text-lg leading-none font-semibold text-ink">{formatPaise(listing.askingPricePaise)}</span>
            <span className="text-[12px] text-[var(--band-ink)]">
              {listing.quantity > 1 ? "each" : listing.priceNegotiable ? "negotiable" : "asking"}
            </span>
          </>
        )}
      </div>
    </>
  );

  return (
    <div className="flex items-center gap-3">
      {href ? (
        <Link
          href={href}
          style={style}
          className="group flex min-w-0 flex-1 gap-[3px] rounded-[var(--radius-card)] focus-visible:outline-offset-4"
          aria-label={`${title}, ${meta.join(", ")}, ${formatPaise(listing.askingPricePaise)}${listing.quantity > 1 ? " each" : ""}`}
        >
          {body}
        </Link>
      ) : (
        <div style={style} className="group flex min-w-0 flex-1 gap-[3px]">
          {body}
        </div>
      )}
      {aside}
    </div>
  );
}
