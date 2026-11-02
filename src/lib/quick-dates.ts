// Quick-pick helpers for event dates and times. Everything is campus time (IST) and works on plain
// "YYYY-MM-DD" and "HH:mm" strings, so no time zone maths can slip in. A full value is the same
// "YYYY-MM-DDTHH:mm" text a datetime-local input uses, which the server already reads (fromLocalInput).

export interface QuickDay {
  key: "tonight" | "tomorrow" | "sat" | "sun";
  label: string;
  ymd: string;
}

export const QUICK_TIMES: { label: string; time: string }[] = [
  { label: "12 pm", time: "12:00" },
  { label: "4 pm", time: "16:00" },
  { label: "6 pm", time: "18:00" },
  { label: "7 pm", time: "19:00" },
  { label: "8 pm", time: "20:00" },
  { label: "9 pm", time: "21:00" },
];

export const DEFAULT_TIME = "19:00";

/** The day after (or before, with a negative n) a "YYYY-MM-DD". */
export function addDays(ymd: string, n: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** 0 = Sunday ... 6 = Saturday, for a "YYYY-MM-DD". */
export function weekdayOf(ymd: string): number {
  return new Date(`${ymd}T00:00:00Z`).getUTCDay();
}

/** The next given weekday strictly after `ymd` (so "Sat" on a Saturday means next Saturday). */
function nextWeekday(ymd: string, weekday: number): string {
  const ahead = ((weekday - weekdayOf(ymd) + 7) % 7) || 7;
  return addDays(ymd, ahead);
}

/** Day chips for a given "today": Tonight, Tomorrow, and the next Saturday and Sunday (no duplicates). */
export function quickDays(today: string): QuickDay[] {
  const days: QuickDay[] = [
    { key: "tonight", label: "Tonight", ymd: today },
    { key: "tomorrow", label: "Tomorrow", ymd: addDays(today, 1) },
    { key: "sat", label: "This Sat", ymd: nextWeekday(today, 6) },
    { key: "sun", label: "This Sun", ymd: nextWeekday(today, 0) },
  ];
  const seen = new Set<string>();
  return days.filter((d) => !seen.has(d.ymd) && seen.add(d.ymd));
}

/** Splits "2026-11-06T19:00" into its date and time parts; empty strings when it isn't one. */
export function splitLocal(value: string): { ymd: string; time: string } {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/.exec(value);
  return m ? { ymd: m[1], time: m[2] } : { ymd: "", time: "" };
}

/** Joins a day and a time back into the datetime-local text; empty until there's a day. */
export function joinLocal(ymd: string, time: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return "";
  return `${ymd}T${/^\d{2}:\d{2}$/.test(time) ? time : DEFAULT_TIME}`;
}

/** A start plus some hours, as a datetime-local text ("" when the start isn't valid). */
export function plusHours(value: string, hours: number): string {
  const { ymd, time } = splitLocal(value);
  if (!ymd) return "";
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + Math.round(hours * 60);
  return joinLocal(addDays(ymd, Math.floor(total / 1440)), `${String(Math.floor((total % 1440) / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`);
}

/** "Till late": 1 am the morning after the start day. */
export function tillLate(value: string): string {
  const { ymd } = splitLocal(value);
  return ymd ? joinLocal(addDays(ymd, 1), "01:00") : "";
}
