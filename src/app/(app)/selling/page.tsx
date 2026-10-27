import type { Metadata } from "next";
import Link from "next/link";
import { requireBrowser } from "@/server/auth/viewer";
import { displayStatus, myListings } from "@/server/listings";
import type { ListingStatus } from "@/lib/listing-rules";
import { Wristband } from "@/components/wristband";
import { EmptyState, Notice, PageTitle } from "@/components/ui/bits";
import { ButtonLink } from "@/components/ui/button";

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
        sub={waiting > 0 ? `${waiting} ${waiting === 1 ? "person is" : "people are"} waiting on a reply.` : listings.length ? "Everything you've listed, in one place." : undefined}
        actions={
          <>
            {waiting > 0 && <ButtonLink href="/inquiries" variant="secondary">Answer requests</ButtonLink>}
            <ButtonLink href="/sell">Sell a ticket</ButtonLink>
          </>
        }
      />
      {sp.deleted && <Notice tone="success" className="mb-5">Listing deleted.</Notice>}

      {listings.length === 0 ? (
        <EmptyState title="nothing listed yet" action={<ButtonLink href="/sell">List a ticket</ButtonLink>}>
          Got a wristband you can&apos;t use? Someone on campus probably wants it.
        </EmptyState>
      ) : (
        <>
          <nav aria-label="Listing status" className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-4 sm:px-0">
            {GROUPS.map((g) => {
              const selected = g.key === tab;
              return (
                <Link
                  key={g.key}
                  href={`/selling?tab=${g.key}`}
                  aria-current={selected ? "page" : undefined}
                  className={`flex min-w-32 flex-none flex-col rounded-[var(--radius-card)] border px-3 py-2.5 transition-colors sm:min-w-0 ${
                    selected ? "border-accent bg-accent-soft ring-[0.5px] ring-accent" : "border-border bg-surface hover:border-control"
                  }`}
                >
                  <span className={`text-[13px] ${selected ? "text-accent-ink" : "text-muted"}`}>{g.label}</span>
                  <span className="num text-base font-semibold">{counts[g.key]}</span>
                </Link>
              );
            })}
          </nav>
          {shown.length === 0 ? (
            <EmptyState title={`nothing in "${group.label.toLowerCase()}"`} />
          ) : (
            <ul className="flex flex-col gap-2.5">
              {shown.map((l) => (
                <li key={l.id}>
                  <Wristband
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
