import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { ArrowLeftRight, Flame, Sparkles } from "lucide-react";
import { FORMAT_LABEL, type ListingStatus, type TicketFormat } from "@/lib/listing-rules";
import { dealFor, REF_LABEL, type PriceTier } from "@/lib/deal";
import { formatDate } from "@/lib/format";
import { formatPaise } from "@/lib/money";
import { bandStyle } from "@/lib/tint";
import { FixtureTag, StatusPill } from "./listing-bits";

export interface TicketData {
  id: string;
  eventId: string;
  eventName: string;
  eventStartsAt: Date;
  eventIsFixture?: boolean;
  ticketTypeName: string;
  format: TicketFormat;
  quantity: number;
  askingPricePaise: number;
  faceValuePaise?: number | null;
  priceNegotiable?: boolean;
  bulkMinQuantity?: number | null;
  bulkPricePaise?: number | null;
  meetupArea?: string | null;
  marketMedianPaise?: number | null;
  marketCount?: number | null;
  /** The price before a recent cut (the query only returns it for a week). */
  previousPricePaise?: number | null;
}

export const PRICE_TONE: Record<PriceTier, string> = {
  steal: "text-price-low",
  good: "text-price-low",
  fair: "text-ink",
  high: "text-price-high",
  steep: "text-price-steep",
};

/**
 * A listing drawn as the thing people actually trade: a wristband looks like a wristband, a QR
 * e-ticket like a wallet pass, an email ticket like an envelope with a stamp. Every shape carries
 * the event's tint and the same facts; the price is coloured by how good it is, and a real deal
 * gets a sticker. The shapes live in globals.css under "Ticket shapes".
 */
export function TicketCard({
  listing,
  status,
  href,
  aside,
  showEvent = true,
  pricePending = false,
}: {
  listing: TicketData;
  /** Shown instead of the price when the listing is not simply available. */
  status?: ListingStatus;
  href?: string;
  aside?: ReactNode;
  showEvent?: boolean;
  /** Preview with no price typed yet: shows a dash. */
  pricePending?: boolean;
}) {
  const live = !status || status === "active";
  const deal = live && !pricePending ? dealFor({ ...listing, faceValuePaise: listing.faceValuePaise ?? null }) : null;
  // The shape already says what kind of ticket it is; the words stay for screen readers.
  const meta = [
    showEvent ? listing.ticketTypeName : null,
    `${listing.quantity} ${listing.quantity === 1 ? "ticket" : "tickets"}`,
    showEvent ? formatDate(listing.eventStartsAt) : listing.meetupArea,
  ].filter(Boolean);
  const title = showEvent ? listing.eventName : listing.ticketTypeName;
  const bulk = listing.bulkMinQuantity && listing.bulkPricePaise !== null && listing.bulkPricePaise !== undefined
    ? `${listing.bulkMinQuantity}+ for ${formatPaise(listing.bulkPricePaise)} each`
    : null;
  const f = listing.format;
  const dropped = live && !pricePending && listing.previousPricePaise != null && listing.previousPricePaise > listing.askingPricePaise;

  const price = live ? (
    <div className="tk-price flex flex-col items-end gap-0.5">
      <span className={`num text-lg leading-none font-semibold ${deal?.tier ? PRICE_TONE[deal.tier] : "text-ink"}`}>
        {pricePending ? "₹ —" : formatPaise(listing.askingPricePaise)}
      </span>
      <span className="text-[12px] text-[var(--band-ink)]">{listing.quantity > 1 ? "each" : "asking"}</span>
    </div>
  ) : (
    <StatusPill status={status!} />
  );

  const card = (
    <>
      <div className={`tk tk-${f}`}>
        {f === "wristband" && <span aria-hidden className="tk-clasp" />}
        {f === "pass" && <span aria-hidden className="tk-lead tk-slot"><i /></span>}
        {f === "token" && (
          <span aria-hidden className="tk-lead">
            <span className="tk-coin"><b className="num">×{listing.quantity}</b></span>
          </span>
        )}
        {f === "app" && (
          <span aria-hidden className="tk-lead">
            <span className="tk-appicon"><ArrowLeftRight className="size-5" strokeWidth={2.25} /></span>
          </span>
        )}
        <div className="tk-body">
          <p className="line-clamp-2 text-[15px] leading-snug font-semibold [overflow-wrap:anywhere] text-ink">{title}</p>
          <p className="truncate text-[13px] text-[var(--band-ink)]">
            <span className="sr-only">{FORMAT_LABEL[listing.format]} · </span>
            {meta.join(" · ")}
          </p>
          {(bulk || listing.priceNegotiable || listing.eventIsFixture || dropped) && (
            <p className="flex min-w-0 flex-wrap gap-1.5 pt-0.5">
              {listing.eventIsFixture && <FixtureTag />}
              {dropped && <span className="tk-chip text-price-low">↓ was {formatPaise(listing.previousPricePaise!)}</span>}
              {bulk && <span className="tk-chip text-price-low">{bulk}</span>}
              {listing.priceNegotiable && <span className="tk-chip">open to offers</span>}
            </p>
          )}
        </div>
        <div className="tk-stub">
          {f === "paper" && <span aria-hidden className="tk-admit">admit {listing.quantity}</span>}
          {f === "qr" && <QrMark seed={listing.id} />}
          {f === "email" ? <span className="tk-stamp"><span>{price}</span></span> : price}
        </div>
      </div>
      {deal?.alert && (
        <span className="deal-sticker" title={deal.saving ? `${deal.saving}% under ${REF_LABEL[deal.ref!.source]}` : undefined}>
          {deal.tier === "steal" ? <Flame className="size-3" aria-hidden /> : <Sparkles className="size-3" aria-hidden />}
          {deal.tier === "steal" ? "steal" : "good deal"}
          {deal.saving ? <span className="font-medium">· {deal.saving}% off</span> : null}
        </span>
      )}
    </>
  );

  const style = bandStyle(listing.eventId) as CSSProperties;
  return (
    <div className="flex items-center gap-3">
      {href ? (
        <Link href={href} style={style} className="tk-link group relative block min-w-0 flex-1 rounded-[12px] focus-visible:outline-offset-4">
          {card}
        </Link>
      ) : (
        <div style={style} className="tk-link group relative min-w-0 flex-1">
          {card}
        </div>
      )}
      {aside}
    </div>
  );
}

/** A tiny QR-looking mark, the same for the same listing. Decoration, not a scannable code. */
function QrMark({ seed }: { seed: string }) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  const cells: [number, number][] = [];
  for (let y = 0; y < 7; y++) {
    for (let x = 0; x < 7; x++) {
      const finder = (x < 2 && y < 2) || (x > 4 && y < 2) || (x < 2 && y > 4);
      h = Math.imul(h ^ (x * 7 + y), 16777619);
      if (!finder && (h >>> 0) % 2 === 0) cells.push([x, y]);
    }
  }
  return (
    <svg aria-hidden viewBox="0 0 21 21" className="tk-qrmark size-8 flex-none sm:size-9">
      {[[0, 0], [15, 0], [0, 15]].map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <rect x={x + 0.5} y={y + 0.5} width="5" height="5" rx="1.2" fill="none" stroke="currentColor" strokeWidth="1" />
          <rect x={x + 2} y={y + 2} width="2" height="2" rx="0.4" fill="currentColor" />
        </g>
      ))}
      {cells.map(([x, y]) => <rect key={`${x}.${y}`} x={x * 3} y={y * 3} width="2.6" height="2.6" rx="0.6" fill="currentColor" />)}
    </svg>
  );
}
