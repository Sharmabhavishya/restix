import { parseRupees } from "./money";
import { fromLocalInput } from "./format";
import type { TicketFormat } from "./listing-rules";

export type RawParams = Record<string, string | string[] | undefined>;

export interface ParsedFilters {
  q?: string;
  event?: string;
  category?: string;
  format?: TicketFormat;
  minPaise?: number;
  maxPaise?: number;
  from?: Date;
  to?: Date;
  sort: "newest" | "price_asc" | "price_desc" | "soonest";
  page: number;
}

const FORMATS = ["wristband", "digital", "paper", "other"] as const;
const SORTS = ["newest", "price_asc", "price_desc", "soonest"] as const;
const CATEGORIES = ["fest", "concert", "party", "prom", "workshop", "sports", "other"] as const;

function one(v: string | string[] | undefined): string | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  const t = s?.trim();
  return t ? t : undefined;
}

/** Turns untrusted query parameters into a safe filter set; anything invalid is dropped. */
export function parseFilters(sp: RawParams): ParsedFilters {
  const q = one(sp.q)?.slice(0, 80);
  const event = one(sp.event);
  const category = one(sp.category);
  const format = one(sp.format);
  const sort = one(sp.sort);
  const min = one(sp.min);
  const max = one(sp.max);
  const from = one(sp.from);
  const to = one(sp.to);
  const page = Number(one(sp.page) ?? "1");
  const minPaise = min ? parseRupees(min) ?? undefined : undefined;
  const maxPaise = max ? parseRupees(max) ?? undefined : undefined;
  const fromDate = from ? fromLocalInput(`${from}T00:00`) ?? undefined : undefined;
  const toDate = to ? fromLocalInput(`${to}T00:00`) : null;
  return {
    q,
    event: event && /^[a-z0-9-]{2,80}$/.test(event) ? event : undefined,
    category: category && (CATEGORIES as readonly string[]).includes(category) ? category : undefined,
    format: format && (FORMATS as readonly string[]).includes(format) ? (format as TicketFormat) : undefined,
    minPaise,
    maxPaise: maxPaise !== undefined && minPaise !== undefined && maxPaise < minPaise ? undefined : maxPaise,
    from: fromDate,
    // "to" is inclusive of that whole day.
    to: toDate ? new Date(toDate.getTime() + 86_400_000) : undefined,
    sort: sort && (SORTS as readonly string[]).includes(sort) ? (sort as ParsedFilters["sort"]) : "newest",
    page: Number.isInteger(page) && page >= 1 && page <= 500 ? page : 1,
  };
}

/** How many filters (besides sort and page) are in use. */
export function activeFilterCount(f: ParsedFilters): number {
  return [f.q, f.event, f.category, f.format, f.minPaise, f.maxPaise, f.from, f.to].filter((v) => v !== undefined).length;
}

/** Builds a query string from the current params with some keys replaced or removed. */
export function withParams(sp: RawParams, changes: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    const val = one(v);
    if (val !== undefined && !(k in changes)) params.set(k, val);
  }
  for (const [k, v] of Object.entries(changes)) if (v !== undefined && v !== "") params.set(k, v);
  const s = params.toString();
  return s ? `?${s}` : "";
}
