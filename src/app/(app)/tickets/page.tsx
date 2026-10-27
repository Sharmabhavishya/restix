import type { Metadata } from "next";
import Link from "next/link";
import { Flame, Heart, Search, SlidersHorizontal } from "lucide-react";
import { requireBrowser } from "@/server/auth/viewer";
import { formatCounts, PAGE_SIZE, SORTS, searchListings, displayStatus } from "@/server/listings";
import { listUpcomingEvents } from "@/server/events";
import { activeFilterCount, parseFilters, withParams, type RawParams } from "@/lib/search-params";
import { FORMAT_LABEL, FORMATS } from "@/lib/listing-rules";
import { paiseToInput } from "@/lib/money";
import { firstName, toLocalInput } from "@/lib/format";
import { EVENT_CATEGORIES } from "@/server/event-admin";
import { TicketCard } from "@/components/ticket-card";
import { EmptyState, PageTitle } from "@/components/ui/bits";
import { ButtonLink, buttonClass } from "@/components/ui/button";
import { Checkbox, Field, Input, Select } from "@/components/ui/field";
import { TrackView } from "@/components/track";
import { SaveButton } from "@/components/save-button";

export const metadata: Metadata = { title: "Find tickets" };

/**
 * Browsing, kept calm: one search box, a single row of quick filters, everything else folded
 * into "More filters", and the tickets in one roomy column.
 */
export default async function TicketsPage({ searchParams }: PageProps<"/tickets">) {
  const sp = (await searchParams) as RawParams;
  const viewer = await requireBrowser(`/tickets${withParams(sp, {})}`);
  const f = parseFilters(sp);
  const [result, counts, events] = await Promise.all([
    searchListings(viewer.id, f),
    formatCounts(viewer.id, f),
    listUpcomingEvents(viewer.id),
  ]);
  const totalAll = Object.values(counts).reduce((a, b) => a + b, 0);
  const filters = activeFilterCount(f);
  // Filters that live in the folded panel, so it opens when one is in use.
  const deep = [f.event, f.category, f.minPaise, f.maxPaise, f.from, f.to, f.offers].filter((v) => v !== undefined).length + (f.sort !== "newest" ? 1 : 0);
  const firstShown = result.total === 0 ? 0 : (result.page - 1) * PAGE_SIZE + 1;
  const lastShown = Math.min(result.page * PAGE_SIZE, result.total);
  const dateInput = (d?: Date, inclusive = false) => (d ? toLocalInput(inclusive ? new Date(d.getTime() - 86_400_000) : d).slice(0, 10) : "");
  const kinds = FORMATS.filter((x) => counts[x] || f.format === x);

  return (
    <div className="mx-auto w-full max-w-[860px]">
      <PageTitle
        title="Find tickets"
        sub={
          totalAll === 0 && filters === 0
            ? `hey ${firstName(viewer.displayName)}, nothing's listed rn. check back closer to the next one.`
            : `hey ${firstName(viewer.displayName)}, ${totalAll.toLocaleString("en-IN")} ${totalAll === 1 ? "listing is" : "listings are"} live rn.`
        }
        actions={<ButtonLink href="/sell">Sell a ticket</ButtonLink>}
      />
      {filters > 0 && (
        <TrackView name="search_performed" dedupeKey={`search:${withParams(sp, { page: undefined })}`} props={{ filters, results: result.total }} />
      )}

      {/* Search first: it's what most people reach for. */}
      <form method="get" action="/tickets" role="search" className="relative mb-4">
        {Object.entries({ format: f.format, deals: f.deals && "1", saved: f.saved && "1", event: f.event, category: f.category, sort: f.sort !== "newest" ? f.sort : undefined }).map(([k, v]) =>
          v ? <input key={k} type="hidden" name={k} value={v} /> : null,
        )}
        <label htmlFor="q" className="sr-only">Search tickets</label>
        <Search aria-hidden className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted" />
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={f.q ?? ""}
          placeholder="Search events, tickets or venues"
          className="h-13 w-full rounded-full border border-border bg-surface pr-5 pl-12 text-[16px] shadow-[0_1px_2px_rgb(0_0_0/0.04)] transition-[border-color,box-shadow] placeholder:text-placeholder hover:border-control-hover focus:border-accent focus:ring-4 focus:ring-accent-track focus:outline-none"
        />
      </form>

      {/* One row of quick filters; it scrolls sideways on phones instead of wrapping. */}
      <nav aria-label="Quick filters" className="-mx-4 flex gap-2 overflow-x-auto px-4 pt-1 pb-3 sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
        <Chip href={`/tickets${withParams(sp, { deals: f.deals ? undefined : "1", page: undefined })}`} on={Boolean(f.deals)} tone="buy">
          <Flame className="size-3.5" aria-hidden /> Good deals
        </Chip>
        <Chip href={`/tickets${withParams(sp, { saved: f.saved ? undefined : "1", page: undefined })}`} on={Boolean(f.saved)}>
          <Heart className="size-3.5" aria-hidden /> Saved
        </Chip>
        {kinds.length > 1 && (
          <>
            <span aria-hidden className="mx-1 my-2 w-px flex-none bg-border" />
            {kinds.map((x) => (
              <Chip key={x} href={`/tickets${withParams(sp, { format: f.format === x ? undefined : x, page: undefined })}`} on={f.format === x}>
                {FORMAT_LABEL[x]}
              </Chip>
            ))}
          </>
        )}
      </nav>

      <details className="group mb-8 rounded-[16px] border border-border bg-surface open:shadow-[0_8px_30px_-18px_rgb(0_0_0/0.25)]" open={deep > 0 || undefined}>
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 px-5 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-2">
            <SlidersHorizontal className="size-4" aria-hidden />
            More filters{deep ? ` (${deep})` : ""}
          </span>
          <span className="text-muted transition-transform duration-300 group-open:rotate-180" aria-hidden>▾</span>
        </summary>
        <div className="border-t border-border px-5 pt-5 pb-6">
          <FilterForm f={f} events={events} dateInput={dateInput} />
        </div>
      </details>

      <section aria-labelledby="results-heading">
        <div className="mb-5 flex items-baseline justify-between gap-4">
          <h2 id="results-heading" className="text-[15px] text-muted">
            {result.total === 0 ? "No matches" : <><span className="font-semibold text-ink">{result.total.toLocaleString("en-IN")}</span> {result.total === 1 ? "ticket" : "tickets"}{result.pages > 1 ? ` · showing ${firstShown}–${lastShown}` : ""}</>}
          </h2>
          {filters > 0 && (
            <Link href="/tickets" className="text-sm text-muted underline hover:text-ink">
              Clear all
            </Link>
          )}
        </div>

        {result.items.length === 0 ? (
          f.saved && filters === 1 ? (
            <EmptyState title="nothing saved yet" action={<ButtonLink href="/tickets" variant="secondary">Browse tickets</ButtonLink>}>
              Tap the heart on any listing to keep it here. Only you can see what you save.
            </EmptyState>
          ) : filters > 0 ? (
            <EmptyState title="nothing matches that. yet." action={<ButtonLink href="/tickets" variant="secondary">Clear filters</ButtonLink>}>
              Try fewer filters, or check the event page; new listings show up there first.
            </EmptyState>
          ) : (
            <EmptyState title="it's quiet. too quiet." action={<ButtonLink href="/sell">List yours</ButtonLink>}>
              Got a spare ticket you can&apos;t use? Be the first to list it.
            </EmptyState>
          )
        ) : (
          <ul className="flex flex-col gap-6">
            {result.items.map((l) => (
              <li key={l.id}>
                <TicketCard
                  listing={l}
                  status={displayStatus(l)}
                  href={`/listings/${l.id}`}
                  aside={l.sellerId === viewer.id ? undefined : <SaveButton listingId={l.id} saved={Boolean(l.saved)} />}
                />
              </li>
            ))}
          </ul>
        )}

        {result.pages > 1 && (
          <nav aria-label="Pages" className="mt-10 flex items-center justify-between gap-4">
            {result.page > 1 ? (
              <Link className={buttonClass("secondary")} href={`/tickets${withParams(sp, { page: String(result.page - 1) })}`} rel="prev">
                Previous
              </Link>
            ) : <span />}
            <span className="num text-sm text-muted">Page {result.page} of {result.pages}</span>
            {result.page < result.pages ? (
              <Link className={buttonClass("secondary")} href={`/tickets${withParams(sp, { page: String(result.page + 1) })}`} rel="next">
                Next
              </Link>
            ) : <span />}
          </nav>
        )}
        <p className="mt-10 text-center text-[13px] text-muted">
          Only verified students, only events that allow resale. Green prices are under face value or the going rate.
        </p>
      </section>
    </div>
  );
}

function Chip({ href, on, tone, children }: { href: string; on: boolean; tone?: "buy"; children: React.ReactNode }) {
  const onClass = tone === "buy" ? "border-buy bg-buy text-white" : "border-primary bg-primary text-on-primary";
  return (
    <Link
      href={href}
      aria-current={on ? "true" : undefined}
      className={`inline-flex h-9 flex-none items-center gap-1.5 rounded-full border px-4 text-sm font-medium whitespace-nowrap transition-[background-color,border-color,transform] duration-150 active:scale-95 ${
        on ? onClass : "border-border bg-surface text-ink hover:border-control-hover"
      }`}
    >
      {children}
    </Link>
  );
}

function FilterForm({
  f,
  events,
  dateInput,
}: {
  f: ReturnType<typeof parseFilters>;
  events: { id: string; slug: string; name: string }[];
  dateInput: (d?: Date, inclusive?: boolean) => string;
}) {
  return (
    <form method="get" action="/tickets" className="grid gap-5 sm:grid-cols-2">
      {f.q && <input type="hidden" name="q" value={f.q} />}
      {f.format && <input type="hidden" name="format" value={f.format} />}
      {f.deals && <input type="hidden" name="deals" value="1" />}
      {f.saved && <input type="hidden" name="saved" value="1" />}
      <Field label="Event" htmlFor="f-event">
        <Select id="f-event" name="event" defaultValue={f.event ?? ""}>
          <option value="">All events</option>
          {events.map((e) => (
            <option key={e.id} value={e.slug}>{e.name}</option>
          ))}
        </Select>
      </Field>
      <Field label="Kind of event" htmlFor="f-category">
        <Select id="f-category" name="category" defaultValue={f.category ?? ""}>
          <option value="">Any</option>
          {Object.entries(EVENT_CATEGORIES).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </Select>
      </Field>
      <fieldset className="grid grid-cols-2 gap-3">
        <legend className="mb-2 text-sm font-medium">Price per ticket (₹)</legend>
        <Input aria-label="Minimum price in rupees" name="min" inputMode="numeric" placeholder="Min" defaultValue={f.minPaise !== undefined ? paiseToInput(f.minPaise) : ""} />
        <Input aria-label="Maximum price in rupees" name="max" inputMode="numeric" placeholder="Max" defaultValue={f.maxPaise !== undefined ? paiseToInput(f.maxPaise) : ""} />
      </fieldset>
      <fieldset className="grid grid-cols-2 gap-3">
        <legend className="mb-2 text-sm font-medium">Event date</legend>
        <Input aria-label="From date" name="from" type="date" defaultValue={dateInput(f.from)} />
        <Input aria-label="To date" name="to" type="date" defaultValue={dateInput(f.to, true)} />
      </fieldset>
      <Field label="Sort by" htmlFor="f-sort">
        <Select id="f-sort" name="sort" defaultValue={f.sort}>
          {Object.entries(SORTS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </Select>
      </Field>
      <div className="flex items-end pb-2">
        <Checkbox id="f-offers" name="offers" value="1" defaultChecked={f.offers} label="Open to offers" hint="Sellers happy to bargain." />
      </div>
      <div className="flex gap-3 sm:col-span-2">
        <button className={buttonClass("dark")}>Show tickets</button>
        <Link href="/tickets" className={buttonClass("ghost")}>Reset</Link>
      </div>
    </form>
  );
}
