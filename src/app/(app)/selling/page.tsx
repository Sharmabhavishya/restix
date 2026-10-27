import type { Metadata } from "next";
import Link from "next/link";
import { requireBrowser } from "@/server/auth/viewer";
import { displayStatus, myListings } from "@/server/listings";
import type { ListingStatus } from "@/lib/listing-rules";
import { TicketCard } from "@/components/ticket-card";
import { EmptyState, Notice, PageTitle } from "@/components/ui/bits";
import { ButtonLink } from "@/components/ui/button";
import { CountTile } from "@/components/ui/count-tile";

export const metadata: Metadata = { title: "My listings" };

const GROUPS: { key: string; label: string; statuses: ListingStatus[] }[] = [
  { key: "live", label: "Live", statuses: ["active", "paused"] },
  { key: "waiting", label: "Drafts & review", statuses: ["draft", "pending_review"] },
  { key: "closed", label: "Sold & closed", statuses: ["sold", "unavailable", "expired"] },
  { key: "problems", label: "Taken down", statuses: ["removed", "rejected"] },
];

export default async function SellingPage({ searchParams }: PageProps<"/selling">) {
  const sp = await searchParams;
  const viewer = await requireBrowser("/selling");
  const listings = (await myListings(viewer.id)).map((l) => ({ ...l, shown: displayStatus(l) }));
  const counts = Object.fromEntries(GROUPS.map((g) => [g.key, listings.filter((l) => g.statuses.includes(l.shown)).length]));
  const firstNonEmpty = GROUPS.find((g) => counts[g.key] > 0)?.key ?? "live";
  const tab = typeof sp.tab === "string" && GROUPS.some((g) => g.key === sp.tab) ? sp.tab : firstNonEmpty;
  const group = GROUPS.find((g) => g.key === tab)!;
  const shown = listings.filter((l) => group.statuses.includes(l.shown));
  const waiting = listings.reduce((n, l) => n + l.openInquiries, 0);

  return (
    <>
      <PageTitle
        title="My listings"
        sub={waiting > 0 ? `${waiting} ${waiting === 1 ? "person is" : "people are"} waiting on a reply.` : listings.length ? "everything you've listed, in one place." : undefined}
        actions={
          <>
            {waiting > 0 && <ButtonLink href="/inquiries" variant="secondary">Answer requests</ButtonLink>}
            <ButtonLink href="/sell">Sell a ticket</ButtonLink>
          </>
        }
      />
      {sp.deleted && <Notice tone="success" className="mb-5">Listing deleted.</Notice>}

      {listings.length === 0 ? (
        <EmptyState title="your shelf's empty" action={<ButtonLink href="/sell">List a ticket</ButtonLink>}>
          Got a ticket you can&apos;t use? Someone probably wants it.
        </EmptyState>
      ) : (
        <>
          <nav aria-label="Listing status" className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-4 sm:px-0">
            {GROUPS.map((g) => {
              const selected = g.key === tab;
              return (
                <CountTile key={g.key} href={`/selling?tab=${g.key}`} label={g.label} count={counts[g.key]} selected={selected} className="min-w-32" />
              );
            })}
          </nav>
          {shown.length === 0 ? (
            <EmptyState title={`nothing in "${group.label.toLowerCase()}"`} />
          ) : (
            <ul className="flex flex-col gap-4">
              {shown.map((l) => (
                <li key={l.id}>
                  <TicketCard
                    listing={l}
                    status={l.shown}
                    href={`/listings/${l.id}`}
                    aside={
                      l.openInquiries > 0 ? (
                        <Link href="/inquiries" className="hidden flex-none rounded-full bg-accent px-3 py-1.5 text-[13px] font-medium text-white hover:bg-accent-hover sm:block">
                          {l.openInquiries} {l.openInquiries === 1 ? "request" : "requests"}
                        </Link>
                      ) : null
                    }
                  />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </>
  );
}
