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

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString("en-IN")} ${n === 1 ? one : many}`;
}
