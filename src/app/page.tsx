import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Flag, ShieldCheck } from "lucide-react";
import { getViewer } from "@/server/auth/viewer";
import { publicUpcomingEvents } from "@/server/events";
import { env } from "@/server/env";
import { formatPaise } from "@/lib/money";
import { formatDate, formatTime } from "@/lib/format";
import { POLICY_LABEL } from "@/lib/listing-rules";
import { bandStyle } from "@/lib/tint";
import { PublicHeader } from "@/components/shell/public-header";
import { Mark } from "@/components/logo";
import { ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/bits";
import { TrackView } from "@/components/track";
import { Reveal } from "@/components/reveal";

export const metadata: Metadata = {
  title: { absolute: "ResTix: spare wristband? sorted." },
  description: "The campus ticket exchange for verified students. List a fest wristband or ticket you can't use, find one you need, sort the handover on campus.",
  robots: { index: true, follow: true },
  openGraph: { title: "ResTix: spare wristband? sorted.", description: "The campus ticket exchange for verified students." },
};

const FAQ = [
  {
    tab: "Payments",
    q: "Does ResTix take my money?",
    a: "Never. No payments, no fees, no escrow. You and the other person agree a price and pay each other directly, ideally at the handover after you've seen the ticket. That also means ResTix can't refund or recover money sent privately, so don't pay in advance.",
  },
  {
    tab: "Who's on it",
    q: "Who can see my listings?",
    a: "Only students who signed in with a verified college Google account. Your email address is never shown to anyone; people see the display name you pick.",
  },
  {
    tab: "Rules",
    q: "Can I resell any ticket?",
    a: "Only for events whose organisers allow it. Each event shows its resale rule and where it came from. Some allow resale at face value only, some don't allow it at all, and if nobody has confirmed yet, a moderator checks listings first.",
  },
  {
    tab: "Wristbands",
    q: "How do wristband handovers work?",
    a: "In person, somewhere public on campus. A wristband can still be fake, already used, or cut, so check it properly before you pay, and report anything off.",
  },
  {
    tab: "Contact",
    q: "How do I reach a seller?",
    a: "Send a request from the listing. If the seller says yes, they choose what to share with you, like their WhatsApp. No public phone numbers, no random DMs.",
  },
  {
    tab: "Trouble",
    q: "Something went wrong. Now what?",
    a: "Report the listing or the person. Moderators review reports, can take listings down and restrict accounts, and every action is logged. Reports are private, and decisions can be appealed.",
  },
];

export default async function Landing({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  const [viewer, data] = await Promise.all([
    getViewer().catch(() => null),
    publicUpcomingEvents(env().DEFAULT_COLLEGE_SLUG).catch(() => null),
  ]);
  const signedIn = viewer && (viewer.access === "ok" || viewer.access === "restricted");
  const college = data?.college?.shortName ?? "campus";
  const events = data?.events ?? [];
  const totalTickets = events.reduce((n, e) => n + e.availableTickets, 0);
  const domains = env().allowedDomains.join(" or ");
  const cta = signedIn ? (
    <ButtonLink href="/tickets" size="lg" variant="dark">Open ResTix <ArrowRight className="size-4" aria-hidden /></ButtonLink>
  ) : (
    <ButtonLink href="/sign-in" size="lg" variant="dark">Sign in with your {college} account</ButtonLink>
  );

  return (
    <div className="overflow-x-clip">
      <TrackView name="landing_viewed" />
      <Reveal />
      <PublicHeader />

      {sp.notice === "deleted" && (
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6"><Notice tone="success">Your account and its data were deleted. Take care.</Notice></div>
      )}
      {sp.notice === "forbidden" && (
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6"><Notice tone="warning">That page is for moderators only.</Notice></div>
      )}

      {/* Hero: the wristband, enormous, carries the live exchange. */}
      <section className="mx-auto grid max-w-[1200px] grid-cols-[minmax(0,1fr)] items-center gap-10 px-4 pt-10 pb-20 sm:px-6 md:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] md:pt-16 md:pb-28">
        <div>
          <h1 className="text-[clamp(2.4rem,4.7vw,4.5rem)] leading-[0.95] font-bold tracking-[-0.045em] text-balance">
            spare wristband?<br /> sorted.
          </h1>
          <p className="mt-6 max-w-[34ch] text-lg leading-relaxed text-[#2b2f38]">
            ResTix is the ticket exchange for {college} students. List the fest wristband you can&apos;t use, find the one you need, sort the handover on campus. No WhatsApp-group chaos.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            {cta}
            <Link href="#how" className="rounded-[var(--radius-control)] px-3 py-3 text-[15px] font-medium underline-offset-4 hover:underline">
              how it works
            </Link>
          </div>
          <p className="mt-5 text-sm text-muted">Only for verified {domains} accounts. Free, and it never touches your money.</p>
        </div>

        <div className="relative md:-mr-[max(0px,calc((100vw-1200px)/2+24px))]">
          {/* The band: flat accent, bleeding off the right edge, with its snap. */}
          <div className="relative rounded-l-[48px] bg-accent py-8 pr-6 pl-6 sm:py-10 sm:pl-10 md:rounded-r-none md:pr-[max(24px,calc((100vw-1200px)/2+24px))]">
            <span aria-hidden className="absolute top-1/2 left-5 hidden size-5 -translate-y-1/2 rounded-full border-[3px] border-accent-soft/70 sm:block" />
            <div data-ui className="rounded-[var(--radius-card)] bg-surface p-5 shadow-[0_18px_40px_-24px_rgba(56,10,30,0.55)] sm:ml-6">
              <div className="flex items-baseline justify-between gap-4">
                <h2 className="text-base font-semibold">On the exchange right now</h2>
                <span className="num text-[13px] text-muted">
                  {totalTickets} {totalTickets === 1 ? "ticket" : "tickets"} live
                </span>
              </div>
              {events.length === 0 ? (
                <p className="mt-6 mb-2 text-sm text-muted">
                  no upcoming events listed yet. when the next fest is announced, it shows up here.
                </p>
              ) : (
                <ul className="mt-4 flex flex-col gap-2">
                  {events.slice(0, 5).map((e) => (
                    <li key={e.id} style={bandStyle(e.id) as React.CSSProperties} className="flex gap-[3px]">
                      <div className="min-w-0 flex-1 rounded-l-[var(--radius-card)] bg-[var(--band)] px-3 py-2.5">
                        <p className="flex items-center gap-2 truncate text-sm font-semibold">
                          <span className="truncate">{e.name}</span>
                          {e.isFixture && <span className="flex-none rounded-full bg-notice-soft px-1.5 text-[11px] font-medium text-notice-ink">sample</span>}
                        </p>
                        <p className="truncate text-[12px] text-[var(--band-ink)]">
                          {formatDate(e.startsAt)} · {formatTime(e.startsAt)} · {POLICY_LABEL[e.transferPolicy]}
                        </p>
                      </div>
                      <div className="flex w-28 flex-none flex-col items-end justify-center rounded-r-full bg-[var(--band-strong)] py-2 pr-5 pl-2 text-right">
                        {e.availableTickets > 0 ? (
                          <>
                            <span className="num text-sm font-semibold">from {formatPaise(e.lowestPricePaise!)}</span>
                            <span className="text-[11px] text-[var(--band-ink)]">{e.availableTickets} up</span>
                          </>
                        ) : (
                          <span className="text-[12px] text-[var(--band-ink)]">none yet</span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-4 text-[12px] text-muted">Live counts. Seller names and details are only visible once you sign in.</p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works: one wristband, four fields, further along each time. */}
      <section id="how" aria-labelledby="how-heading" className="grid md:grid-cols-4">
        {[
          { bg: "bg-accent-soft", ink: "text-accent-ink", clause: "First, list it.", body: "Event, ticket type, price, where you'll meet. A minute, tops.", tab: "₹800", state: "Available" },
          { bg: "bg-accent-track", ink: "text-accent-ink", clause: "Someone asks.", body: "A verified student sends a request. You see their name, not their email.", tab: "1 request", state: "Waiting" },
          { bg: "bg-accent", ink: "text-white", clause: "You say yes.", body: "Share your WhatsApp or a note, with that one buyer only.", tab: "Shared", state: "Contact shared" },
          { bg: "bg-accent-ink", ink: "text-white", clause: "Swap on campus.", body: "Meet somewhere public, check the band, pay each other. Mark it done.", tab: "Sold", state: "Handed over" },
        ].map((f, i) => (
          <div key={f.clause} data-reveal style={{ "--i": i } as React.CSSProperties} className={`${f.bg} ${f.ink} flex min-h-[20rem] flex-col justify-between gap-10 px-5 py-8 sm:px-6 md:min-h-[28rem] lg:px-8`}>
            <div>
              {i === 0 && <h2 id="how-heading" className="mb-6 text-2xl font-bold tracking-[-0.02em]">How it works</h2>}
              <p className="text-[clamp(1.5rem,2.2vw,2rem)] leading-tight font-semibold tracking-[-0.02em]">{f.clause}</p>
              <p className="mt-3 max-w-[30ch] text-[15px] leading-relaxed opacity-90">{f.body}</p>
            </div>
            {/* The same wristband, a step further along in each field. */}
            <div data-ui aria-hidden className="flex gap-[3px] transition-transform duration-200 ease-[var(--ease-out-expo)] hover:-translate-y-1.5">
              <div className="min-w-0 flex-1 rounded-l-[var(--radius-card)] bg-white px-3 py-2.5 text-ink">
                <p className="truncate text-sm font-semibold">Spring Fest</p>
                <p className="truncate text-[12px] text-muted">{f.state}</p>
              </div>
              <div className="flex w-[5.5rem] flex-none items-center justify-end rounded-r-full bg-[#f6e3ec] py-2.5 pr-4 text-[13px] font-semibold whitespace-nowrap text-accent-ink">{f.tab}</div>
            </div>
          </div>
        ))}
      </section>

      {/* What keeps it safe: close-ups of the real interface pieces. */}
      <section aria-labelledby="safe-heading" className="mx-auto max-w-[1200px] px-4 py-24 sm:px-6 md:py-36">
        <div className="grid gap-2 md:grid-cols-12">
          <div data-reveal className="flex flex-col justify-end rounded-[var(--radius-card)] bg-ink p-6 text-white md:col-span-6 md:row-span-1 md:min-h-56">
            <h2 id="safe-heading" className="text-[clamp(2rem,4vw,3.5rem)] leading-[0.95] font-bold tracking-[-0.03em]">no randoms. no screenshots.</h2>
          </div>
          <div data-reveal style={{ "--i": 1 } as React.CSSProperties} className="relative overflow-hidden rounded-[var(--radius-card)] bg-positive-soft p-6 md:col-span-6 md:min-h-56">
            <div data-ui aria-hidden className="absolute -top-3 -right-6 flex items-center gap-3 text-[56px] font-medium text-positive sm:text-[72px]">
              <BadgeCheck className="size-[1em]" strokeWidth={1.75} /> {college} email
            </div>
            <div className="relative mt-24 sm:mt-28">
              <h3 className="text-lg font-medium">Verified campus accounts</h3>
              <p className="text-[15px] text-[#2b3a30]">Everyone signs in with a {domains} Google account. That proves the email; it doesn&apos;t vouch for the ticket.</p>
            </div>
          </div>
          <div data-reveal style={{ "--i": 2 } as React.CSSProperties} className="relative overflow-hidden rounded-[var(--radius-card)] bg-accent-soft p-6 md:col-span-4 md:min-h-72">
            <div data-ui aria-hidden className="absolute -top-2 -right-10 inline-flex items-center gap-2 rounded-full bg-accent-track px-6 py-3 text-[40px] font-medium text-accent-ink">
              <ShieldCheck className="size-[1em]" /> Face value only
            </div>
            <div className="relative mt-28">
              <h3 className="text-lg font-medium">Event rules, enforced</h3>
              <p className="text-[15px] text-accent-ink">Price caps and no-resale events are blocked before anything goes live.</p>
            </div>
          </div>
          <div data-reveal style={{ "--i": 3 } as React.CSSProperties} className="relative overflow-hidden rounded-[var(--radius-card)] bg-raised p-6 md:col-span-4 md:min-h-72">
            <div data-ui aria-hidden className="absolute -top-4 -right-4 flex items-baseline gap-2 text-[64px] leading-none font-bold tracking-[-0.03em] text-ink">
              <span className="num">₹0</span><span className="text-[28px] font-medium text-muted">fees</span>
            </div>
            <div className="relative mt-28">
              <h3 className="text-lg font-medium">We never touch money</h3>
              <p className="text-[15px] text-muted">No payments, no fees, no escrow. Pay at the handover, after you&apos;ve checked the band.</p>
            </div>
          </div>
          <div data-reveal style={{ "--i": 4 } as React.CSSProperties} className="relative overflow-hidden rounded-[var(--radius-card)] bg-negative-soft p-6 md:col-span-4 md:min-h-72">
            <div data-ui aria-hidden className="absolute -top-3 -right-8 flex items-center gap-2 text-[44px] font-medium text-negative-ink underline decoration-2 underline-offset-8">
              <Flag className="size-[0.9em]" /> Report this
            </div>
            <div className="relative mt-28">
              <h3 className="text-lg font-medium">Real moderators</h3>
              <p className="text-[15px] text-negative-ink">Reports go to a queue. Listings come down, accounts get restricted, every action is logged and can be appealed.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Questions: filed like index cards. */}
      <section aria-labelledby="faq-heading" className="mx-auto max-w-[900px] px-4 pb-24 sm:px-6 md:pb-36">
        <h2 id="faq-heading" data-reveal className="mb-10 text-[clamp(2rem,4vw,3.25rem)] leading-none font-bold tracking-[-0.03em]">questions, answered</h2>
        <div className="flex flex-col">
          {FAQ.map((f, i) => (
            <details
              key={f.q}
              open={i === 0}
              data-reveal
              style={{ "--i": i, "--step": `${i * 32}px` } as React.CSSProperties}
              // Each card's tab sits in the gap above it, so it never covers the card before;
              // the cards step right like a filed drawer from tablet width up.
              className={`group relative mt-9 first:mt-7 md:ml-[var(--step)] ${i % 2 ? "bg-accent-track" : "bg-accent-soft"} rounded-[var(--radius-card)] rounded-tl-none`}
            >
              <summary className="flex min-h-14 cursor-pointer list-none flex-col gap-1 px-5 py-4 [&::-webkit-details-marker]:hidden">
                <span className={`absolute -top-7 left-0 inline-flex h-7 items-center rounded-t-[var(--radius-control)] px-4 text-[13px] font-medium text-accent-ink ${i % 2 ? "bg-accent-track" : "bg-accent-soft"}`}>
                  {f.tab}
                </span>
                <span className="mt-1 text-lg font-medium text-ink">{f.q}</span>
              </summary>
              <p className="max-w-[60ch] px-5 pb-6 text-base leading-relaxed text-[#3a2430]">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Closing statement. */}
      <section className="mx-auto max-w-[1200px] px-4 pb-24 sm:px-6 md:pb-32">
        <div data-reveal className="flex flex-col items-start gap-8 md:flex-row md:items-end md:justify-between">
          <h2 className="max-w-[14ch] text-[clamp(2.25rem,5.5vw,4.75rem)] leading-[0.95] font-bold tracking-[-0.04em]">your campus. your tickets.</h2>
          {cta}
        </div>
      </section>

      {/* Footer: the mark, built large. */}
      <footer className="bg-accent-ink text-white">
        <div className="mx-auto max-w-[1200px] px-4 pt-14 pb-10 sm:px-6">
          <div aria-hidden className="flex h-[22vw] max-h-56 min-h-28 items-stretch gap-1">
            <div className="flex-[5] rounded-l-[28px] bg-accent" />
            <div className="flex-[2] bg-accent/80" />
            <div className="relative flex-[2] rounded-r-full bg-accent-soft/15">
              <span className="absolute top-1/2 right-[18%] size-[18%] max-h-10 min-h-4 -translate-y-1/2 rounded-full border-[3px] border-accent-soft/60" style={{ aspectRatio: "1" }} />
            </div>
          </div>
          <div className="mt-12 grid gap-8 text-[15px] sm:grid-cols-[1fr_auto]">
            <div className="flex items-center gap-3">
              <Mark className="size-8" />
              <p className="max-w-md text-white/80">ResTix connects students. Payments and handovers happen between you, never through us. Not affiliated with any event organiser unless an event says so.</p>
            </div>
            <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 text-white/85">
              <Link href="/safety" className="hover:text-white">Safety</Link>
              <Link href="/privacy" className="hover:text-white">Privacy</Link>
              <Link href="/terms" className="hover:text-white">Terms</Link>
              <Link href="/sign-in" className="hover:text-white">Sign in</Link>
            </nav>
          </div>
          <p className="mt-10 text-[13px] text-white/60">© {new Date().getFullYear()} ResTix · a student project</p>
        </div>
      </footer>
    </div>
  );
}
