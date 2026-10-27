import type { Metadata } from "next";
import Link from "next/link";
import { SlidersHorizontal } from "lucide-react";
import { requireBrowser } from "@/server/auth/viewer";
import { formatCounts, PAGE_SIZE, SORTS, searchListings, displayStatus } from "@/server/listings";
import { listUpcomingEvents } from "@/server/events";
import { activeFilterCount, parseFilters, withParams, type RawParams } from "@/lib/search-params";
import { FORMAT_LABEL } from "@/lib/listing-rules";
import { paiseToInput } from "@/lib/money";
import { firstName, toLocalInput } from "@/lib/format";
import { EVENT_CATEGORIES } from "@/server/event-admin";
import { Wristband } from "@/components/wristband";
import { EmptyState, PageTitle } from "@/components/ui/bits";
import { ButtonLink, buttonClass } from "@/components/ui/button";
import { Checkbox, Field, Input, Select } from "@/components/ui/field";
import { TrackView } from "@/components/track";
import { CountTile } from "@/components/ui/count-tile";

export const metadata: Metadata = { title: "Find tickets" };

const FORMAT_TABS = [["", "All"], ["wristband", "Wristbands"], ["digital", "Digital"], ["paper", "Paper"], ["other", "Other"]] as const;

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
  const firstShown = result.total === 0 ? 0 : (result.page - 1) * PAGE_SIZE + 1;
  const lastShown = Math.min(result.page * PAGE_SIZE, result.total);
  const dateInput = (d?: Date, inclusive = false) => (d ? toLocalInput(inclusive ? new Date(d.getTime() - 86_400_000) : d).slice(0, 10) : "");

  return (
    <>
      <PageTitle
        title="Find tickets"
        sub={
          totalAll === 0 && filters === 0
            ? `hey ${firstName(viewer.displayName)}, nothing's listed rn. check back closer to the next fest.`
            : `hey ${firstName(viewer.displayName)}, ${totalAll.toLocaleString("en-IN")} ${totalAll === 1 ? "listing is" : "listings are"} live from ${viewer.collegeShortName} students rn.`
        }
        actions={<ButtonLink href="/sell">Sell a ticket</ButtonLink>}
      />
      {filters > 0 && (
        <TrackView name="search_performed" dedupeKey={`search:${withParams(sp, { page: undefined })}`} props={{ filters, results: result.total }} />
      )}

      {/* Count cards that filter: the format is the first question people ask. */}
      <nav aria-label="Ticket format" className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-5 sm:overflow-visible sm:px-0">
        {FORMAT_TABS.map(([value, label]) => {
          const selected = (f.format ?? "") === value;
          const count = value ? counts[value] ?? 0 : totalAll;
          return (
            <CountTile
              key={label}
              href={`/tickets${withParams(sp, { format: value || undefined, page: undefined })}`}
              label={label}
              count={count}
              selected={selected}
            />
          );
        })}
      </nav>

      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[1fr_280px]">
        <aside className="lg:order-2">
          <details className="group rounded-[var(--radius-card)] border border-border bg-surface lg:hidden" open={filters > 0 ? true : undefined}>
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
              <span className="flex items-center gap-2">
                <SlidersHorizontal className="size-4" aria-hidden />
                Filters{filters ? ` (${filters})` : ""}
              </span>
              <span className="text-muted transition-transform group-open:rotate-180" aria-hidden>▾</span>
            </summary>
            <div className="border-t border-border px-4 py-4">
              <FilterForm idPrefix="m" f={f} events={events} dateInput={dateInput} />
            </div>
          </details>
          <div className="hidden rounded-[var(--radius-card)] border border-border bg-surface p-4 lg:block">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
              <SlidersHorizontal className="size-4" aria-hidden />
              Filters{filters ? ` (${filters})` : ""}
            </h2>
            <FilterForm idPrefix="d" f={f} events={events} dateInput={dateInput} />
          </div>
          <p className="mt-3 px-1 text-[13px] text-muted">
            Only listings from verified {viewer.collegeShortName} students for events that allow resale show up here. {FORMAT_LABEL.wristband}s are handed over in person.
          </p>
        </aside>
        <section aria-labelledby="results-heading" className="min-w-0 lg:order-1">
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <h2 id="results-heading" className="text-[15px] font-semibold">
              {result.total === 0 ? "No matches" : `${firstShown}–${lastShown} of ${result.total.toLocaleString("en-IN")}`}
            </h2>
            {filters > 0 && (
              <Link href="/tickets" className="text-sm text-muted underline hover:text-ink">
                Clear filters
              </Link>
            )}
          </div>

          {result.items.length === 0 ? (
            filters > 0 ? (
              <EmptyState title="nothing matches that. yet." action={<ButtonLink href="/tickets" variant="secondary">Clear filters</ButtonLink>}>
                Try fewer filters, or check the event page; new listings show up there first.
              </EmptyState>
            ) : (
              <EmptyState title="it's quiet. too quiet." action={<ButtonLink href="/sell">List yours</ButtonLink>}>
                Got a spare wristband or ticket you can&apos;t use? Be the first to list it.
              </EmptyState>
            )
          ) : (
            <ul className="flex flex-col gap-2.5">
              {result.items.map((l) => (
                <li key={l.id}>
                  <Wristband listing={l} status={displayStatus(l)} href={`/listings/${l.id}`} />
                </li>
              ))}
            </ul>
          )}

          {result.pages > 1 && (
            <nav aria-label="Pages" className="mt-6 flex items-center justify-between gap-4">
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
        </section>

      </div>
    </>
  );
}

function FilterForm({
  idPrefix,
  f,
  events,
  dateInput,
}: {
  idPrefix: string;
  f: ReturnType<typeof parseFilters>;
  events: { id: string; slug: string; name: string }[];
  dateInput: (d?: Date, inclusive?: boolean) => string;
}) {
  return (
    <form method="get" action="/tickets" className="flex flex-col gap-4">
      {f.format && <input type="hidden" name="format" value={f.format} />}
      <Field label="Search" htmlFor={`${idPrefix}-q`}>
        <Input id={`${idPrefix}-q`} name="q" type="search" defaultValue={f.q ?? ""} placeholder="Event, ticket or venue" />
      </Field>
      <Field label="Event" htmlFor={`${idPrefix}-event`}>
        <Select id={`${idPrefix}-event`} name="event" defaultValue={f.event ?? ""}>
          <option value="">All events</option>
          {events.map((e) => (
            <option key={e.id} value={e.slug}>{e.name}</option>
          ))}
        </Select>
      </Field>
      <Field label="Kind of event" htmlFor={`${idPrefix}-category`}>
        <Select id={`${idPrefix}-category`} name="category" defaultValue={f.category ?? ""}>
          <option value="">Any</option>
          {Object.entries(EVENT_CATEGORIES).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </Select>
      </Field>
      <fieldset className="grid grid-cols-2 gap-3">
        <legend className="mb-2 text-sm font-medium">Price (₹)</legend>
        <Input aria-label="Minimum price in rupees" name="min" inputMode="numeric" placeholder="Min" defaultValue={f.minPaise !== undefined ? paiseToInput(f.minPaise) : ""} />
        <Input aria-label="Maximum price in rupees" name="max" inputMode="numeric" placeholder="Max" defaultValue={f.maxPaise !== undefined ? paiseToInput(f.maxPaise) : ""} />
      </fieldset>
      <fieldset className="grid grid-cols-2 gap-3">
        <legend className="mb-2 text-sm font-medium">Event date</legend>
        <Input aria-label="From date" name="from" type="date" defaultValue={dateInput(f.from)} />
        <Input aria-label="To date" name="to" type="date" defaultValue={dateInput(f.to, true)} />
      </fieldset>
      <Checkbox id={`${idPrefix}-offers`} name="offers" value="1" defaultChecked={f.offers} label="Open to offers" hint="Sellers happy to bargain." />
      <Field label="Sort by" htmlFor={`${idPrefix}-sort`}>
        <Select id={`${idPrefix}-sort`} name="sort" defaultValue={f.sort}>
          {Object.entries(SORTS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </Select>
      </Field>
      <button className={buttonClass("dark")}>Show tickets</button>
    </form>
  );
}
