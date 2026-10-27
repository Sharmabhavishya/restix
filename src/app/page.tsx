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
import { ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/bits";
import { TrackView } from "@/components/track";
import { SiteFooter } from "@/components/site-footer";
import { BAND_PHOTOS, CLIPS, MOMENT_PHOTO } from "@/components/landing-photos";
import { LoopVideo } from "@/components/loop-video";
import Image from "next/image";

// The tape strip under the hero: the rules, said the way people say them.
const TAPE = ["spare band? sorted", "face value, fr", "₹0 fees. no cap.", "verified campus emails only", "meet somewhere public", "check the band before you pay", "report anything sus"];

// One size for every section heading below the hero.
const H2 = "text-[clamp(2rem,4vw,3.25rem)] leading-[0.95] font-bold tracking-[-0.03em] text-balance";

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
            <span className="hero-line" style={{ "--i": 0 } as React.CSSProperties}>spare wristband?</span>
            <br />
            <span className="hero-line" style={{ "--i": 1 } as React.CSSProperties}>sorted.</span>
          </h1>
          <p className="mt-6 max-w-[34ch] text-lg leading-relaxed text-ink-soft">
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
          {/* The band, bleeding off the right edge with its snap, cut from a real night on campus. */}
          <div className="relative rounded-l-[48px] bg-accent py-8 pr-6 pl-6 sm:py-10 sm:pl-10 md:rounded-r-none md:pr-[max(24px,calc((100vw-1200px)/2+24px))]">
            <LoopVideo priority src={CLIPS.stageLights.src} poster={CLIPS.stageLights.poster} className="absolute inset-0 rounded-l-[48px] md:rounded-r-none" />
            {/* A wash of the accent keeps the band ours, whatever colour the stage was. */}
            <span aria-hidden className="absolute inset-0 rounded-l-[48px] bg-accent opacity-40 mix-blend-multiply md:rounded-r-none" />
            <span aria-hidden className="absolute top-1/2 left-5 hidden size-5 -translate-y-1/2 rounded-full border-[3px] border-white/80 sm:block" />
            <div data-ui className="relative rounded-[var(--radius-card)] bg-surface p-5 shadow-[0_18px_40px_-24px_rgba(56,10,30,0.55)] sm:ml-6">
              <span className="sticker absolute -top-4 -right-3 z-10 rounded-full bg-sticker px-3.5 py-1.5 text-sm font-bold whitespace-nowrap text-sticker-ink sm:-right-5">
                free. no cap.
              </span>
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

      {/* Tape strip: the house rules as a band of sticker tape, sliding with the scroll. */}
      <div aria-hidden className="-mx-4 -rotate-2 bg-primary py-4 text-on-primary sm:py-5">
        <div className="tape-track flex w-max bg-primary">
          {[0, 1].map((copy) => (
            <div key={copy} className="flex items-center">
              {TAPE.map((t) => (
                <span key={t} className="flex items-center text-[clamp(1.25rem,2.6vw,2rem)] font-bold tracking-[-0.02em] whitespace-nowrap">
                  <span className="px-6 sm:px-8">{t}</span>
                  <span className="size-3 rounded-full border-[3px] border-accent" />
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* The fest world: real bands and real campus nights, laid end to end like one band. */}
      <section aria-labelledby="fest-heading" className="mx-auto max-w-[1200px] px-4 pt-20 pb-20 sm:px-6 md:pt-28 md:pb-28">
        <div className="grid gap-5 md:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] md:items-end">
          <h2 id="fest-heading" className={H2}>every fest runs on a band.</h2>
          <p className="max-w-[42ch] text-lg leading-relaxed text-ink-soft">
            Plans change, exams move, friends bail. The band you can&apos;t use is the one someone in your hostel is hunting for.
          </p>
        </div>
        <div className="mt-10 grid grid-cols-2 gap-x-[3px] gap-y-5 md:flex md:gap-[3px]">
          {BAND_PHOTOS.map((p, i) => {
            const last = i === BAND_PHOTOS.length - 1;
            const shape = i === 0 ? "md:rounded-l-[48px]" : last ? "md:rounded-r-full" : "";
            return (
              <figure key={p.caption} className={`flex min-w-0 flex-col gap-2 ${i === 0 ? "md:flex-[5]" : "md:flex-[3]"}`}>
                <div className={`group/photo relative aspect-[3/4] overflow-hidden rounded-[var(--radius-card)] bg-raised md:aspect-auto md:h-[clamp(320px,34vw,480px)] md:rounded-none ${shape}`}>
                  <Image
                    src={p.src}
                    alt={p.alt}
                    placeholder="blur"
                    sizes={i === 0 ? "(min-width: 768px) 36vw, 50vw" : "(min-width: 768px) 22vw, 50vw"}
                    className="size-full object-cover transition-transform duration-700 ease-[var(--ease-out-expo)] motion-safe:group-hover/photo:scale-[1.04]"
                    style={{ objectPosition: p.focus, transformOrigin: "100% 100%" }}
                  />
                  {last && <span aria-hidden className="absolute top-[40%] right-[16%] hidden size-6 -translate-y-1/2 rounded-full border-[3px] border-white/80 md:block" />}
                </div>
                <figcaption className="text-[13px] text-muted">{p.caption}</figcaption>
              </figure>
            );
          })}
        </div>
      </section>

      {/* How it works: one wristband, four fields, further along each time. */}
      <section id="how" aria-labelledby="how-heading" className="grid md:grid-cols-4">
        {[
          { bg: "bg-accent-soft", ink: "text-accent-ink", clause: "First, list it.", body: "Event, ticket type, price, where you'll meet. A minute, tops.", tab: "₹800", state: "Available" },
          { bg: "bg-accent-track", ink: "text-accent-ink", clause: "Someone asks.", body: "A verified student sends a request. You see their name, not their email.", tab: "1 request", state: "Waiting" },
          { bg: "bg-accent", ink: "text-white", clause: "You say yes.", body: "Share your WhatsApp or a note, with that one buyer only.", tab: "Shared", state: "Contact shared" },
          { bg: "bg-accent-deep", ink: "text-white", clause: "Swap on campus.", body: "Meet somewhere public, check the band, pay each other. Mark it done.", tab: "Sold", state: "Handed over" },
        ].map((f, i) => (
          <div key={f.clause} data-reveal style={{ "--i": i } as React.CSSProperties} className={`${f.bg} ${f.ink} flex min-h-[20rem] flex-col justify-between gap-10 px-5 py-8 sm:px-6 md:min-h-[28rem] lg:px-8`}>
            <div>
              {i === 0 && <h2 id="how-heading" className="mb-6 text-2xl font-bold tracking-[-0.02em]">How it works</h2>}
              <p className="text-[clamp(1.5rem,2.2vw,2rem)] leading-tight font-semibold tracking-[-0.02em]">{f.clause}</p>
              <p className="mt-3 max-w-[30ch] text-[15px] leading-relaxed">{f.body}</p>
            </div>
            {/* The same wristband, a step further along in each field. */}
            <div data-ui aria-hidden className="flex gap-[3px] transition-transform duration-200 ease-[var(--ease-out-expo)] hover:-translate-y-1.5">
              <div className="min-w-0 flex-1 rounded-l-[var(--radius-card)] bg-surface px-3 py-2.5 text-ink">
                <p className="truncate text-sm font-semibold">Spring Fest</p>
                <p className="truncate text-[12px] text-muted">{f.state}</p>
              </div>
              <div className="flex w-[5.5rem] flex-none items-center justify-end rounded-r-full bg-accent-field py-2.5 pr-4 text-[13px] font-semibold whitespace-nowrap text-accent-ink">{f.tab}</div>
            </div>
          </div>
        ))}
      </section>

      {/* What keeps it safe: one mark per promise, every tile built the same way so they line up. */}
      <section aria-labelledby="safe-heading" className="mx-auto max-w-[1200px] px-4 py-24 sm:px-6 md:py-36">
        <div className="grid gap-2 md:grid-cols-12">
          <div data-reveal className="flex flex-col justify-end rounded-[var(--radius-card)] bg-primary p-6 text-on-primary md:col-span-6 md:min-h-64">
            <h2 id="safe-heading" className={H2}>no randoms. no screenshots.</h2>
          </div>
          {[
            { span: "md:col-span-6", tone: "bg-positive-soft", mark: "text-positive", body: "text-positive-ink", icon: <BadgeCheck className="size-[1em] flex-none" strokeWidth={1.75} />, label: `${college} email`, title: "Verified campus accounts", text: `Everyone signs in with a ${domains} Google account. That proves the email; it doesn't vouch for the ticket.` },
            { span: "md:col-span-6 lg:col-span-4", tone: "bg-accent-soft", mark: "text-accent-strong", body: "text-accent-ink", icon: <ShieldCheck className="size-[1em] flex-none" strokeWidth={1.75} />, label: "Face value", title: "Event rules, enforced", text: "Price caps and no-resale events are blocked before anything goes live." },
            { span: "md:col-span-6 lg:col-span-4", tone: "bg-raised", mark: "text-ink", body: "text-muted", icon: null, label: "₹0 fees", title: "We never touch money", text: "No payments, no fees, no escrow. Pay at the handover, after you've checked the band." },
            { span: "md:col-span-12 lg:col-span-4", tone: "bg-negative-soft", mark: "text-negative-ink", body: "text-negative-ink", icon: <Flag className="size-[0.9em] flex-none" strokeWidth={1.75} />, label: "Report this", title: "Real moderators", text: "Reports go to a queue. Listings come down, accounts get restricted, every action is logged and can be appealed." },
          ].map((t, i) => (
            <div key={t.title} data-reveal style={{ "--i": i + 1 } as React.CSSProperties} className={`${t.span} ${t.tone} flex flex-col gap-16 rounded-[var(--radius-card)] p-6 md:gap-24`}>
              <p data-ui aria-hidden className={`${t.mark} num flex items-center gap-3 text-[2.25rem] leading-none font-semibold tracking-[-0.02em]`}>
                {t.icon}
                <span className="truncate">{t.label}</span>
              </p>
              <div>
                <h3 className="text-lg font-medium">{t.title}</h3>
                <p className={`mt-1 max-w-[46ch] text-base leading-relaxed ${t.body}`}>{t.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* The moment: the whole width, one night. */}
      <section aria-labelledby="moment-heading" className="relative isolate flex min-h-[min(88vh,820px)] items-end overflow-hidden bg-primary">
        <Image
          src={MOMENT_PHOTO.wide}
          alt={MOMENT_PHOTO.alt}
          placeholder="blur"
          sizes="100vw"
          className="absolute inset-0 -z-10 hidden size-full object-cover md:block"
          style={{ objectPosition: MOMENT_PHOTO.focus }}
        />
        <Image
          src={MOMENT_PHOTO.src}
          alt=""
          placeholder="blur"
          sizes="100vw"
          className="absolute inset-0 -z-10 size-full object-cover md:hidden"
          style={{ objectPosition: MOMENT_PHOTO.focus }}
        />
        <span aria-hidden className="absolute inset-0 -z-10 bg-black/45" />
        <div className="mx-auto w-full max-w-[1200px] px-4 pt-40 pb-14 text-white sm:px-6 md:pb-20">
          <h2 id="moment-heading" className="max-w-[13ch] text-[clamp(2.5rem,6.5vw,5.5rem)] leading-[0.92] font-bold tracking-[-0.045em] text-balance">
            don&apos;t watch it on someone&apos;s story.
          </h2>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
            <ButtonLink href={signedIn ? "/tickets" : "/sign-in"} size="lg" variant="primary">
              Find a band <ArrowRight className="size-4" aria-hidden />
            </ButtonLink>
            <p className="max-w-[36ch] text-[15px] text-white/90">If someone on campus can&apos;t make it, their band shows up here first.</p>
          </div>
          <p className="mt-10 text-[13px] text-white/75">{MOMENT_PHOTO.caption}</p>
        </div>
      </section>

      {/* Questions: filed like index cards. */}
      <section aria-labelledby="faq-heading" className="mx-auto max-w-[900px] px-4 pt-24 pb-24 sm:px-6 md:pt-36 md:pb-36">
        <h2 id="faq-heading" className={`mb-10 ${H2}`}>questions, answered</h2>
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
              <p className="max-w-[60ch] px-5 pb-6 text-base leading-relaxed text-accent-ink">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Closing statement, beside the crowd it is for. */}
      <section aria-labelledby="closing-heading" className="mx-auto max-w-[1200px] px-4 pb-24 sm:px-6 md:pb-32">
        <div className="grid items-end gap-8 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-10">
          <div className="flex flex-col items-start gap-8">
            <h2 id="closing-heading" className={`max-w-[12ch] ${H2}`}>your campus. your tickets.</h2>
            {cta}
          </div>
          <figure className="flex flex-col gap-2">
            <LoopVideo src={CLIPS.handsUp.src} poster={CLIPS.handsUp.poster} className="relative aspect-[16/9] rounded-[var(--radius-card)] bg-raised md:rounded-r-[48px]" />
            <figcaption className="text-[13px] text-muted">hands up, last song</figcaption>
          </figure>
        </div>
      </section>

      <SiteFooter year={new Date().getFullYear()} />
    </div>
  );
}
