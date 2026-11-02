import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { publicEventBySlug } from "@/server/events";
import { formatPaise } from "@/lib/money";
import { eventHue } from "@/lib/tint";
import { TIME_ZONE } from "@/lib/format";

// The preview card when an event link is shared: name, when and where, and what's up for grabs.
export const alt = "An event on ResTix";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const TICKET = "M4 0H24A4 4 0 0 1 28 4V5.8A3.2 3.2 0 0 0 28 12.2V14A4 4 0 0 1 24 18H4A4 4 0 0 1 0 14V12.2A3.2 3.2 0 0 0 0 5.8V4A4 4 0 0 1 4 0Z";

// The card's font is a small subset (letters, digits, a few marks), so anything else is dropped.
const plain = (s: string) => s.replace(/&/g, " and ").replace(/[^A-Za-z0-9,.?₹ ]+/g, " ").replace(/\s+/g, " ").trim();

const when = new Intl.DateTimeFormat("en-IN", { timeZone: TIME_ZONE, weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true });
function whenText(d: Date) {
  const p = Object.fromEntries(when.formatToParts(d).map((x) => [x.type, x.value]));
  const time = `${p.hour}${p.minute === "00" ? "" : `.${p.minute}`} ${String(p.dayPeriod).toLowerCase()}`;
  return `${p.weekday} ${p.day} ${p.month}, ${time}`;
}

export default async function EventShareImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = await publicEventBySlug(slug).catch(() => null);
  const display = await readFile(join(process.cwd(), "src/assets/fonts/bricolage-800-og.ttf"));
  const h = event ? eventHue(event.id) : 330;
  const name = (event && plain(event.name)) || "An event on ResTix";
  const meta = event ? [whenText(event.startsAt), event.venue ? plain(event.venue) : ""].filter(Boolean).join(", ") : "Student to student tickets";
  const stock = event && event.availableTickets > 0
    ? `${event.availableTickets} ${event.availableTickets === 1 ? "ticket" : "tickets"} up, from ${formatPaise(event.lowestPricePaise ?? 0)}`
    : "Be first when a ticket comes up";
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "56px 0 64px 72px", fontFamily: "Bricolage", color: "#ffffff", background: `linear-gradient(135deg, hsl(${h}, 70%, 46%), hsl(${(h + 40) % 360}, 65%, 22%))` }}>
        <div style={{ display: "flex", alignItems: "flex-end", fontSize: 52, letterSpacing: -1, lineHeight: 1 }}>
          <span>rest</span>
          <span style={{ display: "flex", position: "relative" }}>
            ı
            <svg width="17" height="11" viewBox="0 0 28 18" style={{ position: "absolute", top: -2, left: 1, transform: "rotate(-14deg)" }}>
              <path d={TICKET} fill="#ffffff" />
            </svg>
          </span>
          <span>x</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", paddingRight: 72 }}>
          <div style={{ display: "flex", fontSize: name.length > 34 ? 72 : name.length > 20 ? 92 : 116, letterSpacing: -3, lineHeight: 0.95 }}>{name.slice(0, 60)}</div>
          <div style={{ display: "flex", marginTop: 24, fontSize: 38, opacity: 0.88 }}>{meta}</div>
        </div>
        <div style={{ display: "flex" }}>
          <div style={{ display: "flex", alignItems: "center", flex: 1, height: 104, background: "#ffffff", color: "#111827", borderRadius: "52px 0 0 52px", paddingLeft: 44, fontSize: 36, letterSpacing: -0.5 }}>
            {stock}
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: [{ name: "Bricolage", data: display, weight: 800, style: "normal" }] },
  );
}
