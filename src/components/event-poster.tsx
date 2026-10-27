import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { formatPaise } from "@/lib/money";
import { formatTime, TIME_ZONE } from "@/lib/format";
import { eventHue } from "@/lib/tint";
import { EVENT_CATEGORIES } from "@/server/event-admin";
import { coverUrl } from "@/server/event-covers";

const day = new Intl.DateTimeFormat("en-IN", { timeZone: TIME_ZONE, day: "numeric" });
const month = new Intl.DateTimeFormat("en-IN", { timeZone: TIME_ZONE, month: "short" });
const weekday = new Intl.DateTimeFormat("en-IN", { timeZone: TIME_ZONE, weekday: "short" });

export interface PosterEvent {
  id: string;
  name: string;
  category: string;
  venue: string | null;
  startsAt: Date;
  status: string;
  isFixture: boolean;
  availableTickets: number;
  lowestPricePaise: number | null;
  coverVersion: number | null;
  coverBlur: string | null;
  wantCount?: number;
}

/**
 * An event as a poster: its cover photo when a moderator uploaded one, otherwise a loud
 * gradient in the event's own colour with the kind of event set huge across it. The date sits
 * on a ticket stub; the live count and the lowest price sit at the bottom.
 */
export function EventPoster({
  event: e,
  href,
  size = "card",
  children,
}: {
  event: PosterEvent;
  href?: string;
  size?: "card" | "hero";
  /** Extra content under the title (hero only), e.g. actions. */
  children?: ReactNode;
}) {
  const h = eventHue(e.id);
  const kind = EVENT_CATEGORIES[e.category as keyof typeof EVENT_CATEGORIES] ?? "Event";
  const hero = size === "hero";
  const art: CSSProperties = e.coverVersion
    ? { backgroundImage: e.coverBlur ? `url(${e.coverBlur})` : undefined, backgroundSize: "cover", backgroundPosition: "center" }
    : {
        background: `radial-gradient(120% 90% at 0% 0%, oklch(0.78 0.17 ${h}) 0%, transparent 55%),
          radial-gradient(90% 90% at 100% 100%, oklch(0.62 0.22 ${(h + 70) % 360}) 0%, transparent 60%),
          linear-gradient(135deg, oklch(0.52 0.2 ${h}), oklch(0.3 0.13 ${(h + 40) % 360}))`,
      };

  const body = (
    <div
      style={art}
      className={`group/poster relative isolate flex flex-col justify-between overflow-hidden text-white ${
        hero ? "min-h-[26rem] rounded-[28px] p-6 sm:min-h-[30rem] sm:p-9 lg:aspect-[21/9] lg:min-h-0" : "aspect-[16/11] rounded-[24px] p-5"
      }`}
    >
      {e.coverVersion ? (
        // eslint-disable-next-line @next/next/no-img-element -- served by our own route with its own caching
        <img
          src={coverUrl(e.id, e.coverVersion)}
          alt=""
          loading={hero ? "eager" : "lazy"}
          decoding="async"
          className="absolute inset-0 -z-20 size-full object-cover transition-transform duration-1000 ease-[var(--ease-out-expo)] motion-safe:group-hover/poster:scale-[1.06]"
        />
      ) : (
        <span
          aria-hidden
          className={`pointer-events-none absolute -z-20 font-display leading-[0.8] font-extrabold tracking-[-0.05em] whitespace-nowrap text-white/15 uppercase transition-transform duration-1000 ease-[var(--ease-out-expo)] motion-safe:group-hover/poster:-translate-x-4 ${
            hero ? "top-[6%] right-[-4%] text-[clamp(6rem,18vw,15rem)]" : "top-[16%] right-[-6%] text-[clamp(4.5rem,11vw,7.5rem)]"
          } -rotate-6`}
        >
          {kind}
        </span>
      )}
      {/* Legibility: dark at the bottom where the words are, a touch at the top for the stub. */}
      <span aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(to_top,rgb(0_0_0/0.78),rgb(0_0_0/0.2)_55%,rgb(0_0_0/0.05)_75%,rgb(0_0_0/0.25))]" />

      <div className="flex items-start justify-between gap-3">
        <span className="poster-stub relative flex items-stretch overflow-hidden rounded-[14px] bg-white text-[#111827] shadow-[0_10px_30px_-12px_rgb(0_0_0/0.6)]">
          <span className="flex flex-col items-center justify-center px-3 py-2 leading-none">
            <span className="num font-display text-[1.75rem] font-extrabold tracking-[-0.03em]">{day.format(e.startsAt)}</span>
            <span className="mt-0.5 text-[11px] font-semibold tracking-[0.08em] uppercase">{month.format(e.startsAt)}</span>
          </span>
          <span className="flex items-center border-l-2 border-dashed border-[#d1d5db] px-2.5 text-[12px] font-semibold text-[#5f6672] [writing-mode:vertical-rl] rotate-180">
            {weekday.format(e.startsAt)}
          </span>
        </span>
        <span className="flex flex-wrap justify-end gap-1.5">
          {e.status === "cancelled" && <Tag tone="bg-[#c4242a]">Cancelled</Tag>}
          {e.status === "postponed" && <Tag tone="bg-[#b45309]">Postponed</Tag>}
          {e.isFixture && <Tag tone="bg-black/45 backdrop-blur-sm">Sample</Tag>}
        </span>
      </div>

      <div>
        <p className="text-[13px] font-medium text-white/85">
          {kind} · {formatTime(e.startsAt)}{e.venue ? ` · ${e.venue}` : ""}
        </p>
        {hero ? (
          <h1 className="mt-2 max-w-[18ch] font-display text-[clamp(2.4rem,6vw,4.75rem)] leading-[0.92] font-extrabold tracking-[-0.04em] text-balance [overflow-wrap:anywhere]">{e.name}</h1>
        ) : (
          <h2 className="mt-1.5 line-clamp-2 font-display text-[1.6rem] leading-[1] font-extrabold tracking-[-0.03em] [overflow-wrap:anywhere]">{e.name}</h2>
        )}
        <div className={`flex flex-wrap items-center gap-2 ${hero ? "mt-5" : "mt-3"}`}>
          {e.availableTickets > 0 ? (
            <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-buy px-3.5 text-[13px] font-semibold text-white shadow-[0_6px_16px_-8px_rgb(0_0_0/0.6)]">
              {e.availableTickets} {e.availableTickets === 1 ? "ticket" : "tickets"} · from {formatPaise(e.lowestPricePaise!)}
            </span>
          ) : (
            <span className="inline-flex h-8 items-center rounded-full bg-white/20 px-3.5 text-[13px] font-medium backdrop-blur-sm">No tickets listed yet</span>
          )}
          {!hero && (e.wantCount ?? 0) > 0 && (
            <span className="inline-flex h-8 items-center rounded-full bg-sticker px-3 text-[13px] font-semibold text-sticker-ink">
              {e.wantCount} looking
            </span>
          )}
          {children}
        </div>
      </div>
    </div>
  );

  return href ? (
    <Link href={href} className="block rounded-[24px] transition-transform duration-300 ease-[var(--ease-out-expo)] focus-visible:outline-offset-4 motion-safe:hover:-translate-y-1 motion-safe:hover:-rotate-[0.6deg]">
      {body}
    </Link>
  ) : (
    body
  );
}

function Tag({ tone, children }: { tone: string; children: ReactNode }) {
  return <span className={`inline-flex h-6 items-center rounded-full px-2.5 text-[12px] font-semibold text-white ${tone}`}>{children}</span>;
}
