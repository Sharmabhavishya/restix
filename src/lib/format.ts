// Display formatting. Times are always shown in campus time, whatever the server's zone.
export const TIME_ZONE = "Asia/Kolkata";

const dateTime = new Intl.DateTimeFormat("en-IN", {
  timeZone: TIME_ZONE, weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
});
const dateOnly = new Intl.DateTimeFormat("en-IN", { timeZone: TIME_ZONE, weekday: "short", day: "numeric", month: "short" });
const dayMonth = new Intl.DateTimeFormat("en-IN", { timeZone: TIME_ZONE, day: "numeric", month: "short" });
const longDate = new Intl.DateTimeFormat("en-IN", { timeZone: TIME_ZONE, day: "numeric", month: "long", year: "numeric" });
const timeOnly = new Intl.DateTimeFormat("en-IN", { timeZone: TIME_ZONE, hour: "numeric", minute: "2-digit" });

export function formatDateTime(d: Date): string {
  return dateTime.format(d).replace(/\s?(am|pm)$/i, (m) => m.toLowerCase());
}
export function formatDate(d: Date): string {
  return dateOnly.format(d);
}
export function formatDayMonth(d: Date): string {
  return dayMonth.format(d);
}
export function formatLongDate(d: Date): string {
  return longDate.format(d);
}
export function formatTime(d: Date): string {
  return timeOnly.format(d).toLowerCase();
}

/** "in 3 days", "2 hours ago", "just now". */
export function relativeTime(d: Date, now = new Date()): string {
  const diff = d.getTime() - now.getTime();
  const abs = Math.abs(diff);
  const units: [number, Intl.RelativeTimeFormatUnit][] = [
    [86_400_000 * 30, "month"], [86_400_000 * 7, "week"], [86_400_000, "day"], [3_600_000, "hour"], [60_000, "minute"],
  ];
  if (abs < 60_000) return "just now";
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  for (const [ms, unit] of units) {
    if (abs >= ms) return rtf.format(Math.round(diff / ms), unit);
  }
  return "just now";
}

const hour24 = new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, hour: "2-digit", hour12: false });
const isoDay = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });

/** Whole campus-calendar days from `now` to `d` (0 = same IST date). */
export function daysUntil(d: Date, now = new Date()): number {
  const day = (x: Date) => Date.parse(`${isoDay.format(x)}T00:00:00Z`);
  return Math.round((day(d) - day(now)) / 86_400_000);
}

/** How soon an event is, said casually: "tonight", "tomorrow", "in 5 days", "in 3 weeks". */
export function countdown(d: Date, now = new Date()): string {
  if (d.getTime() <= now.getTime()) return "happening now";
  const days = daysUntil(d, now);
  if (days === 0) return Number(hour24.format(d)) >= 17 ? "tonight" : "today";
  if (days === 1) return "tomorrow";
  if (days < 14) return `in ${days} days`;
  return `in ${Math.round(days / 7)} weeks`;
}

/** Value for <input type="datetime-local"> in campus time. */
export function toLocalInput(d: Date | null | undefined): string {
  if (!d) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour") === "24" ? "00" : get("hour")}:${get("minute")}`;
}

/** Parses a datetime-local value as campus time (IST has no DST, so a fixed offset is exact). */
export function fromLocalInput(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const d = new Date(`${value}:00+05:30`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** First word of a display name, for greetings. */
export function firstName(displayName: string): string {
  return displayName.trim().split(/\s+/)[0] || "there";
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString("en-IN")} ${n === 1 ? one : many}`;
}
