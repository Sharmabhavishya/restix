// CSV that Excel opens cleanly: UTF-8 with a byte-order mark, CRLF rows, every cell quoted.

/** A cell written exactly as given (already quoted). */
class Raw {
  constructor(readonly cell: string) {}
}

/** A phone number as text. A bare "+91…" turns into a number in Excel ("9.19877E+11"), so it's
 *  written as ="+91…", which shows as typed. Only for validated E.164 numbers. */
export function phoneCell(e164: string | null): Raw | string {
  return e164 && /^\+[1-9]\d{7,14}$/.test(e164) ? new Raw(`"=""${e164}"""`) : "";
}

/** One cell. Text starting like a formula (=, +, -, @, tab, CR) gets a leading ' so a
 *  spreadsheet shows it instead of running it. */
export function csvCell(value: unknown): string {
  if (value instanceof Raw) return value.cell;
  if (value === null || value === undefined) return '""';
  let s = value instanceof Date ? value.toISOString() : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export function toCsv(header: string[], rows: unknown[][]): string {
  return "﻿" + [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
