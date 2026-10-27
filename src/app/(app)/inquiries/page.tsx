import type { Metadata } from "next";
import Link from "next/link";
import { requireBrowser } from "@/server/auth/viewer";
import { inbox, markRepliesSeen, type InquiryRow, type InquiryStatus } from "@/server/inquiries";
import { STATUS_LABEL } from "@/lib/listing-rules";
import { privateProfile } from "@/server/profile";
import { FORMAT_LABEL, type TicketFormat } from "@/lib/listing-rules";
import { formatDate, relativeTime } from "@/lib/format";
import { formatPaise } from "@/lib/money";
import { bandStyle } from "@/lib/tint";
import { Bargain, OutcomeForm, RespondForm, SharedContact, SmallAction, WhatsAppSeller, type OfferView } from "./inquiry-panels";
import { offersFor } from "@/server/offers";
import { buyerOpener, waLink } from "@/lib/whatsapp";
import { EmptyState, PageTitle, Panel, Pill, type Tone } from "@/components/ui/bits";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "Inquiries" };

const STATUS: Record<InquiryStatus, [string, Tone]> = {
  pending: ["Waiting", "warning"],
  accepted: ["Contact shared", "positive"],
  declined: ["Declined", "neutral"],
  withdrawn: ["Withdrawn", "neutral"],
  closed: ["Closed", "neutral"],
};

const OUTCOME_LABEL = { completed: "handed over", not_completed: "didn't happen", disputed: "disputed" } as const;

export default async function InquiriesPage({ searchParams }: PageProps<"/inquiries">) {
  const sp = await searchParams;
  const viewer = await requireBrowser("/inquiries");
  const [rows, priv] = await Promise.all([inbox(viewer.id), privateProfile(viewer.id)]);
  const received = rows.filter((r) => r.role === "seller");
  const sent = rows.filter((r) => r.role === "buyer");
  const waiting = received.filter((r) => r.status === "pending").length;
  const newReplies = sent.filter((r) => r.respondedAt && (r.status === "accepted" || r.status === "declined") && !r.buyerSeenAt).length;
  const tab = sp.tab === "sent" ? "sent" : sp.tab === "received" ? "received" : waiting > 0 || (sent.length === 0 && newReplies === 0) ? "received" : "sent";
  const list = tab === "received" ? received : sent;
  // Opening "You asked" counts the seller replies there as seen (clears the nav badge).
  const unseen = sent.filter((r) => r.respondedAt && (r.status === "accepted" || r.status === "declined") && !r.buyerSeenAt).length;
  if (tab === "sent" && unseen > 0) await markRepliesSeen(viewer.id);
  const offers = await offersFor(viewer.id, list.map((r) => r.id));

  return (
    <>
      <PageTitle
        title="Inquiries"
        sub={waiting ? `${waiting} ${waiting === 1 ? "buyer is" : "buyers are"} waiting on you. A quick yes or no helps.` : "requests about your listings, and the ones you've sent."}
      />
      <div role="tablist" aria-label="Inquiries" className="mb-5 flex gap-1 border-b border-border">
        {([["received", `For your listings (${received.length})`], ["sent", `You asked (${sent.length})${unseen && tab !== "sent" ? ` · ${unseen} new` : ""}`]] as const).map(([key, label]) => (
          <Link
            key={key}
            role="tab"
            aria-selected={tab === key}
            href={`/inquiries?tab=${key}`}
            className={`-mb-px border-b-2 px-3 py-2.5 text-sm transition-colors ${tab === key ? "border-accent font-medium text-ink" : "border-transparent text-muted hover:text-ink"}`}
          >
            {label}
          </Link>
        ))}
      </div>

      {list.length === 0 ? (
        tab === "received" ? (
          <EmptyState title="no one's asked yet" action={<ButtonLink href="/sell" variant="secondary">List a ticket</ButtonLink>}>
            When someone asks about one of your listings, it shows up here.
          </EmptyState>
        ) : (
          <EmptyState title="you haven't asked about anything yet" action={<ButtonLink href="/tickets" variant="secondary">Find tickets</ButtonLink>} />
        )
      ) : (
        <ul className="flex flex-col gap-3" role="tabpanel">
          {list.map((r) => (
            <li key={r.id}>
              <InquiryCard
                row={r}
                hasWhatsapp={Boolean(priv?.whatsappNumber)}
                viewerName={viewer.displayName}
                offers={(offers.get(r.id) ?? []).map((o) => ({ id: o.id, amountPaise: o.amountPaise, status: o.status, mine: o.fromUser === viewer.id }))}
              />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function InquiryCard({ row: r, hasWhatsapp, viewerName, offers }: { row: InquiryRow; hasWhatsapp: boolean; viewerName: string; offers: OfferView[] }) {
  const live = r.status === "pending" || r.status === "accepted";
  // Buyers open bargaining only on "open to offers" listings, unless the seller already made an offer.
  const canOffer = live && r.agreedPricePaise === null && (r.role === "seller" || r.priceNegotiable || offers.some((o) => !o.mine));
  const chat = r.role === "buyer" && r.status === "accepted" && r.sellerWhatsapp
    ? buyerOpener({
        buyerName: viewerName, sellerName: r.counterpartName, eventName: r.eventName, ticketTypeName: r.ticketTypeName,
        quantity: r.quantityRequested, askingPricePaise: r.askingPricePaise, agreedPricePaise: r.agreedPricePaise,
      })
    : null;
  const chatHref = chat ? waLink(r.sellerWhatsapp, chat) : null;
  const [label, tone] = STATUS[r.status];
  const style = bandStyle(r.eventId) as React.CSSProperties;
  const showOutcome = (r.status === "accepted" || r.status === "closed") && r.respondedAt && !r.myOutcome;
  return (
    <Panel as="article" className="overflow-hidden">
      <div style={style} className="flex flex-wrap items-center justify-between gap-3 bg-[var(--band)] px-5 py-3">
        <Link href={`/listings/${r.listingId}`} className="min-w-0 hover:underline">
          <span className="font-semibold">{r.eventName}</span>
          <span className="text-[13px] text-[var(--band-ink)]">
            {" "}· {r.ticketTypeName} · {FORMAT_LABEL[r.format as TicketFormat]} · {formatPaise(r.askingPricePaise)} · {formatDate(r.eventStartsAt)}
          </span>
        </Link>
        <div className="flex flex-wrap gap-2">
          {r.listingStatus !== "active" && r.listingStatus !== "paused" && (
            <Pill tone="neutral">Listing {STATUS_LABEL[r.listingStatus].toLowerCase()}</Pill>
          )}
          <Pill tone={tone}>{label}</Pill>
        </div>
      </div>
      <div className="flex flex-col gap-4 px-5 py-4">
        <div>
          <p className="text-[13px] text-muted">
            {r.role === "seller" ? `${r.counterpartName} asked for ${r.quantityRequested}` : `You asked ${r.counterpartName} for ${r.quantityRequested}`} · {relativeTime(r.createdAt)}
          </p>
          <p className="mt-1.5 text-[15px] leading-relaxed whitespace-pre-line">{r.message}</p>
        </div>

        <Bargain
          inquiryId={r.id}
          offers={offers}
          otherName={r.counterpartName.split(/\s+/)[0]}
          agreedPricePaise={r.agreedPricePaise}
          canOffer={canOffer}
          askingPricePaise={r.askingPricePaise}
        />

        {r.role === "seller" && r.status === "pending" && <RespondForm inquiryId={r.id} hasWhatsapp={hasWhatsapp} />}

        {r.status === "accepted" && (r.sellerContactShared || r.sellerWhatsapp) && (
          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium">{r.role === "buyer" ? "How to reach the seller" : "You shared"}</p>
            {chatHref && chat && <WhatsAppSeller href={chatHref} preview={chat} />}
            {r.role === "seller" && r.sellerWhatsapp && <p className="text-[15px] text-positive-ink">Your WhatsApp number, with this buyer only.</p>}
            {r.sellerContactShared && <SharedContact text={r.sellerContactShared} />}
            {r.role === "buyer" && (
              <p className="text-[13px] text-muted">Meet somewhere public on campus. Check the ticket before you pay. ResTix can&apos;t recover money sent in advance.</p>
            )}
          </div>
        )}

        {showOutcome && <OutcomeForm inquiryId={r.id} />}
        {r.myOutcome && (
          <p className="text-[13px] text-muted">
            You marked this {OUTCOME_LABEL[r.myOutcome]}
            {r.theirOutcome ? `; they marked it ${OUTCOME_LABEL[r.theirOutcome]}` : ""}.
            {r.myOutcome === "disputed" && (
              <> If you haven&apos;t yet, <Link href={`/listings/${r.listingId}`} className="underline">report it</Link> so a moderator can look.</>
            )}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {r.role === "buyer" && (r.status === "pending" || r.status === "accepted") && <SmallAction inquiryId={r.id} kind="withdraw" />}
          {r.role === "seller" && r.status === "accepted" && <SmallAction inquiryId={r.id} kind="close" />}
        </div>
      </div>
    </Panel>
  );
}
