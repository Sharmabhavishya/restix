import Link from "next/link";
import { Check } from "lucide-react";
import { Confetti } from "./confetti";
import { buttonClass } from "./ui/button";
import { formatPaise } from "@/lib/money";

/**
 * What the buyer sees once a request is in: a small celebration (only for a request that's just been
 * sent), what was sent, and where to go next. The reply lands in Inquiries.
 */
export function RequestSent({
  quantity, offerPaise, askingPricePaise, eventSlug, eventName, fresh = false,
}: {
  quantity: number;
  offerPaise: number | null;
  askingPricePaise: number;
  eventSlug: string;
  eventName: string;
  /** True for a request made moments ago: plays the confetti. */
  fresh?: boolean;
}) {
  const each = offerPaise ?? askingPricePaise;
  return (
    <div role="status" className="relative overflow-hidden rounded-[var(--radius-card)] border border-positive-line bg-positive-soft p-4 text-positive-ink">
      {fresh && (
        <span className="absolute top-8 left-10">
          <Confetti />
        </span>
      )}
      <p className="flex items-center gap-2 text-[17px] font-semibold">
        <span className="grid size-6 place-items-center rounded-full bg-positive text-white">
          <Check className="size-4" strokeWidth={3} aria-hidden />
        </span>
        Request sent
      </p>
      <p className="mt-2 text-sm">
        {quantity} {quantity === 1 ? "ticket" : "tickets"} at <span className="num font-semibold">{formatPaise(each)}</span> each
        {offerPaise !== null ? " (your offer)" : ""}. The seller sees your name, never your number, until they say yes.
      </p>
      <p className="mt-1 text-sm">Their reply shows up in Inquiries.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link href="/inquiries?tab=sent" className={buttonClass("dark", "sm")}>Open Inquiries</Link>
        <Link href={`/events/${eventSlug}`} className={buttonClass("secondary", "sm")}>More for {eventName}</Link>
      </div>
    </div>
  );
}
