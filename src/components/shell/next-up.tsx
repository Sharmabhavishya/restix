import Link from "next/link";
import type { CSSProperties } from "react";
import type { EventSummary } from "@/server/events";
import { countdown, TIME_ZONE } from "@/lib/format";
import { bandStyle } from "@/lib/tint";

const day = new Intl.DateTimeFormat("en-IN", { timeZone: TIME_ZONE, day: "numeric" });
const month = new Intl.DateTimeFormat("en-IN", { timeZone: TIME_ZONE, month: "short" });

/** The sidebar's countdown to the next event: a small ticket in that event's tint, date on the stub. */
export function NextUp({ event }: { event: EventSummary }) {
  const tickets = event.availableTickets;
  return (
    <Link
      href={`/events/${event.slug}`}
      style={bandStyle(event.id) as CSSProperties}
      className="group flex overflow-hidden rounded-[10px] transition-transform duration-200 ease-[var(--ease-out-expo)] motion-safe:hover:-translate-y-0.5 motion-safe:hover:-rotate-1"
    >
      <div className="min-w-0 flex-1 bg-[var(--band)] px-3 py-2.5">
        <p className="text-[12px] text-[var(--band-ink)]">
          next up · <span className="font-semibold">{countdown(event.startsAt)}</span>
        </p>
        <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-sm font-semibold text-ink">
          <span className="truncate">{event.name}</span>
          {event.isFixture && <span className="flex-none rounded-full bg-notice-soft px-1.5 text-[11px] font-medium text-notice-ink">sample</span>}
        </p>
        <p className="num text-[12px] text-[var(--band-ink)]">{tickets > 0 ? `${tickets} ${tickets === 1 ? "ticket" : "tickets"} up` : "none up yet"}</p>
      </div>
      <div className="flex w-12 flex-none flex-col items-center justify-center border-l-2 border-dashed border-[color-mix(in_oklab,var(--band-ink)_30%,transparent)] bg-[var(--band-strong)] leading-none">
        <span className="num font-display text-lg font-extrabold">{day.format(event.startsAt)}</span>
        <span className="text-[11px] text-[var(--band-ink)]">{month.format(event.startsAt)}</span>
      </div>
    </Link>
  );
}
