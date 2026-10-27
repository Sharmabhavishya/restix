import Link from "next/link";
import type { CSSProperties } from "react";
import type { EventSummary } from "@/server/events";
import { countdown } from "@/lib/format";
import { bandStyle } from "@/lib/tint";

/** The sidebar's countdown to the next event, drawn as a small band in that event's tint. */
export function NextUp({ event }: { event: EventSummary }) {
  const tickets = event.availableTickets;
  return (
    <Link
      href={`/events/${event.slug}`}
      style={bandStyle(event.id) as CSSProperties}
      className="group flex gap-[3px] rounded-[var(--radius-card)] transition-transform duration-200 ease-[var(--ease-out-expo)] motion-safe:hover:-translate-y-0.5"
    >
      <div className="min-w-0 flex-1 rounded-l-[var(--radius-card)] bg-[var(--band)] px-3 py-2.5">
        <p className="text-[12px] text-[var(--band-ink)]">
          next up · <span className="font-semibold">{countdown(event.startsAt)}</span>
        </p>
        <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-sm font-semibold text-ink">
          <span className="truncate">{event.name}</span>
          {event.isFixture && <span className="flex-none rounded-full bg-notice-soft px-1.5 text-[11px] font-medium text-notice-ink">sample</span>}
        </p>
        <p className="num text-[12px] text-[var(--band-ink)]">{tickets > 0 ? `${tickets} ${tickets === 1 ? "ticket" : "tickets"} up` : "none up yet"}</p>
      </div>
      <div className="relative w-7 flex-none rounded-r-full bg-[var(--band-strong)] transition-transform duration-200 ease-[var(--ease-out-expo)] motion-safe:group-hover:translate-x-0.5">
        <span aria-hidden className="absolute top-1/2 right-2 size-2 -translate-y-1/2 rounded-full border-2 border-[var(--band-ink)] opacity-50" />
      </div>
    </Link>
  );
}
