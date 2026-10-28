import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, BadgeCheck, Check, Flag, Lock, MessageCircle } from "lucide-react";
import { getViewer } from "@/server/auth/viewer";
import { publicUpcomingEvents } from "@/server/events";
import { env } from "@/server/env";
import { formatPaise } from "@/lib/money";
import { formatDate, formatTime } from "@/lib/format";
import { bandStyle } from "@/lib/tint";
import type { TicketFormat } from "@/lib/listing-rules";
import { PublicHeader } from "@/components/shell/public-header";
import { ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/bits";
import { TrackView } from "@/components/track";
import { SiteFooter } from "@/components/site-footer";
import { BAND_PHOTOS, CLIPS, MOMENT_PHOTO } from "@/components/landing-photos";
import { LoopVideo } from "@/components/loop-video";
import { TicketCard, type TicketData } from "@/components/ticket-card";
import { MotionRoot } from "@/components/motion-root";
import { FormatShowcase } from "@/components/format-showcase";

// The tape strip under the hero: the rules, said the way people say them.
const TAPE = ["spare ticket? sorted", "your number stays private", "₹0 fees. no cap.", "verified college emails only", "no group-chat spam", "wristbands · QR · paper · passes", "check it before you pay", "report anything sus"];

// One size for every section heading below the hero.
const H2 = "font-display text-[clamp(2.25rem,4.6vw,3.75rem)] leading-[0.95] font-extrabold tracking-[-0.035em] text-balance";

export const metadata: Metadata = {
  title: { absolute: "ResTix: spare ticket? sorted." },
  description: "The ticket exchange for verified students. Sell the ticket you can't use without posting your number in every group chat: it stays private until you accept a buyer.",
  robots: { index: true, follow: true },
  openGraph: { title: "ResTix: spare ticket? sorted.", description: "The ticket exchange for verified students." },
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
    a: "Only students who signed in with a verified college Google account. Your email address is never shown to anyone; people see the name on your college Google account.",
  },
  {
    tab: "Events",
    q: "Which events can I list for?",
    a: "Any event the admins have added, and you can suggest one that's missing. If the organisers don't allow resale, or cap it at face value, the event is marked and ResTix enforces it for you.",
  },
  {
    tab: "Handovers",
    q: "How do handovers work?",
    a: "Physical tickets (wristbands, paper tickets, passes, tokens) change hands in person, somewhere public. QR, email and app tickets are sent digitally. Either way, check the ticket before you pay, and report anything off.",
  },
  {
    tab: "Privacy",
    q: "Will my number get leaked?",
    a: "No. Your phone number is never on a listing, a profile or a request. When a seller accepts a buyer, those two (and only those two) get each other's WhatsApp, with a message already written. Until then, it's just names.",
  },
  {
    tab: "Trouble",
    q: "Something went wrong. Now what?",
    a: "Report the listing, including problems with the person behind it. Moderators review reports, can take listings down and restrict accounts, and every action is logged. Reports are private, and decisions can be appealed.",
  },
];

// What each kind of ticket looks like on ResTix. Illustrations, labelled as examples on the page.
const EXAMPLES: (Pick<TicketData, "eventName" | "ticketTypeName" | "format" | "quantity" | "askingPricePaise"> & { face?: number; bulk?: [number, number]; offers?: boolean })[] = [
  { eventName: "Fest night", ticketTypeName: "Day pass", format: "wristband", quantity: 2, askingPricePaise: 60000, face: 80000 },
  { eventName: "Indie gig", ticketTypeName: "Standing", format: "paper", quantity: 1, askingPricePaise: 45000, face: 45000 },
  { eventName: "Comedy night", ticketTypeName: "Row F", format: "qr", quantity: 1, askingPricePaise: 79900, offers: true },
  { eventName: "Stadium show", ticketTypeName: "Gold", format: "app", quantity: 4, askingPricePaise: 250000, face: 220000, bulk: [3, 230000] },
  { eventName: "Freshers party", ticketTypeName: "Entry", format: "email", quantity: 1, askingPricePaise: 30000, face: 50000 },
  { eventName: "Film fest", ticketTypeName: "All-access", format: "pass", quantity: 1, askingPricePaise: 120000 },
  { eventName: "Food carnival", ticketTypeName: "Food coupons", format: "token", quantity: 5, askingPricePaise: 10000, offers: true },
];

// What each format is called on the showcase, and how it changes hands. Plain, because it's safety.
const FORMAT_NOTES: Record<string, [string, string]> = {
  wristband: ["Wristband", "Handed over in person. Check the clasp hasn't been cut before you pay."],
  paper: ["Paper", "A printed ticket or stub. Meet somewhere public and look at it first."],
  qr: ["QR", "Sent as a PDF or screenshot. Get it before you pay, and never post the code."],
  app: ["App", "Moves inside the ticketing app. Transfer first, then pay."],
  email: ["Email", "A booking email or confirmation, forwarded or reissued in the organiser's system."],
  pass: ["Pass", "A lanyard, pass or entry card. In person, and check the name and date on it."],
  token: ["Tokens", "Food coupons, drink tokens, stamp cards. Count them at the handover."],
};

const example = (e: (typeof EXAMPLES)[number], i: number): TicketData => ({
  id: `example-${e.format}`,
  eventId: `example-${i * 7 + 3}`,
  eventName: e.eventName,
  eventStartsAt: new Date(Date.UTC(2026, 10, 7 + i, 13, 30)),
  ticketTypeName: e.ticketTypeName,
  format: e.format as TicketFormat,
  quantity: e.quantity,
  askingPricePaise: e.askingPricePaise,
  faceValuePaise: e.face ?? null,
  priceNegotiable: e.offers,
  bulkMinQuantity: e.bulk?.[0] ?? null,
  bulkPricePaise: e.bulk?.[1] ?? null,
});

export default async function Landing({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  const [viewer, data] = await Promise.all([
    getViewer().catch(() => null),
    publicUpcomingEvents(env().DEFAULT_COLLEGE_SLUG).catch(() => null),
  ]);
  const signedIn = viewer && (viewer.access === "ok" || viewer.access === "restricted");
  const events = data?.events ?? [];
  const totalTickets = events.reduce((n, e) => n + e.availableTickets, 0);
  const cta = signedIn ? (
    <ButtonLink href="/tickets" size="lg" variant="dark">Open ResTix <ArrowRight className="size-4" aria-hidden /></ButtonLink>
  ) : (
    <ButtonLink href="/sign-in" size="lg" variant="dark">Sign in with your college email</ButtonLink>
  );

  return (
    <div className="overflow-x-clip">
      <TrackView name="landing_viewed" />
      <MotionRoot />
      <PublicHeader />

      {sp.notice === "deleted" && (
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6"><Notice tone="success">Your account and its data were deleted. Take care.</Notice></div>
      )}
      {sp.notice === "forbidden" && (
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6"><Notice tone="warning">That page is for moderators only.</Notice></div>
      )}

      {/* Hero: the line, and a real night on stage carrying the live exchange. */}
      <section className="mx-auto grid max-w-[1200px] grid-cols-[minmax(0,1fr)] items-center gap-10 px-4 pt-8 pb-20 sm:px-6 md:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] md:pt-14 md:pb-28">
        <div>
          <h1 className="font-display text-[clamp(3rem,7vw,6.25rem)] leading-[0.88] font-extrabold tracking-[-0.045em]">
            <span className="hero-line" style={{ "--i": 0 } as React.CSSProperties}>spare ticket?</span>
            <br />
            <span className="hero-line text-accent-strong" style={{ "--i": 1 } as React.CSSProperties}>sorted.</span>
          </h1>
          <p className="mt-7 max-w-[40ch] text-lg leading-relaxed text-ink-soft">
            Sell the ticket you can&apos;t use without spamming every group chat. Your number stays private until you accept a buyer. Then you both get one tap to WhatsApp, and the deal&apos;s on.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            {cta}
            <Link href="#how" className="rounded-[var(--radius-control)] px-3 py-3 text-[15px] font-medium underline-offset-4 hover:underline">
              how it works
            </Link>
          </div>
          <p className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
            <span className="flex items-center gap-1.5"><Lock className="size-4 text-positive" aria-hidden />Number hidden until you say yes</span>
            <span className="flex items-center gap-1.5"><BadgeCheck className="size-4 text-positive" aria-hidden />Verified college emails only</span>
            <span className="flex items-center gap-1.5"><Check className="size-4 text-positive" aria-hidden />Free, never touches your money</span>
          </p>
        </div>

        <div className="relative md:-mr-[max(0px,calc((100vw-1200px)/2+24px))]">
          <div className="relative overflow-hidden rounded-[36px] bg-accent py-8 pr-6 pl-6 sm:py-10 sm:pl-10 md:rounded-r-none md:pr-[max(24px,calc((100vw-1200px)/2+24px))]">
            <LoopVideo priority src={CLIPS.stageLights.src} poster={CLIPS.stageLights.poster} className="absolute inset-0" />
            {/* A wash of the accent keeps the panel ours, whatever colour the stage was. */}
            <span aria-hidden className="absolute inset-0 bg-accent opacity-35 mix-blend-multiply" />
            <div data-ui className="relative rounded-[20px] bg-surface p-5 shadow-[0_24px_60px_-28px_rgba(56,10,30,0.7)]">
              <span className="sticker absolute -top-4 -right-3 z-10 rounded-full bg-sticker px-3.5 py-1.5 text-sm font-bold whitespace-nowrap text-sticker-ink sm:-right-5">
                free. no cap.
              </span>
              <div className="flex items-baseline justify-between gap-4">
                <h2 className="flex items-center gap-2 text-base font-semibold">
                  <span aria-hidden className="live-dot size-2 rounded-full bg-positive" />
                  On the exchange right now
                </h2>
                <span className="num text-[13px] text-muted">
                  {totalTickets} {totalTickets === 1 ? "ticket" : "tickets"} live
                </span>
              </div>
              {events.length === 0 ? (
                <p className="mt-6 mb-2 text-sm text-muted">
                  no upcoming events listed yet. when the next one is announced, it shows up here.
                </p>
              ) : (
                <ul className="mt-4 flex flex-col gap-2">
                  {events.slice(0, 5).map((e) => (
                    <li key={e.id} style={bandStyle(e.id) as React.CSSProperties} className="flex overflow-hidden rounded-[10px]">
                      <div className="min-w-0 flex-1 bg-[var(--band)] px-3 py-2.5">
                        <p className="flex items-center gap-2 truncate text-sm font-semibold">
                          <span className="truncate">{e.name}</span>
                          {e.isFixture && <span className="flex-none rounded-full bg-notice-soft px-1.5 text-[11px] font-medium text-notice-ink">sample</span>}
                        </p>
                        <p className="truncate text-[12px] text-[var(--band-ink)]">
                          {formatDate(e.startsAt)} · {formatTime(e.startsAt)}{e.venue ? ` · ${e.venue}` : ""}
                        </p>
                      </div>
                      <div className="flex min-w-28 flex-none flex-col items-end justify-center border-l-2 border-dashed border-[color-mix(in_oklab,var(--band-ink)_28%,transparent)] bg-[var(--band-strong)] px-3 py-2 text-right">
                        {e.availableTickets > 0 ? (
                          <>
                            <span className="num text-sm font-semibold whitespace-nowrap">from {formatPaise(e.lowestPricePaise!)}</span>
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

      {/* Tape strip: the house rules as a band of sticker tape, always running. */}
      <div aria-hidden className="-mx-4 -rotate-2 bg-primary py-4 text-on-primary sm:py-5">
        <div className="tape-track flex w-max bg-primary">
          {[0, 1].map((copy) => (
            <div key={copy} className="flex items-center">
              {TAPE.map((t) => (
                <span key={t} className="flex items-center font-display text-[clamp(1.25rem,2.6vw,2rem)] font-bold tracking-[-0.02em] whitespace-nowrap">
                  <span className="px-6 sm:px-8">{t}</span>
                  <span className="size-3 rounded-full border-[3px] border-accent" />
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* The world it's for: real nights, laid end to end. */}
      <section aria-labelledby="fest-heading" className="mx-auto max-w-[1200px] px-4 pt-24 pb-20 sm:px-6 md:pt-32 md:pb-28">
        <div className="grid gap-5 md:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] md:items-end">
          <h2 id="fest-heading" data-reveal className={H2}>every night starts with a ticket.</h2>
          <p data-reveal style={{ "--i": 1 } as React.CSSProperties} className="max-w-[42ch] text-lg leading-relaxed text-ink-soft">
            Plans change, exams move, friends bail. The ticket you can&apos;t use is the one someone else is hunting for.
          </p>
        </div>
        <div className="mt-12 grid grid-cols-2 gap-[6px] md:flex">
          {BAND_PHOTOS.map((p, i) => {
            const shape = i === 0 ? "md:rounded-l-[32px]" : i === BAND_PHOTOS.length - 1 ? "md:rounded-r-[32px]" : "";
            return (
              <div
                key={p.alt}
                data-reveal
                style={{ "--i": i } as React.CSSProperties}
                className={`group/photo relative aspect-[3/4] min-w-0 overflow-hidden rounded-[18px] bg-raised md:aspect-auto md:h-[clamp(340px,36vw,500px)] md:rounded-none ${shape} ${i === 0 ? "md:flex-[5]" : "md:flex-[3]"}`}
              >
                <Image
                  src={p.src}
                  alt={p.alt}
                  placeholder="blur"
                  sizes={i === 0 ? "(min-width: 768px) 36vw, 50vw" : "(min-width: 768px) 22vw, 50vw"}
                  className="size-full object-cover transition-transform duration-1000 ease-[var(--ease-out-expo)] motion-safe:group-hover/photo:scale-[1.06]"
                  style={{ objectPosition: p.focus, transformOrigin: "100% 100%" }}
                />
              </div>
            );
          })}
        </div>
      </section>

      {/* Every kind of ticket gets its own shape. */}
      <section aria-labelledby="kinds-heading" className="relative overflow-hidden bg-accent-soft py-24 md:py-32">
        <div className="mx-auto grid max-w-[1200px] grid-cols-[minmax(0,1fr)] gap-12 px-4 sm:px-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-center">
          <div>
            <h2 id="kinds-heading" data-reveal className={H2}>wristband, QR, paper, whatever.</h2>
            <p data-reveal style={{ "--i": 1 } as React.CSSProperties} className="mt-5 max-w-[40ch] text-lg leading-relaxed text-ink-soft">
              Every kind of ticket looks like itself on ResTix, so you know what you&apos;re getting at a glance. Prices go green when they&apos;re under face value, and the real steals get a sticker.
            </p>
            <p data-reveal style={{ "--i": 2 } as React.CSSProperties} className="mt-6 text-[13px] text-muted">Examples, not real listings.</p>
          </div>
          <FormatShowcase
            items={EXAMPLES.map((e, i) => ({
              key: e.format,
              label: FORMAT_NOTES[e.format][0],
              note: FORMAT_NOTES[e.format][1],
              ticket: <TicketCard listing={example(e, i)} />,
            }))}
          />
        </div>
      </section>

      {/* How it works: four moves, each with the bit of the app you'll actually see. */}
      <section id="how" aria-labelledby="how-heading" className="bg-[#0e0e10] py-24 text-white md:py-32">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
          <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <h2 id="how-heading" data-reveal className={H2}>how it works</h2>
            <p data-reveal style={{ "--i": 1 } as React.CSSProperties} className="max-w-[36ch] text-[17px] text-white/70">Four moves. No middleman, no fees, no strangers from the internet.</p>
          </div>
          <ol className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, i) => (
              <li
                key={step.title}
                data-reveal
                style={{ "--i": i } as React.CSSProperties}
                className="group/step flex flex-col gap-6 rounded-[24px] border border-white/10 bg-white/[0.04] p-6 transition-[background-color,border-color,transform] duration-300 ease-[var(--ease-out-expo)] hover:border-white/25 hover:bg-white/[0.07] motion-safe:hover:-translate-y-1.5"
              >
                <div className="flex items-start justify-between">
                  <span aria-hidden className="font-display text-[5.5rem] leading-[0.8] font-extrabold tracking-[-0.06em] text-transparent [-webkit-text-stroke:1.5px_rgb(255_255_255/0.35)] transition-colors duration-300 group-hover/step:[-webkit-text-stroke-color:var(--step)]" style={{ "--step": step.color } as React.CSSProperties}>
                    {i + 1}
                  </span>
                  <span aria-hidden className="mt-2 size-3 rounded-full" style={{ background: step.color }} />
                </div>
                <div>
                  <h3 className="font-display text-[1.65rem] leading-[1.05] font-bold tracking-[-0.02em]">{step.title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-white/70">{step.body}</p>
                </div>
                <div aria-hidden className="mt-auto rounded-[16px] bg-white p-3 text-[13px] text-[#111827] shadow-[0_20px_40px_-24px_rgba(0,0,0,0.8)] transition-transform duration-500 ease-[var(--ease-out-expo)] motion-safe:group-hover/step:-rotate-2">
                  {step.vignette}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* What keeps it safe: one mark per promise, every tile built the same way so they line up. */}
      <section aria-labelledby="safe-heading" className="mx-auto max-w-[1200px] px-4 py-24 sm:px-6 md:py-36">
        <div className="grid gap-2 md:grid-cols-12">
          <div data-reveal className="flex flex-col justify-end rounded-[24px] bg-primary p-7 text-on-primary md:col-span-6 md:min-h-72">
            <h2 id="safe-heading" className={H2}>no randoms. no screenshots.</h2>
          </div>
          {[
            { span: "md:col-span-6", tone: "bg-positive-soft", mark: "text-positive", body: "text-positive-ink", icon: <BadgeCheck className="size-[1em] flex-none" strokeWidth={1.75} />, label: "college email", title: "Verified student accounts", text: "Everyone signs in with a verified college Google account. That proves the email; it doesn't vouch for the ticket." },
            { span: "md:col-span-6 lg:col-span-4", tone: "bg-accent-soft", mark: "text-accent-strong", body: "text-accent-ink", icon: <Lock className="size-[1em] flex-none" strokeWidth={1.75} />, label: "Private", title: "Your number stays yours", text: "Nobody sees your phone number while you list or ask. It's shared with one person, only after the seller says yes." },
            { span: "md:col-span-6 lg:col-span-4", tone: "bg-raised", mark: "text-ink", body: "text-muted", icon: null, label: "₹0 fees", title: "We never touch money", text: "No payments, no fees, no escrow. Pay at the handover, after you've checked the ticket." },
            { span: "md:col-span-12 lg:col-span-4", tone: "bg-negative-soft", mark: "text-negative-ink", body: "text-negative-ink", icon: <Flag className="size-[0.9em] flex-none" strokeWidth={1.75} />, label: "Report this", title: "Real moderators", text: "Reports go to a queue. Listings come down, accounts get restricted, every action is logged and can be appealed." },
          ].map((t, i) => (
            <div key={t.title} data-reveal style={{ "--i": i + 1 } as React.CSSProperties} className={`${t.span} ${t.tone} flex flex-col gap-16 rounded-[24px] p-7 md:gap-24`}>
              <p data-ui aria-hidden className={`${t.mark} num flex items-center gap-3 font-display text-[2.4rem] leading-none font-bold tracking-[-0.03em]`}>
                {t.icon}
                <span className="truncate">{t.label}</span>
              </p>
              <div>
                <h3 className="text-lg font-semibold">{t.title}</h3>
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
        <span aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-black/75 via-black/35 to-black/10" />
        <div className="mx-auto w-full max-w-[1200px] px-4 pt-40 pb-16 text-white sm:px-6 md:pb-24">
          <h2 id="moment-heading" data-reveal className="max-w-[13ch] font-display text-[clamp(2.75rem,7.5vw,6.5rem)] leading-[0.9] font-extrabold tracking-[-0.045em] text-balance">
            don&apos;t watch it on someone&apos;s story.
          </h2>
          <div data-reveal style={{ "--i": 1 } as React.CSSProperties} className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
            <ButtonLink href={signedIn ? "/tickets" : "/sign-in"} size="lg" variant="buy">
              Find tickets <ArrowRight className="size-4" aria-hidden />
            </ButtonLink>
            <p className="max-w-[36ch] text-[15px] text-white/90">If someone can&apos;t make it, their ticket shows up here first.</p>
          </div>
        </div>
      </section>

      {/* Questions: one clean list, the topic as a small label beside each. */}
      <section aria-labelledby="faq-heading" className="mx-auto max-w-[1000px] px-4 pt-24 pb-24 sm:px-6 md:pt-36 md:pb-36">
        <h2 id="faq-heading" data-reveal className={`mb-12 ${H2}`}>questions, answered</h2>
        <div className="border-b border-border">
          {FAQ.map((f, i) => (
            <details key={f.q} open={i === 0} data-reveal style={{ "--i": i } as React.CSSProperties} className="faq-item group border-t border-border">
              <summary className="grid cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-1 py-6 sm:grid-cols-[8.5rem_minmax(0,1fr)_auto] [&::-webkit-details-marker]:hidden">
                <span className="text-[12px] font-bold tracking-[0.14em] text-accent-strong uppercase sm:pt-1">{f.tab}</span>
                <span className="col-start-1 font-display text-[clamp(1.25rem,2.4vw,1.625rem)] leading-tight font-extrabold tracking-[-0.025em] text-ink sm:col-start-2">
                  {f.q}
                </span>
                <span aria-hidden className="faq-plus col-start-2 row-span-2 row-start-1 grid size-10 place-items-center rounded-full border border-border text-xl leading-none text-ink group-hover:bg-raised sm:col-start-3">
                  +
                </span>
              </summary>
              <p className="max-w-[60ch] pb-7 text-base leading-relaxed text-ink-soft sm:ml-[calc(8.5rem+1.5rem)]">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Closing statement, beside the crowd it is for. */}
      <section aria-labelledby="closing-heading" className="mx-auto max-w-[1200px] px-4 pb-24 sm:px-6 md:pb-32">
        <div className="grid items-end gap-8 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-10">
          <div data-reveal className="flex flex-col items-start gap-8">
            <h2 id="closing-heading" className={`max-w-[12ch] ${H2}`}>your night. your tickets.</h2>
            {cta}
          </div>
          <div data-reveal style={{ "--i": 1 } as React.CSSProperties}>
            <LoopVideo src={CLIPS.handsUp.src} poster={CLIPS.handsUp.poster} className="relative aspect-[16/9] rounded-[28px] bg-raised" />
          </div>
        </div>
      </section>

      <SiteFooter year={new Date().getFullYear()} />
    </div>
  );
}

// The four steps, each with a little piece of the real interface as its picture.
const STEPS: { title: string; body: string; color: string; vignette: React.ReactNode }[] = [
  {
    title: "List it in a minute.",
    body: "Pick the event, the kind of ticket, the price. Everything else is optional.",
    color: "#ff7eb3",
    vignette: (
      <ul className="flex flex-col gap-1.5">
        {["Fest night", "Wristband", "₹600 each"].map((t) => (
          <li key={t} className="flex items-center justify-between rounded-[10px] bg-[#f3f4f6] px-3 py-2 font-medium">
            {t} <Check className="size-4 text-[#166534]" strokeWidth={2.5} />
          </li>
        ))}
      </ul>
    ),
  },
  {
    title: "Requests roll in.",
    body: "Verified students ask for it, or make an offer. You see their name, never their email.",
    color: "#ffd84d",
    vignette: (
      <div className="flex flex-col gap-1.5">
        <p className="rounded-[12px] rounded-bl-[4px] bg-[#f3f4f6] px-3 py-2"><b>Aarav</b> wants 2 · offers ₹550</p>
        <p className="rounded-[12px] rounded-bl-[4px] bg-[#f3f4f6] px-3 py-2"><b>Diya</b> wants 1</p>
      </div>
    ),
  },
  {
    title: "You pick who.",
    body: "Your number stays hidden until you say yes. Then you both get one tap to WhatsApp, message already written.",
    color: "#7ee0a1",
    vignette: (
      <div className="flex flex-col gap-1.5">
        <span className="flex items-center justify-center gap-2 rounded-[10px] bg-[#166534] px-3 py-2 font-semibold text-white">Accept &amp; share contact</span>
        <span className="flex items-center justify-center gap-2 rounded-[10px] border border-[#d1d5db] px-3 py-2 font-medium"><MessageCircle className="size-4" /> WhatsApp Aarav</span>
      </div>
    ),
  },
  {
    title: "Swap. Keep the cash.",
    body: "Meet somewhere public or send it over. Check it, pay each other. ResTix takes nothing.",
    color: "#8fb8ff",
    vignette: (
      <div className="flex items-center justify-between gap-3 px-1 py-1">
        <span>
          <span className="block font-display text-[1.75rem] leading-none font-extrabold tracking-[-0.03em]">₹0</span>
          <span className="text-[12px] text-[#5f6672]">fees, ever</span>
        </span>
        <span className="flex items-center gap-1.5 rounded-full bg-[#dcfce7] px-3 py-1.5 font-semibold text-[#14532d]"><Check className="size-4" strokeWidth={2.5} /> Handed over</span>
      </div>
    ),
  },
];
